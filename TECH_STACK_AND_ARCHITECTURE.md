# NaEditor Tech Stack and Architecture

## Overview

NaEditor is a single-window, multi-project development environment for macOS. The product is built around a persistent Project Rail and a per-project Workspace Track that contains three first-class surfaces:

- Editor
- Terminal
- Browser

This document defines the recommended technology stack and the system architecture for the first version of the app.

The goal is to optimize for:

- fast iteration during product development
- a strong and stable desktop foundation
- good performance for daily use
- a clear path from MVP to a more advanced IDE-like product

## Recommended Stack

### Desktop Shell

- Electron

Electron is the best fit for v1 because NaEditor depends on a single-window desktop shell with:

- strong window lifecycle control
- first-class keyboard shortcut handling
- the ability to embed browser content as a core surface
- proven support for editor-like applications

The Browser surface in NaEditor is not optional UI chrome. It is one of the product's primary surfaces. Electron is a strong fit because Chromium is built in and can support this model more naturally than a system-webview approach.

### Frontend

- React
- TypeScript

React and TypeScript are the fastest and safest way to implement:

- the Project Rail
- the top mini-map/title bar
- the Workspace Track
- the Inspector
- the command surfaces around editor, terminal, and browser

This combination also makes it easier to prototype, refactor, and evolve the interaction model as the product matures.

### Frontend State

- Zustand

Zustand is a good fit because NaEditor needs application state that is:

- global in some places
- per-project in many places
- highly interactive
- relatively easy to reason about

It is simpler than Redux and usually sufficient for desktop-app UI state.

Recommended state categories:

- app-level UI state
- project registry state
- active project selection
- per-project workspace state
- ephemeral focus state

### Editor Surface

- Monaco Editor

Monaco is the right v1 editor choice because it provides a mature code editing base with:

- syntax highlighting
- language services integration
- model-based editing
- multi-cursor support
- diagnostics support
- familiar editor behavior

The main innovation in NaEditor is multi-project and multi-surface workflow, not the editor engine itself. Using Monaco keeps the product focused.

### Terminal Surface

- xterm.js
- node-pty

xterm.js should be used for terminal rendering in the UI.

node-pty should be used in the Electron main process or a dedicated worker process to run PTY-backed terminal sessions.

This combination is well understood and fits NaEditor's need for:

- persistent terminal sessions
- multiple sessions per project
- local shell support
- remote shell support through SSH orchestration

### Browser Surface

- Electron WebContentsView

The Browser is a project-bound preview surface for web applications and remote forwarded apps.

The Browser should be implemented with Electron's browser embedding capabilities and managed as a first-class workspace surface, not as an afterthought or an external browser launch.

This allows the app to preserve browser state per project and integrate it into the Workspace Track.

### Backend Runtime

- Node.js

Node should be the core backend runtime for v1.

It is the most compatible and proven runtime for Electron-based desktop products, especially when working with:

- child processes
- PTY sessions
- file system access
- Git orchestration
- SSH orchestration
- SQLite bindings

Bun may be useful as a development tool in the future, but the production desktop runtime should remain Node for reliability and ecosystem compatibility.

### Persistence

- SQLite

SQLite should be used for workspace persistence and app metadata.

Recommended storage areas:

- projects
- recent projects
- pinned projects
- per-project workspace state
- terminal session metadata
- browser session metadata
- layout presets
- SSH targets and connection metadata
- command history references

SQLite is lightweight, local-first, fast, and well suited for this kind of desktop application state.

### Git Integration

- Git CLI via child processes

For v1, NaEditor should rely on the installed system `git` executable rather than introducing a library-first Git implementation.

This keeps the implementation practical and leverages the user's existing Git configuration, credential setup, and behavior.

Recommended Git capabilities for v1:

- status
- diff
- add / restore
- commit
- branch list
- branch switch
- branch create
- log
- blame

Over time, some hot paths can be optimized or wrapped more deeply if needed.

### Search and File Discovery

- ripgrep
- fast-glob or native fs traversal where appropriate

Text search should use `ripgrep` via child processes.

This is a strong default for:

- speed
- large repositories
- ignore file support
- streamable results

File indexing and file discovery can start with lightweight traversal and evolve into a richer index if needed.

### Remote Development

- system `ssh`
- system `scp`
- system `sftp` or rsync when needed

Remote workflows should initially be built by orchestrating the user's existing SSH toolchain rather than trying to implement SSH protocols directly.

This gives NaEditor:

- compatibility with existing SSH config
- support for agent-based auth
- support for ProxyJump and other advanced SSH features
- easy port forwarding
- better alignment with how developers already work

### File Watching

- chokidar

Chokidar is a practical choice for local file watching in v1.

For remote projects, file watching should be handled through remote command strategies or explicit refresh behavior until a stronger remote sync/indexing layer is needed.

### Command and Task Execution

- child_process
- node-pty

Regular commands can be executed with Node child processes.

Interactive shell sessions should use PTY-backed processes.

Task definitions can be layered on later, but the system should be built so tasks are just managed command sessions with metadata.

