import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Editor, { DiffEditor } from "@monaco-editor/react";
import { Files, GitBranch, PanelLeftClose, PanelLeftOpen, Search, X } from "lucide-react";
import type { AppSettings, EditorRevealTarget, EditorTab, GitDetails, InspectorMode } from "@shared/types";
import { getFileVisual } from "@renderer/lib/fileVisuals";
import type * as Monaco from "monaco-editor";

type EditorSurfaceProps = {
  activeTab?: EditorTab;
  tabs: EditorTab[];
  git?: GitDetails;
  sidebar?: ReactNode;
  sidebarVisible: boolean;
  sidebarDock?: "left" | "right";
  sidebarWidth?: number;
  inspectorMode: InspectorMode;
  onToggleSidebar: () => void;
  onModeChange: (mode: InspectorMode) => void;
  onResizeSidebar: (width: number) => void;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string) => void;
  onChangeContent: (content: string) => void;
  revealTarget?: EditorRevealTarget;
  appSettings: AppSettings;
};

const modeButtons: Array<{ mode: InspectorMode; icon: typeof Files; title: string }> = [
  { mode: "files", icon: Files, title: "Files" },
  { mode: "git", icon: GitBranch, title: "Git" },
  { mode: "search", icon: Search, title: "Search" }
];

