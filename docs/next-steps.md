# Next Steps

Last updated: 2026-04-12

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
4. Desktop packaging
5. AI personas/tools
6. First-run onboarding cleanup

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

## 4) Desktop Packaging

Goal: close the gap between “web app in development” and “desktop authoring product.”

Targets:

- Choose packaging path and target platform baseline.
- Produce an installable desktop build with local storage behavior verified.
- Confirm backup/export/import and AI proxy expectations in the packaged app.

Exit criteria:

- A distributable desktop build exists and supports the core author workflow.

## 5) AI Personas / Tools

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

## Branch and Commit Workflow (Keep)

- Create a feature branch for each slice using `codex/<topic>`.
- Keep commits small and scoped.
- Validate each slice with lint/build before commit.
- Avoid batching unrelated changes in one commit.

Suggested branch names:

- `codex/world-bible-review-intake`
- `codex/editor-theme-hardening`
- `codex/review-completion-badges`
- `codex/ai-writing-critic`