## Architecture Overview

NaEditor should use a multi-process architecture with clear responsibility boundaries.

### Main Layers

1. Electron Main Process
2. Electron Renderer Process
3. Background Workers and Utility Processes

This is enough for v1 without introducing unnecessary service complexity.

## 1. Electron Main Process

The Electron main process should own:

- application startup
- main window creation
- native menu registration
- global and window-scoped shortcuts
- Browser surface lifecycle
- secure IPC boundaries
- child process orchestration
- PTY management coordination
- Git command execution
- SSH command execution
- database access or database service orchestration

It should act as the control plane for the app.

The main process should not render UI and should avoid heavy synchronous work.

## 2. Electron Renderer Process

The renderer process should own the visible application interface:

- Project Rail
- top mini-map/title bar
- Workspace Track UI
- Inspector
- editor host UI
- terminal host UI
- project switching visuals
- layout state visualization

The renderer should remain focused on:

- rendering
- local interaction logic
- user input handling
- state projection from app services

It should avoid running heavy Git, indexing, SSH, or terminal orchestration directly.

## 3. Background Workers and Utility Processes

Some work should be isolated from both the renderer and the core main-process event loop.

Use worker threads or child processes for:

- search execution
- indexing
- large Git operations
- remote sync helpers
- file scanning
- cache rebuild jobs

This helps keep project switching and UI interactions smooth.

## Proposed Internal Modules

The app should be organized by domain, not by technology alone.

### App Shell Module

Responsibilities:

- startup
- window lifecycle
- app configuration
- menus
- shortcuts
- update hooks

### Project Registry Module

Responsibilities:

- maintain active project list
- maintain recent project list
- pin and unpin projects
- store project metadata
- select active project

### Workspace Module

Responsibilities:

- manage per-project Workspace Track state
- manage snap widths
- manage active surface
- manage viewport anchors and snap points
- restore workspace state on project switch

### Editor Module

Responsibilities:

- Monaco model lifecycle
- open files
- persist cursor and scroll state
- diagnostics integration
- symbol navigation hooks
- editor command bindings

### Terminal Module

Responsibilities:

- create and restore terminal sessions
- connect xterm.js to PTY sessions
- manage local shells
- manage remote shells
- preserve project terminal state

### Browser Module

Responsibilities:

- create per-project preview sessions
- manage WebContentsView instances
- preserve URL state
- manage dev-server routing
- manage forwarded ports and preview URLs

### Git Module

Responsibilities:

- fetch repo status
- fetch diffs
- stage and unstage files
- create commits
- switch branches
- emit status updates to UI

### Remote Module

Responsibilities:

- manage SSH targets
- connect and reconnect to remotes
- manage forwarded ports
- run remote commands
- open remote shells
- resolve remote project metadata

### Search Module

Responsibilities:

- text search
- file search
- streaming results to UI
- ignore file awareness

### Persistence Module

Responsibilities:

- SQLite schema
- project persistence
- workspace snapshots
- settings
- migration logic

## Workspace Track Architecture

The Workspace Track is the app's signature interaction system and should be modeled explicitly in code.

Each project has a Workspace Track model containing:

- surface order
- snap width for each surface
- derived snap points
- current viewport anchor
- active surface

### Suggested Data Model

```ts
type SurfaceId = "editor" | "terminal" | "browser";

type SnapWidth = "1/3" | "1/2" | "2/3" | "3/4" | "1/1";

type InspectorMode =
  | "files"
  | "search"
  | "git"
  | "branches"
  | "comments"
  | "remote"
  | "problems";

type WorkspaceTrackState = {
  order: SurfaceId[];
  widths: Record<SurfaceId, SnapWidth>;
  activeSurface: SurfaceId;
  activeSnapPointId: string;
  inspector: {
    visible: boolean;
    dock: "left" | "right";
    mode: InspectorMode;
  };
};
```

Snap points should be derived, not manually stored one by one.

For example, a project with:

- Editor: `1/1`
- Terminal: `2/3`
- Browser: `1/1`

could derive snap points like:

- full-editor
- editor-terminal
- terminal-focus
- terminal-browser
- full-browser

The renderer should animate between these states, but the source of truth should live in the app state model.

## Project State Architecture

Each project should be represented as both a project record and a live workspace state.

### Suggested Project Model

```ts
type ProjectId = string;

type ProjectLocation =
  | { kind: "local"; rootPath: string }
  | {
      kind: "remote";
      host: string;
      rootPath: string;
      sshProfile?: string;
    };

type ProjectRecord = {
  id: ProjectId;
  name: string;
  location: ProjectLocation;
  pinned: boolean;
  lastOpenedAt: number;
};
```

### Suggested Workspace Snapshot Model

```ts
type WorkspaceSnapshot = {
  projectId: ProjectId;
  track: WorkspaceTrackState;
  openFiles: {
    path: string;
    cursor: { line: number; column: number };
    scrollTop?: number;
  }[];
  activeFile?: string;
  terminalSessions: {
    id: string;
    title: string;
    cwd?: string;
    remote?: boolean;
  }[];
  activeTerminalSessionId?: string;
  browser: {
    url?: string;
    lastKnownDevServerUrl?: string;
  };
  git: {
    branch?: string;
  };
};
```

