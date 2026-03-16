import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  CaseSensitive,
  ChevronRight,
  Check,
  FileDiff,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  GitBranch,
  GitCommitVertical,
  GitCommitHorizontal,
  GitPullRequestArrow,
  GitPullRequestCreateArrow,
  ListFilter,
  Minus,
  PenLine,
  Plus,
  RefreshCw,
  Regex,
  Search,
  Trash2,
  Undo2,
  WholeWord,
  X
} from "lucide-react";
import type {
  FileNode,
  GitBranchInfo,
  GitCommitDetails,
  GitGraphEntry,
  InspectorMode,
  ProjectRecord,
  ProjectWorkspace,
  SearchQueryOptions,
  SearchMatch,
  ShellCommandResult
} from "@shared/types";
import { getFileVisual } from "@renderer/lib/fileVisuals";

const inspectorModes: InspectorMode[] = ["files", "git", "search", "branches", "comments", "remote", "problems"];

type InspectorProps = {
  project?: ProjectRecord;
  workspace?: ProjectWorkspace;
  directoryEntries: FileNode[];
  onModeChange: (mode: InspectorMode) => void;
  onOpenFile: (path: string) => void;
  onOpenGitDiff: (path: string, staged: boolean) => void;
  onOpenGitCommit: (commitHash: string) => void;
  onOpenGitCommitFileDiff: (commitHash: string, filePath: string) => void;
  getGitCommitDetails: (commitHash: string) => Promise<GitCommitDetails | null>;
  onOpenGitCompare: (baseRef: string, targetRef: string) => void;
  onOpenSearchResult: (match: SearchMatch, query?: string) => void;
  ensureDirectory: (rootPath: string) => Promise<void>;
  onSearchProject: (projectId: string, query: string, options?: SearchQueryOptions) => Promise<SearchMatch[]>;
  onInitGit: (projectId: string) => Promise<ShellCommandResult | null>;
  listGitRepositories: (projectId: string) => Promise<NonNullable<ProjectWorkspace["gitRepositories"]>>;
  onSelectGitRepository: (projectId: string, repoRootPath: string) => Promise<void>;
  listGitBranches: (projectId: string) => Promise<GitBranchInfo[]>;
  listGitGraph: (projectId: string) => Promise<GitGraphEntry[]>;
  onStageGitFile: (projectId: string, filePath: string) => Promise<ShellCommandResult | null>;
  onStageAllGitFiles: (projectId: string) => Promise<ShellCommandResult | null>;
  onUnstageGitFile: (projectId: string, filePath: string) => Promise<ShellCommandResult | null>;
  onUnstageAllGitFiles: (projectId: string) => Promise<ShellCommandResult | null>;
  onDiscardAllGitFiles: (projectId: string) => Promise<ShellCommandResult | null>;
  onDiscardGitFile: (projectId: string, filePath: string) => Promise<ShellCommandResult | null>;
  onCommitGit: (projectId: string, message: string) => Promise<ShellCommandResult | null>;
  onCheckoutGitBranch: (projectId: string, branchName: string) => Promise<ShellCommandResult | null>;
  onCreateGitBranch: (projectId: string, branchName: string) => Promise<ShellCommandResult | null>;
  onFetchGit: (projectId: string) => Promise<ShellCommandResult | null>;
  onPullGit: (projectId: string) => Promise<ShellCommandResult | null>;
  onPushGit: (projectId: string) => Promise<ShellCommandResult | null>;
  onRefreshGit: (projectId: string) => Promise<void>;
};

