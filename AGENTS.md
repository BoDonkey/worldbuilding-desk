# Project Instructions

Read order for any task: `docs/README.md` (doc map) → `PROJECT_STATUS.md`
(current truth) → `docs/road-to-market.md` (the only active roadmap and slice
plan; its status board is authoritative for open work).

## Working on roadmap slices

Follow the **Executing a Slice** section in `docs/road-to-market.md`: claim
the slice on the status board, pull the full prompt from the referenced
archive doc (applying the path remaps listed there), run the full
verification battery before committing, and mark the slice done with its
commit hash. Refactor slices are strictly behavior-preserving.

## Standing rules

- **AI trust boundary:** models propose, deterministic code validates,
  authors approve. Never add a path where model output writes directly to
  canon, mechanics, or state. Contracts: `docs/domain-model.md`.
- **UI/styling:** consult the Design System section of
  `docs/product-blueprint.md` before creating or altering UI, CSS, layout, or
  visual styling. Use existing theme tokens from
  `apps/web/src/styles/theme.css`; verify tokens exist before use; do not
  hardcode colors or invent one-off component variables. If a token is
  missing, use the closest existing one or add shared tokens deliberately.
- **Architecture boundaries:** `docs/architecture-review.md`. Domain logic
  lives in services/hooks, not route components; no new direct persistence
  paths; keep the Electron IPC surface narrow.
- **Docs:** update `PROJECT_STATUS.md` when application truth changes; keep
  completed-work diaries out of the roadmap; archive superseded docs to
  `docs/archive/` with a banner instead of leaving them active-looking. Do
  not create new parallel roadmaps or spec forks.
- **Manual smoke:** procedures in `docs/smoke-tests.md`; run the relevant one
  after changing a covered workflow (backup, review completion, character
  canon).
