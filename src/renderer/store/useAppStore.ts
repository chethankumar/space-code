import { create } from "zustand";
import type {
  AppSettings,
  AppStateSnapshot,
  BrowserTab,
  CodeAttachment,
  CodeBootstrap,
  CodeReasoningEffort,
  CodeRuntimeMode,
  CodeInteractionMode,
  CodeSessionEvent,
  CodeTab,
  EditorTab,
  FileNode,
  GitBranchInfo,
  GitCompareTab,
  GitCommitTab,
  GitCommitDetails,
  GitGraphEntry,
  GitRepositoryInfo,
  GitDiffTab,
  GitHistoryDiffTab,
  InspectorMode,
  PortForwardInfo,
  ProjectRecord,
  ProjectWorkspace,
  RemoteServerConfig,
  SearchQueryOptions,
  SearchMatch,
  ShellCommandResult,
  SnapWidth,
  SurfaceId,
  TerminalSplitNode,
  TerminalTab
} from "@shared/types";
import {
  clampViewportOffset,
  createEmptyWorkspace,
  createBrowserTab,
  createCodeTab,
  createTerminalLeaf,
  createTerminalPane,
  createTerminalTab,
  defaultSurfaceOrder,
  defaultTrackState,
  deriveViewportSteps,
  getActiveSurfaceAtOffset,
  getNextWidth,
  getSurfaceAnchorOffset,
  normalizeSurfaceOrder
} from "@renderer/lib/workspace";

type DirectoryCache = Record<string, FileNode[]>;

type AppStore = {
  hydrated: boolean;
  loading: boolean;
  saving: boolean;
  settingsDialogOpen: boolean;
  appSettings: AppSettings;
  projects: ProjectRecord[];
  selectedProjectId?: string;
  workspaces: Record<string, ProjectWorkspace>;
  projectRailCollapsed: boolean;
  directoryCache: DirectoryCache;
  activeProject: () => ProjectRecord | undefined;
  activeWorkspace: () => ProjectWorkspace | undefined;
  hydrate: () => Promise<void>;
  persist: () => Promise<void>;
  openSettingsDialog: () => void;
  closeSettingsDialog: () => void;
  updateAppSettings: (patch: Partial<AppSettings>) => void;
  upsertRemoteServer: (config: RemoteServerConfig) => void;
  removeRemoteServerConfig: (configId: string) => void;
  addProject: () => Promise<void>;
  addRemoteProject: (project: ProjectRecord) => Promise<void>;
  removeProject: (projectId: string) => Promise<void>;
  selectProject: (projectId: string) => void;
  toggleProjectRail: () => void;
  toggleInspector: () => void;
  setInspectorMode: (mode: InspectorMode) => void;
  flipInspectorDock: () => void;
  setInspectorWidth: (width: number) => void;
  moveProjectSelection: (direction: 1 | -1) => void;
  moveTrack: (direction: 1 | -1) => void;
  anchorSurface: (surface: SurfaceId) => void;
  adjustSurfaceWidth: (surface: SurfaceId, direction: "increase" | "decrease") => void;
  setSurfaceWidth: (surface: SurfaceId, width: SnapWidth) => void;
  moveSurface: (surface: SurfaceId, direction: "left" | "right") => void;
  toggleTrackControls: () => void;
  ensureDirectory: (rootPath: string) => Promise<void>;
  searchProject: (projectId: string, query: string, options?: SearchQueryOptions) => Promise<SearchMatch[]>;
  openSearchResult: (projectId: string, match: SearchMatch, query?: string) => Promise<void>;
  openFile: (projectId: string, targetPath: string) => Promise<void>;
  openFileAtLocation: (projectId: string, targetPath: string, line?: number, column?: number) => Promise<void>;
  openGitDiffTab: (projectId: string, targetPath: string, staged: boolean) => Promise<void>;
  openGitCommitFileDiffTab: (projectId: string, commitHash: string, filePath: string) => Promise<void>;
  openGitCommitTab: (projectId: string, commitHash: string) => Promise<void>;
  getGitCommitDetails: (projectId: string, commitHash: string) => Promise<GitCommitDetails | null>;
  openGitCompareTab: (projectId: string, baseRef: string, targetRef: string) => Promise<void>;
  setActiveTab: (path: string) => void;
  closeTab: (path: string) => void;
  closeActiveTab: () => void;
  updateCurrentFileContent: (content: string) => void;
  saveCurrentFile: () => Promise<void>;
  addCodeTab: () => void;
  selectCodeTab: (tabId: string) => void;
  closeCodeTab: (tabId: string) => void;
  closeActiveCodeTab: () => void;
  ensureCodeBootstrap: (tabId: string) => Promise<void>;
  updateCodeDraft: (tabId: string, draft: string) => void;
  setCodeModel: (tabId: string, model?: string) => void;
  setCodeReasoningEffort: (tabId: string, effort: CodeReasoningEffort) => void;
  setCodeRuntimeMode: (tabId: string, mode: CodeRuntimeMode) => void;
  setCodeInteractionMode: (tabId: string, mode: CodeInteractionMode) => void;
  addCodeAttachment: (tabId: string, attachment: CodeAttachment) => void;
  removeCodeAttachment: (tabId: string, attachmentId: string) => void;
  removeQueuedCodeTurn: (tabId: string, queuedTurnId: string) => void;
  clearQueuedCodeTurns: (tabId: string) => void;
  replaceNextQueuedCodeTurn: (tabId: string) => void;
  submitCodeTurn: (tabId: string) => Promise<void>;
  interruptCodeTurn: (tabId: string) => Promise<void>;
  respondToCodeRequest: (
    tabId: string,
    decision: "approved" | "denied",
    answers?: Record<string, string | string[]>
  ) => Promise<void>;
  handleCodeEvent: (event: CodeSessionEvent) => void;
  setBrowserUrl: (url: string) => void;
  addTerminalTab: () => void;
  selectTerminalTab: (tabId: string) => void;
  closeTerminalTab: (tabId: string) => void;
  closeActiveTerminalTab: () => void;
  splitActiveTerminalPane: (direction: "horizontal" | "vertical") => void;
  closeActiveTerminalPane: () => void;
  focusTerminalPane: (paneId: string) => void;
  addBrowserTab: () => void;
  closeBrowserTab: (tabId: string) => void;
  closeActiveBrowserTab: () => void;
  selectBrowserTab: (tabId: string) => void;
  updateBrowserTabState: (state: { url: string; title: string; faviconUrl?: string }, tabId?: string) => void;
  setPortForwardInfo: (info?: PortForwardInfo) => void;
  refreshGit: (projectId: string) => Promise<void>;
  listGitRepositories: (projectId: string) => Promise<GitRepositoryInfo[]>;
  selectGitRepository: (projectId: string, repoRootPath: string) => Promise<void>;
  initGit: (projectId: string) => Promise<ShellCommandResult | null>;
  listGitBranches: (projectId: string) => Promise<GitBranchInfo[]>;
  listGitGraph: (projectId: string) => Promise<GitGraphEntry[]>;
  stageGitFile: (projectId: string, filePath: string) => Promise<ShellCommandResult | null>;
  stageAllGitFiles: (projectId: string) => Promise<ShellCommandResult | null>;
  unstageGitFile: (projectId: string, filePath: string) => Promise<ShellCommandResult | null>;
  unstageAllGitFiles: (projectId: string) => Promise<ShellCommandResult | null>;
  discardAllGitFiles: (projectId: string) => Promise<ShellCommandResult | null>;
  discardGitFile: (projectId: string, filePath: string) => Promise<ShellCommandResult | null>;
  getGitDiff: (projectId: string, filePath: string, staged: boolean) => Promise<string>;
  commitGit: (projectId: string, message: string) => Promise<ShellCommandResult | null>;
  checkoutGitBranch: (projectId: string, branchName: string) => Promise<ShellCommandResult | null>;
  createGitBranch: (projectId: string, branchName: string) => Promise<ShellCommandResult | null>;
  fetchGit: (projectId: string) => Promise<ShellCommandResult | null>;
  pullGit: (projectId: string) => Promise<ShellCommandResult | null>;
  pushGit: (projectId: string) => Promise<ShellCommandResult | null>;
};

function buildSnapshot(state: AppStore): AppStateSnapshot {
  return {
    projects: state.projects,
    selectedProjectId: state.selectedProjectId,
    workspaces: state.workspaces,
    projectRailCollapsed: state.projectRailCollapsed,
    settings: state.appSettings
  };
}

const defaultAppSettings: AppSettings = {
  theme: "auto",
  editorFontFamily: '"RecMono Nerd", "SF Mono", Menlo, Monaco, monospace',
  editorFontSize: 13,
  editorTheme: "spacecode-dark",
  codeTheme: "spacecode-dark",
  terminalFontFamily:
    '"RecMono Nerd", "SF Mono", "MesloLGS NF", "JetBrainsMono Nerd Font", "Hack Nerd Font Mono", "Symbols Nerd Font Mono", Menlo, Monaco, monospace',
  terminalFontSize: 13,
  terminalTheme: "spacecode-dark",
  remoteServers: []
};

function normalizeAppSettings(settings?: AppSettings): AppSettings {
  const legacyEditorTheme =
    settings?.editorTheme === "vs-dark"
      ? "spacecode-dark"
      : settings?.editorTheme === "vs"
        ? "spacecode-light"
        : settings?.editorTheme;

  return {
    ...defaultAppSettings,
    ...settings,
    editorTheme: legacyEditorTheme ?? defaultAppSettings.editorTheme,
    codeTheme: settings?.codeTheme ?? defaultAppSettings.codeTheme,
    remoteServers: settings?.remoteServers ?? defaultAppSettings.remoteServers
  };
}

