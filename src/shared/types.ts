export type SurfaceId = "editor" | "code" | "terminal" | "browser";

export type AppCommand =
  | "track-left"
  | "track-right"
  | "project-up"
  | "project-down"
  | "anchor-editor"
  | "anchor-code"
  | "anchor-terminal"
  | "anchor-browser"
  | "save-file"
  | "close-tab"
  | "new-tab"
  | "toggle-browser-devtools"
  | "split-terminal-vertical"
  | "split-terminal-horizontal"
  | "close-terminal-pane"
  | "open-project"
  | "open-settings"
  | "toggle-rail"
  | "toggle-inspector"
  | "show-files"
  | "show-search"
  | "show-git"
  | "flip-inspector"
  | "grow-surface"
  | "shrink-surface";

export type SnapWidth = "1/3" | "1/2" | "2/3" | "3/4" | "1/1";

export type InspectorMode =
  | "files"
  | "search"
  | "git"
  | "branches"
  | "comments"
  | "remote"
  | "problems";

export type ProjectKind = "local" | "remote";
export type AppTheme = "auto" | "dark" | "light";
export type EditorTheme =
  | "spacecode-dark"
  | "spacecode-light"
  | "github-dark"
  | "github-light"
  | "dracula"
  | "nord"
  | "solarized-dark"
  | "solarized-light"
  | "hc-black";
export type TerminalThemePreset =
  | "spacecode-dark"
  | "spacecode-light"
  | "github-dark"
  | "github-light"
  | "dracula"
  | "nord"
  | "solarized-dark"
  | "solarized-light"
  | "gruvbox-dark";

export type CodeTab = {
  id: string;
  title: string;
  description?: string;
};

export type ProjectRecord = {
  id: string;
  name: string;
  kind: ProjectKind;
  rootPath?: string;
  host?: string;
  sshProfile?: string;
  previewUrl?: string;
  color: string;
  pinned?: boolean;
};

export type RemoteServerConfig = {
  id: string;
  name: string;
  host: string;
  sshProfile?: string;
  rootPath?: string;
  previewUrl?: string;
};

export type AppSettings = {
  theme: AppTheme;
  editorFontFamily: string;
  editorFontSize: number;
  editorTheme: EditorTheme;
  terminalFontFamily: string;
  terminalFontSize: number;
  terminalTheme: TerminalThemePreset;
  remoteServers: RemoteServerConfig[];
};

export type WorkspaceTrackState = {
  order: SurfaceId[];
  widths: Record<SurfaceId, SnapWidth>;
  activeSurface: SurfaceId;
  viewportOffset: number;
  controlsVisible?: boolean;
  inspector: {
    visible: boolean;
    dock: "left" | "right";
    mode: InspectorMode;
    width?: number;
  };
};

export type FileEditorTab = {
  kind: "file";
  path: string;
  title: string;
  content: string;
  dirty: boolean;
};

export type GitDiffTab = {
  kind: "git-diff";
  path: string;
  title: string;
  dirty: boolean;
  filePath: string;
  staged: boolean;
  originalContent: string;
  modifiedContent: string;
  originalLabel: string;
  modifiedLabel: string;
};

export type GitHistoryDiffTab = {
  kind: "git-history-diff";
  path: string;
  title: string;
  dirty: false;
  filePath: string;
  commitHash: string;
  originalContent: string;
  modifiedContent: string;
  originalLabel: string;
  modifiedLabel: string;
};

export type GitCommitTab = {
  kind: "git-commit";
  path: string;
  title: string;
  content: string;
  dirty: false;
  commitHash: string;
  changedFiles: Array<{
    path: string;
    status: string;
  }>;
};

export type GitCompareTab = {
  kind: "git-compare";
  path: string;
  title: string;
  content: string;
  dirty: false;
  baseRef: string;
  targetRef: string;
  changedFiles: Array<{
    path: string;
    status: string;
  }>;
};

export type EditorTab = FileEditorTab | GitDiffTab | GitHistoryDiffTab | GitCommitTab | GitCompareTab;

export type TerminalEntry = {
  id: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  ranAt: number;
};

export type TerminalPane = {
  id: string;
};

export type TerminalSplitLeaf = {
  id: string;
  type: "pane";
  paneId: string;
};

export type TerminalSplitBranch = {
  id: string;
  type: "split";
  direction: "horizontal" | "vertical";
  children: TerminalSplitNode[];
};

export type TerminalSplitNode = TerminalSplitLeaf | TerminalSplitBranch;

