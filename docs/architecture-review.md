# Architecture Review — Worldbuilding Desk

*Last reviewed: 2026-05-10*
*Previous updates: 2026-05-03, 2026-04-18, 2026-04-11, 2026-04-09, 2026-04-08*

This document is the single home for technical architecture decisions, subsystem design, and the actionable engineering chore list. It is complemented by three other active docs: `product-blueprint.md` (product vision and UX principles), `next-steps.md` (sprint roadmap and branch tracking), and `ux-refactor.md` (code-level implementation directives).

---

## What's Working Well

### Monorepo Structure
The split between `packages/rules-engine` (framework-agnostic TypeScript) and `packages/rules-ui` (React wrapper) is the strongest single architectural decision in the repo. It keeps game logic independently testable and reusable, and enforces a clean boundary between domain and UI.

### Service Layer
Domain-organized service subdirectories (`ai/`, `consistency/`, `compendium/`, `rules/`, `storage/`, `system/`, `characters/`) with barrel exports now produce clean import paths throughout the codebase. The LLM multi-provider registry is well-designed and continues to scale cleanly.

### Electron IPC Bridge
The IPC surface area is minimal — only LLM streaming crosses the bridge. `apiHandler.ts` validates payloads before processing. The Anthropic adapter uses raw `fetch()` SSE parsing instead of the SDK, removing a Node.js SDK dependency from the main process — a cleaner posture for a sandboxed Electron app.

### CSS Token System
`apps/web/src/styles/theme.css` centralizes all theming into cascading CSS custom properties under `data-theme`, `data-font-size`, `data-editor-font`, `data-editor-width`, `data-editor-line-height`, and `data-editor-surface` attributes. Light/dark, editor typography, surface presets, and accessibility font sizes are all expressed as clean token overrides from a single file.

### TypeScript Consistency
Strict TypeScript across packages, Zod for runtime validation in the rules-engine, and consistent type exports establish a solid type-safety baseline.

### WorldEngine Abstraction
The `WorldEngine` interface cleanly separates deterministic review from future AI-augmented review. `WorkspaceRoute` delegates all review through `useWorkspaceConsistency`, which depends on the interface — not a concrete implementation. This keeps the review pipeline extensible without touching the UI.

### Freeform Lore Intake Direction
The lore architecture is now moving in the right direction: author-facing worldbuilding input is freeform and document-based, while structured canon is extracted and accepted behind the scenes. That matches how actual authors work better than rigid sheet-first modeling, and it gives the consistency layer a cleaner truth boundary.

---

## Issues & Action Plan

Issues are ordered by impact on future development velocity.

---

### Priority 1 — `App.tsx` Does Too Much

**Status: Done.**

App.tsx is now 160 lines — declarative `<Routes>` with React Router's `<Route>`/`<Outlet>` pattern. `AppShellLayout` receives props from a shared state hook. `useAppShellState` owns localStorage sync, active project, and rail-collapse state. `CommandPaletteProvider` context is extracted from the app shell. Route debug globals extracted to `utils/routeDebug.ts`.

---

### Priority 2 — State Management Fragmentation

**Status: Pending.**

**Problem:** `localStorage`, `IndexedDB`, and React state are all used for overlapping concerns. `activeProject` and `projectSettings` are prop-drilled through multiple component layers on top of that. This creates desync risk and makes it hard to reason about what the current application state is.

**Action:**
- Zustand is already introduced. Consolidate: `localStorage` and `IndexedDB` become persistence adapters that hydrate/flush the store — not direct state sources.
- Replace prop drilling of `activeProject`/`projectSettings` with a store slice accessible via hook.
- Migrate only the slices that are actively causing reload or route desync risk. State ownership should be clear for touched flows; the changes should measurably reduce restore/desync issues, not just move code around.

*See also: `next-steps.md` §5 (Release Confidence and Reload Safety) for implementation slices.*

### Priority 2A — Canon/Lore Workflow Consolidation

**Status: In progress.**

**Problem:** The lore intake, extraction, canon-decision queue, and workspace review surfaces are now real product flows, but they still span route-local state and several storage services. The architecture is correct, but the workflow could still feel brittle until the new surfaces are smoke-tested and lightly consolidated.

