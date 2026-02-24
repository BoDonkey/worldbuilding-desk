# Execution Plan and Branching Workflow

_Last updated: February 22, 2026_

## Recommendation

Do **not** run the original 4-point functionality plan as-is before touching UX.

Use a revised sequence:

1. Stabilize build/lint baseline first.
2. Do a thin UX stabilization pass on existing core flows.
3. Continue the functionality roadmap (import expansion, provenance, telemetry).
4. Run a deeper UX polish pass after major feature milestones.

This keeps momentum on functionality while preventing UX debt from compounding.

## Why this sequence

- Current compile/lint failures increase risk for every additional feature.
- High-friction UX causes rework later (labels, flows, validation, and states end up refactored repeatedly).
- A thin UX pass now is cheaper than retrofitting after import/electron changes land.

## Phase 0: Baseline Stability (Immediate)

Goal: get to a known-good developer baseline.

- Fix TypeScript/JSX errors in `apps/web/src/routes/WorkspaceRoute.tsx`.
- Add or migrate ESLint config for `packages/rules-engine` to ESLint v9 flat config.
- Confirm `pnpm build:web` and `pnpm lint` pass.
- Treat this as a release gate for all new work.

## Phase 1: Thin UX Stabilization (1 week target)

Focus only on high-friction issues in existing flows:

- Navigation and page orientation clarity.
- Empty/loading/error states for major routes.
- Inline form validation + actionable error messages.
- Save feedback (success/failure notices, disabled states while saving).
- Consistent control labels and spacing.
- Keyboard/focus quality on primary actions.

Out of scope:

- Full visual redesign.
- Major information architecture changes.
- Rebuilding component library from scratch.

## Phase 2: Functionality Roadmap (original plan, adjusted)

Continue feature delivery after Phase 0/1 gates:

- Import expansion: in-app typing/templates first, then DOCX/Markdown + CSV/JSON.
- Provenance and conflict resolution metadata.
- Audit trail and rollback tooling for imports.
- Telemetry/quota visibility planning and UI integration.

## Branching and Revert Safety Rules

Use feature branches for every change set and keep commits small.

### Branch naming

- Prefix all branches with `codex/`.
- Examples:
  - `codex/fix-workspace-jsx-build`
  - `codex/eslint-flat-config-rules-engine`
  - `codex/ux-thin-pass-workspace`

### Commit policy

- One logical change per commit.
- Commit early at stable checkpoints.
- Use descriptive commit messages.

### Safe integration workflow

1. Branch from `main` (or current integration branch).
2. Implement one scoped change.
3. Run local checks (`pnpm lint`, `pnpm build:web`) before merge.
4. Merge only when green.
5. Tag milestones if needed (`v0.3.0-ux-baseline` style).

### Revert strategy

- Prefer `git revert <commit>` for undoing merged work.
- Avoid rewriting shared history.
- If a branch fails late, keep the branch and cherry-pick only known-good commits into a clean branch.

## Definition of Done (per branch)

- Build passes.
- Lint passes.
- No broken primary flow introduced.
- Any UX text/control changes are consistent with surrounding UI.
- Notes added to project status docs when scope changes.
