> **Archived 2026-08-01.** Open slices absorbed into `docs/road-to-market.md` Phases 0 and 3; full agent prompts remain here.

# Road to Grade A — Work Slices

**Date:** 2026-08-01 · **Baseline:** [code-fitness-report-2026-08-01.md](code-fitness-report-2026-08-01.md) (grade A−)
**Repo state when written:** `main` at `4b33eed`, clean and in sync with origin.

Each slice is a discrete, PR-sized unit of work with a self-contained prompt an LLM agent (Claude Code / Codex with repo access) can execute. Phases are ordered by dependency; slices within Phase 1 can run in parallel, but Phase 2 slices must run **sequentially** so failures stay attributable to one upgrade group.

Two standing constraints apply to every slice, matching the discipline that made the fitness-100 plan work:

1. **Behavior-preserving only.** No markup, styling, or user-visible behavior changes in extraction slices. No rule-set or config semantics changes in upgrade slices beyond what the upgrade requires.
2. **Full battery before commit.** Every slice runs the verification commands below and reports the counts in its commit message.

## Verification commands (referenced by every prompt)

```bash
pnpm --filter web lint          # 0 errors expected (3 exhaustive-deps warnings are the known baseline)
pnpm --filter web test:unit     # 232+ tests
pnpm --filter @litrpg-tool/rules-engine test   # 6+ tests
pnpm --filter @litrpg-tool/rules-ui test       # 12+ tests
pnpm --filter web build         # tsc -b && vite build
pnpm --filter desktop build     # desktop tsc
```

Cypress (8 specs / 42 tests) runs as a blocking CI job; run `pnpm --filter web e2e:run` locally for slices touching route UI or the Vite/Cypress toolchain.

## Slice index

| # | Slice | Phase | Est. size |
|---|---|---|---|
| 0 | Branch and worktree cleanup | 0 — Hygiene | XS |
| 1 | WorkspaceRoute: extract drawer/context orchestration | 1 — Architecture | M |
| 2 | WorkspaceRoute: final pass to <2,000 lines | 1 | M |
| 3 | WorldBibleRoute: final pass to <2,000 lines | 1 | M |
| 4 | CharacterSheetsRoute: extract to <2,000 lines | 1 | S |
| 5 | ESLint 10 group upgrade | 2 — Toolchain majors | M |
| 6 | Vite 8 + @vitejs/plugin-react 6 | 2 | S |
| 7 | Cypress 15 | 2 | S |
| 8 | TypeScript 7 | 2 | M |
| 9 | Dev-audit sweep + close-out audit | 3 — Close-out | S |

**Explicitly deferred:** Zod 4 remains a separately planned application-schema migration — all three workspaces share `zod ^3.25.76` and the migration touches runtime validation semantics, not just types. Do not fold it into any slice here.

## Execution status

Update this table as slices land. Slices not listed have not started.

| Slice | Status | Evidence / coordination note |
|---|---|---|
| — | — | — |

---

## Phase 0 — Hygiene

### Slice 0: Branch and worktree cleanup

**Prompt:**

> In worldbuilding-desk on `main`, delete every local branch already merged to main (`git branch --merged main` — 57 are `codex/*` slice branches from the completed fitness-100 plan), prune stale worktrees (`git worktree prune` removes 8 prunable `~/.codex/worktrees/*` entries; the locked `.worktrees/ui-fixes` worktree stays), and delete merged remote branches on origin. Do NOT delete: `main`, any branch not fully merged to main (check `git branch --no-merged main` first and list them in the commit/PR description), or the locked ui-fixes worktree. This slice changes no source files; no verification battery needed beyond `git status` staying clean.

---

## Phase 1 — Architecture

The extraction pattern is proven — follow the precedent of `useWorkspaceCommands`, `useWorkspaceSceneRoster`, `useWorldBibleProjectData`, `useWorldBibleSelectedEntity`, `useWorldBibleAuthoringAssistant`, and `useWorldBibleRecordResolution` in git history (commits `af13eb2` through `333c495`). Each extraction moves a cohesive state/orchestration domain into a named hook or a tested pure service module, preserves the route's markup and CSS untouched, and lands with the full battery green.

**Anti-goal for this phase:** do not create new god files. `useWorldBibleImports` (1,631 lines), LoreRoute (1,733), and `useWorkspaceSceneRoster` (989) are already the next tier of large files — extracted hooks should stay under ~600 lines; if a seam produces more, split it into hook + pure service module with tests, as Slice 16 of the previous plan did.

