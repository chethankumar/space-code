import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, Globe, Plus, RotateCw, Terminal, X } from "lucide-react";
import type { BrowserTab, BrowserViewState, PortForwardInfo, ProjectRecord } from "@shared/types";

type BrowserSurfaceProps = {
  project: ProjectRecord;
  url: string;
  tabs: BrowserTab[];
  activeTabId?: string;
  viewportOffset: number;
  onBrowserUrlChange: (url: string) => void;
  onAddTab: () => void;
  onCloseTab: (tabId: string) => void;
  onSelectTab: (tabId: string) => void;
  onBrowserStateChange: (state: { url: string; title: string; faviconUrl?: string }, tabId?: string) => void;
  portForward?: PortForwardInfo;
  onPortForwardChange: (info?: PortForwardInfo) => void;
  devtoolsRequestKey: number;
};

type BrowserWebview = HTMLElement & {
  src: string;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  getURL: () => string;
  getTitle: () => string;
  isLoading: () => boolean;
  loadURL: (url: string) => Promise<void>;
  reload: () => void;
  goBack: () => void;
  goForward: () => void;
  openDevTools: () => void;
};

const EMPTY_BROWSER_STATE: BrowserViewState = {
  url: "about:blank",
  title: "Preview",
  canGoBack: false,
  canGoForward: false,
  isLoading: false
};

