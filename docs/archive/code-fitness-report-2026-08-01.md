> **Archived 2026-08-01.** Superseded by
> [code-fitness-report-2026-08-07.md](code-fitness-report-2026-08-07.md).

# Code Fitness Report — worldbuilding-desk

**Date:** 2026-08-01 · **Branch:** `main` at `4b33eed` (clean, in sync with origin)
**Scope:** apps/web, apps/desktop, packages/rules-engine, packages/rules-ui (~76,792 lines of TypeScript)
**Baseline:** [archive/code-fitness-report-2026-07-31.md](archive/code-fitness-report-2026-07-31.md), grade B+

## Overall grade: A− (up from B+)

The fitness-100 work plan closed out its two highest-priority items since the July 31 audit. The React Router production advisory is resolved — `pnpm audit --prod` now reports **0 vulnerabilities** — and the post-plan extraction work removed another 1,694 lines from the targeted architecture files. Every hygiene and security criterion from the plan holds on main: guarded `shell.openExternal`, loopback-bound dev proxy with a CORS allowlist, no tracked npm lockfiles, TipTap owned by apps/web, rules-ui React peer-only, real root test script, and CI blocking on lint, unit tests, builds, and Cypress.

What keeps this from grade A: three of the five targeted files remain above 2,000 lines, breaking-major toolchain drift has widened (TypeScript 7, ESLint 10, Vite 8, Cypress 15 are now out), and the dev-dependency audit surfaces 33 vulnerabilities in test/build tooling chains that those same major upgrades would largely clear.

| Area | Jul 31 | Now | Change |
|---|---|---|---|
| Type safety & build | A | A | `tsc -b`, Vite production build, desktop build, and both package builds pass |
| Tests | A− | A− | All 250 unit tests pass (232 web + 6 engine + 12 rules-ui); Cypress covered by blocking CI |
| Lint | A | A | Web lint passes with 0 errors (3 `exhaustive-deps` warnings) |
| Dependencies | B− | B | Production audit is clean; breaking-major drift persists and grew |
| Architecture | B | B+ | Targeted files fell another 1,694 lines; 3 of 5 still exceed the 2,000-line target |
| Security | B+ | A | `pnpm audit --prod` reports 0; external URLs protocol-guarded; dev proxy loopback-only |
| CI | A | A | web-verify, desktop-verify, and cypress-smoke jobs all block, pinned to Node 22.22.0 |
| Repo hygiene | A | A− | Package hygiene holds, but 57 merged `codex/*` branches and 8 prunable worktrees linger |

## Grade-A criteria

| # | Criterion | Result | Actual |
|---|---|---|---|
| 1 | `pnpm audit --prod` reports 0 | **Pass** | 0 known vulnerabilities. React Router 8.3.0 resolves GHSA-qwww-vcr4-c8h2. |
| 2 | Electron on a supported major | **Pass** | Electron 43.2.0; `pnpm outdated` reports no newer release, and 43 is supported through 2027-01-05. |
| 3 | rules-ui keeps React peer-only | **Pass** | Peers at `^18.0.0 \|\| ^19.0.0`; React 19.2.8 only in devDependencies. |
| 4 | `shell.openExternal` protocol-guarded | **Pass** | Sole call site routes through `openExternalIfSafe` (https/http only). |
| 5 | No tracked `package-lock.json` | **Pass** | `git ls-files '*package-lock.json'` returns nothing. |
| 6 | TipTap dependencies live in apps/web | **Pass** | Only `apps/web/package.json` declares `@tiptap/*`. |
| 7 | Root tests and rules-ui lint are real | **Pass** | Root `pnpm test` chains all three suites; rules-ui owns its ESLint toolchain. |
| 8 | Targeted files below 2,000 lines | **Partial** | CompendiumRoute (1,590) and useWorkspaceConsistency (1,990) pass. WorkspaceRoute (3,424), WorldBibleRoute (3,011), and CharacterSheetsRoute (2,374) do not. |
| 9 | Tests pass and CI blocks on them plus Cypress | **Pass** | 250/250 unit tests pass in this audit; cypress-smoke is a blocking CI job (not re-run in the audit sandbox). |
| 10 | No undeferred major-version drift besides Zod 4 | **Miss** | Breaking majors outstanding: TypeScript 7.0.2, ESLint 10.8.0, `@eslint/js` 10.0.1, Vite 8.2.0, Cypress 15.19.0, `@vitejs/plugin-react` 6.0.5, `@types/node` 26.1.2, globals 17.8.0, eslint-plugin-react-refresh 0.5.3, plus Zod 4.4.3. |

