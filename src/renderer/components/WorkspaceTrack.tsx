import type { AppSettings, ProjectRecord, ProjectWorkspace, SurfaceId } from "@shared/types";
import { getTrackWidth, getVisibleSurfaceOrder, snapWidthToRatio } from "@renderer/lib/workspace";
import { EditorSurface } from "./EditorSurface";
import { CodeSurface } from "./CodeSurface";
import { TerminalSurface } from "./TerminalSurface";
import { BrowserSurface } from "./BrowserSurface";
import type { ReactNode } from "react";

type WorkspaceTrackProps = {
  project?: ProjectRecord;
  workspace?: ProjectWorkspace;
  editorSidebar?: ReactNode;
  onToggleInspector: () => void;
  onEditorModeChange: (mode: ProjectWorkspace["track"]["inspector"]["mode"]) => void;
  onEditorInspectorResize: (width: number) => void;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string) => void;
  onUpdateEditorContent: (content: string) => void;
  onAddCodeTab: () => void;
  onSelectCodeTab: (tabId: string) => void;
  onCloseCodeTab: (tabId: string) => void;
  onEnsureCodeBootstrap: (tabId: string) => Promise<void>;
  onUpdateCodeDraft: (tabId: string, draft: string) => void;
  onSetCodeModel: (tabId: string, model?: string) => void;
  onSetCodeReasoningEffort: (tabId: string, effort: ProjectWorkspace["codeTabs"][number]["reasoningEffort"]) => void;
  onSetCodeRuntimeMode: (tabId: string, mode: ProjectWorkspace["codeTabs"][number]["runtimeMode"]) => void;
  onSetCodeInteractionMode: (tabId: string, mode: ProjectWorkspace["codeTabs"][number]["interactionMode"]) => void;
  onAddCodeAttachment: (tabId: string, attachment: ProjectWorkspace["codeTabs"][number]["attachments"][number]) => void;
  onRemoveCodeAttachment: (tabId: string, attachmentId: string) => void;
  onRemoveQueuedCodeTurn: (tabId: string, queuedTurnId: string) => void;
  onClearQueuedCodeTurns: (tabId: string) => void;
  onReplaceNextQueuedCodeTurn: (tabId: string) => void;
  onSubmitCodeTurn: (tabId: string) => Promise<void>;
  onInterruptCodeTurn: (tabId: string) => Promise<void>;
  onRespondToCodeRequest: (
    tabId: string,
    decision: "approved" | "denied",
    answers?: Record<string, string | string[]>
  ) => Promise<void>;
  onBrowserUrlChange: (url: string) => void;
  onAddBrowserTab: () => void;
  onCloseBrowserTab: (tabId: string) => void;
  onSelectBrowserTab: (tabId: string) => void;
  onBrowserStateChange: (state: { url: string; title: string; faviconUrl?: string }, tabId?: string) => void;
  onPortForwardChange: (info?: ProjectWorkspace["portForward"]) => void;
  browserDevtoolsRequestKey: number;
  onFocusTerminalPane: (paneId: string) => void;
  onSelectTerminalTab: (tabId: string) => void;
  onAddTerminalTab: () => void;
  onCloseTerminalTab: (tabId: string) => void;
  appSettings: AppSettings;
};