export function BrowserSurface({
  project,
  url,
  tabs,
  activeTabId,
  onBrowserUrlChange,
  onAddTab,
  onCloseTab,
  onSelectTab,
  onBrowserStateChange,
  portForward,
  onPortForwardChange,
  devtoolsRequestKey
}: BrowserSurfaceProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [forwardBusy, setForwardBusy] = useState(false);
  const [draftUrl, setDraftUrl] = useState(url);
  const [browserStates, setBrowserStates] = useState<Record<string, BrowserViewState>>({});
  const [previewWidth, setPreviewWidth] = useState<number | null>(null);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const browserState = activeTab ? browserStates[activeTab.id] ?? EMPTY_BROWSER_STATE : EMPTY_BROWSER_STATE;

  const effectiveUrl = useMemo(() => {
    if (project.kind === "remote" && portForward?.active) {
      return portForward.localUrl;
    }
    return url;
  }, [portForward?.active, portForward?.localUrl, project.kind, url]);

  const normalizedUrl = useMemo(() => normalizeBrowserUrl(effectiveUrl), [effectiveUrl]);

  useEffect(() => {
    setDraftUrl(url);
  }, [activeTabId, url]);

  useEffect(() => {
    if (!devtoolsRequestKey) {
      return;
    }
    document.querySelector<BrowserWebview>(".browser-webview--active")?.openDevTools();
  }, [devtoolsRequestKey]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }

    const clampWidth = () => {
      const maxWidth = Math.max(360, frame.clientWidth);
      setPreviewWidth((current) => {
        if (current === null) {
          return maxWidth;
        }
        return Math.max(360, Math.min(maxWidth, current));
      });
    };

    clampWidth();
    const observer = new ResizeObserver(clampWidth);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const handleStateSnapshot = useCallback((tabId: string, state: BrowserViewState) => {
    setBrowserStates((current) => {
      const previous = current[tabId];
      if (
        previous &&
        previous.url === state.url &&
        previous.title === state.title &&
        previous.faviconUrl === state.faviconUrl &&
        previous.canGoBack === state.canGoBack &&
        previous.canGoForward === state.canGoForward &&
        previous.isLoading === state.isLoading
      ) {
        return current;
      }

      return {
        ...current,
        [tabId]: state
      };
    });
  }, []);

  const commitExplicitUrl = (nextValue: string) => {
    const nextUrl = nextValue.trim();
    if (nextUrl === url) {
      return;
    }
    onBrowserUrlChange(nextUrl);
  };

  const currentExternalUrl =
    browserState.url && browserState.url !== "about:blank" ? browserState.url : normalizeBrowserUrl(draftUrl);

  const startResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }

    event.preventDefault();
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startWidth = previewWidth ?? frame.clientWidth;
    const maxWidth = () => Math.max(360, frame.clientWidth);

    const handleMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.max(360, Math.min(maxWidth(), startWidth + (moveEvent.clientX - startX)));
      setPreviewWidth(nextWidth);
    };

    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    event.currentTarget.setPointerCapture(pointerId);
  };

  return (
    <section className="surface surface--browser">
      <div className="browser-topbar">
        <div className="surface__title">
          <Globe size={14} strokeWidth={1.9} />
          <span className="eyebrow">Browser</span>
        </div>
        <div className="browser-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`browser-tab ${tab.id === activeTabId ? "browser-tab--active" : ""}`}
              title={tab.title || tab.url || "New Tab"}
              onClick={() => onSelectTab(tab.id)}
            >
              {tab.faviconUrl ? (
                <img className="browser-tab__favicon" src={tab.faviconUrl} alt="" />
              ) : (
                <Globe size={12} strokeWidth={1.8} className="browser-tab__fallback" />
              )}
              <span className="browser-tab__label">{tab.title || tab.url || "New Tab"}</span>
              <span
                className="browser-tab__close"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onCloseTab(tab.id);
                }}
              >
                <X size={12} strokeWidth={2} />
              </span>
            </button>
          ))}
          <button className="browser-tab browser-tab--add" title="New tab" onClick={onAddTab}>
            <Plus size={13} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="browser-toolbar">
        <div className="browser-toolbar__nav">
          <button
            className="browser-tool-button"
            disabled={!browserState.canGoBack}
            title="Back"
            onClick={() => document.querySelector<BrowserWebview>(".browser-webview--active")?.goBack()}
          >
            <ArrowLeft size={14} strokeWidth={1.9} />
          </button>
          <button
            className="browser-tool-button"
            disabled={!browserState.canGoForward}
            title="Forward"
            onClick={() => document.querySelector<BrowserWebview>(".browser-webview--active")?.goForward()}
          >
            <ArrowRight size={14} strokeWidth={1.9} />
          </button>
          <button
            className="browser-tool-button"
            title="Reload"
            onClick={() => {
              if (draftUrl.trim() !== url.trim()) {
                commitExplicitUrl(draftUrl);
                return;
              }
              document.querySelector<BrowserWebview>(".browser-webview--active")?.reload();
            }}
          >
            <RotateCw size={14} strokeWidth={1.9} className={browserState.isLoading ? "browser-tool-button__spin" : ""} />
          </button>
        </div>

        <div className="browser-toolbar__actions">
          <button
            className="browser-tool-button"
            title="Open in external browser"
            onClick={() => void window.naeditor.openExternalUrl(currentExternalUrl)}
          >
            <ExternalLink size={14} strokeWidth={1.9} />
          </button>
          <button
            className="browser-tool-button"
            title="Open devtools"
            onClick={() => document.querySelector<BrowserWebview>(".browser-webview--active")?.openDevTools()}
          >
            <Terminal size={14} strokeWidth={1.9} />
          </button>
        </div>

        <input
          className="browser-input"
          value={draftUrl}
          onChange={(event) => setDraftUrl(event.target.value)}
          onBlur={(event) => commitExplicitUrl(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitExplicitUrl(event.currentTarget.value);
            }
          }}
          placeholder="http://localhost:3000"
        />

        {project.kind === "remote" ? (
          <button
            className="ghost-button browser-forward-button"
            disabled={forwardBusy || !draftUrl.trim()}
            onClick={async () => {
              if (portForward?.active) {
                setForwardBusy(true);
                await window.naeditor.stopPortForward(project.id);
                onPortForwardChange(undefined);
                setForwardBusy(false);
                return;
              }

              setForwardBusy(true);
              const nextUrl = draftUrl.trim();
              if (nextUrl && nextUrl !== url) {
                onBrowserUrlChange(nextUrl);
              }
              const info = await window.naeditor.ensurePortForward(project, nextUrl);
              onPortForwardChange(info ?? undefined);
              setForwardBusy(false);
            }}
          >
            {portForward?.active ? "Stop Tunnel" : "Forward Preview"}
          </button>
        ) : null}
      </div>

      <div className="browser-frame" ref={frameRef}>
        <div
          className="browser-preview-shell"
          style={{
            width: previewWidth ? `${previewWidth}px` : "100%"
          }}
        >
          <button
            className="browser-preview-handle"
            title="Resize preview viewport"
            aria-label="Resize preview viewport"
            onPointerDown={startResize}
          >
            <span className="browser-preview-handle__grip" />
          </button>
        {tabs.some((tab) => normalizeBrowserUrl(tab.id === activeTabId ? effectiveUrl : tab.url) !== "about:blank") ? (
          <>
            {tabs.map((tab) => (
              <BrowserTabWebview
                key={tab.id}
                projectId={project.id}
                tab={tab}
                active={tab.id === activeTabId}
                src={normalizeBrowserUrl(tab.id === activeTabId ? effectiveUrl : tab.url)}
                onStateChange={onBrowserStateChange}
                onStateSnapshot={handleStateSnapshot}
              />
            ))}
          </>
        ) : (
          <div className="browser-frame__overlay">
            <div className="browser-frame__meta">
              <span>{activeTab?.url || "Set a preview URL to attach a live browser surface."}</span>
              {project.kind === "remote" ? (
                <span className="browser-frame__submeta">
                  {portForward?.active
                    ? `Forwarded ${portForward.remotePort} -> localhost:${portForward.localPort}`
                    : "Remote preview requires SSH port forwarding for localhost apps"}
                </span>
              ) : null}
            </div>
          </div>
        )}
        </div>
      </div>
    </section>
  );
}

