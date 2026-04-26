# Architecture Review — Worldbuilding Desk

*Reviewed: 2026-04-08*

*Status update: 2026-04-09*

*Status update: 2026-04-11*

*Status update: 2026-04-18*

---

## Overview

This is a monorepo LitRPG/worldbuilding authoring tool evolving from a React SPA into an Electron desktop app. The core architecture is appropriate for the scope, and the service layer / rules-engine separation reflects good instincts. The main risks are in state management fragmentation and a bloated top-level component that will become increasingly painful as features are added.

---

## What's Working Well

### Monorepo Structure
The split between `packages/rules-engine` (framework-agnostic TypeScript) and `packages/rules-ui` (React wrapper) is the right call. It keeps game logic independently testable and reusable, and enforces a clean boundary between domain and UI.

### Service Layer
Domain-organized service subdirectories (`ai/`, `consistency/`, `compendium/`, `rules/`, `storage/`, `system/`, `characters/`) with barrel exports now produce clean import paths throughout the codebase. The LLM multi-provider registry is well-designed and continues to scale cleanly.

### Electron IPC Bridge
The IPC surface area is minimal — only LLM streaming crosses the bridge. `apiHandler.ts` validates payloads before processing. The Anthropic adapter now uses raw `fetch()` SSE parsing instead of the SDK, removing a Node.js SDK dependency from the main process — a cleaner posture for a sandboxed Electron app.

### CSS Token System
`apps/web/src/styles/theme.css` now centralizes all theming into cascading CSS custom properties under `data-theme`, `data-font-size`, `data-editor-font`, `data-editor-width`, `data-editor-line-height`, and `data-editor-surface` attributes. Light/dark, editor typography, surface presets, and accessibility font sizes are all expressed as clean token overrides from a single file.

### TypeScript Consistency
Strict TypeScript across packages, Zod for runtime validation in the rules-engine, and consistent type exports establish a solid type safety baseline.

---

## Issues & Action Plan

Issues are prioritized by impact on future development velocity.

---

### Priority 1 — `App.tsx` Does Too Much

**Status:** Completed.

**Problem:** The top-level component handled route switching (via manual `switch(pathname)`), command palette registration, localStorage state sync, and route history debugging with `window.__wbd*` globals — all in ~309 lines. Every new route or concern touched this file.

**Impact:** High. This was slowing down every feature addition and creating merge conflicts on a file that shouldn't change often.

**Implemented:**
- `App.tsx` is now 160 lines — declarative `<Routes>` using React Router's `<Route>`/`<Outlet>` pattern, replacing the manual switch.
- `AppShellLayout` component receives props cleanly from a shared state hook.
- `useAppShellState` hook owns localStorage sync, active project, and rail-collapse state.
- `CommandPaletteProvider` context extracted from the app shell.
- Route debug globals extracted to `utils/routeDebug.ts` and isolated from the core component.

---

### Priority 2 — Three Sources of State Truth

**Problem:** `localStorage`, `IndexedDB`, and React state are all used for overlapping concerns. `activeProject` and `projectSettings` are then prop-drilled through multiple component layers on top of that. This creates desync risk and makes it hard to reason about what the current application state actually is.

**Impact:** High. As the app adds features, these inconsistencies will surface as subtle bugs that are hard to reproduce.

**Action:**
- Introduce **Zustand** as a central store. It's minimal, has no boilerplate, and works naturally with an IndexedDB hydration pattern.
- `localStorage` and `IndexedDB` become persistence adapters that hydrate/flush the store — not direct state sources.
- Replace prop drilling of `activeProject`/`projectSettings` with a store slice accessible via hook.

---

### Priority 3 — Flat `services/` Directory

**Status:** Completed.

**Problem:** All service files lived in a single flat directory regardless of domain.

**Implemented:**
- Service modules are now grouped into domain subdirectories with barrel exports:
  - `services/ai/` — LLMService, RAGService, providers, prompt management
  - `services/consistency/` — ConsistencyEngineService, alias storage, deferred review (previously `consistencyEngine/`)
  - `services/compendium/` — compendium tracking, milestones, recipes
  - `services/rules/` — ruleset service, ruleset transfer
  - `services/storage/` — project backup export/import, snapshot service, JSON transfer
  - `services/system/` — system history service
  - `services/characters/` — character sheet service, character transfer service
