import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Terminal as TerminalIcon, X } from "lucide-react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import "@xterm/xterm/css/xterm.css";
import type { AppSettings, ProjectRecord, TerminalSplitNode, TerminalTab, TerminalThemePreset } from "@shared/types";

type TerminalSurfaceProps = {
  projectId: string;
  project: ProjectRecord;
  tabs: TerminalTab[];
  activeTabId?: string;
  onFocusPane: (paneId: string) => void;
  onSelectTab: (tabId: string) => void;
  onAddTab: () => void;
  onCloseTab: (tabId: string) => void;
  appSettings: AppSettings;
};

type PaneRuntime = {
  sessionId?: string;
  buffer: string;
  exitCode?: number;
};

const runtimeCacheByProject = new Map<string, Record<string, PaneRuntime>>();
const sessionToPaneCacheByProject = new Map<string, Record<string, string>>();

export function TerminalSurface({
  projectId,
  project,
  tabs,
  activeTabId,
  onFocusPane,
  onSelectTab,
  onAddTab,
  onCloseTab,
  appSettings
}: TerminalSurfaceProps) {
  const [runtimeByPane, setRuntimeByPane] = useState<Record<string, PaneRuntime>>(
    () => runtimeCacheByProject.get(projectId) ?? {}
  );
  const runtimeByPaneRef = useRef<Record<string, PaneRuntime>>({});
  const requestedPaneIdsRef = useRef<Set<string>>(new Set());
  const sessionToPaneRef = useRef<Record<string, string>>(sessionToPaneCacheByProject.get(projectId) ?? {});
  const paneIds = useMemo(() => collectPaneIds(tabs), [tabs]);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

  useEffect(() => {
    const cachedRuntime = runtimeCacheByProject.get(projectId) ?? {};
    const cachedSessionMap = sessionToPaneCacheByProject.get(projectId) ?? {};
    setRuntimeByPane(cachedRuntime);
    runtimeByPaneRef.current = cachedRuntime;
    sessionToPaneRef.current = cachedSessionMap;
    requestedPaneIdsRef.current = new Set();
  }, [projectId]);

  useEffect(() => {
    runtimeByPaneRef.current = runtimeByPane;
    runtimeCacheByProject.set(projectId, runtimeByPane);
  }, [runtimeByPane]);

  useEffect(() => {
    sessionToPaneCacheByProject.set(projectId, sessionToPaneRef.current);
  }, [projectId, runtimeByPane]);

  useEffect(() => {
    const paneSet = new Set(paneIds);

    setRuntimeByPane((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([paneId]) => paneSet.has(paneId)));
      return next;
    });

    for (const paneId of paneIds) {
      if (runtimeByPaneRef.current[paneId]?.sessionId || requestedPaneIdsRef.current.has(paneId)) {
        continue;
      }

      requestedPaneIdsRef.current.add(paneId);
      void window.naeditor
        .createTerminalSession(projectId, project)
        .then((session) => {
          requestedPaneIdsRef.current.delete(paneId);
          sessionToPaneRef.current[session.sessionId] = paneId;
          setRuntimeByPane((current) => ({
            ...current,
            [paneId]: {
              sessionId: session.sessionId,
              buffer: session.initialBuffer ?? current[paneId]?.buffer ?? "",
              exitCode: undefined
            }
          }));
        })
        .catch((error) => {
          requestedPaneIdsRef.current.delete(paneId);
          setRuntimeByPane((current) => ({
            ...current,
            [paneId]: {
              sessionId: undefined,
              buffer: `[terminal failed to start: ${error instanceof Error ? error.message : String(error)}]`,
              exitCode: 1
            }
          }));
        });
    }
  }, [paneIds, project, projectId]);

  useEffect(() => {
    for (const runtime of Object.values(runtimeByPaneRef.current)) {
      if (!runtime.sessionId) {
        continue;
      }

      void window.naeditor.getTerminalSnapshot(runtime.sessionId).then((snapshot) => {
        if (!snapshot) {
          return;
        }

        setRuntimeByPane((current) => {
          const paneId = Object.entries(sessionToPaneRef.current).find((entry) => entry[0] === runtime.sessionId)?.[1];
          if (!paneId || !current[paneId]) {
            return current;
          }

          if (current[paneId].buffer === snapshot.buffer && current[paneId].exitCode === (snapshot.exitCode ?? undefined)) {
            return current;
          }

          return {
            ...current,
            [paneId]: {
              ...current[paneId],
              buffer: snapshot.buffer,
              exitCode: snapshot.exitCode ?? undefined
            }
          };
        });
      });
    }
  }, [projectId, paneIds]);

  useEffect(() => {
    const teardownData = window.naeditor.onTerminalData((payload) => {
      const paneId = sessionToPaneRef.current[payload.sessionId];
      if (!paneId) {
        return;
      }

      setRuntimeByPane((current) => ({
        ...current,
        [paneId]: {
          ...(current[paneId] ?? { buffer: "" }),
          sessionId: payload.sessionId,
          buffer: `${current[paneId]?.buffer ?? ""}${payload.data}`,
          exitCode: current[paneId]?.exitCode
        }
      }));
    });

    const teardownExit = window.naeditor.onTerminalExit((payload) => {
      const paneId = sessionToPaneRef.current[payload.sessionId];
      if (!paneId) {
        return;
      }

      setRuntimeByPane((current) => ({
        ...current,
        [paneId]: {
          ...(current[paneId] ?? { buffer: "" }),
          sessionId: payload.sessionId,
          buffer: current[paneId]?.buffer ?? "",
          exitCode: payload.exitCode
        }
      }));
    });

    return () => {
      teardownData();
      teardownExit();
    };
  }, []);

  useEffect(() => {
    const activePaneIds = new Set(paneIds);
    const staleSessionIds = Object.entries(sessionToPaneRef.current)
      .filter(([, paneId]) => !activePaneIds.has(paneId))
      .map(([sessionId]) => sessionId);

    for (const sessionId of staleSessionIds) {
      delete sessionToPaneRef.current[sessionId];
      void window.naeditor.closeTerminal(sessionId);
    }

    sessionToPaneCacheByProject.set(projectId, sessionToPaneRef.current);

    requestedPaneIdsRef.current = new Set([...requestedPaneIdsRef.current].filter((paneId) => activePaneIds.has(paneId)));
  }, [paneIds, projectId]);

  return (
    <section className="surface surface--terminal">
      <div className="surface__header">
        <div className="surface__title">
          <TerminalIcon size={14} strokeWidth={1.9} />
          <span className="eyebrow">Terminal</span>
        </div>
        <div className="terminal-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={tab.id === activeTab?.id ? "terminal-tab terminal-tab--active" : "terminal-tab"}
              onClick={() => onSelectTab(tab.id)}
            >
              <span className="terminal-tab__label">{tab.title}</span>
              <span
                className="terminal-tab__close"
                onClick={(event) => {
                  event.stopPropagation();
                  onCloseTab(tab.id);
                }}
              >
                <X size={12} strokeWidth={2} />
              </span>
            </button>
          ))}
          <button className="terminal-tab terminal-tab--add" onClick={onAddTab} title="New terminal tab">
            <Plus size={13} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="terminal-stack">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={tab.id === activeTab?.id ? "terminal-tabpanel terminal-tabpanel--active" : "terminal-tabpanel"}
          >
            <TerminalSplitTree
              node={tab.root}
              activePaneId={tab.activePaneId}
              runtimeByPane={runtimeByPane}
              onFocusPane={onFocusPane}
              appSettings={appSettings}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

