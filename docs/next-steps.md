# Next Steps

Last updated: 2026-05-20

## Current Baseline

Implemented recently:

- Compendium core progression (entries, milestones, recipes, action logs).
- Craftability preview.
- Zone affinity (sector mastery).
- Durability/legacy crafting primitives.
- Settlement aura system generalized beyond trophies.
- Community/logistics party synergy engine.
- Settlement base stats + fortress progression effects.
- Runtime integration into craft checks.
- Runtime-adjusted previews in Character Sheets.
- Writing Workspace import for `.txt`, `.md`, `.html`, `.docx` (with `.doc` fallback messaging).
- Writing Workspace import modes with deferred review and best-effort `.pages` preview extraction.
- Inline consistency highlights and quick action popovers.
- Inline lore highlights and quick lore popovers for known entities/characters.
- Writing-first routing and drawer defaults: active projects now land in Workspace, and advanced drawers stay closed until opened.
- Editable review capture flow: detected names/places can be edited before adding to the world, and manual text selection can create new world records.
- Character-aware alias linking from review: review items can now connect to existing characters as well as World Bible entries.
- Temporary dismiss and project-level `Always ignore` review actions.
- Boundary-aware review highlighting with improved handling for possessives and overlapping lore/review highlights.
- World Bible review queue now supports reason filters, recommended-action filters, review-focused open/edit flow, and unified "Mark reviewed" behavior for completion plus alias follow-up.
- World Bible review actions now cover merge, convert-to-alias, persistent keep-separate / ignore-match decisions, and explicit canonical rename from the review form.
- Workspace review linking now offers existing records for alias connection, with close matches sorted first and fallback access to other records.
- Alias/lore review fixes from smoke testing:
  - prevent self-alias creation
  - dedupe alias display and queue counts
  - normalize possessive aliases consistently in scan and highlight paths
  - preserve alias surfaces for lore highlighting
  - surface one-off proper-name unknowns such as character names
- Editor appearance controls for font presentation, reading width, and editor surface.
- World Bible / Compendium `needs completion` badges for review-created records.
- `Alternative names` as a first-class World Bible field synced into alias matching.
- Conflict-reviewed World Bible JSON import for duplicate-name collisions.
- Backup export / validate / import smoke coverage.
- Manuscript export smoke coverage for Markdown, DOCX, and EPUB.
- AI provider diagnostics in Settings, including Ollama installed-model detection and apply-model actions.
- Dual LLM review architecture documented: local World Engine for passive structured review, BYOK providers for explicit creative work.
- Initial deterministic World Engine boundary: workspace review now calls a `WorldEngine` service, proposal/review schemas exist, and false-positive examples have unit coverage.
- Passive review readiness indicator in the Writing Workspace chrome and Review drawer tab.
- Imported scenes persist before post-import review runs, so review issues no longer own the import success path.
- Import review candidates now carry detection reasons, and one-off unknown multiword candidates are suppressed on import unless they have stronger evidence.
- Review readiness counts now dedupe inline deferred review items against sidebar review results, and sidebar items display their detection reason.
- Deferred imported documents now keep stricter import-source extraction during review rehydration and manual sidebar review.
- Review readiness now dedupes the same issue across inline and sidebar sources without scene-id inflation, and the context sidebar scrolls independently.
- Regex extraction remains deterministic but now uses Unicode-aware name tokens for titled names and action/object candidates.
- Common sentence-start words such as `Look`, `Some`, and `Don't` are suppressed before highlighting.
- Shared lore/review matcher now handles canon normalization, possessives, longer-overlap priority, and in-progress known-name prefix suppression across extraction and editor highlights.
- Cypress now covers known-lore highlight behavior for `Ember Archive` and prevents partial `Ember Archiv` from becoming a review underline.
- Manual Project Review results now underline in the active editor scene, not only in the side rail.
- Review item resolution now clears both editor highlights and project-review rail items while preserving remaining unresolved highlights.
- Active-scene review refreshes when canon, aliases, or characters change, so returning from World Bible no longer requires rerunning Project Review just to restore unresolved underlines.
- Workspace scene selection now survives a `Workspace -> World Bible -> Workspace` round trip instead of jumping back to the first scene.
- Smoke regressions now cover known full names, hyphenated nicknames, and short aliases such as `Mira Voss`, `Lantern-Mira`, `Iron Warrens`, and `Warrens`.
- Project Review copy now uses author-facing labels instead of raw internal issue codes and detection reasons.
- Project scratchpad is back as an autosaved workspace context drawer tab and is included in project backup snapshot/import paths.
- Cypress covers scratchpad autosave/reload restoration and backup export/import round-trip.
- Feature-flagged local review annotations are implemented behind the `Project review engine` selector.
- Local review annotation prompts now use issue-local excerpt windows rather than full-scene text and fallback on timeout instead of stalling the review run.
- Dev-mode RAG embedding loads now use deterministic lightweight fallback immediately, avoiding transformer fetch noise during local smoke testing.
- State mutation ledger now supports accepted manual scene-derived mutation events, explicit same-scene ordering, replay, stale detection, and workspace-facing inspection surfaces.
- Freeform `Lore` route now exists as a first-class intake surface for longform worldbuilding notes and imported dossiers.
- Lore storage is persisted in project data and included in backup export/import.
- Deterministic lore fact extraction now creates reviewable `LoreFactProposal` records from freeform dossiers.
- Accepted lore facts now persist as `CanonicalFact` records and can materialize safe side effects like aliases and simple character-field updates.
- Accepted canonical facts now feed workspace contradiction review and inspector/snippet surfaces as real canon evidence.
- Contradiction messages can now cite accepted lore fact provenance, including source lore document title when available.
- Deterministic lore entity extraction now creates `LoreEntityProposal` candidates for characters and world anchors.
- Accepted lore entity proposals can create or link canon anchors in `Characters` and `World Bible`.
- `Canon Decisions` now exists as a dedicated route for deterministic duplicate/conflict clustering across extracted lore and existing canon.
- Canon decision actions now support aliasing to existing canon, accepting new anchors, accepting fact updates, keeping records separate, rejecting, and deferring.
- Canon-decision suppression memory now persists resolved duplicate/conflict pairs so the same cluster does not keep resurfacing.
- Canon-decision consultation now supports explicit per-cluster LLM rubber-ducking without allowing model output to write canon directly.
- Canon-decision AI provider policy can now either follow the project provider or force local Ollama for this workflow specifically.
- Project-level inline highlight visibility modes now support `Visible`, `Subtle`, and `Hidden while typing`.
- World Bible longform `textarea` fields now use rich-text editing with full-width `Expand to document` mode.
- World Bible import previews now preserve richer Markdown/HTML structure for longform lore fields instead of flattening everything into plain text.
- World Bible import flow now supports document preview plus `Import and open` for single drafts.
- World Bible list and review surfaces now show richer lore summaries with `Read more` expansion and structure-aware excerpts for lists, quotes, and simple tables.
- Zustand app/workspace UI integration checkpoint:
  - `activeProject` and project settings now live in the app store.
  - Workspace drawer preferences, selected scene restoration, modal visibility, export/import UI state, and scene create/delete operation flags now live in `workspaceUiStore`.
  - `WorkspaceRoute` store subscriptions are grouped by concern with shallow selectors.
  - `useWorkspaceDocuments` now uses pure helpers for selection initialization, editor-document assembly, change detection, manual-save/autosave consistency modes, and autosave scheduling.
  - Focused unit coverage exists for workspace store behavior and document selection/save helpers.
  - Manual smoke now passes for workspace scene restoration and in-scene search targeting after the latest route/store changes.

