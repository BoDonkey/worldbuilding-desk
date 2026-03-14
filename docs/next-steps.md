# Next Steps

Last updated: 2026-03-14

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

## Recommended Priority Order

1. Workspace and editor stabilization
2. Editor readability and theme hardening
3. Review completion workflow
4. AI personas/tools
5. Data portability/import/export hardening

## 1) Workspace and Editor Stabilization

Goal: ensure the new workspace review/editor flows are safe to build on.

Checklist:

- Run: `pnpm lint`
- Run: `pnpm build:web`
- Smoke test:
  - Workspace imports for `.txt`, `.md`, `.html`, `.docx`, `.pages`.
  - Deferred review refresh/reopen behavior.
  - Lore highlight clicks for full names and shorthand references.
  - Drawer persistence across route changes.
  - Editor appearance settings survive reload.

Exit criteria:

- No regressions in create/edit/save flows.
- No data-loss path on reload.
- Review/lore highlighting behaves predictably across scene switches.

## 2) Editor Readability and Theme Hardening

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

## 3) Review Completion Workflow

Goal: make fast review-created records feel intentionally incomplete rather than silently finished.

Targets:

- Add `needs completion` / draft state to review-created World Bible entities.
- Add first-class `Alternative names` to World Bible entries and sync them with alias-based review/lore matching.
- Add optional compendium seeding from review actions.
- Badge World Bible / Compendium navigation targets when draft records need attention.
- Clarify the difference between `Refresh review` and `Resume strict review`.

Exit criteria:

- Authors can create fast shells from review without losing track of unfinished records.
- Review-created records surface follow-up work clearly.

## 4) AI Personas / Tools

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

## 5) Data Portability / Import-Export

Goal: improve author workflow and reduce lock-in risk.

Targets:

- Add export for scenes and compendium data (`.json` + optional markdown bundle).
- Add import preview/validation before commit.
- Optional: richer Word import handling (tables/headers/formatting).

Exit criteria:

- Author can round-trip project content safely.

## Branch and Commit Workflow (Keep)

- Create a feature branch for each slice using `codex/<topic>`.
- Keep commits small and scoped.
- Validate each slice with lint/build before commit.
- Avoid batching unrelated changes in one commit.

Suggested branch names:

- `codex/editor-theme-hardening`
- `codex/review-completion-badges`
- `codex/ai-writing-critic`