type TerminalSplitTreeProps = {
  node: TerminalSplitNode;
  activePaneId: string;
  runtimeByPane: Record<string, PaneRuntime>;
  onFocusPane: (paneId: string) => void;
  appSettings: AppSettings;
};

function TerminalSplitTree({ node, activePaneId, runtimeByPane, onFocusPane, appSettings }: TerminalSplitTreeProps) {
  if (node.type === "pane") {
    return (
      <div className={node.paneId === activePaneId ? "terminal-pane terminal-pane--active" : "terminal-pane"}>
        <TerminalPaneView
          paneId={node.paneId}
          runtime={runtimeByPane[node.paneId]}
          active={node.paneId === activePaneId}
          onFocus={() => onFocusPane(node.paneId)}
          appSettings={appSettings}
        />
      </div>
    );
  }

  return (
    <div className={node.direction === "vertical" ? "terminal-split terminal-split--vertical" : "terminal-split terminal-split--horizontal"}>
      {node.children.map((child) => (
        <TerminalSplitTree
          key={child.id}
          node={child}
          activePaneId={activePaneId}
          runtimeByPane={runtimeByPane}
          onFocusPane={onFocusPane}
          appSettings={appSettings}
        />
      ))}
    </div>
  );
}

type TerminalPaneViewProps = {
  paneId: string;
  runtime?: PaneRuntime;
  active: boolean;
  onFocus: () => void;
  appSettings: AppSettings;
};

