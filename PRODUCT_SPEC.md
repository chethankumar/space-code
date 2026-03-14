# NaEditor Product Spec

## Vision

NaEditor is a high-performance, single-window macOS editor for developers who work across multiple projects at once. Instead of forcing every project into its own app window, NaEditor keeps all active projects visible and instantly switchable from one persistent interface.

The core idea is simple:

- one app window
- many projects
- each project remembers its full working state
- switching projects should feel immediate

NaEditor is not trying to be just another text editor. It is a multi-project development cockpit for local and remote work, with first-class support for code editing, terminals, browser previews, Git workflows, and SSH-based remote development.

## Problem

Current editors, especially VS Code, fragment work across multiple windows. This creates friction:

- too many windows to manage
- slow project switching
- lost context between projects
- broken flow between code, terminal, and app preview
- remote workflows feel bolted on rather than native

The main problem NaEditor solves is this:

> A developer should be able to move across multiple projects, each with its own editor, terminal, browser preview, Git state, and remote context, without ever leaving a single window.

## Product Principles

- Single-window first: the entire product is designed around one main window.
- Keyboard-native: every major action should be fast with shortcuts.
- Spatial workflow: navigation should feel physical and predictable, not like toggling random panels.
- State preservation: every project should restore exactly where the user left off.
- Performance as a feature: switching, typing, searching, and rendering must feel instant.
- Local and remote parity: remote projects should feel as natural as local ones.
- Dense but disciplined: powerful layouts are allowed, but clutter is not.

## Core Concept

NaEditor has two persistent areas:

1. Project Rail on the left
2. Project Workspace on the right

The Project Rail shows all active projects. Selecting a project restores that project's saved workspace state in the main area.

The Project Workspace is built around a horizontal snap-based layout called the Workspace Track.

## Workspace Track

The Workspace Track is the defining interaction model of NaEditor.

Each project has a horizontal track containing three primary surfaces:

- Editor
- Terminal
- Browser

These surfaces are arranged on one continuous horizontal strip. Each surface can be assigned a snap width. The viewport moves across the track rather than merely hiding and showing panels.

This creates a spatial workflow where the user can move across the project's working environment:

- full editor
- editor plus terminal
- terminal-focused
- terminal plus browser
- full browser

The transitions between these states preserve context and make the workspace feel continuous.

## Snap Width System

Each primary surface can occupy one of the supported snap widths:

- 1/3
- 1/2
- 2/3
- 3/4
- 1/1

These widths define how much of the workspace track the surface occupies when it is active or partially visible in a transition state.

Examples:

- Editor at 100%, Terminal at 2/3, Browser at 100%
- Editor at 2/3, Terminal at 1/3, Browser at 3/4
- Editor at 1/1, Terminal at 1/2, Browser at 1/2

The viewport should snap to meaningful anchors rather than scroll freely. This keeps movement predictable and keyboard-friendly.

## Workspace Track Behavior

For each project, the workspace track stores:

- ordered surfaces
- width of each surface
- current viewport position
- current active surface
- open editor state
- terminal session state
- browser session state

The default surface order for v1 is:

- Editor
- Terminal
- Browser

Future versions may allow the user to reorder Terminal and Browser, but v1 should keep a fixed order for clarity and implementation simplicity.

### Example Flow

If a project is configured with:

- Editor: 100%
- Terminal: 66%
- Browser: 100%

Then moving right across the track might produce the following snap states:

1. Full Editor
2. Editor + Terminal
3. Terminal-focused
4. Terminal + Browser
5. Full Browser

Moving left reverses the sequence.

This should feel like sliding a viewport across a continuous development scene.

## Top Bar and Mini-Map

The top bar should act as both the title bar and a workspace mini-map.

It should communicate:

- current project name
- local or remote status
- current branch
- current surface focus
- relative layout of Editor, Terminal, and Browser
- current viewport position along the workspace track

The mini-map should visually show:

- the ordered surfaces
- each surface's snap width
- the current viewport or focus region

This gives users an always-visible orientation aid so the horizontal workflow remains learnable and intuitive.

The top bar should avoid looking like a traditional tab strip. It should feel closer to a navigation strip for the active project's working environment.

## Project Rail

The Project Rail is always present on the left side of the app.

