# Road to 100% Fitness — Work Slices

**Date:** 2026-07-25 · **Baseline:** [code-fitness-report-2026-07-24.md](archive/code-fitness-report-2026-07-24.md) (grade B)
**Repo state when written:** branch `codex/ci-trust-gates` with the July 24 dependency-pass changes still **uncommitted** in the working tree.

Each slice below is a discrete, PR-sized unit of work with a self-contained prompt an LLM agent (Claude Code / Codex with repo access) can execute. Slices are ordered by dependency; within a phase they can run in parallel unless noted.

## Verification commands (referenced by every prompt)

```bash
pnpm --filter web lint          # 0 errors expected
pnpm --filter web test:unit     # 187+ tests
pnpm --filter @litrpg-tool/rules-engine test   # 6+ tests
pnpm --filter web build         # tsc -b && vite build
pnpm --filter desktop build     # desktop tsc
```

Cypress (8 specs) runs in CI via `web-ci.yml`; run `pnpm --filter web e2e:run` locally for slices touching route UI.

## Slice index

| # | Slice | Phase | Est. size |
|---|---|---|---|
| 0 | Commit the pending dependency pass | 0 — Land pending work | XS |
| 1 | Allowlist `shell.openExternal` | 1 — Security & platform | XS |
| 2 | Electron major upgrade off EOL 31 | 1 | M |
| 3 | Migrate `@xenova/transformers` → `@huggingface/transformers` | 1 | M |
| 4 | Make React a peer-only dep in rules-ui | 2 — Dependency hygiene | S |
| 5 | Fix rules-ui lint script + real root `test` script | 2 | XS |
| 6 | Close major-version drift (vitest, zod check, misc) | 2 | S |
| 7 | Test infrastructure + first tests for rules-ui | 3 — Test coverage | M |
| 8 | Route-level smoke tests for apps/web | 3 | M |
| 9 | CompendiumRoute: extract Overview + Entries tabs | 4 — God components | S |
| 10 | CompendiumRoute: extract Progression + World-Systems tabs | 4 | S |
| 11 | WorkspaceRoute: extract canon panel + unknown-entity panel | 4 | S |
| 12 | WorkspaceRoute: extract drawer panels | 4 | S |
| 13 | WorkspaceRoute: extract command dispatcher into a hook | 4 | S |
| 14 | WorldBibleRoute: extract entity-field editor + import section UI | 4 | M |
| 15 | CharacterSheetsRoute: extract mutation composer + pure helpers | 4 | S |
| 16 | Split useWorkspaceConsistency into tested service modules | 4 | M |
| 17 | Final audit: verify grade-A criteria | 5 — Close-out | S |

## Execution status

Updated 2026-07-30. Slices not listed here have not started.

| Slice | Status | Evidence / coordination note |
|---|---|---|
| 0 | Complete | Dependency hygiene landed in `d9cd1bd`; proxy hardening landed in `4721fb0` |
| 1 | Complete | Guarded helper added and integrated; desktop build and focused protocol checks pass |
| 2 | Complete | Electron 43 upgrade landed in `8137369` |
| 3 | Complete | Migrated to `@huggingface/transformers` 4.2.0; real 384-dimension embedding passes; audit reduced 14 → 1 with only the unrelated React Router advisory remaining |
| 4 | Complete | `rules-ui` now keeps React/React DOM as `^18 || ^19` peers with React 19 development dependencies; package/web builds and all 187 web unit tests pass; web resolves one React 19.2.4 instance |
| 5 | Complete | `rules-ui` now owns its ESLint dependencies and passes its package lint command; root `pnpm test` runs 187 web tests and 6 rules-engine tests successfully |
| 6 | Complete | Web and rules-engine use Vitest 4.1.10; all workspaces align on Zod 3.25.76; safe ESLint, TypeScript-ESLint, Vite 7, TSX, type, and browser-mapping updates pass the full battery. Zod 4 and other breaking majors remain deferred; React Hooks 7.1 is pinned out because its new compiler rules expose 14 existing violations |
| 7 | Complete | Added Vitest/jsdom infrastructure and 12 behavior tests across both exported hooks and four rules-ui components; root tests and CI now include rules-ui. All 187 web, 6 rules-engine, 12 rules-ui, and 42 Cypress tests pass |
| 8 | Complete | Added a real-provider `renderRoute` harness and 9 jsdom smoke tests covering Workspace, World Bible, Compendium, Character Sheets, Lore, Characters, Projects, Settings, and Compendium tab switching; all 196 web tests pass in under 5 seconds |
| 9 | Complete | Extracted the behavior-preserving Compendium Overview and Entries panels into explicitly typed components, moved shared tab/scope constants alongside them, and reduced `CompendiumRoute.tsx` from 3,118 to 2,433 lines; lint, all 196 web tests, focused Compendium smoke tests, and the web build pass |
| 10 | Complete | Extracted the behavior-preserving Progression and World Systems panels into explicitly typed components, moved presentation helpers into a tested service module, and reduced `CompendiumRoute.tsx` from 2,433 to 1,590 lines. The aspirational sub-800 target remains unmet because route-owned state and handlers account for most remaining lines; lint, all 201 web tests, focused Compendium smoke tests, and the web build pass |