This state should be persisted periodically and on key lifecycle events.

## Browser Surface Design

Because Browser is a core surface, it should not be implemented as a simple iframe inside the renderer.

The Browser surface should be backed by Electron browser embedding primitives and managed by the main process, while the renderer controls layout, focus, and state.

Recommended v1 Browser behavior:

- one main preview session per project
- optional support for opening specific routes
- local dev server URL detection when possible
- support for remote forwarded URLs
- preserve URL and navigation state on project switch

The Browser should prioritize preview and development workflows, not general browsing.

## Terminal Architecture

Each project can have one or more terminal sessions.

Terminal sessions should:

- belong to a project
- survive project switching
- preserve shell history and output buffer while app is open
- optionally be restorable across app relaunches

Suggested terminal flow:

1. renderer requests terminal creation
2. main process creates PTY session via node-pty
3. session output streams to renderer
4. renderer displays session with xterm.js
5. session metadata is persisted under the project

Remote terminals should be launched as SSH-backed PTY sessions managed through the Remote module.

## Git Architecture

Git commands should be executed outside the renderer.

Suggested approach:

- run status checks on file-change triggers and focus-based refreshes
- debounce expensive repo scans
- stream diff and log data as needed
- cache repo metadata in memory

For v1, Git should remain command-driven and explicit. There is no need to build a speculative real-time Git engine before the product model is validated.

## Remote Architecture

Remote support should align with the project model rather than feel like a separate mode.

Each remote project should be represented in the Project Rail just like a local project, with additional metadata such as:

- host
- connection state
- forwarded ports
- remote branch info

Recommended v1 strategy:

- use SSH config and user credentials as-is
- spawn remote shells with `ssh`
- browse remote files through remote command helpers
- support port forwarding for browser previews
- persist remote project connection metadata locally

For v1, correctness and usability matter more than fully transparent remote file syncing.

## IPC Strategy

The app should define explicit typed IPC boundaries.

Categories of IPC:

- project commands
- workspace commands
- editor file operations
- terminal session operations
- browser preview operations
- Git operations
- remote operations
- persistence operations

Recommended pattern:

- preload exposes a narrow typed API
- renderer never gets unrestricted Node access
- main process validates inputs and routes commands

This keeps the app maintainable and secure.

## Performance Strategy

Without Rust, performance discipline becomes even more important.

Key rules:

- never run heavy work in the renderer
- debounce and batch Git refreshes
- search in worker processes
- lazy-load heavy UI sections
- keep Monaco models under control
- cache project metadata aggressively
- avoid re-rendering the full workspace tree during track movement

Performance-sensitive areas:

- project switching
- large file opening
- search
- Git status in large repos
- terminal rendering
- browser surface transitions

The Workspace Track should animate smoothly, but the implementation should avoid rebuilding surfaces during each navigation step.

## Suggested Folder Structure

One reasonable initial structure:

```text
src/
  main/
    app/
    windows/
    ipc/
    services/
      projects/
      workspace/
      terminal/
      browser/
      git/
      remote/
      search/
      persistence/
  renderer/
    app/
    components/
    features/
      project-rail/
      workspace-track/
      inspector/
      editor/
      terminal/
      browser/
    stores/
    hooks/
    lib/
  shared/
    types/
    constants/
    ipc/
```

This keeps the architecture legible as the app grows.

## Implementation Phases

### Phase 1: Shell and Project Model

Build:

- Electron app shell
- React app frame
- Project Rail
- project create/open/select flow
- SQLite persistence
- workspace snapshot storage

Goal:

Prove the single-window multi-project model.

### Phase 2: Workspace Track

Build:

- top mini-map/title bar
- horizontal snap-track system
- track state model
- anchor and snap-point navigation
- rail collapse and Inspector toggles

Goal:

Prove the signature navigation model.

### Phase 3: Editor and Terminal

Build:

- Monaco integration
- file explorer
- xterm.js plus node-pty
- per-project terminal persistence
- keyboard focus routing

Goal:

Make the product usable for real development work.

### Phase 4: Browser Surface

Build:

- Browser surface with WebContentsView
- per-project preview state
- local dev URL memory
- surface switching and persistence

Goal:

Complete the three-surface development loop.

### Phase 5: Git and Remote

Build:

- Git status and diff flows
- branch switching
- SSH-backed remote projects
- remote terminals
- port-forwarded browser previews

Goal:

Reach strong daily-driver potential for local and remote workflows.

## Final Recommendation

NaEditor should be built with:

- Electron
- React
- TypeScript
- Zustand
- Monaco
- xterm.js
- node-pty
- Node.js
- SQLite
- Git CLI
- ripgrep
- SSH orchestration through system tools

This stack is pragmatic, fast to develop, and well aligned with the product's defining interaction model.

The architecture should keep rendering, orchestration, and heavy background work clearly separated so that the app stays responsive as it grows into a serious developer tool.
