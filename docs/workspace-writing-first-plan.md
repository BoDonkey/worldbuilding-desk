# Workspace Writing-First Plan

Last updated: 2026-04-11

## Goal

Restore the Writing Workspace to a writing-first layout where the manuscript is the primary focus and tools support it without crowding it.

## Problems To Fix First

- The AI assistant currently opens inside the center editor area instead of the right context rail.
- The editor component owns too much layout behavior (`AI`, `System History`, `Lore Inspector`) instead of just editing text.
- Workspace chrome has grown too loud:
  - help panels
  - notification/status banners
  - review notices
  - drawer controls
- The editor toolbar no longer stays readily available while drafting long scenes.

## Implementation Order

### Slice 1 — Restore Right-Rail Tools

- Move `AI Assistant`, `System History`, and `Lore Inspector` back into the workspace context drawer.
- Remove editor-owned side-panel layout from `EditorWithAI`.
- Keep the center column focused on:
  - title
  - status block controls
  - review banner when needed
  - manuscript editor

Exit criteria:

- Opening AI no longer narrows the manuscript column.
- Right-drawer tools replace the context panel instead of competing with the editor.
- The editor toolbar remains accessible while scrolling.

### Slice 2 — Reduce Workspace Chrome

- Collapse or demote onboarding/help surfaces.
- Consolidate status and notification banners into a smaller, less persistent area.
- Keep import/review messaging contextual rather than permanently visible.

Exit criteria:

- A writer can open Workspace and immediately identify where to draft.
- The top of the page no longer feels like a stack of notices.

### Slice 3 — Component Boundary Cleanup

- Make `WorkspaceRoute` the owner of layout and drawer state.
- Make `EditorWithAI` responsible only for:
  - editor behavior
  - selection tools
  - inline popovers
- Keep tool panels (`AI`, `System History`, `Lore Inspector`) outside the editor component.

Exit criteria:

- Layout ownership is clear from the code.
- Editor behavior changes no longer require layout-level edits.

## Recommended Branches

- `codex/workspace-writing-first`
- `codex/workspace-ux-cleanup`
- `codex/workspace-boundary-cleanup`