**Action:**
- Keep the current deterministic/storage boundaries.
- Prefer narrow state cleanup only where the canon-decision and lore routes are becoming awkward.
- Do not broaden this into a premature global store rewrite; keep product seams stable first.

---

### Priority 3 — Flat `services/` Directory

**Status: Done.**

Service modules are now grouped into domain subdirectories with barrel exports: `services/ai/`, `services/consistency/`, `services/compendium/`, `services/rules/`, `services/storage/`, `services/system/`, `services/characters/`. All import sites updated.

---

### Priority 4 — Suppressed ESLint Hook Rules

**Status: Partially done.**

**Problem:** Several React hooks ESLint rules are disabled in config (`set-state-in-effect`, `purity`, `preserve-manual-memoization`). Suppressing at config level means real violations pass silently.

**Done:** Major hook-rule violations in `WorkspaceRoute.tsx` were removed during route decomposition. `pnpm --filter web lint` is now clean.

**Remaining action:**
- Re-enable the rules one at a time and fix underlying violations rather than suppressing them.
- Where genuine false positives exist, use inline `// eslint-disable-next-line` with a `// why:` comment rather than blanket config disables.
- Do not disable `@typescript-eslint/no-explicit-any` globally — scope it to the specific files that genuinely need it (e.g. dynamic plugin loading or provider normalization shims). Global disables erode type safety silently over time.

---

### Priority 5 — Electron Packaging

**Status: Done.**

`electron-builder` config is in place with macOS (`dmg` + `zip`), Windows (`nsis`), and Linux (`AppImage`) targets. Auto-update strategy (Squirrel / electron-updater) is still unresolved — this is a design decision, not a config task. Decide before the first externally-shared build; it affects main-process structure and code-signing setup.

---

### Priority 6 — Asymmetric Test Posture

**Status: Pending.**

**Problem:** The `rules-engine` package is well-tested. The Electron IPC bridge — the most failure-prone seam — has no automated coverage. Cypress tests hit `localhost:5173` (the Vite dev server), validating the renderer only. Unit tests are not wired into the CI workflow, only Cypress e2e which runs as `continue-on-error` (non-blocking). This means tests can silently fail and CI gives false confidence.

**Action:**
- Add `vitest run` as a required CI step (currently absent from `.github/workflows/web-ci.yml`).
- Add one Playwright-driven Electron E2E: opens the app, triggers an LLM stream, asserts chunks arrive in the renderer. This is the highest-payoff test for the lowest investment — it covers the one path authors would immediately notice breaking.
- Establish a coverage baseline metric so degradation is visible over time. Not an argument for broad E2E investment — targeted coverage of the highest-risk seams.

*See also: `next-steps.md` §7B (Desktop-specific reliability gaps) for packaged-app validation.*

---

### Priority 7 — CSS Theming Scalability

**Status: Done.**

`theme.css` consolidates all design tokens into a single source of truth across `data-theme`, `data-font-size`, `data-editor-font`, `data-editor-width`, `data-editor-line-height`, and `data-editor-surface`. Global focus ring and body color styles consolidated here.

---

### Priority 8 — `WorkspaceRoute.tsx` Still Large

**Status: In progress.**

Reduced from 4037 to 2524 lines via hook extraction. Still too large. Current hook boundary:

- `useWorkspaceDrawers` — panel open/close state
- `useWorkspaceMemories` — Shodh memory panel
- `useWorkspaceStatBlocks` — stat block token insertion
- `useWorkspaceConsistency` — consistency engine integration, alias state
- `useWorkspaceDocuments` — active document, save/load, import pipeline

Still inline (next extraction candidates):
- Export flow (Markdown / DOCX / EPUB) → `useWorkspaceExport`
- Canon sync and series bible operations → `useWorkspaceCanon`
- Lore inspector panel integration

Target: under 800 lines for the route shell (pure composition + layout). Do not split into sub-routes — the workspace layout is genuinely single-screen; decompose hooks, not routes.

*See also: `next-steps.md` §6 (Structural Cleanup).*

---

### Priority 9 — `WorldBibleRoute.tsx` Growing

**Status: Pending.**

At 2368 lines after alias management and JSON import conflict resolution were added inline.