export function Inspector({
  project,
  workspace,
  directoryEntries,
  onModeChange,
  onOpenFile,
  onOpenGitDiff,
  onOpenGitCommit,
  onOpenGitCommitFileDiff,
  getGitCommitDetails,
  onOpenGitCompare,
  onOpenSearchResult,
  ensureDirectory,
  onSearchProject,
  onInitGit,
  listGitRepositories,
  onSelectGitRepository,
  listGitBranches,
  listGitGraph,
  onStageGitFile,
  onStageAllGitFiles,
  onUnstageGitFile,
  onUnstageAllGitFiles,
  onDiscardAllGitFiles,
  onDiscardGitFile,
  onCommitGit,
  onCheckoutGitBranch,
  onCreateGitBranch,
  onFetchGit,
  onPullGit,
  onPushGit,
  onRefreshGit
}: InspectorProps) {
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({});
  const [branches, setBranches] = useState<GitBranchInfo[]>([]);
  const [gitGraph, setGitGraph] = useState<GitGraphEntry[]>([]);
  const [commitMessage, setCommitMessage] = useState("");
  const [newBranchName, setNewBranchName] = useState("");
  const [gitOutput, setGitOutput] = useState("");
  const [gitBusy, setGitBusy] = useState(false);
  const [gitAction, setGitAction] = useState<"refresh" | "fetch" | "pull" | "push" | null>(null);
  const [gitMetaLoading, setGitMetaLoading] = useState(false);
  const [pendingGitRepoPath, setPendingGitRepoPath] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchMatch[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchOptions, setSearchOptions] = useState<SearchQueryOptions>({
    caseSensitive: false,
    wholeWord: false,
    regex: false,
    includeGlob: "",
    excludeGlob: "node_modules,.git,dist,.next"
  });
  const [searchFiltersVisible, setSearchFiltersVisible] = useState(false);
  const [inputModal, setInputModal] = useState<{
    type: "newFile" | "newFolder" | "rename";
    defaultValue?: string;
    dirPath: string;
    nodePath?: string;
  } | null>(null);

  const handleContextMenuAction = async (action: string, data: Record<string, unknown>) => {
    console.log("[renderer] handleContextMenuAction:", action, data);
    if (!project || !project.rootPath) return;

    switch (action) {
      case "newFile": {
        console.log("[renderer] newFile dirPath:", data.dirPath);
        setInputModal({ type: "newFile", dirPath: data.dirPath as string });
        break;
      }
      case "newFolder": {
        console.log("[renderer] newFolder dirPath:", data.dirPath);
        setInputModal({ type: "newFolder", dirPath: data.dirPath as string });
        break;
      }
      case "rename": {
        console.log("[renderer] rename:", data.filePath, "dirPath:", data.dirPath);
        setInputModal({ 
          type: "rename", 
          defaultValue: data.fileName as string, 
          dirPath: data.dirPath as string,
          nodePath: data.filePath as string 
        });
        break;
      }
      case "delete": {
        console.log("[renderer] delete:", data.filePath, "isDirectory:", data.isDirectory);
        const confirmed = confirm(`Delete "${data.filePath}"?`);
        if (!confirmed) return;
        try {
          await window.naeditor.deletePath(project, data.filePath as string, data.isDirectory as boolean);
          await ensureDirectory(project.rootPath, true);
        } catch (err) {
          console.error("Failed to delete:", err);
        }
        break;
      }
      case "reveal": {
        await window.naeditor.revealInFinder(project, data.filePath as string);
        break;
      }
    }
  };

  const handleInputSubmit = async (value: string) => {
    if (!project || !project.rootPath || !inputModal) return;
    
    const dirPath = inputModal.dirPath;
    console.log("[renderer] handleInputSubmit:", inputModal.type, "dirPath:", dirPath, "value:", value);
    
    try {
      if (inputModal.type === "newFile") {
        console.log("[renderer] Calling createFile with:", project, dirPath, value);
        await window.naeditor.createFile(project, dirPath, value);
      } else if (inputModal.type === "newFolder") {
        console.log("[renderer] Calling createDirectory with:", project, dirPath, value);
        await window.naeditor.createDirectory(project, dirPath, value);
      } else if (inputModal.type === "rename" && inputModal.nodePath) {
        const oldPath = inputModal.nodePath;
        const parentDir = oldPath.substring(0, oldPath.lastIndexOf("/"));
        const newPath = parentDir ? `${parentDir}/${value}` : value;
        await window.naeditor.renamePath(project, oldPath, newPath);
      }
      await ensureDirectory(project.rootPath, true);
    } catch (err) {
      console.error("Operation failed:", err);
    }
    
    setInputModal(null);
  };

  const runSearch = async (nextQuery = searchQuery) => {
    if (!project) {
      return;
    }

    const trimmedQuery = nextQuery.trim();
    if (!trimmedQuery) {
      setSearchResults([]);
      return;
    }

    setSearchBusy(true);
    try {
      const results = await onSearchProject(project.id, trimmedQuery, searchOptions);
      setSearchResults(results);
    } finally {
      setSearchBusy(false);
    }
  };

  useEffect(() => {
    if (project?.rootPath && workspace?.track.inspector.mode === "files") {
      void ensureDirectory(project.rootPath);
      if (project.id && project.rootPath) {
        void window.naeditor.startFileWatch(project.id, project.rootPath);
      }
    }
  }, [ensureDirectory, project?.rootPath, workspace?.track.inspector.mode]);

  useEffect(() => {
    if (!project?.rootPath || !project.id) {
      return;
    }

    const handleFileChange = () => {
      void ensureDirectory(project.rootPath!);
    };

    const unsubscribe = window.naeditor.onFileChange((payload) => {
      if (payload.projectId === project.id) {
        handleFileChange();
      }
    });

    return () => {
      void window.naeditor.stopFileWatch(project.id, project.rootPath!);
      unsubscribe();
    };
  }, [project?.id, project?.rootPath, ensureDirectory]);

  useEffect(() => {
    if (project?.rootPath) {
      setExpandedPaths({ [project.rootPath]: true });
    }
  }, [project?.rootPath]);

  useEffect(() => {
    if (!project || (workspace?.track.inspector.mode !== "git" && workspace?.track.inspector.mode !== "branches")) {
      return;
    }

    setGitMetaLoading(true);
    void Promise.all([
      listGitRepositories(project.id),
      listGitBranches(project.id),
      listGitGraph(project.id)
    ])
      .then(([_repos, nextBranches, nextGraph]) => {
        setBranches(nextBranches);
        setGitGraph(nextGraph);
      })
      .finally(() => setGitMetaLoading(false));
  }, [listGitBranches, listGitGraph, listGitRepositories, project, workspace?.track.inspector.mode, workspace?.git?.branch, workspace?.selectedGitRepoPath]);

  useEffect(() => {
    if (!project?.rootPath || !project.id || !onRefreshGit) {
      return;
    }

    if (workspace?.track.inspector.mode !== "git" && workspace?.track.inspector.mode !== "branches") {
      return;
    }

    const unsubscribe = window.naeditor.onFileChange((payload) => {
      if (payload.projectId === project.id) {
        void onRefreshGit(project.id);
      }
    });

    return () => unsubscribe();
  }, [project?.id, project?.rootPath, onRefreshGit, workspace?.track.inspector.mode]);

  useEffect(() => {
    if (!pendingGitRepoPath) {
      return;
    }

    if (workspace.git?.repoRootPath === pendingGitRepoPath) {
      setPendingGitRepoPath(null);
      setGitMetaLoading(false);
    }
  }, [pendingGitRepoPath, workspace.git?.repoRootPath]);

  useEffect(() => {
    if (workspace?.track.inspector.mode !== "search") {
      return;
    }

    setSearchResults([]);
  }, [project?.id, workspace?.track.inspector.mode]);

  const changedFiles = useMemo(() => workspace?.git?.files ?? [], [workspace?.git?.files]);
  const stagedFiles = useMemo(() => changedFiles.filter((file) => file.staged), [changedFiles]);
  const unstagedFiles = useMemo(() => changedFiles.filter((file) => !file.staged), [changedFiles]);
  const gitRepositories = workspace.gitRepositories ?? [];
  const selectedGitRepoPath = workspace.selectedGitRepoPath;
  const selectedGitRepo = gitRepositories.find((repo) => repo.rootPath === selectedGitRepoPath);
  const isGitRepoSwitching =
    !!selectedGitRepoPath &&
    (pendingGitRepoPath === selectedGitRepoPath || workspace.git?.repoRootPath !== selectedGitRepoPath);
  const showGitLoadingState = gitMetaLoading || isGitRepoSwitching;
  const groupedSearchResults = useMemo(() => {
    const grouped = new Map<string, SearchMatch[]>();
    for (const result of searchResults) {
      const current = grouped.get(result.path) ?? [];
      current.push(result);
      grouped.set(result.path, current);
    }
    return Array.from(grouped.entries());
  }, [searchResults]);

  if (!project || !workspace) {
    return null;
  }

  return (
    <section className="inspector">
      <div className="inspector__content">
        {workspace.track.inspector.mode === "files" && (
          <div className="inspector__panel">
            {project?.rootPath && (
              <div className="inspector__heading-row file-explorer__header">
                <div className="inspector__heading file-explorer__title">
                  {project.rootPath.split(/[/\\]/).pop()}
                </div>
                <button
                  className="ghost-button file-explorer__refresh"
                  onClick={() => project.rootPath && void ensureDirectory(project.rootPath)}
                  title="Refresh"
                >
                  <RefreshCw size={14} strokeWidth={2} />
                </button>
              </div>
            )}
            {directoryEntries.length === 0 ? (
              <p className="muted">No directory entries loaded yet.</p>
            ) : (
              <div className="file-tree">
                {directoryEntries.map((entry) => (
                  <FileTreeNode
                    key={entry.path}
                    node={entry}
                    depth={0}
                    expandedPaths={expandedPaths}
                    onToggle={(targetPath) =>
                      setExpandedPaths((current) => ({
                        ...current,
                        [targetPath]: !current[targetPath]
                      }))
                    }
                    onOpenFile={onOpenFile}
                    onContextMenu={async (e, node) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const isDirectory = node.type === "directory";
                      const dirPath = isDirectory ? node.path : node.path.substring(0, node.path.lastIndexOf("/"));
                      const result = await window.naeditor.showContextMenu({
                        filePath: node.path,
                        fileName: node.name,
                        isDirectory,
                        dirPath,
                        projectId: project.id,
                        projectRootPath: project.rootPath || ""
                      });
                      if (result.action !== "cancel") {
                        handleContextMenuAction(result.action, result);
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {inputModal && createPortal(
          <div className="modal-backdrop" onClick={() => setInputModal(null)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-card__header">
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  {inputModal.type === "newFile" ? (
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center",
                      width: "40px",
                      height: "40px",
                      borderRadius: "12px",
                      background: "color-mix(in srgb, var(--color-accent) 15%, transparent)",
                      color: "var(--color-accent)"
                    }}>
                      <FilePlus size={20} strokeWidth={2} />
                    </div>
                  ) : inputModal.type === "newFolder" ? (
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center",
                      width: "40px",
                      height: "40px",
                      borderRadius: "12px",
                      background: "color-mix(in srgb, var(--color-accent) 15%, transparent)",
                      color: "var(--color-accent)"
                    }}>
                      <FolderPlus size={20} strokeWidth={2} />
                    </div>
                  ) : (
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center",
                      width: "40px",
                      height: "40px",
                      borderRadius: "12px",
                      background: "color-mix(in srgb, var(--color-accent) 15%, transparent)",
                      color: "var(--color-accent)"
                    }}>
                      <PenLine size={20} strokeWidth={2} />
                    </div>
                  )}
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "var(--color-text-strong)" }}>
                    {inputModal.type === "newFile" ? "Create New File" : inputModal.type === "newFolder" ? "Create New Folder" : "Rename"}
                  </h3>
                </div>
                <button className="dialog-close-button" onClick={() => setInputModal(null)}>
                  <X size={16} strokeWidth={2} />
                </button>
              </div>
              <form className="modal-form" onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.querySelector("input");
                if (input?.value.trim()) {
                  handleInputSubmit(input.value);
                }
              }}>
                <div className="field">
                  <label style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text-muted)" }}>
                    {inputModal.type === "newFile" ? "File name" : inputModal.type === "newFolder" ? "Folder name" : "New name"}
                  </label>
                  <input
                    autoFocus
                    type="text"
                    defaultValue={inputModal.defaultValue}
                    placeholder={
                      inputModal.type === "newFile" 
                        ? "example.txt" 
                        : inputModal.type === "newFolder" 
                        ? "folder-name" 
                        : "new-name"
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setInputModal(null);
                      }
                    }}
                    style={{ fontSize: "14px" }}
                  />
                  {inputModal.dirPath && (
                    <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "-4px" }}>
                      {inputModal.type === "rename" 
                        ? `Renaming in: ${inputModal.dirPath}`
                        : `Creating in: ${inputModal.dirPath}`
                      }
                    </div>
                  )}
                </div>
                <div className="modal-card__actions">
                  <button type="button" className="ghost-button" onClick={() => setInputModal(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-button">
                    {inputModal.type === "rename" ? "Rename" : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {workspace.track.inspector.mode === "git" && (
          <div className="inspector__panel inspector__panel--git">
            <div className="inspector__heading-row">
              <div className="inspector__heading">Source Control</div>
              <button className="ghost-button inspector-link" onClick={() => onModeChange("branches")}>
                Branches
              </button>
            </div>
            {gitRepositories.length > 0 ? (
              <label className="git-repo-selector">
                <div className="git-repo-selector__topline">
                  <span className="git-repo-selector__label">Repository</span>
                  {gitMetaLoading ? (
                    <span className="git-loading-pill">
                      <RefreshCw size={11} strokeWidth={2} />
                      Loading
                    </span>
                  ) : null}
                </div>
                <select
                  className="git-repo-selector__select"
                  value={selectedGitRepoPath ?? ""}
                  disabled={gitMetaLoading || gitBusy}
                  onChange={(event) => {
                    const nextRepoPath = event.target.value;
                    setPendingGitRepoPath(nextRepoPath);
                    setGitMetaLoading(true);
                    void onSelectGitRepository(project.id, nextRepoPath);
                  }}
                >
                  {gitRepositories.map((repo) => (
                    <option key={repo.rootPath} value={repo.rootPath}>
                      {formatGitRepositoryLabel(repo.relativePath)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {showGitLoadingState ? (
              <div className="git-empty-state git-empty-state--loading">
                <div className="git-loading-state">
                  <RefreshCw size={14} strokeWidth={2} />
                  <span>Loading repository status…</span>
                </div>
              </div>
            ) : workspace.git ? (
              <>
                <div className="git-summary-card">
                  <div className="git-summary-card__row">
                    <div className="git-summary-card__identity">
                      <div className="git-summary-card__branch">
                        <GitBranch size={13} strokeWidth={2} />
                        <span className="git-summary-card__branch-name">{workspace.git.branch}</span>
                      </div>
                      {selectedGitRepo ? (
                        <div className="git-summary-card__repo">
                          {formatGitRepositoryLabel(selectedGitRepo.relativePath)}
                        </div>
                      ) : null}
                      <div className="git-summary-card__sync">
                        <span>↑ {workspace.git.ahead ?? 0}</span>
                        <span>↓ {workspace.git.behind ?? 0}</span>
                      </div>
                    </div>
                    <div className="git-summary-card__controls">
                      <div className="git-toolbar git-toolbar--summary">
                        <button
                          className={gitAction === "fetch" ? "ghost-button git-icon-action git-icon-action--running" : "ghost-button git-icon-action"}
                          title="Fetch"
                          disabled={gitBusy || gitMetaLoading}
                          onClick={async () => {
                            setGitBusy(true);
                            setGitAction("fetch");
                            const result = await onFetchGit(project.id);
                            setGitBusy(false);
                            setGitAction(null);
                            setGitOutput(formatGitResult(result, { hideSuccessOutput: true }));
                          }}
                        >
                          <RefreshCw size={13} strokeWidth={2} />
                        </button>
                        <button
                          className={gitAction === "pull" ? "ghost-button git-icon-action git-icon-action--running" : "ghost-button git-icon-action"}
                          title="Pull"
                          disabled={gitBusy || gitMetaLoading}
                          onClick={async () => {
                            setGitBusy(true);
                            setGitAction("pull");
                            const result = await onPullGit(project.id);
                            setGitBusy(false);
                            setGitAction(null);
                            setGitOutput(formatGitResult(result, { hideSuccessOutput: true }));
                          }}
                        >
                          <GitPullRequestArrow size={13} strokeWidth={2} />
                        </button>
                        <button
                          className={gitAction === "push" ? "ghost-button git-icon-action git-icon-action--running" : "ghost-button git-icon-action"}
                          title="Push"
                          disabled={gitBusy || gitMetaLoading}
                          onClick={async () => {
                            setGitBusy(true);
                            setGitAction("push");
                            const result = await onPushGit(project.id);
                            setGitBusy(false);
                            setGitAction(null);
                            setGitOutput(formatGitResult(result, { hideSuccessOutput: true }));
                          }}
                        >
                          <GitPullRequestCreateArrow size={13} strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="git-compose">
                  <div className="git-compose__header">
                    <span className="git-compose__title">Commit</span>
                  </div>
                  <textarea
                    className="git-commit-input"
                    value={commitMessage}
                    onChange={(event) => setCommitMessage(event.target.value)}
                    placeholder="Message"
                  />
                  <div className="git-compose__actions">
                    <button
                      className="primary-button"
                      disabled={gitBusy || gitMetaLoading || !commitMessage.trim()}
                      onClick={async () => {
                        setGitBusy(true);
                        const result = await onCommitGit(project.id, commitMessage.trim());
                        setGitBusy(false);
                        setGitOutput(formatGitResult(result));
                        if (result?.exitCode === 0) {
                          setCommitMessage("");
                        }
                      }}
                    >
                      <GitCommitHorizontal size={14} strokeWidth={2} />
                      Commit
                    </button>
                  </div>
                </div>

                {stagedFiles.length > 0 ? (
                  <GitFileSection
                    title="Staged Changes"
                    count={stagedFiles.length}
                    files={stagedFiles}
                    gitBusy={gitBusy}
                    onOpenGitDiff={onOpenGitDiff}
                    onPrimaryAction={async (filePath) => {
                      setGitBusy(true);
                      const result = await onUnstageGitFile(project.id, filePath);
                      setGitBusy(false);
                      setGitOutput(formatGitResult(result));
                    }}
                    onOpenFile={(filePath) => onOpenFile(resolveRepoFilePath(project, workspace.git?.repoRootPath, filePath))}
                    primaryActionLabel="Unstage"
                    primaryActionIcon={<Minus size={13} strokeWidth={2} />}
                  />
                ) : null}

                {unstagedFiles.length > 0 ? (
                  <GitFileSection
                    title="Changes"
                    count={unstagedFiles.length}
                    files={unstagedFiles}
                    gitBusy={gitBusy}
                    onOpenGitDiff={onOpenGitDiff}
                    onPrimaryAction={async (filePath) => {
                      setGitBusy(true);
                      const result = await onStageGitFile(project.id, filePath);
                      setGitBusy(false);
                      setGitOutput(formatGitResult(result));
                    }}
                    onDiscard={async (filePath) => {
                      setGitBusy(true);
                      const result = await onDiscardGitFile(project.id, filePath);
                      setGitBusy(false);
                      setGitOutput(formatGitResult(result));
                    }}
                    headerActions={
                      <div className="git-compose__bulk-actions" role="group" aria-label="Bulk source control actions">
                        <button
                          className="ghost-button git-icon-action"
                          title="Stage all changes"
                          disabled={gitBusy || unstagedFiles.length === 0}
                          onClick={async () => {
                            setGitBusy(true);
                            const result = await onStageAllGitFiles(project.id);
                            setGitBusy(false);
                            setGitOutput(formatGitResult(result));
                          }}
                        >
                          <Plus size={13} strokeWidth={2} />
                        </button>
                        <button
                          className="ghost-button git-icon-action"
                          title="Unstage all changes"
                          disabled={gitBusy || stagedFiles.length === 0}
                          onClick={async () => {
                            setGitBusy(true);
                            const result = await onUnstageAllGitFiles(project.id);
                            setGitBusy(false);
                            setGitOutput(formatGitResult(result));
                          }}
                        >
                          <Minus size={13} strokeWidth={2} />
                        </button>
                        <button
                          className="ghost-button git-icon-action git-inline-action--danger"
                          title="Discard all unstaged changes"
                          disabled={gitBusy || unstagedFiles.length === 0}
                          onClick={async () => {
                            setGitBusy(true);
                            const result = await onDiscardAllGitFiles(project.id);
                            setGitBusy(false);
                            setGitOutput(formatGitResult(result));
                          }}
                        >
                          <Trash2 size={13} strokeWidth={2} />
                        </button>
                      </div>
                    }
                    onOpenFile={(filePath) => onOpenFile(resolveRepoFilePath(project, workspace.git?.repoRootPath, filePath))}
                    primaryActionLabel="Stage"
                    primaryActionIcon={<Plus size={13} strokeWidth={2} />}
                  />
                ) : null}

                {gitGraph.filter((entry) => entry.shortHash).length > 0 ? (
                  <div className="git-history-block">
                    <GitGraphSection
                      title="History"
                      entries={gitGraph.slice(0, 16)}
                      projectId={project.id}
                      gitBusy={gitBusy}
                      onOpenGitCommit={onOpenGitCommit}
                      onOpenGitCommitFileDiff={onOpenGitCommitFileDiff}
                      getGitCommitDetails={getGitCommitDetails}
                      onOpenGitCompare={onOpenGitCompare}
                      onCheckoutGitBranch={onCheckoutGitBranch}
                      onRefresh={async () => {
                        const [nextBranches, nextGraph] = await Promise.all([
                          listGitBranches(project.id),
                          listGitGraph(project.id)
                        ]);
                        setBranches(nextBranches);
                        setGitGraph(nextGraph);
                      }}
                      onGitOutput={setGitOutput}
                      onGitBusyChange={setGitBusy}
                      onSetBranches={setBranches}
                      onSetGraph={setGitGraph}
                      listGitBranches={listGitBranches}
                      listGitGraph={listGitGraph}
                      onOpenFullView={() => onModeChange("branches")}
                      compact
                    />
                  </div>
                ) : null}

                {workspace.git.clean ? <p className="muted">No changes.</p> : null}
                {gitOutput ? <pre className="git-output">{gitOutput}</pre> : null}
              </>
            ) : gitRepositories.length > 0 ? (
              <div className="git-empty-state">
                <p className="muted">
                  Select a repository in this workspace to view Source Control.
                </p>
              </div>
            ) : (
              <div className="git-empty-state">
                <p className="muted">This folder is not a Git repository yet.</p>
                <button
                  className="primary-button"
                  disabled={gitBusy}
                  onClick={async () => {
                    setGitBusy(true);
                    const result = await onInitGit(project.id);
                    setGitBusy(false);
                    setGitOutput(formatGitResult(result));
                  }}
                >
                  Initialize Git Repository
                </button>
                {gitOutput ? <pre className="git-output">{gitOutput}</pre> : null}
              </div>
            )}
          </div>
        )}

        {workspace.track.inspector.mode === "search" && (
          <div className="inspector__panel">
            <div className="inspector__heading">Search</div>
            <div className="search-panel">
              <form
                className="search-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runSearch();
                }}
              >
                <div className="search-query">
                  <Search className="search-query__icon" size={14} strokeWidth={2} />
                  <input
                    className="search-input"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search"
                    spellCheck={false}
                  />
                </div>
                <div className="search-toolbar">
                  <button
                    className={
                      searchOptions.caseSensitive
                        ? "search-toggle search-toggle--active"
                        : "search-toggle"
                    }
                    type="button"
                    title="Match Case"
                    onClick={() =>
                      setSearchOptions((current) => ({ ...current, caseSensitive: !current.caseSensitive }))
                    }
                  >
                    <CaseSensitive size={14} strokeWidth={1.9} />
                  </button>
                  <button
                    className={
                      searchOptions.wholeWord
                        ? "search-toggle search-toggle--active"
                        : "search-toggle"
                    }
                    type="button"
                    title="Match Whole Word"
                    onClick={() =>
                      setSearchOptions((current) => ({ ...current, wholeWord: !current.wholeWord }))
                    }
                  >
                    <WholeWord size={14} strokeWidth={1.9} />
                  </button>
                  <button
                    className={searchOptions.regex ? "search-toggle search-toggle--active" : "search-toggle"}
                    type="button"
                    title="Use Regular Expression"
                    onClick={() => setSearchOptions((current) => ({ ...current, regex: !current.regex }))}
                  >
                    <Regex size={14} strokeWidth={1.9} />
                  </button>
                  <button
                    className={searchFiltersVisible ? "search-toggle search-toggle--active" : "search-toggle"}
                    type="button"
                    title="Toggle Filters"
                    onClick={() => setSearchFiltersVisible((current) => !current)}
                  >
                    <ListFilter size={14} strokeWidth={1.9} />
                  </button>
                  <button className="primary-button search-submit" disabled={searchBusy || !searchQuery.trim()} type="submit">
                    {searchBusy ? "Searching…" : "Find"}
                  </button>
                </div>
              </form>

              {searchFiltersVisible ? (
                <div className="search-filters">
                  <label className="search-filter-field">
                    <span>files to include</span>
                    <input
                      className="search-filter-input"
                      value={searchOptions.includeGlob ?? ""}
                      onChange={(event) =>
                        setSearchOptions((current) => ({ ...current, includeGlob: event.target.value }))
                      }
                      placeholder="src/**"
                      spellCheck={false}
                    />
                  </label>
                  <label className="search-filter-field">
                    <span>files to exclude</span>
                    <input
                      className="search-filter-input"
                      value={searchOptions.excludeGlob ?? ""}
                      onChange={(event) =>
                        setSearchOptions((current) => ({ ...current, excludeGlob: event.target.value }))
                      }
                      placeholder="node_modules,.git,dist"
                      spellCheck={false}
                    />
                  </label>
                </div>
              ) : null}

              {!searchQuery.trim() ? (
                <p className="muted">Search across the current project with ripgrep-backed results.</p>
              ) : searchResults.length === 0 && !searchBusy ? (
                <p className="muted">No matches found for “{searchQuery.trim()}”.</p>
              ) : (
                <div className="search-results">
                  <div className="search-results__summary">
                    {searchBusy ? "Searching…" : `${searchResults.length} results in ${groupedSearchResults.length} files`}
                  </div>
                  {groupedSearchResults.map(([path, matches]) => {
                    const fileVisual = getFileVisual(path);
                    const FileIcon = fileVisual.icon;
                    return (
                      <div key={path} className="search-group">
                        <div className="search-group__header">
                          <FileIcon className={`search-group__icon ${fileVisual.className}`} size={14} strokeWidth={1.9} />
                          <span className="search-group__path">{path}</span>
                          <span className="search-group__count">{matches.length}</span>
                        </div>
                        <div className="search-group__matches">
                          {matches.map((result) => (
                            <button
                              key={`${result.path}:${result.line}:${result.column}:${result.text}`}
                              className="search-result"
                              onClick={() => onOpenSearchResult(result, searchQuery.trim())}
                            >
                              <div className="search-result__gutter">
                                <span>{result.line}</span>
                                <span>{result.column}</span>
                              </div>
                              <div className="search-result__content">
                                <div className="search-result__snippet">{result.text.trim() || "(blank line)"}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
          </div>
        )}

            </div>
          </div>
        )}

        {workspace.track.inspector.mode === "branches" && (
          <div className="inspector__panel inspector__panel--branches">
            <div className="inspector__heading-row">
              <button className="ghost-button inspector-back" onClick={() => onModeChange("git")}>
                <ArrowLeft size={13} strokeWidth={2} />
                <span>Source Control</span>
              </button>
              <div className="inspector__heading">Branches & Graph</div>
            </div>
            {gitRepositories.length > 0 ? (
              <label className="git-repo-selector">
                <div className="git-repo-selector__topline">
                  <span className="git-repo-selector__label">Repository</span>
                  {showGitLoadingState ? (
                    <span className="git-loading-pill">
                      <RefreshCw size={11} strokeWidth={2} />
                      Loading
                    </span>
                  ) : null}
                </div>
                <select
                  className="git-repo-selector__select"
                  value={selectedGitRepoPath ?? ""}
                  disabled={gitMetaLoading || gitBusy}
                  onChange={(event) => {
                    const nextRepoPath = event.target.value;
                    setPendingGitRepoPath(nextRepoPath);
                    setGitMetaLoading(true);
                    void onSelectGitRepository(project.id, nextRepoPath);
                  }}
                >
                  {gitRepositories.map((repo) => (
                    <option key={repo.rootPath} value={repo.rootPath}>
                      {formatGitRepositoryLabel(repo.relativePath)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {showGitLoadingState ? (
              <div className="git-empty-state git-empty-state--loading">
                <div className="git-loading-state">
                  <RefreshCw size={14} strokeWidth={2} />
                  <span>Loading repository history…</span>
                </div>
              </div>
            ) : workspace.git ? (
              <>
                <div className="branch-header">
                  <div className="branch-header__identity">
                    <div className="branch-header__branch">
                      <GitBranch size={14} strokeWidth={2} />
                      <span>{workspace.git.branch}</span>
                    </div>
                    {selectedGitRepo ? (
                      <div className="branch-header__repo">{formatGitRepositoryLabel(selectedGitRepo.relativePath)}</div>
                    ) : null}
                    <div className="branch-header__meta">
                      <span>↑ {workspace.git.ahead ?? 0}</span>
                      <span>↓ {workspace.git.behind ?? 0}</span>
                      <span>{branches.length} branches</span>
                      <span>{gitGraph.filter((entry) => entry.shortHash).length} commits</span>
                    </div>
                  </div>
                  <div className="git-toolbar git-toolbar--summary">
                      <button
                        className={gitAction === "refresh" ? "ghost-button git-icon-action git-icon-action--running" : "ghost-button git-icon-action"}
                        title="Refresh Graph"
                        disabled={gitBusy || gitMetaLoading}
                        onClick={async () => {
                          setGitBusy(true);
                          setGitAction("refresh");
                          setGitMetaLoading(true);
                          const [nextBranches, nextGraph] = await Promise.all([
                            listGitBranches(project.id),
                            listGitGraph(project.id)
                          ]);
                          setGitBusy(false);
                          setGitAction(null);
                          setGitMetaLoading(false);
                          setBranches(nextBranches);
                          setGitGraph(nextGraph);
                        }}
                      >
                        <RefreshCw size={14} strokeWidth={2} />
                      </button>
                      <button
                        className={gitAction === "fetch" ? "ghost-button git-icon-action git-icon-action--running" : "ghost-button git-icon-action"}
                        title="Fetch"
                        disabled={gitBusy || gitMetaLoading}
                        onClick={async () => {
                          setGitBusy(true);
                          setGitAction("fetch");
                          const result = await onFetchGit(project.id);
                          const [nextBranches, nextGraph] = await Promise.all([
                            listGitBranches(project.id),
                            listGitGraph(project.id)
                          ]);
                          setGitBusy(false);
                          setGitAction(null);
                          setGitOutput(formatGitResult(result, { hideSuccessOutput: true }));
                          setBranches(nextBranches);
                          setGitGraph(nextGraph);
                        }}
                      >
                        <GitPullRequestArrow size={14} strokeWidth={2} />
                      </button>
                      <button
                        className={gitAction === "pull" ? "ghost-button git-icon-action git-icon-action--running" : "ghost-button git-icon-action"}
                        title="Pull"
                        disabled={gitBusy || gitMetaLoading}
                        onClick={async () => {
                          setGitBusy(true);
                          setGitAction("pull");
                          const result = await onPullGit(project.id);
                          const [nextBranches, nextGraph] = await Promise.all([
                            listGitBranches(project.id),
                            listGitGraph(project.id)
                          ]);
                          setGitBusy(false);
                          setGitAction(null);
                          setGitOutput(formatGitResult(result, { hideSuccessOutput: true }));
                          setBranches(nextBranches);
                          setGitGraph(nextGraph);
                        }}
                      >
                        <GitPullRequestCreateArrow size={14} strokeWidth={2} />
                      </button>
                      <button
                        className={gitAction === "push" ? "ghost-button git-icon-action git-icon-action--running" : "ghost-button git-icon-action"}
                        title="Push"
                        disabled={gitBusy || gitMetaLoading}
                        onClick={async () => {
                          setGitBusy(true);
                          setGitAction("push");
                          const result = await onPushGit(project.id);
                          const [nextBranches, nextGraph] = await Promise.all([
                            listGitBranches(project.id),
                            listGitGraph(project.id)
                          ]);
                          setGitBusy(false);
                          setGitAction(null);
                          setGitOutput(formatGitResult(result, { hideSuccessOutput: true }));
                          setBranches(nextBranches);
                          setGitGraph(nextGraph);
                        }}
                      >
                        <GitCommitVertical size={14} strokeWidth={2} />
                      </button>
                  </div>
                </div>

                <div className="branch-actions branch-actions--compact">
                  <input
                    className="branch-input"
                    value={newBranchName}
                    onChange={(event) => setNewBranchName(event.target.value)}
                    placeholder="feature/workspace-track"
                  />
                  <button
                    className="primary-button"
                    disabled={gitBusy || gitMetaLoading || !newBranchName.trim()}
                    onClick={async () => {
                      setGitBusy(true);
                      const result = await onCreateGitBranch(project.id, newBranchName.trim());
                      const [nextBranches, nextGraph] = await Promise.all([
                        listGitBranches(project.id),
                        listGitGraph(project.id)
                      ]);
                      setGitBusy(false);
                      setGitOutput(formatGitResult(result));
                      setBranches(nextBranches);
                      setGitGraph(nextGraph);
                      if (result?.exitCode === 0) {
                        setNewBranchName("");
                      }
                    }}
                  >
                    Create Branch
                  </button>
                </div>

                <div className="branch-layout">
                  <div className="branch-list">
                    {branches.map((branch) => (
                      <div key={branch.name} className={branch.current ? "branch-entry branch-entry--current" : "branch-entry"}>
                        <div className="branch-entry__name">
                          {branch.current ? <Check size={12} strokeWidth={2.2} className="branch-entry__check" /> : <span className="branch-dot" />}
                          {branch.name}
                        </div>
                        {!branch.current ? (
                          <button
                            className="ghost-button git-inline-action"
                            disabled={gitBusy || gitMetaLoading}
                            onClick={async () => {
                              setGitBusy(true);
                              const result = await onCheckoutGitBranch(project.id, branch.name);
                              const [nextBranches, nextGraph] = await Promise.all([
                                listGitBranches(project.id),
                                listGitGraph(project.id)
                              ]);
                              setGitBusy(false);
                              setGitOutput(formatGitResult(result));
                              setBranches(nextBranches);
                              setGitGraph(nextGraph);
                            }}
                          >
                            Checkout
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <GitGraphSection
                    title="History"
                    entries={gitGraph}
                    projectId={project.id}
                    gitBusy={gitBusy}
                    onOpenGitCommit={onOpenGitCommit}
                    onOpenGitCommitFileDiff={onOpenGitCommitFileDiff}
                    getGitCommitDetails={getGitCommitDetails}
                    onOpenGitCompare={onOpenGitCompare}
                    onCheckoutGitBranch={onCheckoutGitBranch}
                    onRefresh={async () => {
                      const [nextBranches, nextGraph] = await Promise.all([
                        listGitBranches(project.id),
                        listGitGraph(project.id)
                      ]);
                      setBranches(nextBranches);
                      setGitGraph(nextGraph);
                    }}
                    onGitOutput={setGitOutput}
                    onGitBusyChange={setGitBusy}
                    onSetBranches={setBranches}
                    onSetGraph={setGitGraph}
                    listGitBranches={listGitBranches}
                    listGitGraph={listGitGraph}
                  />
                </div>
                {gitOutput ? <pre className="git-output">{gitOutput}</pre> : null}
              </>
            ) : (
              <p className="muted">Git metadata will appear when the selected project is a repository.</p>
            )}
          </div>
        )}

        {workspace.track.inspector.mode !== "files" &&
          workspace.track.inspector.mode !== "git" &&
          workspace.track.inspector.mode !== "search" &&
          workspace.track.inspector.mode !== "branches" && (
          <div className="inspector__panel">
            <div className="inspector__heading">{workspace.track.inspector.mode}</div>
            <p className="muted">
              This inspector mode is part of the product shell and can be fleshed out as we add richer search,
              review, remote, and diagnostics workflows.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

type GitGraphSectionProps = {
  title: string;
  entries: GitGraphEntry[];
  projectId: string;
  gitBusy: boolean;
  compact?: boolean;
  onOpenGitCommit: (commitHash: string) => void;
  onOpenGitCommitFileDiff: (commitHash: string, filePath: string) => void;
  getGitCommitDetails: (commitHash: string) => Promise<GitCommitDetails | null>;
  onOpenGitCompare: (baseRef: string, targetRef: string) => void;
  onCheckoutGitBranch: (projectId: string, branchName: string) => Promise<ShellCommandResult | null>;
  onRefresh: () => Promise<void>;
  onGitOutput: (text: string) => void;
  onGitBusyChange: (busy: boolean) => void;
  onSetBranches: (branches: GitBranchInfo[]) => void;
  onSetGraph: (graph: GitGraphEntry[]) => void;
  listGitBranches: (projectId: string) => Promise<GitBranchInfo[]>;
  listGitGraph: (projectId: string) => Promise<GitGraphEntry[]>;
  onOpenFullView?: () => void;
};

function GitGraphSection({
  title,
  entries,
  projectId,
  gitBusy,
  compact = false,
  onOpenGitCommit,
  onOpenGitCommitFileDiff,
  getGitCommitDetails,
  onOpenGitCompare,
  onCheckoutGitBranch,
  onRefresh,
  onGitOutput,
  onGitBusyChange,
  onSetBranches,
  onSetGraph,
  listGitBranches,
  listGitGraph,
  onOpenFullView
}: GitGraphSectionProps) {
  const commitEntries = entries.filter((entry) => entry.shortHash);
  const commitCount = commitEntries.length;
  const compareableRefs = Array.from(
    new Set(
      entries
        .flatMap((entry) => entry.refs ?? [])
        .map((ref) => getCheckoutRef(ref))
        .filter((ref): ref is string => Boolean(ref))
    )
  );
  const [baseRef, setBaseRef] = useState(compareableRefs[0] ?? "");
  const [targetRef, setTargetRef] = useState(compareableRefs[1] ?? compareableRefs[0] ?? "");
  const [collapsed, setCollapsed] = useState(compact);
  const [expandedCommitId, setExpandedCommitId] = useState<string | null>(null);
  const [commitDetailsById, setCommitDetailsById] = useState<Record<string, GitCommitDetails>>({});
  const [loadingCommitId, setLoadingCommitId] = useState<string | null>(null);

  const toggleCommit = async (commitHash: string) => {
    if (expandedCommitId === commitHash) {
      setExpandedCommitId(null);
      return;
    }

    setExpandedCommitId(commitHash);
    if (commitDetailsById[commitHash]) {
      return;
    }

    setLoadingCommitId(commitHash);
    const details = await getGitCommitDetails(commitHash);
    setLoadingCommitId((current) => (current === commitHash ? null : current));
    if (!details) {
      return;
    }

    setCommitDetailsById((current) => ({
      ...current,
      [commitHash]: details
    }));
  };

  return (
    <div className="git-graph">
      <button
        className={collapsed ? "git-section__header git-section__header--interactive git-section__header--collapsed" : "git-section__header git-section__header--interactive"}
        onClick={() => setCollapsed((current) => !current)}
      >
        <span className="git-section__title">
          <ChevronRight
            size={13}
            strokeWidth={2}
            className={collapsed ? "git-section__chevron" : "git-section__chevron git-section__chevron--expanded"}
          />
          <span>{title}</span>
        </span>
        <div className="git-section__header-actions">
          <span className="git-section__count">{commitCount}</span>
          {onOpenFullView ? (
            <button
              className="ghost-button git-section__link"
              onClick={(event) => {
                event.stopPropagation();
                onOpenFullView();
              }}
            >
              Full View
            </button>
          ) : null}
        </div>
      </button>
      {!collapsed && !compact && compareableRefs.length > 1 ? (
        <div className="git-compare-bar">
          <select className="git-compare-select" value={baseRef} onChange={(event) => setBaseRef(event.target.value)}>
            {compareableRefs.map((ref) => (
              <option key={`base-${ref}`} value={ref}>
                {ref}
              </option>
            ))}
          </select>
          <span className="git-compare-separator">to</span>
          <select className="git-compare-select" value={targetRef} onChange={(event) => setTargetRef(event.target.value)}>
            {compareableRefs.map((ref) => (
              <option key={`target-${ref}`} value={ref}>
                {ref}
              </option>
            ))}
          </select>
          <button
            className="ghost-button git-inline-action"
            disabled={!baseRef || !targetRef || baseRef === targetRef}
            onClick={() => onOpenGitCompare(baseRef, targetRef)}
          >
            Compare
          </button>
        </div>
      ) : null}
      {!collapsed ? (
      <div className={compact ? "git-graph__list git-graph__list--compact" : "git-graph__list"}>
        {commitEntries.map((entry) => (
            <div
              key={entry.id}
              className={expandedCommitId === entry.id ? "git-graph__item git-graph__item--expanded" : "git-graph__item"}
            >
              <div
                className="git-graph__entry"
                onClick={() => void toggleCommit(entry.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    void toggleCommit(entry.id);
                  }
                }}
              >
                <div className="git-graph__graph">{entry.graph || "*"}</div>
                <div className="git-graph__content">
                  <div className="git-graph__subject-row">
                    <span className="git-graph__subject">{entry.subject}</span>
                    <span className="git-graph__hash">{entry.shortHash}</span>
                  </div>
                  <div className="git-graph__meta">
                    {entry.refs?.length ? (
                      <span className="git-graph__refs">
                        {entry.refs.map((ref) => (
                          <button
                            key={`${entry.id}-${ref}`}
                            type="button"
                            className={entry.current ? "git-ref git-ref--active" : "git-ref"}
                            onClick={async (event) => {
                              event.stopPropagation();
                              const checkoutRef = getCheckoutRef(ref);
                              if (!checkoutRef) {
                                return;
                              }
                              onGitBusyChange(true);
                              const result = await onCheckoutGitBranch(projectId, checkoutRef);
                              const [nextBranches, nextGraph] = await Promise.all([
                                listGitBranches(projectId),
                                listGitGraph(projectId)
                              ]);
                              onGitBusyChange(false);
                              onGitOutput(formatGitResult(result));
                              onSetBranches(nextBranches);
                              onSetGraph(nextGraph);
                            }}
                            disabled={gitBusy}
                          >
                            {ref}
                          </button>
                        ))}
                      </span>
                    ) : null}
                    <span>{entry.author}</span>
                    <span>{entry.relativeDate}</span>
                  </div>
                </div>
              </div>
              {expandedCommitId === entry.id ? (
                <div className="git-graph__expanded">
                  <div className="git-graph__expanded-header">
                    <span className="git-graph__expanded-title">Files</span>
                    <button
                      className="ghost-button git-inline-action"
                      onClick={() => onOpenGitCommit(entry.id)}
                    >
                      Open Patch
                    </button>
                  </div>
                  {loadingCommitId === entry.id && !commitDetailsById[entry.id] ? (
                    <div className="git-graph__expanded-empty">Loading changed files…</div>
                  ) : commitDetailsById[entry.id]?.changedFiles.length ? (
                    <div className="git-graph__files">
                      {commitDetailsById[entry.id].changedFiles.map((file) => (
                        <button
                          key={`${entry.id}:${file.path}`}
                          className="git-graph__file"
                          onClick={() => onOpenGitCommitFileDiff(entry.id, file.path)}
                        >
                          <span className="git-graph__file-status">{file.status}</span>
                          <span className="git-graph__file-path">{file.path}</span>
                          <FileDiff size={13} strokeWidth={2} className="git-graph__file-icon" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="git-graph__expanded-empty">No changed files in this commit.</div>
                  )}
                </div>
              ) : null}
            </div>
        ))}
      </div>
      ) : null}
    </div>
  );
}

type GitFileSectionProps = {
  title: string;
  count: number;
  files: ProjectWorkspace["git"]["files"];
  gitBusy: boolean;
  onOpenGitDiff: (path: string, staged: boolean) => void;
  onOpenFile: (filePath: string) => void;
  onPrimaryAction: (filePath: string) => Promise<void>;
  onDiscard?: (filePath: string) => Promise<void>;
  headerActions?: ReactNode;
  primaryActionLabel: string;
  primaryActionIcon: ReactNode;
};

function GitFileSection({
  title,
  count,
  files,
  gitBusy,
  onOpenGitDiff,
  onOpenFile,
  onPrimaryAction,
  onDiscard,
  headerActions,
  primaryActionLabel,
  primaryActionIcon
}: GitFileSectionProps) {
  return (
    <div className="git-section">
      <div className="git-section__header">
        <span>{title}</span>
        <div className="git-section__header-actions">
          <span className="git-section__count">{count}</span>
          {headerActions}
        </div>
      </div>
      <div className="git-file-list">
        {files.map((file) => (
          <div key={file.path} className="git-file-entry">
            <button className="git-file-entry__open" onClick={() => onOpenGitDiff(file.path, file.staged)}>
              <span className={file.staged ? "git-status git-status--staged" : "git-status"}>
                {`${file.indexStatus}${file.workTreeStatus}`}
              </span>
              <span className="git-file-entry__path">{file.path}</span>
            </button>
            <div className="git-file-entry__actions">
              <button
                className="ghost-button git-icon-action"
                disabled={gitBusy}
                title={primaryActionLabel}
                onClick={() => void onPrimaryAction(file.path)}
              >
                {primaryActionIcon}
              </button>
              <button
                className="ghost-button git-icon-action"
                disabled={gitBusy}
                title="Open File"
                onClick={() => onOpenFile(file.path)}
              >
                <FileText size={13} strokeWidth={2} />
              </button>
              {onDiscard ? (
                <button
                  className="ghost-button git-icon-action git-inline-action--danger"
                  disabled={gitBusy}
                  title="Discard Changes"
                  onClick={() => void onDiscard(file.path)}
                >
                  <Undo2 size={13} strokeWidth={2} />
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatGitResult(result: ShellCommandResult | null, options: { hideSuccessOutput?: boolean } = {}) {
  if (!result) {
    return "No project selected.";
  }

  const output = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");
  if (options.hideSuccessOutput && result.exitCode === 0) {
    return result.stderr.trim();
  }
  if (output) {
    return output;
  }

  return result.exitCode === 0 ? "" : `Exited with ${result.exitCode}`;
}

function formatGitRepositoryLabel(relativePath: string) {
  return relativePath === "." ? "Workspace Root" : relativePath;
}

function resolveRepoFilePath(project: ProjectRecord, repoRootPath: string | undefined, filePath: string) {
  const basePath = repoRootPath || project.rootPath || "";
  if (project.kind === "remote") {
    return `${basePath.replace(/\/$/, "")}/${filePath.replace(/^\.\//, "")}`;
  }
  return `${basePath.replace(/\/$/, "")}/${filePath.replace(/^\.\//, "")}`;
}

function getCheckoutRef(ref: string) {
  const trimmed = ref.trim();
  if (!trimmed || trimmed === "HEAD") {
    return null;
  }
  if (trimmed.startsWith("tag: ")) {
    return null;
  }
  if (trimmed.startsWith("HEAD -> ")) {
    return trimmed.slice("HEAD -> ".length).trim();
  }
  if (trimmed.startsWith("origin/") || trimmed.includes("/HEAD")) {
    return null;
  }
  return trimmed;
}

type FileTreeNodeProps = {
  node: FileNode;
  depth: number;
  expandedPaths: Record<string, boolean>;
  onToggle: (path: string) => void;
  onOpenFile: (path: string) => void;
  onContextMenu?: (e: React.MouseEvent, node: FileNode) => void;
};

function FileTreeNode({ node, depth, expandedPaths, onToggle, onOpenFile, onContextMenu }: FileTreeNodeProps) {
  const isDirectory = node.type === "directory";
  const isExpanded = expandedPaths[node.path] ?? depth < 1;
  const fileVisual = getFileVisual(node.name);
  const TreeIcon = isDirectory ? (isExpanded ? FolderOpen : Folder) : fileVisual.icon;

  return (
    <div>
      <button
        className={isDirectory ? "file-entry file-entry--directory" : "file-entry"}
        style={{ paddingLeft: `${10 + depth * 14}px` }}
        onClick={() => {
          if (isDirectory) {
            onToggle(node.path);
            return;
          }
          onOpenFile(node.path);
        }}
        onContextMenu={(e) => {
          if (onContextMenu) {
            onContextMenu(e, node);
          }
        }}
      >
        <span className="file-entry__lead">
          {isDirectory ? (
            <ChevronRight
              className={isExpanded ? "file-entry__chevron file-entry__chevron--expanded" : "file-entry__chevron"}
              size={11}
              strokeWidth={2}
            />
          ) : (
            <span className="file-entry__chevron-spacer" />
          )}
          <TreeIcon
            className={isDirectory ? "file-entry__icon" : `file-entry__icon ${fileVisual.className}`}
            size={12}
            strokeWidth={2}
          />
        </span>
        <span className="file-entry__label">{node.name}</span>
      </button>

      {isDirectory && isExpanded && node.children?.length
        ? node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
              onOpenFile={onOpenFile}
              onContextMenu={onContextMenu}
            />
          ))
        : null}
    </div>
  );
}