It is the primary mechanism for switching between projects.

Each project entry may show:

- project name
- icon or color marker
- current branch
- dirty Git state
- remote host badge
- running terminal or task badge
- alert state such as failed task or disconnected remote

### Project Rail States

The rail supports at least two display modes:

- Expanded
- Compact

Expanded mode shows project names and metadata.

Compact mode collapses the rail into a thin bar that preserves quick switching while maximizing workspace width.

The rail should animate cleanly between these states without changing the user's mental model.

## Project Switching

Switching projects replaces the right-hand Project Workspace with the saved state of the selected project.

Project switching must restore:

- active surface
- viewport position on the workspace track
- editor tabs and cursor positions
- terminal sessions and running tasks
- browser URL and session state
- sidebar mode and dock position
- local or remote connection context

Project switching is not a file-system switch alone. It is a full restoration of the project's working scene.

## Sidebar / Inspector

Inside the Project Workspace, NaEditor includes an Inspector panel for project tools and navigation.

The Inspector is separate from the horizontal track and can be:

- docked left
- docked right
- collapsed

The Inspector supports modes such as:

- Files
- Search
- Git / Source Control
- Branches
- Comments / Review
- Remote / SSH
- Problems / Diagnostics

The Inspector should be contextual and lightweight. It should never permanently crowd the workspace track.

## Three Primary Surfaces

### 1. Editor

The Editor is the main coding surface. It must support all regular modern editor workflows expected from a daily driver.

Required capabilities:

- syntax highlighting
- fast file open
- tabs and splits
- find and replace
- breadcrumbs or similar navigation
- multi-cursor editing
- formatting
- diagnostics
- go to definition
- rename
- references
- hover
- symbol navigation
- large-file resilience

The Editor should preserve cursor and scroll state per file.

### 2. Terminal

The Terminal is a first-class surface, not a bottom drawer.

Required capabilities:

- multiple sessions per project
- persistent session history
- keyboard-first focus switching
- command execution
- task integration
- support for local and remote shells

The Terminal should remember active session, command history, and scroll position per project.

### 3. Browser

The Browser is a project-bound web preview surface.

It is not intended to be a full general-purpose browser. Its purpose is to support development workflows, especially for web projects.

Required capabilities:

- open the project's local dev URL
- remember per-project URLs
- support multiple preview pages if needed
- support remote port forwarding and tunneled previews
- reconnect cleanly when local or remote servers restart
- optional developer inspection tools

The Browser should feel native to the project, not separate from it.

## Keyboard Interaction Model

Keyboard navigation is central to the product.

### Project Navigation

- `ctrl+cmd+down`: switch to next project in the rail
- `ctrl+cmd+up`: switch to previous project in the rail

Project switching should restore the exact workspace state last used for that project.

### Workspace Track Navigation

- `ctrl+cmd+right`: move viewport to the next snap point on the workspace track
- `ctrl+cmd+left`: move viewport to the previous snap point on the workspace track

These commands navigate the user spatially across Editor, Terminal, and Browser.

### Surface Anchors

- `ctrl+cmd+1`: anchor to Editor
- `ctrl+cmd+2`: anchor to Terminal
- `ctrl+cmd+3`: anchor to Browser

Anchoring jumps to the primary snap state associated with that surface.

### Layout Adjustment

- `ctrl+cmd+]`: increase width of selected surface
- `ctrl+cmd+[` : decrease width of selected surface

These shortcuts cycle through the supported snap widths.

### UI Controls

- `ctrl+cmd+b`: expand or collapse Project Rail
- `ctrl+cmd+i`: toggle Inspector
- `ctrl+cmd+\\`: move Inspector from left dock to right dock and back

These are proposed defaults and can evolve, but the general interaction model should remain stable.

## Remembered State Model

Each project should preserve its own workspace state independently.

Per-project state includes:

- active surface
- viewport snap position
- snap width settings
- editor files, tabs, and cursor state
- split configuration
- terminal sessions
- terminal focus state
- browser URL and session state
- Inspector mode and dock side
- local or remote environment details
- Git branch and source-control context if already loaded

This persistence is one of the key product differentiators.

## Git Workflow

Git is a required part of the core experience and should be visible within the project workspace.

Expected v1 capabilities:

- repo status
- changed files
- staged and unstaged changes
- diff viewer
- commit flow
- branch switch
- branch creation
- log and history view
- blame and file history

Future versions may include deeper review features such as inline comments, pull request workflows, and richer collaboration surfaces.

## Remote Development

Remote development must be a first-class capability.

NaEditor should support SSH-based remote work in a way that feels native to the project model.

Expected capabilities:

- connect to remote machines over SSH
- browse and edit remote files
- run remote terminals
- preserve remote project state like local projects
- support remote Git workflows
- support remote browser previews via port forwarding

In the UI, local and remote projects should be represented consistently, with remote status visible but not intrusive.

## Performance Goals

Performance is part of the product promise.

The editor should feel fast enough that the user never hesitates before switching context.

Target goals for v1:

- cold app launch feels near-instant on modern Macs
- warm project switching feels immediate
- file open is effectively instant for normal files
- typing latency is imperceptible
- search results stream quickly
- Git status remains responsive in large repositories
- remote interaction feels low-friction

Performance budgets should be tracked explicitly during implementation.

## Design Tone

NaEditor should feel:

- native to macOS
- minimal but not empty
- powerful without dashboard clutter
- spatial and intentional
- calm during project switching

The interface should communicate that this is a serious daily-driver developer tool, not a toy shell around an editor.

## What Makes NaEditor Different

NaEditor is defined by the combination of these traits:

- one persistent window
- visible multi-project workflow
- per-project saved working scene
- horizontal snap-track workspace
- editor, terminal, and browser as equal first-class surfaces
- keyboard-native navigation across both projects and surfaces
- integrated local and remote workflows

This combination is the product thesis.

## MVP Scope

The MVP should focus on proving the core interaction model rather than trying to match every mature editor feature immediately.

### MVP Must Have

- single-window application
- Project Rail with expanded and compact modes
- per-project workspace persistence
- Workspace Track with Editor, Terminal, Browser
- snap-based horizontal navigation
- top-bar mini-map
- integrated file explorer
- core code editing
- integrated terminal
- project-bound browser preview
- basic Git workflow
- SSH remote project support
- keyboard shortcuts for project and surface navigation

### MVP Nice to Have

- branch badges in the Project Rail
- project status badges
- dev server detection
- port forwarding UI
- lightweight browser inspection tools
- richer command palette

### Post-MVP

- reorderable workspace track surfaces
- advanced PR and review workflows
- comments and collaborative review
- AI-assisted navigation or review
- worksets that bundle multiple projects into one named context
- cross-project search and symbol navigation
- automation and task orchestration

## Non-Goals for MVP

To keep the first version focused, the following are not required for MVP:

- full extension marketplace parity with VS Code
- arbitrary browser replacement for general web browsing
- every advanced Git operation
- multi-user collaboration
- fully customizable window manager behavior

## Suggested Internal Terminology

To keep the product language consistent:

- Project Rail: the persistent list of projects on the left
- Project Workspace: the full saved working environment for one project
- Workspace Track: the horizontal strip containing Editor, Terminal, Browser
- Surface: one of the primary working areas on the track
- Inspector: the contextual sidebar for files, Git, search, comments, remote, and diagnostics
- Anchor: a primary snap destination for a surface
- Snap Point: a keyboard-reachable viewport position on the track

## Open Questions

These items should be resolved during design and prototyping:

- Should Browser and Terminal remain fixed in order for v1, or should limited reordering be allowed?
- Should the Browser support multiple tabs in MVP or only a single project preview session?
- Should the Project Rail show only active projects or also recent and pinned projects?
- Should the top mini-map be clickable in addition to keyboard navigable?
- How much Git review and comment functionality belongs in MVP versus later phases?
- Should the Inspector mode be remembered globally, per project, or both?
- How should remote port forwarding be exposed without adding clutter?

## Summary

NaEditor is a high-performance single-window developer environment for macOS built around one central idea:

Each project should feel like a preserved, live workspace containing code, terminal, and browser preview, all accessible from a single persistent window.

The signature interaction is the Workspace Track, a horizontal snap-based layout that allows users to move fluidly across Editor, Terminal, and Browser while keeping project context intact.

If executed well, NaEditor can offer a workflow that feels meaningfully better than the multi-window editor model used today.