export function WorkspaceTrack({
  project,
  workspace,
  editorSidebar,
  onToggleInspector,
  onEditorModeChange,
  onEditorInspectorResize,
  onSelectTab,
  onCloseTab,
  onUpdateEditorContent,
  onAddCodeTab,
  onSelectCodeTab,
  onCloseCodeTab,
  onEnsureCodeBootstrap,
  onUpdateCodeDraft,
  onSetCodeModel,
  onSetCodeReasoningEffort,
  onSetCodeRuntimeMode,
  onSetCodeInteractionMode,
  onAddCodeAttachment,
  onRemoveCodeAttachment,
  onRemoveQueuedCodeTurn,
  onClearQueuedCodeTurns,
  onReplaceNextQueuedCodeTurn,
  onSubmitCodeTurn,
  onInterruptCodeTurn,
  onRespondToCodeRequest,
  onBrowserUrlChange,
  onAddBrowserTab,
  onCloseBrowserTab,
  onSelectBrowserTab,
  onBrowserStateChange,
  onPortForwardChange,
  browserDevtoolsRequestKey,
  onFocusTerminalPane,
  onSelectTerminalTab,
  onAddTerminalTab,
  onCloseTerminalTab,
  appSettings
}: WorkspaceTrackProps) {
  if (!project || !workspace) {
    return (
      <div className="workspace-track workspace-track--empty">
        <div className="empty-state">
          <h2>Single-window project control center</h2>
          <p>
            Add a project from the rail to start using the editor, terminal, and browser track inside one persistent
            workspace.
          </p>
        </div>
      </div>
    );
  }

  const total = getTrackWidth(workspace.track);
  const surfaceOrder = getVisibleSurfaceOrder(workspace.track);
  const selectedGitRepo = workspace.gitRepositories?.find((repo) => repo.rootPath === workspace.selectedGitRepoPath);
  const worktreeLabel =
    selectedGitRepo?.relativePath && selectedGitRepo.relativePath !== "."
      ? selectedGitRepo.relativePath
      : workspace.git?.repoDisplayPath || project.name;
  const columnSizes = surfaceOrder.map(
    (surface) => `${(snapWidthToRatio[workspace.track.widths[surface]] / total) * 100}%`
  );
  const translatePercentage = (workspace.track.viewportOffset / total) * 100;
  const activeTab = workspace.openTabs.find((tab) => tab.path === workspace.activeTabPath) ?? workspace.openTabs[0];

  return (
    <div className="workspace-track">
      <div className="workspace-track__viewport">
        <div
          className="workspace-track__strip"
          style={{
            width: `${total * 100}%`,
            gridTemplateColumns: columnSizes.join(" "),
            transform: `translateX(-${translatePercentage}%)`
          }}
        >
          {surfaceOrder.map((surface) => {
            if (surface === "editor") {
              return (
                <EditorSurface
                  key={surface}
                  activeTab={activeTab}
                  tabs={workspace.openTabs}
                  git={workspace.git}
                  sidebar={editorSidebar}
                  sidebarVisible={workspace.track.inspector.visible}
                  sidebarDock={workspace.track.inspector.dock}
                  sidebarWidth={workspace.track.inspector.width}
                  inspectorMode={workspace.track.inspector.mode}
                  onToggleSidebar={onToggleInspector}
                  onModeChange={onEditorModeChange}
                  onResizeSidebar={onEditorInspectorResize}
                  onSelectTab={onSelectTab}
                  onCloseTab={onCloseTab}
                  onChangeContent={onUpdateEditorContent}
                  revealTarget={workspace.editorRevealTarget}
                  appSettings={appSettings}
                />
              );
            }

            if (surface === "code") {
              return (
                <CodeSurface
                  key={surface}
                  project={project}
                  tabs={workspace.codeTabs}
                  activeTabId={workspace.activeCodeTabId}
                  branchName={workspace.git?.branch}
                  worktreeLabel={worktreeLabel}
                  mentionBasePath={workspace.selectedGitRepoPath ?? project.rootPath}
                  codeTheme={appSettings.codeTheme}
                  onOpenBranches={() => {
                    if (!workspace.track.inspector.visible) {
                      onToggleInspector();
                    }
                    onEditorModeChange("branches");
                  }}
                  onSelectTab={onSelectCodeTab}
                  onAddTab={onAddCodeTab}
                  onCloseTab={onCloseCodeTab}
                  onEnsureBootstrap={onEnsureCodeBootstrap}
                  onUpdateDraft={onUpdateCodeDraft}
                  onSetModel={onSetCodeModel}
                  onSetReasoningEffort={onSetCodeReasoningEffort}
                  onSetRuntimeMode={onSetCodeRuntimeMode}
                  onSetInteractionMode={onSetCodeInteractionMode}
                  onAddAttachment={onAddCodeAttachment}
                  onRemoveAttachment={onRemoveCodeAttachment}
                  onRemoveQueuedTurn={onRemoveQueuedCodeTurn}
                  onClearQueuedTurns={onClearQueuedCodeTurns}
                  onReplaceNextQueuedTurn={onReplaceNextQueuedCodeTurn}
                  onSubmitTurn={onSubmitCodeTurn}
                  onInterruptTurn={onInterruptCodeTurn}
                  onRespondToRequest={onRespondToCodeRequest}
                />
              );
            }

            if (surface === "terminal") {
              return (
                <TerminalSurface
                  key={surface}
                  projectId={project.id}
                  project={project}
                  tabs={workspace.terminalTabs}
                  activeTabId={workspace.activeTerminalTabId}
                  onFocusPane={onFocusTerminalPane}
                  onSelectTab={onSelectTerminalTab}
                  onAddTab={onAddTerminalTab}
                  onCloseTab={onCloseTerminalTab}
                  appSettings={appSettings}
                />
              );
            }

            return (
              <BrowserSurface
                key={surface}
                project={project}
                url={workspace.browserUrl ?? ""}
                tabs={workspace.browserTabs}
                activeTabId={workspace.activeBrowserTabId}
                viewportOffset={workspace.track.viewportOffset}
                onBrowserUrlChange={onBrowserUrlChange}
                onAddTab={onAddBrowserTab}
                onCloseTab={onCloseBrowserTab}
                onSelectTab={onSelectBrowserTab}
                onBrowserStateChange={onBrowserStateChange}
                portForward={workspace.portForward}
                onPortForwardChange={onPortForwardChange}
                devtoolsRequestKey={browserDevtoolsRequestKey}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
