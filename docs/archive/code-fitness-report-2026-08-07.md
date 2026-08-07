# Code Fitness Report — worldbuilding-desk

**Date:** 2026-08-07 · **Branch:** `main` after roadmap slice 3.9 remediation
**Scope:** apps/web, apps/desktop, packages/rules-engine, packages/rules-ui (75,825 lines of TypeScript)
**Baseline:** [code-fitness-report-2026-08-01.md](code-fitness-report-2026-08-01.md), grade A−

## Overall grade: A (up from A−)

The Grade-A fitness plan has reached its intended close-out. All five targeted
architecture files are below 2,000 lines, the four planned toolchain-major
groups have landed, both production and full development dependency audits
report zero known vulnerabilities, and the complete local verification battery
passes. The existing three web `exhaustive-deps` warnings remain documented;
the wider React Compiler findings remain explicitly deferred for
behavior-aware refactors rather than being hidden or mechanically changed.

| Area | Aug 1 | Now | Change |
|---|---|---|---|
| Type safety & build | A | A | Native TypeScript 7 builds all four workspaces; TypeScript 6 compatibility API remains side-by-side for `typescript-eslint` |
| Tests | A− | A | 289/289 unit tests and 43/43 Cypress tests pass locally |
| Lint | A | A | All three lint-owning workspaces pass; web retains 3 known warnings and 0 errors |
| Dependencies | B | A | Planned majors landed; full audit fell from 33 findings at baseline, then 29 survivors, to 0 |
| Architecture | B+ | A | All five targeted files are below 2,000 lines |
| Security | A | A | Production and development audits are both clean; external URL guard remains intact |
| CI | A | A | `web-verify`, `desktop-verify`, and `cypress-smoke` remain blocking jobs on relevant changes |
| Repo hygiene | A− | A | Merged branch/worktree cleanup landed; the locked UI worktree and unmerged branches remain intentionally preserved |

## Grade-A criteria

| # | Criterion | Result | Actual |
|---|---|---|---|
| 1 | `pnpm audit --prod` reports 0 | **Pass** | 0 known vulnerabilities on 2026-08-07. |
| 2 | Electron on a supported major | **Pass** | Electron 43.2.0 is in the supported 43 line; Electron supports its latest three stable majors and lists 43 EOL as 2027-01-05. |
| 3 | rules-ui keeps React peer-only | **Pass** | React and React DOM peers accept 18 or 19; React 19.2.8 is development-only in the package. |
| 4 | `shell.openExternal` protocol-guarded | **Pass** | The sole call site still routes through `openExternalIfSafe`, allowing only HTTP(S). |
| 5 | No tracked `package-lock.json` | **Pass** | `git ls-files '*package-lock.json'` returns nothing. |
| 6 | TipTap dependencies live in apps/web | **Pass** | Only `apps/web/package.json` declares `@tiptap/*`. |
| 7 | Root tests and rules-ui lint are real | **Pass** | Root test chains all three suites; root lint runs engine, UI, and web lint; rules-ui owns its ESLint toolchain. |
| 8 | Targeted files below 2,000 lines | **Pass** | WorkspaceRoute 1,993; WorldBibleRoute 1,957; CompendiumRoute 1,546; CharacterSheetsRoute 1,955; useWorkspaceConsistency 1,990. |
| 9 | Tests pass and CI blocks on them plus Cypress | **Pass** | 289/289 unit tests and 43/43 Cypress tests pass locally; all remain represented in the three CI jobs. |
| 10 | No undeferred major-version drift besides Zod 4 | **Pass** | ESLint 10, Vite 8, Cypress 15, and TypeScript 7 landed. Zod 4 remains explicitly deferred; `@types/node` stays on 24 to track the Node 22 runtime rather than the registry's Node 26 types. |

Electron evidence: [support policy](https://www.electronjs.org/docs/latest/tutorial/electron-timelines)
and [release schedule](https://releases.electronjs.org/schedule).

## Dependency audit close-out

The 2026-08-01 baseline contained 33 development findings (24 high, 7
moderate, 2 low). After the planned toolchain upgrades, the first 2026-08-07
audit contained 29 findings (23 high, 5 moderate, 1 low), all in ESLint/Babel
or Electron Builder development chains.

Targeted root `pnpm.overrides` moved every survivor to a patched compatible
release:

- ESLint/Babel chain: `@babel/core`, `flatted`.
- Electron Builder chain: `@xmldom/xmldom`, `brace-expansion` 1/2/5,
  `fast-uri`, `form-data`, `js-yaml`, `lodash`, `minimatch` 9, `picomatch`,
  and `tmp`.

After the overrides, `pnpm audit` and `pnpm audit --prod` both report zero
known vulnerabilities. There is no accepted-risk advisory remainder.

## Verified results (2026-08-07)

- **Install:** `pnpm install --frozen-lockfile` succeeds with pnpm 10.15.0.
- **Builds:** rules-engine, rules-ui, web TypeScript/Vite production build,
  and desktop TypeScript build pass.
- **Tests:** web 57 files / 271 tests, rules-engine 2 files / 6 tests,
  rules-ui 6 files / 12 tests, and Cypress 9 specs / 43 tests all pass.
- **Lint:** root lint exits 0; engine and rules-ui are clean, and web has 0
  errors with the same 3 `react-hooks/exhaustive-deps` warnings.
- **Audit:** full development and production-only audits both report 0.
- **Drift:** only patch/minor updates are available apart from intentionally
  held `@types/node` 24, explicitly deferred Zod 4, and deprecated
  `@types/mathjs` (mathjs already provides its own declarations).

## Architecture close-out

| File | Jul 24 | Aug 1 | Now | Result |
|---|---:|---:|---:|---|
| WorkspaceRoute.tsx | 4,722 | 3,424 | 1,993 | Pass |
| WorldBibleRoute.tsx | 4,465 | 3,011 | 1,957 | Pass |
| CompendiumRoute.tsx | 3,118 | 1,590 | 1,546 | Pass |
| CharacterSheetsRoute.tsx | 2,812 | 2,374 | 1,955 | Pass |
| useWorkspaceConsistency.ts | 2,447 | 1,990 | 1,990 | Pass |
| **Total** | **17,564** | **12,389** | **9,441** | **−46.2% from Jul 24** |

The extraction work preserved route behavior while establishing focused hooks,
services, and tests. Large files still deserve normal incremental maintenance,
especially `useWorldBibleImports`, but none is an emergency architecture gap
or a missed criterion in this plan.

## Remaining planned work

- Zod 4 remains a separate runtime-schema migration and is intentionally not
  part of the fitness close-out.
- The 77 explicitly deferred React Compiler findings require behavior-aware
  refactors; they are not lint regressions introduced by the toolchain work.
- `@types/mathjs` is deprecated and redundant with mathjs's bundled types; its
  removal can be handled as a small maintenance task without blocking v1.
- Product-completeness and release-engineering work continues in roadmap
  Phases 4–6.
