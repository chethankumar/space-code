import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  Ellipsis,
  Gauge,
  GitBranch,
  LoaderCircle,
  Plus,
  ShieldAlert,
  Square,
  X
} from "lucide-react";
import type {
  CodeAttachment,
  CodeInteractionMode,
  CodeQueuedTurn,
  CodeReasoningEffort,
  CodeRuntimeMode,
  CodeTab,
  CodeThemePreset,
  ProjectRecord
} from "@shared/types";

type CodeSurfaceProps = {
  project: ProjectRecord;
  tabs: CodeTab[];
  activeTabId?: string;
  branchName?: string;
  worktreeLabel?: string;
  mentionBasePath?: string;
  codeTheme: CodeThemePreset;
  onOpenBranches: () => void;
  onSelectTab: (tabId: string) => void;
  onAddTab: () => void;
  onCloseTab: (tabId: string) => void;
  onEnsureBootstrap: (tabId: string) => Promise<void>;
  onUpdateDraft: (tabId: string, draft: string) => void;
  onSetModel: (tabId: string, model?: string) => void;
  onSetReasoningEffort: (tabId: string, effort: CodeReasoningEffort) => void;
  onSetRuntimeMode: (tabId: string, mode: CodeRuntimeMode) => void;
  onSetInteractionMode: (tabId: string, mode: CodeInteractionMode) => void;
  onAddAttachment: (tabId: string, attachment: CodeAttachment) => void;
  onRemoveAttachment: (tabId: string, attachmentId: string) => void;
  onRemoveQueuedTurn: (tabId: string, queuedTurnId: string) => void;
  onClearQueuedTurns: (tabId: string) => void;
  onReplaceNextQueuedTurn: (tabId: string) => void;
  onSubmitTurn: (tabId: string) => Promise<void>;
  onInterruptTurn: (tabId: string) => Promise<void>;
  onRespondToRequest: (
    tabId: string,
    decision: "approved" | "denied",
    answers?: Record<string, string | string[]>
  ) => Promise<void>;
};

type CodeComposerProps = {
  tab: CodeTab;
  composerRef: React.RefObject<HTMLDivElement | null>;
  overflowMenuRef: React.RefObject<HTMLDivElement | null>;
  compact: boolean;
  menuOpen: boolean;
  isBusy: boolean;
  canSend: boolean;
  sendLabel: string;
  queueCount: number;
  selectedModel?: CodeTab["availableModels"][number];
  branchName?: string;
  worktreeLabel?: string;
  showWorktreeContext: boolean;
  contextWindowUsage?: number;
  contextWindowLabel?: string;
  onToggleMenu: () => void;
  onSetMenuOpen: (open: boolean) => void;
  onPickAttachment: () => void;
  onUpdateDraft: (draft: string) => void;
  onSetModel: (model?: string) => void;
  onSetReasoningEffort: (effort: CodeReasoningEffort) => void;
  onSetInteractionMode: (mode: CodeInteractionMode) => void;
  onSetRuntimeMode: (mode: CodeRuntimeMode) => void;
  onOpenBranches: () => void;
  onSubmit: () => void;
  onInterrupt: () => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onReplaceNextQueuedTurn: () => void;
};

function normalizeSlashPath(value: string) {
  return value.replace(/\\/g, "/");
}

function toMentionPath(filePath: string, basePath?: string) {
  const normalizedFilePath = normalizeSlashPath(filePath);
  const normalizedBasePath = basePath ? normalizeSlashPath(basePath).replace(/\/+$/, "") : "";

  if (normalizedBasePath && normalizedFilePath.startsWith(`${normalizedBasePath}/`)) {
    return normalizedFilePath.slice(normalizedBasePath.length + 1);
  }

  const segments = normalizedFilePath.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? normalizedFilePath;
}

const runtimeModeLabels: Record<CodeRuntimeMode, string> = {
  "full-access": "Full access",
  "approval-required": "Supervised"
};

type MessageSegment =
  | { type: "paragraph"; text: string }
  | { type: "code"; language?: string; text: string };