function TerminalPaneView({ paneId: _paneId, runtime, active, onFocus, appSettings }: TerminalPaneViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const appliedLengthRef = useRef(0);
  const lastExitRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const term = new Terminal({
      allowProposedApi: true,
      cursorBlink: true,
      fontFamily: appSettings.terminalFontFamily,
      fontSize: appSettings.terminalFontSize,
      customGlyphs: true,
      rescaleOverlappingGlyphs: true,
      theme: getTerminalTheme(appSettings.terminalTheme)
    });

    const fitAddon = new FitAddon();
    const unicodeAddon = new Unicode11Addon();
    terminalRef.current = term;
    fitAddonRef.current = fitAddon;
    term.loadAddon(unicodeAddon);
    term.loadAddon(fitAddon);
    term.unicode.activeVersion = "11";
    term.open(containerRef.current);
    safeFit(containerRef.current, fitAddon);

    const inputDisposable = term.onData((data) => {
      if (runtime?.sessionId) {
        void window.naeditor.writeTerminal(runtime.sessionId, data);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      safeFit(containerRef.current, fitAddon);
      if (runtime?.sessionId) {
        void window.naeditor.resizeTerminal(runtime.sessionId, term.cols, term.rows);
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      inputDisposable.dispose();
      resizeObserver.disconnect();
      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [appSettings.terminalFontFamily, appSettings.terminalFontSize, appSettings.terminalTheme, runtime?.sessionId]);

  useEffect(() => {
    const term = terminalRef.current;
    if (!term) {
      return;
    }

    const buffer = runtime?.buffer ?? "";
    if (buffer.length < appliedLengthRef.current) {
      term.reset();
      appliedLengthRef.current = 0;
    }

    if (buffer.length > appliedLengthRef.current) {
      term.write(buffer.slice(appliedLengthRef.current));
      appliedLengthRef.current = buffer.length;
    }

    if (runtime?.sessionId) {
      void window.naeditor.resizeTerminal(runtime.sessionId, term.cols, term.rows);
    }

    if (runtime?.exitCode !== undefined && lastExitRef.current !== runtime.exitCode) {
      term.writeln(`\r\n[process exited with code ${runtime.exitCode}]`);
      lastExitRef.current = runtime.exitCode;
    }
  }, [runtime?.buffer, runtime?.exitCode, runtime?.sessionId]);

  useEffect(() => {
    if (active) {
      terminalRef.current?.focus();
      safeFit(containerRef.current, fitAddonRef.current);
    }
  }, [active]);

  useEffect(() => {
    const handleFocus = () => {
      if (terminalRef.current && runtime?.sessionId) {
        terminalRef.current.focus();
        safeFit(containerRef.current, fitAddonRef.current);
        void window.naeditor.resizeTerminal(runtime.sessionId, terminalRef.current.cols, terminalRef.current.rows);
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [runtime?.sessionId]);

  return (
    <div className="terminal-pane__shell" onMouseDown={onFocus}>
      <div className="terminal-live" ref={containerRef} />
    </div>
  );
}

function getTerminalTheme(theme: TerminalThemePreset) {
  switch (theme) {
    case "spacecode-light":
      return {
        background: "#f8fafc",
        foreground: "#1f2937",
        cursor: "#111827",
        selectionBackground: "rgba(37, 99, 235, 0.22)"
      };
    case "solarized-dark":
      return {
        background: "#002b36",
        foreground: "#93a1a1",
        cursor: "#fdf6e3",
        selectionBackground: "rgba(38, 139, 210, 0.25)"
      };
    case "solarized-light":
      return {
        background: "#fdf6e3",
        foreground: "#586e75",
        cursor: "#586e75",
        selectionBackground: "rgba(38, 139, 210, 0.18)"
      };
    case "github-dark":
      return {
        background: "#0d1117",
        foreground: "#c9d1d9",
        cursor: "#58a6ff",
        selectionBackground: "rgba(56, 139, 253, 0.24)"
      };
    case "github-light":
      return {
        background: "#ffffff",
        foreground: "#1f2328",
        cursor: "#0969da",
        selectionBackground: "rgba(9, 105, 218, 0.16)"
      };
    case "dracula":
      return {
        background: "#282a36",
        foreground: "#f8f8f2",
        cursor: "#ff79c6",
        selectionBackground: "rgba(189, 147, 249, 0.24)"
      };
    case "nord":
      return {
        background: "#2e3440",
        foreground: "#d8dee9",
        cursor: "#88c0d0",
        selectionBackground: "rgba(94, 129, 172, 0.24)"
      };
    case "gruvbox-dark":
      return {
        background: "#282828",
        foreground: "#ebdbb2",
        cursor: "#fabd2f",
        selectionBackground: "rgba(146, 131, 116, 0.24)"
      };
    default:
      return {
        background: "#090f18",
        foreground: "#e6edf3",
        cursor: "#e6edf3",
        selectionBackground: "rgba(47, 125, 244, 0.35)"
      };
  }
}

function collectPaneIds(tabs: TerminalTab[]) {
  return tabs.flatMap((tab) => flattenPaneIds(tab.root));
}

function flattenPaneIds(node: TerminalSplitNode): string[] {
  if (node.type === "pane") {
    return [node.paneId];
  }

  return node.children.flatMap((child) => flattenPaneIds(child));
}

function safeFit(container: HTMLDivElement | null, fitAddon: FitAddon | null) {
  if (!container || !fitAddon) {
    return;
  }

  if (container.clientWidth < 20 || container.clientHeight < 20) {
    return;
  }

  try {
    fitAddon.fit();
  } catch {
    // Ignore transient xterm measurement failures while the surface is being laid out.
  }
}
