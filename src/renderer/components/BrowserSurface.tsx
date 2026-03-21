import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, Globe, Plus, RotateCw, Terminal, X } from "lucide-react";
import type { BrowserTab, PortForwardInfo, ProjectRecord } from "@shared/types";

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

type BrowserState = {
  url: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
};

const EMPTY_BROWSER_STATE: BrowserState = {
  url: "about:blank",
  isLoading: false,
  canGoBack: false,
  canGoForward: false
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
  const [browserState, setBrowserState] = useState<BrowserState>(EMPTY_BROWSER_STATE);
  const [previewWidth, setPreviewWidth] = useState<number | null>(null);

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
    const unsubscribe = window.naeditor.onBrowserState((payload) => {
      if (payload.projectId === project.id) {
        setBrowserState((prev) => ({
          ...prev,
          ...payload.state
        }));
      }
    });
    return unsubscribe;
  }, [project.id]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    let syncTimeout: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => {
      clearTimeout(syncTimeout);
      syncTimeout = setTimeout(() => {
        const rect = frame.getBoundingClientRect();
      window.naeditor.syncBrowserView({
        projectId: project.id,
        url: normalizedUrl,
        bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        visible: true,
        devtools: false
      });
      }, 50);
    });

    observer.observe(frame);

    const initialRect = frame.getBoundingClientRect();
    window.naeditor.syncBrowserView({
      projectId: project.id,
      url: normalizedUrl,
      bounds: { x: initialRect.x, y: initialRect.y, width: initialRect.width, height: initialRect.height },
      visible: true,
      devtools: false
    });

    return () => {
      observer.disconnect();
      clearTimeout(syncTimeout);
      window.naeditor.hideBrowserView(project.id);
    };
  }, [project.id, normalizedUrl]);

  useEffect(() => {
    if (!devtoolsRequestKey) return;
    window.naeditor.browserCommand(project.id, "devtools");
  }, [devtoolsRequestKey, project.id]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const clampWidth = () => {
      const maxWidth = Math.max(360, frame.clientWidth);
      setPreviewWidth((current) => {
        if (current === null) return maxWidth;
        return Math.max(360, Math.min(maxWidth, current));
      });
    };

    clampWidth();
    const observer = new ResizeObserver(clampWidth);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const commitExplicitUrl = useCallback((nextValue: string) => {
    const nextUrl = nextValue.trim();
    if (nextUrl === url) return;
    onBrowserUrlChange(nextUrl);
    window.naeditor.loadBrowserUrl(project.id, normalizeBrowserUrl(nextUrl));
  }, [url, onBrowserUrlChange, project.id]);

  const currentExternalUrl = browserState.url && browserState.url !== "about:blank" 
    ? browserState.url 
    : normalizeBrowserUrl(draftUrl);

  const startResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const frame = frameRef.current;
    if (!frame) return;

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
            onClick={() => window.naeditor.browserCommand(project.id, "back")}
          >
            <ArrowLeft size={14} strokeWidth={1.9} />
          </button>
          <button
            className="browser-tool-button"
            disabled={!browserState.canGoForward}
            title="Forward"
            onClick={() => window.naeditor.browserCommand(project.id, "forward")}
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
              window.naeditor.browserCommand(project.id, "reload");
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
            title="Toggle devtools"
            onClick={() => window.naeditor.browserCommand(project.id, "devtools")}
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
        {normalizedUrl !== "about:blank" ? (
          <div className="browser-view-placeholder" />
        ) : (
          <div className="browser-frame__overlay">
            <div className="browser-frame__meta">
              <span>{url || "Set a preview URL to attach a live browser surface."}</span>
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

function normalizeBrowserUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "about:blank";

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