# Worldbuilding-Desk Project Status

**Last Updated:** April 29, 2026

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
- Active projects now route directly into the writing workspace.
- Scene/context drawers now default closed so the editor remains primary.
- Scene creation, deletion, autosave, and export.
- Markdown, DOCX, and EPUB export flows.
- Import modes for scene ingestion: `strict`, `balanced`, `lenient`.
- Deferred consistency review for imported scenes so writing is not blocked.
- Imported scene text is persisted before post-import review runs.
- Inline consistency highlights and action popovers.
- Review candidates carry deterministic detection reasons for easier import-noise triage.
- Review readiness counts dedupe inline deferred issues against manual sidebar review results.
- Project review results for the active scene now feed editor review highlights, so the side rail and editor underlines stay aligned.
- Resolving, linking, dismissing, or ignoring a review surface now clears both the active editor highlight and the project review rail item.
- Active-scene review refreshes when canon, aliases, or characters change, including after returning from World Bible.
- Editable review capture flow for detected names/places before adding to world records.
- Manual selection-to-world capture from the editor for non-detected text.
- Temporary dismiss and project-level `Always ignore` review actions.
- Inline lore highlights and quick lore popovers for known entities and characters.
- World Bible review queue for finishing review-created records and alias follow-up.
- Editor appearance controls for width, surface style, and serif/sans presentation.
- Passive review readiness indicator in the workspace header and Review drawer tab.
- Deterministic state-change suggestions stay in the Review drawer, can be accepted or rejected explicitly, support per-scene batch actions, and can be hidden until the source scene changes so drafting is not blocked.
- Hidden deterministic state suggestions now surface only as lightweight review summaries with per-scene and project-level restore actions.
- Project scratchpad is available as an autosaved quick-access modal and remains available from the workspace context drawer.
- Scratchpad records are included in project backup snapshots and restore paths.
- Lightweight Corkboard is back as a workspace planning modal for chapter cards and plot points.
- Corkboard chapter-card records are included in project backup snapshots and restore paths.
- App-shell search is now visibly exposed and returns unified scene plus World Bible results.

### Story Context Systems
- World Bible with dynamic categories and custom field schemas.
- Character records and character sheets.
- Alias tracking and consistency storage.
- Review linking can now target either World Bible entries or characters.
- World Bible review completion now treats saving or marking reviewed as clearing both record completion and alias follow-up.
- System history and lore inspection surfaces.
- Shared lore/review text matcher now owns canon normalization, possessives, longer-match priority, and in-progress known-name prefix suppression.
- Parent/child canon inheritance with promotion and sync flows.
- Project backup export/import with validation and conflict review.

### AI and Retrieval
- Multi-provider abstraction for Anthropic, OpenAI, Ollama, and Gemini.
- Prompt management and provider diagnostics.
- Local RAG and Shodh memory services for contextual assistance.
- Selection-aware AI insertion and editor assistance tools.
- Inherited canon support in AI grounding for parent/child projects.
- Deterministic `WorldEngine` boundary for workspace review, with schema-validated observation/classification shapes.
- Feature-flagged local review annotations now run through the `WorldEngine` boundary using project-scoped Ollama settings while keeping deterministic validation as the source of truth.
- Local review annotation requests now use issue-local context windows instead of full-scene text, reducing latency on longer scenes and falling back cleanly to deterministic annotations on timeout or parse failure.
- Dev-mode RAG embedding loads now default to deterministic lightweight fallback instead of noisy browser-transformer fetch failures.
- Scene-scoped state mutation tracking now exists as a project-scoped persistence layer with accepted/invalidation flow, replay, and workspace inspection surfaces.
- Deterministic `state_delta_candidate` extraction now feeds the same typed mutation ledger as proposed `deterministic-review` events rather than mutating tracked state automatically.

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
- Shared text matching contract added for smoke-critical lore/review matching paths.

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
- Continue moving alias/review acceptance into a stronger World Bible workflow.
- Extend the passive review-needed indicator into changed-word plus idle-pause background cadence.
- Finish review/count correctness where overlap between known-lore and unresolved-review highlights can still confuse authors.
- Decide whether Corkboard graduates from a quick-access modal into a dedicated planning tab/route while keeping the modal for in-scene reference.
- Add a deliberate AI-to-Scratchpad capture action so planning thoughts from right-rail conversations are easy to retain.
- Define the next Scratchpad evolution: likely lightweight organization rather than one flat note forever.
- Finish the first search UX pass by manually retesting scene-result restore/jump behavior and deciding whether Compendium should join unified search results.

