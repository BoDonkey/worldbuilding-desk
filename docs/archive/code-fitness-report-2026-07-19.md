# Code Fitness Report — worldbuilding-desk

> Archived 2026-07-26. Superseded by the July 24 fitness report.

**Date:** 2026-07-19 · **Branch:** `codex/scene-state-change-composer` (18 modified files uncommitted)
**Scope:** apps/web, apps/desktop, packages/rules-engine, packages/rules-ui (~70,600 lines of TypeScript)

> **Disposition (2026-07-20):** This is a point-in-time audit, not the current roadmap. PR #43 completed the CI recommendation by making web lint, web unit tests, rules-engine tests, web build, desktop build, and the full Cypress suite blocking. The same PR passed all three hosted jobs, including 42/42 Cypress tests, and web lint now passes. Re-verify the remaining dependency, Electron, React, architecture, and repository-hygiene findings against merged `main` before acting on them; use `PROJECT_STATUS.md` and `docs/next-steps.md` for current priorities.

## Overall grade: B−

Solid fundamentals — strict TypeScript compiles clean everywhere, all 188 unit tests pass, Electron is properly hardened. Fitness is dragged down by dependency vulnerabilities, an EOL Electron, a React 18/19 split, several enormous route files, and CI that doesn't run the unit tests.

| Area | Grade | Summary |
|---|---|---|
| Type safety & build | A− | `strict: true` in every workspace; `tsc` clean for web, desktop, both packages |
| Tests | B− | 188 tests pass fast (web 182, engine 6), but coverage is lopsided |
| Lint | B | Good flat-config setup, but working tree currently fails with 5 errors |
| Dependencies | C+ | 25 prod vulnerabilities (1 critical), EOL Electron, React version split |
| Architecture | B− | Clean monorepo/service layout undermined by 3,000–4,700-line route files |
| Security | B+ | Electron hardening correct; dev proxy and `openExternal` need tightening |
| CI | C+ | Lints and builds web only; unit tests never run in CI; smoke tests can't fail |
| Repo hygiene | B | Good .gitignore and docs; stray npm lockfiles, phantom root deps |

## Verified results

- **Typecheck:** `tsc -b` clean for web (17.9s); clean for desktop and both packages. Strict mode plus `noUnusedLocals`/`noUnusedParameters` in web.
- **Unit tests:** web `vitest` 40 files / 182 tests, all pass in ~3s. rules-engine 2 files / 6 tests pass. rules-ui has **zero tests**. 8 Cypress e2e specs exist (not run in this evaluation).
- **Lint:** web currently has **5 errors, 3 warnings** — unused vars in `services/llm/LLMService.ts:382` and `services/state/stateMutationSchemas.ts:99`, and `react-refresh/only-export-components` in `ContextPopover.tsx` and `PositionedStateChangeComposer.tsx`. These are in the uncommitted working tree and would fail CI's lint gate on push.
- **Audit (prod deps):** 25 vulnerabilities — **critical:** protobufjs; **high:** mathjs (rules-engine runtime dep), react-router, path-to-regexp, protobufjs; plus moderate/low in qs, react-router. 87 total including dev deps.

## Top issues, ranked

1. **Prod dependency vulnerabilities.** protobufjs (critical) and mathjs (high) are runtime deps — mathjs sits inside the rules engine that evaluates user formulas. Run `pnpm audit --prod` and bump; most fixes are patch/minor (`react-router-dom ≥7.15.1`, `mathjs 15.2.0`).
2. **Electron 31.7.7 is past end-of-life.** No Chromium security patches. Upgrade to a supported major.
3. **React 18/19 split.** `rules-ui` declares React 18 as a *direct* dependency while web runs React 19 — two React copies in one tree, a classic "invalid hook call" / broken-context hazard. Make react/react-dom peer-only in rules-ui and widen to `^18 || ^19`.
4. **CI never runs unit tests.** `web-ci.yml` does lint + build; `vitest` isn't invoked, and the Cypress job has `continue-on-error: true`, so it can't fail. Desktop and packages have no CI at all. Adding `pnpm --filter web test:unit` and package tests is one line each.
5. **God components.** `WorkspaceRoute.tsx` (4,720 lines), `WorldBibleRoute.tsx` (4,465), `CompendiumRoute.tsx` (3,118), `CharacterSheetsRoute.tsx` (2,812), plus `useWorkspaceConsistency.ts` (2,447). These five files are ~13% of the codebase, are the least-tested part of it (routes: 0 test files), and dominate the git-churn history.
6. **Phantom dependencies.** Web imports `@tiptap/*` in 13 files, but the deps are declared only in the *root* package.json. Works today via hoisting; breaks under stricter pnpm settings. Move them into `apps/web/package.json`.
7. **Lockfile confusion.** `pnpm-lock.yaml` plus three committed `package-lock.json` files (root, apps/desktop, packages/rules-engine). Desktop appears npm-managed inside a pnpm workspace. Pick pnpm, delete the npm lockfiles.
8. **Dev proxy is an open relay.** `proxy-server.ts` uses wide-open CORS, accepts the API key from the request body, binds all interfaces, and has no error handling — any local webpage can relay through it. Bind to `127.0.0.1`, restrict origin, wrap in try/catch. Also `main.ts:41` passes any URL to `shell.openExternal` — allowlist `https:` first.

## Smaller observations

- Lint config disables `react-hooks/purity`, `set-state-in-effect`, `preserve-manual-memoization`, and `no-explicit-any` — worth revisiting once things stabilize (actual `any` usage is low: ~30 occurrences).
- `rules-ui`'s lint script shells into `../rules-engine/node_modules/.bin/eslint` — add eslint as its own devDependency.
- Root `test` script is a stub (`exit 1`); a `pnpm -r test` would let one command run everything.
- Major-version drift building up: vitest 1→4, zod 3→4, vite 7→8. Not urgent, but the gap grows.
- Test coverage is concentrated in `services/` (29 test files) and `store/`; routes (0), utils (0), and hooks (3/15) are nearly bare — exactly where the giant files live.
- Hygiene positives worth keeping: no secrets in source, low TODO debt (1), disciplined docs/ folder, build artifacts correctly untracked.

## Suggested order of attack

Quick wins first: fix the 5 lint errors, add unit tests to CI, delete stray lockfiles, move tiptap deps into apps/web (≈1 hour total). Then dependency security (audit fixes + Electron upgrade), then the React peer-dep fix, and finally chip away at `WorkspaceRoute.tsx` — extract per-panel components with tests as you touch them rather than a big-bang rewrite.