- All import sites updated throughout routes and components.

---

### Priority 4 — Suppressed ESLint Hook Rules

**Status:** Partially completed.

**Problem:** Several React hooks ESLint rules are disabled in config (`set-state-in-effect`, `purity`, `preserve-manual-memoization`). These rules are suppressed at the config level, meaning real violations are silently passing.

**Impact:** Medium. These rules exist to catch subtle stale-closure and infinite-render bugs.

**Action:**
- Re-enable the rules one at a time and fix the underlying violations rather than suppressing them.
- Prefer inline `// eslint-disable-next-line` with a comment explaining *why* for any cases that are genuine false positives, rather than blanket config disables.

**Implemented:**
- The major hook-rule violations in `WorkspaceRoute.tsx` were removed during the route decomposition work, and `pnpm --filter web lint` is now clean.
- Remaining config-level rule decisions should still be reviewed separately from this refactor.

---

### Priority 5 — No Electron Packaging Configuration

**Status:** Completed.

**Problem:** No `electron-builder` config was present. The app had no path to a shippable desktop build.

**Implemented:**
- `apps/desktop/package.json` now includes `electron-builder` config with:
  - `appId: com.worldbuildingdesk.app`
  - `productName: Worldbuilding Desk`
  - `mac` targets: `dmg` + `zip`, category `public.app-category.productivity`
  - `win` target: `nsis`
  - `extraResources` wiring the web renderer dist into the packaged app
  - `package` and `package:dir` scripts
- Auto-update strategy (Squirrel / electron-updater) is still unresolved — decide before the first externally-shared build, as it affects main-process structure.

---

### Priority 6 — No Desktop E2E Tests

**Problem:** Cypress tests hit `localhost:5173` (the Vite dev server) which validates the renderer but not the Electron IPC bridge. The LLM streaming path — the most critical Electron-specific feature — has no automated coverage.

**Impact:** Low-medium. Not blocking now, but the IPC bridge will silently break without it.

**Action:**
- Add Playwright with `@playwright/test` + `electron` support to `apps/desktop`.
- Write at minimum one E2E test that opens the Electron app, triggers an LLM stream, and asserts chunks are received in the renderer.

---

### Priority 7 — CSS Theming Scalability

**Status:** Completed.

**Problem:** Theming was handled via a `data-theme` attribute with duplicated values across light/dark blocks. Token count had grown to include editor surfaces, font families, line heights, and reading widths — increasingly hard to maintain across scattered CSS module files.

**Implemented:**
- `apps/web/src/styles/theme.css` consolidates all design tokens into a single source of truth:
  - `data-theme` → full light/dark color token set including editor highlights, lore overlay colors
  - `data-font-size` → base/sm/lg/xl and editor-specific font sizes
  - `data-editor-font` → serif / sans / dyslexic font stacks
  - `data-editor-width` → focused (760px) / wide (980px) max widths
  - `data-editor-line-height` → compact / comfortable / airy
  - `data-editor-surface` → paper / mist / contrast surface presets (independent of light/dark)
- Global focus ring and body color styles consolidated here.

---

### New — `WorkspaceRoute.tsx` Still Needs Reduction

**Problem:** `WorkspaceRoute.tsx` was 4037 lines. The hook extraction work reduced it to 2524 lines, which is materially better but still too large for a single route component. It continues to own too many concerns in-line.

**Impact:** Medium-high. The remaining inline mass creates friction for any workspace feature work.

**Action:**
- Continue hook extraction. Likely candidates for the next pass:
  - Export flow (Markdown/DOCX/EPUB) → `useWorkspaceExport`
  - Canon sync / series bible integration → `useWorkspaceCanon`
  - Stat block token rendering → already partially in `useWorkspaceStatBlocks`, audit what remains inline
- Target: under 800 lines for the route shell itself (pure composition + layout).
- Do not split into sub-routes yet — the workspace layout is genuinely single-screen; decompose hooks, not routes.

---

### New — `WorldBibleRoute.tsx` Growing

**Problem:** `WorldBibleRoute.tsx` is now 2368 lines, grown by ~430 lines this session. It added alias management (alternative names sync to consistency storage) and JSON import conflict resolution, both as inline logic.

