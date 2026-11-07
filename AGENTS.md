# Project Instructions

Read order for any task: `docs/README.md` (doc map) → `PROJECT_STATUS.md`
(current truth) → `docs/road-to-market.md` (the only active roadmap and slice
plan; its status board is authoritative for open work).

## Working on roadmap slices

Follow the **Executing a Slice** section in `docs/road-to-market.md`: claim
the slice on the status board, pull the full prompt from the referenced
archive doc (applying the path remaps listed there), run the verification
tier defined in the roadmap before committing, and mark the slice done with its
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
- **File size:** `pnpm check:file-sizes` fails when a source file passes
  1,000 lines or a file already over that grows past its baseline in
  `scripts/file-size-baseline.json`. The goal is code a reader can follow,
  not a line count, so meet the limit with a real seam or not at all:
  - **What counts as a seam.** A hook, service, or component that names one
    feature or concern a reader would search for (for example
    `useWorldBibleImports`, `WorkspaceCharacterLabSection`), keeps its own
    state or logic, and lives in the same folder as the file it came from.
    Removing duplicated code also counts.
  - **What does not.** A single button, a few lines of JSX, or a wrapper
    whose only reason to exist is the line count. Never get under the limit
    by reformatting, joining lines, or deleting comments.
  - **When there is no good seam.** A file already over the limit may grow
    by up to 25 lines: run `pnpm check:file-sizes --update`, and say in the
    commit message which file grew, by how much, and why no seam fit. The
    file must then be covered by an open breakup slice on the status board
    (see 3.32). New files still may not pass 1,000 lines.
  - Otherwise, run `--update` only to record a file that shrank.
- **Docs:** update `PROJECT_STATUS.md` (and `docs/status-writing-workspace.md`
  for Workspace behavior) when application truth changes; keep
  completed-work diaries out of the roadmap; archive superseded docs to
  `docs/archive/` with a banner instead of leaving them active-looking. Do
  not create new parallel roadmaps or spec forks.
- **Manual smoke:** procedures in `docs/smoke-tests.md`; run the relevant one
  after changing a covered workflow (backup, review completion, character
  canon).
