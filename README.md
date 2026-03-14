# SpaceCode

SpaceCode is a single-window, multi-project developer workspace for macOS built with Electron, React, and TypeScript.

This initial implementation includes:

- persistent Project Rail
- top-bar workspace mini-map
- horizontal Workspace Track with Editor, Terminal, and Browser surfaces
- collapsible Inspector
- per-project workspace persistence
- basic local file browsing
- recursive file explorer
- richer Git inspector with changed files
- Monaco editor integration
- xterm.js plus PTY-backed terminals
- Electron-managed browser preview surface
- SSH-backed remote project flow

## Run

1. Install dependencies

```bash
npm install
```

2. Start the app

```bash
npm run dev
```

3. Build the app

```bash
npm run build
```

## Keyboard Shortcuts

- `ctrl+cmd+down`: next project
- `ctrl+cmd+up`: previous project
- `ctrl+cmd+right`: next workspace snap point
- `ctrl+cmd+left`: previous workspace snap point
- `ctrl+cmd+1`: anchor to editor
- `ctrl+cmd+2`: anchor to terminal
- `ctrl+cmd+3`: anchor to browser
- `ctrl+cmd+s`: save active file
- `ctrl+cmd+b`: collapse or expand the Project Rail
- `ctrl+cmd+i`: toggle Inspector
- `ctrl+cmd+\`: move Inspector left or right
- `ctrl+cmd+]`: increase width of active surface
- `ctrl+cmd+[` : decrease width of active surface

## Notes

Remote projects are added from the Project Rail via the `SSH` button. The current remote implementation uses the system `ssh` command for file reads/writes, Git status, and PTY-backed shell sessions.
