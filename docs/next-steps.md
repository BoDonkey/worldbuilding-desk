# Next Steps

Last updated: 2026-04-15

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
- World Bible review queue branch is in progress with queue filtering, review-focused open/edit flow, and unified "Mark reviewed" behavior for completion plus alias follow-up.
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

## Recommended Priority Order

1. Review completion workflow + World Bible intake
2. App-wide search
3. Editor readability and theme hardening
4. Release confidence and reload safety
5. Structural cleanup in active routes
6. Desktop packaging validation
7. AI personas/tools
8. First-run onboarding cleanup

## Planning Notes

- Bias toward slices that complete the writing-first workflow instead of adding new optional systems.
- Prefer feature work that also removes route-level complexity in `WorkspaceRoute.tsx` or `WorldBibleRoute.tsx`.
- Treat build/lint as baseline gates, but use smoke coverage for import, review, reload, and export as the real confidence bar.
- Keep branch scope narrow enough that each slice can be reverted cleanly if the UX direction changes.

## 1) Review Completion Workflow + World Bible Intake

Goal: make review-created canon feel intentional and editable instead of half-hidden.

Targets:

- Move more alias and review follow-up into World Bible so authors can accept/refine from one place.
- Add a dedicated review queue or review mode in World Bible for:
  - needs completion records
  - alias follow-up
  - ignored/rejected review surfaces
- Let authors accept, rename, merge, and alias from World Bible without returning to the manuscript for every cleanup action.
- Decide whether `Always ignore` should stay local-storage backed or move into persisted project settings/backups.
- Keep improving overlap/count correctness between:
  - review issue state
  - inline underline rendering
  - passive lore highlights

Exit criteria:

- Authors can finish review-created records and alias cleanup from a coherent World Bible workflow.
- Review counts, chips, and visible underlines agree reliably.

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

- In progress on `codex/world-bible-review-queue`.
- Implemented queue surface, filters, nav badge count integration, queue-focused opening, and unified reviewed action.
- Smoke testing exposed and fixed alias/highlight normalization issues.
- Remaining: finish reload/ignore-state portions of the manual smoke checklist and decide whether persisted ignore state stays in this slice or is split into Slice 1C.

Suggested branch:

- `codex/world-bible-review-queue`

### Slice 1B: World Bible review actions

Scope:

- Allow accept, rename, merge, alias, and completion actions directly from World Bible.
- Keep manuscript review actions for inline triage, but make World Bible the main finish-work surface.

Acceptance criteria:

- A review-created record can be fully resolved from World Bible.
- Merge/rename/alias actions update the underlying canon and remove or update the related unfinished state.

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
- Automated coverage is still optional follow-up if this flow proves stable enough to encode in Cypress without brittle editor interactions.

Suggested branch:

- `codex/review-completion-smoke`

## 2) App-Wide Search

Goal: let authors retrieve scenes and canon from one obvious entry point.

Next slices:

- Add a global search entry point in the app shell.
- Return scene and World Bible matches in one result list.
- Support direct-open behavior into the target route and record.
- Decide whether alias matches should be shown explicitly in results.

Exit criteria:

- A user can locate a scene or World Bible entry from anywhere in the app.
- Search results open the correct destination without manual hunting.

Implementation backlog:

### Slice 2A: Search entry point in app shell

Scope:

- Add a global search affordance in the shell and command palette.
- Keep it lightweight and fast enough for frequent use.

Acceptance criteria:

- Search is discoverable from any major route.
- Keyboard-first open behavior exists.

Suggested branch:

- `codex/app-shell-search-entry`

### Slice 2B: Unified results model

Scope:

- Return scene and World Bible results in one list.
- Decide whether characters are included in v1 or deferred to a follow-up slice.

Acceptance criteria:

- A user can search once and see manuscript plus canon results in one place.
- Result labeling makes the destination type obvious.

Suggested branch:

- `codex/unified-search-results`

### Slice 2C: Alias-aware matching and direct-open routing

