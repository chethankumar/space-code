import clsx from "clsx";
import { FolderPlus, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Server, Settings2, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ProjectRecord } from "@shared/types";

type ProjectRailProps = {
  collapsed: boolean;
  projects: ProjectRecord[];
  selectedProjectId?: string;
  onSelect: (projectId: string) => void;
  onAddProject: () => void;
  onAddRemoteProject: () => void;
  onOpenSettings: () => void;
  onToggleCollapse: () => void;
  onRemoveProject: (projectId: string) => void;
};

export function ProjectRail({
  collapsed,
  projects,
  selectedProjectId,
  onSelect,
  onAddProject,
  onAddRemoteProject,
  onOpenSettings,
  onToggleCollapse,
  onRemoveProject
}: ProjectRailProps) {
  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const [menuProjectId, setMenuProjectId] = useState<string | null>(null);
  const railRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!railRef.current?.contains(event.target as Node)) {
        setMenuProjectId(null);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <aside ref={railRef} className={clsx("project-rail", collapsed && "project-rail--collapsed")}>
      <div className="project-rail__header">
        {!collapsed ? (
          <div className="project-rail__identity">
            <h1>SpaceCode</h1>
          </div>
        ) : null}
        <div className={clsx("project-rail__actions", collapsed && "project-rail__actions--stacked")}>
          <button className="project-rail__icon-button" onClick={onToggleCollapse} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <CollapseIcon size={15} strokeWidth={1.9} />
          </button>
          <button className="project-rail__icon-button" onClick={onAddProject} title="Add local project space">
            <FolderPlus size={15} strokeWidth={1.9} />
          </button>
          <button className="project-rail__icon-button" onClick={onAddRemoteProject} title="Add remote project space">
            <Server size={15} strokeWidth={1.9} />
          </button>
          <button className="project-rail__icon-button" onClick={onOpenSettings} title="Open settings">
            <Settings2 size={15} strokeWidth={1.9} />
          </button>
        </div>
      </div>

      <div className="project-rail__list">
        {projects.length === 0 && !collapsed ? (
          <div className="project-rail__empty">
            <p>Add a project folder to start building your multi-project workspace.</p>
          </div>
        ) : null}

        {projects.map((project) => {
          const isActive = project.id === selectedProjectId;
          return (
            <button
              key={project.id}
              className={clsx("project-chip", isActive && "project-chip--active")}
              onClick={() => onSelect(project.id)}
              title={project.name}
            >
              <span className="project-chip__color" style={{ backgroundColor: project.color }} />
              {!collapsed && (
                <>
                  <span className="project-chip__body">
                    <span className="project-chip__name">{project.name}</span>
                    <span className="project-chip__meta">
                      {project.kind === "remote" ? `Remote ${project.host ? `(${project.host})` : ""}` : "Local"}
                    </span>
                  </span>
                  <span className="project-chip__actions">
                    <button
                      className="project-chip__menu-button"
                      title="Project options"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setMenuProjectId((current) => (current === project.id ? null : project.id));
                      }}
                    >
                      <MoreHorizontal size={14} strokeWidth={2} />
                    </button>
                    {menuProjectId === project.id ? (
                      <span className="project-chip__menu" onClick={(event) => event.stopPropagation()}>
                        <button
                          className="project-chip__menu-item project-chip__menu-item--danger"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setMenuProjectId(null);
                            onRemoveProject(project.id);
                          }}
                        >
                          <Trash2 size={13} strokeWidth={1.9} />
                          <span>Remove Project</span>
                        </button>
                      </span>
                    ) : null}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