## Recommended Priority Order

1. Lore/canon decision smoke stabilization
2. Canon decision merge review refinement
3. Structural cleanup in active routes
4. Finish dedicated editor-state persistence pass
5. State mutation ledger integration
6. Scratchpad access and lightweight planning surfaces
7. App-wide search
8. Editor readability and theme hardening
9. Release confidence and reload safety
10. Review-completion and World Bible polish
11. Desktop packaging validation
12. AI personas/tools
13. First-run onboarding cleanup

## Planning Notes

- Bias toward slices that complete the writing-first workflow instead of adding new optional systems.
- Keep prioritizing lore-consistency trust failures over new settlement/mechanics work until alias, nickname, and review-refresh behavior feels boringly reliable in normal drafting.
- Prefer feature work that also removes route-level complexity in `WorkspaceRoute.tsx` or `WorldBibleRoute.tsx`.
- Do not move editor `title`, `content`, `saveStatus`, or autosave ownership into zustand casually. Treat that as a dedicated editor-state persistence pass with explicit reload/review-refresh verification.
- Treat build/lint as baseline gates, but use smoke coverage for import, review, reload, and export as the real confidence bar.
- Current automated browser smoke and the latest manual workspace smoke are green on the current tree. In the Codex desktop environment, Cypress may still need to launch outside the GUI sandbox restriction.
- Keep branch scope narrow enough that each slice can be reverted cleanly if the UX direction changes.
- Scratchpad should become a quick-access popover/modal available from any workspace tab or route surface. The current context drawer tab is a first restoration step, not the final interaction model.
- Future optional systems note: character inventory currently tracks item names, quantities, notes, and catalog links, while the rules-engine inventory has a `capacity` field but no per-item weight or surfaced encumbrance calculation. When system-heavy character support comes back into focus, add carry weight/encumbrance as an explicit inventory concern rather than treating quantity as enough.
- The background review path is only worth keeping if it remains bounded: proposal-only, local-first, and subordinate to deterministic validation. Avoid broadening it into an unbounded “project manager AI.”
- Lore/canon reminder: freeform lore documents are author-facing source material, extracted entity/fact proposals are candidates, and only accepted anchors plus accepted canonical facts count as source-of-truth canon.
- Canon-decision AI reminder: the LLM may explain tradeoffs, overlaps, and risks, but it must not silently mutate canon state. Canon-decision consultation is explicit and provider-controlled.

## 0) Lore/Canon Decision Smoke Stabilization

Goal: keep author trust high now that freeform lore intake, canon extraction, suppression memory, and explicit AI consultation are all interacting in live authoring.

Targets:

- Recheck the current smoke-critical paths for:
  - full names plus short forms
  - hyphenated nicknames
  - location aliases
  - route-return scene restoration