export function EditorSurface({
  activeTab,
  tabs,
  git,
  sidebar,
  sidebarVisible,
  sidebarDock = "left",
  sidebarWidth = 280,
  inspectorMode,
  onToggleSidebar,
  onModeChange,
  onResizeSidebar,
  onSelectTab,
  onCloseTab,
  onChangeContent,
  revealTarget,
  appSettings
}: EditorSurfaceProps) {
  const SidebarIcon = sidebarVisible ? PanelLeftClose : PanelLeftOpen;
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const languageLabel = useMemo(
    () =>
      activeTab?.kind === "git-diff" || activeTab?.kind === "git-history-diff"
        ? "Diff"
        : activeTab?.kind === "git-commit" || activeTab?.kind === "git-compare"
          ? "Patch"
          : getLanguageLabel(activeTab?.path),
    [activeTab]
  );
  const fileSizeLabel = useMemo(() => {
    if (!activeTab) {
      return "0 B";
    }
    return formatFileSize(
      activeTab.kind === "git-diff" || activeTab.kind === "git-history-diff" ? activeTab.modifiedContent : activeTab.content
    );
  }, [activeTab]);

  const revealCommitFile = (filePath: string) => {
    if (!activeTab || (activeTab.kind !== "git-commit" && activeTab.kind !== "git-compare")) {
      return;
    }

    const editor = editorRef.current;
    const model = editor?.getModel?.();
    if (!editor || !model) {
      return;
    }

    const needle = `diff --git a/${filePath} b/${filePath}`;
    const match = model.findMatches(needle, false, false, false, null, false)[0];
    if (!match) {
      return;
    }

    editor.revealLineInCenter(match.range.startLineNumber);
    editor.setSelection(match.range);
    editor.focus();
  };

  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState) {
        return;
      }

      const delta = event.clientX - resizeState.startX;
      const nextWidth =
        sidebarDock === "left" ? resizeState.startWidth + delta : resizeState.startWidth - delta;
      onResizeSidebar(nextWidth);
    };

    const handlePointerUp = () => {
      resizeStateRef.current = null;
      document.body.classList.remove("is-resizing-sidebar");
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [onResizeSidebar, sidebarDock]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    if (!activeTab || !revealTarget || revealTarget.path !== activeTab.path) {
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
      return;
    }

    const startLine = revealTarget.line;
    const startColumn = revealTarget.column;
    const endLine = revealTarget.endLine ?? startLine;
    const endColumn = revealTarget.endColumn ?? startColumn + Math.max(revealTarget.query?.length ?? 1, 1);

    editor.revealLineInCenter(startLine);
    editor.setSelection({
      startLineNumber: startLine,
      startColumn,
      endLineNumber: endLine,
      endColumn
    });
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [
      {
        range: {
          startLineNumber: startLine,
          startColumn,
          endLineNumber: endLine,
          endColumn
        },
        options: {
          className: "editor-search-highlight",
          stickiness: 1
        }
      }
    ]);
    editor.focus();
  }, [activeTab, revealTarget]);

  return (
    <section className="surface surface--editor">
      <div className="editor-topbar">
        <div className="editor-activity">
          <button
            className={sidebarVisible ? "editor-activity__button editor-activity__button--active" : "editor-activity__button"}
            onClick={onToggleSidebar}
            title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
            aria-label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
          >
            <SidebarIcon className="editor-activity__icon" strokeWidth={1.9} size={15} />
          </button>
          {modeButtons.map((entry) => (
            <button
              key={entry.mode}
              className={entry.mode === inspectorMode ? "editor-activity__button editor-activity__button--active" : "editor-activity__button"}
              onClick={() => onModeChange(entry.mode)}
              title={entry.title}
              aria-label={entry.title}
            >
              <entry.icon className="editor-activity__icon" strokeWidth={1.9} size={15} />
            </button>
          ))}
        </div>

        <div className="editor-tabs">
          {tabs.map((tab) => {
            const fileVisual = getFileVisual(tab.title);
            const TabIcon = fileVisual.icon;

            return (
              <button
                key={tab.path}
                className={tab.path === activeTab?.path ? "editor-tab editor-tab--active" : "editor-tab"}
                onClick={() => onSelectTab(tab.path)}
              >
                <TabIcon className={`editor-tab__icon ${fileVisual.className}`} size={13} strokeWidth={1.9} />
                <span className="editor-tab__label">
                  {tab.title}
                  {tab.dirty ? " *" : ""}
                </span>
                <span
                  className="editor-tab__close"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCloseTab(tab.path);
                  }}
                >
                  <X size={12} strokeWidth={2} />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={`editor-layout editor-layout--${sidebarDock}`}>
        {sidebarVisible && sidebar && sidebarDock === "left" ? (
          <>
            <div className="editor-sidebar-shell" style={{ width: `${sidebarWidth}px` }}>
              {sidebar}
            </div>
            <div
              className="editor-sidebar-resizer"
              onPointerDown={(event) => {
                resizeStateRef.current = {
                  startX: event.clientX,
                  startWidth: sidebarWidth
                };
                document.body.classList.add("is-resizing-sidebar");
              }}
            />
          </>
        ) : null}

        <div className="editor-monaco">
          {activeTab?.kind === "git-commit" || activeTab?.kind === "git-compare" ? (
            <div className="editor-commit-browser">
              <div className="editor-commit-browser__meta">
                <span className="editor-commit-browser__hash">
                  {activeTab.kind === "git-commit"
                    ? activeTab.commitHash.slice(0, 7)
                    : `${activeTab.baseRef} → ${activeTab.targetRef}`}
                </span>
                <span>{activeTab.changedFiles.length} files</span>
              </div>
              <div className="editor-commit-browser__files">
                {activeTab.changedFiles.map((file) => {
                  const fileVisual = getFileVisual(file.path);
                  const FileIconComponent = fileVisual.icon;
                  return (
                    <button
                      key={`${activeTab.path}:${file.path}`}
                      className="editor-commit-file"
                      onClick={() => revealCommitFile(file.path)}
                    >
                      <span className="editor-commit-file__status">{file.status}</span>
                      <FileIconComponent className={`editor-commit-file__icon ${fileVisual.className}`} size={13} strokeWidth={1.9} />
                      <span className="editor-commit-file__path">{file.path}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {activeTab ? (
            isImageFile(activeTab.path) && activeTab.kind === "file" ? (
              (() => {
                console.log('=== Image rendering for:', activeTab.path);
                console.log('  Content length:', activeTab.content.length);
                console.log('  Content preview:', activeTab.content.substring(0, 100));
                
                let imgSrc = '';
                
                if (activeTab.content.startsWith('__NAEDITOR_IMAGE__:')) {
                  // Use custom protocol for local images
                  const filePath = activeTab.content.substring('__NAEDITOR_IMAGE__:'.length);
                  imgSrc = `naeditor-image://localhost${filePath}`;
                  console.log('  Using custom protocol, imgSrc:', imgSrc);
                } else if (activeTab.content.startsWith('data:')) {
                  // Data URL (remote images or already encoded)
                  imgSrc = activeTab.content;
                  console.log('  Using data URL, length:', imgSrc.length);
                } else if (activeTab.path.toLowerCase().endsWith('.svg')) {
                  // SVG text content
                  imgSrc = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(activeTab.content)}`;
                  console.log('  Using SVG inline');
                } else {
                  // Fallback - this shouldn't happen
                  console.error('  UNEXPECTED: Image content format not recognized');
                  console.error('  Content preview:', activeTab.content.substring(0, 200));
                  imgSrc = activeTab.content;
                }
                
                return (
                  <div className="editor-image-viewer">
                    <img 
                      src={imgSrc}
                      alt={activeTab.path.split("/").pop()}
                      className="editor-image"
                      onLoad={() => {
                        console.log('✓ Image loaded successfully:', activeTab.path);
                      }}
                      onError={(e) => {
                        console.error('✗ Failed to load image:', activeTab.path);
                        console.error('  Content marker:', activeTab.content.substring(0, 50));
                        console.error('  Image src:', imgSrc.substring(0, 100));
                      }}
                    />
                    <div className="editor-image-info">
                      <span>{activeTab.path.split("/").pop()}</span>
                    </div>
                  </div>
                );
              })()
            ) : activeTab.kind === "git-diff" || activeTab.kind === "git-history-diff" ? (
              <DiffEditor
                key={activeTab.path}
                height="100%"
                theme={appSettings.editorTheme}
                beforeMount={(monaco) => registerEditorThemes(monaco)}
                original={activeTab.originalContent}
                modified={activeTab.modifiedContent}
                originalLanguage={guessLanguage(activeTab.filePath)}
                modifiedLanguage={guessLanguage(activeTab.filePath)}
                onChange={(value) => {
                  if (activeTab.kind === "git-diff" && !activeTab.staged) {
                    onChangeContent(value ?? "");
                  }
                }}
                onMount={(editor) => {
                  const modifiedEditor = editor.getModifiedEditor();
                  editorRef.current = modifiedEditor;
                  const position = modifiedEditor.getPosition();
                  setCursorPosition({
                    line: position?.lineNumber ?? 1,
                    column: position?.column ?? 1
                  });

                  modifiedEditor.onDidChangeCursorPosition((event) => {
                    setCursorPosition({
                      line: event.position.lineNumber,
                      column: event.position.column
                    });
                  });
                }}
                options={{
                  automaticLayout: true,
                  fontFamily: appSettings.editorFontFamily,
                  fontSize: appSettings.editorFontSize,
                  renderSideBySide: true,
                  readOnly: activeTab.kind === "git-history-diff" || activeTab.staged,
                  minimap: { enabled: false },
                  overviewRulerBorder: false,
                  renderLineHighlight: "none",
                  scrollbar: {
                    verticalScrollbarSize: 10,
                    horizontalScrollbarSize: 10
                  },
                  scrollBeyondLastLine: false
                }}
              />
            ) : (
              <Editor
                key={activeTab.path}
                height="100%"
                theme={appSettings.editorTheme}
                beforeMount={(monaco) => {
                  registerEditorThemes(monaco);
                  monacoRef.current = monaco;
                  
                  // Configure TypeScript for editing (not compiling)
                  // Use react-jsx transform and disable validation for missing modules
                  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
                    jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
                    target: monaco.languages.typescript.ScriptTarget.ESNext,
                    module: monaco.languages.typescript.ModuleKind.ESNext,
                    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.Bundler,
                    allowJs: true,
                    allowSyntheticDefaultImports: true,
                    esModuleInterop: true,
                    skipLibCheck: true,
                    noEmit: true,
                    isolatedModules: true,
                    resolveJsonModule: true,
                  });
                  
                  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
                    jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
                    target: monaco.languages.typescript.ScriptTarget.ESNext,
                    module: monaco.languages.typescript.ModuleKind.ESNext,
                    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.Bundler,
                    allowJs: true,
                    allowSyntheticDefaultImports: true,
                    esModuleInterop: true,
                    noEmit: true,
                  });
                  
                  // This is the key: disable validation for module imports
                  // Monaco can't resolve node_modules, so don't complain about it
                  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                    noSemanticValidation: true,  // Disable semantic checks (like missing imports)
                    noSyntaxValidation: false,   // Keep syntax checks (like JSX syntax)
                  });
                  
                  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                    noSemanticValidation: true,
                    noSyntaxValidation: false,
                  });
                }}
                path={activeTab.path}
                defaultValue={activeTab.content}
                onChange={(value) => {
                  if (activeTab.kind === "file") {
                    onChangeContent(value ?? "");
                  }
                }}
                onMount={(editor) => {
                  editorRef.current = editor;
                  const position = editor.getPosition();
                  setCursorPosition({
                    line: position?.lineNumber ?? 1,
                    column: position?.column ?? 1
                  });

                  editor.onDidChangeCursorPosition((event) => {
                    setCursorPosition({
                      line: event.position.lineNumber,
                      column: event.position.column
                    });
                  });
                  
                  // Set language for special cases
                  if (activeTab.kind === "git-commit" || activeTab.kind === "git-compare") {
                    const model = editor.getModel();
                    if (model && monacoRef.current) {
                      monacoRef.current.editor.setModelLanguage(model, "diff");
                    }
                  }
                }}
                options={{
                  automaticLayout: true,
                  fontFamily: appSettings.editorFontFamily,
                  fontSize: appSettings.editorFontSize,
                  lineHeight: 20,
                  minimap: { enabled: false },
                  smoothScrolling: true,
                  readOnly: activeTab.kind === "git-commit" || activeTab.kind === "git-compare",
                  overviewRulerBorder: false,
                  hideCursorInOverviewRuler: true,
                  renderLineHighlight: "none",
                  scrollbar: {
                    verticalScrollbarSize: 10,
                    horizontalScrollbarSize: 10
                  },
                  wordWrap: "on",
                  scrollBeyondLastLine: false,
                  padding: {
                    top: 10,
                    bottom: 10
                  }
                }}
              />
            )
          ) : (
            <div className="editor-empty">
              <p>Open a file from the sidebar to start editing in the workspace track.</p>
            </div>
          )}
        </div>

        {sidebarVisible && sidebar && sidebarDock === "right" ? (
          <>
            <div
              className="editor-sidebar-resizer"
              onPointerDown={(event) => {
                resizeStateRef.current = {
                  startX: event.clientX,
                  startWidth: sidebarWidth
                };
                document.body.classList.add("is-resizing-sidebar");
              }}
            />
            <div className="editor-sidebar-shell" style={{ width: `${sidebarWidth}px` }}>
              {sidebar}
            </div>
          </>
        ) : null}
      </div>

      <div className="editor-statusbar">
        <div className="editor-statusbar__left">
          <span className="editor-statusbar__item editor-statusbar__item--git">
            <GitBranch size={12} strokeWidth={2} />
            {git?.branch ?? "No Git"}
          </span>
          <span className="editor-statusbar__item">↑ {git?.ahead ?? 0}</span>
          <span className="editor-statusbar__item">↓ {git?.behind ?? 0}</span>
          <span className="editor-statusbar__item">Δ {git?.changedFiles ?? 0}</span>
        </div>

        <div className="editor-statusbar__right">
          <span className="editor-statusbar__item">{languageLabel}</span>
          <span className="editor-statusbar__item">{fileSizeLabel}</span>
          <span className="editor-statusbar__item">Ln {cursorPosition.line}, Col {cursorPosition.column}</span>
          <span className="editor-statusbar__item">Spaces: 2</span>
          <span className="editor-statusbar__item">UTF-8</span>
        </div>
      </div>
    </section>
  );
}

function registerEditorThemes(monaco: typeof Monaco) {
  monaco.editor.defineTheme("spacecode-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "7f8ea3" },
      { token: "keyword", foreground: "8cb4ff" },
      { token: "string", foreground: "9fdc9c" },
      { token: "number", foreground: "f6c177" }
    ],
    colors: {
      "editor.background": "#0d131d",
      "editor.foreground": "#d9e2ef",
      "editorLineNumber.foreground": "#53627a",
      "editorLineNumber.activeForeground": "#9db2ce",
      "editorCursor.foreground": "#8cb4ff",
      "editor.selectionBackground": "#1f3556",
      "editor.inactiveSelectionBackground": "#17253d"
    }
  });

  monaco.editor.defineTheme("spacecode-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "7b8796" },
      { token: "keyword", foreground: "3566d6" },
      { token: "string", foreground: "2f7d4f" },
      { token: "number", foreground: "a56218" }
    ],
    colors: {
      "editor.background": "#f9fbff",
      "editor.foreground": "#1f2937",
      "editorLineNumber.foreground": "#9aa7b6",
      "editorLineNumber.activeForeground": "#516071",
      "editorCursor.foreground": "#295ec7",
      "editor.selectionBackground": "#dbeafe",
      "editor.inactiveSelectionBackground": "#eef4ff"
    }
  });

  monaco.editor.defineTheme("github-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "8b949e" },
      { token: "keyword", foreground: "ff7b72" },
      { token: "string", foreground: "a5d6ff" },
      { token: "number", foreground: "79c0ff" }
    ],
    colors: {
      "editor.background": "#0d1117",
      "editor.foreground": "#c9d1d9",
      "editorLineNumber.foreground": "#6e7681",
      "editorLineNumber.activeForeground": "#c9d1d9",
      "editorCursor.foreground": "#58a6ff",
      "editor.selectionBackground": "#264f78"
    }
  });

  monaco.editor.defineTheme("github-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6e7781" },
      { token: "keyword", foreground: "cf222e" },
      { token: "string", foreground: "0a3069" },
      { token: "number", foreground: "0550ae" }
    ],
    colors: {
      "editor.background": "#ffffff",
      "editor.foreground": "#1f2328",
      "editorLineNumber.foreground": "#afb8c1",
      "editorLineNumber.activeForeground": "#57606a",
      "editorCursor.foreground": "#0969da",
      "editor.selectionBackground": "#dbeafe"
    }
  });

  monaco.editor.defineTheme("dracula", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6272a4" },
      { token: "keyword", foreground: "ff79c6" },
      { token: "string", foreground: "f1fa8c" },
      { token: "number", foreground: "bd93f9" }
    ],
    colors: {
      "editor.background": "#282a36",
      "editor.foreground": "#f8f8f2",
      "editorLineNumber.foreground": "#6272a4",
      "editorLineNumber.activeForeground": "#f8f8f2",
      "editorCursor.foreground": "#ff79c6",
      "editor.selectionBackground": "#44475a"
    }
  });

  monaco.editor.defineTheme("nord", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "616e88" },
      { token: "keyword", foreground: "81a1c1" },
      { token: "string", foreground: "a3be8c" },
      { token: "number", foreground: "b48ead" }
    ],
    colors: {
      "editor.background": "#2e3440",
      "editor.foreground": "#d8dee9",
      "editorLineNumber.foreground": "#616e88",
      "editorLineNumber.activeForeground": "#d8dee9",
      "editorCursor.foreground": "#88c0d0",
      "editor.selectionBackground": "#434c5e"
    }
  });

  monaco.editor.defineTheme("solarized-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "586e75" },
      { token: "keyword", foreground: "859900" },
      { token: "string", foreground: "2aa198" },
      { token: "number", foreground: "d33682" }
    ],
    colors: {
      "editor.background": "#002b36",
      "editor.foreground": "#93a1a1",
      "editorLineNumber.foreground": "#586e75",
      "editorLineNumber.activeForeground": "#93a1a1",
      "editorCursor.foreground": "#fdf6e3",
      "editor.selectionBackground": "#073642"
    }
  });

  monaco.editor.defineTheme("solarized-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "93a1a1" },
      { token: "keyword", foreground: "859900" },
      { token: "string", foreground: "2aa198" },
      { token: "number", foreground: "d33682" }
    ],
    colors: {
      "editor.background": "#fdf6e3",
      "editor.foreground": "#586e75",
      "editorLineNumber.foreground": "#93a1a1",
      "editorLineNumber.activeForeground": "#586e75",
      "editorCursor.foreground": "#586e75",
      "editor.selectionBackground": "#eee8d5"
    }
  });
}

function guessLanguage(path: string) {
  const extension = path.split(".").pop();
  switch (extension) {
    case "tsx":
      return "typescriptreact";
    case "ts":
      return "typescript";
    case "jsx":
      return "javascriptreact";
    case "js":
      return "javascript";
    case "json":
      return "json";
    case "md":
      return "markdown";
    case "css":
      return "css";
    case "html":
      return "html";
    case "sh":
      return "shell";
    default:
      return "plaintext";
  }
}

function isImageFile(path: string): boolean {
  const extension = path.toLowerCase().split(".").pop();
  return ["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "avif", "bmp"].includes(extension ?? "");
}

function getLanguageLabel(path?: string) {
  const language = guessLanguage(path ?? "");
  switch (language) {
    case "typescriptreact":
      return "TypeScript React";
    case "typescript":
      return "TypeScript";
    case "javascriptreact":
      return "JavaScript React";
    case "javascript":
      return "JavaScript";
    case "json":
      return "JSON";
    case "markdown":
      return "Markdown";
    case "css":
      return "CSS";
    case "html":
      return "HTML";
    case "shell":
      return "Shell";
    default:
      return "Plain Text";
  }
}

function formatFileSize(content: string) {
  const bytes = new TextEncoder().encode(content).length;
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} KB`;
  }

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}
