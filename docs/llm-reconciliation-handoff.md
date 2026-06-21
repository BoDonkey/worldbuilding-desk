# LLM Reconciliation Handoff

## Purpose

Use this document when handing reconciliation work to another LLM or reviewer. The safest role for another LLM is scout/reviewer: inspect the current branch, compare against the reference branch, identify narrow candidate slices, and report risks. Avoid assigning broad implementation unless the slice is very explicit.

## Branches

- Active branch: `codex/lore-docs-smoke-ia`
- Prior reconciliation baseline: `codex/reconcile-temp-update-ui`
- Reference branch only: `codex/review-completion-state`
- Functional base: `temp-update`

Do not wholesale merge or cherry-pick `codex/review-completion-state`. It has some better UI/product shape, but some behavior is weaker than the active branch. If the reference UI is useful, port it manually and narrowly.

## Recent Reconciliation Commits

- `0e79d32` - added UI style guide guardrails.
- `712de54` - refined Cast editor visual parity.
- `2af1ef4` - added Cast rich field variant.
- `46873d6` - restored Cast AI draft workflow.
- `9b28d58` - reduced World Bible review card density.
- `f7c2f19` - stabilized World Bible review aliases.
- `69dbb88` - unified active project page chrome.
- `616ff78` - aligned secondary route headers.
- `85c29fa` - added scratchpad access to planning headers.
- `5b4071e` - stabilized corkboard header actions.
- `8a1e922` - normalized lore and canon header utilities.
- `96faf81` - added collapsible corkboard chapter rail.
- `9c02c1e` - added context rails to lore and world bible.
- `b85e8ae` - moved world bible utilities into rail.
- `931bf51` - added lore starter cards.
- `6cc5ebd` - added Lore Documents smoke coverage.
- `01e9ab1` - clarified Lore Documents source-note IA.
- `6cb0602` - added World Bible linked Lore Document workflow and smoke coverage.
- Current uncommitted slice - documentation refresh for the Lore Documents IA checkpoint.

## Current Checkpoint

The active-project chrome/rail slice is committed through `931bf51`. The World Bible AI helper/import work landed on `world-bible-ai` and is already merged to `main`.
The current branch starts from `main` after the review-completion smoke merge and focuses on Lore Documents IA and smoke stabilization.

Included areas:

- `apps/web/src/components/PageHeader.tsx`
- `apps/web/src/components/ProjectScratchpadButton.tsx`
- `apps/web/src/routes/WorldBibleRoute.tsx`
- `apps/web/src/routes/LoreRoute.tsx`
- `apps/web/src/routes/CorkboardRoute.tsx`
- `apps/web/src/routes/CanonDecisionsRoute.tsx`
- `apps/web/src/routes/WorkspaceRoute.tsx`
- `apps/web/src/styles/WorldBibleRoute.module.css`
- `apps/web/src/styles/LoreRoute.module.css`
- `apps/web/src/styles/CorkboardRoute.module.css`
- `apps/web/src/styles/CanonDecisionsRoute.module.css`
- `apps/web/src/styles/WorkspaceRoute.module.css`
- `apps/web/src/hooks/useWorkspaceConsistency.ts`
- `apps/web/src/hooks/useWorkspaceLoreSnippets.ts`
- `apps/web/src/hooks/useWorkspaceProjectData.ts`
- `apps/web/src/hooks/useWorldBibleEntityActions.ts`
- `apps/web/src/routes/CharactersRoute.tsx`
- `apps/web/src/components/Editor/extensions/ConsistencyHighlightsExtension.ts`
- `apps/web/src/services/worldBible/worldBibleReviewHelpers.ts`
- `apps/web/src/services/worldBible/worldBibleReviewHelpers.test.ts`
- `apps/web/src/services/consistency/ConsistencyEngineService.ts`
- `apps/web/src/services/consistency/ConsistencyEngineService.test.ts`
- `apps/web/src/services/consistency/textMatcher.test.ts`
- `apps/web/cypress/e2e/lore-review-matching.cy.ts`
- `apps/web/cypress/e2e/project-mode-guardrails.cy.ts`

Implemented in the checkpoint:

