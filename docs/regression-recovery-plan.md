# Regression Recovery Plan

## Branch Map

- `main`: last shared trunk before the current reconciliation work.
- `temp-update`: functional base for recovery. It forks from `main` at `7153ab0 Update workspace review` and includes the newer Zustand store work.
- `codex/review-completion-state`: richer UI/reference branch. Use it for selective product-shape recovery only, not as the base branch.
- `codex/reconcile-temp-update-ui`: active recovery branch, based on `temp-update`.

## Recovery Approach

1. Keep `temp-update` as the functional base.
2. Bring over narrow, reviewable slices only.
3. Commit each slice before starting the next one.
4. Add a guardrail test or written UI contract for every regression class before broad UI work.
5. Treat `codex/review-completion-state` as reference material for selected UI restoration, especially character and review surfaces.

## Guardrail Contracts

General fiction projects:

- Do not show ruleset navigation, ruleset command-palette entries, character sheets, compendium navigation, or game-system workspace context.
- Direct ruleset access must redirect away from `/ruleset`.
- Character management must remain story-facing: one character area, long-form description support, alias resolution, and no duplicate form-first character surfaces.

LitRPG/game projects:

- May expose rulesets, character sheets, compendium, runtime modifiers, and settlement/zone systems only when project feature toggles explicitly allow them.
- Feature checks should go through `getProjectCapabilities` rather than inline toggle reads.

World Bible and review surfaces:

- Keep review affordances subtle and low-density.
- Avoid returning to large review cards with repeated action buttons unless there is a specific workflow reason.
- Preserve focused review queues and minimal notification surfaces from `temp-update` where they are functionally stronger.

Character authoring:

- Default long-form character writing to TipTap-backed rich fields with AI assistance, not textarea-heavy forms.
- Keep canonical names, aliases, and merge decisions in World Bible unless a project-specific workflow explicitly requires otherwise.
- Keep character sheets and game-system state surfaces behind `getProjectCapabilities`; general fiction should show a single story-facing character area.

Planning surfaces:

- Treat Corkboard as a first-class story-arc planning route while preserving quick workspace modal access to the same underlying cards.
- Keep Scratchpad and Corkboard writing-friendly; they are author planning tools, not game-system surfaces.
- Do not regress the current writing workspace rail defaults while recovering the friendlier planning UI from `codex/review-completion-state`.

Code optimization and refactors:

- Do not optimize by broad route rewrites, file moves, or state ownership changes inside recovery slices.
- Any shared abstraction must remove concrete duplication or encode an existing guardrail; otherwise keep the change local.
- Add a focused automated contract before or with any optimization that changes navigation, project-mode capabilities, storage cleanup, editor ownership, or review/character UI shape.
- Preserve current behavior first, then improve presentation. If a reference branch has better UI but weaker behavior, port the UI manually instead of cherry-picking the regression.

Storage and deletion:

- Project deletion must remove project-scoped IndexedDB records, per-project localStorage preferences, and per-project RAG/Shodh databases.
- Browser refresh may update IndexedDB display counts, but deleted projects must not leave usable project data behind.

## Next Slices

Completed recovery checkpoints on `codex/reconcile-temp-update-ui`:

1. `f22a60b` - initial character UI recovery checkpoint.
2. `cec3063` - planning surfaces recovery:
   - Scratchpad modal and context drawer use shared TipTap editing.
   - `/corkboard` is a first-class route, with navigation and command-palette access.
   - Corkboard route and workspace modal share the current `useWorkspaceCorkboard` storage.
   - Added Cypress coverage for `/corkboard` and updated Scratchpad coverage.
3. `898f40d` - refined Characters UI shell:
   - Characters now follows the friendlier `codex/review-completion-state` task-card/list visual shape.
   - The current branch's richer behavior is preserved: project-mode gating, roster import/export, alias/canon handoff, character sheets behind capabilities, and TipTap-backed Description/Notes fields.
   - The general-fiction Characters hub no longer shows a lonely tab row.

Verified for the current checkpoint:

- `pnpm --filter web exec tsc --noEmit`
- `pnpm --filter web lint` passes with the existing unrelated warning in `apps/web/src/hooks/useWorkspaceDocuments.ts`.
- `pnpm --filter web exec cypress run --spec cypress/e2e/project-mode-guardrails.cy.ts`
- Browser smoke on `http://localhost:5173/characters`: hub layout and manual character form render coherently, and long-form fields are TipTap editors.

Recommended next slices:

1. Restore/import Character "Import Or Paste" deliberately:
   - Keep it route-local and review-first.
   - Reuse existing roster/import primitives where possible.
   - Do not introduce textarea-first long-form editing; imported long-form content should land in TipTap-compatible rich text.
   - Keep sheets/game-system data behind `getProjectCapabilities`.
2. Restore Character AI-assisted draft deliberately:
   - Author-invoked only.
   - No background generation.
   - Draft output must land in editable rich fields before save.
   - Preserve provider/settings guardrails and failure messaging.
3. Reconcile review UI density from the reference branch without taking degraded functionality.
4. Add smoke tests for character import, AI-assisted draft entry state, and review shape once those UI paths are restored.

## Next Session Handoff

- Stay on `codex/reconcile-temp-update-ui` unless there is a deliberate branch decision.
- The working tree was clean after commit `898f40d Refine characters UI shell`.
- Do not wholesale merge `codex/review-completion-state`. It has some more polished UI, but not all of it is better, and its functionality is degraded compared with this branch.
- Use `codex/review-completion-state` only as a visual/product reference. Port small pieces manually after checking them against current functionality and the guardrail contracts above.
- Be especially careful with character import and AI generation: these should return as focused workflows, not as broad form-heavy surfaces.
- The writing workspace from the current branch remains preferred; do not replace it with the `codex/review-completion-state` workspace.
- The new targeted Cypress spec `apps/web/cypress/e2e/project-mode-guardrails.cy.ts` passes.
- A broader Cypress run surfaced an existing `post-merge-smoke.cy.ts` failure around `Prompt Tools`; treat that as a known follow-up, not as a failure introduced by the project-mode guardrail slice.