### Engineering
*Ordering aligned with the 2026-04-18 architecture-review addendum.*

- **Zustand store, slice by slice** — elevated above further route extraction. Start with `activeProject` and `projectSettings`; treat `localStorage` and `IndexedDB` as persistence adapters rather than direct state sources. De-risks every remaining route extraction.
- Continue trimming `WorkspaceRoute` orchestration where extraction still leaks route-owned knowledge (export flow and canon sync are the next candidates; target under 800 lines for the route shell).
- Extract `WorldBibleRoute` import/alias resolution into a hook or service utility; keep display/editing inline.
- Add targeted smoke coverage for the workspace import/review path after the recent extraction.
- Add one Playwright Electron E2E covering the LLM streaming path — smallest change with the highest payoff against silent IPC regressions.
- Decide auto-update strategy (Squirrel / electron-updater / manual) before the first externally shared build; affects main-process structure and code signing.
- Re-enable suppressed React hook lint rules one at a time (`set-state-in-effect`, `purity`, `preserve-manual-memoization`); prefer targeted inline disables with a `// why:` comment over blanket config suppression.
- Rename `@litrpg-tool/*` internal packages to match the writing-first product identity. Cheapest while the monorepo is still small.
- Remove stray `@tiptap/*` dependencies from the root `package.json` (already correctly declared in `apps/web`).

### Documentation
- Keep summary docs aligned with the writing-first UX direction.
- Treat older “functional IDE” language as implementation heritage, not the main pitch.
- Dual LLM review direction is captured in `docs/dual-llm-review-architecture.md`: local World Engine for passive structured review, BYOK providers for explicit creative work.
- Near-term state-tracking direction is now grounded by persisted mutation-ledger scaffolding rather than docs alone: future accepted state deltas can be tied to `sceneId`, `sceneOrder`, `sourceRevision`, and `sourceHash`.
- The current review UX direction for deterministic state suggestions is passive-by-default: proposals stay out of the writing flow, do not affect replay until accepted, and can be hidden and later restored without rejecting them.

---

## Verification Status

### Verified Recently
- `pnpm build:web` succeeds on the current tree.
- Backup export/import coverage exists in the smoke checklist.
- Manuscript export flows are covered in smoke documentation.
- World Bible duplicate-name conflict review exists.
- Ollama diagnostics and model detection flows exist.
- Review completion smoke coverage now has a dedicated checklist spanning import -> workspace review -> World Bible queue completion.
- Review queue smoke pass is in progress on `codex/world-bible-review-queue`.
- Initial deterministic World Engine slice is implemented and covered by false-positive unit tests.
- Feature-flagged local review annotations are implemented behind the existing `Project review engine` setting and now use issue-local excerpt windows instead of whole-scene prompts.
- Local review annotation requests now timeout and fall back to deterministic annotations instead of leaving Project Review stuck in `running`.
- Manual scene-derived state mutation commands now write to the ledger, including explicit within-scene `sceneSequence` ordering.
- Character Sheets now supports manual mutation entry, mutation editing, per-scene step reordering, replayed state inspection, stale-event detection, and targeted invalidation.
- Workspace scenes now surface stale-state badges plus a selected-scene state timeline with per-step summaries and end-of-scene snapshots.
- The workspace editor now supports character hover-card previews that show replayed state at the selected scene.
- Passive review indicator state is implemented for deterministic/manual review state.
- Deterministic review can now propose scene-scoped state changes, show before/after previews, explain individual versus batch validity, support scene-level batch accept/reject, and preserve hidden suggestions outside the active queue until restored.
- Import persistence now precedes post-import review in the shared workspace persistence path.
- Import unknown extraction is more conservative for one-off multiword candidates unless a stronger detection reason exists.
- Sidebar review now shows detection reasons for unknown-entity candidates.
- Project Review UI now uses author-facing issue labels such as `Unknown name`, `Repeated name`, and `Context clue` instead of raw internal codes such as `UNKNOWN_ENTITY` and `repeated_unknown`.
- Deferred imported scenes use stricter import-source extraction when rehydrated or reviewed from the sidebar.
- Review readiness counts dedupe the same issue across inline and sidebar review sources, and the context sidebar scrolls independently.
- Manual Project Review results now underline in the active editor scene instead of appearing only in the side rail.
- Creating/linking/dismissing one review item no longer drops remaining unresolved underlines from the active editor scene.
- Returning from World Bible after accepting records now refreshes active-scene review state so known canon turns blue while remaining unknowns stay reviewable.
- Deterministic extraction now handles Unicode hyphenated titled names such as `Dr. Müller-Sarkisian`.
- Common sentence-start words such as `Look`, `Some`, and `Don't` are suppressed before review highlighting.
- Shared lore/review matcher now covers known-lore highlights, review highlights, possessive forms, and in-progress known-name prefix suppression.
- Cypress coverage verifies `Ember Archive` highlights as known lore and partial `Ember Archiv` does not become a review underline.
- Cypress coverage was added for manual Project Review highlighting and for preserving remaining review highlights after creating one reviewed record.
- Scratchpad autosave/reload behavior is covered by Cypress.
- Scratchpad backup export/import round-trip is covered by the Cypress post-merge smoke.
- Scratchpad is included in project backup snapshot/import paths.
- Project backup smoke now explicitly covers Scratchpad and Corkboard round-trip, and the latest manual pass is green after fixing scratchpad import identity plus merge-category duplication.
- App-shell search is visible from the rail/mobile nav, scene search reloads after writing changes, and World Bible search focus now switches to the correct category tab.
- During the smoke pass, the following review/alias issues were fixed:
  - self-alias creation when a new record name matched the detected surface
  - repeated single-word proper names not surfacing from sentence-start mentions
  - alias linking controls only showing close matches and defaulting to an invalid target value
  - duplicate alias display/counts in World Bible review queue
  - alias lore highlights using canonical names instead of alias surfaces
  - possessive alias normalization mismatch between consistency scan and editor highlights