Scope:

- Define whether alias hits appear as separate results or as metadata on canonical results.
- Support direct-open behavior into the right route, record, or scene.

Acceptance criteria:

- Selecting a result lands the user on the correct destination without manual re-navigation.
- Alias behavior is explicit and not surprising.

Suggested branch:

- `codex/search-alias-routing`

## 3) Editor Readability and Theme Hardening

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

### Slice 3A: Dark mode readability audit

Scope:

- Audit editor, drawers, popovers, chips, and badges in dark mode.
- Fix low-contrast combinations before adding new controls.

Acceptance criteria:

- No primary writing surface has obvious contrast failures in dark mode.
- Lore/review/system indicators remain legible on all current editor surfaces.

Suggested branch:

- `codex/dark-mode-readability`

### Slice 3B: Typography and spacing controls

Scope:

- Add line-height control and richer font presentation options.
- Keep settings writer-facing rather than developer-facing.

Acceptance criteria:

- Writers can choose a comfortable font and line-height combination without layout breakage.
- Preferences persist reliably across reload.

Suggested branch:

- `codex/editor-typography-controls`

### Slice 3C: Highlight palette hardening

Scope:

- Audit warning, lore, system, and completion colors across light/dark and editor surface presets.

Acceptance criteria:

- Highlight semantics remain visually distinct.
- No alert state depends on color combinations that disappear on one surface preset.

Suggested branch:

- `codex/highlight-palette-hardening`

## 4) Release Confidence and Reload Safety

Goal: close the gap between “build passes” and “author workflow is reliable.”

Targets:

- Run targeted smoke coverage for project switching, reload, autosave, import, review, and export.
- Verify newer review/alias-related state survives reload and backup restore.
- Decide whether any remaining fragmented state must move into the app store before release.

Exit criteria:

- Reloading the app does not create obvious route/store desync in primary author flows.
- Backup/import/review behavior is trustworthy enough for real projects.

Implementation backlog:

### Slice 4A: Reload and project-switch smoke pass

Scope:

- Exercise active project restoration, workspace reload, and project switching.

Acceptance criteria:

- The active project, workspace document state, and relevant UI preferences restore predictably.

Suggested branch:

- `codex/reload-project-switch-smoke`

### Slice 4B: Backup parity audit for review and alias state

Scope:

- Confirm newer review/alias state is included in backup export/import flows.

Acceptance criteria:

- Exported backups restore review-related follow-up state without silent loss.

Suggested branch:

- `codex/backup-review-alias-parity`

### Slice 4C: Store-boundary cleanup where reliability requires it

Scope:

- Migrate only the state slices that are actively causing reload or route desync risk.

Acceptance criteria:

- State ownership is clear for the touched flows.
- The changes measurably reduce restore/desync issues rather than just moving code around.

Suggested branch:

- `codex/store-reliability-slices`

## 5) Structural Cleanup in Active Routes

Goal: reduce feature friction in the routes that are still carrying too much inline orchestration.

Targets:

- Continue reducing `WorkspaceRoute.tsx`.
- Start extracting non-UI logic from `WorldBibleRoute.tsx` as feature work touches it.

Exit criteria:

- Route files move closer to composition shells instead of feature containers.
- Feature changes in workspace and World Bible require less cross-cutting edits.

Implementation backlog:

### Slice 5A: Workspace export hook extraction

Scope:

- Move Markdown/DOCX/EPUB export orchestration into a dedicated workspace hook.

Acceptance criteria:

- Export logic is testable and no longer primarily owned inline by `WorkspaceRoute.tsx`.

Suggested branch:

- `codex/workspace-export-hook`

### Slice 5B: Workspace canon sync extraction

Scope:

- Move parent/child canon sync and promotion operations into a dedicated hook or service boundary.

Acceptance criteria:

- Canon sync actions are isolated from route layout concerns.

Suggested branch:

- `codex/workspace-canon-hook`

### Slice 5C: World Bible import and alias logic extraction