---

## Phase 0 — Land pending work

### Slice 0: Commit the pending dependency pass

The July 24 dependency-security pass was initially recorded as uncommitted working-tree changes: deleted `package-lock.json` at root, `apps/desktop/`, `packages/rules-engine/`; tiptap deps moved from root `package.json` into `apps/web/package.json`; hardened `apps/web/proxy-server.ts`; pnpm overrides in root `package.json`; updated `pnpm-lock.yaml`; and the dated report now archived at `docs/archive/code-fitness-report-2026-07-24.md`.

**Prompt:**

> Historical slice note: the dependency-security pass originally lived as uncommitted work on `codex/ci-trust-gates`. Do not replay this prompt from the current tree. Use the status table above and inspect current dependencies before deciding whether any follow-up remains. The baseline report is `docs/archive/code-fitness-report-2026-07-24.md`.

---

## Phase 1 — Security & platform

### Slice 1: Allowlist `shell.openExternal`

**Prompt:**

> In worldbuilding-desk, `apps/desktop/src/main/main.ts` (~line 40) has a `setWindowOpenHandler` that passes any URL to `shell.openExternal(url)` before denying the window open. This lets a compromised renderer open arbitrary protocols (file:, smb:, custom app handlers). Change it to parse the URL with `new URL(url)` inside a try/catch and only call `shell.openExternal` when the protocol is `https:` or `http:`; otherwise log a warning and do nothing. Extract this as a small exported function (e.g. `openExternalIfSafe(url: string): boolean`) in a new module under `apps/desktop/src/main/` so it is unit-testable, and use it in the handler. Search the desktop codebase for any other `openExternal` call sites and apply the same guard. Verify with `pnpm --filter desktop build`. If the desktop package has no test runner, don't add one in this slice — keep the function pure and simple.

### Slice 2: Electron major upgrade off EOL 31

**Prompt:**

> worldbuilding-desk's `apps/desktop` pins `electron: ^31.7.7` (EOL) and `electron-builder: ^24.13.3`. Upgrade Electron to the latest stable major (check https://www.electronjs.org/docs/latest/tutorial/electron-timelines for the current supported line) and electron-builder to its latest compatible release. Process: (1) read the Electron breaking-changes doc for every major between 31 and the target, and list which ones touch this app — the main process is small (`apps/desktop/src/main/main.ts`, a preload script, `setupAPIHandlers`), uses `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`; (2) bump `electron` and `electron-builder` in `apps/desktop/package.json`, run `pnpm install` (note: `pnpm-workspace.yaml` has `onlyBuiltDependencies` including electron — keep it listed so its postinstall runs); (3) update `@types/node` to match the new Electron's Node version; (4) fix any compile errors from removed/renamed APIs; (5) verify `pnpm --filter desktop build`, then launch with `pnpm --filter desktop start` against a built web bundle (`pnpm --filter web build`) and confirm the window opens, the renderer loads, and external links still open in the default browser; (6) run `pnpm --filter desktop package:dir` to confirm electron-builder still packages. Commit with a summary of breaking changes handled.