**Action:**
- Extract alias sync logic into a utility or service function — it's pure data transformation, not UI.
- `useWorldBibleImport` hook for JSON import session state, conflict resolution, and field-map logic.
- Keep alias display/editing in the route; move resolution logic out.

*See also: `next-steps.md` §6C.*

---

### Priority 10 — Storage Versioning and Migration

**Status: Pending.**

**Problem:** Storage interfaces have optional fields but no version field or migration logic. As the schema evolves, users upgrading from an older version can silently lose data or encounter undefined behavior. The mutation event model (`mutation_events` with before/after hashes) handles state audit correctly, but the broader storage layer has no version contract.

**Action:**
- Add a `schemaVersion` field to project storage snapshots.
- Write a migration runner that executes on project load: checks the stored version against the current expected version and runs any required migrations in sequence.
- Test migrations in CI with a fixture representing the previous version's shape.
- For the `entity_aliases`, `world_state`, and `entities` tables specifically, document the current schema version and add a migration path before any field additions or renames.

---

### Priority 11 — API Key Storage Security

**Status: Pending.**

**Problem:** Provider credentials are read from localStorage via `readStoredKey('anthropic_api_key')` and similar patterns in `LLMService`. In an Electron context this is a medium security risk — localStorage values are readable in developer tools, included in profile backups, and visible to any renderer-process code.

**Action:**
- Route API key storage through Electron's `safeStorage` API (keychain-backed encryption), which is already partially wired via `window.electronAPI`.
- The pattern should be: keys are written once via a settings flow that calls `safeStorage.encryptString`, stored as encrypted blobs, and decrypted only in the main process before use.
- Remove the direct `localStorage` read path for provider API keys. The localStorage path can remain as a migration fallback that reads, re-encrypts, and clears the plaintext value on first upgrade.

---

### Priority 12 — Component Prop Surface (EditorWithAI)

**Status: Pending.**

**Problem:** `EditorWithAI.tsx` has 15+ props (mix of data, callbacks, and configuration). This makes the component hard to test, hard to evolve, and creates merge-conflict pressure on a file that touches every editor-adjacent feature.

**Action:**
- Consider splitting into a context/provider that owns the AI and lore wiring, with the core TipTap editor as a simpler inner component.
- The callbacks (`onOpenAIContext`, `onOpenLoreInspector`, `onOpenWorldCapture`) are good candidates for a context that child components can consume without prop threading.
- Do not split this speculatively — do it when the next editor-adjacent feature addition makes the prop surface painful.

---

### Priority 13 — Package Namespace Mismatch

**Status: Pending.**

Internal packages are namespaced `@litrpg-tool/rules-engine` and `@litrpg-tool/rules-ui`, but the product has repositioned as a writing-first narrative workspace. The namespace is a branding mismatch and will become a pain point as external consumers, docs, and shipping artifacts reference the old names.

**Action:** Rename the internal packages. Cheapest to do now while the monorepo is small.

---

### Priority 14 — Root `package.json` Dependency Drift

**Status: Pending.**

The root `package.json` declares `@tiptap/core`, `@tiptap/extension-text-style`, `@tiptap/react`, and `@tiptap/starter-kit` as direct dependencies. These are already correctly declared in `apps/web/package.json`. Root-level app dependencies in a pnpm workspace are historical drift.

**Action:** Remove TipTap dependencies from the root. The root should only carry truly cross-workspace tooling (formatters, shared linters, etc.).

---

## Subsystem Architecture

These sections capture the key design decisions for the app's core subsystems. The full design history for the consistency/review system was previously spread across `guardrails.md`, `shadow-state-listener-architecture.md`, `dual-llm-review-architecture.md`, and `review-ai-seam-plan.md`. Those documents are archived; the decisions that govern ongoing development are here.

---

### Consistency & Review System

**Core principle:** LLMs propose, deterministic TypeScript validates, authors approve. The lore database and character state must never receive direct writes from LLM output.

**Pipeline:** `propose → validate → apply → commit`

No narrative commit path bypasses this sequence. The `GuardrailEngine` validates proposals against canonical entity/state store before any mutation is applied.

**Issue types:** `UNKNOWN_ENTITY`, `AMBIGUOUS_REFERENCE`, `STATE_CONFLICT`, `INVALID_MUTATION`. Unknown entities always block. State conflicts block by default; authors can override with a required reason (all overrides are auditable).

