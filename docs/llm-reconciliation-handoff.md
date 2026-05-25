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

- Compare current review surfaces against `codex/review-completion-state` and list narrow candidate improvements.
- Review workspace review drawer density and produce findings only.
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