### Slice 3: Migrate `@xenova/transformers` → `@huggingface/transformers`

This removes the last ~13 prod vulnerabilities (protobufjs critical, sharp high — all transitive via `@xenova/transformers`, accepted-risk since July 24).

**Prompt:**

> In worldbuilding-desk, `apps/web` depends on `@xenova/transformers ^2.14.1`, whose transitive deps (protobufjs, sharp, others) account for all remaining `pnpm audit --prod` findings. Migrate to its maintained successor `@huggingface/transformers` (v3+). Steps: (1) find every import/usage of `@xenova/transformers` in `apps/web/src` (known call site: `src/services/rag/RAGService.ts`) and note which pipelines/models are used and where models are loaded from (local cache vs. hub); (2) read the v3 migration notes — the API is largely compatible (`pipeline(...)` etc.) but check WASM/WebGPU backend configuration, `env` settings, and model path handling; (3) swap the dependency in `apps/web/package.json`, update imports, adjust any changed options; (4) if the app ships or caches local model files, verify the paths/format still resolve; (5) verify `pnpm --filter web build`, `pnpm --filter web test:unit`, and manually exercise the feature that uses the pipeline (identify it from the call sites — likely an embedding or classification feature) in `pnpm --filter web dev`; (6) run `pnpm audit --prod` and confirm the protobufjs/sharp findings are gone — target 0 prod vulnerabilities; also remove `protobufjs` and `sharp` from `onlyBuiltDependencies` in `pnpm-workspace.yaml` if no longer present in the tree. Record the before/after audit counts in the commit message.

---

## Phase 2 — Dependency hygiene

### Slice 4: Make React a peer-only dep in rules-ui

**Prompt:**

> In worldbuilding-desk, `packages/rules-ui/package.json` declares `react ^18.2.0` and `react-dom ^18.2.0` as direct dependencies while also listing them as peerDependencies `^18.0.0`; `apps/web` uses React `^19.2.0`. This risks two React copies. Fix: (1) remove `react` and `react-dom` from `dependencies`, keep them only in `peerDependencies` widened to `"^18.0.0 || ^19.0.0"`, and add matching entries under `devDependencies` (React 19 line) so the package can typecheck standalone; (2) update `@types/react`/`@types/react-dom` devDependencies to `^19`; (3) run `pnpm install`, then `pnpm --filter @litrpg-tool/rules-ui build` and fix any type errors from the 18→19 types bump (common: `JSX.Element` → `React.JSX.Element`, changed ref typings); (4) verify `pnpm --filter web build` and `pnpm --filter web test:unit`; (5) confirm a single React instance: `pnpm why react` should show react resolved once for apps/web. Commit.

### Slice 5: Fix rules-ui lint script + real root `test` script

**Prompt:**

> Two script-hygiene fixes in worldbuilding-desk: (1) `packages/rules-ui/package.json` lint scripts shell into a sibling package's binaries (`../rules-engine/node_modules/.bin/eslint`). Give rules-ui its own eslint devDependencies mirroring `packages/rules-engine`'s eslint setup (copy its eslint config file and eslint-related devDependency versions, adding React-specific plugins if the config needs them for .tsx), and change the scripts to plain `eslint src/**/*.{ts,tsx}`. Run `pnpm --filter @litrpg-tool/rules-ui lint` and fix or explicitly disable (with a comment) anything it flags. (2) The root `package.json` `test` script is a stub (`echo "Error: no test specified" && exit 1`). Replace it with `pnpm -r --filter web --filter @litrpg-tool/rules-engine test:unit`-style recursive invocation — concretely: root `"test": "pnpm --filter web test:unit && pnpm --filter @litrpg-tool/rules-engine test"` (extend later as more packages gain tests). Verify root `pnpm test` passes. Keep the two changes as separate commits.

### Slice 6: Close major-version drift

**Prompt:**

