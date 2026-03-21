import { app, BrowserWindow, dialog, ipcMain, Menu, shell, protocol } from "electron";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync, watch } from "node:fs";
import { exec, fork, spawn } from "node:child_process";
import type { ChildProcess, ChildProcessWithoutNullStreams } from "node:child_process";
import { promisify } from "node:util";
import net from "node:net";
import * as chokidar from "chokidar";
import type {
  AppCommand,
  AppStateSnapshot,
  CodeBootstrap,
  CodeSessionEvent,
  CodeSessionStartInput,
  CodeTurnInput,
  FileNode,
  GitBranchInfo,
  GitCompareDetails,
  GitCommitFileDiffContent,
  GitCommitDetails,
  GitChangedFile,
  GitGraphEntry,
  GitDiffContent,
  GitDetails,
  GitRepositoryInfo,
  GitWorktreeInfo,
  PortForwardInfo,
  ProjectRecord,
  SearchMatch,
  SearchQueryOptions,
  ShellCommandResult,
  TerminalSessionInfo
} from "../shared/types";
import { CodexHost } from "./codex-host";

const execAsync = promisify(exec);
const STATE_FILE = "naeditor-state.json";

let mainWindow: BrowserWindow | null = null;
const terminalSessions = new Map<
  string,
  {
    projectId: string;
    cwd: string;
    buffer: string;
    exitCode: number | null;
  }
>();
const terminalRequests = new Map<
  string,
  {
    resolve: () => void;
    reject: (error: Error) => void;
  }
>();
let terminalHost: ChildProcess | null = null;
const codexHost = new CodexHost();
const portForwards = new Map<
  string,
  {
    process: ChildProcessWithoutNullStreams;
    info: PortForwardInfo;
  }
>();

const colorPalette = ["#E76F51", "#2A9D8F", "#E9C46A", "#457B9D", "#F4A261", "#8AB17D"];
const ignoredNames = new Set([".git", "node_modules", "dist", ".next"]);

const fileWatchers = new Map<string, chokidar.FSWatcher>();
const directoryCacheByProject = new Map<string, Map<string, FileNode[]>>();

function getOrCreateWatcher(projectId: string, rootPath: string): chokidar.FSWatcher {
  const key = `${projectId}:${rootPath}`;
  
  if (fileWatchers.has(key)) {
    return fileWatchers.get(key)!;
  }

  const watcher = chokidar.watch(rootPath, {
    ignored: /(^|[\/\\])\.|node_modules/,
    persistent: true,
    ignoreInitial: true,
    depth: 10
  });

  watcher.on("all", (event, filePath) => {
    console.log(`[naeditor] File ${event}: ${filePath}`);
    mainWindow?.webContents.send("fs:file-changed", { projectId, rootPath, event, filePath });
  });

  fileWatchers.set(key, watcher);
  return watcher;
}

function closeWatcher(projectId: string, rootPath: string) {
  const key = `${projectId}:${rootPath}`;
  const watcher = fileWatchers.get(key);
  if (watcher) {
    watcher.close();
    fileWatchers.delete(key);
  }
}

codexHost.on("event", (event: CodeSessionEvent) => {
  mainWindow?.webContents.send("code:event", event);
});

async function createWindow() {
  // Determine icon path for dev vs production
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "assets/logo.png")
    : path.join(__dirname, "../../src/renderer/assets/logo.png");
  
  mainWindow = new BrowserWindow({
    show: false,
    width: 1540,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0d1117",
    ...(existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      webSecurity: false
    }
  });

  mainWindow.once("ready-to-show", () => {
    console.log("[naeditor] main window ready-to-show");
    mainWindow?.show();
    mainWindow?.focus();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.on("did-finish-load", () => {
    console.log("[naeditor] renderer finished loading");
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error("[naeditor] renderer failed to load", {
      errorCode,
      errorDescription,
      validatedURL
    });
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("[naeditor] renderer process gone", details);
  });

  mainWindow.webContents.on("unresponsive", () => {
    console.error("[naeditor] renderer became unresponsive");
  });

  void loadMainWindowContent();

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") {
      return;
    }

    const command = mapAppCommand(input);
    if (!command) {
      return;
    }

    event.preventDefault();
    mainWindow?.webContents.send("app:command", command);
  });
}

