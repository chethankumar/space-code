import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererEvent } from "electron";
import type {
  AppCommand,
  AppStateSnapshot,
  BrowserSurfaceBounds,
  BrowserViewState,
  CodeBootstrap,
  CodeSessionEvent,
  CodeSessionStartInput,
  CodeTurnInput,
  FileNode,
  GitBranchInfo,
  GitCompareDetails,
  GitCommitFileDiffContent,
  GitCommitDetails,
  GitGraphEntry,
  GitDiffContent,
  GitDetails,
  GitRepositoryInfo,
  GitWorktreeInfo,
  PortForwardInfo,
  ProjectRecord,
  SearchQueryOptions,
  SearchMatch,
  ShellCommandResult,
  TerminalSessionSnapshot,
  TerminalSessionInfo
} from "../shared/types";

contextBridge.exposeInMainWorld("naeditor", {
  loadState: () => ipcRenderer.invoke("app:load-state") as Promise<AppStateSnapshot | null>,
  saveState: (snapshot: AppStateSnapshot) =>
    ipcRenderer.invoke("app:save-state", snapshot) as Promise<void>,
  openProjectDirectory: () =>
    ipcRenderer.invoke("dialog:open-project-directory") as Promise<ProjectRecord | null>,
  readDirectory: (project: ProjectRecord, rootPath: string) =>
    ipcRenderer.invoke("fs:read-directory", { project, rootPath }) as Promise<FileNode[]>,
  startFileWatch: (projectId: string, rootPath: string) =>
    ipcRenderer.invoke("fs:start-watch", { projectId, rootPath }) as Promise<boolean>,
  stopFileWatch: (projectId: string, rootPath: string) =>
    ipcRenderer.invoke("fs:stop-watch", { projectId, rootPath }) as Promise<boolean>,
  readFile: (project: ProjectRecord, path: string) =>
    ipcRenderer.invoke("fs:read-file", { project, path }) as Promise<string>,
  writeFile: (project: ProjectRecord, path: string, content: string) =>
    ipcRenderer.invoke("fs:write-file", { project, path, content }) as Promise<void>,
  createFile: (project: ProjectRecord, dirPath: string, fileName: string) =>
    ipcRenderer.invoke("fs:create-file", { project, dirPath, fileName }) as Promise<void>,
  createDirectory: (project: ProjectRecord, dirPath: string, dirName: string) =>
    ipcRenderer.invoke("fs:create-directory", { project, dirPath, dirName }) as Promise<void>,
  deletePath: (project: ProjectRecord, path: string, isDirectory: boolean) =>
    ipcRenderer.invoke("fs:delete-path", { project, path, isDirectory }) as Promise<void>,
  renamePath: (project: ProjectRecord, oldPath: string, newPath: string) =>
    ipcRenderer.invoke("fs:rename-path", { project, oldPath, newPath }) as Promise<void>,
  revealInFinder: (project: ProjectRecord, path: string) =>
    ipcRenderer.invoke("fs:reveal-in-finder", { project, path }) as Promise<void>,
  showContextMenu: (payload: { filePath: string; fileName: string; isDirectory: boolean; dirPath: string; projectId: string; projectRootPath: string }) =>
    ipcRenderer.invoke("fs:show-context-menu", payload) as Promise<{ action: string; [key: string]: unknown }>,
  showProjectContextMenu: (payload: { projectId: string; projectName: string }) =>
    ipcRenderer.invoke("project:show-context-menu", payload) as Promise<{ action: string; [key: string]: unknown }>,
  searchProject: (project: ProjectRecord, query: string, options?: SearchQueryOptions) =>
    ipcRenderer.invoke("fs:search-project", { project, query, options }) as Promise<SearchMatch[]>,
  listGitRepositories: (project: ProjectRecord) =>
    ipcRenderer.invoke("git:list-repositories", project) as Promise<GitRepositoryInfo[]>,
  initGit: (project: ProjectRecord, repoRootPath?: string) =>
    ipcRenderer.invoke("git:init", { project, repoRootPath }) as Promise<ShellCommandResult>,
  listGitBranches: (project: ProjectRecord, repoRootPath?: string) =>
    ipcRenderer.invoke("git:list-branches", { project, repoRootPath }) as Promise<GitBranchInfo[]>,
  listGitWorktrees: (project: ProjectRecord, repoRootPath?: string) =>
    ipcRenderer.invoke("git:list-worktrees", { project, repoRootPath }) as Promise<GitWorktreeInfo[]>,
  listGitGraph: (project: ProjectRecord, repoRootPath?: string) =>
    ipcRenderer.invoke("git:list-graph", { project, repoRootPath }) as Promise<GitGraphEntry[]>,
  stageGitFile: (project: ProjectRecord, filePath: string, repoRootPath?: string) =>
    ipcRenderer.invoke("git:stage-file", { project, filePath, repoRootPath }) as Promise<ShellCommandResult>,
  stageAllGitFiles: (project: ProjectRecord, repoRootPath?: string) =>
    ipcRenderer.invoke("git:stage-all", { project, repoRootPath }) as Promise<ShellCommandResult>,
  unstageGitFile: (project: ProjectRecord, filePath: string, repoRootPath?: string) =>
    ipcRenderer.invoke("git:unstage-file", { project, filePath, repoRootPath }) as Promise<ShellCommandResult>,
  unstageAllGitFiles: (project: ProjectRecord, repoRootPath?: string) =>
    ipcRenderer.invoke("git:unstage-all", { project, repoRootPath }) as Promise<ShellCommandResult>,
  discardAllGitFiles: (project: ProjectRecord, repoRootPath?: string) =>
    ipcRenderer.invoke("git:discard-all", { project, repoRootPath }) as Promise<ShellCommandResult>,
  discardGitFile: (project: ProjectRecord, filePath: string, repoRootPath?: string) =>
    ipcRenderer.invoke("git:discard-file", { project, filePath, repoRootPath }) as Promise<ShellCommandResult>,
  getGitDiff: (project: ProjectRecord, filePath: string, staged: boolean, repoRootPath?: string) =>
    ipcRenderer.invoke("git:get-diff", { project, filePath, staged, repoRootPath }) as Promise<string>,
  getGitDiffContent: (project: ProjectRecord, filePath: string, staged: boolean, repoRootPath?: string) =>
    ipcRenderer.invoke("git:get-diff-content", { project, filePath, staged, repoRootPath }) as Promise<GitDiffContent>,
  getGitCommitDetails: (project: ProjectRecord, commitHash: string, repoRootPath?: string) =>
    ipcRenderer.invoke("git:get-commit-details", { project, commitHash, repoRootPath }) as Promise<GitCommitDetails>,
  getGitCommitFileDiffContent: (project: ProjectRecord, commitHash: string, filePath: string, repoRootPath?: string) =>
    ipcRenderer.invoke("git:get-commit-file-diff-content", { project, commitHash, filePath, repoRootPath }) as Promise<GitCommitFileDiffContent>,
  getGitCompareDetails: (project: ProjectRecord, baseRef: string, targetRef: string, repoRootPath?: string) =>
    ipcRenderer.invoke("git:get-compare-details", { project, baseRef, targetRef, repoRootPath }) as Promise<GitCompareDetails>,
  commitGit: (project: ProjectRecord, message: string, repoRootPath?: string) =>
    ipcRenderer.invoke("git:commit", { project, message, repoRootPath }) as Promise<ShellCommandResult>,
  checkoutGitBranch: (project: ProjectRecord, branchName: string, repoRootPath?: string) =>
    ipcRenderer.invoke("git:checkout-branch", { project, branchName, repoRootPath }) as Promise<ShellCommandResult>,
  createGitBranch: (project: ProjectRecord, branchName: string, repoRootPath?: string) =>
    ipcRenderer.invoke("git:create-branch", { project, branchName, repoRootPath }) as Promise<ShellCommandResult>,
  fetchGit: (project: ProjectRecord, repoRootPath?: string) =>
    ipcRenderer.invoke("git:fetch", { project, repoRootPath }) as Promise<ShellCommandResult>,
  pullGit: (project: ProjectRecord, repoRootPath?: string) =>
    ipcRenderer.invoke("git:pull", { project, repoRootPath }) as Promise<ShellCommandResult>,
  pushGit: (project: ProjectRecord, repoRootPath?: string) =>
    ipcRenderer.invoke("git:push", { project, repoRootPath }) as Promise<ShellCommandResult>,
  createTerminalSession: (projectId: string, project: ProjectRecord) =>
    ipcRenderer.invoke("terminal:create-session", { projectId, project }) as Promise<TerminalSessionInfo>,
  getTerminalSnapshot: (sessionId: string) =>
    ipcRenderer.invoke("terminal:get-snapshot", sessionId) as Promise<TerminalSessionSnapshot | null>,
  writeTerminal: (sessionId: string, data: string) =>
    ipcRenderer.invoke("terminal:write", { sessionId, data }) as Promise<void>,
  resizeTerminal: (sessionId: string, cols: number, rows: number) =>
    ipcRenderer.invoke("terminal:resize", { sessionId, cols, rows }) as Promise<void>,
  closeTerminal: (sessionId: string) =>
    ipcRenderer.invoke("terminal:close", sessionId) as Promise<void>,
  onTerminalData: (listener: (payload: { sessionId: string; data: string }) => void) => {
    const wrapped = (_event: IpcRendererEvent, payload: { sessionId: string; data: string }) =>
      listener(payload);
    ipcRenderer.on("terminal:data", wrapped);
    return () => ipcRenderer.removeListener("terminal:data", wrapped);
  },
  onTerminalExit: (listener: (payload: { sessionId: string; exitCode: number }) => void) => {
    const wrapped = (_event: IpcRendererEvent, payload: { sessionId: string; exitCode: number }) =>
      listener(payload);
    ipcRenderer.on("terminal:exit", wrapped);
    return () => ipcRenderer.removeListener("terminal:exit", wrapped);
  },
  getCodeBootstrap: (project: ProjectRecord, cwd: string) =>
    ipcRenderer.invoke("code:get-bootstrap", { project, cwd }) as Promise<CodeBootstrap>,
  startCodeSession: (input: CodeSessionStartInput) =>
    ipcRenderer.invoke("code:start-session", input) as Promise<void>,
  sendCodeTurn: (input: CodeTurnInput) =>
    ipcRenderer.invoke("code:send-turn", input) as Promise<void>,
  interruptCodeTurn: (sessionId: string, turnId?: string) =>
    ipcRenderer.invoke("code:interrupt-turn", { sessionId, turnId }) as Promise<void>,
  respondToCodeRequest: (
    sessionId: string,
    requestId: string,
    decision: "approved" | "denied",
    answers?: Record<string, string | string[]>
  ) =>
    ipcRenderer.invoke("code:respond-to-request", {
      sessionId,
      requestId,
      decision,
      answers
    }) as Promise<void>,
  stopCodeSession: (sessionId: string) =>
    ipcRenderer.invoke("code:stop-session", sessionId) as Promise<void>,
  onCodeEvent: (listener: (event: CodeSessionEvent) => void) => {
    const wrapped = (_event: IpcRendererEvent, payload: CodeSessionEvent) => listener(payload);
    ipcRenderer.on("code:event", wrapped);
    return () => ipcRenderer.removeListener("code:event", wrapped);
  },
  syncBrowserView: (payload: {
    projectId: string;
    url: string;
    bounds: BrowserSurfaceBounds;
    visible: boolean;
    devtools?: boolean;
  }) => ipcRenderer.invoke("browser:sync-view", payload) as Promise<void>,
  hideBrowserView: (projectId: string) => ipcRenderer.invoke("browser:hide-view", projectId) as Promise<void>,
  browserCommand: (projectId: string, command: "back" | "forward" | "reload" | "devtools" | "open-external") =>
    ipcRenderer.invoke("browser:command", { projectId, command }) as Promise<void>,
  loadBrowserUrl: (projectId: string, url: string) =>
    ipcRenderer.invoke("browser:load-url", { projectId, url }) as Promise<void>,
  openExternalUrl: (url: string) => ipcRenderer.invoke("browser:open-external-url", url) as Promise<void>,
  onBrowserState: (listener: (payload: { projectId: string; state: { url?: string; isLoading?: boolean; canGoBack?: boolean; canGoForward?: boolean } }) => void) => {
    const wrapped = (_event: IpcRendererEvent, payload: { projectId: string; state: { url?: string; isLoading?: boolean; canGoBack?: boolean; canGoForward?: boolean } }) => listener(payload);
    ipcRenderer.on("browser:state", wrapped);
    return () => ipcRenderer.removeListener("browser:state", wrapped);
  },
  ensurePortForward: (project: ProjectRecord, remoteUrl: string) =>
    ipcRenderer.invoke("remote:ensure-port-forward", { project, remoteUrl }) as Promise<PortForwardInfo | null>,
  stopPortForward: (projectId: string) => ipcRenderer.invoke("remote:stop-port-forward", projectId) as Promise<void>,
  runCommand: (cwd: string, command: string) =>
    ipcRenderer.invoke("shell:run-command", { cwd, command }) as Promise<ShellCommandResult>,
  onAppCommand: (
    listener: (command: AppCommand) => void
  ) => {
    const wrapped = (
      _event: IpcRendererEvent,
      command: AppCommand
    ) => listener(command);
    ipcRenderer.on("app:command", wrapped);
    return () => ipcRenderer.removeListener("app:command", wrapped);
  },
  getGitDetails: (project: ProjectRecord, repoRootPath?: string) =>
    ipcRenderer.invoke("git:get-details", { project, repoRootPath }) as Promise<GitDetails | null>,
  onFileChange: (listener: (payload: { projectId: string; rootPath: string; event: string; filePath: string }) => void) => {
    const wrapped = (
      _event: IpcRendererEvent,
      payload: { projectId: string; rootPath: string; event: string; filePath: string }
    ) => listener(payload);
    ipcRenderer.on("fs:file-changed", wrapped);
    return () => ipcRenderer.removeListener("fs:file-changed", wrapped);
  }
});