type BrowserTabWebviewProps = {
  projectId: string;
  tab: BrowserTab;
  active: boolean;
  src: string;
  onStateChange: (state: { url: string; title: string; faviconUrl?: string }, tabId?: string) => void;
  onStateSnapshot: (tabId: string, state: BrowserViewState) => void;
};

function BrowserTabWebview({ projectId, tab, active, src, onStateChange, onStateSnapshot }: BrowserTabWebviewProps) {
  const webviewRef = useRef<BrowserWebview | null>(null);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) {
      return;
    }

    const syncState = (override?: Partial<BrowserViewState>) => {
      const resolvedUrl = safeWebviewUrl(webview);
      const nextUrl = resolvedUrl === "about:blank" && src !== "about:blank" ? src : resolvedUrl;
      const nextState: BrowserViewState = {
        url: nextUrl,
        title: override?.title ?? (safeWebviewTitle(webview) || tab.title || "Preview"),
        faviconUrl: override?.faviconUrl ?? tab.faviconUrl,
        canGoBack: safeCanGoBack(webview),
        canGoForward: safeCanGoForward(webview),
        isLoading: safeIsLoading(webview)
      };
      onStateSnapshot(tab.id, nextState);
      onStateChange(
        {
          url: nextState.url,
          title: nextState.title,
          faviconUrl: nextState.faviconUrl
        },
        tab.id
      );
    };

    const handleTitleUpdated = (event: Event) => {
      const title = (event as Event & { title?: string }).title ?? (safeWebviewTitle(webview) || "Preview");
      syncState({ title });
    };

    const handleFaviconUpdated = (event: Event) => {
      const faviconUrl = (event as Event & { favicons?: string[] }).favicons?.[0];
      syncState({ faviconUrl });
    };

    webview.addEventListener("dom-ready", syncState as EventListener);
    webview.addEventListener("did-start-loading", syncState as EventListener);
    webview.addEventListener("did-stop-loading", syncState as EventListener);
    webview.addEventListener("did-navigate", syncState as EventListener);
    webview.addEventListener("did-navigate-in-page", syncState as EventListener);
    webview.addEventListener("page-title-updated", handleTitleUpdated as EventListener);
    webview.addEventListener("page-favicon-updated", handleFaviconUpdated as EventListener);

    syncState();

    return () => {
      webview.removeEventListener("dom-ready", syncState as EventListener);
      webview.removeEventListener("did-start-loading", syncState as EventListener);
      webview.removeEventListener("did-stop-loading", syncState as EventListener);
      webview.removeEventListener("did-navigate", syncState as EventListener);
      webview.removeEventListener("did-navigate-in-page", syncState as EventListener);
      webview.removeEventListener("page-title-updated", handleTitleUpdated as EventListener);
      webview.removeEventListener("page-favicon-updated", handleFaviconUpdated as EventListener);
    };
  }, [src, tab.id]);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) {
      return;
    }
    if (webview.src !== src) {
      webview.src = src;
    }
  }, [src]);

  return (
    <webview
      ref={(node) => {
        webviewRef.current = node as BrowserWebview | null;
      }}
      className={`browser-webview ${active ? "browser-webview--active" : "browser-webview--inactive"}`}
      partition={`persist:browser-${projectId}-${tab.id}`}
      src={src}
    />
  );
}

function safeWebviewUrl(webview: BrowserWebview) {
  try {
    return webview.getURL() || "about:blank";
  } catch {
    return "about:blank";
  }
}

function safeWebviewTitle(webview: BrowserWebview) {
  try {
    return webview.getTitle() || "Preview";
  } catch {
    return "Preview";
  }
}

function safeCanGoBack(webview: BrowserWebview) {
  try {
    return webview.canGoBack();
  } catch {
    return false;
  }
}

function safeCanGoForward(webview: BrowserWebview) {
  try {
    return webview.canGoForward();
  } catch {
    return false;
  }
}

function safeIsLoading(webview: BrowserWebview) {
  try {
    return webview.isLoading();
  } catch {
    return false;
  }
}

function normalizeBrowserUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "about:blank";
  }

  const withProtocol = trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `http://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    const hostname = parsed.hostname.trim().toLowerCase();
    const navigable =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) ||
      (hostname.includes(".") && hostname.length > 3);

    return navigable ? parsed.toString() : "about:blank";
  } catch {
    return "about:blank";
  }
}