**Impact:** Medium. Not yet as acute as `WorkspaceRoute`, but the same pattern will emerge.

**Action:**
- Extract alias sync logic into a utility or service function — it's pure data transformation, not UI.
- Consider a `useWorldBibleImport` hook for the JSON import session state, conflict resolution, and field-map logic.
- Keep alias display/editing in the route component; move resolution logic out.

---

### New — Electron Main Process: Remove `@anthropic-ai/sdk` from Runtime Bundle

**Status:** Completed during this session.

**Context:** The `AnthropicStreamingAdapter` in `apps/desktop/src/main/providers/ProviderRegistry.ts` previously imported `@anthropic-ai/sdk`, pulling a full Node.js SDK into the Electron main process bundle. This was replaced with a direct `fetch()` SSE reader.

**Why this matters:** The raw `fetch()` implementation is more transparent, easier to audit for IPC security, and removes a heavyweight transitive dependency from the main process. The SSE parsing loop (buffer-split, `data:` prefix trim, JSON parse, delta extraction) is now local and inspectable.

**Remaining concern:** The manual SSE parser has no timeout, no backpressure handling, and no reconnect logic. This is acceptable for a local-use app, but should be noted for any future work on streaming reliability.

---

## Summary Table

| Priority | Issue | Effort | Risk if Deferred | Status |
|----------|-------|--------|-----------------|--------|
| 1 | `App.tsx` routing & concern separation | Medium | High — slows every feature | **Done** |
| 2 | State management fragmentation | Medium-High | High — desync bugs accumulate | Pending |
| 3 | Flat `services/` directory | Low | Medium — navigability degrades | **Done** |
| 4 | Suppressed ESLint hook rules | Low | Medium — hidden render bugs | Partial |
| 5 | No Electron packaging config | Low | Medium — harder to retrofit | **Done** |
| 6 | No desktop E2E tests | Medium | Low-Medium — IPC regressions silent | Pending |
| 7 | CSS theming scalability | Low | Low — manageable for now | **Done** |
| 8 | `WorkspaceRoute.tsx` still large | Medium | Medium-high — workspace friction | In progress |
| 9 | `WorldBibleRoute.tsx` growing | Low-Medium | Medium — same pattern as workspace | New |

---

## Suggested Sequencing

*Reordered 2026-04-18 — state consolidation elevated above further route extraction. See the 2026-04-18 addendum below for rationale.*

1. **Services reorganization** — completed.
2. **Routing migration / app-shell split** — completed.
3. **CSS token consolidation** — completed.
4. **Electron packaging config** — completed.
5. **Zustand store, slice by slice** — next structural pass. Start with `activeProject` and `projectSettings`. `localStorage` and `IndexedDB` become persistence adapters that hydrate/flush the store rather than direct state sources. De-risks every remaining route extraction.
6. **WorkspaceRoute hook extraction (continued)** — target export flow and canon sync hooks; aim for under 800 lines in the route shell.
7. **WorldBibleRoute import/alias extraction** — low urgency, clean up alongside any WorldBible feature work.
8. **One Playwright Electron E2E covering LLM streaming** — smallest change with the highest payoff against silent IPC regressions.
9. **Auto-update strategy** — decide before first external build share; affects main-process structure and code signing.
10. **Keep transformer loading deferred** — `@xenova/transformers` is already dynamically imported in the RAG embedding path and builds as a separate chunk; preserve that split while addressing broader bundle size.
11. **Re-enable suppressed hook lint rules one at a time** — fix underlying violations; prefer targeted inline disables with a `// why:` comment over blanket config suppression.
12. **Rename `@litrpg-tool/*` packages** to align with the writing-first product identity. Cheapest while the monorepo is still small.

---

## Current Workspace Boundaries

`apps/web/src/routes/WorkspaceRoute.tsx` now acts as a composition shell over focused hooks:

- `useWorkspaceDrawers` — panel open/close state
- `useWorkspaceMemories` — Shodh memory panel state and operations
- `useWorkspaceStatBlocks` — stat block token insertion and template logic
- `useWorkspaceConsistency` — consistency engine integration, alias state
- `useWorkspaceDocuments` — active document, save/load, import pipeline

