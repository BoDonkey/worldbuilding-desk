# LLM Reconciliation Handoff

## Purpose

Use this document when handing reconciliation work to another LLM or reviewer. The safest role for another LLM is scout/reviewer: inspect the current branch, compare against the reference branch, identify narrow candidate slices, and report risks. Avoid assigning broad implementation unless the slice is very explicit.

## Branches

- Active branch: `codex/reconcile-temp-update-ui`
- Reference branch only: `codex/review-completion-state`
- Functional base: `temp-update`

Do not wholesale merge or cherry-pick `codex/review-completion-state`. It has some better UI/product shape, but some behavior is weaker than the active branch. If the reference UI is useful, port it manually and narrowly.

## Recent Reconciliation Commits

- `0e79d32` - added UI style guide guardrails.
- `712de54` - refined Cast editor visual parity.
- `2af1ef4` - added Cast rich field variant.
- `46873d6` - restored Cast AI draft workflow.
- `9b28d58` - reduced World Bible review card density.

## Current In-Progress State

There are uncommitted review/alias UX changes after `9b28d58`.

Touched areas:

- `apps/web/src/routes/WorldBibleRoute.tsx`
- `apps/web/src/hooks/useWorkspaceConsistency.ts`
- `apps/web/src/hooks/useWorldBibleEntityActions.ts`
- `apps/web/src/routes/CharactersRoute.tsx`
- `apps/web/src/services/worldBible/worldBibleReviewHelpers.ts`
- `apps/web/src/services/worldBible/worldBibleReviewHelpers.test.ts`
- `apps/web/cypress/e2e/project-mode-guardrails.cy.ts`

Implemented in the working tree:

- Review Queue is reduced to one primary queue surface.
- Cast creation cards, Queue Focus, duplicate queue item panels, recommendation filter pills, `Open queue mode`, and `Focus first item` are removed from review mode.
- Review card action copy now uses `Resolve names` when a duplicate/alias decision is available.
- First-name/full-name matching now treats `Garcia` as a likely alias candidate for `Garcia de Terra`.
- World Bible review details lead with `Make Garcia an alias of Garcia de Terra` for short-name character overlaps.
- Workspace link target options now suppress duplicate Character Tools entries when a matching World Bible character entity exists.
- Workspace character-match handoff now passes the matching World Bible entity id rather than a Character Tools id.
- Character Tools deletion now clarifies that removing a linked tools profile does not remove World Bible canon or workspace highlights.
- World Bible entity alias cleanup now uses current alias `targetId` state instead of relying on the legacy `entityId` field.

Verified after the in-progress changes:

- `pnpm --filter web exec tsc --noEmit`
- `pnpm --filter web test:unit -- --run` passes 87 tests.
- `pnpm --filter web exec cypress run --spec cypress/e2e/project-mode-guardrails.cy.ts` passes 7 tests.

Known verification note:

- `pnpm --filter web exec cypress run --spec cypress/e2e/lore-review-matching.cy.ts` passed 4 of 5 checks, then failed on a stale expectation that `/characters` shows `Character Tools`. This branch routes general-fiction `/characters` into World Bible/Cast, so update that spec before treating it as a product regression.

Next thing to resume:

- Manually smoke the full workspace-to-World-Bible alias path with a short name and full name:
  1. make or detect `Garcia` in Workspace while `Garcia de Terra` exists as World Bible canon
  2. confirm the link dropdown does not show duplicate `(entity)` and `(character)` targets
  3. open `Resolve names`
  4. confirm `Make Garcia an alias of Garcia de Terra` appears
  5. apply it and confirm only the full canon record remains highlighted
  6. confirm deleting only the Character Tools profile does not remove highlights, while deleting the World Bible canon record does

## Required Reading

- `AGENTS.md`
- `docs/style-bible.md`
- `docs/regression-recovery-plan.md`
- `docs/character-cast-ui-parity-checklist.md`

## Guardrails

- Preserve writing-first UX.
- General-fiction projects must not expose rulesets, character sheets, compendium, runtime modifiers, or other game-system surfaces.
- Feature gating should go through `getProjectCapabilities`.
- Keep review UI subtle and low-density.
- Do not replace the current writing workspace with the reference branch workspace.
- Do not do broad route rewrites, state ownership changes, or file moves during recovery slices.
- If reference branch UI is better but behavior is weaker, port manually and narrowly.
- For UI/CSS work, consult `docs/style-bible.md` and use shared theme tokens rather than hardcoded colors.

## Verified Recently

- `pnpm build:web`
- `pnpm --filter web exec cypress run --spec cypress/e2e/project-mode-guardrails.cy.ts`

The build still emits existing Vite large-chunk warnings and an `onnxruntime-web` eval warning. Treat those as pre-existing unless a change directly affects bundling.

## Good Tasks For Another LLM

- Finish smoke-testing the in-progress review/alias UX changes listed above and report exact failures before further UI changes.
- Update stale Cypress expectations around `/characters` now routing general-fiction projects to World Bible/Cast.
- Compare current review surfaces against `codex/review-completion-state` only after the alias path is stable, then list narrow candidate improvements.
- Run or outline broader review-completion smoke coverage.
- Audit docs for stale recovery-plan statements.
- Identify risky reference-branch code that should not be ported.

## Risky Tasks To Avoid

- Wholesale branch merges or cherry-picks.
- Replacing `WorkspaceRoute` or workspace drawer structure from the reference branch.
- Broad refactors of persistence, review state, editor ownership, or Zustand stores.
- Reintroducing general-fiction game-system surfaces.
- Adding background AI generation.

## Suggested Prompt For A Scout LLM

```text
You are reviewing the active branch `codex/reconcile-temp-update-ui` of Worldbuilding Desk.

Read:
- AGENTS.md
- docs/style-bible.md
- docs/regression-recovery-plan.md
- docs/llm-reconciliation-handoff.md

Use `codex/review-completion-state` only as a visual/product reference. Do not merge or cherry-pick it.

Task: inspect the current workspace review drawer and World Bible review surfaces, compare them with the reference branch, and return a short findings report. Focus on whether any narrow UI-density or copy improvements are worth implementing. Do not make code changes. Include file references and explain any behavior risks.
```

## Suggested Prompt For An Implementation LLM

Use only after a narrow candidate slice has been selected.

```text
Implement one narrow reconciliation slice on `codex/reconcile-temp-update-ui`.

Read:
- AGENTS.md
- docs/style-bible.md
- docs/regression-recovery-plan.md
- docs/llm-reconciliation-handoff.md

Do not merge or cherry-pick `codex/review-completion-state`.
Do not change persistence, editor ownership, or route structure unless the selected slice explicitly requires it.
Preserve general-fiction project-mode guardrails.

Selected slice:
[write one concrete sentence here]

After changes, run:
- pnpm build:web
- relevant focused Cypress spec if UI behavior changed

Report changed files, verification, and any residual risk.
```