function withWorkspace(
  state: AppStore,
  updater: (workspace: ProjectWorkspace, projectId: string) => ProjectWorkspace
) {
  const projectId = state.selectedProjectId;
  if (!projectId) {
    return {};
  }

  const current = state.workspaces[projectId] ?? createEmptyWorkspace();
  return {
    workspaces: {
      ...state.workspaces,
      [projectId]: updater(current, projectId)
    }
  };
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getSelectedGitRepoRoot(workspace: ProjectWorkspace | undefined, project: ProjectRecord | undefined) {
  if (!project) {
    return undefined;
  }

  return workspace?.selectedGitRepoPath || project.rootPath;
}

function getCodeContext(state: AppStore, tabId: string) {
  const project = state.activeProject();
  const workspace = state.activeWorkspace();
  const tab = workspace?.codeTabs.find((entry) => entry.id === tabId);
  if (!project || !workspace || !tab) {
    return null;
  }

  return { project, workspace, tab };
}

function updateCodeTab(
  workspace: ProjectWorkspace,
  tabId: string,
  updater: (tab: CodeTab) => CodeTab
): ProjectWorkspace {
  return {
    ...workspace,
    codeTabs: workspace.codeTabs.map((tab) => (tab.id === tabId ? updater(tab) : tab))
  };
}

async function sendCodeTurnThroughSession(
  project: ProjectRecord,
  workspace: ProjectWorkspace,
  tab: CodeTab,
  tabId: string,
  input: string,
  attachments: CodeAttachment[]
) {
  const cwd = getSelectedGitRepoRoot(workspace, project);
  if (!cwd) {
    throw new Error("Missing project cwd.");
  }

  const previousThreadId = tab.threadId;
  const needsSessionRestart =
    !!tab.threadId &&
    tab.status !== "closed" &&
    ((tab.cwd && tab.cwd !== cwd) ||
      (tab.sessionRuntimeMode !== undefined && tab.sessionRuntimeMode !== tab.runtimeMode));

  if (needsSessionRestart && previousThreadId) {
    await window.naeditor.stopCodeSession(tabId);
    await window.naeditor.startCodeSession({
      sessionId: tabId,
      project,
      cwd,
      model: tab.selectedModel,
      reasoningEffort: tab.reasoningEffort,
      runtimeMode: tab.runtimeMode,
      interactionMode: tab.interactionMode,
      resumeThreadId: previousThreadId
    });
  }

  if (!tab.threadId || tab.status === "closed") {
    await window.naeditor.startCodeSession({
      sessionId: tabId,
      project,
      cwd,
      model: tab.selectedModel,
      reasoningEffort: tab.reasoningEffort,
      runtimeMode: tab.runtimeMode,
      interactionMode: tab.interactionMode,
      ...(previousThreadId ? { resumeThreadId: previousThreadId } : {})
    });
  }

  try {
    await window.naeditor.sendCodeTurn({
      sessionId: tabId,
      input,
      attachments,
      model: tab.selectedModel,
      reasoningEffort: tab.reasoningEffort,
      interactionMode: tab.interactionMode
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send follow-up to Codex.";
    const shouldRecoverSession =
      previousThreadId &&
      /(Unknown code session|missing a thread id|Session stopped|Timed out waiting|closed)/i.test(
        message
      );

    if (!shouldRecoverSession) {
      throw error;
    }

    await window.naeditor.startCodeSession({
      sessionId: tabId,
      project,
      cwd,
      model: tab.selectedModel,
      reasoningEffort: tab.reasoningEffort,
      runtimeMode: tab.runtimeMode,
      interactionMode: tab.interactionMode,
      resumeThreadId: previousThreadId
    });

    await window.naeditor.sendCodeTurn({
      sessionId: tabId,
      input,
      attachments,
      model: tab.selectedModel,
      reasoningEffort: tab.reasoningEffort,
      interactionMode: tab.interactionMode
    });
  }
}

async function syncWorkspaceGitDiffTabs(
  project: ProjectRecord,
  workspace: ProjectWorkspace,
  details: GitDetails | null
) {
  const changedKeys = new Set(
    (details?.files ?? []).map((file) => `${file.path}::${file.staged ? "staged" : "working"}`)
  );

  const refreshedTabs = await Promise.all(
    workspace.openTabs.map(async (tab) => {
      if (tab.kind !== "git-diff") {
        return tab;
      }

      const tabKey = `${tab.filePath}::${tab.staged ? "staged" : "working"}`;
      if (!changedKeys.has(tabKey)) {
        return null;
      }

      const nextDiff = await window.naeditor.getGitDiffContent(
        project,
        tab.filePath,
        tab.staged,
        details?.repoRootPath ?? workspace.selectedGitRepoPath
      );
      return {
        ...tab,
        originalContent: nextDiff.originalContent,
        modifiedContent: nextDiff.modifiedContent,
        originalLabel: nextDiff.originalLabel,
        modifiedLabel: nextDiff.modifiedLabel,
        dirty: false
      };
    })
  );

  const openTabs = refreshedTabs.filter((tab): tab is EditorTab => tab !== null);
  const activeTabStillExists = openTabs.some((tab) => tab.path === workspace.activeTabPath);

  return {
    openTabs,
    activeTabPath: activeTabStillExists
      ? workspace.activeTabPath
      : openTabs.at(-1)?.path
  };
}

export const useAppStore = create<AppStore>((set, get) => ({
  hydrated: false,
  loading: true,
  saving: false,
  settingsDialogOpen: false,
  appSettings: defaultAppSettings,
  projects: [],
  selectedProjectId: undefined,
  workspaces: {},
  projectRailCollapsed: false,
  directoryCache: {},
  activeProject: () => {
    const state = get();
    return state.projects.find((project) => project.id === state.selectedProjectId);
  },
  activeWorkspace: () => {
    const state = get();
    return state.selectedProjectId ? state.workspaces[state.selectedProjectId] : undefined;
  },
  hydrate: async () => {
    const snapshot = await window.naeditor.loadState();
    if (snapshot) {
      const migratedWorkspaces = Object.fromEntries(
        Object.entries(snapshot.workspaces).map(([projectId, workspace]) => {
          const browserTabs =
            workspace.browserTabs && workspace.browserTabs.length > 0
              ? workspace.browserTabs
              : [createBrowserTab(workspace.browserUrl ?? "")];
          const terminalTabs =
            workspace.terminalTabs && workspace.terminalTabs.length > 0
              ? workspace.terminalTabs
              : [createTerminalTab()];
          const codeTabs =
            workspace.codeTabs && workspace.codeTabs.length > 0
              ? workspace.codeTabs.map((tab) => ({
                  ...createCodeTab(),
                  ...tab,
                  id: tab.id,
                  title: tab.title ?? "Code",
                  availableModels: tab.availableModels ?? [],
                  draft: tab.draft ?? "",
                  attachments: tab.attachments ?? [],
                  queuedTurns: tab.queuedTurns ?? [],
                  messages: tab.messages ?? [],
                  reasoningEffort: tab.reasoningEffort ?? "medium",
                  runtimeMode: tab.runtimeMode ?? "full-access",
                  sessionRuntimeMode: tab.sessionRuntimeMode,
                  interactionMode: tab.interactionMode ?? "default",
                  status: tab.status ?? "idle"
                }))
              : [createCodeTab()];
          const openTabs = (workspace.openTabs ?? []).map((tab) =>
            "kind" in tab
              ? tab
              : {
                  ...tab,
                  kind: "file" as const
                }
          );
          const activeTerminalTabId =
            workspace.activeTerminalTabId && terminalTabs.some((tab) => tab.id === workspace.activeTerminalTabId)
              ? workspace.activeTerminalTabId
              : terminalTabs[0]?.id;
          const activeCodeTabId =
            workspace.activeCodeTabId && codeTabs.some((tab) => tab.id === workspace.activeCodeTabId)
              ? workspace.activeCodeTabId
              : codeTabs[0]?.id;
          const activeBrowserTabId =
            workspace.activeBrowserTabId && browserTabs.some((tab) => tab.id === workspace.activeBrowserTabId)
              ? workspace.activeBrowserTabId
              : browserTabs[0]?.id;
          const gitRepositories = workspace.gitRepositories ?? [];
          const selectedGitRepoPath =
            workspace.selectedGitRepoPath && gitRepositories.some((repo) => repo.rootPath === workspace.selectedGitRepoPath)
              ? workspace.selectedGitRepoPath
              : gitRepositories[0]?.rootPath;

          return [
            projectId,
            {
              ...workspace,
              track: {
                ...workspace.track,
                order: normalizeSurfaceOrder(workspace.track.order),
                controlsVisible: workspace.track.controlsVisible ?? defaultTrackState.controlsVisible,
                widths: {
                  ...defaultTrackState.widths,
                  ...workspace.track.widths
                },
                inspector: {
                  ...defaultTrackState.inspector,
                  ...workspace.track.inspector,
                  width: workspace.track.inspector?.width ?? defaultTrackState.inspector.width
                }
              },
              openTabs,
              codeTabs,
              activeCodeTabId,
              terminalTabs,
              activeTerminalTabId,
              gitRepositories,
              selectedGitRepoPath,
              browserTabs,
              activeBrowserTabId,
              browserUrl: browserTabs.find((tab) => tab.id === activeBrowserTabId)?.url ?? workspace.browserUrl ?? ""
            }
          ];
        })
      );

      set({
        hydrated: true,
        loading: false,
        appSettings: normalizeAppSettings(snapshot.settings),
        projects: snapshot.projects,
        selectedProjectId: snapshot.selectedProjectId,
        workspaces: migratedWorkspaces,
        projectRailCollapsed: snapshot.projectRailCollapsed
      });
      return;
    }

    set({
      hydrated: true,
      loading: false,
      appSettings: defaultAppSettings,
      projects: [],
      selectedProjectId: undefined,
      workspaces: {},
      projectRailCollapsed: false
    });
  },
  persist: async () => {
    const snapshot = buildSnapshot(get());
    set({ saving: true });
    await window.naeditor.saveState(snapshot);
    set({ saving: false });
  },
  openSettingsDialog: () => set({ settingsDialogOpen: true }),
  closeSettingsDialog: () => set({ settingsDialogOpen: false }),
  updateAppSettings: (patch) => {
    set((state) => ({
      appSettings: {
        ...state.appSettings,
        ...patch,
        remoteServers: patch.remoteServers ?? state.appSettings.remoteServers
      }
    }));
    void get().persist();
  },
  upsertRemoteServer: (config) => {
    set((state) => {
      const existingIndex = state.appSettings.remoteServers.findIndex((entry) => entry.id === config.id);
      const nextRemoteServers =
        existingIndex === -1
          ? [...state.appSettings.remoteServers, config]
          : state.appSettings.remoteServers.map((entry) => (entry.id === config.id ? config : entry));
      return {
        appSettings: {
          ...state.appSettings,
          remoteServers: nextRemoteServers
        }
      };
    });
    void get().persist();
  },
  removeRemoteServerConfig: (configId) => {
    set((state) => ({
      appSettings: {
        ...state.appSettings,
        remoteServers: state.appSettings.remoteServers.filter((entry) => entry.id !== configId)
      }
    }));
    void get().persist();
  },
  addProject: async () => {
    const project = await window.naeditor.openProjectDirectory();
    if (!project) {
      return;
    }

    set((state) => {
      const existing = state.projects.find((entry) => entry.rootPath === project.rootPath);
      if (existing) {
        return { selectedProjectId: existing.id };
      }

      const initialBrowserTab = createBrowserTab(project.previewUrl ?? "");
      const workspace = createEmptyWorkspace();

      return {
        projects: [...state.projects, project],
        selectedProjectId: project.id,
        workspaces: {
          ...state.workspaces,
          [project.id]: {
            ...workspace,
            browserTabs: [initialBrowserTab],
            activeBrowserTabId: initialBrowserTab.id,
            browserUrl: project.previewUrl
          }
        }
      };
    });

    await get().refreshGit(project.id);
    await get().persist();
  },
  addRemoteProject: async (project) => {
    const initialBrowserTab = createBrowserTab(project.previewUrl ?? "");
    const workspace = createEmptyWorkspace();
    set((state) => ({
      projects: [...state.projects, project],
      selectedProjectId: project.id,
      workspaces: {
        ...state.workspaces,
        [project.id]: {
          ...workspace,
          browserTabs: [initialBrowserTab],
          activeBrowserTabId: initialBrowserTab.id,
          browserUrl: project.previewUrl
        }
      }
    }));

    await get().refreshGit(project.id);
    await get().persist();
  },
  removeProject: async (projectId) => {
    set((state) => {
      const nextProjects = state.projects.filter((project) => project.id !== projectId);
      const nextWorkspaces = { ...state.workspaces };
      delete nextWorkspaces[projectId];

      const nextSelectedProjectId =
        state.selectedProjectId === projectId ? nextProjects[0]?.id : state.selectedProjectId;

      return {
        projects: nextProjects,
        workspaces: nextWorkspaces,
        selectedProjectId: nextSelectedProjectId
      };
    });
    await get().persist();
  },
  selectProject: (projectId) => {
    set({ selectedProjectId: projectId });
    void get().refreshGit(projectId);
    void get().persist();
  },
  toggleProjectRail: () => {
    set((state) => ({ projectRailCollapsed: !state.projectRailCollapsed }));
    void get().persist();
  },
  toggleInspector: () => {
    set((state) =>
      withWorkspace(state, (workspace) => ({
        ...workspace,
        track: {
          ...workspace.track,
          inspector: {
            ...workspace.track.inspector,
            visible: !workspace.track.inspector.visible
          }
        }
      }))
    );
    void get().persist();
  },
  setInspectorMode: (mode) => {
    set((state) =>
      withWorkspace(state, (workspace) => ({
        ...workspace,
        track: {
          ...workspace.track,
          inspector: {
            ...workspace.track.inspector,
            visible: true,
            mode
          }
        }
      }))
    );
    void get().persist();
  },
  flipInspectorDock: () => {
    set((state) =>
      withWorkspace(state, (workspace) => ({
        ...workspace,
        track: {
          ...workspace.track,
          inspector: {
            ...workspace.track.inspector,
            dock: workspace.track.inspector.dock === "left" ? "right" : "left"
          }
        }
      }))
    );
    void get().persist();
  },
  setInspectorWidth: (width) => {
    const nextWidth = Math.max(180, Math.min(520, Math.round(width)));
    set((state) =>
      withWorkspace(state, (workspace) => ({
        ...workspace,
        track: {
          ...workspace.track,
          inspector: {
            ...workspace.track.inspector,
            width: nextWidth
          }
        }
      }))
    );
    void get().persist();
  },
  moveProjectSelection: (direction) => {
    const state = get();
    if (state.projects.length === 0 || !state.selectedProjectId) {
      return;
    }

    const currentIndex = state.projects.findIndex((project) => project.id === state.selectedProjectId);
    if (currentIndex === -1) {
      return;
    }

    const nextIndex = Math.max(0, Math.min(state.projects.length - 1, currentIndex + direction));
    const nextProject = state.projects[nextIndex];
    if (nextProject && nextProject.id !== state.selectedProjectId) {
      set({ selectedProjectId: nextProject.id });
      void get().refreshGit(nextProject.id);
      void get().persist();
    }
  },
  moveTrack: (direction) => {
    set((state) =>
      withWorkspace(state, (workspace) => {
        const nextOffset = clampViewportOffset(workspace.track, workspace.track.viewportOffset + direction);

        return {
          ...workspace,
          track: {
            ...workspace.track,
            viewportOffset: nextOffset,
            activeSurface: getActiveSurfaceAtOffset(workspace.track, nextOffset)
          }
        };
      })
    );
    void get().persist();
  },
  anchorSurface: (surface) => {
    set((state) =>
      withWorkspace(state, (workspace) => ({
        ...workspace,
        track: {
          ...workspace.track,
          activeSurface: surface,
          viewportOffset: getSurfaceAnchorOffset(workspace.track, surface)
        }
      }))
    );
    void get().persist();
  },
  adjustSurfaceWidth: (surface, direction) => {
    set((state) =>
      withWorkspace(state, (workspace) => {
        const nextWidth = getNextWidth(workspace.track.widths[surface], direction);
        return {
          ...workspace,
          track: {
            ...workspace.track,
            widths: {
              ...workspace.track.widths,
              [surface]: nextWidth
            },
            viewportOffset: clampViewportOffset(
              {
                ...workspace.track,
                widths: {
                  ...workspace.track.widths,
                  [surface]: nextWidth
                }
              },
              workspace.track.viewportOffset
            )
          }
        };
      })
    );
    void get().persist();
  },
  setSurfaceWidth: (surface, width) => {
    set((state) =>
      withWorkspace(state, (workspace) => ({
        ...workspace,
        track: {
          ...workspace.track,
          widths: {
            ...workspace.track.widths,
            [surface]: width
          },
          viewportOffset: clampViewportOffset(
            {
              ...workspace.track,
              widths: {
                ...workspace.track.widths,
                [surface]: width
              }
            },
            workspace.track.viewportOffset
          )
        }
      }))
    );
    void get().persist();
  },
  moveSurface: (surface, direction) => {
    set((state) =>
      withWorkspace(state, (workspace) => {
        const order = normalizeSurfaceOrder(workspace.track.order);
        const currentIndex = order.indexOf(surface);
        if (currentIndex === -1) {
          return workspace;
        }

        const nextIndex =
          direction === "left"
            ? Math.max(0, currentIndex - 1)
            : Math.min(order.length - 1, currentIndex + 1);

        if (nextIndex === currentIndex) {
          return workspace;
        }

        const nextOrder = [...order];
        const [moved] = nextOrder.splice(currentIndex, 1);
        nextOrder.splice(nextIndex, 0, moved);

        const nextTrack = {
          ...workspace.track,
          order: nextOrder
        };

        return {
          ...workspace,
          track: {
            ...nextTrack,
            viewportOffset: clampViewportOffset(nextTrack, workspace.track.viewportOffset)
          }
        };
      })
    );
    void get().persist();
  },
  toggleTrackControls: () => {
    set((state) =>
      withWorkspace(state, (workspace) => ({
        ...workspace,
        track: {
          ...workspace.track,
          controlsVisible: !(workspace.track.controlsVisible ?? false)
        }
      }))
    );
    void get().persist();
  },
  ensureDirectory: async (rootPath) => {
    const project = get().activeProject();
    if (!project) {
      return;
    }

    const cacheKey = `${project.id}:${rootPath}`;
    if (get().directoryCache[cacheKey]) {
      return;
    }

    const entries = await window.naeditor.readDirectory(project, rootPath);
    set((state) => ({
      directoryCache: {
        ...state.directoryCache,
        [cacheKey]: entries
      }
    }));
  },
  searchProject: async (projectId, query, options) => {
    const project = get().projects.find((entry) => entry.id === projectId);
    if (!project?.rootPath) {
      return [];
    }

    return window.naeditor.searchProject(project, query, options);
  },
  openSearchResult: async (projectId, match, query) => {
    const project = get().projects.find((entry) => entry.id === projectId);
    if (!project?.rootPath) {
      return;
    }

    const targetPath = `${project.rootPath}/${match.path}`;
    await get().openFile(projectId, targetPath);
    set((state) => ({
      workspaces: {
        ...state.workspaces,
        [projectId]: {
          ...(state.workspaces[projectId] ?? createEmptyWorkspace()),
          ...state.workspaces[projectId],
          editorRevealTarget: {
            path: targetPath,
            line: match.line,
            column: match.column,
            endLine: match.line,
            endColumn: match.column + Math.max((match.matchText ?? query ?? "").length, 1),
            query
          },
          track: {
            ...(state.workspaces[projectId]?.track ?? defaultTrackState),
            activeSurface: "editor",
            viewportOffset: getSurfaceAnchorOffset(
              state.workspaces[projectId]?.track ?? defaultTrackState,
              "editor"
            )
          }
        }
      }
    }));
    await get().persist();
  },
  openFile: async (projectId, targetPath) => {
    const project = get().projects.find((entry) => entry.id === projectId);
    if (!project) {
      return;
    }

    const content = await window.naeditor.readFile(project, targetPath);
    const title = targetPath.split("/").at(-1) ?? targetPath;
    const tab: EditorTab = { kind: "file", path: targetPath, title, content, dirty: false };

    set((state) => {
      const workspace = state.workspaces[projectId] ?? createEmptyWorkspace();
      const existing = workspace.openTabs.find((entry) => entry.path === targetPath);
      return {
        workspaces: {
          ...state.workspaces,
          [projectId]: {
            ...workspace,
            openTabs: existing
              ? workspace.openTabs
              : [...workspace.openTabs, tab],
            activeTabPath: targetPath,
            track: {
              ...workspace.track,
              activeSurface: "editor",
              viewportOffset: getSurfaceAnchorOffset(workspace.track, "editor")
            }
          }
        }
      };
    });
    await get().persist();
  },
  openFileAtLocation: async (projectId, targetPath, line = 1, column = 1) => {
    await get().openFile(projectId, targetPath);
    set((state) => ({
      workspaces: {
        ...state.workspaces,
        [projectId]: {
          ...(state.workspaces[projectId] ?? createEmptyWorkspace()),
          ...state.workspaces[projectId],
          editorRevealTarget: {
            path: targetPath,
            line,
            column,
            endLine: line,
            endColumn: column + 1
          },
          track: {
            ...(state.workspaces[projectId]?.track ?? defaultTrackState),
            activeSurface: "editor",
            viewportOffset: getSurfaceAnchorOffset(
              state.workspaces[projectId]?.track ?? defaultTrackState,
              "editor"
            )
          }
        }
      }
    }));
    await get().persist();
  },
  openGitDiffTab: async (projectId, targetPath, staged) => {
    const project = get().projects.find((entry) => entry.id === projectId);
    if (!project) {
      return;
    }

    const workspace = get().workspaces[projectId];
    const diff = await window.naeditor.getGitDiffContent(project, targetPath, staged, getSelectedGitRepoRoot(workspace, project));
    const diffTabPath = `git-diff:${staged ? "staged" : "working"}:${targetPath}`;
    const title = targetPath.split("/").at(-1) ?? targetPath;
    const tab: GitDiffTab = {
      kind: "git-diff",
      path: diffTabPath,
      title,
      dirty: false,
      filePath: targetPath,
      staged,
      originalContent: diff.originalContent,
      modifiedContent: diff.modifiedContent,
      originalLabel: diff.originalLabel,
      modifiedLabel: diff.modifiedLabel
    };

    set((state) => {
      const workspace = state.workspaces[projectId] ?? createEmptyWorkspace();
      const existing = workspace.openTabs.find((entry) => entry.path === diffTabPath);
      return {
        workspaces: {
          ...state.workspaces,
          [projectId]: {
            ...workspace,
            openTabs: existing
              ? workspace.openTabs.map((entry) => (entry.path === diffTabPath ? tab : entry))
              : [...workspace.openTabs, tab],
            activeTabPath: diffTabPath,
            track: {
              ...workspace.track,
              activeSurface: "editor",
              viewportOffset: getSurfaceAnchorOffset(workspace.track, "editor")
            }
          }
        }
      };
    });
    await get().persist();
  },
  openGitCommitFileDiffTab: async (projectId, commitHash, filePath) => {
    const project = get().projects.find((entry) => entry.id === projectId);
    if (!project) {
      return;
    }

    const workspace = get().workspaces[projectId];
    const diff = await window.naeditor.getGitCommitFileDiffContent(project, commitHash, filePath, getSelectedGitRepoRoot(workspace, project));
    const diffTabPath = `git-history-diff:${commitHash}:${filePath}`;
    const title = filePath.split("/").at(-1) ?? filePath;
    const tab: GitHistoryDiffTab = {
      kind: "git-history-diff",
      path: diffTabPath,
      title,
      dirty: false,
      filePath,
      commitHash,
      originalContent: diff.originalContent,
      modifiedContent: diff.modifiedContent,
      originalLabel: diff.originalLabel,
      modifiedLabel: diff.modifiedLabel
    };

    set((state) => {
      const workspace = state.workspaces[projectId] ?? createEmptyWorkspace();
      const existing = workspace.openTabs.find((entry) => entry.path === diffTabPath);
      return {
        workspaces: {
          ...state.workspaces,
          [projectId]: {
            ...workspace,
            openTabs: existing
              ? workspace.openTabs.map((entry) => (entry.path === diffTabPath ? tab : entry))
              : [...workspace.openTabs, tab],
            activeTabPath: diffTabPath,
            track: {
              ...workspace.track,
              activeSurface: "editor",
              viewportOffset: getSurfaceAnchorOffset(workspace.track, "editor")
            }
          }
        }
      };
    });
    await get().persist();
  },
  openGitCommitTab: async (projectId, commitHash) => {
    const project = get().projects.find((entry) => entry.id === projectId);
    if (!project) {
      return;
    }

    const workspace = get().workspaces[projectId];
    const details = await window.naeditor.getGitCommitDetails(project, commitHash, getSelectedGitRepoRoot(workspace, project));
    const commitTabPath = `git-commit:${details.commitHash}`;
    const tab: GitCommitTab = {
      kind: "git-commit",
      path: commitTabPath,
      title: details.title,
      content: details.content,
      dirty: false,
      commitHash: details.commitHash,
      changedFiles: details.changedFiles
    };

    set((state) => {
      const workspace = state.workspaces[projectId] ?? createEmptyWorkspace();
      const existing = workspace.openTabs.find((entry) => entry.path === commitTabPath);
      return {
        workspaces: {
          ...state.workspaces,
          [projectId]: {
            ...workspace,
            openTabs: existing
              ? workspace.openTabs.map((entry) => (entry.path === commitTabPath ? tab : entry))
              : [...workspace.openTabs, tab],
            activeTabPath: commitTabPath,
            track: {
              ...workspace.track,
              activeSurface: "editor",
              viewportOffset: getSurfaceAnchorOffset(workspace.track, "editor")
            }
          }
        }
      };
    });
    await get().persist();
  },
  getGitCommitDetails: async (projectId, commitHash) => {
    const project = get().projects.find((entry) => entry.id === projectId);
    if (!project) {
      return null;
    }

    const workspace = get().workspaces[projectId];
    return window.naeditor.getGitCommitDetails(project, commitHash, getSelectedGitRepoRoot(workspace, project));
  },
  openGitCompareTab: async (projectId, baseRef, targetRef) => {
    const project = get().projects.find((entry) => entry.id === projectId);
    if (!project) {
      return;
    }

    const workspace = get().workspaces[projectId];
    const details = await window.naeditor.getGitCompareDetails(project, baseRef, targetRef, getSelectedGitRepoRoot(workspace, project));
    const compareTabPath = `git-compare:${baseRef}..${targetRef}`;
    const tab: GitCompareTab = {
      kind: "git-compare",
      path: compareTabPath,
      title: details.title,
      content: details.content,
      dirty: false,
      baseRef,
      targetRef,
      changedFiles: details.changedFiles
    };

    set((state) => {
      const workspace = state.workspaces[projectId] ?? createEmptyWorkspace();
      const existing = workspace.openTabs.find((entry) => entry.path === compareTabPath);
      return {
        workspaces: {
          ...state.workspaces,
          [projectId]: {
            ...workspace,
            openTabs: existing
              ? workspace.openTabs.map((entry) => (entry.path === compareTabPath ? tab : entry))
              : [...workspace.openTabs, tab],
            activeTabPath: compareTabPath,
            track: {
              ...workspace.track,
              activeSurface: "editor",
              viewportOffset: getSurfaceAnchorOffset(workspace.track, "editor")
            }
          }
        }
      };
    });
    await get().persist();
  },
  setActiveTab: (path) => {
    set((state) =>
      withWorkspace(state, (workspace) => ({
        ...workspace,
        activeTabPath: path,
        track: {
          ...workspace.track,
          activeSurface: "editor",
          viewportOffset: getSurfaceAnchorOffset(workspace.track, "editor")
        }
      }))
    );
    void get().persist();
  },
  closeTab: (path) => {
    set((state) =>
      withWorkspace(state, (workspace) => {
        const currentIndex = workspace.openTabs.findIndex((tab) => tab.path === path);
        if (currentIndex === -1) {
          return workspace;
        }

        const nextTabs = workspace.openTabs.filter((tab) => tab.path !== path);
        let nextActiveTabPath = workspace.activeTabPath;

        if (workspace.activeTabPath === path) {
          nextActiveTabPath =
            nextTabs[currentIndex]?.path ??
            nextTabs[currentIndex - 1]?.path ??
            nextTabs[0]?.path;
        }

        return {
          ...workspace,
          openTabs: nextTabs,
          activeTabPath: nextActiveTabPath
        };
      })
    );
    void get().persist();
  },
  closeActiveTab: () => {
    const workspace = get().activeWorkspace();
    if (!workspace?.activeTabPath) {
      return;
    }

    get().closeTab(workspace.activeTabPath);
  },
  updateCurrentFileContent: (content) => {
    set((state) =>
      withWorkspace(state, (workspace) => ({
        ...workspace,
        openTabs: workspace.openTabs.map((tab) =>
          tab.path === workspace.activeTabPath
            ? tab.kind === "file"
              ? {
                  ...tab,
                  content,
                  dirty: true
                }
              : tab.kind === "git-diff" && !tab.staged
                ? {
                    ...tab,
                    modifiedContent: content,
                    dirty: true
                  }
                : tab
            : tab
        )
      }))
    );
  },
  saveCurrentFile: async () => {
    const project = get().activeProject();
    const workspace = get().activeWorkspace();
    const activeTab = workspace?.openTabs.find((tab) => tab.path === workspace.activeTabPath);

    if (
      !project ||
      !workspace ||
      !activeTab ||
      (activeTab.kind === "git-diff" && activeTab.staged) ||
      activeTab.kind === "git-history-diff" ||
      activeTab.kind === "git-commit" ||
      activeTab.kind === "git-compare"
    ) {
      return;
    }

    const targetPath = activeTab.kind === "git-diff" ? activeTab.filePath : activeTab.path;
    const nextContent = activeTab.kind === "git-diff" ? activeTab.modifiedContent : activeTab.content;

    await window.naeditor.writeFile(project, targetPath, nextContent);
    set((state) =>
      withWorkspace(state, (currentWorkspace) => ({
        ...currentWorkspace,
        openTabs: currentWorkspace.openTabs.map((tab) =>
          tab.path === activeTab.path
            ? tab.kind === "git-diff"
              ? {
                  ...tab,
                  dirty: false,
                  modifiedContent: nextContent
                }
              : {
                  ...tab,
                  dirty: false
                }
            : tab
        )
      }))
    );
    await get().refreshGit(project.id);
    await get().persist();
  },
  addCodeTab: () => {
    set((state) =>
      withWorkspace(state, (workspace) => {
        const nextTab = createCodeTab();
        return {
          ...workspace,
          codeTabs: [...workspace.codeTabs, nextTab],
          activeCodeTabId: nextTab.id,
          track: {
            ...workspace.track,
            activeSurface: "code",
            viewportOffset: getSurfaceAnchorOffset(workspace.track, "code")
          }
        };
      })
    );
    void get().persist();
  },
  selectCodeTab: (tabId) => {
    set((state) =>
      withWorkspace(state, (workspace) => {
        if (!workspace.codeTabs.some((tab) => tab.id === tabId)) {
          return workspace;
        }
        return {
          ...workspace,
          activeCodeTabId: tabId,
          track: {
            ...workspace.track,
            activeSurface: "code",
            viewportOffset: getSurfaceAnchorOffset(workspace.track, "code")
          }
        };
      })
    );
    void get().persist();
  },
  closeCodeTab: (tabId) => {
    const workspace = get().activeWorkspace();
    const closingTab = workspace?.codeTabs.find((tab) => tab.id === tabId);
    if (closingTab) {
      const confirmed = window.confirm(
        closingTab.threadId
          ? "Close this thread? This will end the active Codex session for this tab."
          : "Close this thread tab?"
      );
      if (!confirmed) {
        return;
      }
    }
    if (closingTab?.threadId) {
      void window.naeditor.stopCodeSession(tabId);
    }
    set((state) =>
      withWorkspace(state, (workspace) => {
        if (workspace.codeTabs.length <= 1) {
          const replacement = createCodeTab();
          return {
            ...workspace,
            codeTabs: [replacement],
            activeCodeTabId: replacement.id
          };
        }
        const currentIndex = workspace.codeTabs.findIndex((tab) => tab.id === tabId);
        if (currentIndex === -1) {
          return workspace;
        }
        const nextTabs = workspace.codeTabs.filter((tab) => tab.id !== tabId);
        const nextActiveId =
          workspace.activeCodeTabId === tabId
            ? nextTabs[currentIndex]?.id ?? nextTabs[currentIndex - 1]?.id ?? nextTabs[0]?.id
            : workspace.activeCodeTabId;
        return {
          ...workspace,
          codeTabs: nextTabs,
          activeCodeTabId: nextActiveId
        };
      })
    );
    void get().persist();
  },
  closeActiveCodeTab: () => {
    const workspace = get().activeWorkspace();
    const tabId = workspace?.activeCodeTabId ?? workspace?.codeTabs[0]?.id;
    if (!tabId) {
      return;
    }
    get().closeCodeTab(tabId);
  },
  ensureCodeBootstrap: async (tabId) => {
    const context = getCodeContext(get(), tabId);
    if (!context) {
      return;
    }

    if (context.tab.availableModels.length > 0 || context.tab.status === "connecting") {
      return;
    }

    const cwd = getSelectedGitRepoRoot(context.workspace, context.project);
    if (!cwd) {
      return;
    }

    set((state) =>
      withWorkspace(state, (workspace) =>
        updateCodeTab(workspace, tabId, (tab) => ({
          ...tab,
          status: tab.threadId ? tab.status : "connecting",
          lastError: undefined
        }))
      )
    );

    try {
      const bootstrap = await window.naeditor.getCodeBootstrap(context.project, cwd);
      set((state) =>
        withWorkspace(state, (workspace) =>
          updateCodeTab(workspace, tabId, (tab) => ({
            ...tab,
            status: tab.threadId ? tab.status : "idle",
            cwd,
            account: bootstrap.account,
            availableModels: bootstrap.models,
            selectedModel:
              tab.selectedModel ??
              bootstrap.models.find((model) => model.isDefault)?.model ??
              bootstrap.models[0]?.model
          }))
        )
      );
      await get().persist();
    } catch (error) {
      set((state) =>
        withWorkspace(state, (workspace) =>
          updateCodeTab(workspace, tabId, (tab) => ({
            ...tab,
            status: "error",
            lastError: error instanceof Error ? error.message : "Failed to load Codex models."
          }))
        )
      );
    }
  },
  updateCodeDraft: (tabId, draft) => {
    set((state) =>
      withWorkspace(state, (workspace) =>
        updateCodeTab(workspace, tabId, (tab) => ({
          ...tab,
          draft
        }))
      )
    );
  },
  setCodeModel: (tabId, model) => {
    set((state) =>
      withWorkspace(state, (workspace) =>
        updateCodeTab(workspace, tabId, (tab) => ({
          ...tab,
          selectedModel: model
        }))
      )
    );
    void get().persist();
  },
  setCodeReasoningEffort: (tabId, effort) => {
    set((state) =>
      withWorkspace(state, (workspace) =>
        updateCodeTab(workspace, tabId, (tab) => ({
          ...tab,
          reasoningEffort: effort
        }))
      )
    );
    void get().persist();
  },
  setCodeRuntimeMode: (tabId, mode) => {
    set((state) =>
      withWorkspace(state, (workspace) =>
        updateCodeTab(workspace, tabId, (tab) => ({
          ...tab,
          runtimeMode: mode
        }))
      )
    );
    void get().persist();
  },
  setCodeInteractionMode: (tabId, mode) => {
    set((state) =>
      withWorkspace(state, (workspace) =>
        updateCodeTab(workspace, tabId, (tab) => ({
          ...tab,
          interactionMode: mode
        }))
      )
    );
    void get().persist();
  },
  addCodeAttachment: (tabId, attachment) => {
    set((state) =>
      withWorkspace(state, (workspace) =>
        updateCodeTab(workspace, tabId, (tab) => ({
          ...tab,
          attachments: [...tab.attachments, attachment]
        }))
      )
    );
  },
  removeCodeAttachment: (tabId, attachmentId) => {
    set((state) =>
      withWorkspace(state, (workspace) =>
        updateCodeTab(workspace, tabId, (tab) => ({
          ...tab,
          attachments: tab.attachments.filter((attachment) => attachment.id !== attachmentId)
        }))
      )
    );
  },
  removeQueuedCodeTurn: (tabId, queuedTurnId) => {
    set((state) =>
      withWorkspace(state, (workspace) =>
        updateCodeTab(workspace, tabId, (tab) => ({
          ...tab,
          queuedTurns: tab.queuedTurns.filter((queuedTurn) => queuedTurn.id !== queuedTurnId)
        }))
      )
    );
    void get().persist();
  },
  clearQueuedCodeTurns: (tabId) => {
    set((state) =>
      withWorkspace(state, (workspace) =>
        updateCodeTab(workspace, tabId, (tab) => ({
          ...tab,
          queuedTurns: []
        }))
      )
    );
    void get().persist();
  },
  replaceNextQueuedCodeTurn: (tabId) => {
    set((state) =>
      withWorkspace(state, (workspace) =>
        updateCodeTab(workspace, tabId, (tab) => {
          const input = tab.draft.trim();
          if (!input && tab.attachments.length === 0) {
            return tab;
          }

          const nextQueuedTurn = {
            id: tab.queuedTurns[0]?.id ?? crypto.randomUUID(),
            input: input || undefined,
            attachments: tab.attachments,
            model: tab.selectedModel,
            reasoningEffort: tab.reasoningEffort,
            runtimeMode: tab.runtimeMode,
            interactionMode: tab.interactionMode,
            createdAt: new Date().toISOString()
          };

          return {
            ...tab,
            draft: "",
            attachments: [],
            queuedTurns:
              tab.queuedTurns.length > 0
                ? [nextQueuedTurn, ...tab.queuedTurns.slice(1)]
                : [nextQueuedTurn],
            lastError: undefined
          };
        })
      )
    );
    void get().persist();
  },
  submitCodeTurn: async (tabId) => {
    let context = getCodeContext(get(), tabId);
    if (!context) {
      return;
    }

    const text = context.tab.draft.trim();
    const attachments = context.tab.attachments;
    if (!text && attachments.length === 0) {
      return;
    }

    if (context.tab.availableModels.length === 0) {
      await get().ensureCodeBootstrap(tabId);
      context = getCodeContext(get(), tabId);
      if (!context) {
        return;
      }
    }

    const shouldQueue =
      context.tab.status === "running" ||
      context.tab.status === "waiting" ||
      Boolean(context.tab.pendingRequest);

    if (shouldQueue) {
      const queuedTurn = {
        id: crypto.randomUUID(),
        input: text || undefined,
        attachments,
        model: context.tab.selectedModel,
        reasoningEffort: context.tab.reasoningEffort,
        runtimeMode: context.tab.runtimeMode,
        interactionMode: context.tab.interactionMode,
        createdAt: new Date().toISOString()
      };

      set((state) =>
        withWorkspace(state, (workspace) =>
          updateCodeTab(workspace, tabId, (tab) => ({
            ...tab,
            draft: "",
            attachments: [],
            queuedTurns: [...tab.queuedTurns, queuedTurn],
            lastError: undefined
          }))
        )
      );
      void get().persist();
      return;
    }

    set((state) =>
      withWorkspace(state, (workspace) =>
        updateCodeTab(workspace, tabId, (tab) => ({
          ...tab,
          draft: "",
          attachments: [],
          lastError: undefined
        }))
      )
    );

    try {
      await sendCodeTurnThroughSession(
        context.project,
        context.workspace,
        context.tab,
        tabId,
        text,
        attachments
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send follow-up to Codex.";
      set((state) =>
        withWorkspace(state, (workspace) =>
          updateCodeTab(workspace, tabId, (tab) => ({
            ...tab,
            draft: text,
            attachments,
            lastError: message
          }))
        )
      );
      throw error;
    }
    void get().persist();
  },
  interruptCodeTurn: async (tabId) => {
    const context = getCodeContext(get(), tabId);
    if (!context?.tab.threadId) {
      return;
    }
    await window.naeditor.interruptCodeTurn(tabId);
  },
  respondToCodeRequest: async (tabId, decision, answers) => {
    const context = getCodeContext(get(), tabId);
    const requestId = context?.tab.pendingRequest?.requestId;
    if (!context || !requestId) {
      return;
    }
    await window.naeditor.respondToCodeRequest(tabId, requestId, decision, answers);
  },
  handleCodeEvent: (event) => {
    const workspaceEntries = Object.entries(get().workspaces);
    const owner = workspaceEntries.find(([, workspace]) =>
      workspace.codeTabs.some((tab) => tab.id === event.sessionId)
    );

    if (!owner) {
      return;
    }

    const [projectId] = owner;
    set((state) => {
      const workspace = state.workspaces[projectId];
      if (!workspace) {
        return state;
      }

      const nextWorkspace = updateCodeTab(workspace, event.sessionId, (tab) => {
        switch (event.type) {
          case "session.started":
            return {
              ...tab,
              ...(event.title ? { title: event.title } : {}),
              status: event.status,
              threadId: event.threadId,
              cwd: event.cwd,
              sessionPath: event.sessionPath,
              sessionRuntimeMode: tab.runtimeMode,
              account: event.account,
              availableModels: event.models,
              selectedModel:
                tab.selectedModel ??
                event.models.find((model) => model.isDefault)?.model ??
                event.models[0]?.model,
              lastError: undefined
            };
          case "session.state":
            return {
              ...tab,
              status: event.status,
              ...(event.status === "closed" ? { sessionRuntimeMode: undefined } : {}),
              ...(event.threadId ? { threadId: event.threadId } : {}),
              ...(event.message && event.status === "error"
                ? { lastError: event.message }
                : {})
            };
          case "turn.started":
            return {
              ...tab,
              status: "running",
              pendingRequest: undefined
            };
          case "turn.completed":
            {
              const nextMessages = [...tab.messages];
              const lastAssistantIndex = [...nextMessages]
                .reverse()
                .findIndex((message) => message.kind === "assistant");
              if (lastAssistantIndex >= 0) {
                const targetIndex = nextMessages.length - 1 - lastAssistantIndex;
                const target = nextMessages[targetIndex];
                if (target) {
                  nextMessages[targetIndex] = {
                    ...target,
                    ...(event.completedAt ? { completedAt: event.completedAt } : {}),
                    ...(event.elapsedMs !== undefined ? { elapsedMs: event.elapsedMs } : {}),
                    ...(event.changedFiles ? { changedFiles: event.changedFiles } : {})
                  };
                }
              }
              return {
                ...tab,
                status: event.status === "completed" ? "ready" : "error",
                messages: nextMessages,
                ...(event.error ? { lastError: event.error } : {})
              };
            }
          case "thread.compacted":
            return {
              ...tab,
              messages: [
                ...tab.messages,
                {
                  id: `${event.sessionId}-compacted-${event.at ?? tab.messages.length}`,
                  kind: "status",
                  title: "Context auto-compacted",
                  text:
                    event.summary ??
                    "Codex compacted earlier context to keep the thread moving.",
                  ...(event.at ? { createdAt: event.at } : {})
                }
              ]
            };
          case "message.started": {
            const existingIndex = tab.messages.findIndex((message) => message.id === event.message.id);
            const nextMessages = [...tab.messages];
            if (existingIndex >= 0) {
              nextMessages[existingIndex] = event.message;
            } else {
              nextMessages.push(event.message);
            }
            return {
              ...tab,
              messages: nextMessages
            };
          }
          case "message.delta":
            {
              const nextMessages = tab.messages.map((message) =>
                message.id === event.messageId
                  ? {
                      ...message,
                      text: `${message.text}${event.delta}`,
                      streaming: true
                    }
                  : message
              );
              return {
              ...tab,
              messages: nextMessages
            };
            }
          case "message.completed":
            {
              const nextMessages = tab.messages.map((message) =>
                message.id === event.messageId
                  ? {
                      ...message,
                      ...(event.text ? { text: event.text } : {}),
                      streaming: false
                    }
                  : message
              );
              return {
              ...tab,
              messages: nextMessages
            };
            }
          case "request.opened":
            return {
              ...tab,
              status: "waiting",
              pendingRequest: event.request
            };
          case "request.resolved":
            return {
              ...tab,
              pendingRequest:
                tab.pendingRequest?.requestId === event.requestId ? undefined : tab.pendingRequest,
              status: "running"
            };
          case "token-usage.updated":
            return {
              ...tab,
              tokenUsage: event.usage
            };
          case "error":
            return {
              ...tab,
              status: "error",
              lastError: event.message
            };
          default:
            return tab;
        }
      });

      return {
        workspaces: {
          ...state.workspaces,
          [projectId]: nextWorkspace
        }
      };
    });

    if (
      event.type === "turn.completed" ||
      (event.type === "session.state" && event.status === "ready") ||
      event.type === "request.resolved"
    ) {
      const nextContext = getCodeContext(get(), event.sessionId);
      if (
        nextContext?.tab.queuedTurns.length &&
        nextContext.tab.status === "ready" &&
        !nextContext.tab.pendingRequest
      ) {
        const [queuedTurn, ...remainingQueuedTurns] = nextContext.tab.queuedTurns;
        if (!queuedTurn) {
          return;
        }
        set((state) =>
          withWorkspace(state, (workspace) =>
            updateCodeTab(workspace, event.sessionId, (tab) => ({
              ...tab,
              queuedTurns: remainingQueuedTurns,
              lastError: undefined
            }))
          )
        );

        void sendCodeTurnThroughSession(
          nextContext.project,
          nextContext.workspace,
          {
            ...nextContext.tab,
            selectedModel: queuedTurn.model,
            reasoningEffort: queuedTurn.reasoningEffort,
            runtimeMode: queuedTurn.runtimeMode,
            interactionMode: queuedTurn.interactionMode,
            queuedTurns: remainingQueuedTurns
          },
          event.sessionId,
          queuedTurn.input ?? "",
          queuedTurn.attachments
        ).catch((error) => {
          const message =
            error instanceof Error ? error.message : "Failed to send queued follow-up to Codex.";
          set((state) =>
            withWorkspace(state, (workspace) =>
              updateCodeTab(workspace, event.sessionId, (tab) => ({
                ...tab,
                queuedTurns: [queuedTurn, ...tab.queuedTurns],
                lastError: message
              }))
            )
          );
        });
      }
    }
  },
  setBrowserUrl: (url) => {
    set((state) =>
      withWorkspace(state, (workspace) => ({
        ...workspace,
        browserUrl: url,
        browserTabs: workspace.browserTabs.map((tab) =>
          tab.id === workspace.activeBrowserTabId
            ? {
                ...tab,
                url
              }
            : tab
        ),
        portForward: undefined,
        track: {
          ...workspace.track,
          activeSurface: "browser",
          viewportOffset: getSurfaceAnchorOffset(workspace.track, "browser")
        }
      }))
    );
    void get().persist();
  },
  addTerminalTab: () => {
    set((state) =>
      withWorkspace(state, (workspace) => {
        const nextTab = createTerminalTab();
        return {
          ...workspace,
          terminalTabs: [...workspace.terminalTabs, nextTab],
          activeTerminalTabId: nextTab.id,
          track: {
            ...workspace.track,
            activeSurface: "terminal",
            viewportOffset: getSurfaceAnchorOffset(workspace.track, "terminal")
          }
        };
      })
    );
    void get().persist();
  },
  selectTerminalTab: (tabId) => {
    set((state) =>
      withWorkspace(state, (workspace) => {
        if (!workspace.terminalTabs.some((tab) => tab.id === tabId)) {
          return workspace;
        }

        return {
          ...workspace,
          activeTerminalTabId: tabId,
          track: {
            ...workspace.track,
            activeSurface: "terminal",
            viewportOffset: getSurfaceAnchorOffset(workspace.track, "terminal")
          }
        };
      })
    );
    void get().persist();
  },
  closeTerminalTab: (tabId) => {
    set((state) =>
      withWorkspace(state, (workspace) => {
        if (workspace.terminalTabs.length <= 1) {
          const replacement = createTerminalTab();
          return {
            ...workspace,
            terminalTabs: [replacement],
            activeTerminalTabId: replacement.id
          };
        }

        const currentIndex = workspace.terminalTabs.findIndex((tab) => tab.id === tabId);
        if (currentIndex === -1) {
          return workspace;
        }

        const nextTabs = workspace.terminalTabs.filter((tab) => tab.id !== tabId);
        const nextActiveId =
          workspace.activeTerminalTabId === tabId
            ? nextTabs[currentIndex]?.id ?? nextTabs[currentIndex - 1]?.id ?? nextTabs[0]?.id
            : workspace.activeTerminalTabId;

        return {
          ...workspace,
          terminalTabs: nextTabs,
          activeTerminalTabId: nextActiveId
        };
      })
    );
    void get().persist();
  },
  closeActiveTerminalTab: () => {
    const workspace = get().activeWorkspace();
    const tabId = workspace?.activeTerminalTabId ?? workspace?.terminalTabs[0]?.id;
    if (!tabId) {
      return;
    }
    get().closeTerminalTab(tabId);
  },
  splitActiveTerminalPane: (direction) => {
    set((state) =>
      withWorkspace(state, (workspace) => {
        const activeTabId = workspace.activeTerminalTabId ?? workspace.terminalTabs[0]?.id;
        if (!activeTabId) {
          return workspace;
        }

        const nextTabs = workspace.terminalTabs.map((tab) => {
          if (tab.id !== activeTabId) {
            return tab;
          }

          const nextPane = createTerminalPane();
          return {
            ...tab,
            root: splitTerminalNode(tab.root, tab.activePaneId, direction, nextPane.id),
            activePaneId: nextPane.id
          };
        });

        return {
          ...workspace,
          terminalTabs: nextTabs,
          track: {
            ...workspace.track,
            activeSurface: "terminal",
            viewportOffset: getSurfaceAnchorOffset(workspace.track, "terminal")
          }
        };
      })
    );
    void get().persist();
  },
  closeActiveTerminalPane: () => {
    const workspace = get().activeWorkspace();
    const activeTabId = workspace?.activeTerminalTabId ?? workspace?.terminalTabs[0]?.id;
    if (!workspace || !activeTabId) {
      return;
    }

    const activeTab = workspace.terminalTabs.find((tab) => tab.id === activeTabId);
    if (!activeTab) {
      return;
    }

    if (countTerminalPanes(activeTab.root) <= 1) {
      get().closeActiveTerminalTab();
      return;
    }

    set((state) =>
      withWorkspace(state, (currentWorkspace) => {
        const currentActiveTabId = currentWorkspace.activeTerminalTabId ?? currentWorkspace.terminalTabs[0]?.id;
        if (!currentActiveTabId) {
          return currentWorkspace;
        }

        return {
          ...currentWorkspace,
          terminalTabs: currentWorkspace.terminalTabs.map((tab) => {
            if (tab.id !== currentActiveTabId) {
              return tab;
            }

            const nextRoot = removeTerminalPane(tab.root, tab.activePaneId);
            if (!nextRoot) {
              return tab;
            }

            return {
              ...tab,
              root: nextRoot,
              activePaneId: findFirstPaneId(nextRoot) ?? tab.activePaneId
            };
          }),
          track: {
            ...currentWorkspace.track,
            activeSurface: "terminal",
            viewportOffset: getSurfaceAnchorOffset(currentWorkspace.track, "terminal")
          }
        };
      })
    );
    void get().persist();
  },
  focusTerminalPane: (paneId) => {
    set((state) =>
      withWorkspace(state, (workspace) => {
        const activeTabId = workspace.activeTerminalTabId ?? workspace.terminalTabs[0]?.id;
        if (!activeTabId) {
          return workspace;
        }

        return {
          ...workspace,
          terminalTabs: workspace.terminalTabs.map((tab) =>
            tab.id === activeTabId
              ? {
                  ...tab,
                  activePaneId: paneId
                }
              : tab
          )
        };
      })
    );
  },
  addBrowserTab: () => {
    set((state) =>
      withWorkspace(state, (workspace) => {
        const nextTab = createBrowserTab("");
        return {
          ...workspace,
          browserTabs: [...workspace.browserTabs, nextTab],
          activeBrowserTabId: nextTab.id,
          browserUrl: "",
          track: {
            ...workspace.track,
            activeSurface: "browser",
            viewportOffset: getSurfaceAnchorOffset(workspace.track, "browser")
          }
        };
      })
    );
    void get().persist();
  },
  closeBrowserTab: (tabId) => {
    set((state) =>
      withWorkspace(state, (workspace) => {
        if (workspace.browserTabs.length <= 1) {
          const replacement = createBrowserTab("");
          return {
            ...workspace,
            browserTabs: [replacement],
            activeBrowserTabId: replacement.id,
            browserUrl: ""
          };
        }

        const currentIndex = workspace.browserTabs.findIndex((tab) => tab.id === tabId);
        if (currentIndex === -1) {
          return workspace;
        }

        const nextTabs = workspace.browserTabs.filter((tab) => tab.id !== tabId);
        const nextActiveId =
          workspace.activeBrowserTabId === tabId
            ? nextTabs[currentIndex]?.id ?? nextTabs[currentIndex - 1]?.id ?? nextTabs[0]?.id
            : workspace.activeBrowserTabId;
        const nextActiveTab = nextTabs.find((tab) => tab.id === nextActiveId) ?? nextTabs[0];

        return {
          ...workspace,
          browserTabs: nextTabs,
          activeBrowserTabId: nextActiveId,
          browserUrl: nextActiveTab?.url ?? ""
        };
      })
    );
    void get().persist();
  },
  closeActiveBrowserTab: () => {
    const workspace = get().activeWorkspace();
    const activeTabId = workspace?.activeBrowserTabId ?? workspace?.browserTabs[0]?.id;
    if (!activeTabId) {
      return;
    }
    get().closeBrowserTab(activeTabId);
  },
  selectBrowserTab: (tabId) => {
    set((state) =>
      withWorkspace(state, (workspace) => {
        const nextTab = workspace.browserTabs.find((tab) => tab.id === tabId);
        if (!nextTab) {
          return workspace;
        }

        return {
          ...workspace,
          activeBrowserTabId: tabId,
          browserUrl: nextTab.url,
          track: {
            ...workspace.track,
            activeSurface: "browser",
            viewportOffset: getSurfaceAnchorOffset(workspace.track, "browser")
          }
        };
      })
    );
    void get().persist();
  },
  updateBrowserTabState: (stateUpdate, tabId) => {
    set((state) =>
      withWorkspace(state, (workspace) => {
        const targetTabId = tabId ?? workspace.activeBrowserTabId ?? workspace.browserTabs[0]?.id;
        if (!targetTabId) {
          return workspace;
        }

        const currentTab = workspace.browserTabs.find((tab) => tab.id === targetTabId);
        if (
          currentTab &&
          (stateUpdate.url || currentTab.url) === currentTab.url &&
          (stateUpdate.title || currentTab.title) === currentTab.title &&
          stateUpdate.faviconUrl === currentTab.faviconUrl
        ) {
          return workspace;
        }

        const nextTabs = workspace.browserTabs.map((tab) =>
          tab.id === targetTabId
            ? {
                ...tab,
                url: stateUpdate.url || tab.url,
                title: stateUpdate.title || tab.title,
                faviconUrl: stateUpdate.faviconUrl
              }
            : tab
        );
        const activeTab = nextTabs.find((tab) => tab.id === (workspace.activeBrowserTabId ?? targetTabId));

        return {
          ...workspace,
          browserTabs: nextTabs,
          browserUrl: activeTab?.url ?? workspace.browserUrl
        };
      })
    );
  },
  setPortForwardInfo: (info) => {
    set((state) =>
      withWorkspace(state, (workspace) => ({
        ...workspace,
        portForward: info
      }))
    );
  },
  listGitRepositories: async (projectId) => {
    const project = get().projects.find((entry) => entry.id === projectId);
    if (!project?.rootPath) {
      return [];
    }

    const repositories = await window.naeditor.listGitRepositories(project);
    set((state) => {
      const workspace = state.workspaces[projectId] ?? createEmptyWorkspace();
      const selectedGitRepoPath =
        workspace.selectedGitRepoPath && repositories.some((repo) => repo.rootPath === workspace.selectedGitRepoPath)
          ? workspace.selectedGitRepoPath
          : repositories[0]?.rootPath;
      return {
        workspaces: {
          ...state.workspaces,
          [projectId]: {
            ...workspace,
            gitRepositories: repositories,
            selectedGitRepoPath
          }
        }
      };
    });
    return repositories;
  },
  selectGitRepository: async (projectId, repoRootPath) => {
    set((state) => ({
      workspaces: {
        ...state.workspaces,
        [projectId]: {
          ...(state.workspaces[projectId] ?? createEmptyWorkspace()),
          selectedGitRepoPath: repoRootPath
        }
      }
    }));
    await get().refreshGit(projectId);
    await get().persist();
  },
  refreshGit: async (projectId) => {
    const project = get().projects.find((entry) => entry.id === projectId);
    if (!project?.rootPath) {
      return;
    }

    const currentWorkspace = get().workspaces[projectId] ?? createEmptyWorkspace();
    const repositories = await window.naeditor.listGitRepositories(project);
    const preferredRepoRoot = getSelectedGitRepoRoot(currentWorkspace, project);
    const selectedRepoRoot =
      preferredRepoRoot && repositories.some((repo) => repo.rootPath === preferredRepoRoot)
        ? preferredRepoRoot
        : repositories[0]?.rootPath;
    const details = selectedRepoRoot
      ? await window.naeditor.getGitDetails(project, selectedRepoRoot)
      : null;
    const syncedTabs = await syncWorkspaceGitDiffTabs(project, currentWorkspace, details);

    set((state) => ({
      workspaces: {
        ...state.workspaces,
        [projectId]: {
          ...(state.workspaces[projectId] ?? { ...createEmptyWorkspace(), track: defaultTrackState }),
          ...syncedTabs,
          gitRepositories: repositories,
          selectedGitRepoPath: selectedRepoRoot,
          git: details ?? undefined
        }
      }
    }));
  },
  initGit: async (projectId) => {
    const project = get().projects.find((entry) => entry.id === projectId);
    if (!project) {
      return null;
    }

    const workspace = get().workspaces[projectId];
    const result = await window.naeditor.initGit(project, getSelectedGitRepoRoot(workspace, project));
    await get().refreshGit(projectId);
    return result;
  },
  listGitBranches: async (projectId) => {
    const project = get().projects.find((entry) => entry.id === projectId);
    if (!project) {
      return [];
    }

    const workspace = get().workspaces[projectId];
    return window.naeditor.listGitBranches(project, getSelectedGitRepoRoot(workspace, project));
  },
  listGitGraph: async (projectId) => {
    const project = get().projects.find((entry) => entry.id === projectId);
    if (!project) {
      return [];
    }

    const workspace = get().workspaces[projectId];
    return window.naeditor.listGitGraph(project, getSelectedGitRepoRoot(workspace, project));
  },
  stageGitFile: async (projectId, filePath) => {
    const project = get().projects.find((entry) => entry.id === projectId);
    if (!project) {
      return null;
    }

    const workspace = get().workspaces[projectId];
    const result = await window.naeditor.stageGitFile(project, filePath, getSelectedGitRepoRoot(workspace, project));
    await get().refreshGit(projectId);
    return result;
  },
  stageAllGitFiles: async (projectId) => {
    const project = get().projects.find((entry) => entry.id === projectId);
    if (!project) {
      return null;
    }

    const workspace = get().workspaces[projectId];
    const result = await window.naeditor.stageAllGitFiles(project, getSelectedGitRepoRoot(workspace, project));
    await get().refreshGit(projectId);
    return result;
  },
  unstageGitFile: async (projectId, filePath) => {
    const project = get().projects.find((entry) => entry.id === projectId);
    if (!project) {
      return null;
    }

    const workspace = get().workspaces[projectId];
    const result = await window.naeditor.unstageGitFile(project, filePath, getSelectedGitRepoRoot(workspace, project));
    await get().refreshGit(projectId);
    return result;
  },
  unstageAllGitFiles: async (projectId) => {
    const project = get().projects.find((entry) => entry.id === projectId);
    if (!project) {
      return null;
    }

    const workspace = get().workspaces[projectId];
    const result = await window.naeditor.unstageAllGitFiles(project, getSelectedGitRepoRoot(workspace, project));
    await get().refreshGit(projectId);
    return result;
  },
  discardAllGitFiles: async (projectId) => {
    const project = get().projects.find((entry) => entry.id === projectId);
    if (!project) {
      return null;
    }

    const workspace = get().workspaces[projectId];
    const result = await window.naeditor.discardAllGitFiles(project, getSelectedGitRepoRoot(workspace, project));
    await get().refreshGit(projectId);
    return result;
  },
  discardGitFile: async (projectId, filePath) => {
    const project = get().projects.find((entry) => entry.id === projectId);
    if (!project) {
      return null;
    }

    const workspace = get().workspaces[projectId];
    const result = await window.naeditor.discardGitFile(project, filePath, getSelectedGitRepoRoot(workspace, project));
    await get().refreshGit(projectId);
    return result;
  },
  getGitDiff: async (projectId, filePath, staged) => {
    const project = get().projects.find((entry) => entry.id === projectId);
    if (!project) {
      return "";
    }

    const workspace = get().workspaces[projectId];
    return window.naeditor.getGitDiff(project, filePath, staged, getSelectedGitRepoRoot(workspace, project));
  },
  commitGit: async (projectId, message) => {
    const project = get().projects.find((entry) => entry.id === projectId);
    if (!project) {
      return null;
    }

    const workspace = get().workspaces[projectId];
    const result = await window.naeditor.commitGit(project, message, getSelectedGitRepoRoot(workspace, project));
    await get().refreshGit(projectId);
    if (result.exitCode === 0) {
      await wait(120);
      await get().refreshGit(projectId);
    }
    return result;
  },
  checkoutGitBranch: async (projectId, branchName) => {
    const project = get().projects.find((entry) => entry.id === projectId);
    if (!project) {
      return null;
    }

    const workspace = get().workspaces[projectId];
    const result = await window.naeditor.checkoutGitBranch(project, branchName, getSelectedGitRepoRoot(workspace, project));
    await get().refreshGit(projectId);
    return result;
  },
  createGitBranch: async (projectId, branchName) => {
    const project = get().projects.find((entry) => entry.id === projectId);
    if (!project) {
      return null;
    }

    const workspace = get().workspaces[projectId];
    const result = await window.naeditor.createGitBranch(project, branchName, getSelectedGitRepoRoot(workspace, project));
    await get().refreshGit(projectId);
    return result;
  },
  fetchGit: async (projectId) => {
    const project = get().projects.find((entry) => entry.id === projectId);
    if (!project) {
      return null;
    }

    const workspace = get().workspaces[projectId];
    const result = await window.naeditor.fetchGit(project, getSelectedGitRepoRoot(workspace, project));
    await get().refreshGit(projectId);
    return result;
  },
  pullGit: async (projectId) => {
    const project = get().projects.find((entry) => entry.id === projectId);
    if (!project) {
      return null;
    }

    const workspace = get().workspaces[projectId];
    const result = await window.naeditor.pullGit(project, getSelectedGitRepoRoot(workspace, project));
    await get().refreshGit(projectId);
    if (result.exitCode === 0) {
      await wait(120);
      await get().refreshGit(projectId);
    }
    return result;
  },
  pushGit: async (projectId) => {
    const project = get().projects.find((entry) => entry.id === projectId);
    if (!project) {
      return null;
    }

    const workspace = get().workspaces[projectId];
    const result = await window.naeditor.pushGit(project, getSelectedGitRepoRoot(workspace, project));
    await get().refreshGit(projectId);
    if (result.exitCode === 0) {
      await wait(120);
      await get().refreshGit(projectId);
    }
    return result;
  }
}));

function splitTerminalNode(
  node: TerminalSplitNode,
  targetPaneId: string,
  direction: "horizontal" | "vertical",
  nextPaneId: string
): TerminalSplitNode {
  if (node.type === "pane") {
    if (node.paneId !== targetPaneId) {
      return node;
    }

    return {
      id: `terminal-split-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: "split",
      direction,
      children: [node, createTerminalLeaf(nextPaneId)]
    };
  }

  return {
    ...node,
    children: node.children.map((child) => splitTerminalNode(child, targetPaneId, direction, nextPaneId))
  };
}

function countTerminalPanes(node: TerminalSplitNode): number {
  if (node.type === "pane") {
    return 1;
  }

  return node.children.reduce((count, child) => count + countTerminalPanes(child), 0);
}

function findFirstPaneId(node: TerminalSplitNode): string | undefined {
  if (node.type === "pane") {
    return node.paneId;
  }

  for (const child of node.children) {
    const paneId = findFirstPaneId(child);
    if (paneId) {
      return paneId;
    }
  }

  return undefined;
}

function removeTerminalPane(node: TerminalSplitNode, targetPaneId: string): TerminalSplitNode | null {
  if (node.type === "pane") {
    return node.paneId === targetPaneId ? null : node;
  }

  const nextChildren = node.children
    .map((child) => removeTerminalPane(child, targetPaneId))
    .filter((child): child is TerminalSplitNode => child !== null);

  if (nextChildren.length === 0) {
    return null;
  }

  if (nextChildren.length === 1) {
    return nextChildren[0];
  }

  return {
    ...node,
    children: nextChildren
  };
}