Still inline in the route (candidates for next extraction pass):
- Export flow (Markdown / DOCX / EPUB scene export)
- Canon sync and series bible operations (`getCanonSyncState`, `syncChildWithParent`, `promoteDocumentToParent`)
- Lore inspector panel integration

---

## 2026-04-18 Addendum

An independent architecture read on 2026-04-18 confirmed the overall posture is healthy: the `rules-engine` / `rules-ui` split is the strongest single decision in the repo, the Electron IPC surface remains narrow and auditable, and the service-layer reorganization is doing real work. Most of the priorities in the original review are genuinely complete. The following additions and one reordering came out of that pass.

### Priority reordering

The previous sequencing put continued `WorkspaceRoute` hook extraction ahead of the Zustand store. That ordering is reversed in the updated list above. Rationale: state-truth fragmentation (localStorage + IndexedDB + React state + partial Zustand) is the largest remaining source of latent bugs, and consolidating it now de-risks every remaining route extraction. The shell and hooks are clean enough that a store can be dropped in slice by slice without a full rewrite — the earlier work earned the right to do this cleanly, and deferring it means future route hooks inherit the fragmentation.

### New — Package namespace no longer matches product identity

**Problem:** Internal packages are namespaced `@litrpg-tool/rules-engine` and `@litrpg-tool/rules-ui`, but the product has repositioned as "a writing-first narrative workspace with optional structured context." The namespace is a branding and discoverability mismatch.

**Impact:** Low technically, medium narratively. Aligns the code with the pitch that is actually shipping.

**Action:** Rename the internal packages. Cheapest to do now while the monorepo is still small; becomes progressively more painful as external consumers, docs, and shipping artifacts reference the old names.

### New — Root `package.json` dependency drift

**Problem:** The root `package.json` declares `@tiptap/core`, `@tiptap/extension-text-style`, `@tiptap/react`, and `@tiptap/starter-kit` as direct dependencies. These are already (correctly) declared in `apps/web/package.json`. Root-level app dependencies in a pnpm workspace are usually historical drift rather than intent.

**Impact:** Low. Duplicate resolution, confusing ownership, and an attractive nuisance for future additions.

**Action:** Remove the TipTap dependencies from the root `package.json`. The root should only carry truly cross-workspace tooling (formatters, shared linters, etc.).

### New — Transformer bundle weight

**Status:** Implemented.

**Problem:** `@xenova/transformers` was a large renderer dependency. The concrete fix was to defer the load behind the first operation that actually needs it.

**Impact:** Medium for cold-start perception; less acute on desktop than web, but still worth protecting.

**Implemented:** `RAGService` dynamically imports `@xenova/transformers` inside the embedding pipeline loader. First RAG operation pays the load cost; subsequent operations reuse the cached pipeline promise. The current Vite build emits a separate `transformers` chunk.

### New — Auto-update timing is a design decision, not just a config task

**Context:** The earlier review noted that auto-update strategy (Squirrel / electron-updater / manual) is unresolved. Worth escalating: the choice affects main-process structure, code-signing setup, and release channel expectations. Retrofitting after the first external build share is materially more expensive than deciding now.

**Action:** Commit to a strategy before the first externally shared build. This is a decision, not code; do it now to avoid having to re-architect the main process later.

### New — Asymmetric test posture

**Observation:** The `rules-engine` package is the most testable thing in the repo and almost certainly carries the best coverage. The Electron IPC bridge — arguably the most failure-prone seam — has no automated coverage. Cypress against `localhost:5173` exercises the renderer only.

**Action:** Add one Playwright-driven Electron E2E that opens the app, triggers an LLM stream, and asserts chunks arrive in the renderer. Smallest change with the highest payoff against silent IPC regressions. Not an argument for broad E2E investment — one targeted test for the one path authors would notice breaking.

### Summary of deltas from earlier review

| Change | Type |
|--------|------|
| Zustand store elevated above further `WorkspaceRoute` extraction | Reordering |
| `@litrpg-tool/*` rename to match writing-first identity | New |
| Remove TipTap deps from root `package.json` | New |
| Lazy-load `@xenova/transformers` behind first RAG op (vs. generic "code-split") | Implemented refinement |
| Frame auto-update as a pre-external-share decision | Framing |
| Add one Playwright Electron E2E for the LLM streaming path | Refinement |