- Recheck the new lore/canon paths for:
  - lore import -> extract facts/entities -> accept into canon
  - accepted canon facts showing up in contradiction review
  - `keep separate` and `alias` suppression persisting across reload
  - canon-decision AI following the configured provider policy
- Prefer small correctness fixes over new review features.
- Leave Cypress last in the slice, after manual smoke settles.

Acceptance criteria:

- Adding or linking canon does not leave stale unknown underlines behind in the active scene.
- Full names, short aliases, and hyphenated aliases all resolve as known lore once canon exists.
- Leaving `Workspace` for `World Bible` and returning preserves the current scene.
- Rejected or separated canon-decision clusters do not immediately reappear after refresh/reload.
- Canon-decision AI can be forced local through Ollama even when the main assistant uses a hosted provider.

Status:

- Latest smoke regressions for `Mira Voss`, `Lantern-Mira`, `Iron Warrens`, and `Warrens` are now covered in unit tests.
- Active-scene review refresh and workspace scene-return regressions were fixed on 2026-05-09.
- New lore/canon architecture is implemented enough to warrant a dedicated manual smoke pass before broader extraction sophistication work.

## 0A) Canon Decision Merge Review Refinement

Goal: make the new canon-decision workflow feel like a trustworthy source-of-truth layer instead of a noisy duplicate detector.

Targets:

- Add suppression-memory refinement so obviously resolved pairs stay quiet even as surrounding canon changes.
- Improve duplicate/entity clustering for cross-document overlaps and fuller-name/short-name cases.
- Decide whether `keep separate` needs durable explanatory notes or just suppression keys.
- Make the AI rubber-duck output easier to act on, ideally with stronger evidence display and tighter cluster summaries.
- Consider a future explicit `merge` workflow only after current `alias` / `accept new` / `keep separate` behavior is manually validated.

Acceptance criteria:

- Authors can process a realistic batch of extracted lore without the same duplicate clusters resurfacing repeatedly.
- The queue feels like a source-of-truth review surface, not just a diagnostics list.
- The AI panel helps clarify ambiguity without implying that model output itself is canon.

Status:

- Deterministic clustering, suppression memory, and explicit AI consultation are implemented.
- Remaining follow-up is manual smoke, queue polish, and better consolidation behavior across multiple lore documents.

## 1) Review Completion Workflow + World Bible Intake

Goal: make review-created canon feel intentional and editable instead of half-hidden.

Targets:

- Keep alias and review follow-up centered in World Bible so authors can accept/refine from one place.
- Continue polishing the dedicated review mode in World Bible for:
  - needs completion records
  - alias follow-up
  - ignored/rejected review surfaces if they remain part of the workflow
- Keep authors able to accept, rename, merge, alias, and dismiss false-positive match suggestions from World Bible without returning to the manuscript for every cleanup action.
- Decide whether `Always ignore` should stay local-storage backed or move into persisted project settings/backups.
- Keep improving overlap/count correctness between:
  - review issue state
  - inline underline rendering
  - passive lore highlights
- Keep the passive review-needed indicator reliable without losing drafting flow.
- Continue improving World Bible authoring quality:
  - richer longform editing
  - better import fidelity
  - better summary surfaces across browse/review flows

Exit criteria:

- Authors can finish review-created records and alias cleanup from a coherent World Bible workflow.
- Review counts, chips, and visible underlines agree reliably.
- World Bible feels like a real lore-writing surface rather than a cramped metadata form.

Implementation backlog:

### Slice 1A: Review queue in World Bible

Scope:

- Add a dedicated review-focused surface inside World Bible.
- Surface:
  - `needs completion` records
  - alias follow-up
  - ignored/dismissed items if they remain part of the workflow

Acceptance criteria:

- An author can open one World Bible view and see all unfinished review-created canon work.
- The queue does not require reopening the manuscript just to understand what remains.

Status:

- Implemented queue surface, filters, nav badge count integration, queue-focused opening, and unified reviewed action.
- Smoke testing exposed and fixed alias/highlight normalization issues plus active-scene review refresh regressions.
- Remaining: rerun the full manual review-completion smoke against the newer alias-conversion, keep-separate, ignore-match, canonical-rename, and recommended-action filter paths.
- Remaining: decide whether ignored/rejected surfaces should stay visible in this queue or move to a lighter audit path.

Suggested branch:

- `codex/world-bible-review-queue`

### Slice 1B: World Bible review actions

Scope:

- Allow accept, rename, merge, alias, and completion actions directly from World Bible.
- Keep manuscript review actions for inline triage, but make World Bible the main finish-work surface.

Acceptance criteria:

- A review-created record can be fully resolved from World Bible.
- Merge/rename/alias actions update the underlying canon and remove or update the related unfinished state.

Status:

- Implemented explicit `merge`, `convert to alias`, `keep separate`, `ignore this match`, and `rename to canonical + next` actions inside World Bible review.
- Match-level false positives now persist in project settings so queue suggestions stay cleared across reloads/project switches.
- Review queue cards and match cards now derive and display a recommended next action.
- Remaining: validate the end-to-end UX with a fresh manual smoke pass and decide whether `rename` should graduate from contextual form action into a queue-card shortcut.

Suggested branch:

- `codex/world-bible-review-actions`

