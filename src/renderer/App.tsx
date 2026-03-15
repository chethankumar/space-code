import { useEffect, useMemo, useState } from "react";
import type { AppCommand } from "@shared/types";
import { ProjectRail } from "./components/ProjectRail";
import { TopBar } from "./components/TopBar";
import { Inspector } from "./components/Inspector";
import { WorkspaceTrack } from "./components/WorkspaceTrack";
import { RemoteProjectModal } from "./components/RemoteProjectModal";
import { SettingsDialog } from "./components/SettingsDialog";
import { useAppStore } from "./store/useAppStore";

export function App() {
  const [showRemoteProjectModal, setShowRemoteProjectModal] = useState(false);
  const [browserDevtoolsRequestKey, setBrowserDevtoolsRequestKey] = useState(0);
  const hydrated = useAppStore((state) => state.hydrated);
  const loading = useAppStore((state) => state.loading);
  const settingsDialogOpen = useAppStore((state) => state.settingsDialogOpen);
  const appSettings = useAppStore((state) => state.appSettings);
  const projects = useAppStore((state) => state.projects);
  const selectedProjectId = useAppStore((state) => state.selectedProjectId);
  const workspaces = useAppStore((state) => state.workspaces);
  const projectRailCollapsed = useAppStore((state) => state.projectRailCollapsed);
  const directoryCache = useAppStore((state) => state.directoryCache);
  const hydrate = useAppStore((state) => state.hydrate);
  const openSettingsDialog = useAppStore((state) => state.openSettingsDialog);
  const closeSettingsDialog = useAppStore((state) => state.closeSettingsDialog);
  const updateAppSettings = useAppStore((state) => state.updateAppSettings);
  const upsertRemoteServer = useAppStore((state) => state.upsertRemoteServer);
  const removeRemoteServerConfig = useAppStore((state) => state.removeRemoteServerConfig);
  const addProject = useAppStore((state) => state.addProject);
  const addRemoteProject = useAppStore((state) => state.addRemoteProject);
  const removeProject = useAppStore((state) => state.removeProject);
  const selectProject = useAppStore((state) => state.selectProject);
  const toggleProjectRail = useAppStore((state) => state.toggleProjectRail);
  const toggleInspector = useAppStore((state) => state.toggleInspector);
  const setInspectorMode = useAppStore((state) => state.setInspectorMode);
  const flipInspectorDock = useAppStore((state) => state.flipInspectorDock);
  const setInspectorWidth = useAppStore((state) => state.setInspectorWidth);
  const moveProjectSelection = useAppStore((state) => state.moveProjectSelection);
  const moveTrack = useAppStore((state) => state.moveTrack);
  const anchorSurface = useAppStore((state) => state.anchorSurface);
  const adjustSurfaceWidth = useAppStore((state) => state.adjustSurfaceWidth);
  const setSurfaceWidth = useAppStore((state) => state.setSurfaceWidth);
  const moveSurface = useAppStore((state) => state.moveSurface);
  const toggleTrackControls = useAppStore((state) => state.toggleTrackControls);
  const toggleSurfaceVisibility = useAppStore((state) => state.toggleSurfaceVisibility);
  const ensureDirectory = useAppStore((state) => state.ensureDirectory);
  const searchProject = useAppStore((state) => state.searchProject);
  const openSearchResult = useAppStore((state) => state.openSearchResult);
  const openFile = useAppStore((state) => state.openFile);
  const openGitDiffTab = useAppStore((state) => state.openGitDiffTab);
  const openGitCommitFileDiffTab = useAppStore((state) => state.openGitCommitFileDiffTab);
  const openGitCommitTab = useAppStore((state) => state.openGitCommitTab);
  const getGitCommitDetails = useAppStore((state) => state.getGitCommitDetails);
  const openGitCompareTab = useAppStore((state) => state.openGitCompareTab);
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const closeTab = useAppStore((state) => state.closeTab);
  const closeActiveTab = useAppStore((state) => state.closeActiveTab);
  const updateCurrentFileContent = useAppStore((state) => state.updateCurrentFileContent);
  const saveCurrentFile = useAppStore((state) => state.saveCurrentFile);
  const addCodeTab = useAppStore((state) => state.addCodeTab);
  const selectCodeTab = useAppStore((state) => state.selectCodeTab);
  const closeCodeTab = useAppStore((state) => state.closeCodeTab);
  const closeActiveCodeTab = useAppStore((state) => state.closeActiveCodeTab);
  const ensureCodeBootstrap = useAppStore((state) => state.ensureCodeBootstrap);
  const updateCodeDraft = useAppStore((state) => state.updateCodeDraft);
  const setCodeModel = useAppStore((state) => state.setCodeModel);
  const setCodeReasoningEffort = useAppStore((state) => state.setCodeReasoningEffort);
  const setCodeRuntimeMode = useAppStore((state) => state.setCodeRuntimeMode);
  const setCodeInteractionMode = useAppStore((state) => state.setCodeInteractionMode);
  const addCodeAttachment = useAppStore((state) => state.addCodeAttachment);
  const removeCodeAttachment = useAppStore((state) => state.removeCodeAttachment);
  const removeQueuedCodeTurn = useAppStore((state) => state.removeQueuedCodeTurn);
  const clearQueuedCodeTurns = useAppStore((state) => state.clearQueuedCodeTurns);
  const replaceNextQueuedCodeTurn = useAppStore((state) => state.replaceNextQueuedCodeTurn);
  const submitCodeTurn = useAppStore((state) => state.submitCodeTurn);
  const interruptCodeTurn = useAppStore((state) => state.interruptCodeTurn);
  const respondToCodeRequest = useAppStore((state) => state.respondToCodeRequest);
  const handleCodeEvent = useAppStore((state) => state.handleCodeEvent);
  const setBrowserUrl = useAppStore((state) => state.setBrowserUrl);
  const addBrowserTab = useAppStore((state) => state.addBrowserTab);
  const addTerminalTab = useAppStore((state) => state.addTerminalTab);
  const selectTerminalTab = useAppStore((state) => state.selectTerminalTab);
  const closeTerminalTab = useAppStore((state) => state.closeTerminalTab);
  const closeActiveTerminalTab = useAppStore((state) => state.closeActiveTerminalTab);
  const splitActiveTerminalPane = useAppStore((state) => state.splitActiveTerminalPane);
  const closeActiveTerminalPane = useAppStore((state) => state.closeActiveTerminalPane);
  const focusTerminalPane = useAppStore((state) => state.focusTerminalPane);
  const closeBrowserTab = useAppStore((state) => state.closeBrowserTab);
  const closeActiveBrowserTab = useAppStore((state) => state.closeActiveBrowserTab);
  const selectBrowserTab = useAppStore((state) => state.selectBrowserTab);
  const updateBrowserTabState = useAppStore((state) => state.updateBrowserTabState);
  const setPortForwardInfo = useAppStore((state) => state.setPortForwardInfo);
  const refreshGit = useAppStore((state) => state.refreshGit);
  const listGitRepositories = useAppStore((state) => state.listGitRepositories);
  const selectGitRepository = useAppStore((state) => state.selectGitRepository);
  const initGit = useAppStore((state) => state.initGit);
  const listGitBranches = useAppStore((state) => state.listGitBranches);
  const listGitGraph = useAppStore((state) => state.listGitGraph);
  const stageGitFile = useAppStore((state) => state.stageGitFile);
  const stageAllGitFiles = useAppStore((state) => state.stageAllGitFiles);
  const unstageGitFile = useAppStore((state) => state.unstageGitFile);
  const unstageAllGitFiles = useAppStore((state) => state.unstageAllGitFiles);
  const discardAllGitFiles = useAppStore((state) => state.discardAllGitFiles);
  const discardGitFile = useAppStore((state) => state.discardGitFile);
  const commitGit = useAppStore((state) => state.commitGit);
  const checkoutGitBranch = useAppStore((state) => state.checkoutGitBranch);
  const createGitBranch = useAppStore((state) => state.createGitBranch);
  const fetchGit = useAppStore((state) => state.fetchGit);
  const pullGit = useAppStore((state) => state.pullGit);
  const pushGit = useAppStore((state) => state.pushGit);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!window.naeditor) {
      return;
    }
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolvedTheme = appSettings.theme === "auto" ? (mediaQuery.matches ? "dark" : "light") : appSettings.theme;
      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.dataset.themeMode = appSettings.theme;
    };

    applyTheme();
    if (appSettings.theme !== "auto") {
      return;
    }

    const handleChange = () => applyTheme();
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [appSettings.theme]);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId),
    [projects, selectedProjectId]
  );
  const activeWorkspace = selectedProjectId ? workspaces[selectedProjectId] : undefined;
  const directoryEntries =
    activeProject?.rootPath ? directoryCache[`${activeProject.id}:${activeProject.rootPath}`] ?? [] : [];

  useEffect(() => {
    if (!window.naeditor) {
      return;
    }
    if (activeProject?.rootPath) {
      void refreshGit(activeProject.id);
    }
  }, [activeProject?.id, activeProject?.rootPath, refreshGit]);

  useEffect(() => {
    if (!window.naeditor) {
      return;
    }
    return window.naeditor.onCodeEvent(handleCodeEvent);
  }, [handleCodeEvent]);

  useEffect(() => {
    if (!window.naeditor) {
      return;
    }
    const handleCommand = (command: AppCommand) => {
      switch (command) {
        case "open-project":
          void addProject();
          break;
        case "open-settings":
          openSettingsDialog();
          break;
        case "project-down":
          moveProjectSelection(1);
          break;
        case "project-up":
          moveProjectSelection(-1);
          break;
        case "track-right":
          moveTrack(1);
          break;
        case "track-left":
          moveTrack(-1);
          break;
        case "anchor-editor":
          anchorSurface("editor");
          break;
        case "anchor-terminal":
          anchorSurface("terminal");
          break;
        case "anchor-code":
          anchorSurface("code");
          break;
        case "anchor-browser":
          anchorSurface("browser");
          break;
        case "save-file":
          void saveCurrentFile();
          break;
        case "close-tab":
          if (activeWorkspace?.track.activeSurface === "browser") {
            closeActiveBrowserTab();
          } else if (activeWorkspace?.track.activeSurface === "code") {
            closeActiveCodeTab();
          } else if (activeWorkspace?.track.activeSurface === "terminal") {
            closeActiveTerminalTab();
          } else {
            closeActiveTab();
          }
          break;
        case "new-tab":
          if (activeWorkspace?.track.activeSurface === "code") {
            addCodeTab();
            anchorSurface("code");
          } else if (activeWorkspace?.track.activeSurface === "terminal") {
            addTerminalTab();
            anchorSurface("terminal");
          } else {
            addBrowserTab();
            anchorSurface("browser");
          }
          break;
        case "toggle-browser-devtools":
          anchorSurface("browser");
          setBrowserDevtoolsRequestKey((current) => current + 1);
          break;
        case "split-terminal-vertical":
          anchorSurface("terminal");
          splitActiveTerminalPane("vertical");
          break;
        case "split-terminal-horizontal":
          anchorSurface("terminal");
          splitActiveTerminalPane("horizontal");
          break;
        case "close-terminal-pane":
          anchorSurface("terminal");
          closeActiveTerminalPane();
          break;
        case "toggle-rail":
          toggleProjectRail();
          break;
        case "toggle-inspector":
          toggleInspector();
          break;
        case "show-files":
          setInspectorMode("files");
          break;
        case "show-search":
          setInspectorMode("search");
          break;
        case "show-git":
          setInspectorMode("git");
          break;
        case "flip-inspector":
          flipInspectorDock();
          break;
        case "grow-surface":
          if (activeWorkspace) {
            adjustSurfaceWidth(activeWorkspace.track.activeSurface, "increase");
          }
          break;
        case "shrink-surface":
          if (activeWorkspace) {
            adjustSurfaceWidth(activeWorkspace.track.activeSurface, "decrease");
          }
          break;
        default:
          break;
      }
    };

    const unsubscribe = window.naeditor.onAppCommand(handleCommand);
    return unsubscribe;
  }, [
    activeWorkspace,
    addProject,
    addCodeTab,
    openSettingsDialog,
    addTerminalTab,
    adjustSurfaceWidth,
    anchorSurface,
    closeActiveTab,
    closeActiveCodeTab,
    closeActiveTerminalPane,
    closeActiveTerminalTab,
    closeActiveBrowserTab,
    flipInspectorDock,
    moveProjectSelection,
    moveTrack,
    saveCurrentFile,
    setInspectorMode,
    toggleInspector,
    toggleProjectRail,
    addBrowserTab,
    splitActiveTerminalPane
  ]);

  useEffect(() => {
    if (!window.naeditor) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "w") {
        event.preventDefault();
        event.stopPropagation();
        if (activeWorkspace?.track.activeSurface === "browser") {
          closeActiveBrowserTab();
        } else if (activeWorkspace?.track.activeSurface === "code") {
          closeActiveCodeTab();
        } else if (activeWorkspace?.track.activeSurface === "terminal") {
          closeActiveTerminalTab();
        } else {
          closeActiveTab();
        }
      }

      if (event.metaKey && !event.ctrlKey && !event.altKey && event.shiftKey && event.key.toLowerCase() === "w") {
        event.preventDefault();
        event.stopPropagation();
        closeActiveTerminalPane();
      }

      if (event.key === "Escape") {
        if (showRemoteProjectModal) {
          event.preventDefault();
          event.stopPropagation();
          setShowRemoteProjectModal(false);
          return;
        }

        if (settingsDialogOpen) {
          event.preventDefault();
          event.stopPropagation();
          closeSettingsDialog();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    activeWorkspace?.track.activeSurface,
    closeActiveBrowserTab,
    closeActiveTab,
    closeActiveCodeTab,
    closeActiveTerminalPane,
    closeActiveTerminalTab,
    closeSettingsDialog,
    settingsDialogOpen,
    showRemoteProjectModal
  ]);

  if (!window.naeditor) {
    return <div className="app-loading">Loading SpaceCode bridge…</div>;
  }

  if (!hydrated || loading) {
    return <div className="app-loading">Loading SpaceCode…</div>;
  }

  return (
    <div className="app-shell">
      <ProjectRail
        collapsed={projectRailCollapsed}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelect={selectProject}
        onAddProject={() => void addProject()}
        onAddRemoteProject={() => setShowRemoteProjectModal(true)}
        onOpenSettings={openSettingsDialog}
        onToggleCollapse={toggleProjectRail}
        onRemoveProject={(projectId) => void removeProject(projectId)}
      />

      <main className="app-main">
        <TopBar
          project={activeProject}
          track={activeWorkspace?.track}
          git={activeWorkspace?.git}
          onAnchorSurface={anchorSurface}
          onSetSurfaceWidth={setSurfaceWidth}
          onMoveSurface={moveSurface}
          onToggleControls={toggleTrackControls}
          onToggleSurfaceVisibility={toggleSurfaceVisibility}
        />

        <div className="workspace-shell">
          <WorkspaceTrack
            project={activeProject}
            workspace={activeWorkspace}
            editorSidebar={
              activeWorkspace?.track.inspector.visible ? (
                <Inspector
                  project={activeProject}
                  workspace={activeWorkspace}
                  directoryEntries={directoryEntries}
                  onModeChange={setInspectorMode}
                  onOpenFile={(path) => activeProject && void openFile(activeProject.id, path)}
                  onOpenGitDiff={(path, staged) => activeProject && void openGitDiffTab(activeProject.id, path, staged)}
                  onOpenGitCommit={(commitHash) => activeProject && void openGitCommitTab(activeProject.id, commitHash)}
                  onOpenGitCommitFileDiff={(commitHash, filePath) =>
                    activeProject && void openGitCommitFileDiffTab(activeProject.id, commitHash, filePath)
                  }
                  getGitCommitDetails={(commitHash) =>
                    activeProject ? getGitCommitDetails(activeProject.id, commitHash) : Promise.resolve(null)
                  }
                  onOpenGitCompare={(baseRef, targetRef) => activeProject && void openGitCompareTab(activeProject.id, baseRef, targetRef)}
                  onOpenSearchResult={(match, query) => activeProject && void openSearchResult(activeProject.id, match, query)}
                  ensureDirectory={ensureDirectory}
                  onSearchProject={searchProject}
                  onInitGit={initGit}
                  listGitRepositories={listGitRepositories}
                  onSelectGitRepository={selectGitRepository}
                  listGitBranches={listGitBranches}
                  listGitGraph={listGitGraph}
                  onStageGitFile={stageGitFile}
                  onStageAllGitFiles={stageAllGitFiles}
                  onUnstageGitFile={unstageGitFile}
                  onUnstageAllGitFiles={unstageAllGitFiles}
                  onDiscardAllGitFiles={discardAllGitFiles}
                  onDiscardGitFile={discardGitFile}
                  onCommitGit={commitGit}
                  onCheckoutGitBranch={checkoutGitBranch}
                  onCreateGitBranch={createGitBranch}
                  onFetchGit={fetchGit}
                  onPullGit={pullGit}
                  onPushGit={pushGit}
                  onRefreshGit={refreshGit}
                />
              ) : null
            }
            onToggleInspector={toggleInspector}
            onEditorModeChange={setInspectorMode}
            onEditorInspectorResize={setInspectorWidth}
            onSelectTab={setActiveTab}
            onCloseTab={closeTab}
            onUpdateEditorContent={updateCurrentFileContent}
            onAddCodeTab={addCodeTab}
            onSelectCodeTab={selectCodeTab}
            onCloseCodeTab={closeCodeTab}
            onEnsureCodeBootstrap={ensureCodeBootstrap}
            onUpdateCodeDraft={updateCodeDraft}
            onSetCodeModel={setCodeModel}
            onSetCodeReasoningEffort={setCodeReasoningEffort}
            onSetCodeRuntimeMode={setCodeRuntimeMode}
            onSetCodeInteractionMode={setCodeInteractionMode}
            onAddCodeAttachment={addCodeAttachment}
            onRemoveCodeAttachment={removeCodeAttachment}
            onRemoveQueuedCodeTurn={removeQueuedCodeTurn}
            onClearQueuedCodeTurns={clearQueuedCodeTurns}
            onReplaceNextQueuedCodeTurn={replaceNextQueuedCodeTurn}
            onSubmitCodeTurn={submitCodeTurn}
            onInterruptCodeTurn={interruptCodeTurn}
            onRespondToCodeRequest={respondToCodeRequest}
            onBrowserUrlChange={setBrowserUrl}
            onAddBrowserTab={addBrowserTab}
            onCloseBrowserTab={closeBrowserTab}
            onSelectBrowserTab={selectBrowserTab}
            onBrowserStateChange={updateBrowserTabState}
            onPortForwardChange={setPortForwardInfo}
            browserDevtoolsRequestKey={browserDevtoolsRequestKey}
            onFocusTerminalPane={focusTerminalPane}
            onSelectTerminalTab={selectTerminalTab}
            onAddTerminalTab={addTerminalTab}
            onCloseTerminalTab={closeTerminalTab}
            appSettings={appSettings}
          />
        </div>
      </main>

      {showRemoteProjectModal ? (
        <RemoteProjectModal
          serverConfigs={appSettings.remoteServers}
          onClose={() => setShowRemoteProjectModal(false)}
          onCreate={(project) => {
            void addRemoteProject(project);
            setShowRemoteProjectModal(false);
          }}
        />
      ) : null}

      {settingsDialogOpen ? (
        <SettingsDialog
          settings={appSettings}
          onClose={closeSettingsDialog}
          onUpdateSettings={updateAppSettings}
          onUpsertRemoteServer={upsertRemoteServer}
          onRemoveRemoteServer={removeRemoteServerConfig}
        />
      ) : null}
    </div>
  );
}
