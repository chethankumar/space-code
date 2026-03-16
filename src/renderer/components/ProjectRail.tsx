import clsx from "clsx";
import { FolderPlus, PanelLeftClose, PanelLeftOpen, Server, Settings2 } from "lucide-react";
import { useRef } from "react";
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
  const railRef = useRef<HTMLElement | null>(null);

  const handleProjectContextMenu = async (e: React.MouseEvent, project: ProjectRecord) => {
    e.preventDefault();
    e.stopPropagation();
    
    const result = await window.naeditor.showProjectContextMenu({
      projectId: project.id,
      projectName: project.name
    });
    
    if (result.action === "remove") {
      onRemoveProject(project.id);
    }
  };

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
              onContextMenu={(e) => handleProjectContextMenu(e, project)}
              title={project.name}
            >
              <span className="project-chip__color" style={{ backgroundColor: project.color }} />
              {!collapsed && (
                <span className="project-chip__body">
                  <span className="project-chip__name">{project.name}</span>
                  <span className="project-chip__meta">
                    {project.kind === "remote" ? `Remote ${project.host ? `(${project.host})` : ""}` : "Local"}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