> In worldbuilding-desk, close the flagged dependency drift without breaking anything: (1) vitest — `apps/web` is on `^1.6.1`; `packages/rules-engine` also uses vitest (check its version). Upgrade both to the latest stable vitest major, updating any config files (`vitest.config.*` / vite config `test` block) for renamed options and fixing API changes in test files (v1→v3 notably changed some mock typings and `describe`/config options; run the suites to find breaks). (2) zod — web is on `^3.25.76`, rules-ui on `^3.22.4`; do NOT migrate to zod v4 in this slice (breaking API), but align both on the latest zod 3.x. (3) Run `pnpm outdated -r` and apply any remaining safe in-range or minor bumps for build tooling (vite, eslint plugins), skipping anything requiring code changes beyond config tweaks. Verify the full battery: `pnpm --filter web lint`, `pnpm --filter web test:unit`, `pnpm --filter @litrpg-tool/rules-engine test`, `pnpm --filter web build`, `pnpm --filter desktop build`. List every bump in the commit message and note zod v4 as deliberately deferred.

---

## Phase 3 — Test coverage

### Slice 7: Test infrastructure + first tests for rules-ui

**Prompt:**

> `packages/rules-ui` in worldbuilding-desk has zero tests (components in `src/components/`, hooks in `src/hooks/`). Set up: (1) add `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, and `jsdom` as devDependencies (match the vitest major used by apps/web); (2) add a `vitest.config.ts` with `environment: 'jsdom'` and a setup file wiring jest-dom matchers; (3) add `"test": "vitest run"` to its package.json scripts; (4) write initial tests: for each exported hook, a renderHook test covering its primary state transition; for the 2–3 most complex components (pick by line count / conditional rendering), render tests asserting key interactions (click/change → expected DOM or callback). Target ≥15 meaningful assertions, no snapshot tests. (5) Append the new test command to the root `test` script and to the rules-engine test step in `.github/workflows/web-ci.yml` so CI blocks on it. Verify `pnpm --filter @litrpg-tool/rules-ui test` and the full CI-equivalent battery locally.

### Slice 8: Route-level smoke tests for apps/web

**Prompt:**

> worldbuilding-desk's `apps/web` has 187 unit tests concentrated in `src/services/` and `src/store/`; the routes in `src/routes/` (WorkspaceRoute, WorldBibleRoute, CompendiumRoute, CharacterSheetsRoute, LoreRoute, CharactersRoute, ProjectsRoute, SettingsRoute) have zero test files. Add render-smoke coverage: (1) add `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` devDependencies and configure the vitest setup (jsdom environment for `*.test.tsx` files — use vitest workspace/environmentMatchGlobs so existing node-env tests are untouched); (2) build a shared `renderRoute` test helper that mounts a route inside the app's real providers (router via `createMemoryRouter` or MemoryRouter, store provider, any context providers — inspect `src/main.tsx`/`src/App.tsx` for the actual provider tree) with minimal seeded store state; (3) for each route, one smoke test: renders without throwing and shows a distinguishing landmark (heading/tab label), plus one interaction test for routes with tabs (e.g. CompendiumRoute tab switch). Mock heavyweight browser APIs jsdom lacks (matchMedia, ResizeObserver, IntersectionObserver) in the setup file; mock the `@huggingface/transformers` (or `@xenova/transformers`) module entirely. (4) Keep total added runtime under ~15s. Verify `pnpm --filter web test:unit` passes with the new tests included. These smoke tests are the safety net for the upcoming god-component refactors — land this slice before Phase 4.

---

## Phase 4 — God-component decomposition

Five files carry most of the architecture debt: `WorkspaceRoute.tsx` (4,722 lines), `WorldBibleRoute.tsx` (4,465), `CompendiumRoute.tsx` (3,118), `CharacterSheetsRoute.tsx` (2,812), `useWorkspaceConsistency.ts` (2,447). The July 24 report confirmed the extraction pattern that works here: pure logic into `src/services/` modules with unit tests; JSX regions into components under `src/components/<Area>/`; state stays in the route, passed down via props.

**Ground rules embedded in every Phase 4 prompt** (repeated so each prompt stands alone): behavior-preserving only — no UI or logic changes; extracted components take props, no new context or state libraries; pure functions go to `src/services/` with unit tests; verify with `pnpm --filter web lint`, `pnpm --filter web test:unit`, `pnpm --filter web build`, and run Cypress (`pnpm --filter web e2e:run`) if the route has specs; keep the diff reviewable (target ≤600 lines moved per slice).

### Slice 9: CompendiumRoute — extract Overview + Entries tabs

**Prompt:**

> In worldbuilding-desk, `apps/web/src/routes/CompendiumRoute.tsx` (3,118 lines) renders four tabs defined in `COMPENDIUM_TABS` (~line 117): `overview`, `entries`, `progression`, `world-systems`. Extract the **overview** and **entries** tab panels into `src/components/Compendium/OverviewTab.tsx` and `src/components/Compendium/EntriesTab.tsx`. Method: locate the JSX region rendered for each tab id, move it verbatim into the new component, and pass everything it references (state values, setters, handlers, derived data) as explicitly-typed props — resist the urge to refactor logic while moving. Module-level constants used only by a moved tab (e.g. `RECIPE_CATEGORY_OPTIONS`, `SETTLEMENT_*_OPTIONS` if entries-related) move with it; shared constants go to `src/components/Compendium/constants.ts`. Pure helper functions used only by moved code (e.g. `formatSettlementEffectLabel`, `formatSynergyStatus` — check actual usage) move to `src/services/compendium.ts` with a unit test each. Behavior-preserving only; no new context. Verify: `pnpm --filter web lint`, `pnpm --filter web test:unit`, `pnpm --filter web build`, and the CompendiumRoute smoke test from the route-test suite. CompendiumRoute.tsx should shrink by roughly the size of the moved JSX; report before/after line counts in the commit message.

### Slice 10: CompendiumRoute — extract Progression + World-Systems tabs

**Prompt:**

> Continuation of the CompendiumRoute decomposition in worldbuilding-desk (`apps/web/src/routes/CompendiumRoute.tsx`; Overview and Entries tabs already extracted to `src/components/Compendium/`). Extract the remaining **progression** and **world-systems** tab panels into `src/components/Compendium/ProgressionTab.tsx` and `src/components/Compendium/WorldSystemsTab.tsx`, following the exact pattern already established in that folder: JSX moved verbatim, explicitly-typed props for all referenced state/handlers, tab-specific constants move with their tab, shared ones in `constants.ts`, pure helpers to `src/services/compendium.ts` with unit tests. Behavior-preserving only. After this slice CompendiumRoute.tsx should be a thin shell: tab config, state, handlers, and tab switching — aim for under ~800 lines. Verify: `pnpm --filter web lint`, `pnpm --filter web test:unit`, `pnpm --filter web build`, plus the CompendiumRoute smoke/interaction tests. Report before/after line counts.

### Slice 11: WorkspaceRoute — extract canon panel + unknown-entity panel

**Prompt:**

> In worldbuilding-desk, `apps/web/src/routes/WorkspaceRoute.tsx` (4,722 lines, single `WorkspaceRoute()` function from ~line 272) needs incremental decomposition. Existing extractions live in `src/components/Workspace/` (SceneRosterPanel, PositionedStateChangeComposer, WorkspaceContextDrawer, etc.) — follow their conventions. This slice: extract two JSX regions into components in `src/components/Workspace/`: (1) the canon panel — the `styles.canonPanel` block (~line 3076) → `CanonPanel.tsx`; (2) the unknown-entity panel — the `styles.unknownPanel` block with its header/dismiss button (~line 3027) → `UnknownEntityPanel.tsx`. Move JSX verbatim; pass all referenced state, handlers, and derived values as explicitly-typed props; move CSS-module class usage with the component (they can keep importing the route's CSS module or get their own — match what SceneRosterPanel does). If a handler is used only by a moved region, move it into the component; if shared, keep it in the route and pass it down. Behavior-preserving only; no new context or state libraries. Verify: `pnpm --filter web lint`, `pnpm --filter web test:unit`, `pnpm --filter web build`, `pnpm --filter web e2e:run` (workspace specs exist). Report before/after line counts.

### Slice 12: WorkspaceRoute — extract drawer panels

**Prompt:**

> Continuation of the WorkspaceRoute decomposition in worldbuilding-desk (`apps/web/src/routes/WorkspaceRoute.tsx`; canon and unknown-entity panels already extracted to `src/components/Workspace/`). This slice: the left and right drawer panels (`styles.drawerPanelLeft` ~line 3787 and `styles.drawerPanelRight` ~line 3835, each with a `drawerPanelHeader`). Extract them into `src/components/Workspace/` — either one `WorkspaceDrawerPanels.tsx` or two components, whichever yields cleaner props; note `WorkspaceContextDrawer.tsx` and `WorkspaceSceneDrawer.tsx` already exist in that folder, so first check whether these regions should compose with or fold into those components rather than duplicating. JSX moves verbatim, all referenced state/handlers as explicitly-typed props, handlers used only by moved code move too. Behavior-preserving only. Verify: `pnpm --filter web lint`, `pnpm --filter web test:unit`, `pnpm --filter web build`, `pnpm --filter web e2e:run`. Report before/after line counts.

### Slice 13: WorkspaceRoute — extract command dispatcher into a hook

**Prompt:**

> Continuation of the WorkspaceRoute decomposition in worldbuilding-desk (`apps/web/src/routes/WorkspaceRoute.tsx`). The route contains a large command-dispatch switch (cases like `'toggle-ai-panel'`, `'toggle-system-history-panel'` around line 2726) plus ~43 `useCallback`/`useMemo`/`useEffect` blocks. This slice: (1) extract the command dispatcher into a custom hook `src/hooks/useWorkspaceCommands.ts` that receives the state setters/refs it needs and returns the dispatch function — move the switch verbatim; (2) identify the 3–5 largest pure computations currently inline in `useMemo` bodies and move each to a named pure function in an appropriate `src/services/` module (create `src/services/workspaceView.ts` if none fits) with a unit test each — the `useMemo` then just calls the named function; (3) do not restructure state or convert anything to a reducer in this slice. Behavior-preserving only. Verify: `pnpm --filter web lint`, `pnpm --filter web test:unit` (should grow by the new service tests), `pnpm --filter web build`, `pnpm --filter web e2e:run`. Report before/after line counts for WorkspaceRoute.tsx.

### Slice 14: WorldBibleRoute — extract entity-field editor + import section UI

**Prompt:**

> In worldbuilding-desk, `apps/web/src/routes/WorldBibleRoute.tsx` (4,465 lines) contains `WorldBibleRoute()` (~line 420) and an already-separate `CategoryManager` component (~line 4367). This slice: (1) move `CategoryManager` into its own file `src/components/WorldBible/CategoryManager.tsx` (verbatim, with the constants/types only it uses); (2) extract the entity-field rendering — `renderEntityField` (~line 2030) and the JSX region that invokes it — into `src/components/WorldBible/EntityFieldEditor.tsx`; (3) extract the import-section UI that uses `IMPORT_SECTION_ACTION_LABELS`/`IMPORT_SECTION_ACTION_HELP` (~lines 208–215) into `src/components/WorldBible/ImportSectionPanel.tsx`; (4) move pure character-summary helpers and their constants (`CATEGORY_SUMMARY_PRIORITY`, `CHARACTER_CATEGORY_HINTS`, `CHARACTER_IDENTITY_FIELD_KEYS`, etc. ~lines 121–140) into `src/services/worldBibleSummary.ts` with unit tests, if they are pure — verify by inspection. JSX/logic moves verbatim; explicitly-typed props; behavior-preserving only; no new context. Verify: `pnpm --filter web lint`, `pnpm --filter web test:unit`, `pnpm --filter web build`, plus the WorldBibleRoute smoke test and any Cypress specs touching the World Bible. Report before/after line counts.

### Slice 15: CharacterSheetsRoute — extract mutation composer + pure helpers

**Prompt:**

> In worldbuilding-desk, `apps/web/src/routes/CharacterSheetsRoute.tsx` (2,812 lines) mixes pure helpers and a large component. This slice: (1) move the pure module-level helpers — `hashString` (~line 107), `buildDefaultStats` (~115), `buildDefaultResources` (~119), `summarizeMutationCommand` (~123) — into `src/services/characterSheetDefaults.ts` (or an existing suitable service module; check `src/services/` for a character/mutation service first) with a unit test for each; (2) extract the state-mutation form UI that uses `MUTATION_FORM_TYPES` (~line 92) into `src/components/CharacterSheets/MutationForm.tsx`, moving the constant with it; (3) extract one more large self-contained JSX region of your choosing (pick the largest contiguous block, likely a sheet section) into `src/components/CharacterSheets/`. JSX verbatim, explicitly-typed props, behavior-preserving only. Verify: `pnpm --filter web lint`, `pnpm --filter web test:unit`, `pnpm --filter web build`, plus the CharacterSheetsRoute smoke test. Report before/after line counts.

### Slice 16: Split useWorkspaceConsistency into tested service modules

**Prompt:**

> In worldbuilding-desk, `apps/web/src/hooks/useWorkspaceConsistency.ts` is a 2,447-line hook (the hook itself starts ~line 520; exported types like `StateMutationReviewItem`, `ReviewReadiness` ~lines 121–160; exported helper `mapReviewAnnotationsByIssueKey` ~line 506). It has an existing test file `useWorkspaceConsistency.test.ts` — read it first; it must keep passing. This slice: (1) identify the pure functions defined inside or alongside the hook (grouping, readiness computation, annotation mapping, filtering) and move them into 2–3 cohesive modules under `src/services/` (suggested: `reviewReadiness.ts`, `mutationReviewGrouping.ts`), exporting the shared types from a `src/services/consistencyTypes.ts` or keeping them re-exported from the hook file so existing imports don't break; (2) the hook becomes an orchestrator: state + effects + calls into the named service functions; (3) add unit tests for each extracted service function covering its main branches — this is the highest-value test target in the repo since consistency review is core logic; (4) keep the hook's public API (arguments, return shape, exported types) byte-for-byte identical — confirm by checking every importer of this module compiles unchanged. Behavior-preserving only. Verify: `pnpm --filter web lint`, `pnpm --filter web test:unit` (existing hook tests + new service tests), `pnpm --filter web build`, `pnpm --filter web e2e:run`. Report before/after line counts for the hook file.

---

## Phase 5 — Close-out

### Slice 17: Final audit — verify grade-A criteria

**Prompt:**

> Run a close-out fitness audit of worldbuilding-desk against the July 24 baseline (`docs/archive/code-fitness-report-2026-07-24.md`, grade B) and this plan (`docs/fitness-100-work-slices.md`). Verify each criterion and record actuals: (1) `pnpm audit --prod` → 0 vulnerabilities; (2) Electron in `apps/desktop/package.json` is a currently-supported major; (3) `packages/rules-ui/package.json` has React only in peerDependencies (`^18 || ^19`); (4) `shell.openExternal` call sites are protocol-guarded; (5) no `package-lock.json` anywhere (`git ls-files '*package-lock.json'` empty); (6) `@tiptap/*` deps live in apps/web, not root; (7) root `pnpm test` runs real tests; rules-ui lint runs its own eslint; (8) line counts: `wc -l` on WorkspaceRoute.tsx, WorldBibleRoute.tsx, CompendiumRoute.tsx, CharacterSheetsRoute.tsx, useWorkspaceConsistency.ts — each should be substantially reduced (targets: no file >2,000 lines; note any misses); (9) test counts by workspace (web unit, rules-engine, rules-ui, route smoke tests) all passing, and `.github/workflows/web-ci.yml` blocks on all of them plus Cypress; (10) `pnpm outdated -r` shows no major-version drift except deliberately deferred items (zod 4). Write the result as a dated audit under `docs/archive/` in the same format as the July 24 report, grading honestly—if anything missed target, list it as the new top issue rather than rounding up.

---

## Notes for the human running these

Slices 0 → 1 → 2 → 3 are the security-critical path; do them first and in order (0 must precede everything). Phase 2 and 3 can interleave; Slice 8 (route smoke tests) **must land before any Phase 4 slice** — it is the refactor safety net. Phase 4 slices touching the same file (9→10, 11→12→13) are sequential; different files can run in parallel. Every prompt assumes the executor starts from a clean, up-to-date checkout and ends with the verification battery green.
