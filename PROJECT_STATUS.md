# Worldbuilding-Desk Project Status

**Last Updated:** April 12, 2026

## Project Overview

Worldbuilding-Desk is a desktop writing environment for fiction authors. The current product direction is **writing first**: authors should be able to open the app, start drafting immediately, and let structure, lore tracking, and consistency support appear progressively instead of blocking the writing flow.

Under the hood, the app still includes rich systems for world data, rules, character state, AI assistance, and consistency review. The difference in the current direction is presentation: those systems are support infrastructure, not the primary surface.

---

## Current Product Direction

### UX North Star
- Open directly into writing.
- Hide advanced systems by default.
- Keep feedback soft and ignorable.
- Make lore and structure auto-assisted where possible.
- Treat AI as a collaborator, not an authoring replacement.

### Product Positioning
- Primary value: maintain creative flow while keeping story context coherent.
- Secondary value: provide optional structured systems for authors who want deeper world/rules support.
- Differentiator: passive context awareness and narrative consistency support, without forcing up-front setup.

---

## Current Features

### Writing Workspace
- TipTap-based rich text editor.
- Workspace command palette and drawer-based shell.
- Scene creation, deletion, autosave, and export.
- Markdown, DOCX, and EPUB export flows.
- Import modes for scene ingestion: `strict`, `balanced`, `lenient`.
- Deferred consistency review for imported scenes so writing is not blocked.
- Inline consistency highlights and action popovers.
- Inline lore highlights and quick lore popovers for known entities and characters.
- Editor appearance controls for width, surface style, and serif/sans presentation.

### Story Context Systems
- World Bible with dynamic categories and custom field schemas.
- Character records and character sheets.
- Alias tracking and consistency storage.
- System history and lore inspection surfaces.
- Parent/child canon inheritance with promotion and sync flows.
- Project backup export/import with validation and conflict review.

### AI and Retrieval
- Multi-provider abstraction for Anthropic, OpenAI, Ollama, and Gemini.
- Prompt management and provider diagnostics.
- Local RAG and Shodh memory services for contextual assistance.
- Selection-aware AI insertion and editor assistance tools.
- Inherited canon support in AI grounding for parent/child projects.

### Optional Game/System Layers
- Standalone `rules-engine` package with stats, resources, formulas, effects, and dice.
- Ruleset builder and runtime stat/resource evaluation.
- Settlement progression, synergy logic, and compendium systems.
- Character/runtime previews for effective stat and resource values.

---

## Current Architecture Status

### Stabilized
- Service layer reorganized into domain folders with barrel exports.
- `App.tsx` split into routing/layout composition and shared shell concerns.
- Workspace logic decomposed into focused hooks:
  - `useWorkspaceDrawers`
  - `useWorkspaceMemories`
  - `useWorkspaceStatBlocks`
  - `useWorkspaceConsistency`
  - `useWorkspaceDocuments`
  - `useWorkspaceProjectData`
  - `useWorkspaceLoreSnippets`
- Workspace drawer UI extracted into:
  - `WorkspaceSceneDrawer`
  - `WorkspaceContextDrawer`
- Zustand app store added to reduce `activeProject` prop drilling.

### Current Assessment
- The route decomposition is viable and now builds cleanly again.
- The latest local refactor had stopped in an intermediate state; that stabilization pass is now complete.
- The remaining work is product-shaping work, not emergency architecture repair.

---

## Immediate Priorities

### Product / UX
- Make the writing workspace the clearest default entry point.
- Reduce visible system complexity on first load.
- Revisit panel defaults and route emphasis to match the writing-first UX docs.
- Soften entity/canon review interactions where they still feel too workflow-heavy.

### Engineering
- Add targeted smoke coverage for the workspace import/review path after the recent extraction.
- Continue trimming `WorkspaceRoute` orchestration where extraction still leaks route-owned knowledge.
- Consider code-splitting large web bundles, especially the transformer-related client chunk.

### Documentation
- Keep summary docs aligned with the writing-first UX direction.
- Treat older “functional IDE” language as implementation heritage, not the main pitch.

---

## Verification Status

### Verified Recently
- `pnpm build:web` succeeds on the current tree.
- Backup export/import coverage exists in the smoke checklist.
- Manuscript export flows are covered in smoke documentation.
- World Bible duplicate-name conflict review exists.
- Ollama diagnostics and model detection flows exist.

### Still Worth Rechecking
- Workspace import/retry UX after the drawer extraction.
- Narrow viewport drawer/modal interactions.
- Any route-level assumptions introduced by the newer Zustand migration.

---

## Run / Dev Notes

### Prerequisites
```bash
npm install -g pnpm
pnpm install
```

### Main Development Commands
```bash
pnpm dev:web
pnpm build:web
pnpm start:desktop:dev
```

### AI Proxy
```bash
cd apps/web
npx tsx proxy-server.ts
```

---

## Working Summary

The project is no longer best described as a systems-heavy LitRPG IDE that happens to contain an editor. The better description of the current direction is:

**a writing-first narrative workspace with optional structured context, consistency support, and deeper systems available when the author wants them.**