### Slice 1: WorkspaceRoute — extract drawer/context orchestration

**Prompt:**

> In worldbuilding-desk, `apps/web/src/routes/WorkspaceRoute.tsx` is 3,424 lines; target for this slice is roughly 2,600–2,800. The command dispatcher (`useWorkspaceCommands`), scene roster (`useWorkspaceSceneRoster`), and consistency hook are already extracted — read those hooks and commits `af13eb2`/`8cd07be` first to match the pattern. Extract the next cohesive orchestration domain: the drawer/context-panel state and wiring that remains in the route (open/close state, panel selection, focus handoff, and the props plumbing into `WorkspaceContextDrawer` and the scene drawer). Keep all markup and CSS-module usage in the route or existing components — extract state and handlers only, into a `useWorkspaceDrawers`-style hook (or whatever name matches the domain you find). Pure logic with branching goes into a tested service module under the existing workspace services directory. No user-visible behavior changes. Run the full verification battery plus Cypress locally (`pnpm --filter web e2e:run`); report before/after line counts in the commit message.

### Slice 2: WorkspaceRoute — final pass to <2,000 lines

**Prompt:**

> In worldbuilding-desk, continue behavior-preserving extraction on `apps/web/src/routes/WorkspaceRoute.tsx` (should be ~2,600–2,800 lines after the drawer-orchestration slice; check first) until it is **below 2,000 lines**. Inventory what remains — likely candidates are stat-block wiring beyond `useWorkspaceStatBlocks`, capture/annotation orchestration, and editor integration state — and pick the largest cohesive domains. Same rules as the previous slice: hooks for stateful orchestration, tested pure service modules for branching logic, no markup/CSS changes, extracted hooks under ~600 lines each. If the last few hundred lines are irreducible route-owned state and JSX, record the honest floor in the commit message rather than forcing a degenerate extraction — but 2,000 is expected to be reachable given WorldBibleRoute's trajectory. Full battery plus local Cypress; report before/after line counts.

### Slice 3: WorldBibleRoute — final pass to <2,000 lines

**Prompt:**

> In worldbuilding-desk, `apps/web/src/routes/WorldBibleRoute.tsx` is 3,011 lines; target **below 2,000**. Five hooks are already extracted (project data, selected entity, authoring assistant, record resolution, plus `useWorldBibleEntityActions`) — read them and commits `26e8b32`/`227ac60`/`a736f27`/`333c495` to match the pattern and avoid re-extracting what's done. Inventory the remaining ~1,000 lines to remove: likely candidates are category/section navigation state, entry-list filtering and selection, and remaining dialog/confirmation orchestration. Same rules: behavior-preserving, hooks under ~600 lines, pure logic into tested services, no markup/CSS changes. Note `useWorldBibleImports` is already 1,631 lines — do not add to it; if import-adjacent logic needs a home, split into a new focused module. Full battery plus local Cypress; report before/after line counts.

### Slice 4: CharacterSheetsRoute — extract to <2,000 lines

**Prompt:**

> In worldbuilding-desk, `apps/web/src/routes/CharacterSheetsRoute.tsx` is 2,374 lines; target **below 2,000**. One extraction pass has landed (mutation composer + character service, commit `b20a586`, and the mutation-UI extraction in the same series) — read it first. The route still owns state, preview, and mutation-history orchestration per that slice's close-out note. Extract the mutation-preview/history orchestration into a hook, and move any remaining pure helpers (formatting, diff/summary construction) into the existing tested character service. Behavior-preserving, no markup/CSS changes. This is the smallest gap in the phase (~400 lines) — resist over-extracting past the target. Full battery plus local Cypress; report before/after line counts.

---

## Phase 2 — Toolchain majors

Run these **one at a time, in order**, each as its own PR with the full battery. If a slice's upgrade breaks something that cannot be fixed within the slice's scope, pin back, document why in the commit, and move on — do not let one group block the others.

### Slice 5: ESLint 10 group upgrade

**Prompt:**