function parseMessageSegments(text: string): MessageSegment[] {
  const normalized = text.replace(/\r\n/g, "\n");
  const fencePattern = /```([^\n`]*)\n([\s\S]*?)```/g;
  const segments: MessageSegment[] = [];
  let lastIndex = 0;

  for (const match of normalized.matchAll(fencePattern)) {
    const index = match.index ?? 0;
    const before = normalized.slice(lastIndex, index).trim();
    if (before) {
      for (const paragraph of before.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean)) {
        segments.push({ type: "paragraph", text: paragraph });
      }
    }

    segments.push({
      type: "code",
      language: match[1]?.trim() || undefined,
      text: match[2].replace(/\n$/, "")
    });
    lastIndex = index + match[0].length;
  }

  const tail = normalized.slice(lastIndex).trim();
  if (tail) {
    for (const paragraph of tail.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean)) {
      segments.push({ type: "paragraph", text: paragraph });
    }
  }

  if (segments.length === 0) {
    return [{ type: "paragraph", text }];
  }
  return segments;
}

function getMessageTitle(kind: CodeTab["messages"][number]["kind"], title?: string) {
  if (title) {
    return title;
  }

  if (kind === "user") {
    return "You";
  }
  if (kind === "assistant") {
    return "Codex";
  }
  if (kind === "reasoning") {
    return "Reasoning";
  }
  if (kind === "tool") {
    return "Command run";
  }
  if (kind === "status") {
    return "Status";
  }
  return "System";
}

function getMessageBadge(kind: CodeTab["messages"][number]["kind"]) {
  if (kind === "user") {
    return "You";
  }
  if (kind === "assistant") {
    return "AI";
  }
  if (kind === "reasoning") {
    return "Think";
  }
  if (kind === "tool") {
    return "Tool";
  }
  if (kind === "status") {
    return "Run";
  }
  return "Info";
}

function renderMessageBody(text: string) {
  return parseMessageSegments(text).map((segment, index) => {
    if (segment.type === "code") {
      return (
        <div key={`code-${index}`} className="code-message__code">
          {segment.language ? (
            <div className="code-message__code-label">{segment.language}</div>
          ) : null}
          <pre>{segment.text}</pre>
        </div>
      );
    }

    const lines = segment.text.split("\n");
    const isList = lines.every((line) => /^[-*]\s+/.test(line.trim()));
    const isHeading = /^#{1,3}\s+/.test(segment.text);

    if (isList) {
      return (
        <ul key={`list-${index}`} className="code-message__list">
          {lines.map((line) => (
            <li key={line}>{renderInlineContent(line.trim().replace(/^[-*]\s+/, ""))}</li>
          ))}
        </ul>
      );
    }

    if (isHeading) {
      return (
        <p key={`heading-${index}`} className="code-message__heading">
          {renderInlineContent(segment.text.replace(/^#{1,3}\s+/, ""))}
        </p>
      );
    }

    return (
      <p key={`paragraph-${index}`} className="code-message__paragraph">
        {renderInlineContent(segment.text)}
      </p>
    );
  });
}

function renderInlineContent(text: string) {
  const tokens: ReactNode[] = [];
  const pattern = /`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    const before = text.slice(lastIndex, index);
    if (before) {
      tokens.push(before);
    }

    if (match[1]) {
      tokens.push(
        <code key={`code-${index}`} className="code-message__inline-code">
          {match[1]}
        </code>
      );
    } else if (match[2] && match[3]) {
      tokens.push(
        <a
          key={`link-${index}`}
          className="code-message__link"
          href={match[3]}
          target="_blank"
          rel="noreferrer"
        >
          {match[2]}
        </a>
      );
    }

    lastIndex = index + match[0].length;
  }

  const tail = text.slice(lastIndex);
  if (tail) {
    tokens.push(tail);
  }

  return tokens.length > 0 ? tokens : text;
}

