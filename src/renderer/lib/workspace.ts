import type {
  BrowserTab,
  CodeTab,
  ProjectWorkspace,
  SnapWidth,
  SurfaceId,
  TerminalPane,
  TerminalSplitLeaf,
  TerminalTab,
  WorkspaceTrackState
} from "@shared/types";

export const snapWidthToRatio: Record<SnapWidth, number> = {
  "1/3": 1 / 3,
  "1/2": 1 / 2,
  "2/3": 2 / 3,
  "3/4": 3 / 4,
  "1/1": 1
};

const widthOrder: SnapWidth[] = ["1/3", "1/2", "2/3", "3/4", "1/1"];
export const defaultSurfaceOrder: SurfaceId[] = ["editor", "code", "terminal", "browser"];

export const defaultTrackState: WorkspaceTrackState = {
  order: [...defaultSurfaceOrder],
  widths: {
    editor: "1/1",
    code: "3/4",
    terminal: "2/3",
    browser: "1/1"
  },
  activeSurface: "editor",
  viewportOffset: 0,
  controlsVisible: false,
  inspector: {
    visible: true,
    dock: "left",
    mode: "files",
    width: 280
  }
};

export function createEmptyWorkspace(): ProjectWorkspace {
  const initialBrowserTab = createBrowserTab("");
  const initialCodeTab = createCodeTab();
  const initialTerminalTab = createTerminalTab();
  return {
    track: {
      order: [...defaultTrackState.order],
      widths: { ...defaultTrackState.widths },
      activeSurface: defaultTrackState.activeSurface,
      viewportOffset: defaultTrackState.viewportOffset,
      controlsVisible: defaultTrackState.controlsVisible,
      inspector: { ...defaultTrackState.inspector }
    },
    openTabs: [],
    codeTabs: [initialCodeTab],
    activeCodeTabId: initialCodeTab.id,
    terminalTabs: [initialTerminalTab],
    activeTerminalTabId: initialTerminalTab.id,
    browserUrl: "",
    browserTabs: [initialBrowserTab],
    activeBrowserTabId: initialBrowserTab.id
  };
}

export function createCodeTab(): CodeTab {
  return {
    id: `code-tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: "Code",
    description: "Codex session",
    status: "idle",
    availableModels: [],
    selectedModel: undefined,
    reasoningEffort: "medium",
    runtimeMode: "full-access",
    interactionMode: "default",
    draft: "",
    attachments: [],
    messages: []
  };
}

export function createBrowserTab(url: string): BrowserTab {
  return {
    id: `browser-tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url,
    title: "New Tab"
  };
}

export function createTerminalPane(): TerminalPane {
  return {
    id: `terminal-pane-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  };
}

export function createTerminalLeaf(paneId?: string): TerminalSplitLeaf {
  return {
    id: `terminal-leaf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "pane",
    paneId: paneId ?? createTerminalPane().id
  };
}

export function createTerminalTab(): TerminalTab {
  const pane = createTerminalPane();
  return {
    id: `terminal-tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: "Terminal",
    root: createTerminalLeaf(pane.id),
    activePaneId: pane.id
  };
}

type SurfaceSegment = {
  surface: SurfaceId;
  start: number;
  end: number;
};

export function deriveSurfaceSegments(track: WorkspaceTrackState): SurfaceSegment[] {
  let cursor = 0;
  return track.order.map((surface) => {
    const width = snapWidthToRatio[track.widths[surface]];
    const segment = {
      surface,
      start: cursor,
      end: cursor + width
    };
    cursor += width;
    return segment;
  });
}

export function getTrackWidth(track: WorkspaceTrackState) {
  return deriveSurfaceSegments(track).at(-1)?.end ?? 1;
}

export function clampViewportOffset(track: WorkspaceTrackState, offset: number) {
  return Math.max(0, Math.min(getTrackWidth(track) - 1, offset));
}

export function deriveViewportSteps(track: WorkspaceTrackState) {
  const totalWidth = getTrackWidth(track);
  const lastOffset = Math.max(0, totalWidth - 1);
  const stepCount = Math.max(1, Math.ceil(totalWidth));

  return Array.from({ length: stepCount }, (_value, index) => {
    const offset = Math.min(index, lastOffset);
    const visibleSurfaces = deriveVisibleSurfaces(track, offset);
    return {
      id: `viewport-${index}`,
      index,
      offset,
      label: visibleSurfaces.join(" + ")
    };
  });
}

export function deriveVisibleSurfaces(track: WorkspaceTrackState, offset: number) {
  const viewportStart = offset;
  const viewportEnd = offset + 1;

  return deriveSurfaceSegments(track)
    .filter((segment) => segment.end > viewportStart && segment.start < viewportEnd)
    .map((segment) => titleCaseSurface(segment.surface));
}

export function getViewportLabel(track: WorkspaceTrackState, offset: number) {
  return deriveVisibleSurfaces(track, offset).join(" + ");
}

export function getActiveSurfaceAtOffset(track: WorkspaceTrackState, offset: number): SurfaceId {
  const viewportCenter = offset + 0.5;
  return (
    deriveSurfaceSegments(track).find((segment) => viewportCenter >= segment.start && viewportCenter <= segment.end)
      ?.surface ?? "editor"
  );
}

export function getSurfaceAnchorOffset(track: WorkspaceTrackState, surface: SurfaceId) {
  const segment = deriveSurfaceSegments(track).find((entry) => entry.surface === surface);
  return clampViewportOffset(track, segment?.start ?? 0);
}

function titleCaseSurface(surface: SurfaceId) {
  return surface.charAt(0).toUpperCase() + surface.slice(1);
}

export function getNextWidth(width: SnapWidth, direction: "increase" | "decrease"): SnapWidth {
  const currentIndex = widthOrder.indexOf(width);
  const nextIndex =
    direction === "increase"
      ? Math.min(widthOrder.length - 1, currentIndex + 1)
      : Math.max(0, currentIndex - 1);

  return widthOrder[nextIndex];
}

export function normalizeSurfaceOrder(order?: SurfaceId[]): SurfaceId[] {
  const next = Array.isArray(order) ? order.filter((surface): surface is SurfaceId => defaultSurfaceOrder.includes(surface)) : [];
  const missing = defaultSurfaceOrder.filter((surface) => !next.includes(surface));
  return [...next, ...missing];
}