### Slice 1C: Persisted ignore/review state

Scope:

- Decide whether `Always ignore` remains local-only or becomes project-backed.
- If project-backed, include it in backup/export/import behavior and reload restoration.

Acceptance criteria:

- Ignore behavior is predictable after reload, project switch, and backup restore.
- The chosen persistence model is documented in the UI copy or project docs.

Suggested branch:

- `codex/review-ignore-persistence`

### Slice 1E: World Bible authoring polish

Scope:

- Keep improving the World Bible as a real writing surface instead of a plain schema form.
- Build on the now-implemented rich-text longform fields, import previews, and card/review summaries.
- Focus next on polish rather than another structural rewrite.

Acceptance criteria:

- Longform lore can be written, imported, previewed, and reviewed without feeling cramped.
- Authors can understand imported or existing lore from list/review surfaces before opening full edit mode.

Status:

- Implemented rich-text editing for longform World Bible fields.
- Implemented full-width `Expand to document` mode.
- Implemented richer import preservation plus document preview and `Import and open`.
- Implemented structure-aware World Bible summaries across list and review surfaces.
- Remaining: decide whether summary surfaces should gain richer rendering for more complex tables/lists or stay excerpt-only.

### Slice 1D: Review count and highlight correctness audit

Scope:

- Reconcile:
  - deferred review state
  - inline unresolved-review highlights
  - passive lore highlights
  - World Bible completion badges

Acceptance criteria:

- Counts shown in UI surfaces match the actual unresolved state.
- Overlapping known-lore and unresolved-review highlights no longer produce misleading duplicate signals.

Suggested branch:

- `codex/review-highlight-correctness`

### Slice 1E: Smoke coverage for import -> review -> World Bible completion

Scope:

- Add targeted smoke coverage for:
  - importing text into the workspace
  - deferred review generation
  - creating or linking canon
  - finishing follow-up from World Bible

Acceptance criteria:

- The core review-completion path is covered by a repeatable smoke flow.
- The smoke flow catches regressions in route extraction or state hydration.

Status:

- A dedicated manual smoke checklist now exists in `docs/review-completion-smoke-test.md`.
- Automated coverage now passes for the smoke-critical editor matching paths, including manual Project Review highlighting, preserving remaining unresolved highlights after creating one reviewed record, scratchpad reload restoration, workspace navigation lock, and the updated post-merge smoke suite.
- Import persistence now happens before review. Remaining follow-up is targeted browser smoke coverage that confirms an imported scene stays saved when post-import review finds unresolved unknowns.
- Candidate reason metadata now records why an item was proposed, such as titled name, repeated unknown, leading cue, action-object cue, or known entity.
- Treat the current manual smoke pass as functionally complete for the present UX; repeat the end-to-end manual pass after the next review/workspace interaction change instead of continuing to polish the current flow.

Suggested branch:

- `codex/review-completion-smoke`

### Slice 1F: Passive review-needed indicator

Scope:

- Add a small review state indicator to the writing workspace chrome or review drawer tab.
- Model review state independently from whether the review drawer is open.
- Support states:
  - `idle`: no pending review signal
  - `running`: review pass is in progress
  - `ready`: non-blocking review items are available
  - `attention`: review should be checked before strict save, canon commit, export validation, or publish
  - `unavailable`: configured review engine is unavailable
- Keep banners and blocking language reserved for deliberate strict actions.
- Use the drawer or tooltip for detail; do not interrupt the editor with modals while typing.
- Tie the indicator to future changed-word plus idle-pause review cadence from `dual-llm-review-architecture.md`.

Acceptance criteria:

- Authors can keep typing when review work is detected.
- The workspace shows review readiness without forcing a context switch.
- Indicator state is derived from actual unresolved review counts and review-engine status.
- Review state survives route changes and reloads according to the chosen persistence model.
- Explicit "Run review" remains available for authors who want immediate feedback.

Suggested branch:

- `codex/passive-review-indicator`

Status:

- Initial deterministic indicator is implemented. It derives `idle`, `running`, `ready`, `attention`, and `unavailable` from current review counts, manual review state, and `WorldEngine` status.
- Idle review cadence now exists for changed scenes after a short typing pause.
- Current behavior note: passive idle review should update underlines and the header badge without showing the large blocking review panel unless the scene hits a strict-save case.

### Slice 1G: Manual-first state mutation workflow

Scope:

- Land the first usable manuscript-time state workflow on top of `state_mutation_events`.
- Support:
  - manual scene-scoped mutation entry from Character Sheets
  - accepted/invalidated mutation lifecycle
  - explicit `sceneSequence` ordering within a scene
  - replayed character state at a selected scene
  - stale-event detection when source scene text changes
  - workspace scene badges and a scene-level state timeline
- Keep deterministic extraction and LLM proposal generation out of this slice.

Acceptance criteria:

- Authors can record accepted scene-scoped state changes as durable ledger events.
- Replay reconstructs character state at an arbitrary scene boundary.
- Same-scene ordering is explicit and author-correctable.
- Stale events are detectable after scene edits without destructive auto-invalidation.
- Snapshot/export/import preserves the mutation ledger.

Status:

- Implemented for manual-first character state tracking.
- Current workflow includes:
  - manual mutation entry in Character Sheets
  - mutation edit/reorder/invalidate flow
  - replayed state at selected scene
  - stale detection and workspace stale badges
  - selected-scene state timeline in Workspace
  - character hover-card state preview in the editor
- Remaining follow-up:
  - manual UX retest in long, state-heavy scenes
  - decide whether manuscript-context editing should expand beyond Character Sheets
  - later connect deterministic review proposals or local-model suggestions to the same typed mutation boundary

Suggested branch:

- `codex/state-mutation-ledger-writes`

## 2) Scratchpad Access and Lightweight Planning Surfaces

Goal: bring back loose planning support without turning the app into an up-front planning tool.

Current status:

- Project scratchpad exists as a per-project autosaved workspace note surface with both quick-access modal entry and context drawer access.
- Scratchpad data is included in project backup snapshots and import paths.
- Cypress covers scratchpad autosave and reload restoration.

Next slices:

### Slice 2A: Scratchpad quick-access popover

Scope:

- Add a top-level Scratchpad affordance that can be opened from any workspace tab or route surface.
- Present Scratchpad as a popover/modal instead of requiring the user to switch the context drawer to the Scratchpad tab.
- Keep autosave behavior and backup inclusion.

Acceptance criteria:

- A user can open and close Scratchpad without losing their place in the current route or drawer tab.
- Scratchpad remains project-scoped and does not participate in canon/review unless explicitly copied into a scene or record.
- Keyboard and narrow viewport behavior are usable.

Status:

- Implemented in the workspace shell with header/footer/empty-state entry points plus a command-palette action.
- Scratchpad now opens as a modal without forcing a drawer-tab switch and can still be opened in the context drawer when desired.
- Follow-up remains deciding how Corkboard should reuse the same lightweight planning affordance pattern.

Suggested branch:

- `codex/scratchpad-popover-access`

### Slice 2B: Scratchpad backup smoke coverage

Scope:

- Extend backup smoke coverage to prove scratchpad content round-trips through backup export/import.

Acceptance criteria:

- A populated scratchpad exports and restores with count/parity confidence.
- Backup validation messaging remains clear.

Status:

- Implemented in the Cypress post-merge smoke suite by seeding scratchpad content before export and verifying it after import.

### Slice 2C: Lightweight corkboard return

Scope:

- Restore corkboard as a simple planning view over chapter cards.
- Keep scope limited to card title, summary, status, ordering, and plot points.

Acceptance criteria:

- Authors can sketch chapter-level structure without leaving the writing-first workflow.
- Corkboard data survives reload and backup restore.

Status:

- Implemented as a lightweight workspace modal with chapter cards, summary, status, ordering, and plot-point editing.
- Corkboard is reachable from the workspace header, footer, empty state, and command palette.
- Chapter-card data is now included in project backup snapshot/import paths.

Suggested branch:

- `codex/corkboard-lite`

### Slice 2D: Dedicated corkboard workspace

Scope:

- Promote Corkboard from a quick-access modal into a first-class planning surface or route.
- Keep the quick-access modal for in-scene reference, but let the same card data open in a larger dedicated view when the author is actively structuring a book.
- Decide whether the dedicated view lives as its own app tab/route or as a stronger workspace mode.

Acceptance criteria:

- Authors can use Corkboard as the primary place to shape chapter flow for a full manuscript.
- Quick-access and dedicated Corkboard views stay in sync against the same underlying chapter-card data.
- The dedicated view has enough space for reordering, scanning, and comparing cards without feeling cramped.

Notes:

- This matches how stronger writing tools treat corkboard/plot-grid features: important enough to deserve a real planning surface, while still staying linked to drafting.
- Keep the current modal as the lightweight companion surface for checking flow without leaving the scene.

Suggested branch:

- `codex/corkboard-dedicated-view`

### Slice 2E: AI to scratchpad capture

Scope:

- Add an explicit action in the right-rail AI assistant to send a generated note, summary, or selected excerpt into the project Scratchpad.
- Support author workflows where "rubber ducking" with the AI produces useful planning fragments that should be retained outside the manuscript.

Acceptance criteria:

- An author can move useful AI discussion output into Scratchpad without manual copy/paste.
- The captured note is easy to find and clearly separated from scene prose and canon records.
- The capture flow works whether the AI generated the text from a scene selection, lore question, or planning discussion.

Notes:

- This should bias toward deliberate author capture, not silent automatic logging of AI output.

Suggested branch:

- `codex/ai-scratchpad-capture`

### Slice 2F: Scratchpad organization

Scope:

- Evolve Scratchpad beyond one flat note into a lightweight organized planning surface.
- Explore sections, pinned notes, dated entries, or simple cards without turning Scratchpad into a heavy database of planning objects.
- Define how organized Scratchpad relates to Corkboard so the two tools complement each other rather than duplicate each other.

Acceptance criteria:

- Authors can keep brainstorming fragments, reminders, and planning notes discoverable over a long project.
- Scratchpad stays lightweight and low-friction.
- The relationship between Scratchpad and Corkboard is legible:
  - Scratchpad for loose thought capture and ad hoc notes
  - Corkboard for shaped chapter/beat flow

Suggested branch:

- `codex/scratchpad-organization`

