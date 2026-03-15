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

export type SnapWidth = "1/4" | "1/3" | "1/2" | "2/3" | "3/4" | "1/1";

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
export type CodeThemePreset =
  | "spacecode-dark"
  | "spacecode-light"
  | "github-dark"
  | "github-light"
  | "dracula"
  | "nord"
  | "solarized-dark"
  | "solarized-light"
  | "gruvbox-dark"
  | "hc-black";

export type CodeRuntimeMode = "full-access" | "approval-required";
export type CodeInteractionMode = "default" | "plan";
export type CodeReasoningEffort = "low" | "medium" | "high" | "xhigh";
export type CodeSessionStatus =
  | "idle"
  | "connecting"
  | "ready"
  | "running"
  | "waiting"
  | "error"
  | "closed";

export type CodeAccountInfo = {
  type: "apiKey" | "chatgpt" | "unknown";
  email?: string;
  planType?: string | null;
  requiresOpenaiAuth?: boolean;
};

export type CodeModelOption = {
  id: string;
  model: string;
  displayName: string;
  description: string;
  supportedReasoningEfforts: CodeReasoningEffort[];
  defaultReasoningEffort: CodeReasoningEffort;
  inputModalities: Array<"text" | "image">;
  supportsPersonality: boolean;
  isDefault: boolean;
  upgrade?: string | null;
};

export type CodeAttachment = {
  id: string;
  type: "image";
  path: string;
  name: string;
  mimeType?: string;
  dataUrl?: string;
};

export type CodeQueuedTurn = {
  id: string;
  input?: string;
  attachments: CodeAttachment[];
  model?: string;
  reasoningEffort: CodeReasoningEffort;
  runtimeMode: CodeRuntimeMode;
  interactionMode: CodeInteractionMode;
  createdAt: string;
};

export type CodeTokenUsage = {
  totalTokens: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  modelContextWindow?: number;
};

export type CodeUserInputQuestion = {
  id: string;
  header: string;
  question: string;
  options: Array<{
    label: string;
    description: string;
  }>;
};

export type CodePendingRequest = {
  requestId: string;
  kind: "command" | "file-read" | "file-change" | "user-input";
  title: string;
  detail?: string;
  command?: string;
  questions?: CodeUserInputQuestion[];
};

export type CodeMessage = {
  id: string;
  kind: "user" | "assistant" | "reasoning" | "tool" | "system" | "status";
  title?: string;
  text: string;
  streaming?: boolean;
  createdAt?: string;
  completedAt?: string;
  elapsedMs?: number;
  changedFiles?: Array<{
    path: string;
    status: "added" | "modified" | "deleted" | "renamed" | "copied" | "untracked" | "unknown";
  }>;
  metadata?: Record<string, string>;
};

export type CodeBootstrap = {
  account: CodeAccountInfo;
  models: CodeModelOption[];
};

export type CodeSessionStartInput = {
  sessionId: string;
  project: ProjectRecord;
  cwd: string;
  model?: string;
  reasoningEffort: CodeReasoningEffort;
  runtimeMode: CodeRuntimeMode;
  interactionMode: CodeInteractionMode;
  resumeThreadId?: string;
};

export type CodeTurnInput = {
  sessionId: string;
  input?: string;
  attachments?: CodeAttachment[];
  model?: string;
  reasoningEffort?: CodeReasoningEffort;
  interactionMode?: CodeInteractionMode;
};

export type CodeSessionStartedEvent = {
  type: "session.started";
  sessionId: string;
  threadId: string;
  title?: string;
  cwd: string;
  sessionPath?: string;
  account: CodeAccountInfo;
  models: CodeModelOption[];
  status: CodeSessionStatus;
};

export type CodeSessionStateEvent = {
  type: "session.state";
  sessionId: string;
  status: CodeSessionStatus;
  message?: string;
  threadId?: string;
};

export type CodeTurnStartedEvent = {
  type: "turn.started";
  sessionId: string;
  turnId: string;
};