- Workspace, World Bible, Lore, Corkboard, and Canon Decisions now share the active-project header rhythm.
- Scratchpad quick access is available from World Bible, Lore, Corkboard, and Canon Decisions.
- Corkboard keeps Scratchpad in the upper-right header area and moves chapter-card list/status controls into a calmer secondary row/rail.
- Corkboard has a collapsible chapter-card rail so the card list can be hidden while planning.
- World Bible and Lore now have context rails aligned with the Workspace side-rail model.
- World Bible import/help/template controls moved out of the top header into the rail; import/export actions that already live in top cards were not duplicated there.
- Lore has starter cards for `Write Manually`, `Import Dossier`, and `Extract Canon`.
- The Lore manual starter moves focus into the editor title input; extraction remains disabled until there is an active saved document.
- Lore route copy now consistently frames the surface as Lore Documents: longform source notes and imported dossiers that can produce candidates, not source-of-truth canon by themselves.
- Lore Documents utilities now sit in the shared page-header pattern rather than a local control band.
- Cypress smoke covers manual Lore Document creation/edit/delete, dossier import, extraction candidate review, and confirms extracted lore does not write World Bible canon automatically.
- World Bible records can create or open a linked Lore Document for longform source notes.
- Lore Documents can navigate back to a linked World Bible record through the existing `focusEntityId` route-state path.
- Cypress smoke covers the World Bible -> Lore Document -> World Bible round trip.
- Review Queue is reduced to one primary queue surface.
- Cast creation cards, Queue Focus, duplicate queue item panels, recommendation filter pills, `Open queue mode`, and `Focus first item` are removed from review mode.
- Review card action copy now uses `Resolve names` when a duplicate/alias decision is available.
- First-name/full-name matching now treats `Garcia` as a likely alias candidate for `Garcia de Terra`.
- World Bible review details lead with `Make Garcia an alias of Garcia de Terra` for short-name character overlaps.
- Workspace link target options now suppress duplicate Character Tools entries when a matching World Bible character entity exists.
- Workspace character-match handoff now passes the matching World Bible entity id rather than a Character Tools id.
- Character Tools deletion now clarifies that removing a linked tools profile does not remove World Bible canon or workspace highlights.
- World Bible entity alias cleanup now uses current alias `targetId` state instead of relying on the legacy `entityId` field.
- Workspace general-fiction canon highlighting now treats World Bible character entities as canon and does not keep orphan Character Tools profiles highlighted after World Bible canon deletion.
- Unknown extraction now keeps longer proper names such as `Magical Substance Control Agency` and suppresses the common sentence-start word `Whatever`.
- Inline review popovers now keep Add / Ignore / Always ignore controls stable when the category dropdown changes.
- World Bible category task cards are back to manual/import as the primary paths.
- AI is discrete and author-invoked from manual/import contexts.
- The current helper is a floating chat where selected assistant text becomes a previewed proposal before the author confirms a name, alias, field, or new-section action.
- Model output can ask permission to add a rich-text section, apply text to a field, set a name, or add aliases, with every mutation confirmed by the author.
- Model output must not silently create records, fields, aliases, or canon facts.
- World Bible document, pasted-text, and JSON imports remain available from the utility rail/task cards.
- Shared import preview now handles Cast and non-Cast categories. Headings are classified as existing fields, record-local sections, reusable fields, or ignored content before import.
- Record-specific headings such as `Sireneans and Trafficking` stay inside the record by default instead of becoming reusable category fields.
- World Bible list cards now show compact summaries instead of full long-form record bodies.

Verified after the checkpoint:

- `pnpm run build:web`
- Browser smoke on `/workspace`, `/world-bible`, `/lore`, `/corkboard`, and `/canon-decisions` for shared header/rail placement.
- Browser smoke on `/lore`: starter cards render, `Start Writing` focuses the editor title input, `Extract Facts` is disabled without an active document, and no console errors were observed.
- `pnpm --filter web exec tsc --noEmit`
- `pnpm --filter web test:unit -- --run` passes 89 tests.
- `pnpm --filter web lint` passes with one existing `useWorkspaceDocuments.ts` hook warning.
- `pnpm --filter web exec cypress run --spec cypress/e2e/project-mode-guardrails.cy.ts` passes 7 tests.
- `pnpm --filter web exec cypress run --spec cypress/e2e/lore-review-matching.cy.ts` passes 6 tests.
- `pnpm --filter web exec cypress run --spec cypress/e2e/lore-documents.cy.ts` passes 3 tests.
- Latest Lore Documents IA slice:
  - `pnpm --filter web exec tsc --noEmit`
  - `pnpm --filter web lint` passes with the existing `useWorkspaceDocuments.ts` hook warning.
  - `git diff --check`
- Current World Bible AI helper slice:
  - `pnpm --filter web exec tsc --noEmit`
  - `pnpm --filter web test:unit -- --run apps/web/src/components/AIAssistant/AIAssistant.test.ts apps/web/src/hooks/useWorldBibleImports.test.ts` passes 125 tests.
  - `pnpm --filter web lint` passes with the existing `useWorkspaceDocuments.ts` hook warning.
  - `pnpm --filter web build` passes with existing Vite large-chunk and `onnxruntime-web` eval warnings.
  - `git diff --check`
  - Browser smoke on `/world-bible` confirms manual/import remain the primary task cards.
  - Browser smoke confirms the helper opens as a fixed floating panel with an apply destination picker and no old `AI-Assisted Draft` card.
  - The latest importer cleanup was validated by automated checks only; do a fresh browser smoke before committing if possible.

Known verification note:

- A broader Cypress run previously surfaced an existing `post-merge-smoke.cy.ts` failure around `Prompt Tools`; treat that as a known follow-up unless current changes touch prompt-tool settings.

Next thing to resume:

- Start a fresh narrow slice. Good candidates:
  1. commit the documentation refresh if it is still uncommitted
  2. merge `codex/lore-docs-smoke-ia` to `main` after reviewing the docs diff
  3. run a realistic manual Lore Documents import -> extraction -> accepted canon smoke, especially with more than one linked World Bible record
  4. start `codex/canon-decision-merge-review` or `codex/character-canon-smoke` as the next narrow branch
  5. keep every AI-proposed canon/schema mutation author-confirmed and editable before save

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
- Keep future active-project route work on `PageHeader`, `ProjectScratchpadButton`, and the context-rail pattern unless a route has a concrete reason to diverge.
- AI flows remain explicit and author-invoked. Model output should fill editable drafts or review candidates; it should not silently mutate canon.

## Verified Recently

- `pnpm build:web`
- `pnpm --filter web exec cypress run --spec cypress/e2e/project-mode-guardrails.cy.ts`
- Browser smoke on the June 3 active-project chrome/rail slice.

The build still emits existing Vite large-chunk warnings and an `onnxruntime-web` eval warning. Treat those as pre-existing unless a change directly affects bundling.

## Good Tasks For Another LLM

- Compare current review surfaces against `codex/review-completion-state` and list narrow candidate improvements.
- Run or outline broader review-completion smoke coverage.
- Audit docs for stale recovery-plan statements.
- Identify risky reference-branch code that should not be ported.
- Browser-smoke the current Lore Documents import/extraction/linking path and report any unclear source-note/canon boundary labels.

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