Scope:

- Move JSON import session state and alias sync logic out of `WorldBibleRoute.tsx`.

Acceptance criteria:

- Route-owned code is primarily UI state and composition, not import-resolution logic.

Suggested branch:

- `codex/world-bible-import-alias-extraction`

## 6) Desktop Packaging Validation

Goal: close the gap between “web app in development” and “desktop authoring product.”

Targets:

- Produce an installable desktop build with local storage behavior verified.
- Confirm backup/export/import and AI proxy expectations in the packaged app.
- Decide on the first externally-supported platform baseline and update path expectations.

Exit criteria:

- A distributable desktop build exists and supports the core author workflow.

Implementation backlog:

### Slice 6A: Packaged-app validation pass

Scope:

- Run the existing core author flows in an installable build, not just the web dev flow.

Acceptance criteria:

- Writing, save/reload, export, backup, and AI provider expectations are verified in a packaged build.

Suggested branch:

- `codex/desktop-packaged-smoke`

### Slice 6B: Desktop-specific reliability gaps

Scope:

- Fix any IPC, packaging, storage-path, or bundled-resource issues discovered in packaged validation.

Acceptance criteria:

- No known packaged-only blocker remains for the core author workflow.

Suggested branch:

- `codex/desktop-packaging-fixes`

## 7) AI Personas / Tools

Goal: move beyond generic assistant behavior toward explicit author-facing roles.

Targets:

- Add project-level persona/tool definitions.
- Ship first writing critic persona with critique modes such as:
  - line edit
  - story clarity
  - scene tension
- Keep outputs scoped and manual-apply.

Exit criteria:

- Critic persona can review selected text with predictable structured output.

Implementation backlog:

### Slice 7A: Persona model and project binding

Scope:

- Define how personas/tools are stored at the project level and surfaced in the editor assistant.

Acceptance criteria:

- A project can opt into a named persona/tool set without breaking existing assistant behavior.

Suggested branch:

- `codex/ai-persona-model`

### Slice 7B: Writing critic v1

Scope:

- Ship one critic persona with bounded critique modes such as line edit, story clarity, and scene tension.

Acceptance criteria:

- Selected-text critique produces structured, scoped output that is manual-apply.

Suggested branch:

- `codex/ai-writing-critic`

## 8) First-Run Onboarding Cleanup

Goal: keep the first-use experience aligned with the writing-first product promise.

Targets:

- Remove or soften any setup friction before drafting.
- Clarify how optional systems are discovered without making them feel required.

Exit criteria:

- A new user can create/open a project and start drafting without feeling pushed into schema or systems setup.

Implementation backlog:

### Slice 8A: First-run friction audit

Scope:

- Review empty states, first-run labels, and entry points for projects and workspace.

Acceptance criteria:

- No first-run path implies that rules, canon schemas, or AI setup are mandatory before writing.

Suggested branch:

- `codex/first-run-friction-audit`

### Slice 8B: Optional-system discovery

Scope:

- Improve discoverability for World Bible, review, and advanced systems without foregrounding them on initial load.

Acceptance criteria:

- Optional systems are easy to find when needed, but the default experience still reads as a writing app.

Suggested branch:

- `codex/optional-system-discovery`

## Working Sequence

Recommended order for the next active branches:

1. `codex/world-bible-review-queue`
2. `codex/world-bible-review-actions`
3. `codex/review-ignore-persistence`
4. `codex/review-highlight-correctness`
5. `codex/review-completion-smoke`
6. `codex/app-shell-search-entry`
7. `codex/unified-search-results`
8. `codex/search-alias-routing`

## Branch and Commit Workflow (Keep)

- Create a feature branch for each slice using `codex/<topic>`.
- Keep commits small and scoped.
- Validate each slice with lint/build before commit.
- Avoid batching unrelated changes in one commit.

Suggested branch names:

- `codex/editor-theme-hardening`
- `codex/review-completion-badges`
- `codex/ai-writing-critic`
