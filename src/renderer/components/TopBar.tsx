import clsx from "clsx";
import { ArrowLeftRight, ChevronLeft, ChevronRight, EyeOff, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { GitDetails, ProjectRecord, SnapWidth, SurfaceId, WorkspaceTrackState } from "@shared/types";
import { getTrackWidth, getVisibleSurfaceOrder, normalizeSurfaceOrder, snapWidthToRatio } from "@renderer/lib/workspace";

const widthOptions: SnapWidth[] = ["1/4", "1/3", "1/2", "2/3", "3/4", "1/1"];

type TopBarProps = {
  project?: ProjectRecord;
  track?: WorkspaceTrackState;
  git?: GitDetails;
  onAnchorSurface: (surface: SurfaceId) => void;
  onSetSurfaceWidth: (surface: SurfaceId, width: SnapWidth) => void;
  onMoveSurface: (surface: SurfaceId, direction: "left" | "right") => void;
  onToggleControls: () => void;
  onToggleSurfaceVisibility: (surface: SurfaceId) => void;
};

export function TopBar({
  project,
  track,
  git,
  onAnchorSurface,
  onSetSurfaceWidth,
  onMoveSurface,
  onToggleControls,
  onToggleSurfaceVisibility
}: TopBarProps) {
  const [selectedSurface, setSelectedSurface] = useState<SurfaceId>("editor");

  useEffect(() => {
    if (track?.activeSurface) {
      setSelectedSurface(track.activeSurface);
    }
  }, [track?.activeSurface]);

  const total = track ? getTrackWidth(track) : 1;
  const visibleOrder = useMemo<SurfaceId[]>(
    () => (track ? getVisibleSurfaceOrder(track) : ["editor", "code", "terminal", "browser"]),
    [track]
  );
  const allSurfaces = useMemo<SurfaceId[]>(
    () => (track ? normalizeSurfaceOrder(track.order) : ["editor", "code", "terminal", "browser"]),
    [track]
  );
  const selected = visibleOrder.includes(selectedSurface) ? selectedSurface : visibleOrder[0] ?? "editor";
  const selectedIndex = visibleOrder.indexOf(selected);
  const segmentWidths = useMemo(
    () =>
      track
        ? (Object.fromEntries(
            visibleOrder.map((surface) => [surface, `${(snapWidthToRatio[track.widths[surface]] / total) * 100}%`])
          ) as Record<SurfaceId, string>)
        : ({
            editor: "25%",
            code: "25%",
            terminal: "25%",
            browser: "25%"
          } as Record<SurfaceId, string>),
    [total, track, visibleOrder]
  );

  if (!project || !track) {
    return (
      <header className="top-bar">
        <div className="top-bar__identity">
          <div className="top-bar__project-mark top-bar__project-mark--empty" />
          <div className="top-bar__project-copy">
            <strong>Add your first project</strong>
            <span className="top-bar__meta">Workspace track will appear here.</span>
          </div>
        </div>
      </header>
    );
  }

  const projectLocation = project.kind === "remote" ? `${project.host}:${project.rootPath}` : project.rootPath;

  return (
    <header className="top-bar">
      <div className="top-bar__identity">
        <div className="top-bar__project-mark" style={{ backgroundColor: project.color }} />
        <div className="top-bar__project-copy">
          <strong>{project.name}</strong>
          <span className="top-bar__meta top-bar__meta--singleline">
            <span className="top-bar__path">{projectLocation}</span>
            {" • "}
            {project.kind === "remote" ? "Remote" : "Local"}
            {" • "}
            {git?.branch ? git.branch : "No Git"}
          </span>
        </div>
      </div>

      <div className="top-bar__track-control top-bar__track-control--interactive">
        <div className="top-bar__track-head">
          <div className="top-bar__minimap">
            <div className="top-bar__segments">
              {visibleOrder.map((surface) => (
                <button
                  key={surface}
                  className={clsx(
                    "top-bar__segment",
                    `top-bar__segment--${surface}`,
                    selected === surface && "top-bar__segment--selected"
                  )}
                  style={{ width: segmentWidths[surface] }}
                  onClick={() => {
                    setSelectedSurface(surface);
                    onAnchorSurface(surface);
                  }}
                  title={`Focus ${surface}`}
                >
                  <span className="top-bar__segment-label">{surface}</span>
                  <span className="top-bar__segment-width">{track.widths[surface]}</span>
                </button>
              ))}
              <div
                className="top-bar__viewport"
                style={{
                  left: `${(track.viewportOffset / total) * 100}%`,
                  width: `${(1 / total) * 100}%`
                }}
              />
            </div>
          </div>

          <button
            className={clsx("top-bar__settings-button", track.controlsVisible && "top-bar__settings-button--active")}
            onClick={onToggleControls}
            title={track.controlsVisible ? "Hide workspace controls" : "Show workspace controls"}
          >
            <Settings2 size={14} strokeWidth={1.9} />
          </button>
        </div>

        {track.controlsVisible ? (
          <div className="top-bar__track-actions">
            <div className="top-bar__surface-actions">
              <button
                className="top-bar__control-button"
                disabled={selectedIndex <= 0}
                onClick={() => onMoveSurface(selected, "left")}
                title={`Move ${selected} left`}
              >
                <ChevronLeft size={14} strokeWidth={1.9} />
              </button>
              <div className="top-bar__surface-name">
                <ArrowLeftRight size={12} strokeWidth={1.9} />
                <span>{selected}</span>
              </div>
              <button
                className="top-bar__control-button"
                disabled={selectedIndex === -1 || selectedIndex >= visibleOrder.length - 1}
                onClick={() => onMoveSurface(selected, "right")}
                title={`Move ${selected} right`}
              >
                <ChevronRight size={14} strokeWidth={1.9} />
              </button>
            </div>

            <div className="top-bar__visibility-picker">
              {allSurfaces.map((surface) => {
                const visible = track.visibleSurfaces[surface] ?? true;
                const isLastVisible = visible && visibleOrder.length <= 1;
                return (
                  <button
                    key={surface}
                    className={clsx(
                      "top-bar__visibility-toggle",
                      visible && "top-bar__visibility-toggle--active"
                    )}
                    disabled={isLastVisible}
                    onClick={() => onToggleSurfaceVisibility(surface)}
                    title={visible ? `Hide ${surface}` : `Show ${surface}`}
                  >
                    <span>{surface}</span>
                    {!visible ? <EyeOff size={12} strokeWidth={2} /> : null}
                  </button>
                );
              })}
            </div>

            <div className="top-bar__width-picker">
              {widthOptions.map((width) => (
                <button
                  key={width}
                  className={clsx(
                    "top-bar__width-option",
                    track.widths[selected] === width && "top-bar__width-option--active"
                  )}
                  onClick={() => onSetSurfaceWidth(selected, width)}
                >
                  {width}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