export type TerminalTab = {
  id: string;
  title: string;
  root: TerminalSplitNode;
  activePaneId: string;
};

export type TerminalSessionInfo = {
  sessionId: string;
  cwd: string;
  projectId: string;
  initialBuffer?: string;
};

export type TerminalSessionSnapshot = {
  buffer: string;
  exitCode?: number | null;
};

export type GitSummary = {
  branch: string;
  ahead?: number;
  behind?: number;
  changedFiles: number;
  stagedFiles: number;
  clean: boolean;
};

export type FileNode = {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
};

export type GitChangedFile = {
  path: string;
  indexStatus: string;
  workTreeStatus: string;
  staged: boolean;
};

export type GitRepositoryInfo = {
  rootPath: string;
  name: string;
  relativePath: string;
  isRoot: boolean;
};

export type GitDetails = GitSummary & {
  repoRootPath: string;
  repoDisplayPath: string;
  files: GitChangedFile[];
};

export type GitBranchInfo = {
  name: string;
  current: boolean;
};

export type GitWorktreeInfo = {
  path: string;
  branch?: string;
  bare: boolean;
  detached: boolean;
  locked: boolean;
  prunable: boolean;
  isCurrent: boolean;
};

export type GitGraphEntry = {
  id: string;
  graph: string;
  shortHash?: string;
  subject?: string;
  refs?: string[];
  author?: string;
  relativeDate?: string;
  current?: boolean;
};

export type GitDiffContent = {
  filePath: string;
  staged: boolean;
  originalContent: string;
  modifiedContent: string;
  originalLabel: string;
  modifiedLabel: string;
};

export type GitCommitDetails = {
  commitHash: string;
  shortHash: string;
  title: string;
  content: string;
  changedFiles: Array<{
    path: string;
    status: string;
  }>;
};

export type GitCommitFileDiffContent = {
  commitHash: string;
  filePath: string;
  originalContent: string;
  modifiedContent: string;
  originalLabel: string;
  modifiedLabel: string;
};

export type GitCompareDetails = {
  baseRef: string;
  targetRef: string;
  title: string;
  content: string;
  changedFiles: Array<{
    path: string;
    status: string;
  }>;
};

export type SearchMatch = {
  path: string;
  line: number;
  column: number;
  text: string;
  matchText?: string;
};

export type SearchQueryOptions = {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
  includeGlob?: string;
  excludeGlob?: string;
};

export type EditorRevealTarget = {
  path: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  query?: string;
};

export type BrowserSurfaceBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BrowserViewState = {
  url: string;
  title: string;
  faviconUrl?: string;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
};

export type BrowserTab = {
  id: string;
  url: string;
  title: string;
  faviconUrl?: string;
};

export type PortForwardInfo = {
  projectId: string;
  remoteHost: string;
  remotePort: number;
  localPort: number;
  localUrl: string;
  active: boolean;
};

export type ProjectWorkspace = {
  track: WorkspaceTrackState;
  openTabs: EditorTab[];
  activeTabPath?: string;
  editorRevealTarget?: EditorRevealTarget;
  codeTabs: CodeTab[];
  activeCodeTabId?: string;
  terminalTabs: TerminalTab[];
  activeTerminalTabId?: string;
  browserUrl?: string;
  browserTabs: BrowserTab[];
  activeBrowserTabId?: string;
  activeCommand?: string;
  git?: GitDetails;
  gitRepositories?: GitRepositoryInfo[];
  selectedGitRepoPath?: string;
  portForward?: PortForwardInfo;
};

export type AppStateSnapshot = {
  projects: ProjectRecord[];
  selectedProjectId?: string;
  workspaces: Record<string, ProjectWorkspace>;
  projectRailCollapsed: boolean;
  settings?: AppSettings;
};

