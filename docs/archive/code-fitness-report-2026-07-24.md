# Code Fitness Report — worldbuilding-desk

> Archived 2026-07-26. This is a dated audit baseline; active engineering work
> is tracked in `docs/archive/fitness-100-work-slices.md` and `docs/next-steps.md`.

**Date:** 2026-07-24 · **Branch:** `codex/ci-trust-gates` (clean tree)
**Scope:** apps/web, apps/desktop, packages/rules-engine, packages/rules-ui (~70,800 lines of TypeScript)
**Baseline:** [code-fitness-report-2026-07-19.md](code-fitness-report-2026-07-19.md)

> **Disposition (2026-07-24, same day):** After this audit, a follow-up dependency pass resolved issues #1 (partially), #6, #7, and the proxy half of #8. Prod vulnerabilities went 30 → 13 via in-range bumps (react-router-dom 7.18.1, mathjs 15.2.0, express subtree) plus root pnpm overrides for qs/path-to-regexp/body-parser; those 13 findings were all protobufjs/sharp via `@xenova/transformers` (no in-range fix; Node-only code paths — accepted risk until a `@huggingface/transformers` migration). A pre-commit recheck on 2026-07-25 reports 14: the same 13 plus a newly published React Router high-severity advisory whose only listed patched line is 8.3.0+. tiptap deps moved into apps/web; the three stray package-lock.json files were deleted; `proxy-server.ts` was hardened (binds 127.0.0.1, CORS restricted to Vite dev origins, input validation, try/catch, client-disconnect cleanup). All changes verified against unit tests, lint, `tsc -b`, and the vite build. Still open: Electron EOL (#2), React 18/19 split (#3), god components (#5), and the `openExternal` allowlist half of #8.

## Overall grade: B (up from B−)

The update fixed the two process problems — CI is now a real gate and lint is clean — and the new feature code follows the right pattern (logic in tested service modules). The remaining drag is unchanged from July 19: dependency vulnerabilities, EOL Electron, the React 18/19 split, and the god-component routes.

| Area | Jul 19 | Now | Change |
|---|---|---|---|
| Type safety & build | A− | A− | `tsc -b` clean for web, desktop, both packages |
| Tests | B− | B− | 193 unit tests pass (187 web + 6 engine); coverage still lopsided |
| Lint | B | A− | **Fixed** — 0 errors, 3 warnings (was 5 errors) |
| Dependencies | C+ | C+ | Unchanged — 30 prod vulns (1 critical), EOL Electron, React split |
| Architecture | B− | B− | Layout unchanged; new code well-factored, old giants untouched |
| Security | B+ | B+ | Unchanged — proxy and `openExternal` findings still open |
| CI | C+ | A− | **Fixed** — unit tests, engine tests, desktop build, blocking Cypress |
| Repo hygiene | B | B | Stray npm lockfiles and phantom tiptap deps remain |

## Status of the July 19 top issues

| # | Issue | Status |
|---|---|---|
| 1 | Prod dependency vulnerabilities | **Open.** `pnpm audit --prod`: 30 vulns — critical protobufjs; high mathjs, react-router, path-to-regexp, sharp. `react-router-dom` still 7.13.0 (fix lands at ≥7.15.1); mathjs still vulnerable inside the rules engine |
| 2 | Electron 31.7.7 past EOL | **Open.** Still `^31.7.7` |
| 3 | React 18/19 split | **Open.** rules-ui still declares react `^18.2.0` as a direct dependency |
| 4 | CI never runs unit tests | **Fixed** (397b6e5). `web-ci.yml` now runs web lint → web unit tests → rules-engine tests → web build, plus a desktop build job and a Cypress job with no `continue-on-error` |
| 5 | God components | **Open.** WorkspaceRoute 4,722 · WorldBibleRoute 4,465 · CompendiumRoute 3,118 · CharacterSheetsRoute 2,812 · useWorkspaceConsistency 2,447 — same as last audit |
| 6 | Phantom tiptap deps | **Open.** `@tiptap/*` still declared only in root package.json |
| 7 | Stray npm lockfiles | **Open.** package-lock.json still at root, apps/desktop, packages/rules-engine |
| 8 | Dev proxy open relay / `openExternal` | **Open.** `proxy-server.ts` unchanged: wide-open CORS, API key in request body, binds all interfaces, no error handling. `main.ts:41` still passes any URL to `shell.openExternal` |

Also fixed since the last report: the 5 lint errors (45670ee extracted the offending helpers into `contextPopoverPosition.ts` / `positionedStateChangeInventory.ts`), a stale-state bug in SettingsRoute (bfe62fc), and a flaky guardrail smoke test (3d740c8).

## Verified results (2026-07-24)

- **Typecheck:** `tsc -b` clean in all four workspaces (web requires rules-engine/rules-ui built first — expected with project references).
- **Unit tests:** web 40 files / 187 tests pass in ~2.8s; rules-engine 6 tests pass. rules-ui still has zero tests. 8 Cypress specs (now blocking in CI; not run locally).
- **Lint (web):** 0 errors, 3 warnings — e.g. a `react-hooks/exhaustive-deps` miss in `ConsumableEffectEditor.tsx:65`. Would pass CI.
- **Audit (prod):** 30 vulnerabilities — 1 critical, 13 high, 13 moderate, 3 low. Same families as July 19; sharp (high) now also flagged.

## Architecture notes

The new scene-state work (PRs #41/#42) is the encouraging part: `positionedStateChange`, `stateMutationAnchor`, `consumableEffects`, and `sceneRoster` all landed as small service modules with unit tests, and the lint fix commit moved pure helpers out of components. That's exactly the extraction pattern the last report recommended — it just hasn't been applied backward to the five giant files yet, and WorkspaceRoute keeps absorbing each new feature's UI wiring (both PRs touched it heavily). Routes still have zero test files; coverage remains concentrated in `services/` and `store/`.

Minor items still open: rules-ui's lint script shells into `../rules-engine/node_modules/.bin/eslint`; root `test` script is a stub; major-version drift continues (vitest, zod, vite, react-router-dom 7.13 → 7.18).

## Suggested order of attack

Same as before, minus the finished items: dependency security first (`react-router-dom ≥7.15.1`, `mathjs 15.2.0`, protobufjs bump — mostly patch/minor), then the Electron major upgrade, then make react a peer-only dep in rules-ui (`^18 || ^19`). The one-hour hygiene batch — delete the three npm lockfiles, move tiptap into apps/web, harden the dev proxy (bind 127.0.0.1, drop API-key-in-body, add try/catch) and allowlist `https:` in `openExternal` — is still the cheapest win on the board. Keep extracting per-panel components from WorkspaceRoute as features touch it; the new services show the pattern works.
