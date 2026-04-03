# Worldbuilding Desk Web App

This package contains the main authoring UI for Worldbuilding Desk. It is a Vite + React + TypeScript app that powers projects, the writing workspace, world bible, compendium, ruleset editing, and settings.

## Commands

Run these from the repo root unless noted otherwise:

- `pnpm dev:web` starts the app on `http://localhost:5173`
- `pnpm build:web` builds the web app
- `pnpm --filter web lint` runs app linting
- `pnpm --filter web e2e:open` opens Cypress
- `pnpm --filter web e2e:run` runs Cypress headlessly

For browser-only development paths that still use the local Anthropic streaming proxy, start this in a second terminal:

```bash
cd apps/web
npx tsx proxy-server.ts
```

## Main Areas

- `src/routes/` route-level screens and orchestration
- `src/components/` shared UI, editor, assistant, and settings controls
- `src/services/` IndexedDB-backed storage and higher-level domain services
- `src/styles/` route shell and theme styling
- `cypress/e2e/` smoke and workflow coverage

## Current Notes

- The web app is the main active product surface even though the repo also includes an Electron host in `apps/desktop`.
- In Electron, AI completions and streams now route through the main process IPC bridge instead of a user-visible local proxy.
- `WorkspaceRoute.tsx` is currently the largest route and the clearest candidate for future decomposition.
- Cypress coverage exists for key smoke flows, but most feature validation is still manual.