export type ShellCommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export type NaEditorApi = {
  loadState: () => Promise<AppStateSnapshot | null>;
  saveState: (snapshot: AppStateSnapshot) => Promise<void>;
  openProjectDirectory: () => Promise<ProjectRecord | null>;
  readDirectory: (project: ProjectRecord, rootPath: string) => Promise<FileNode[]>;
  readFile: (project: ProjectRecord, path: string) => Promise<string>;
  writeFile: (project: ProjectRecord, path: string, content: string) => Promise<void>;
  searchProject: (project: ProjectRecord, query: string, options?: SearchQueryOptions) => Promise<SearchMatch[]>;
  listGitRepositories: (project: ProjectRecord) => Promise<GitRepositoryInfo[]>;
  getGitDetails: (project: ProjectRecord, repoRootPath?: string) => Promise<GitDetails | null>;
  initGit: (project: ProjectRecord, repoRootPath?: string) => Promise<ShellCommandResult>;
  listGitBranches: (project: ProjectRecord, repoRootPath?: string) => Promise<GitBranchInfo[]>;
  listGitWorktrees: (project: ProjectRecord, repoRootPath?: string) => Promise<GitWorktreeInfo[]>;
  listGitGraph: (project: ProjectRecord, repoRootPath?: string) => Promise<GitGraphEntry[]>;
  stageGitFile: (project: ProjectRecord, filePath: string, repoRootPath?: string) => Promise<ShellCommandResult>;
  stageAllGitFiles: (project: ProjectRecord, repoRootPath?: string) => Promise<ShellCommandResult>;
  unstageGitFile: (project: ProjectRecord, filePath: string, repoRootPath?: string) => Promise<ShellCommandResult>;
  unstageAllGitFiles: (project: ProjectRecord, repoRootPath?: string) => Promise<ShellCommandResult>;
  discardAllGitFiles: (project: ProjectRecord, repoRootPath?: string) => Promise<ShellCommandResult>;
  discardGitFile: (project: ProjectRecord, filePath: string, repoRootPath?: string) => Promise<ShellCommandResult>;
  getGitDiff: (project: ProjectRecord, filePath: string, staged: boolean, repoRootPath?: string) => Promise<string>;
  getGitDiffContent: (project: ProjectRecord, filePath: string, staged: boolean, repoRootPath?: string) => Promise<GitDiffContent>;
  getGitCommitDetails: (project: ProjectRecord, commitHash: string, repoRootPath?: string) => Promise<GitCommitDetails>;
  getGitCommitFileDiffContent: (
    project: ProjectRecord,
    commitHash: string,
    filePath: string,
    repoRootPath?: string
  ) => Promise<GitCommitFileDiffContent>;
  getGitCompareDetails: (project: ProjectRecord, baseRef: string, targetRef: string, repoRootPath?: string) => Promise<GitCompareDetails>;
  commitGit: (project: ProjectRecord, message: string, repoRootPath?: string) => Promise<ShellCommandResult>;
  checkoutGitBranch: (project: ProjectRecord, branchName: string, repoRootPath?: string) => Promise<ShellCommandResult>;
  createGitBranch: (project: ProjectRecord, branchName: string, repoRootPath?: string) => Promise<ShellCommandResult>;
  fetchGit: (project: ProjectRecord, repoRootPath?: string) => Promise<ShellCommandResult>;
  pullGit: (project: ProjectRecord, repoRootPath?: string) => Promise<ShellCommandResult>;
  pushGit: (project: ProjectRecord, repoRootPath?: string) => Promise<ShellCommandResult>;
  createTerminalSession: (projectId: string, project: ProjectRecord) => Promise<TerminalSessionInfo>;
  getTerminalSnapshot: (sessionId: string) => Promise<TerminalSessionSnapshot | null>;
  writeTerminal: (sessionId: string, data: string) => Promise<void>;
  resizeTerminal: (sessionId: string, cols: number, rows: number) => Promise<void>;
  closeTerminal: (sessionId: string) => Promise<void>;
  onTerminalData: (listener: (payload: { sessionId: string; data: string }) => void) => () => void;
  onTerminalExit: (listener: (payload: { sessionId: string; exitCode: number }) => void) => () => void;
  syncBrowserView: (payload: {
    projectId: string;
    url: string;
    bounds: BrowserSurfaceBounds;
    visible: boolean;
  }) => Promise<void>;
  hideBrowserView: (projectId: string) => Promise<void>;
  browserCommand: (projectId: string, command: "back" | "forward" | "reload" | "devtools" | "open-external") => Promise<void>;
  openExternalUrl: (url: string) => Promise<void>;
  onBrowserState: (listener: (payload: { projectId: string; state: BrowserViewState }) => void) => () => void;
  ensurePortForward: (project: ProjectRecord, remoteUrl: string) => Promise<PortForwardInfo | null>;
  stopPortForward: (projectId: string) => Promise<void>;
  runCommand: (cwd: string, command: string) => Promise<ShellCommandResult>;
  onAppCommand: (listener: (command: AppCommand) => void) => () => void;
};

declare global {
  interface Window {
    naeditor: NaEditorApi;
  }
}