export type CodeTurnCompletedEvent = {
  type: "turn.completed";
  sessionId: string;
  turnId: string;
  status: "completed" | "failed" | "cancelled" | "interrupted";
  error?: string;
  completedAt?: string;
  elapsedMs?: number;
  changedFiles?: Array<{
    path: string;
    status: "added" | "modified" | "deleted" | "renamed" | "copied" | "untracked" | "unknown";
  }>;
};

export type CodeThreadCompactedEvent = {
  type: "thread.compacted";
  sessionId: string;
  at?: string;
  summary?: string;
};

export type CodeMessageStartedEvent = {
  type: "message.started";
  sessionId: string;
  message: CodeMessage;
};

export type CodeMessageDeltaEvent = {
  type: "message.delta";
  sessionId: string;
  messageId: string;
  delta: string;
};

export type CodeMessageCompletedEvent = {
  type: "message.completed";
  sessionId: string;
  messageId: string;
  text?: string;
};

export type CodePendingRequestOpenedEvent = {
  type: "request.opened";
  sessionId: string;
  request: CodePendingRequest;
};

export type CodePendingRequestResolvedEvent = {
  type: "request.resolved";
  sessionId: string;
  requestId: string;
};

export type CodeTokenUsageEvent = {
  type: "token-usage.updated";
  sessionId: string;
  usage: CodeTokenUsage;
};

export type CodeErrorEvent = {
  type: "error";
  sessionId: string;
  message: string;
};

export type CodeSessionEvent =
  | CodeSessionStartedEvent
  | CodeSessionStateEvent
  | CodeTurnStartedEvent
  | CodeTurnCompletedEvent
  | CodeThreadCompactedEvent
  | CodeMessageStartedEvent
  | CodeMessageDeltaEvent
  | CodeMessageCompletedEvent
  | CodePendingRequestOpenedEvent
  | CodePendingRequestResolvedEvent
  | CodeTokenUsageEvent
  | CodeErrorEvent;

export type CodeTab = {
  id: string;
  title: string;
  description?: string;
  status: CodeSessionStatus;
  threadId?: string;
  cwd?: string;
  sessionPath?: string;
  sessionRuntimeMode?: CodeRuntimeMode;
  account?: CodeAccountInfo;
  availableModels: CodeModelOption[];
  selectedModel?: string;
  reasoningEffort: CodeReasoningEffort;
  runtimeMode: CodeRuntimeMode;
  interactionMode: CodeInteractionMode;
  draft: string;
  attachments: CodeAttachment[];
  queuedTurns: CodeQueuedTurn[];
  messages: CodeMessage[];
  pendingRequest?: CodePendingRequest;
  tokenUsage?: CodeTokenUsage;
  lastError?: string;
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
  codeTheme: CodeThemePreset;
  terminalFontFamily: string;
  terminalFontSize: number;
  terminalTheme: TerminalThemePreset;
  remoteServers: RemoteServerConfig[];
};

export type WorkspaceTrackState = {
  order: SurfaceId[];
  widths: Record<SurfaceId, SnapWidth>;
  visibleSurfaces: Record<SurfaceId, boolean>;
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
  startFileWatch: (projectId: string, rootPath: string) => Promise<boolean>;
  stopFileWatch: (projectId: string, rootPath: string) => Promise<boolean>;
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
  getCodeBootstrap: (project: ProjectRecord, cwd: string) => Promise<CodeBootstrap>;
  startCodeSession: (input: CodeSessionStartInput) => Promise<void>;
  sendCodeTurn: (input: CodeTurnInput) => Promise<void>;
  interruptCodeTurn: (sessionId: string, turnId?: string) => Promise<void>;
  respondToCodeRequest: (
    sessionId: string,
    requestId: string,
    decision: "approved" | "denied",
    answers?: Record<string, string | string[]>
  ) => Promise<void>;
  stopCodeSession: (sessionId: string) => Promise<void>;
  onCodeEvent: (listener: (event: CodeSessionEvent) => void) => () => void;
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
  onFileChange: (listener: (payload: { projectId: string; rootPath: string; event: string; filePath: string }) => void) => () => void;
};

declare global {
  interface Window {
    naeditor: NaEditorApi;
  }
}