## 3) App-Wide Search

Goal: let authors retrieve scenes and canon from one obvious entry point.

Current status:

- Search is now exposed from the app shell instead of living only behind the command palette shortcut.
- Scene and World Bible results are returned in one command-palette search list with direct-open behavior.
- World Bible search focus now opens the matching category tab instead of leaving the user in `Review Queue`.
- Scene search now indexes full plain-text scene content instead of only a short excerpt.
- Workspace search-open flow now attempts to reopen the matching scene and select/scroll to the first matching in-scene occurrence.

Next slices:

- Add a global search entry point in the app shell.
- Return scene and World Bible matches in one result list.
- Support direct-open behavior into the target route and record.
- Decide whether alias matches should be shown explicitly in results.

Exit criteria:

- A user can locate a scene or World Bible entry from anywhere in the app.
- Search results open the correct destination without manual hunting.

Implementation backlog:

### Slice 3A: Search entry point in app shell

Scope:

- Add a global search affordance in the shell and command palette.
- Keep it lightweight and fast enough for frequent use.

Acceptance criteria:

- Search is discoverable from any major route.
- Keyboard-first open behavior exists.

Status:

- Implemented via a visible `Search` launcher in the app shell rail and mobile navigation, reusing the command palette search surface.

Suggested branch:

- `codex/app-shell-search-entry`

### Slice 3B: Unified results model

Scope:

- Return scene and World Bible results in one list.
- Decide whether characters are included in v1 or deferred to a follow-up slice.

Acceptance criteria:

- A user can search once and see manuscript plus canon results in one place.
- Result labeling makes the destination type obvious.

Status:

- Implemented for scenes plus World Bible records.
- Remaining follow-up is manual retest of scene-result behavior in the workspace and deciding whether Compendium should join the unified result set.

Suggested branch:

- `codex/unified-search-results`

### Slice 3C: Alias-aware matching and direct-open routing

Scope:

- Define whether alias hits appear as separate results or as metadata on canonical results.
- Support direct-open behavior into the right route, record, or scene.

Acceptance criteria:

- Selecting a result lands the user on the correct destination without manual re-navigation.
- Alias behavior is explicit and not surprising.

Status:

- Alias metadata now appears on World Bible search results.
- Remaining follow-up is to decide whether alias hits should appear as separate rows and whether search should expand beyond World Bible into Compendium/canon-wide results.

Suggested branch:

- `codex/search-alias-routing`

## 4) Editor Readability and Theme Hardening

Goal: make the workspace comfortable for long writing sessions.

Next slices:

- Fix dark mode readability regressions across editor, drawers, popovers, and badges.
- Add richer editor typography controls:
  - dyslexia-friendly font options
  - line-height control
  - custom text/background palettes
- Audit warning/lore/system highlight colors against all editor surfaces.

Exit criteria:

- Writers can reach a comfortable editor setup in both light and dark themes.
- Highlight and notification colors remain legible across presets.

Implementation backlog:

### Slice 4A: Dark mode readability audit

Scope:

- Audit editor, drawers, popovers, chips, and badges in dark mode.
- Fix low-contrast combinations before adding new controls.

Acceptance criteria:

- No primary writing surface has obvious contrast failures in dark mode.
- Lore/review/system indicators remain legible on all current editor surfaces.

Suggested branch:

- `codex/dark-mode-readability`

### Slice 4B: Typography and spacing controls

Scope:

- Add line-height control and richer font presentation options.
- Keep settings writer-facing rather than developer-facing.

Acceptance criteria:

- Writers can choose a comfortable font and line-height combination without layout breakage.
- Preferences persist reliably across reload.

Suggested branch:

- `codex/editor-typography-controls`

### Slice 4C: Highlight palette hardening

Scope:

- Audit warning, lore, system, and completion colors across light/dark and editor surface presets.

Acceptance criteria:

- Highlight semantics remain visually distinct.
- No alert state depends on color combinations that disappear on one surface preset.

Suggested branch:

- `codex/highlight-palette-hardening`

## 5) Release Confidence and Reload Safety

Goal: close the gap between “build passes” and “author workflow is reliable.”

Targets:

- Run targeted smoke coverage for project switching, reload, autosave, import, review, and export.
- Verify newer review/alias-related state survives reload and backup restore.
- Decide whether any remaining fragmented state must move into the app store before release.

Exit criteria:

- Reloading the app does not create obvious route/store desync in primary author flows.
- Backup/import/review behavior is trustworthy enough for real projects.

Implementation backlog:

### Slice 5A: Reload and project-switch smoke pass

Scope:

- Exercise active project restoration, workspace reload, and project switching.

Acceptance criteria:

- The active project, workspace document state, and relevant UI preferences restore predictably.

Suggested branch:

- `codex/reload-project-switch-smoke`

### Slice 5B: Backup parity audit for review and alias state

Scope:

- Confirm newer review/alias/scratchpad state is included in backup export/import flows.

Acceptance criteria:

- Exported backups restore review-related follow-up and scratchpad state without silent loss.

Suggested branch:

- `codex/backup-review-alias-parity`

### Slice 5C: Store-boundary cleanup where reliability requires it

Scope:

- Migrate only the state slices that are actively causing reload or route desync risk.