**Shadow State pattern:** Draft text and imported scenes produce staged observations. Staged observations are reviewed, merged, or ignored by the author. The system distinguishes between proposals (candidates, not canon) and accepted mutations (typed command handlers, audit trail).

**Extraction strategy (hybrid):**
1. Known-entity matcher: exact and alias lookup against existing records.
2. Lightweight NLP/NER pass for plausible people, places, items, and game nouns.
3. Local LLM delta extractor for unresolved or high-value spans.
4. Suppression heuristics after context-aware extraction (not as primary source).

The important ordering: suppression heuristics run after extraction, not as the primary classifier. Sentence-start words, common verbs, and single-word unknowns without strong evidence (repeated mention, known cue phrase, NER confidence, or alias match) should not surface as review items.

**Current implementation status:**
- Deterministic `WorldEngine` boundary is in place (`worldEngine/types.ts`, `DeterministicWorldEngine.ts`, `getWorldEngine.ts`).
- Proposal/review schemas exist with confidence and evidence fields.
- Review issue annotations carry `source: deterministic` provenance.
- Feature-flagged Ollama-backed annotation path is implemented and uses issue-local excerpt windows.
- Mutation ledger supports accepted manual scene-derived events, explicit same-scene ordering, replay, stale detection, and workspace-facing inspection.
- Freeform lore documents are now first-class intake records.
- Deterministic lore extraction now creates typed entity/fact proposals.
- Accepted extracted facts now persist as canonical facts and participate in contradiction review as real canon evidence.
- Canon-decision clustering, resolution actions, and suppression memory now sit between extraction output and source-of-truth canon.

**Remaining work:** See `next-steps.md` §1 (Review Completion Workflow) and §1G (Manual-first state mutation workflow).

---

### Lore Intake, Canon Facts, and Canon Decisions

**Core principle:** Freeform lore is source material; extracted proposals are candidates; accepted anchors and accepted canonical facts are truth.

**Storage shape:**
- `LoreDocument` holds longform imported or manual lore.
- `LoreEntityProposal` and `LoreFactProposal` hold deterministic extraction candidates.
- `CanonicalFact` holds accepted canon assertions tied back to evidence and, when available, source lore document title.
- `CanonDecisionCluster` groups likely duplicate entities or conflicting fact interpretations into reviewable queues.
- `CanonDecisionSuppression` remembers resolved duplicate/conflict pairs so the same cluster does not keep resurfacing.

**Operational flow:** `intake -> extract -> cluster -> review -> accept/reject/defer -> reindex`

**Truth boundary:**
- Raw lore text is valuable RAG context.
- Accepted canonical facts are the blocking canon surface for consistency checks.
- Suppression memory prevents repeated noise, but it is not itself canon.

**Current implementation status:**
- Lore docs are backed by project storage and backup/import.
- Entity and fact extraction are deterministic and review-first.
- Accepted facts can update alias storage and safe character fields.
- Accepted facts now appear in workspace contradiction review and evidence messaging.
- Canon-decision consultation is explicit and per-cluster; it does not write canon.

**Remaining work:**
- Manual smoke coverage for the end-to-end lore intake and canon-decision flow.
- Better cross-document duplicate consolidation.
- Potential future explicit merge workflow after alias/accept-new/keep-separate behavior is validated.

---

### Dual LLM Architecture

**Core principle:** Use a dual-model split — a managed local World Engine for private structured background review, and a bring-your-own-key creative LLM for explicit author-invoked prose work.

**Privacy boundary:** The always-on background listener must default local. The app must not silently send draft text to hosted providers for review. Deterministic review runs without any LLM. Local World Engine review runs when enabled and available. Hosted creative LLM calls require explicit author action.

**Important nuance for canon decisions:** the new canon-decision rubber-duck panel follows the explicit author-invoked LLM path, not the background `WorldEngine` path. It may use either the project provider or forced local Ollama based on settings. This preserves the privacy boundary while still allowing authors to choose hosted consultation intentionally.

**World Engine runtime shape:** Three install states — `notInstalled` (deterministic only), `installedUnavailable` (model exists but failed health check), `available` (local review enabled). Do not bundle a multi-GB model in the Electron installer. Offer download on first enable; store models in application support, not inside the app bundle.

