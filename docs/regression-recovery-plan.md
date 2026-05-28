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
6. Track future copy, i18n, rounded-system-language, and accessibility work in `docs/ui-language-i18n-a11y-audit.md` rather than folding it into broad recovery rewrites.

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
- Use `docs/ui-language-i18n-a11y-audit.md` as the cross-cutting checklist when a recovery slice touches shared copy, visual language, focus behavior, dialog behavior, or accessibility semantics.

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
4. `19e45b5` - restored character import review flow:
   - Character import/paste is route-local and review-first.
   - Imported long-form content lands in TipTap-backed Description/Notes fields before save.
5. `99662af` - cleared stale active project after deletion:
   - Deleted final projects no longer leave an active project summary/workspace entry point behind.
6. `a80609d` - moved general character authoring into World Bible:
   - General-fiction `/characters` redirects to World Bible/Cast.
   - Canonical names, aliases, rich Description/Notes, and import entry points live in World Bible.
7. `a0b42cf` - refined World Bible cast authoring:
   - Cast editing no longer shows a persistent character right rail.
   - Authors can add reusable rich-text character sections such as Education, Traumas, or Addictions.
8. `4329142` - documented the Cast UI parity target:
   - `docs/character-cast-ui-parity-checklist.md` defines the target order, visual structure, import destinations, and guardrails for matching the reference character tab.
9. `0e79d32` - added UI style guide guardrails:
   - Root agent instructions now require consulting `docs/style-bible.md` for UI/CSS work.
   - Recovered reference-branch surface/button/input/badge tokens into the shared theme.
10. `712de54` - refined Cast editor visual parity:
   - Cast task cards, import panels, editor shell, actions, and canon section now use the shared style-bible tokens.
11. `2af1ef4` - added Cast rich field variant:
   - Description, Notes, and custom Cast sections use a compact character-dossier rich-field variant.
12. `46873d6` - restored Cast AI-assisted draft:
   - AI draft entry is author-invoked, failure-safe, and lands in editable Cast fields before save.
13. Review queue density pass:
   - World Bible review cards now keep repeated workflow actions out of the card list.
   - Focused review mode still owns next-item and detailed alias/merge workflows.
   - `project-mode-guardrails.cy.ts` includes a review-card density guardrail.
14. `f7c2f19` - stabilized World Bible review aliases:
   - Review Queue no longer renders Cast creation cards, Queue Focus, duplicate queue list panels, recommendation filter pills, `Open queue mode`, or `Focus first item`.
   - Review Queue cards now keep only core filters plus `Review details`, contextual `Resolve names`, and `Mark reviewed`.
   - First-name/full-name character overlap detection now surfaces a direct action such as `Make Garcia an alias of Garcia de Terra`.
   - Workspace link target assembly now suppresses duplicate Character Tools targets when a matching World Bible character entity exists, including first-name/full-name pairs.
   - Character Tools deletion now says `Remove Tools Profile` when a World Bible canon record exists, because deleting tools does not remove canon aliases or workspace highlights.
   - World Bible entity save/delete now clears in-memory aliases by `targetId`, not the legacy `entityId` field.
   - General-fiction Workspace canon highlighting no longer treats orphan Character Tools records as blue-highlight canon after the World Bible record is deleted.
   - Inline review popover controls now keep stable rows when category selection changes.
   - Unknown extraction now keeps longer proper names such as `Magical Substance Control Agency` and suppresses common sentence-start `Whatever`.
   - `lore-review-matching.cy.ts` now reflects current general-fiction `/characters` routing and covers World Bible canon deletion removing alias/highlight surfaces.

Verified for the current checkpoint:

- `pnpm --filter web exec tsc --noEmit`
- `pnpm --filter web lint` passes with the existing unrelated warning in `apps/web/src/hooks/useWorkspaceDocuments.ts`.
- `pnpm --filter web exec cypress run --spec cypress/e2e/project-mode-guardrails.cy.ts`
- `pnpm --filter web test:unit -- --run`
- `pnpm --filter web exec cypress run --spec cypress/e2e/lore-review-matching.cy.ts`
- Browser smoke on `http://localhost:5173/characters`: hub layout and manual character form render coherently, and long-form fields are TipTap editors.

Recommended next slices:

1. Run or repair broader review-completion smoke coverage before further review UI changes.
2. Revisit workspace review drawer density only after the World Bible queue is stable; do not replace the current writing workspace with the reference branch workspace.
3. Compare current review surfaces against `codex/review-completion-state` for narrow copy/density improvements only.
4. Audit the known `post-merge-smoke.cy.ts` Prompt Tools failure and decide whether the expectation or implementation is stale.

## Next Session Handoff

- Stay on `codex/reconcile-temp-update-ui` unless there is a deliberate branch decision.
- The working tree was clean after commit `46873d6 Restore Cast AI draft workflow`.
- Do not wholesale merge `codex/review-completion-state`. It has some more polished UI, but not all of it is better, and its functionality is degraded compared with this branch.
- Use `codex/review-completion-state` only as a visual/product reference. Port small pieces manually after checking them against current functionality and the guardrail contracts above.
- Character import and AI generation have returned as focused Cast workflows; keep future changes in that model.
- The writing workspace from the current branch remains preferred; do not replace it with the `codex/review-completion-state` workspace.
- The targeted Cypress spec `apps/web/cypress/e2e/project-mode-guardrails.cy.ts` passes with Cast import, AI draft entry, custom-section, and project-mode guardrails.
- A broader Cypress run surfaced an existing `post-merge-smoke.cy.ts` failure around `Prompt Tools`; treat that as a known follow-up, not as a failure introduced by the project-mode guardrail slice.
- `lore-review-matching.cy.ts` now passes after updating the stale `/characters` expectation and adding the World Bible canon deletion regression.
- The working tree was clean after commit `f7c2f19 Stabilize World Bible review aliases`.