function formatMessageTime(value?: string) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  // Just now (< 10 seconds)
  if (diffSeconds < 10) {
    return "Just now";
  }

  // Seconds ago (< 60 seconds)
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }

  // Minutes ago (< 60 minutes)
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  // Hours ago (< 24 hours)
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  // Days ago (< 7 days)
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  // Older: use date format
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function formatElapsedMs(value?: number) {
  if (!value || value <= 0) {
    return null;
  }
  if (value < 1000) {
    return `${value}ms`;
  }
  const seconds = value / 1000;
  if (seconds < 60) {
    return `${seconds >= 10 ? Math.round(seconds) : seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainderSeconds = Math.round(seconds % 60);
  return remainderSeconds > 0 ? `${minutes}m ${remainderSeconds}s` : `${minutes}m`;
}

function formatQueuedTurnSummary(queuedTurn: CodeQueuedTurn) {
  const text = queuedTurn.input?.trim();
  if (text) {
    return text;
  }
  if (queuedTurn.attachments.length === 1) {
    return queuedTurn.attachments[0]?.name ?? "1 attachment";
  }
  if (queuedTurn.attachments.length > 1) {
    return `${queuedTurn.attachments.length} attachments`;
  }
  return "Queued follow-up";
}

function CodeComposer({
  tab,
  composerRef,
  overflowMenuRef,
  compact,
  menuOpen,
  isBusy,
  canSend,
  sendLabel,
  queueCount,
  selectedModel,
  branchName,
  worktreeLabel,
  showWorktreeContext,
  contextWindowUsage,
  contextWindowLabel,
  onToggleMenu,
  onSetMenuOpen,
  onPickAttachment,
  onUpdateDraft,
  onSetModel,
  onSetReasoningEffort,
  onSetInteractionMode,
  onSetRuntimeMode,
  onOpenBranches,
  onSubmit,
  onInterrupt,
  onRemoveAttachment,
  onReplaceNextQueuedTurn
}: CodeComposerProps) {
  return (
    <div className="code-composer">
      <div ref={composerRef} className="code-composer__frame code-launcher__composer code-composer__frame--session">
        {tab.attachments.length > 0 ? (
          <div className="code-attachments">
            {tab.attachments.map((attachment) => (
              <div key={attachment.id} className="code-attachment">
                <span>{attachment.name}</span>
                <button onClick={() => onRemoveAttachment(attachment.id)}>
                  <X size={12} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <textarea
          className="code-composer__input code-launcher__input"
          value={tab.draft}
          onChange={(event) => onUpdateDraft(event.target.value)}
          placeholder="Ask anything"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && canSend) {
              event.preventDefault();
              onSubmit();
            }
          }}
        />

        {tab.lastError ? <div className="code-error">{tab.lastError}</div> : null}

        <div className="code-composer__footer">
          {!compact ? (
            <div className="code-launcher__controls code-launcher__controls--desktop">
              <button
                className="code-launcher__icon-button code-launcher__icon-button--control"
                onClick={onPickAttachment}
                title="Add file or image"
              >
                <Plus size={16} strokeWidth={2.1} />
              </button>
              <label className="code-launcher__select">
                <select
                  value={tab.selectedModel ?? selectedModel?.model ?? ""}
                  onChange={(event) => onSetModel(event.target.value || undefined)}
                >
                  {tab.availableModels.map((model) => (
                    <option key={model.id} value={model.model}>
                      {model.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="code-launcher__select">
                <select
                  value={tab.reasoningEffort}
                  onChange={(event) => onSetReasoningEffort(event.target.value as CodeReasoningEffort)}
                >
                  {(selectedModel?.supportedReasoningEfforts ?? ["medium"]).map((effort) => (
                    <option key={effort} value={effort}>
                      {effort.charAt(0).toUpperCase() + effort.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="code-launcher__select">
                <select
                  value={tab.interactionMode}
                  onChange={(event) => onSetInteractionMode(event.target.value as CodeInteractionMode)}
                >
                  <option value="default">Chat</option>
                  <option value="plan">Plan</option>
                </select>
              </label>
              <label className="code-launcher__select">
                <ShieldAlert size={16} strokeWidth={1.9} />
                <select
                  value={tab.runtimeMode}
                  onChange={(event) => onSetRuntimeMode(event.target.value as CodeRuntimeMode)}
                >
                  {Object.entries(runtimeModeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
          {!compact ? (
            <div className="code-launcher__actions code-launcher__actions--desktop">
              <button
                type="button"
                className="code-launcher__select code-launcher__select--context code-launcher__context-button"
                onClick={onOpenBranches}
                title="Open branches and graph"
              >
                <GitBranch size={15} strokeWidth={1.9} />
                <span>{branchName ?? "No branch"}</span>
                <ChevronDown size={15} strokeWidth={1.9} />
              </button>
              <span
                className="code-launcher__select code-launcher__select--context"
                title={
                  contextWindowUsage !== undefined && contextWindowLabel
                    ? `Context: ${contextWindowLabel} (${contextWindowUsage}% used)`
                    : "Context window usage will appear once Codex reports token usage"
                }
              >
                <Gauge size={15} strokeWidth={1.9} />
                <span>{contextWindowUsage !== undefined ? `${contextWindowUsage}%` : "Ctx"}</span>
              </span>
              {queueCount > 0 ? (
                <>
                  <span className="code-launcher__select code-launcher__select--context" title={`${queueCount} queued follow-up${queueCount === 1 ? "" : "s"}`}>
                    <span>{`Queued ${queueCount}`}</span>
                  </span>
                  {canSend ? (
                    <button
                      type="button"
                      className="code-launcher__queue-action"
                      onClick={onReplaceNextQueuedTurn}
                      title="Replace the next queued follow-up"
                    >
                      Replace next
                    </button>
                  ) : null}
                </>
              ) : null}
              {isBusy ? (
                <button
                  className="code-action-button code-action-button--icon"
                  onClick={onInterrupt}
                  title="Stop current response"
                >
                  <Square size={13} strokeWidth={2} />
                </button>
              ) : null}
              <button className="code-launcher__send" disabled={!canSend} onClick={onSubmit} title={sendLabel}>
                {isBusy ? (
                  <LoaderCircle size={18} className="spin" strokeWidth={2.1} />
                ) : (
                  <ArrowUp size={18} strokeWidth={2.1} />
                )}
              </button>
            </div>
          ) : null}
          {compact ? (
            <div className="code-composer__compact-actions">
              <button className="code-action-button" onClick={onPickAttachment} title="Add file or image">
                <Plus size={14} strokeWidth={2.1} />
              </button>
              <div className="code-overflow" ref={overflowMenuRef}>
                <button type="button" className="code-overflow__trigger" onClick={onToggleMenu} title="More controls">
                  <Ellipsis size={16} strokeWidth={2.1} />
                </button>
                {menuOpen ? (
                  <div className="code-overflow__menu code-overflow__menu--composer">
                    <label className="code-overflow__field">
                      <span>Model</span>
                      <select
                        value={tab.selectedModel ?? selectedModel?.model ?? ""}
                        onChange={(event) => onSetModel(event.target.value || undefined)}
                      >
                        {tab.availableModels.map((model) => (
                          <option key={model.id} value={model.model}>
                            {model.displayName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="code-overflow__field">
                      <span>Effort</span>
                      <select
                        value={tab.reasoningEffort}
                        onChange={(event) => onSetReasoningEffort(event.target.value as CodeReasoningEffort)}
                      >
                        {(selectedModel?.supportedReasoningEfforts ?? ["medium"]).map((effort) => (
                          <option key={effort} value={effort}>
                            {effort}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="code-overflow__field">
                      <span>Runtime</span>
                      <select
                        value={tab.runtimeMode}
                        onChange={(event) => onSetRuntimeMode(event.target.value as CodeRuntimeMode)}
                      >
                        {Object.entries(runtimeModeLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="code-overflow__field">
                      <span>Mode</span>
                      <select
                        value={tab.interactionMode}
                        onChange={(event) => onSetInteractionMode(event.target.value as CodeInteractionMode)}
                      >
                        <option value="default">Default</option>
                        <option value="plan">Plan</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      className="code-overflow__button"
                      onClick={() => {
                        onSetMenuOpen(false);
                        onOpenBranches();
                      }}
                    >
                      <GitBranch size={14} strokeWidth={1.9} />
                      <span>{branchName ?? "No branch"}</span>
                    </button>
                    <div className="code-overflow__meta">
                      <Gauge size={14} strokeWidth={1.9} />
                      <span>{contextWindowUsage !== undefined ? `${contextWindowUsage}% context used` : "Context usage pending"}</span>
                    </div>
                    {queueCount > 0 ? (
                      <>
                        <div className="code-overflow__meta">{`${queueCount} queued follow-up${queueCount === 1 ? "" : "s"}`}</div>
                        {canSend ? (
                          <button type="button" className="code-overflow__button" onClick={onReplaceNextQueuedTurn}>
                            <span>Replace next queued follow-up</span>
                          </button>
                        ) : null}
                      </>
                    ) : null}
                    {showWorktreeContext ? <div className="code-overflow__meta">{worktreeLabel}</div> : null}
                  </div>
                ) : null}
              </div>
              {isBusy ? (
                <button className="code-action-button" onClick={onInterrupt} title="Stop current response">
                  <Square size={13} strokeWidth={2} />
                </button>
              ) : null}
              <button className="code-send-button" disabled={!canSend} onClick={onSubmit} title={sendLabel}>
                {isBusy ? (
                  <LoaderCircle size={14} className="spin" strokeWidth={2} />
                ) : (
                  <ArrowUp size={14} strokeWidth={2} />
                )}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function CodeSurface({
  project,
  tabs,
  activeTabId,
  branchName,
  worktreeLabel,
  mentionBasePath,
  codeTheme,
  onOpenBranches,
  onSelectTab,
  onAddTab,
  onCloseTab,
  onEnsureBootstrap,
  onUpdateDraft,
  onSetModel,
  onSetReasoningEffort,
  onSetRuntimeMode,
  onSetInteractionMode,
  onAddAttachment,
  onRemoveAttachment,
  onRemoveQueuedTurn,
  onClearQueuedTurns,
  onReplaceNextQueuedTurn,
  onSubmitTurn,
  onInterruptTurn,
  onRespondToRequest
}: CodeSurfaceProps) {
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const composerMenuRef = useRef<HTMLDivElement | null>(null);
  const composerFrameRef = useRef<HTMLDivElement | null>(null);
  const [composerMenuOpen, setComposerMenuOpen] = useState(false);
  const [composerCompact, setComposerCompact] = useState(false);
  const composerCompactWidth = 740;

  useEffect(() => {
    if (!activeTab || activeTab.availableModels.length > 0) {
      return;
    }
    void onEnsureBootstrap(activeTab.id);
  }, [activeTab, onEnsureBootstrap]);

  useEffect(() => {
    if (!threadRef.current) {
      return;
    }
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [activeTab?.messages, activeTab?.pendingRequest]);

  useEffect(() => {
    setComposerMenuOpen(false);
  }, [activeTab?.id]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (composerMenuRef.current && !composerMenuRef.current.contains(target)) {
        setComposerMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setComposerMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    const composerNode = composerFrameRef.current;
    if (!composerNode) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (entry.target === composerNode) {
          setComposerCompact(width < composerCompactWidth);
        }
      }
    });

    if (composerNode) {
      observer.observe(composerNode);
      setComposerCompact(composerNode.getBoundingClientRect().width < composerCompactWidth);
    }

    return () => observer.disconnect();
  }, [activeTab?.id, activeTab?.messages.length]);

  const selectedModel = useMemo(
    () =>
      activeTab?.availableModels.find((model) => model.model === activeTab.selectedModel) ??
      activeTab?.availableModels[0],
    [activeTab]
  );
  const contextWindowUsage =
    activeTab.tokenUsage?.modelContextWindow && activeTab.tokenUsage.modelContextWindow > 0 && activeTab.tokenUsage.totalTokens > 0
      ? Math.min(100, Math.max(0, Math.round((activeTab.tokenUsage.totalTokens / activeTab.tokenUsage.modelContextWindow) * 100)))
      : undefined;
  const contextWindowLabel =
    activeTab.tokenUsage?.modelContextWindow && activeTab.tokenUsage.modelContextWindow > 0
      ? `${activeTab.tokenUsage.totalTokens.toLocaleString()} / ${activeTab.tokenUsage.modelContextWindow.toLocaleString()} tokens`
      : undefined;
  const showWorktreeContext =
    !!worktreeLabel &&
    worktreeLabel.trim().length > 0 &&
    worktreeLabel !== project.name;
  const threadItems = useMemo(() => {
    const source = activeTab?.messages.filter((message) => message.kind !== "reasoning") ?? [];
    
    // First, identify turns (user message + all responses until next user message)
    const turns: Array<{ messages: typeof source; isLastTurn: boolean }> = [];
    let currentTurn: typeof source = [];
    
    for (let i = 0; i < source.length; i++) {
      const message = source[i];
      
      if (message.kind === "user") {
        // Start new turn
        if (currentTurn.length > 0) {
          turns.push({ messages: currentTurn, isLastTurn: false });
        }
        currentTurn = [message];
      } else {
        // Add to current turn
        currentTurn.push(message);
      }
    }
    
    // Add the last turn
    if (currentTurn.length > 0) {
      turns.push({ messages: currentTurn, isLastTurn: true });
    }
    
    // Mark the last turn
    if (turns.length > 0) {
      turns[turns.length - 1].isLastTurn = true;
      if (turns.length > 1) {
        turns[turns.length - 2].isLastTurn = false;
      }
    }
    
    // Now group messages within each turn
    const grouped: Array<
      | { kind: "command-group"; messages: typeof source; index: number; isInLastTurn: boolean }
      | { kind: "message"; message: (typeof source)[number]; index: number; isInLastTurn: boolean }
      | { kind: "separator"; index: number }
    > = [];

    // Find the last assistant message index globally
    let lastAssistantIndex = -1;
    for (let i = source.length - 1; i >= 0; i--) {
      if (source[i].kind === "assistant") {
        lastAssistantIndex = i;
        break;
      }
    }

    let currentIndex = 0;
    let globalMessageIndex = 0;
    
    for (const turn of turns) {
      for (let i = 0; i < turn.messages.length; i++) {
        const message = turn.messages[i];
        
        // Add separator BEFORE the last assistant message (if it's in this turn)
        if (message.kind === "assistant" && globalMessageIndex === lastAssistantIndex && globalMessageIndex > 0) {
          grouped.push({ kind: "separator", index: currentIndex });
          currentIndex++;
        }
        
        if (message.kind === "tool") {
          const previous = grouped[grouped.length - 1];
          if (previous?.kind === "command-group") {
            previous.messages.push(message);
          } else {
            grouped.push({ 
              kind: "command-group", 
              messages: [message], 
              index: currentIndex,
              isInLastTurn: turn.isLastTurn
            });
          }
          globalMessageIndex++;
          continue;
        }
        
        grouped.push({ 
          kind: "message", 
          message, 
          index: currentIndex,
          isInLastTurn: turn.isLastTurn
        });
        currentIndex++;
        globalMessageIndex++;
      }
    }

    return grouped;
  }, [activeTab?.messages]);

  const handlePickAttachment = async (file: File) => {
    const path = (file as File & { path?: string }).path ?? file.name;
    if (file.type.startsWith("image/")) {
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ""));
          reader.onerror = () => reject(reader.error ?? new Error("Failed to read image"));
          reader.readAsDataURL(file);
        });
        onAddAttachment(activeTab.id, {
          id: crypto.randomUUID(),
          type: "image",
          path,
          name: file.name,
          mimeType: file.type,
          dataUrl
        });
      } catch (error) {
        console.error(error);
      }
      return;
    }

    const mentionPath = toMentionPath(path, mentionBasePath ?? project.rootPath);
    const reference = `@${mentionPath}`;
    const separator = activeTab.draft.length > 0 && !/\s$/.test(activeTab.draft) ? " " : "";
    const nextDraft = `${activeTab.draft}${separator}${reference} `;
    onUpdateDraft(activeTab.id, nextDraft);
  };

  if (!activeTab) {
    return <section className="surface surface--code" data-code-theme={codeTheme} />;
  }

  if (project.kind !== "local") {
    return (
      <section className="surface surface--code" data-code-theme={codeTheme}>
        <div className="surface__header">
          <div className="surface__title">
            <Bot size={14} strokeWidth={1.9} />
            <span className="eyebrow">Code</span>
          </div>
          <div className="code-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={tab.id === activeTab.id ? "code-tab code-tab--active" : "code-tab"}
                onClick={() => onSelectTab(tab.id)}
              >
                <span className="code-tab__label">{tab.title}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="code-empty">
          <div className="code-empty__icon">
            <Bot size={22} strokeWidth={1.8} />
          </div>
          <strong>Code is currently local-only</strong>
          <p>Remote project Codex sessions are not wired yet. Use a local space for now.</p>
        </div>
      </section>
    );
  }

  const isBusy = activeTab.status === "connecting" || activeTab.status === "running" || activeTab.status === "waiting";
  const canSend = activeTab.draft.trim().length > 0 || activeTab.attachments.length > 0;
  const sendLabel = isBusy || activeTab.pendingRequest ? "Queue follow-up" : "Send";
  const isEmpty = activeTab.messages.length === 0;
  return (
    <section className="surface surface--code" data-code-theme={codeTheme}>
      <div className="surface__header">
        <div className="surface__title">
          <Bot size={14} strokeWidth={1.9} />
          <span className="eyebrow">Code</span>
        </div>
        <div className="code-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={tab.id === activeTab.id ? "code-tab code-tab--active" : "code-tab"}
              onClick={() => onSelectTab(tab.id)}
            >
              <span className="code-tab__label">{tab.title}</span>
              <span
                className="code-tab__close"
                onClick={(event) => {
                  event.stopPropagation();
                  onCloseTab(tab.id);
                }}
              >
                <X size={12} strokeWidth={2} />
              </span>
            </button>
          ))}
          <button className="code-tab code-tab--add" onClick={onAddTab} title="New code tab">
            <Plus size={13} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className={`code-shell${isEmpty ? " code-shell--empty" : ""}`}>
        <input
          ref={fileInputRef}
          type="file"
          hidden
          multiple
          onChange={async (event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length === 0) {
              return;
            }
            for (const file of files) {
              await handlePickAttachment(file);
            }
            event.currentTarget.value = "";
          }}
        />
        <div className="code-thread" ref={threadRef}>
          <div className="code-thread__inner">
          {isEmpty ? (
            <div className="code-launcher">
              <div className="code-launcher__canvas">
                <div className="code-launcher__intro">
                  <div className="code-launcher__title">CODE</div>
                  <div className="code-launcher__helper">Ask Codex to explore, edit, or plan the next step.</div>
                </div>
              </div>
            </div>
          ) : null}

          {threadItems.map((item, itemIndex) => {
            if (item.kind === "separator") {
              return (
                <div key={`sep-${item.index}`} className="code-message-separator">
                  <div className="code-message-separator__line" />
                </div>
              );
            }
            
            if (item.kind === "command-group") {
              const isStreaming = item.messages.some((message) => message.streaming);
              return (
                <details
                  key={item.messages.map((message) => message.id).join(":")}
                  className={`code-command-group${isStreaming ? " code-command-group--streaming" : ""}`}
                  open={isStreaming || item.isInLastTurn}
                >
                  <summary className="code-command-group__summary">
                    <div className="code-command-group__summary-content">
                      <div className="code-command-block__icon">{">_"}</div>
                      <span className="code-command-group__summary-text">
                        {item.messages.length === 1 
                          ? "Command run" 
                          : `${item.messages.length} commands run`}
                      </span>
                    </div>
                    <ChevronDown size={14} strokeWidth={2} className="code-message__summary-chevron" />
                  </summary>
                  <div className="code-command-group__content">
                    {item.messages.map((message) => (
                      <div
                        key={message.id}
                        className={`code-command-block${message.streaming ? " code-command-block--streaming" : ""}`}
                      >
                        <div className="code-command-block__icon">{">_"}</div>
                        <div className="code-command-block__content">
                          {message.text && message.text.trim() ? (
                            <span className="code-command-block__text">{message.text}</span>
                          ) : message.title ? (
                            <>
                              <span className="code-command-block__label">{message.title}</span>
                              {message.metadata?.output && (
                                <span className="code-command-block__text"> - {message.metadata.output}</span>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="code-command-block__label">Command run</span>
                              <span className="code-command-block__text">{message.streaming ? "Running…" : "Completed"}</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              );
            }
            
            if (item.message.kind === "assistant" || item.message.kind === "user") {
              return (
                <div
                  key={item.message.id}
                  className={`code-message code-message--${item.message.kind} ${
                    item.message.streaming ? "code-message--streaming" : ""
                  }`}
                >
                  <div className="code-message__body">
                    {item.message.text
                      ? renderMessageBody(item.message.text)
                      : item.message.streaming
                        ? "…"
                        : null}
                  </div>
                  {item.message.kind === "assistant" &&
                  (item.message.completedAt || item.message.elapsedMs !== undefined || item.message.changedFiles?.length) ? (
                    <div className="code-message__footer">
                      {(formatMessageTime(item.message.completedAt ?? item.message.createdAt) || formatElapsedMs(item.message.elapsedMs)) ? (
                        <div className="code-message__foot-meta">
                          {formatMessageTime(item.message.completedAt ?? item.message.createdAt) && formatElapsedMs(item.message.elapsedMs) ? (
                            <span>
                              {formatMessageTime(item.message.completedAt ?? item.message.createdAt)} · {formatElapsedMs(item.message.elapsedMs)}
                            </span>
                          ) : formatMessageTime(item.message.completedAt ?? item.message.createdAt) ? (
                            <span>{formatMessageTime(item.message.completedAt ?? item.message.createdAt)}</span>
                          ) : formatElapsedMs(item.message.elapsedMs) ? (
                            <span>{formatElapsedMs(item.message.elapsedMs)}</span>
                          ) : null}
                        </div>
                      ) : null}
                      {item.message.changedFiles?.length ? (
                        <div className="code-message__changed-files">
                          {item.message.changedFiles.map((file) => (
                            <span key={`${item.message.id}-${file.path}`} className="code-message__changed-file">
                              <span className={`code-message__changed-file-status code-message__changed-file-status--${file.status}`}>
                                {file.status === "modified"
                                  ? "M"
                                  : file.status === "added"
                                    ? "A"
                                    : file.status === "deleted"
                                      ? "D"
                                      : file.status === "renamed"
                                        ? "R"
                                        : file.status === "copied"
                                          ? "C"
                                          : file.status === "untracked"
                                            ? "U"
                                            : "•"}
                              </span>
                              <span className="code-message__changed-file-path">{file.path}</span>
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {item.message.kind === "user" ? (
                    <div className="code-message__footer code-message__footer--user">
                      <div className="code-message__foot-meta code-message__foot-meta--user">
                        {formatMessageTime(item.message.createdAt) ? (
                          <span>{formatMessageTime(item.message.createdAt)}</span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            }
            
            return (
              <details
                key={item.message.id}
                className={`code-message code-message--${item.message.kind} code-message--event ${
                  item.message.streaming ? "code-message--streaming" : ""
                }`}
                open={item.message.streaming || item.message.kind === "status" || item.isInLastTurn}
              >
                <summary className="code-message__summary">
                  <div className="code-message__role">
                    <span className="code-message__avatar">{getMessageBadge(item.message.kind)}</span>
                    <span className="code-message__title">{getMessageTitle(item.message.kind, item.message.title)}</span>
                  </div>
                  <div className="code-message__summary-right">
                    {item.message.metadata ? (
                      <div className="code-message__metadata">
                        {Object.values(item.message.metadata).map((value) => (
                          <span key={value} className="code-message__meta-chip">
                            {value}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <ChevronDown size={14} strokeWidth={2} className="code-message__summary-chevron" />
                  </div>
                </summary>
                <div className="code-message__body">
                  {item.message.text
                    ? renderMessageBody(item.message.text)
                    : item.message.streaming
                      ? "…"
                      : null}
                </div>
              </details>
            );
          })}

          {activeTab.pendingRequest ? (
            <div className="code-request">
              <div className="code-request__title">
                <ShieldAlert size={15} strokeWidth={1.8} />
                <span>{activeTab.pendingRequest.title}</span>
              </div>
              {activeTab.pendingRequest.detail ? (
                <div className="code-request__detail">{activeTab.pendingRequest.detail}</div>
              ) : null}
              {activeTab.pendingRequest.kind === "user-input" && activeTab.pendingRequest.questions?.length ? (
                <div className="code-request__questions">
                  {activeTab.pendingRequest.questions.map((question) => (
                    <div key={question.id} className="code-request__question">
                      <div className="code-request__question-label">{question.header}</div>
                      <div className="code-request__question-copy">{question.question}</div>
                      <div className="code-request__options">
                        {question.options.map((option) => (
                          <button
                            key={option.label}
                            className="code-request__option"
                            onClick={() =>
                              void onRespondToRequest(activeTab.id, "approved", {
                                [question.id]: option.label
                              })
                            }
                          >
                            <span>{option.label}</span>
                            <small>{option.description}</small>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="code-request__actions">
                  <button
                    className="code-action-button"
                    onClick={() => void onRespondToRequest(activeTab.id, "denied")}
                  >
                    Deny
                  </button>
                  <button
                    className="code-send-button"
                    onClick={() => void onRespondToRequest(activeTab.id, "approved")}
                  >
                    <Check size={14} strokeWidth={2} />
                    Approve
                  </button>
                </div>
              )}
            </div>
          ) : null}
          {activeTab.queuedTurns.length > 0 ? (
            <div className="code-queued-turns">
              <div className="code-queued-turns__header">
                <div className="code-queued-turns__title">Queued follow-ups</div>
                <button
                  type="button"
                  className="code-queued-turns__clear"
                  onClick={() => onClearQueuedTurns(activeTab.id)}
                >
                  Clear queue
                </button>
              </div>
              <div className="code-queued-turns__list">
                {activeTab.queuedTurns.map((queuedTurn, index) => (
                  <div key={queuedTurn.id} className="code-queued-turn">
                    <div className="code-queued-turn__meta">
                      <span className="code-queued-turn__label">
                        {index === 0 ? "Next up" : `Queued ${index + 1}`}
                      </span>
                    </div>
                    <div className="code-queued-turn__body">
                      <div className="code-queued-turn__text">{formatQueuedTurnSummary(queuedTurn)}</div>
                      <button
                        type="button"
                        className="code-queued-turn__remove"
                        title="Remove queued follow-up"
                        onClick={() => onRemoveQueuedTurn(activeTab.id, queuedTurn.id)}
                      >
                        <X size={12} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          </div>
        </div>

        <CodeComposer
          tab={activeTab}
          composerRef={composerFrameRef}
          overflowMenuRef={composerMenuRef}
          compact={composerCompact}
          menuOpen={composerMenuOpen}
          isBusy={isBusy}
          canSend={canSend}
          sendLabel={sendLabel}
          queueCount={activeTab.queuedTurns.length}
          selectedModel={selectedModel}
          branchName={branchName}
          worktreeLabel={worktreeLabel}
          showWorktreeContext={showWorktreeContext}
          contextWindowUsage={contextWindowUsage}
          contextWindowLabel={contextWindowLabel}
          onToggleMenu={() => setComposerMenuOpen((open) => !open)}
          onSetMenuOpen={setComposerMenuOpen}
          onPickAttachment={() => fileInputRef.current?.click()}
          onUpdateDraft={(draft) => onUpdateDraft(activeTab.id, draft)}
          onSetModel={(model) => onSetModel(activeTab.id, model)}
          onSetReasoningEffort={(effort) => onSetReasoningEffort(activeTab.id, effort)}
          onSetInteractionMode={(mode) => onSetInteractionMode(activeTab.id, mode)}
          onSetRuntimeMode={(mode) => onSetRuntimeMode(activeTab.id, mode)}
          onOpenBranches={onOpenBranches}
          onSubmit={() => void onSubmitTurn(activeTab.id)}
          onInterrupt={() => void onInterruptTurn(activeTab.id)}
          onRemoveAttachment={(attachmentId) => onRemoveAttachment(activeTab.id, attachmentId)}
          onReplaceNextQueuedTurn={() => onReplaceNextQueuedTurn(activeTab.id)}
        />
      </div>
    </section>
  );
}