**Model selection:** Do not hard-code a single model. Expose capability tiers (`World Engine Lite`, `World Engine Plus`) rather than model brands. Near-term candidates: Qwen small dense, Phi mini-class, Gemma 4B-class. Evaluate with a real-project harness before choosing a managed default.

**Llama.cpp direction:** Target runtime for local World Engine. Main process owns download, checksum validation, model path discovery, process lifecycle, port selection, health checks, idle shutdown. The renderer calls a `WorldEngine` API and does not need to know the backend.

**Review cadence while typing:** Debounced and chunked — not on every keystroke. Trigger policy: minimum changed-word delta + idle pause. Initial defaults to test: `minChangedWords` 120–200, `idleDelay` 8–15 seconds, `maxPassWords` 300–800 words around the changed region, `minInterval` 30–60 seconds between automatic local LLM passes.

**WorldEngine API contract:**
```ts
interface WorldEngine {
  getStatus(): Promise<WorldEngineStatus>;
  extractObservations(input: ListenerInput): Promise<ObservationProposal[]>;
  classifyReviewItem(input: ReviewClassificationInput): Promise<ReviewClassification>;
}

type WorldEngineStatus =
  | { state: 'notInstalled' }
  | { state: 'installedUnavailable'; reason: string }
  | { state: 'available'; modelLabel: string };
```

**AI review seam:** AI review augments deterministic validation; it does not replace it. Deterministic issues remain the source of truth. AI can provide `issueAnnotations` and optional `observations` via the existing `WorldEngineReviewResult` contract. AI must not directly create new issue codes or mutate canon/state.

---

### State Mutation Ledger

Accepted state changes are recorded as durable typed mutation commands with scene provenance. The ledger supports:
- Manual scene-scoped mutation entry
- Explicit `sceneSequence` ordering within a scene
- Replay to reconstruct character state at an arbitrary scene boundary
- Stale-event detection when source scene text changes
- Export/import inclusion in project backup snapshots

**Key invariant:** LLMs never calculate resulting numeric values. Command handlers enforce preconditions and invariants. The ledger records before/after state hashes for every successful apply.

**Current status:** Manual-first workflow is implemented (entry, edit/reorder/invalidate, replay, stale detection, workspace badges, character hover-card state preview). Next step: connect accepted review proposals to the same typed mutation boundary.

---

### RAG and Transformer Loading

`RAGService` dynamically imports `@xenova/transformers` behind the first embedding operation. First RAG use pays the load cost; subsequent calls reuse the cached pipeline promise. The current Vite build emits a separate `transformers` chunk. Preserve this split while working on bundle size. In dev mode, RAG embedding falls back to a deterministic lightweight stub immediately, avoiding transformer fetch noise during local smoke testing.

---

### Implementation Quick-Reference

**RAG and Shodh memory:**
- RAG databases live in IndexedDB per project: `rag-{projectId}` with a `chunks` store and indexes for document + type.
- Chunking normalizes HTML → text, slices ~1000 chars with ~120 char overlap, respects paragraph/sentence boundaries.
- Embeddings via `@xenova/transformers` (`all-MiniLM-L6-v2`) — local, no network calls.
- Entity metadata: call `ragService.setEntityVocabulary([{ id, terms[] }])` to seed alias lookups. `indexDocument` auto-detects entity IDs in each chunk and stores them for filtering.
- Document types: `scene`, `worldbible`, `rule`. Tags are optional for scoping searches.
- Shodh memory: `captureAutoMemory` trims each document to a 500-character summary, stored in `shodh-memory-{projectId}`.
- Auto-ingestion points: scenes on save/delete (RAG + Shodh), World Bible entities on save/delete (with category tags), rulesets whenever `saveRuleset` runs.

**Ollama provider:**
- Default endpoint: `http://localhost:11434`; override per-project in Settings → AI Settings.
- Desktop app streams via the Electron provider registry (no API key needed). Renderer falls back to direct fetch only when Electron isn't available.
- Requests use `/api/chat` with `{model, stream, messages}` payloads; chunk parsing handles one JSON object per line.
- Ensure the Ollama daemon is running locally before selecting the provider.