Acceptance criteria:

- State ownership is clear for the touched flows.
- The changes measurably reduce restore/desync issues rather than just moving code around.

Suggested branch:

- `codex/store-reliability-slices`

## 6) Structural Cleanup in Active Routes

Goal: reduce feature friction in the routes that are still carrying too much inline orchestration.

Targets:

- Continue reducing `WorkspaceRoute.tsx`.
- Start extracting non-UI logic from `WorldBibleRoute.tsx` as feature work touches it.

Exit criteria:

- Route files move closer to composition shells instead of feature containers.
- Feature changes in workspace and World Bible require less cross-cutting edits.

Implementation backlog:

### Slice 6A: Workspace export hook extraction

Scope:

- Move Markdown/DOCX/EPUB export orchestration into a dedicated workspace hook.

Acceptance criteria:

- Export logic is testable and no longer primarily owned inline by `WorkspaceRoute.tsx`.

Suggested branch:

- `codex/workspace-export-hook`

### Slice 6B: Workspace canon sync extraction

Scope:

- Move parent/child canon sync and promotion operations into a dedicated hook or service boundary.

Acceptance criteria:

- Canon sync actions are isolated from route layout concerns.

Suggested branch:

- `codex/workspace-canon-hook`

### Slice 6C: World Bible import and alias logic extraction

Scope:

- Move JSON import session state and alias sync logic out of `WorldBibleRoute.tsx`.

Acceptance criteria:

- Route-owned code is primarily UI state and composition, not import-resolution logic.

Suggested branch:

- `codex/world-bible-import-alias-extraction`

## 7) Desktop Packaging Validation

Goal: close the gap between “web app in development” and “desktop authoring product.”

Targets:

- Produce an installable desktop build with local storage behavior verified.
- Confirm backup/export/import and AI proxy expectations in the packaged app.
- Decide on the first externally-supported platform baseline and update path expectations.

Exit criteria:

- A distributable desktop build exists and supports the core author workflow.

Implementation backlog:

### Slice 7A: Packaged-app validation pass

Scope:

- Run the existing core author flows in an installable build, not just the web dev flow.

Acceptance criteria:

- Writing, save/reload, export, backup, and AI provider expectations are verified in a packaged build.

Suggested branch:

- `codex/desktop-packaged-smoke`

### Slice 7B: Desktop-specific reliability gaps

Scope:

- Fix any IPC, packaging, storage-path, or bundled-resource issues discovered in packaged validation.

Acceptance criteria:

- No known packaged-only blocker remains for the core author workflow.

Suggested branch:

- `codex/desktop-packaging-fixes`

## 8) AI Personas / Tools

Goal: move beyond generic assistant behavior toward explicit author-facing roles.

Targets:

- Add project-level persona/tool definitions.
- Ship first writing critic persona with critique modes such as:
  - line edit
  - story clarity
  - scene tension
- Frame post-draft prose cleanup as craft critique rather than "AI phrase cleanup," with bounded review modes such as:
  - repetition detection
  - cliche detection
  - pacing friction
  - flattening removal
- Keep outputs scoped and manual-apply.

Exit criteria:

- Critic persona can review selected text with predictable structured output.

Implementation backlog:

### Slice 8A: Persona model and project binding

Scope:

- Define how personas/tools are stored at the project level and surfaced in the editor assistant.

Acceptance criteria:

- A project can opt into a named persona/tool set without breaking existing assistant behavior.

Suggested branch:

- `codex/ai-persona-model`

### Slice 8B: Writing critic v1

Scope:

- Ship one critic persona with bounded critique modes such as:
  - line edit
  - story clarity
  - scene tension
  - repetition detection
  - cliche detection
  - pacing friction
  - flattening removal
- Keep the framing craft-first and author-facing:
  - surface patterns, weak spots, and targeted revision suggestions
  - avoid presenting this as generic "AI slop" detection
  - prefer findings-first output over automatic rewrites

Acceptance criteria:

- Selected-text critique produces structured, scoped output that is manual-apply.

Suggested branch:

- `codex/ai-writing-critic`

## 9) First-Run Onboarding Cleanup

Goal: keep the first-use experience aligned with the writing-first product promise.

Targets:

- Remove or soften any setup friction before drafting.
- Clarify how optional systems are discovered without making them feel required.

Exit criteria:

- A new user can create/open a project and start drafting without feeling pushed into schema or systems setup.

Implementation backlog:

### Slice 9A: First-run friction audit

Scope:

- Review empty states, first-run labels, and entry points for projects and workspace.
- Normalize no-project empty states across main tabs. Use the World Bible empty
  state as the visual baseline: centered, muted, and calm. If "Projects" appears
  in link styling, make it navigate to Projects; otherwise render it as plain
  muted text.

Acceptance criteria:

- No first-run path implies that rules, canon schemas, or AI setup are mandatory before writing.
- No-project empty states use consistent placement, type color, and action
  behavior across Workspace, World Bible, Ruleset, and other main tabs.

Suggested branch:

- `codex/first-run-friction-audit`

### Slice 9B: Optional-system discovery

Scope:

- Improve discoverability for World Bible, review, and advanced systems without foregrounding them on initial load.

Acceptance criteria:

- Optional systems are easy to find when needed, but the default experience still reads as a writing app.

Suggested branch:

- `codex/optional-system-discovery`

## 10) Stat Block Token Improvements

Goal: make stat block placeholders feel like first-class editor objects instead of raw token strings.

Current status:
- Status Block Builder modal exists with live-block and placeholder insert modes.
- Placeholder format: `{{STAT_BLOCK:character:Aria:compact}}`.
- `Refresh Placeholders` replaces tokens with rendered HTML (destructive).
- Project-level preferences for source type, style, and insert mode.
- Cypress covers rendered insert and placeholder refresh flow.

Next slices:

### Slice 10A: Chip rendering for stat block tokens

Scope:
- Add a TipTap inline stat-block node that parses existing `{{STAT_BLOCK:...}}` syntax on load/paste.
- Render as a pill/chip label (e.g. `Stat Block: Aria · Compact`).
- Preserve raw token payload in node attributes so save/load is lossless.
- Teach refresh utilities to recognize both legacy raw token text and chip/node HTML.

Acceptance criteria:
- Writers are not exposed to raw `{{...}}` syntax during normal editing.
- Existing documents load without data loss.

Suggested branch: `codex/stat-block-chip-rendering`

### Slice 10B: Template-preserving refresh model

Scope:
- Replace the current one-way destructive refresh with a preview model.
- Chips remain canonical; refresh updates chip preview/metadata only.
- Export/render paths resolve chips to live rendered blocks.
- Add project-level refresh policy preference: `manual`, `onOpen`, `onSave`, `onOpenAndSave`.

Acceptance criteria:
- Refreshing a placeholder does not permanently burn it into static prose.
- Refresh policy is respected on document open and manual save.

Suggested branch: `codex/stat-block-template-refresh`

### Slice 10C: Token disambiguation

Scope:
- Newly inserted tokens persist a stable source id alongside the human-readable label.
- Resolution order: stable id match → unique normalized label match → ambiguous state shown on chip.
- Legacy name-only tokens preserve current behavior; duplicates surface an ambiguous-state chip.

Suggested branch: `codex/stat-block-token-disambiguation`

---

## 11) Author Tool Customization

Goal: let authors tailor the workspace tools around them without displacing the manuscript.

Current status:
- Toolbar generates buttons dynamically via `toolbarButtons`; not yet user-configurable.
- Rail tool visibility is not yet persisted per-project.
- Writing Workspace Preferences panel does not yet exist in Settings.

Implementation order:

### Slice 11A: Persist toolbar and rail preferences

Scope:
- Persist toolbar density and visible control groups in project settings.
- Persist rail visibility, default open tab, and tab order.

Acceptance criteria:
- Preferences survive reload and project switch.
- Defaults remain simple for new projects.

Suggested branch: `codex/workspace-tool-preferences`

### Slice 11B: Writing Workspace Preferences panel

Scope:
- Add a lightweight "Writing Workspace Preferences" section in Settings.
- Expose: toolbar density, visible toolbar groups, rail defaults, chrome visibility toggles.
- One "Restore defaults" action clears all customization.

Acceptance criteria:
- Authors can reduce visible chrome without disabling important features.
- Customization does not crowd the settings panel.

Suggested branch: `codex/workspace-preferences-panel`

---

## 12) Entity Ownership and Intake Refactor

Goal: make entity intake ownership coherent so accepting a detected reference creates one primary record, not three.

See `entity-ownership-intake-refactor-plan.md` for detailed slices, file-level implementation notes, and dogfood findings from May 2026.

Summary of slices:
- **Slice 1**: Stop duplicate intake — remove automatic compendium creation from workspace review acceptance.
- **Slice 2**: Add explicit intake classification (`character` / `location` / `item` / `creature`).
- **Slice 3**: Character-first intake completion — `Character` + optional `CharacterSheet` in one flow.
- **Slice 4**: Reframe compendium as optional mechanics attachment; rename `Add to Compendium` → `Add mechanics`.
- **Slice 5**: Character sheet discoverability and stat editing.
- **World Bible follow-up**: canonical rename with alias preservation, lighter location review treatment, lore-handling rethink.

Recommended execution order: Slice 1 → 3 → 4 → 5 → 2 → World Bible follow-up.

Suggested branch: `codex/entity-intake-ownership`

---

## Working Sequence

Recommended order for the next active branches:

1. `codex/world-bible-review-queue`
2. `codex/world-bible-review-actions`
3. `codex/review-ignore-persistence`
4. `codex/review-highlight-correctness`
5. `codex/review-completion-smoke`
6. `codex/scratchpad-popover-access`
7. `codex/scratchpad-backup-smoke`
8. `codex/corkboard-lite`
9. `codex/app-shell-search-entry`
10. `codex/unified-search-results`
11. `codex/search-alias-routing`

## Branch and Commit Workflow (Keep)

- Create a feature branch for each slice using `codex/<topic>`.
- Keep commits small and scoped.
- Validate each slice with lint/build before commit.
- Avoid batching unrelated changes in one commit.

Suggested branch names:

- `codex/editor-theme-hardening`
- `codex/review-completion-badges`
- `codex/scratchpad-popover-access`
- `codex/corkboard-lite`
- `codex/ai-writing-critic`
