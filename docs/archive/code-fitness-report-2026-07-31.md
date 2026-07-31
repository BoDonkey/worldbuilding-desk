# Code Fitness Report — worldbuilding-desk

**Date:** 2026-07-31 · **Branch:** `codex/fitness-slice-17-final-audit` at `a2dca52`
**Scope:** apps/web, apps/desktop, packages/rules-engine, packages/rules-ui (~73,886 lines of TypeScript)
**Baseline:** [code-fitness-report-2026-07-24.md](code-fitness-report-2026-07-24.md), grade B

> **Disposition (2026-07-31, same day):** An immediate follow-up upgraded the app from `react-router-dom` 7.18.1 to `react-router` 8.3.0, raised React/React DOM to 19.2.8, migrated imports to the v8 package entry points, and pinned CI to React Router's Node 22.22.0 minimum. `pnpm audit --prod` now reports 0 vulnerabilities; web lint, all 250 unit tests, the production build, and all 42 Cypress tests pass. The B+ grade and findings below preserve the point-in-time close-out audit; the remaining top issues are route size and breaking-major toolchain drift.
>
> **Post-plan follow-up:** Scene-roster and positioned-state-mutation orchestration moved from `WorkspaceRoute.tsx` into the cohesive `useWorkspaceSceneRoster` hook. The route fell from 4,084 to 3,424 lines; the new hook is 989 lines. No markup or styling changed, and web lint, all 250 unit tests, the production build, and all 42 Cypress tests pass.
>
> World Bible project-data lifecycle orchestration subsequently moved into `useWorldBibleProjectData`: category/entity/alias loading, character and scene health data, lore links, compendium links, RAG/Shodh services, memories, and series-canon sync state. `WorldBibleRoute.tsx` fell from 4,045 to 3,736 lines; the new hook is 376 lines. No markup or styling changed, and the same full verification battery passes.
>
> Selected-entity health and lore orchestration then moved into `useWorldBibleSelectedEntity`: canonical aliases/facts, scene mentions, mutation history, character context probing, and linked Source Note creation. `WorldBibleRoute.tsx` fell again from 3,736 to 3,534 lines; the new hook is 343 lines. No markup or styling changed, and the same full verification battery passes.

## Overall grade: B+ (up from B)

The fitness program materially improved the repository: Electron is supported, React ownership is correct, unsafe external protocols are blocked, package-manager hygiene is clean, the root test command is real, rules-ui has its own lint and tests, and CI blocks on unit, package, build, and Cypress checks. The tested surface grew from 193 unit tests at baseline to 250, plus 42 Cypress tests.

This is not yet grade A. A live production audit reports one high-severity React Router advisory whose listed fix requires React Router 8.3.0, three of the five targeted architecture files remain above 2,000 lines, and recursive outdated checking still shows several breaking-major upgrades besides Zod 4. Those misses are recorded as the new top issues rather than rounded up.

| Area | Jul 24 | Now | Change |
|---|---|---|---|
| Type safety & build | A− | A | Web and desktop builds pass; package builds remain covered by the workspace graph |
| Tests | B− | A− | 250 unit tests pass (232 web + 6 engine + 12 rules-ui), including 9 route smoke tests; 42 Cypress tests pass |
| Lint | A− | A | Web lint passes and rules-ui owns and runs its ESLint toolchain |
| Dependencies | C+ | B− | Electron and the transformer stack are current, but one high React Router advisory and multiple breaking-major upgrades remain |
| Architecture | B− | B | Targeted files fell by 3,481 lines (19.8%); Compendium and the consistency hook meet the target, but three routes do not |
| Security | B+ | B+ | External URL protocols are guarded and the old transformer findings are gone; the React Router advisory prevents an A |
| CI | A− | A | Web lint/tests/build, both rules-package suites, desktop build, and Cypress are blocking jobs |
| Repo hygiene | B | A | No tracked npm lockfiles; TipTap dependencies belong to apps/web; root scripts are functional |

## Grade-A criteria

