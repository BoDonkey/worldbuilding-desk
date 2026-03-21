# Next Steps

Last updated: 2026-03-15

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
- Persistent review queue with category selection, alias linking, and highlight-to-review for missed mentions.
- Alias visibility in World Bible.
- Editor appearance controls for font presentation, reading width, editor surface, and line spacing.
- Theme-aware editor surface variants for dark mode.
- First AI persona preset: `Writing Critic`.

## Recommended Priority Order

1. AI persona workflow
2. Review completion workflow
3. Lore / compendium tooltip convergence
4. Editor customization follow-up
5. Data portability/import/export hardening

## 1) AI Persona Workflow

Goal: make the first persona useful in real drafting flow, not just installable in settings.

Checklist:

- Add explicit assistant actions for:
  - `Critique selected passage`
  - `Critique current scene`
- Keep output structured:
  - quick verdict
  - top issues
  - examples
  - revision priorities
- Keep apply/insert manual.
- Validate that mode defaults still preselect the correct persona.

Exit criteria:

- Authors can invoke the critic without composing the prompt from scratch.
- Critic outputs are predictable and concise enough to be useful.

## 2) Review Completion Workflow

Goal: make fast review-created records feel intentionally incomplete rather than silently finished.

Next slices:

- Add `needs completion` / draft state to review-created World Bible entities.
- Add first-class `Alternative names` to World Bible entries and sync them with alias-based review/lore matching.
- Add optional compendium seeding from review actions.
- Badge World Bible / Compendium navigation targets when draft records need attention.

Exit criteria:

- Authors can create fast shells from review without losing track of unfinished records.
- Review-created records surface follow-up work clearly.

## 3) Lore / Compendium Tooltip Convergence

Goal: reuse the stronger workspace popover patterns for broader canon cleanup and lookup.

Targets:

- Expand the shared popover shell into a richer review surface for lore and compendium links.
- Support smoother alias management from tooltip flows.
- Reduce context switching between Workspace, World Bible, and Compendium.

Exit criteria:

- Authors can inspect and resolve lightweight canon issues without leaving the scene unnecessarily.

## 4) Editor Customization Follow-up

Goal: revisit editor controls only if the current presets prove too limiting in real use.

Targets:

- Add richer font options, potentially including dyslexia-friendly choices.
- Consider custom highlight palettes and more granular surface settings.
- Revisit toolbar edge cases only if they recur after more writing time.

Exit criteria:

- The editor remains comfortable over long sessions without becoming a settings swamp.

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

- `codex/ai-writing-critic-actions`
- `codex/review-completion-badges`
- `codex/lore-tooltip-convergence`