- `@xenova/transformers` is already dynamically imported behind the RAG embedding path and builds as a separate Vite chunk.

### Current Verification Notes
- `pnpm --filter web lint` passes.
- `pnpm --filter web test:unit` passes: 30 tests.
- `pnpm --filter web build` passes with the existing Vite large-chunk and `onnxruntime-web` eval warnings.
- `pnpm --filter web exec cypress run` passes: 18 tests across review matching, post-merge smoke, scratchpad, and workspace navigation lock.
- The post-merge Cypress smoke selectors were updated to match the current writing-first UI: `Scenes` / `Context` drawer controls, collapsed `Settings` sections, `/projects` backup flow, and stat-block rebind popovers.
- In the Codex desktop sandbox, Cypress GUI launch can still abort before startup; the suite passes when run outside that sandboxed GUI restriction.
- Stop point for the current session:
  - backup/import validation, scratchpad, review matching, and workspace navigation checks are passing in Cypress
  - search is exposed and World Bible results behave correctly
  - workspace scene restore and in-scene search targeting still need a fresh manual retest
  - deterministic review proposals now feed scene-scoped mutation ledger events, but the long-scene manual UX pass still needs to confirm the passive review flow feels unobtrusive in practice

### Still Worth Rechecking
- Workspace import/retry UX after the drawer extraction.
- Narrow viewport drawer/modal interactions.
- Any route-level assumptions introduced by the newer Zustand migration.
- Full manual review-completion smoke after the next review/workspace UX change, rather than continuing to iterate on the current interaction model.
- Recheck scratchpad backup export/import parity with a populated project.
- Recheck workspace route-return behavior:
  - open a later scene
  - visit World Bible
  - return to Workspace
  - confirm the same scene stays selected
- Recheck scene search targeting:
  - search for a term known to exist in scene text
  - open the scene result
  - confirm the editor lands on the first matching occurrence and scrolls it into view
- Manually retest the new state workflow in long scenes:
  - same-scene step ordering
  - stale badge visibility after scene edits
  - scene timeline readability
  - character hover-card usefulness during drafting
- Recheck passive review ergonomics for deterministic state suggestions:
  - hide a suggestion and confirm writing flow remains unaffected
  - confirm hidden-count summaries appear in Project Review
  - restore one scene's hidden suggestions
  - restore all hidden suggestions
- Decide whether unified search should expand from scene + World Bible into Compendium/canon-wide results.

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
