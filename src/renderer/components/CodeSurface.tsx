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
  CodeReasoningEffort,
  CodeRuntimeMode,
  CodeTab,
  ProjectRecord
} from "@shared/types";

type CodeSurfaceProps = {
  project: ProjectRecord;
  tabs: CodeTab[];
  activeTabId?: string;
  branchName?: string;
  worktreeLabel?: string;
  mentionBasePath?: string;
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
  return new Intl.DateTimeFormat(undefined, {
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

function CodeComposer({
  tab,
  composerRef,
  overflowMenuRef,
  compact,
  menuOpen,
  isBusy,
  canSend,
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
  onRemoveAttachment
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
                  contextWindowUsage !== undefined
                    ? `Context window used: ${contextWindowUsage}%${contextWindowLabel ? ` (${contextWindowLabel})` : ""}`
                    : "Context window usage will appear once Codex reports token usage"
                }
              >
                <Gauge size={15} strokeWidth={1.9} />
                <span>{contextWindowUsage !== undefined ? `${contextWindowUsage}%` : "Ctx"}</span>
              </span>
              {isBusy ? (
                <button
                  className="code-action-button code-action-button--icon"
                  onClick={onInterrupt}
                  title="Stop current response"
                >
                  <Square size={13} strokeWidth={2} />
                </button>
              ) : null}
              <button className="code-launcher__send" disabled={!canSend} onClick={onSubmit}>
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
                    {showWorktreeContext ? <div className="code-overflow__meta">{worktreeLabel}</div> : null}
                  </div>
                ) : null}
              </div>
              {isBusy ? (
                <button className="code-action-button" onClick={onInterrupt} title="Stop current response">
                  <Square size={13} strokeWidth={2} />
                </button>
              ) : null}
              <button className="code-send-button" disabled={!canSend} onClick={onSubmit}>
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
    activeTab.tokenUsage?.modelContextWindow && activeTab.tokenUsage.modelContextWindow > 0
      ? Math.min(100, Math.max(0, Math.round((activeTab.tokenUsage.totalTokens / activeTab.tokenUsage.modelContextWindow) * 100)))
      : undefined;
  const contextWindowLabel =
    activeTab.tokenUsage?.modelContextWindow && activeTab.tokenUsage.modelContextWindow > 0
      ? `${activeTab.tokenUsage.totalTokens.toLocaleString()} / ${activeTab.tokenUsage.modelContextWindow.toLocaleString()}`
      : undefined;
  const showWorktreeContext =
    !!worktreeLabel &&
    worktreeLabel.trim().length > 0 &&
    worktreeLabel !== project.name;

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
    return <section className="surface surface--code" />;
  }

  if (project.kind !== "local") {
    return (
      <section className="surface surface--code">
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
  const canSend = (activeTab.draft.trim().length > 0 || activeTab.attachments.length > 0) && !isBusy;
  const isEmpty = activeTab.messages.length === 0;
  return (
    <section className="surface surface--code">
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

          {activeTab.messages
            .filter((message) => message.kind !== "reasoning")
            .map((message) => (
            message.kind === "assistant" || message.kind === "user" ? (
              <div
                key={message.id}
                className={`code-message code-message--${message.kind} ${
                  message.streaming ? "code-message--streaming" : ""
                }`}
              >
                <div className="code-message__header">
                  <div className="code-message__role">
                    <span className="code-message__avatar">{getMessageBadge(message.kind)}</span>
                    <span className="code-message__title">{getMessageTitle(message.kind, message.title)}</span>
                  </div>
                  {message.metadata ? (
                    <div className="code-message__metadata">
                      {Object.values(message.metadata).map((value) => (
                        <span key={value} className="code-message__meta-chip">
                          {value}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="code-message__body">
                  {message.text
                    ? renderMessageBody(message.text)
                    : message.streaming
                      ? "…"
                      : null}
                </div>
                {message.kind === "assistant" && (message.completedAt || message.elapsedMs || message.changedFiles?.length) ? (
                  <div className="code-message__footer">
                    <div className="code-message__foot-meta">
                      {formatMessageTime(message.completedAt ?? message.createdAt) ? (
                        <span>{formatMessageTime(message.completedAt ?? message.createdAt)}</span>
                      ) : null}
                      {formatElapsedMs(message.elapsedMs) ? (
                        <span>{formatElapsedMs(message.elapsedMs)}</span>
                      ) : null}
                    </div>
                    {message.changedFiles?.length ? (
                      <div className="code-message__changed-files">
                        {message.changedFiles.map((file) => (
                          <span key={`${message.id}-${file.path}`} className="code-message__changed-file">
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
                {message.kind === "user" && formatMessageTime(message.createdAt) ? (
                  <div className="code-message__footer">
                    <div className="code-message__foot-meta">
                      <span>{formatMessageTime(message.createdAt)}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : message.kind === "tool" ? (
              <div
                key={message.id}
                className={`code-command-block${message.streaming ? " code-command-block--streaming" : ""}`}
              >
                <div className="code-command-block__icon">{">_"}</div>
                <div className="code-command-block__content">
                  <span className="code-command-block__label">Command run -</span>
                  <span className="code-command-block__text">{message.text || "Running command…"}</span>
                </div>
              </div>
            ) : (
              <details
                key={message.id}
                className={`code-message code-message--${message.kind} code-message--event ${
                  message.streaming ? "code-message--streaming" : ""
                }`}
                open={message.streaming || message.kind === "status"}
              >
                <summary className="code-message__summary">
                  <div className="code-message__role">
                    <span className="code-message__avatar">{getMessageBadge(message.kind)}</span>
                    <span className="code-message__title">{getMessageTitle(message.kind, message.title)}</span>
                  </div>
                  <div className="code-message__summary-right">
                    {message.metadata ? (
                      <div className="code-message__metadata">
                        {Object.values(message.metadata).map((value) => (
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
                  {message.text
                    ? renderMessageBody(message.text)
                    : message.streaming
                      ? "…"
                      : null}
                </div>
              </details>
            )
          ))}

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
        />
      </div>
    </section>
  );
}