| # | Criterion | Result | Actual |
|---|---|---|---|
| 1 | `pnpm audit --prod` reports 0 | **Miss** | 1 high vulnerability: `react-router` via `react-router-dom`, [GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2). The audit lists versions `>=7.12.0 <8.3.0` as vulnerable and `>=8.3.0` as patched. |
| 2 | Electron is on a supported major | **Pass** | `apps/desktop` resolves Electron 43.2.0. Electron supports its latest three stable majors; the [official schedule](https://releases.electronjs.org/schedule) lists Electron 43 as stable through 2027-01-05. |
| 3 | rules-ui keeps React peer-only | **Pass** | React and React DOM are peers at `^18.0.0 || ^19.0.0`; React 19 appears only in devDependencies for standalone development. |
| 4 | `shell.openExternal` is protocol-guarded | **Pass** | The sole call site goes through `openExternalIfSafe`, which parses the URL and permits only `https:` and `http:`. |
| 5 | No tracked `package-lock.json` | **Pass** | `git ls-files '*package-lock.json'` returns no files. |
| 6 | TipTap dependencies live in apps/web | **Pass** | All four `@tiptap/*` declarations are in `apps/web/package.json`; none are declared at the root. |
| 7 | Root tests and rules-ui lint are real | **Pass** | Root `pnpm test` runs all three workspace suites. rules-ui runs `eslint src/**/*.{ts,tsx}` using its own ESLint dependencies. |
| 8 | Targeted files are below 2,000 lines | **Partial** | CompendiumRoute (1,590) and useWorkspaceConsistency (1,990) meet the target. WorkspaceRoute (4,084), WorldBibleRoute (4,045), and CharacterSheetsRoute (2,374) remain above it. |
| 9 | Tests pass and CI blocks on them plus Cypress | **Pass** | All 250 unit tests pass; the 9 route smoke tests pass as part of web. CI has blocking web, rules-package, desktop-build, and Cypress jobs. The latest Cypress run on this revision passed 8 specs / 42 tests. |
| 10 | No undeferred major-version drift besides Zod 4 | **Miss** | `pnpm outdated -r` also reports breaking majors for ESLint, `@eslint/js`, TypeScript, Vite, Cypress, `@vitejs/plugin-react`, `@types/node`, globals, and eslint-plugin-react-refresh. These require staged compatibility work and are not a Zod-only exception. |

## New top issues

| # | Issue | Priority | Close-out condition |
|---|---|---|---|
| 1 | React Router production advisory | **High** | Upgrade to a patched React Router line (the live audit currently lists 8.3.0+) and return `pnpm audit --prod` to 0 after the full unit/build/Cypress battery. |
| 2 | Three oversized route components | **Medium** | Continue behavior-preserving extraction until WorkspaceRoute, WorldBibleRoute, and CharacterSheetsRoute are each below 2,000 lines. |
| 3 | Breaking-major toolchain drift | **Medium** | Upgrade and verify the remaining majors in bounded groups; keep Zod 4 as a separately planned application-schema migration. |

## Verified results (2026-07-31)

- **Root tests:** `pnpm test` passes — web 48 files / 232 tests; rules-engine 2 files / 6 tests; rules-ui 6 files / 12 tests.
- **Route smoke tests:** 1 file / 9 tests passes in 3.90s.
- **Cypress:** 8 specs / 42 tests passed on the same source revision during Slice 16.
- **Lint/build:** rules-ui lint and desktop build pass; the web lint and build battery passed on the same source revision during Slice 16.
- **Audit (prod):** 1 high vulnerability, React Router only. The former protobufjs/sharp transformer subtree findings are gone.
- **Electron:** 43.2.0 is the latest stable major listed by Electron Releases on the audit date and is within the official three-major support window.
- **Dependency drift:** safe minor/patch updates remain available, plus the breaking-major groups listed above. `@types/mathjs` is also reported as deprecated.

## Architecture notes

Against the July 24 baseline, the five targeted files fell from 17,564 to 14,083 lines:

| File | Jul 24 | Now | Change | Target |
|---|---:|---:|---:|---|
| WorkspaceRoute.tsx | 4,722 | 4,084 | −638 (−13.5%) | Miss |
| WorldBibleRoute.tsx | 4,465 | 4,045 | −420 (−9.4%) | Miss |
| CompendiumRoute.tsx | 3,118 | 1,590 | −1,528 (−49.0%) | Pass |
| CharacterSheetsRoute.tsx | 2,812 | 2,374 | −438 (−15.6%) | Miss |
| useWorkspaceConsistency.ts | 2,447 | 1,990 | −457 (−18.7%) | Pass |

The extraction pattern is sound: presentation panels moved into typed components, pure route and consistency logic moved into named service modules, and focused tests grew alongside the seams. The remaining problem is concentration, not a failed approach. WorkspaceRoute and WorldBibleRoute still need larger state/orchestration boundaries rather than more very small visual extractions.

## Suggested order of attack

Address the React Router advisory first because it is the only production audit finding. Treat the required v8 move as a bounded compatibility slice with route smoke, full unit, build, and Cypress verification. Next, split WorkspaceRoute and WorldBibleRoute around cohesive state/command domains, then finish CharacterSheetsRoute. Upgrade the remaining toolchain majors in separate groups so failures are attributable; keep the Zod 4 schema migration explicitly separate.
