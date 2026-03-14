import { Bot, Plus, X } from "lucide-react";
import type { CodeTab, ProjectRecord } from "@shared/types";

type CodeSurfaceProps = {
  project: ProjectRecord;
  tabs: CodeTab[];
  activeTabId?: string;
  onSelectTab: (tabId: string) => void;
  onAddTab: () => void;
  onCloseTab: (tabId: string) => void;
};

export function CodeSurface({
  project,
  tabs,
  activeTabId,
  onSelectTab,
  onAddTab,
  onCloseTab
}: CodeSurfaceProps) {
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

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
              className={tab.id === activeTab?.id ? "code-tab code-tab--active" : "code-tab"}
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

      <div className="code-placeholder">
        <div className="code-placeholder__icon">
          <Bot size={22} strokeWidth={1.8} />
        </div>
        <div className="code-placeholder__body">
          <strong>{activeTab?.title ?? "Code"} has been reset</strong>
          <p>
            The previous Codex-style implementation was removed so we can rebuild this surface
            properly from a clean foundation for <span>{project.name}</span>.
          </p>
        </div>
      </div>
    </section>
  );
}