## Verified results (2026-08-01, sandbox on main @ 4b33eed)

- **Install:** `pnpm install --frozen-lockfile` succeeds (pnpm 10.15.0, Node 22.22.3).
- **Builds:** rules-engine, rules-ui, web `tsc -b`, web Vite production build, and desktop `tsc` all pass.
- **Tests:** web 48 files / 232 tests, rules-engine 6 tests, rules-ui 12 tests — all pass.
- **Lint:** web ESLint exits 0 with 3 warnings (`react-hooks/exhaustive-deps` in ConsumableEffectEditor and two others).
- **Audit (prod):** 0 vulnerabilities.
- **Audit (dev included):** 33 vulnerabilities (24 high, 7 moderate, 2 low), all in dev-tool transitive chains — minimatch, brace-expansion, `@xmldom/xmldom`, flatted, lodash, postcss, rollup, tmp, form-data, js-yaml, picomatch, uuid, esbuild, `@babel/core`. None ship to production.
- **Drift:** safe minor/patch updates available (TipTap 3.29.2, prosemirror-view, zustand, immer, `@types/react*`); `@types/mathjs` remains deprecated.
- **Not re-run here:** Cypress (blocking in CI; last known green on the predecessor revision).

## Architecture progress

Cumulative movement on the five targeted files:

| File | Jul 24 | Jul 31 | Now | Target |
|---|---:|---:|---:|---|
| WorkspaceRoute.tsx | 4,722 | 4,084 | 3,424 | Miss |
| WorldBibleRoute.tsx | 4,465 | 4,045 | 3,011 | Miss |
| CompendiumRoute.tsx | 3,118 | 1,590 | 1,590 | Pass |
| CharacterSheetsRoute.tsx | 2,812 | 2,374 | 2,374 | Miss |
| useWorkspaceConsistency.ts | 2,447 | 1,990 | 1,990 | Pass |
| **Total** | **17,564** | **14,083** | **12,389** | −29.5% from baseline |

The hook-extraction pattern (scene roster, project data, selected entity, authoring assistant, record resolution) is working: WorldBibleRoute lost over 1,000 lines in a week with a green verification battery at every step. The next natural seams follow the same shape — WorkspaceRoute still concentrates drawer/command/consistency orchestration, and CharacterSheetsRoute has had only one extraction pass. Watch the extracted hooks themselves: `useWorkspaceSceneRoster` (989), `useWorldBibleImports` (1,631), and LoreRoute (1,733) are the next tier of large files.

## New top issues

| # | Issue | Priority | Close-out condition |
|---|---|---|---|
| 1 | Three oversized route components | **Medium** | Continue behavior-preserving extraction until WorkspaceRoute, WorldBibleRoute, and CharacterSheetsRoute are each below 2,000 lines. |
| 2 | Breaking-major toolchain drift | **Medium** | Upgrade in bounded groups (ESLint 10 + plugins; Vite 8 + plugin-react 6; Cypress 15; TypeScript 7 last, as the ecosystem settles). This also clears most of the 33 dev-audit findings. Keep Zod 4 as a separate application-schema migration. |
| 3 | Dev-dependency audit findings | **Low** | Re-run `pnpm audit` (without `--prod`) after the toolchain upgrades; chase any survivors individually. |
| 4 | Branch and worktree cleanup | **Low** | Delete the 57 merged `codex/*` branches, prune 8 stale worktrees (`git worktree prune`), and remove merged remote branches. |

## Suggested order of attack

Nothing here is urgent — production security is clean and everything blocks in CI. Take the branch/worktree cleanup first since it is five minutes of work. Then continue the proven extraction cadence on WorkspaceRoute (drawer and command orchestration are the obvious next hooks), CharacterSheetsRoute, and WorldBibleRoute's last thousand lines. Run the toolchain majors as separate bounded slices once the architecture target is met, so failures stay attributable; TypeScript 7 and Zod 4 last.