async function loadMainWindowContent() {
  if (!mainWindow) {
    return;
  }

  const candidates = Array.from(
    new Set(
      [process.env.VITE_DEV_SERVER_URL, !app.isPackaged ? "http://localhost:5173" : null]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );

  for (const candidate of candidates) {
    try {
      await mainWindow.loadURL(candidate);
      mainWindow.show();
      mainWindow.focus();
      return;
    } catch (error) {
      console.warn(`Unable to load renderer from ${candidate}; falling back if possible.`, error);
    }
  }

  await mainWindow.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
  mainWindow.show();
  mainWindow.focus();
}

function ensureTerminalHost() {
  if (terminalHost && terminalHost.connected) {
    return terminalHost;
  }

  const host = fork(path.join(__dirname, "terminal-host.js"), {
    stdio: ["pipe", "pipe", "pipe", "ipc"]
  });

  host.on("message", (message: unknown) => {
    if (!message || typeof message !== "object" || !("type" in message)) {
      return;
    }

    const typed = message as
      | { type: "response"; requestId: string; ok: boolean; error?: string }
      | { type: "terminal-data"; payload: { sessionId: string; data: string } }
      | { type: "terminal-exit"; payload: { sessionId: string; exitCode: number } };

    if (typed.type === "response") {
      const pending = terminalRequests.get(typed.requestId);
      if (!pending) {
        return;
      }

      terminalRequests.delete(typed.requestId);
      if (typed.ok) {
        pending.resolve();
      } else {
        pending.reject(new Error(typed.error ?? "Terminal host request failed"));
      }
      return;
    }

    if (typed.type === "terminal-data") {
      const session = terminalSessions.get(typed.payload.sessionId);
      if (session) {
        session.buffer = `${session.buffer}${typed.payload.data}`;
      }
      mainWindow?.webContents.send("terminal:data", typed.payload);
      return;
    }

    if (typed.type === "terminal-exit") {
      const session = terminalSessions.get(typed.payload.sessionId);
      if (session) {
        session.exitCode = typed.payload.exitCode;
      }
      mainWindow?.webContents.send("terminal:exit", typed.payload);
    }
  });

  host.on("exit", (code, signal) => {
    terminalHost = null;
    const error = new Error(`Terminal host exited (${signal ?? code ?? "unknown"})`);
    for (const pending of terminalRequests.values()) {
      pending.reject(error);
    }
    terminalRequests.clear();
  });

  terminalHost = host;
  return host;
}

function sendTerminalHostRequest(
  type: "create-session",
  payload: {
    sessionId: string;
    sessionKind: "terminal";
    cwd?: string;
    project?: ProjectRecord;
  }
) {
  const host = ensureTerminalHost();
  const requestId = `terminal-request-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return new Promise<void>((resolve, reject) => {
    terminalRequests.set(requestId, { resolve, reject });
    host.send({ type, requestId, payload });
  });
}

function sendTerminalHostMessage(
  type: "write" | "resize" | "close",
  payload:
    | { sessionId: string; data: string }
    | { sessionId: string; cols: number; rows: number }
    | { sessionId: string }
) {
  const host = ensureTerminalHost();
  host.send({ type, payload });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function installAppMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Open Project…",
          accelerator: "Command+O",
          click: () => sendAppCommand("open-project")
        },
        {
          label: "Save",
          accelerator: "Command+S",
          click: () => sendAppCommand("save-file")
        },
        {
          label: "Close Tab",
          accelerator: "Command+W",
          click: () => sendAppCommand("close-tab")
        },
        {
          label: "New Tab",
          accelerator: "Command+T",
          click: () => sendAppCommand("new-tab")
        },
        { type: "separator" as const },
        {
          label: "Preferences…",
          accelerator: "Command+,",
          click: () => sendAppCommand("open-settings")
        }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" as const },
        { role: "redo" as const },
        { type: "separator" as const },
        { role: "cut" as const },
        { role: "copy" as const },
        { role: "paste" as const },
        { role: "pasteAndMatchStyle" as const },
        { role: "delete" as const },
        { role: "selectAll" as const }
      ]
    },
    {
      label: "View",
      submenu: [
        {
          label: "Toggle Sidebar",
          accelerator: "Command+B",
          click: () => sendAppCommand("toggle-inspector")
        },
        {
          label: "Files",
          accelerator: "Command+Shift+E",
          click: () => sendAppCommand("show-files")
        },
        {
          label: "Search",
          accelerator: "Command+Shift+F",
          click: () => sendAppCommand("show-search")
        },
        {
          label: "Source Control",
          accelerator: "Command+Shift+G",
          click: () => sendAppCommand("show-git")
        },
        {
          label: "Browser DevTools",
          accelerator: "Command+Alt+I",
          click: () => sendAppCommand("toggle-browser-devtools")
        },
        {
          label: "Split Terminal Vertical",
          accelerator: "Command+D",
          click: () => sendAppCommand("split-terminal-vertical")
        },
        {
          label: "Split Terminal Horizontal",
          accelerator: "Command+Shift+D",
          click: () => sendAppCommand("split-terminal-horizontal")
        },
        {
          label: "Close Terminal Pane",
          accelerator: "Command+Shift+W",
          click: () => sendAppCommand("close-terminal-pane")
        },
        { type: "separator" as const },
        {
          label: "Toggle Project Rail",
          accelerator: "Command+Control+B",
          click: () => sendAppCommand("toggle-rail")
        }
      ]
    },
    {
      label: "Navigate",
      submenu: [
        {
          label: "Previous Project",
          accelerator: "Command+Control+Up",
          click: () => sendAppCommand("project-up")
        },
        {
          label: "Next Project",
          accelerator: "Command+Control+Down",
          click: () => sendAppCommand("project-down")
        },
        {
          label: "Move Viewport Left",
          accelerator: "Command+Control+Left",
          click: () => sendAppCommand("track-left")
        },
        {
          label: "Move Viewport Right",
          accelerator: "Command+Control+Right",
          click: () => sendAppCommand("track-right")
        },
        { type: "separator" as const },
        {
          label: "Anchor Editor",
          accelerator: "Command+Control+1",
          click: () => sendAppCommand("anchor-editor")
        },
        {
          label: "Anchor Code",
          accelerator: "Command+Control+2",
          click: () => sendAppCommand("anchor-code")
        },
        {
          label: "Anchor Terminal",
          accelerator: "Command+Control+3",
          click: () => sendAppCommand("anchor-terminal")
        },
        {
          label: "Anchor Browser",
          accelerator: "Command+Control+4",
          click: () => sendAppCommand("anchor-browser")
        },
        { type: "separator" as const },
        {
          label: "Save Active File",
          accelerator: "Command+Control+S",
          click: () => sendAppCommand("save-file")
        },
        {
          label: "Toggle Project Rail",
          accelerator: "Command+Control+B",
          click: () => sendAppCommand("toggle-rail")
        },
        {
          label: "Toggle Inspector",
          accelerator: "Command+Control+I",
          click: () => sendAppCommand("toggle-inspector")
        },
        {
          label: "Flip Inspector Dock",
          accelerator: "Command+Control+\\",
          click: () => sendAppCommand("flip-inspector")
        },
        {
          label: "Grow Surface",
          accelerator: "Command+Control+]",
          click: () => sendAppCommand("grow-surface")
        },
        {
          label: "Shrink Surface",
          accelerator: "Command+Control+[",
          click: () => sendAppCommand("shrink-surface")
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function sendAppCommand(command: AppCommand) {
  mainWindow?.webContents.send("app:command", command);
}

function mapAppCommand(input: Electron.Input) {
  const key = input.key.toLowerCase();
  const hasCmd = input.meta;
  const hasCtrl = input.control;
  const hasShift = input.shift;

  if (hasCmd && hasCtrl) {
    switch (key) {
      case "arrowleft":
        return "track-left" as const;
      case "arrowright":
        return "track-right" as const;
      case "arrowup":
        return "project-up" as const;
      case "arrowdown":
        return "project-down" as const;
      case "1":
        return "anchor-editor" as const;
      case "2":
        return "anchor-code" as const;
      case "3":
        return "anchor-terminal" as const;
      case "4":
        return "anchor-browser" as const;
      case "s":
        return "save-file" as const;
      case "b":
        return "toggle-rail" as const;
      case "i":
        return "toggle-inspector" as const;
      case "\\":
        return "flip-inspector" as const;
      case "]":
        return "grow-surface" as const;
      case "[":
        return "shrink-surface" as const;
      default:
        return null;
    }
  }

  if (hasCmd && hasShift) {
    switch (key) {
      case "e":
        return "show-files" as const;
      case "f":
        return "show-search" as const;
      case "g":
        return "show-git" as const;
      case "d":
        return "split-terminal-horizontal" as const;
      case "w":
        return "close-terminal-pane" as const;
      default:
        return null;
    }
  }

  if (hasCmd && !hasCtrl && !hasShift) {
    switch (key) {
      case "o":
        return "open-project" as const;
      case ",":
        return "open-settings" as const;
      case "s":
        return "save-file" as const;
      case "w":
        return "close-tab" as const;
      case "t":
        return "new-tab" as const;
      case "d":
        return "split-terminal-vertical" as const;
      case "b":
        return "toggle-inspector" as const;
      case "1":
        return "anchor-editor" as const;
      case "2":
        return "anchor-code" as const;
      case "3":
        return "anchor-terminal" as const;
      case "4":
        return "anchor-browser" as const;
      default:
        return null;
    }
  }

  if (hasCmd && input.alt && !hasCtrl && !hasShift) {
    switch (key) {
      case "i":
        return "toggle-browser-devtools" as const;
      default:
        return null;
    }
  }

  return null;
}

function getStateFilePath() {
  return path.join(app.getPath("userData"), STATE_FILE);
}

async function loadStateFile(): Promise<AppStateSnapshot | null> {
  try {
    const contents = await fs.readFile(getStateFilePath(), "utf8");
    const snapshot = JSON.parse(contents) as AppStateSnapshot;
    const migrated = migrateSnapshot(snapshot);
    if (JSON.stringify(snapshot) !== JSON.stringify(migrated)) {
      await saveStateFile(migrated);
    }
    return migrated;
  } catch {
    return null;
  }
}

async function saveStateFile(snapshot: AppStateSnapshot) {
  await fs.mkdir(app.getPath("userData"), { recursive: true });
  await fs.writeFile(getStateFilePath(), JSON.stringify(snapshot, null, 2), "utf8");
}

function migrateSnapshot(snapshot: AppStateSnapshot): AppStateSnapshot {
  const projects = snapshot.projects.map((project) => ({
    ...project,
    previewUrl: project.previewUrl === "http://localhost:3000" ? "" : project.previewUrl
  }));

  const workspaces = Object.fromEntries(
    Object.entries(snapshot.workspaces).map(([projectId, workspace]) => [
      projectId,
      {
        ...workspace,
        browserUrl: workspace.browserUrl === "http://localhost:3000" ? "" : workspace.browserUrl,
        track: {
          ...workspace.track,
          viewportOffset:
            typeof workspace.track.viewportOffset === "number" ? workspace.track.viewportOffset : 0
        }
      }
    ])
  );

  return {
    ...snapshot,
    projects,
    workspaces
  };
}

async function readDirectory(rootPath: string): Promise<FileNode[]> {
  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  const children = await Promise.all(
    entries
      .filter((entry) => !shouldIgnoreEntry(entry.name))
      .map(async (entry) => {
        const absolutePath = path.join(rootPath, entry.name);
        if (entry.isDirectory()) {
          return {
            name: entry.name,
            path: absolutePath,
            type: "directory" as const,
            children: await readDirectory(absolutePath)
          };
        }

        return {
          name: entry.name,
          path: absolutePath,
          type: "file" as const
        };
      })
  );

  return children
    .sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === "directory" ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    });
}

function shouldIgnoreEntry(name: string) {
  return name.startsWith(".git") || ignoredNames.has(name);
}

async function openProjectDirectory(): Promise<ProjectRecord | null> {
  if (!mainWindow) {
    return null;
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Open Project Folder",
    properties: ["openDirectory"]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const rootPath = result.filePaths[0];
  return {
    id: `project-${Date.now()}`,
    name: path.basename(rootPath),
    kind: "local",
    rootPath,
    previewUrl: "",
    color: colorPalette[Math.floor(Math.random() * colorPalette.length)]
  };
}

async function runCommand(cwd: string, command: string): Promise<ShellCommandResult> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      shell: "/bin/zsh",
      maxBuffer: 1024 * 1024 * 4
    });

    return {
      stdout,
      stderr,
      exitCode: 0
    };
  } catch (error) {
    const execError = error as Error & {
      stdout?: string;
      stderr?: string;
      code?: number;
    };

    return {
      stdout: execError.stdout ?? "",
      stderr: execError.stderr ?? execError.message,
      exitCode: execError.code ?? 1
    };
  }
}

async function runProjectCommand(project: ProjectRecord, command: string, input?: string) {
  if (project.kind === "remote") {
    return runRemoteCommand(project, command, input);
  }

  return runLocalCommand(project.rootPath ?? process.cwd(), command, input);
}

async function runLocalCommand(cwd: string, command: string, input?: string): Promise<ShellCommandResult> {
  if (!input) {
    return runCommand(cwd, command);
  }

  return new Promise((resolve) => {
    const child = spawn("/bin/zsh", ["-lc", command], {
      cwd
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1
      });
    });
    child.stdin.write(input);
    child.stdin.end();
  });
}

async function runRemoteCommand(project: ProjectRecord, command: string, input?: string): Promise<ShellCommandResult> {
  const target = getSshTarget(project);
  if (!target) {
    return {
      stdout: "",
      stderr: "Missing remote host or SSH profile",
      exitCode: 1
    };
  }

  return new Promise((resolve) => {
    const child = spawn("ssh", [target, command], {
      stdio: "pipe"
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1
      });
    });
    if (input) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

function getSshTarget(project: ProjectRecord) {
  return project.sshProfile || project.host || null;
}

function quoteShell(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function quoteRemotePath(value: string) {
  if (value === "~") {
    return "~";
  }

  if (value.startsWith("~/")) {
    const remainder = value.slice(2);
    if (!remainder) {
      return "~/";
    }

    return `~/${remainder
      .split("/")
      .filter(Boolean)
      .map((segment) => quoteShell(segment))
      .join("/")}`;
  }

  return quoteShell(value);
}

function quoteProjectPath(project: ProjectRecord, value: string) {
  return project.kind === "remote" ? quoteRemotePath(value) : quoteShell(value);
}

async function readProjectDirectory(project: ProjectRecord, rootPath: string) {
  if (project.kind === "local") {
    return readDirectory(rootPath);
  }

  const quotedRoot = quoteProjectPath(project, rootPath);
  const command = `
    cd ${quotedRoot} &&
    find . \\( -name .git -o -name node_modules -o -name dist -o -name .next \\) -prune -o -print
  `.trim();

  const result = await runRemoteCommand(project, command);
  if (result.exitCode !== 0) {
    return [];
  }

  return buildFileTreeFromFindOutput(rootPath, result.stdout);
}

function buildFileTreeFromFindOutput(rootPath: string, output: string): FileNode[] {
  const root: FileNode = {
    name: path.basename(rootPath),
    path: rootPath,
    type: "directory",
    children: []
  };

  const nodeMap = new Map<string, FileNode>([[rootPath, root]]);
  const lines = output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && line !== ".");

  for (const line of lines) {
    const cleanRelative = line.startsWith("./") ? line.slice(2) : line;
    const absolutePath = path.posix.join(rootPath, cleanRelative);
    const segments = cleanRelative.split("/");
    let currentPath = rootPath;
    let parentNode = root;

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      const nextPath = path.posix.join(currentPath, segment);

      let existing = nodeMap.get(nextPath);
      if (!existing) {
        existing = {
          name: segment,
          path: nextPath,
          type: "directory",
          children: []
        };
        nodeMap.set(nextPath, existing);
        parentNode.children = parentNode.children ?? [];
        parentNode.children.push(existing);
      }

      currentPath = nextPath;
      if (existing.type === "directory") {
        parentNode = existing;
      }
    }
  }

  markLeafFiles(root.children ?? []);
  sortFileTree(root.children ?? []);
  return root.children ?? [];
}

function markLeafFiles(nodes: FileNode[]) {
  for (const node of nodes) {
    if (!node.children || node.children.length === 0) {
      node.type = "file";
      delete node.children;
      continue;
    }

    node.type = "directory";
    markLeafFiles(node.children);
  }
}

function sortFileTree(nodes: FileNode[]) {
  nodes.sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === "directory" ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });

  for (const node of nodes) {
    if (node.children) {
      sortFileTree(node.children);
    }
  }
}

async function readProjectFile(project: ProjectRecord, targetPath: string) {
  const resolvedPath = resolveProjectTargetPath(project, targetPath);
  
  // Check if it's an image file
  const isSvg = /\.svg$/i.test(targetPath);
  const isImage = /\.(png|jpg|jpeg|gif|webp|ico|avif|bmp)$/i.test(targetPath);
  
  if (project.kind === "local") {
    // Read SVGs as text so they can be inlined
    if (isSvg) {
      const content = await fs.readFile(resolvedPath, "utf8");
      console.log(`[readProjectFile] SVG ${targetPath}: length=${content.length}`);
      return content;
    }
    
    if (isImage) {
      // Use custom protocol to avoid IPC size limits
      console.log(`[readProjectFile] Image ${targetPath}: using custom protocol`);
      return `__NAEDITOR_IMAGE__:${resolvedPath}`;
    }
    
    return fs.readFile(resolvedPath, "utf8");
  }

  if (isSvg) {
    // Read SVG as text for remote projects
    const result = await runRemoteCommand(project, `cat ${quoteProjectPath(project, resolvedPath)}`);
    if (result.exitCode !== 0) {
      throw new Error(result.stderr || `Unable to read ${resolvedPath}`);
    }
    return result.stdout;
  }

  if (isImage) {
    // For remote images, use base64 encoding (unavoidable for remote)
    const result = await runRemoteCommand(project, `base64 ${quoteProjectPath(project, resolvedPath)}`);
    if (result.exitCode !== 0) {
      throw new Error(result.stderr || `Unable to read ${resolvedPath}`);
    }
    const ext = targetPath.split('.').pop()?.toLowerCase() || 'png';
    const mimeType = ext === 'jpg' ? 'jpeg' : ext;
    return `data:image/${mimeType};base64,${result.stdout.trim()}`;
  }

  const result = await runRemoteCommand(project, `cat ${quoteProjectPath(project, resolvedPath)}`);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || `Unable to read ${resolvedPath}`);
  }
  return result.stdout;
}

async function writeProjectFile(project: ProjectRecord, targetPath: string, content: string) {
  const resolvedPath = resolveProjectTargetPath(project, targetPath);
  if (project.kind === "local") {
    await fs.writeFile(resolvedPath, content, "utf8");
    return;
  }

  const result = await runRemoteCommand(project, `cat > ${quoteProjectPath(project, resolvedPath)}`, content);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || `Unable to write ${resolvedPath}`);
  }
}

function resolveProjectTargetPath(project: ProjectRecord, targetPath: string) {
  if (!targetPath) {
    return targetPath;
  }

  if (project.kind === "local") {
    if (path.isAbsolute(targetPath) || !project.rootPath) {
      return targetPath;
    }
    return path.join(project.rootPath, targetPath);
  }

  if (
    targetPath.startsWith("/") ||
    targetPath.startsWith("~/") ||
    !project.rootPath
  ) {
    return targetPath;
  }

  const normalizedRoot = project.rootPath.endsWith("/")
    ? project.rootPath.slice(0, -1)
    : project.rootPath;
  const normalizedTarget = targetPath.replace(/^\.\//, "");
  return `${normalizedRoot}/${normalizedTarget}`;
}

async function searchProject(project: ProjectRecord, query: string, options: SearchQueryOptions = {}): Promise<SearchMatch[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const cwd = project.rootPath ?? process.cwd();
  const baseCommand = [
    `cd ${quoteProjectPath(project, cwd)}`,
    "&&",
    "rg",
    "--line-number",
    "--column",
    "--no-heading",
    "--color",
    "never",
    "--glob",
    quoteShell("!.git"),
    "--glob",
    quoteShell("!node_modules"),
    "--glob",
    quoteShell("!dist"),
    "--glob",
    quoteShell("!.next"),
  ].join(" ");

  const flags: string[] = [];
  if (options.regex) {
    flags.push("--regexp", quoteShell(trimmed));
  } else {
    flags.push("--fixed-strings", "--regexp", quoteShell(trimmed));
  }

  if (options.caseSensitive) {
    flags.push("--case-sensitive");
  } else {
    flags.push("--ignore-case");
  }

  if (options.wholeWord) {
    flags.push("--word-regexp");
  }

  if (options.includeGlob?.trim()) {
    flags.push("--glob", quoteShell(options.includeGlob.trim()));
  }

  if (options.excludeGlob?.trim()) {
    options.excludeGlob
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((glob) => {
        flags.push("--glob", quoteShell(`!${glob.replace(/^!+/, "")}`));
      });
  }

  const command = [baseCommand, ...flags, "."].join(" ");

  const result = await runProjectCommand(project, command);
  if (result.exitCode !== 0 && !result.stdout.trim()) {
    return [];
  }

  return result.stdout
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => parseSearchLine(line, trimmed, options))
    .filter((value): value is SearchMatch => value !== null);
}

function parseSearchLine(line: string, query: string, options: SearchQueryOptions): SearchMatch | null {
  const match = line.match(/^(.+?):(\d+):(\d+):(.*)$/);
  if (!match) {
    return null;
  }

  const text = match[4].trim();

  return {
    path: match[1].replace(/^\.\//, ""),
    line: Number(match[2]),
    column: Number(match[3]),
    text,
    matchText: findMatchedText(text, query, Number(match[3]), options)
  };
}

function findMatchedText(text: string, query: string, column: number, options: SearchQueryOptions) {
  const startIndex = Math.max(0, column - 1);
  if (!text) {
    return "";
  }

  try {
    const flags = options.caseSensitive ? "g" : "gi";
    const source = options.regex ? query : escapeRegExp(query);
    const pattern = options.wholeWord ? `\\b(?:${source})\\b` : source;
    const expression = new RegExp(pattern, flags);
    let matched: RegExpExecArray | null = null;
    while ((matched = expression.exec(text))) {
      if (matched.index <= startIndex && expression.lastIndex >= column) {
        return matched[0];
      }
      if (matched.index >= startIndex) {
        return matched[0];
      }
      if (matched[0].length === 0) {
        expression.lastIndex += 1;
      }
    }
  } catch {
    return query;
  }

  return options.regex ? query : text.slice(startIndex, startIndex + Math.max(query.length, 1));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function createTerminalSession(projectId: string, project: ProjectRecord): Promise<TerminalSessionInfo> {
  const cwd = project.rootPath ?? process.cwd();
  const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await sendTerminalHostRequest("create-session", {
    sessionId,
    sessionKind: "terminal",
    cwd,
    project
  });

  terminalSessions.set(sessionId, {
    projectId,
    cwd,
    buffer: "",
    exitCode: null
  });

  return {
    sessionId,
    cwd,
    projectId,
    initialBuffer: terminalSessions.get(sessionId)?.buffer ?? ""
  };
}

function sanitizePtyEnv(source: NodeJS.ProcessEnv) {
  return Object.fromEntries(
    Object.entries(source).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

function getGitCwd(project: ProjectRecord, repoRootPath?: string) {
  return repoRootPath || project.rootPath || process.cwd();
}

function getProjectRelativePath(project: ProjectRecord, repoRootPath: string) {
  const projectRoot = project.rootPath ?? repoRootPath;
  if (project.kind === "remote") {
    const relativePath = path.posix.relative(projectRoot, repoRootPath) || ".";
    return relativePath === "." ? "." : relativePath;
  }

  const relativePath = path.relative(projectRoot, repoRootPath) || ".";
  return relativePath === "." ? "." : relativePath;
}

function toRepoFilePath(project: ProjectRecord, repoRootPath: string, filePath: string) {
  if (!filePath) {
    return filePath;
  }

  if (project.kind === "remote") {
    if (filePath.startsWith("/") || filePath.startsWith("~/")) {
      return path.posix.relative(repoRootPath, filePath);
    }
    return filePath;
  }

  if (path.isAbsolute(filePath)) {
    return path.relative(repoRootPath, filePath);
  }

  return filePath;
}

async function listGitRepositories(project: ProjectRecord): Promise<GitRepositoryInfo[]> {
  const cwd = project.rootPath ?? process.cwd();
  const command = `
    cd ${quoteProjectPath(project, cwd)} &&
    find . \\( -path '*/node_modules/*' -o -path '*/dist/*' -o -path '*/.next/*' \\) -prune -o \\( -name .git -print \\)
  `.trim();

  const result = await runProjectCommand(project, command);
  if (result.exitCode !== 0) {
    return [];
  }

  const normalizeRepoRoot = (gitEntry: string) => {
    const cleanEntry = gitEntry.trim();
    if (!cleanEntry) {
      return null;
    }
    const withoutGit = cleanEntry === ".git" ? "." : cleanEntry.endsWith("/.git") ? cleanEntry.slice(0, -5) : cleanEntry;
    const relativeRoot = withoutGit === "." ? "." : withoutGit.replace(/^\.\//, "");

    if (project.kind === "remote") {
      const absoluteRoot =
        relativeRoot === "."
          ? cwd
          : path.posix.join(cwd, relativeRoot);
      return absoluteRoot;
    }

    const absoluteRoot =
      relativeRoot === "."
        ? cwd
        : path.join(cwd, relativeRoot);
    return absoluteRoot;
  };

  const repoRoots = Array.from(
    new Set(
      result.stdout
        .split("\n")
        .map(normalizeRepoRoot)
        .filter((value): value is string => Boolean(value))
    )
  );

  return repoRoots
    .map((repoRoot) => {
      const relativePath = getProjectRelativePath(project, repoRoot);
      return {
        rootPath: repoRoot,
        name: relativePath === "." ? path.basename(repoRoot) : path.basename(repoRoot),
        relativePath,
        isRoot: relativePath === "."
      };
    })
    .sort((left, right) => {
      if (left.isRoot !== right.isRoot) {
        return left.isRoot ? -1 : 1;
      }
      return left.relativePath.localeCompare(right.relativePath);
    });
}

async function getGitDetails(project: ProjectRecord, repoRootPath?: string): Promise<GitDetails | null> {
  try {
    const cwd = getGitCwd(project, repoRootPath);
    const branch = await runProjectCommand(project, `cd ${quoteProjectPath(project, cwd)} && git rev-parse --abbrev-ref HEAD`);
    const status = await runProjectCommand(project, `cd ${quoteProjectPath(project, cwd)} && git status --porcelain=v1 --branch`);
    if (branch.exitCode !== 0 || status.exitCode !== 0) {
      return null;
    }
    const lines = status.stdout.trim().split("\n").filter(Boolean);
    const statusLines = lines.filter((line) => !line.startsWith("##"));
    const branchLine = lines.find((line) => line.startsWith("##")) ?? "";

    let ahead = 0;
    let behind = 0;

    const aheadMatch = branchLine.match(/ahead (\d+)/);
    const behindMatch = branchLine.match(/behind (\d+)/);
    if (aheadMatch) {
      ahead = Number(aheadMatch[1]);
    }
    if (behindMatch) {
      behind = Number(behindMatch[1]);
    }

    const stagedFiles = statusLines.filter((line) => line[0] && line[0] !== " ").length;
    const changedFiles = statusLines.length;
    const files = statusLines.map(parseGitStatusLine).filter((value): value is GitChangedFile => value !== null);

    return {
      repoRootPath: cwd,
      repoDisplayPath: getProjectRelativePath(project, cwd),
      branch: branch.stdout.trim(),
      ahead,
      behind,
      changedFiles,
      stagedFiles,
      clean: changedFiles === 0,
      files
    };
  } catch {
    return null;
  }
}

async function listGitBranches(project: ProjectRecord, repoRootPath?: string): Promise<GitBranchInfo[]> {
  const cwd = getGitCwd(project, repoRootPath);
  const result = await runProjectCommand(
    project,
    `cd ${quoteProjectPath(project, cwd)} && git branch --format='%(HEAD)|%(refname:short)'`
  );

  if (result.exitCode !== 0) {
    return [];
  }

  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [headMarker, ...nameParts] = line.split("|");
      return {
        name: nameParts.join("|"),
        current: headMarker === "*"
      };
    });
}

async function listGitWorktrees(project: ProjectRecord, repoRootPath?: string): Promise<GitWorktreeInfo[]> {
  const cwd = getGitCwd(project, repoRootPath);
  const result = await runProjectCommand(
    project,
    `cd ${quoteProjectPath(project, cwd)} && git worktree list --porcelain`
  );

  if (result.exitCode !== 0) {
    return [];
  }

  const blocks = result.stdout
    .split("\n\n")
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block) => {
    const lines = block.split("\n");
    const worktreePath = lines.find((line) => line.startsWith("worktree "))?.slice("worktree ".length).trim() ?? cwd;
    const branchRef = lines.find((line) => line.startsWith("branch "))?.slice("branch ".length).trim();
    const branch = branchRef?.replace(/^refs\/heads\//, "");
    const flags = new Set(
      lines
        .map((line) => line.trim())
        .filter((line) => ["bare", "detached", "locked", "prunable"].includes(line))
    );

    return {
      path: worktreePath,
      branch,
      bare: flags.has("bare"),
      detached: flags.has("detached"),
      locked: flags.has("locked"),
      prunable: flags.has("prunable"),
      isCurrent: worktreePath === cwd
    };
  });
}

async function listGitGraph(project: ProjectRecord, repoRootPath?: string): Promise<GitGraphEntry[]> {
  const cwd = getGitCwd(project, repoRootPath);
  const result = await runProjectCommand(
    project,
    `cd ${quoteProjectPath(project, cwd)} && git log --graph --decorate=short --date-order --all -n 60 --pretty=format:${quoteShell("%x1f%H%x1f%h%x1f%s%x1f%an%x1f%ar%x1f%D")}`
  );

  if (result.exitCode !== 0) {
    return [];
  }

  const entries: GitGraphEntry[] = [];

  for (const [index, line] of result.stdout.split("\n").entries()) {
      const separatorIndex = line.indexOf("\u001f");
      if (separatorIndex === -1) {
        const graphOnly = line.trimEnd();
        if (!graphOnly) {
          continue;
        }
        entries.push({
          id: `graph-${index}`,
          graph: graphOnly
        });
        continue;
      }

      const graph = line.slice(0, separatorIndex).trimEnd();
      const payload = line.slice(separatorIndex + 1).split("\u001f");
      const refs = (payload[5] ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      entries.push({
        id: payload[0] || `graph-${index}`,
        graph,
        shortHash: payload[1],
        subject: payload[2],
        author: payload[3],
        relativeDate: payload[4],
        refs,
        current: refs.some((ref) => ref === "HEAD" || ref.startsWith("HEAD -> "))
      });
  }

  return entries;
}

async function initGit(project: ProjectRecord, repoRootPath?: string) {
  const cwd = getGitCwd(project, repoRootPath);
  return runProjectCommand(project, `cd ${quoteProjectPath(project, cwd)} && git init`);
}

async function stageGitFile(project: ProjectRecord, filePath: string, repoRootPath?: string) {
  const cwd = getGitCwd(project, repoRootPath);
  const repoFilePath = toRepoFilePath(project, cwd, filePath);
  return runProjectCommand(project, `cd ${quoteProjectPath(project, cwd)} && git add -- ${quoteProjectPath(project, repoFilePath)}`);
}

async function stageAllGitFiles(project: ProjectRecord, repoRootPath?: string) {
  const cwd = getGitCwd(project, repoRootPath);
  return runProjectCommand(project, `cd ${quoteProjectPath(project, cwd)} && git add -A`);
}

async function unstageGitFile(project: ProjectRecord, filePath: string, repoRootPath?: string) {
  const cwd = getGitCwd(project, repoRootPath);
  const repoFilePath = toRepoFilePath(project, cwd, filePath);
  return runProjectCommand(project, `cd ${quoteProjectPath(project, cwd)} && git restore --staged -- ${quoteProjectPath(project, repoFilePath)}`);
}

async function unstageAllGitFiles(project: ProjectRecord, repoRootPath?: string) {
  const cwd = getGitCwd(project, repoRootPath);
  return runProjectCommand(project, `cd ${quoteProjectPath(project, cwd)} && git restore --staged .`);
}

async function discardAllGitFiles(project: ProjectRecord, repoRootPath?: string) {
  const cwd = getGitCwd(project, repoRootPath);
  return runProjectCommand(project, `cd ${quoteProjectPath(project, cwd)} && git restore .`);
}

async function discardGitFile(project: ProjectRecord, filePath: string, repoRootPath?: string) {
  const cwd = getGitCwd(project, repoRootPath);
  const repoFilePath = toRepoFilePath(project, cwd, filePath);
  return runProjectCommand(project, `cd ${quoteProjectPath(project, cwd)} && git restore -- ${quoteProjectPath(project, repoFilePath)}`);
}

async function getGitDiff(project: ProjectRecord, filePath: string, staged: boolean, repoRootPath?: string) {
  const cwd = getGitCwd(project, repoRootPath);
  const repoFilePath = toRepoFilePath(project, cwd, filePath);
  const command = staged
    ? `cd ${quoteProjectPath(project, cwd)} && git diff --cached -- ${quoteProjectPath(project, repoFilePath)}`
    : `cd ${quoteProjectPath(project, cwd)} && git diff -- ${quoteProjectPath(project, repoFilePath)}`;
  const result = await runProjectCommand(project, command);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || "Unable to load diff");
  }
  return result.stdout;
}

async function readGitRevisionFile(project: ProjectRecord, cwd: string, revisionSpec: string, filePath: string) {
  const revision = revisionSpec ? `${revisionSpec}:${filePath}` : `:${filePath}`;
  const command = `cd ${quoteProjectPath(project, cwd)} && git show ${quoteShell(revision)}`;
  const result = await runProjectCommand(project, command);
  if (result.exitCode !== 0) {
    return "";
  }
  return result.stdout;
}

async function getGitDiffContent(project: ProjectRecord, filePath: string, staged: boolean, repoRootPath?: string): Promise<GitDiffContent> {
  const cwd = getGitCwd(project, repoRootPath);
  const repoFilePath = toRepoFilePath(project, cwd, filePath);

  return {
    filePath: repoFilePath,
    staged,
    originalContent: await readGitRevisionFile(project, cwd, "HEAD", repoFilePath),
    modifiedContent: staged
      ? await readGitRevisionFile(project, cwd, "", repoFilePath)
      : await readProjectFile(
          project,
          project.kind === "remote" ? path.posix.join(cwd, repoFilePath) : path.join(cwd, repoFilePath)
        ),
    originalLabel: "HEAD",
    modifiedLabel: staged ? "Index" : "Working Tree"
  };
}

async function getGitCommitDetails(project: ProjectRecord, commitHash: string, repoRootPath?: string): Promise<GitCommitDetails> {
  const cwd = getGitCwd(project, repoRootPath);
  const summaryResult = await runProjectCommand(
    project,
    `cd ${quoteProjectPath(project, cwd)} && git show --no-patch --format=${quoteShell("%h%x1f%s")} ${quoteShell(commitHash)}`
  );
  if (summaryResult.exitCode !== 0) {
    throw new Error(summaryResult.stderr || "Unable to load commit details");
  }

  const [shortHash, subject] = summaryResult.stdout.trim().split("\u001f");
  const patchResult = await runProjectCommand(
    project,
    `cd ${quoteProjectPath(project, cwd)} && git show --stat --patch --decorate=short ${quoteShell(commitHash)}`
  );
  if (patchResult.exitCode !== 0) {
    throw new Error(patchResult.stderr || "Unable to load commit patch");
  }

  const filesResult = await runProjectCommand(
    project,
    `cd ${quoteProjectPath(project, cwd)} && git show --format='' --name-status --find-renames ${quoteShell(commitHash)}`
  );
  const changedFiles =
    filesResult.exitCode === 0
      ? filesResult.stdout
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [status, ...rest] = line.split("\t");
            return {
              status,
              path: rest.at(-1) ?? ""
            };
          })
          .filter((entry) => entry.path)
      : [];

  return {
    commitHash,
    shortHash: shortHash || commitHash.slice(0, 7),
    title: subject || shortHash || commitHash.slice(0, 7),
    content: patchResult.stdout,
    changedFiles
  };
}

async function getGitCommitFileDiffContent(
  project: ProjectRecord,
  commitHash: string,
  filePath: string,
  repoRootPath?: string
): Promise<GitCommitFileDiffContent> {
  const cwd = getGitCwd(project, repoRootPath);
  const repoFilePath = toRepoFilePath(project, cwd, filePath);
  const shortHash = commitHash.slice(0, 7);
  return {
    commitHash,
    filePath: repoFilePath,
    originalContent: await readGitRevisionFile(project, cwd, `${commitHash}^`, repoFilePath),
    modifiedContent: await readGitRevisionFile(project, cwd, commitHash, repoFilePath),
    originalLabel: `${shortHash}^`,
    modifiedLabel: shortHash
  };
}

async function getGitCompareDetails(project: ProjectRecord, baseRef: string, targetRef: string, repoRootPath?: string): Promise<GitCompareDetails> {
  const cwd = getGitCwd(project, repoRootPath);
  const patchResult = await runProjectCommand(
    project,
    `cd ${quoteProjectPath(project, cwd)} && git diff --stat --patch ${quoteShell(baseRef)}..${quoteShell(targetRef)}`
  );
  if (patchResult.exitCode !== 0) {
    throw new Error(patchResult.stderr || "Unable to load comparison");
  }

  const filesResult = await runProjectCommand(
    project,
    `cd ${quoteProjectPath(project, cwd)} && git diff --name-status --find-renames ${quoteShell(baseRef)}..${quoteShell(targetRef)}`
  );
  const changedFiles =
    filesResult.exitCode === 0
      ? filesResult.stdout
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [status, ...rest] = line.split("\t");
            return {
              status,
              path: rest.at(-1) ?? ""
            };
          })
          .filter((entry) => entry.path)
      : [];

  return {
    baseRef,
    targetRef,
    title: `${baseRef} ↔ ${targetRef}`,
    content: patchResult.stdout,
    changedFiles
  };
}

async function commitGit(project: ProjectRecord, message: string, repoRootPath?: string) {
  const cwd = getGitCwd(project, repoRootPath);
  return runProjectCommand(project, `cd ${quoteProjectPath(project, cwd)} && git commit -m ${quoteShell(message)}`);
}

async function checkoutGitBranch(project: ProjectRecord, branchName: string, repoRootPath?: string) {
  const cwd = getGitCwd(project, repoRootPath);
  return runProjectCommand(project, `cd ${quoteProjectPath(project, cwd)} && git checkout ${quoteShell(branchName)}`);
}

async function createGitBranch(project: ProjectRecord, branchName: string, repoRootPath?: string) {
  const cwd = getGitCwd(project, repoRootPath);
  return runProjectCommand(project, `cd ${quoteProjectPath(project, cwd)} && git checkout -b ${quoteShell(branchName)}`);
}

async function fetchGit(project: ProjectRecord, repoRootPath?: string) {
  const cwd = getGitCwd(project, repoRootPath);
  return runProjectCommand(project, `cd ${quoteProjectPath(project, cwd)} && git fetch --all --prune`);
}

async function pullGit(project: ProjectRecord, repoRootPath?: string) {
  const cwd = getGitCwd(project, repoRootPath);
  return runProjectCommand(project, `cd ${quoteProjectPath(project, cwd)} && git pull --rebase`);
}

async function pushGit(project: ProjectRecord, repoRootPath?: string) {
  const cwd = getGitCwd(project, repoRootPath);
  return runProjectCommand(project, `cd ${quoteProjectPath(project, cwd)} && git push`);
}

function parseGitStatusLine(line: string): GitChangedFile | null {
  if (line.length < 4) {
    return null;
  }

  const indexStatus = line[0];
  const workTreeStatus = line[1];
  const filePath = line.slice(3).trim();
  return {
    path: filePath.includes(" -> ") ? filePath.split(" -> ").at(-1) ?? filePath : filePath,
    indexStatus,
    workTreeStatus,
    staged: indexStatus !== " " && indexStatus !== "?"
  };
}

function normalizeBrowserUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "about:blank";
  }
  const withProtocol = trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `http://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (!isNavigableBrowserUrl(parsed)) {
      return "about:blank";
    }
    return parsed.toString();
  } catch {
    return "about:blank";
  }
}