> In worldbuilding-desk, upgrade the ESLint toolchain as one group across all three workspaces that declare it (web, rules-engine, rules-ui): `eslint` 9.39.5 → 10.x, `@eslint/js` → 10.x, `globals` 16.x → 17.x, `eslint-plugin-react-refresh` 0.4.x → 0.5.x, and `eslint-plugin-react-hooks` 7.0.1 → 7.1.x. Read the ESLint 10 migration guide first (flat config is already in use; check for removed rule options and Node version requirements — CI pins Node 22.22.0, confirm compatibility). Known landmine from the previous plan: react-hooks 7.1 was pinned out in July because its new compiler-based rules exposed **14 existing violations** — this slice must either fix those violations (preferred, if they are localized) or explicitly configure the new rules off with a comment explaining the deferral; do not silently downgrade severity. Also upgrade `typescript-eslint` if required for ESLint 10 peer compatibility. Baseline: web lint currently exits 0 with 3 `exhaustive-deps` warnings. After the upgrade, lint must exit 0 across all three packages; warning count may change but every new warning must be listed in the commit message. Full battery; no source changes beyond lint-driven fixes.

### Slice 6: Vite 8 + @vitejs/plugin-react 6

**Prompt:**

> In worldbuilding-desk, upgrade `apps/web` from Vite 7.3.6 → 8.x and `@vitejs/plugin-react` 5.1.3 → 6.x together. Read both changelogs for breaking changes (Node version floor — CI pins 22.22.0; changed config options; environment API changes that could affect the Vitest setup, since Vitest shares the Vite config). Note the dev-audit findings in esbuild/rollup/postcss chains should shrink after this — run `pnpm audit` (without `--prod`) before and after and record the delta in the commit message. Do NOT bump `@types/node` to 26 as part of this slice — the runtime is Node 22 and types should track the runtime; leave it at 24.x unless Vite 8 explicitly requires otherwise. Verify the dev server starts (`pnpm --filter web dev`), the production build output loads in the desktop shell (`pnpm build:web && pnpm --filter desktop start`), and run the full battery plus local Cypress.

### Slice 7: Cypress 15

**Prompt:**

> In worldbuilding-desk, upgrade `apps/web` Cypress 14.5.4 → 15.x. Read the Cypress 15 migration guide (check Node floor against CI's pinned 22.22.0, config file schema changes, and any changed behavior in `cy` commands used by the 8 specs under the web e2e directory). Update the CI workflow's `cypress install` step if the cache/binary handling changed. All 42 tests must pass locally via `pnpm --filter web e2e:run` and in the cypress-smoke CI job. Record `pnpm audit` (dev) before/after counts — the tmp/form-data findings sit in Cypress's chain. Full battery.

### Slice 8: TypeScript 7

**Prompt:**

> In worldbuilding-desk, upgrade TypeScript 5.9.3 → 7.x across all four workspaces (web, desktop, rules-engine, rules-ui — note rules packages declare `^5.3.0`). This runs LAST in the toolchain phase because ecosystem compatibility is the risk: before starting, verify that the already-upgraded ESLint/typescript-eslint and Vite versions support TS 7, and check `@tiptap/*`, `zod` 3.x, and Electron's bundled types for compatibility statements. Read the TS 6/7 migration notes for every breaking change between 5.9 and the target (deprecated compiler options removed in 6.0 are the most likely hit — audit all `tsconfig*.json` files first). Fix compile errors mechanically; if a fix would change runtime behavior, stop and flag it in the PR rather than guessing. If TS 7 is not yet viable for a hard dependency, land TS 6.x instead and record the blocker. Full battery plus local Cypress; desktop build and `pnpm package:desktop:dir` must pass.

---

## Phase 3 — Close-out

### Slice 9: Dev-audit sweep + close-out audit

**Prompt:**

> In worldbuilding-desk, after Phases 1–2 land: (1) run `pnpm audit` (without `--prod`) — the 2026-08-01 baseline was 33 findings (24 high / 7 moderate / 2 low), all in dev-tool chains; list survivors and fix each via targeted `pnpm.overrides` in the root package.json or a dependency bump, documenting any accepted-risk remainder; (2) confirm `pnpm audit --prod` is still 0; (3) re-verify the ten grade-A criteria from `docs/code-fitness-report-2026-08-01.md` (file line counts, Electron support window at audit date, peer-dep shape, lockfile absence, tiptap ownership, root scripts, CI blocking jobs); (4) write `docs/code-fitness-report-<date>.md` following the existing report format, with honest misses recorded rather than rounded up, and move the 2026-08-01 report to `docs/archive/`; (5) update the execution-status table in this file and archive this plan if all slices are complete. Full battery plus Cypress.
