# Next Steps

Last updated: 2026-02-22

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

## Recommended Priority Order

1. Stabilization and QA (short cycle)
2. Runtime integration expansion
3. UX polish pass
4. Data portability/import/export hardening
5. Balancing and authoring ergonomics

## 1) Stabilization and QA

Goal: ensure recent systems are safe to build on.

Checklist:

- Run: `pnpm lint`
- Run: `pnpm build:web`
- Smoke test:
  - Compendium: entries/milestones/recipes/actions.
  - Zone affinity progression.
  - Settlement aura + fortress level/base stats save flow.
  - Community/logistics role combos.
  - Character Sheets effective-value preview.
  - Workspace imports for `.txt`, `.md`, `.html`, `.docx`.

Exit criteria:

- No regressions in create/edit/save flows.
- No data-loss path on reload.

## 2) Runtime Integration Expansion

Goal: make world systems drive more outcomes than crafting preview and stat/resource display.

Next slices:

- Apply runtime modifiers to action resolution hooks (not just preview UIs).
- Introduce a shared `runtimeContext` service for:
  - settlement effects
  - party synergy effects
  - zone affinity effects
  - ailment effects
- Route `runtimeContext` into rule evaluations where possible.

Exit criteria:

- At least one additional gameplay path (besides crafting) uses runtime effects in persisted outcomes.

## 3) UX Polish Pass

Goal: reduce friction from dense forms and clarify flows.

Targets:

- Compendium layout split into:
  - Setup
  - Progress
  - Runtime Systems
- Convert rough inputs to explicit draft/save patterns where needed.
- Improve labels/tooltips for “base vs effective” values.

Exit criteria:

- Fewer ambiguous controls.
- Save intents are explicit and consistent.

## 4) Data Portability / Import-Export

Goal: improve author workflow and reduce lock-in risk.

Targets:

- Add export for scenes and compendium data (`.json` + optional markdown bundle).
- Add import preview/validation before commit.
- Optional: richer Word import handling (tables/headers/formatting).

Exit criteria:

- Author can round-trip project content safely.

## 5) Balance and Authoring Ergonomics

Goal: make systems tunable for writing mode and game mode.

Targets:

- Centralize configurable coefficients (fortress tier effects, synergy bonuses, zone rates).
- Add “profile presets”:
  - Narrative/abstract timing
  - Concrete/game timing

Exit criteria:

- Switching profiles changes behavior without code edits.

## Branch and Commit Workflow (Keep)

- Create a feature branch for each slice using `codex/<topic>`.
- Keep commits small and scoped.
- Validate each slice with lint/build before commit.
- Avoid batching unrelated changes in one commit.

Suggested branch names:

- `codex/runtime-context-expansion`
- `codex/ux-compendium-polish`
- `codex/import-export-roundtrip`