function isNavigableBrowserUrl(url: URL) {
  const hostname = url.hostname.trim().toLowerCase();
  if (!hostname) {
    return false;
  }

  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return true;
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return true;
  }

  return hostname.includes(".") && hostname.length > 3;
}

async function openExternalUrl(url: string) {
  const normalized = normalizeBrowserUrl(url);
  if (normalized === "about:blank") {
    return;
  }
  await shell.openExternal(normalized);
}

async function ensurePortForward(project: ProjectRecord, remoteUrl: string): Promise<PortForwardInfo | null> {
  if (project.kind !== "remote") {
    return null;
  }

  const parsed = parseUrlLike(remoteUrl);
  if (!parsed || !parsed.port || !isLoopbackHost(parsed.hostname)) {
    return null;
  }
  const remotePort = Number(parsed.port);

  const existing = portForwards.get(project.id);
  if (existing && existing.info.remotePort === remotePort) {
    return existing.info;
  }

  if (existing) {
    stopPortForward(project.id);
  }

  const target = getSshTarget(project);
  if (!target) {
    return null;
  }

  const localPort = await getAvailablePort();
  const sshProcess = spawn(
    "ssh",
    ["-N", "-L", `${localPort}:127.0.0.1:${remotePort}`, target],
    { stdio: "pipe" }
  );

  const info: PortForwardInfo = {
    projectId: project.id,
    remoteHost: target,
    remotePort,
    localPort,
    localUrl: `${parsed.protocol}//127.0.0.1:${localPort}${parsed.pathname}${parsed.search}${parsed.hash}`,
    active: true
  };

  portForwards.set(project.id, {
    process: sshProcess,
    info
  });

  sshProcess.on("exit", () => {
    const current = portForwards.get(project.id);
    if (current?.process === sshProcess) {
      portForwards.delete(project.id);
    }
  });

  await delay(250);
  return info;
}