---

## Summary Table

| Priority | Issue | Effort | Risk if Deferred | Status |
|----------|-------|--------|-----------------|--------|
| 1 | `App.tsx` routing & concern separation | Medium | High | **Done** |
| 2 | State management fragmentation | Medium-High | High | Pending |
| 3 | Flat `services/` directory | Low | Medium | **Done** |
| 4 | Suppressed ESLint hook rules | Low | Medium | Partial |
| 5 | Electron packaging config | Low | Medium | **Done** |
| 6 | Asymmetric test posture / CI gaps | Medium | Medium | Pending |
| 7 | CSS theming scalability | Low | Low | **Done** |
| 8 | `WorkspaceRoute.tsx` still large | Medium | Medium-High | In progress |
| 9 | `WorldBibleRoute.tsx` growing | Low-Medium | Medium | Pending |
| 10 | Storage versioning and migration | Medium | High (data loss risk) | Pending |
| 11 | API key storage security | Low-Medium | Medium | Pending |
| 12 | `EditorWithAI` prop surface | Low-Medium | Low-Medium | Pending |
| 13 | Package namespace mismatch | Low | Low | Pending |
| 14 | Root `package.json` dependency drift | Low | Low | Pending |

---

## Suggested Sequencing

Items not yet complete, in recommended order:

1. **Zustand store consolidation** — state-truth fragmentation is the largest remaining source of latent bugs and de-risks every remaining route extraction. Start with `activeProject` and `projectSettings`. `localStorage` and `IndexedDB` become persistence adapters that hydrate/flush the store rather than direct state sources.
2. **Storage versioning** — add `schemaVersion` to project snapshots and a migration runner on load before the next storage schema change. Data-loss risk escalates with every deploy to real users.
3. **Unit tests in CI** — add `vitest run` as a required CI step. One targeted Playwright Electron E2E for the LLM streaming path. Establish a coverage baseline.
4. **API key security** — route provider credentials through Electron `safeStorage` before the first externally-shared build; retrofitting after distribution is painful.
5. **WorkspaceRoute hook extraction (continued)** — export flow (`useWorkspaceExport`) and canon sync (`useWorkspaceCanon`); target under 800 lines in the route shell.
6. **WorldBibleRoute import/alias extraction** — clean up alongside any WorldBible feature work.
7. **Auto-update strategy decision** — before first external build share; affects main-process structure and code-signing.
8. **Re-enable suppressed hook lint rules one at a time** — fix underlying violations; prefer targeted inline disables with a `// why:` comment over blanket config suppression. Narrow `no-explicit-any` to specific files.
9. **EditorWithAI prop surface** — address when the next editor-adjacent feature addition makes it painful.
10. **Package namespace rename** — `@litrpg-tool/*` to match writing-first identity. Cheapest while the monorepo is still small.
11. **Root `package.json` TipTap drift** — remove; lowest-effort cleanup.

---

## Appendix: Completed Work Reference

Key completed items for context:

- **App.tsx routing** — React Router `<Route>`/`<Outlet>` replacing manual switch; `AppShellLayout`, `useAppShellState`, `CommandPaletteProvider` extracted.
- **Service layer reorganization** — domain subdirectories with barrel exports; all import sites updated.
- **CSS token consolidation** — `theme.css` as single source of truth for all design tokens.
- **Electron packaging** — `electron-builder` config with macOS/Windows/Linux targets; `extraResources` wiring for web renderer dist.
- **Anthropic SDK removal** — raw `fetch()` SSE reader in main process instead of `@anthropic-ai/sdk`; manual SSE parser is local and inspectable. Note: the parser has no timeout, no backpressure, and no reconnect logic — acceptable for local use.
- **Transformer deferred loading** — `@xenova/transformers` lazy-loaded behind first RAG operation.
- **WorldEngine abstraction** — `DeterministicWorldEngine` as baseline; feature-flagged Ollama-backed annotation path with issue-local excerpt windows and timeout fallback.
- **Mutation ledger** — manual-first character state tracking with replay, stale detection, and backup inclusion.
- **Review seam** — `WorldEngineReviewResult.issueAnnotations` carries provenance without changing UI behavior; stable extension point for future AI review metadata.
