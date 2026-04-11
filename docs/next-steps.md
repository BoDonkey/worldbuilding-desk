# Next Steps

Last updated: 2026-04-10

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
- Editor appearance controls for font presentation, reading width, and editor surface.
- World Bible / Compendium `needs completion` badges for review-created records.
- `Alternative names` as a first-class World Bible field synced into alias matching.
- Conflict-reviewed World Bible JSON import for duplicate-name collisions.
- Backup export / validate / import smoke coverage.
- Manuscript export smoke coverage for Markdown, DOCX, and EPUB.
- AI provider diagnostics in Settings, including Ollama installed-model detection and apply-model actions.

## Recommended Priority Order

1. First-run onboarding
2. App-wide search
3. Review completion workflow polish
4. Editor readability and theme hardening
5. Desktop packaging
6. AI personas/tools

## 1) First-Run Onboarding

Goal: make the current feature set approachable without outside guidance.

Checklist:

- Add guided first-project creation.
- Explain import modes and when to use them.
- Surface the core routes and expected author workflow.
- Add lightweight inline help for Projects, Workspace, World Bible, and Settings.

Exit criteria:

- A new user can create a project, import source text, and understand where world/canon/AI settings live.
- The app no longer depends on the docs for first-session orientation.

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

## 3) Review Completion Workflow

Goal: make fast review-created records feel intentionally incomplete rather than silently finished.

Targets:

- Clarify the difference between `Refresh review` and `Resume strict review`.
- Decide whether review state should stay validation-derived or move to a persisted review queue.
- Expand the `Alternative names` model into tooltip/review editing flows so alias management is not limited to the World Bible form.

Exit criteria:

- Authors can create fast shells from review without losing track of unfinished records.
- Alias follow-up and review follow-up can both be completed from the same review-oriented workflow.

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

## 5) Desktop Packaging

Goal: close the gap between “web app in development” and “desktop authoring product.”

Targets:

- Choose packaging path and target platform baseline.
- Produce an installable desktop build with local storage behavior verified.
- Confirm backup/export/import and AI proxy expectations in the packaged app.

Exit criteria:

- A distributable desktop build exists and supports the core author workflow.

## 6) AI Personas / Tools

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

- `codex/editor-theme-hardening`
- `codex/review-completion-badges`
- `codex/ai-writing-critic`