function stopPortForward(projectId: string) {
  const current = portForwards.get(projectId);
  if (!current) {
    return;
  }

  current.process.kill();
  portForwards.delete(projectId);
}

function isLoopbackHost(hostname: string) {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

function parseUrlLike(value: string) {
  const normalized = normalizeBrowserUrl(value);
  try {
    return new URL(normalized);
  } catch {
    return null;
  }
}

async function getAvailablePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to determine port"));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

app.whenReady().then(() => {
  // Register custom protocol for loading local images without size limits
  const success = protocol.registerFileProtocol('naeditor-image', (request, callback) => {
    try {
      // URL format: naeditor-image://localhost/full/path/to/file.png
      const url = request.url;
      console.log('[naeditor-image protocol] Request URL:', url);
      
      // Extract path after the hostname
      const match = url.match(/^naeditor-image:\/\/[^\/]+(\/.*)$/);
      if (!match) {
        console.error('[naeditor-image protocol] Invalid URL format:', url);
        callback({ error: -2 });
        return;
      }
      
      const filePath = decodeURIComponent(match[1]);
      console.log('[naeditor-image protocol] Loading file:', filePath);
      callback({ path: filePath });
    } catch (error) {
      console.error('[naeditor-image protocol] Error:', error);
      callback({ error: -2 }); // net::FAILED
    }
  });
  
  console.log('[naeditor] Protocol registered:', success);

  // Set app icon for dock (macOS)
  if (process.platform === 'darwin' && app.dock) {
    const iconPath = app.isPackaged
      ? path.join(process.resourcesPath, "assets/logo.png")
      : path.join(__dirname, "../../src/renderer/assets/logo.png");
    
    if (existsSync(iconPath)) {
      app.dock.setIcon(iconPath);
    }
  }
  
  installAppMenu();
  createWindow();

  ipcMain.handle("app:load-state", async () => loadStateFile());
  ipcMain.handle("app:save-state", async (_event, snapshot: AppStateSnapshot) => saveStateFile(snapshot));
  ipcMain.handle("dialog:open-project-directory", async () => openProjectDirectory());
  ipcMain.handle("fs:read-directory", async (_event, payload: { project: ProjectRecord; rootPath: string }) => {
    const result = await readProjectDirectory(payload.project, payload.rootPath);
    
    getOrCreateWatcher(payload.project.id, payload.rootPath);
    
    return result;
  });

  ipcMain.handle("fs:start-watch", async (_event, payload: { projectId: string; rootPath: string }) => {
    getOrCreateWatcher(payload.projectId, payload.rootPath);
    return true;
  });

  ipcMain.handle("fs:stop-watch", async (_event, payload: { projectId: string; rootPath: string }) => {
    closeWatcher(payload.projectId, payload.rootPath);
    return true;
  });
  ipcMain.handle("fs:read-file", async (_event, payload: { project: ProjectRecord; path: string }) =>
    readProjectFile(payload.project, payload.path)
  );
  ipcMain.handle("fs:write-file", async (_event, payload: { project: ProjectRecord; path: string; content: string }) =>
    writeProjectFile(payload.project, payload.path, payload.content)
  );
  ipcMain.handle("fs:create-file", async (_event, payload: { project: ProjectRecord; dirPath: string; fileName: string }) => {
    try {
      console.log("[naeditor] createFile:", payload.dirPath, payload.fileName);
      const filePath = path.join(payload.dirPath, payload.fileName);
      console.log("[naeditor] Full path:", filePath);
      await fs.writeFile(filePath, "");
      console.log("[naeditor] File created successfully");
    } catch (err) {
      console.error("[naeditor] createFile error:", err);
      throw err;
    }
  });
  ipcMain.handle("fs:create-directory", async (_event, payload: { project: ProjectRecord; dirPath: string; dirName: string }) => {
    try {
      console.log("[naeditor] createDirectory:", payload.dirPath, payload.dirName);
      const dirPath = path.join(payload.dirPath, payload.dirName);
      console.log("[naeditor] Full path:", dirPath);
      await fs.mkdir(dirPath, { recursive: true });
      console.log("[naeditor] Directory created successfully");
    } catch (err) {
      console.error("[naeditor] createDirectory error:", err);
      throw err;
    }
  });
  ipcMain.handle("fs:delete-path", async (_event, payload: { project: ProjectRecord; path: string; isDirectory: boolean }) => {
    if (payload.isDirectory) {
      await fs.rm(payload.path, { recursive: true });
    } else {
      await fs.unlink(payload.path);
    }
  });
  ipcMain.handle("fs:rename-path", async (_event, payload: { project: ProjectRecord; oldPath: string; newPath: string }) => {
    console.log("[naeditor] renamePath:", payload.oldPath, "->", payload.newPath);
    await fs.rename(payload.oldPath, payload.newPath);
    console.log("[naeditor] Rename successful");
  });
  ipcMain.handle("fs:reveal-in-finder", async (_event, payload: { project: ProjectRecord; path: string }) => {
    shell.showItemInFolder(payload.path);
  });
  ipcMain.handle("fs:show-context-menu", async (_event, payload: { 
    filePath: string;
    fileName: string;
    isDirectory: boolean;
    dirPath: string;
    projectId: string;
    projectRootPath: string;
  }) => {
    console.log("[naeditor] showContextMenu payload:", payload);
    return new Promise((resolve) => {
      const template: Electron.MenuItemConstructorOptions[] = [
        { label: "New File", click: () => resolve({ action: "newFile", dirPath: payload.dirPath, isDirectory: payload.isDirectory, filePath: payload.filePath }) },
        { label: "New Folder", click: () => resolve({ action: "newFolder", dirPath: payload.dirPath, isDirectory: payload.isDirectory, filePath: payload.filePath }) },
        { type: "separator" },
        { label: "Rename", click: () => resolve({ action: "rename", filePath: payload.filePath, fileName: payload.fileName, dirPath: payload.dirPath, isDirectory: payload.isDirectory }) },
        { label: "Delete", click: () => resolve({ action: "delete", filePath: payload.filePath, isDirectory: payload.isDirectory, dirPath: payload.dirPath }) },
        { type: "separator" },
        { label: "Reveal in Finder", click: () => resolve({ action: "reveal", filePath: payload.filePath, isDirectory: payload.isDirectory }) },
      ];

      const menu = Menu.buildFromTemplate(template);
      menu.popup({
        window: mainWindow ?? undefined,
        callback: () => resolve({ action: "cancel" })
      });
    });
  });
  ipcMain.handle("project:show-context-menu", async (_event, payload: { 
    projectId: string;
    projectName: string;
  }) => {
    console.log("[naeditor] showProjectContextMenu payload:", payload);
    return new Promise((resolve) => {
      let actionTaken = false;
      
      const template: Electron.MenuItemConstructorOptions[] = [
        { 
          label: "Remove Project", 
          click: () => {
            actionTaken = true;
            const result = dialog.showMessageBoxSync(mainWindow!, {
              type: "warning",
              buttons: ["Cancel", "Remove"],
              defaultId: 0,
              cancelId: 0,
              title: "Remove Project",
              message: `Remove "${payload.projectName}" from workspace?`,
              detail: "This will only remove the project from your workspace. No files will be deleted."
            });
            if (result === 1) {
              resolve({ action: "remove", projectId: payload.projectId });
            } else {
              resolve({ action: "cancel" });
            }
          }
        },
      ];

      const menu = Menu.buildFromTemplate(template);
      menu.popup({
        window: mainWindow ?? undefined,
        callback: () => {
          // Only resolve if no menu item was clicked
          if (!actionTaken) {
            resolve({ action: "cancel" });
          }
        }
      });
    });
  });
  ipcMain.handle("fs:search-project", async (_event, payload: { project: ProjectRecord; query: string; options?: SearchQueryOptions }) =>
    searchProject(payload.project, payload.query, payload.options)
  );
  ipcMain.handle("terminal:create-session", async (_event, payload: { projectId: string; project: ProjectRecord }) =>
    createTerminalSession(payload.projectId, payload.project)
  );
  ipcMain.handle("terminal:get-snapshot", async (_event, sessionId: string) => {
    const session = terminalSessions.get(sessionId);
    if (!session) {
      return null;
    }

    return {
      buffer: session.buffer,
      exitCode: session.exitCode
    };
  });
  ipcMain.handle("terminal:write", async (_event, payload: { sessionId: string; data: string }) => {
    const session = terminalSessions.get(payload.sessionId);
    if (!session) {
      return;
    }

    sendTerminalHostMessage("write", payload);
  });
  ipcMain.handle(
    "terminal:resize",
    async (_event, payload: { sessionId: string; cols: number; rows: number }) => {
      const session = terminalSessions.get(payload.sessionId);
      if (!session) {
        return;
      }
      sendTerminalHostMessage("resize", payload);
    }
  );
  ipcMain.handle("terminal:close", async (_event, sessionId: string) => {
    const session = terminalSessions.get(sessionId);
    if (!session) {
      return;
    }

    sendTerminalHostMessage("close", { sessionId });
    terminalSessions.delete(sessionId);
  });
  ipcMain.handle(
    "code:get-bootstrap",
    async (_event, payload: { project: ProjectRecord; cwd: string }): Promise<CodeBootstrap> => {
      if (payload.project.kind !== "local") {
        throw new Error("Code is currently available only for local projects.");
      }
      return codexHost.getBootstrap(payload.cwd);
    }
  );
  ipcMain.handle("code:start-session", async (_event, input: CodeSessionStartInput) => {
    if (input.project.kind !== "local") {
      throw new Error("Code is currently available only for local projects.");
    }
    await codexHost.startSession(input);
  });
  ipcMain.handle("code:send-turn", async (_event, input: CodeTurnInput) => {
    await codexHost.sendTurn(input);
  });
  ipcMain.handle("code:interrupt-turn", async (_event, payload: { sessionId: string; turnId?: string }) => {
    await codexHost.interruptTurn(payload.sessionId, payload.turnId);
  });
  ipcMain.handle(
    "code:respond-to-request",
    async (
      _event,
      payload: {
        sessionId: string;
        requestId: string;
        decision: "approved" | "denied";
        answers?: Record<string, string | string[]>;
      }
    ) => {
      await codexHost.respondToRequest(
        payload.sessionId,
        payload.requestId,
        payload.decision,
        payload.answers
      );
    }
  );
  ipcMain.handle("code:stop-session", async (_event, sessionId: string) => {
    codexHost.stopSession(sessionId);
  });
  ipcMain.handle("browser:sync-view", async () => undefined);
  ipcMain.handle("browser:hide-view", async () => undefined);
  ipcMain.handle("browser:command", async () => undefined);
  ipcMain.handle("browser:open-external-url", async (_event, url: string) => openExternalUrl(url));
  ipcMain.handle(
    "remote:ensure-port-forward",
    async (_event, payload: { project: ProjectRecord; remoteUrl: string }) =>
      ensurePortForward(payload.project, payload.remoteUrl)
  );
  ipcMain.handle("remote:stop-port-forward", async (_event, projectId: string) => stopPortForward(projectId));
  ipcMain.handle("shell:run-command", async (_event, payload: { cwd: string; command: string }) =>
    runCommand(payload.cwd, payload.command)
  );
  ipcMain.handle("git:list-repositories", async (_event, project: ProjectRecord) => listGitRepositories(project));
  ipcMain.handle("git:get-details", async (_event, payload: { project: ProjectRecord; repoRootPath?: string }) => getGitDetails(payload.project, payload.repoRootPath));
  ipcMain.handle("git:init", async (_event, payload: { project: ProjectRecord; repoRootPath?: string }) => initGit(payload.project, payload.repoRootPath));
  ipcMain.handle("git:list-branches", async (_event, payload: { project: ProjectRecord; repoRootPath?: string }) => listGitBranches(payload.project, payload.repoRootPath));
  ipcMain.handle("git:list-worktrees", async (_event, payload: { project: ProjectRecord; repoRootPath?: string }) => listGitWorktrees(payload.project, payload.repoRootPath));
  ipcMain.handle("git:list-graph", async (_event, payload: { project: ProjectRecord; repoRootPath?: string }) => listGitGraph(payload.project, payload.repoRootPath));
  ipcMain.handle(
    "git:stage-file",
    async (_event, payload: { project: ProjectRecord; filePath: string; repoRootPath?: string }) =>
      stageGitFile(payload.project, payload.filePath, payload.repoRootPath)
  );
  ipcMain.handle("git:stage-all", async (_event, payload: { project: ProjectRecord; repoRootPath?: string }) => stageAllGitFiles(payload.project, payload.repoRootPath));
  ipcMain.handle(
    "git:unstage-file",
    async (_event, payload: { project: ProjectRecord; filePath: string; repoRootPath?: string }) =>
      unstageGitFile(payload.project, payload.filePath, payload.repoRootPath)
  );
  ipcMain.handle("git:unstage-all", async (_event, payload: { project: ProjectRecord; repoRootPath?: string }) => unstageAllGitFiles(payload.project, payload.repoRootPath));
  ipcMain.handle("git:discard-all", async (_event, payload: { project: ProjectRecord; repoRootPath?: string }) => discardAllGitFiles(payload.project, payload.repoRootPath));
  ipcMain.handle(
    "git:discard-file",
    async (_event, payload: { project: ProjectRecord; filePath: string; repoRootPath?: string }) => discardGitFile(payload.project, payload.filePath, payload.repoRootPath)
  );
  ipcMain.handle(
    "git:get-diff",
    async (_event, payload: { project: ProjectRecord; filePath: string; staged: boolean; repoRootPath?: string }) =>
      getGitDiff(payload.project, payload.filePath, payload.staged, payload.repoRootPath)
  );
  ipcMain.handle(
    "git:get-diff-content",
    async (_event, payload: { project: ProjectRecord; filePath: string; staged: boolean; repoRootPath?: string }) =>
      getGitDiffContent(payload.project, payload.filePath, payload.staged, payload.repoRootPath)
  );
  ipcMain.handle(
    "git:get-commit-details",
    async (_event, payload: { project: ProjectRecord; commitHash: string; repoRootPath?: string }) =>
      getGitCommitDetails(payload.project, payload.commitHash, payload.repoRootPath)
  );
  ipcMain.handle(
    "git:get-commit-file-diff-content",
    async (_event, payload: { project: ProjectRecord; commitHash: string; filePath: string; repoRootPath?: string }) =>
      getGitCommitFileDiffContent(payload.project, payload.commitHash, payload.filePath, payload.repoRootPath)
  );
  ipcMain.handle(
    "git:get-compare-details",
    async (_event, payload: { project: ProjectRecord; baseRef: string; targetRef: string; repoRootPath?: string }) =>
      getGitCompareDetails(payload.project, payload.baseRef, payload.targetRef, payload.repoRootPath)
  );
  ipcMain.handle(
    "git:commit",
    async (_event, payload: { project: ProjectRecord; message: string; repoRootPath?: string }) =>
      commitGit(payload.project, payload.message, payload.repoRootPath)
  );
  ipcMain.handle(
    "git:checkout-branch",
    async (_event, payload: { project: ProjectRecord; branchName: string; repoRootPath?: string }) =>
      checkoutGitBranch(payload.project, payload.branchName, payload.repoRootPath)
  );
  ipcMain.handle(
    "git:create-branch",
    async (_event, payload: { project: ProjectRecord; branchName: string; repoRootPath?: string }) =>
      createGitBranch(payload.project, payload.branchName, payload.repoRootPath)
  );
  ipcMain.handle("git:fetch", async (_event, payload: { project: ProjectRecord; repoRootPath?: string }) => fetchGit(payload.project, payload.repoRootPath));
  ipcMain.handle("git:pull", async (_event, payload: { project: ProjectRecord; repoRootPath?: string }) => pullGit(payload.project, payload.repoRootPath));
  ipcMain.handle("git:push", async (_event, payload: { project: ProjectRecord; repoRootPath?: string }) => pushGit(payload.project, payload.repoRootPath));

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  for (const projectId of portForwards.keys()) {
    stopPortForward(projectId);
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});
