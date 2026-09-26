# Code Health + Architecture Review — 2026-09-26

**Type:** dated audit (archive convention, same as the fitness reports).
**Audited:** local `main` at `ccff89b` ("Mark roadmap slice 4.41 complete"),
24 commits ahead of `origin/main`.
**Compared against:** `docs/architecture-review.md` (last reviewed
2026-08-30, base `7dbb8d6`). 94 commits since; 263 files, +22.4k / −1.9k.
**Scope:** code health and architecture boundaries. No code changed during
the audit. Durable conclusions are folded into the Current Architecture Risks
list in `docs/architecture-review.md`.

## Baseline

| Check | Result |
| --- | --- |
| `pnpm lint` | clean except the long-carried warning in `components/Mechanics/ConsumableEffectEditor.tsx:65` (`react-hooks/exhaustive-deps`) |
| `tsc -b` (web) | clean |
| Unit tests | 696 web, 6 rules-engine, 12 rules-ui — all pass locally |
| GitHub CI on `main` | **failing** on every push since at least 2026-08-09 |

## Healthy

- Persistence containment holds: every IndexedDB import is in a `*Storage.ts`
  module or under `services/`. No route or component opens the DB directly.
- Type discipline: ~12 `any` in non-test web code, zero `@ts-ignore` /
  `@ts-expect-error`, 6 `eslint-disable`, 2 swallowed catches.
- `services/` has no React imports; deterministic domain logic (state replay,
  mutation ledger, evidence gate, schema migrations) is plain TypeScript with
  colocated tests.
- Electron window hardening: `sandbox`, `contextIsolation`, no
  `nodeIntegration`, `setWindowOpenHandler` denies and routes through the
  external-URL policy.
- Storage migrations follow the documented contract (single-step, checkpointed,
  fail closed on newer data).

## Findings

### F1 — CI red on `main` (high)

`@worldbuilding-desk/rules-engine` resolves through `main: ./dist/index.js`.
The `web-verify` CI job runs `pnpm --filter web test:unit` before anything
builds the package, so a clean checkout fails:

```
Failed to resolve entry for package "@worldbuilding-desk/rules-engine"
```

(run 35441418065, 2026-09-19). Locally the suite passes only because a stale
`dist/` exists. The `cypress-smoke` job also fails; it was masked by the
unit-test failure. Consequence: slice verification in the roadmap is
local-only and not reproducible from a clean checkout.

### F2 — Provider API keys in plaintext `localStorage` (high; carried from the 2026-05-10 review)

- `components/Settings/AISettings.tsx:105-145` reads/writes
  `anthropic_api_key` / `openai_api_key` / `gemini_api_key` directly;
  `services/llm/LLMService.ts:183` (`readStoredKey`) falls back to them.
- The 2026-05-10 recommendation (Electron `safeStorage`, migrate-and-clear the
  plaintext value) was never implemented and dropped out of the risk list and
  roadmap during consolidation.
- Compounding it: the renderer sends the key **and** an arbitrary
  `providerConfig.baseUrl` on every `llm:*` IPC call. `apiHandler.ts` only
  checks `typeof baseUrl === 'string'`; `ProviderRegistry.ts:251,317,346,395`
  then `fetch`es it with the key attached. A compromised renderer can send the
  key anywhere.
- No Content-Security-Policy on the renderer and no `will-navigate` guard on
  the main window.

### F3 — Rules-engine runtime is unused; state logic lives in the web app (medium)

What the package contains (~2.5k lines, last functional change 2026-02-22):

| Area | Files | Used by the app? |
| --- | --- | --- |
| Types + Zod schemas (`WorldRuleset`, `StatDefinition`, `ResourceDefinition`, `GameRule`, `CharacterState`, …) | `types/` | **Yes** — `WorldRuleset` type in 7 web files; rules-ui wizard |
| Presets + `createEmptyRuleset` | `types/WorldRuleset.ts` | **Yes** — web character mechanics setup, rules-ui wizard |
| `RulesEngine` (trigger/condition/effect evaluation over `GameRule`) | `engine/RulesEngine.ts` | No |
| `ConditionEvaluator`, `EffectApplicator`, `FormulaParser` | `engine/` | No |
| `StateManager` (in-memory character state: time, exposure ailments, statuses, durability, crafting, modifiers, effective stats) | `state/StateManager.ts` (736 lines) | No |
| `DiceRoller` | `utils/` | No |

What the app actually uses for runtime state:
`apps/web/src/services/state/` — `stateMutationLedger`, `stateReplay`
(`applyStateMutationCommand`, `replayCharacterState`,
`validateStateMutationEventForRuleset`), `consumableEffects`,
`positionedStateChange`, and friends. This is the persisted, scene-ordered,
author-approved event model described in `docs/domain-model.md`. Its
`CharacterReplayState` shape is independent of the engine's `CharacterState`.

Authored `ruleset.rules` (`GameRule[]`) are never executed. They are displayed
as counts and serialized as text into AI context
(`rulesetService.ts:53`, `contextHealthRebuild.ts:43`,
`CharacterSheetsRoute.tsx:1176`). `WorldRuleset.rules` is also still
`z.array(z.any())` in the schema — the "weakly typed ruleset" risk.

So there are two state models: a dormant in-memory one in the package and the
live event-sourced one in the web app. The architecture doc's claims that "the
rules engine remains framework-independent and testable" and "do not create
parallel field-definition systems" are both technically true and practically
misleading. The package has 2 test files covering `ConditionEvaluator` and
`DiceRoller`.

Options:

1. **Shrink the package to what is real.** Keep types, schemas, presets,
   `createEmptyRuleset` (and optionally `DiceRoller`). Delete or archive the
   `engine/` and `state/` runtime. Rename the concept in docs to "ruleset
   schema package". Lowest cost; honest about the current product, where
   mechanics are author-recorded events rather than simulated.
2. **Move the live model into the package.** Relocate the pure parts of
   `services/state/` (command application, replay, ruleset validation) into
   `rules-engine`, retire `StateManager`, and keep persistence/IndexedDB in
   the web app. Gives the framework-independent core the doc describes; worth
   it if a desktop/CLI/export consumer or a "game engine narration" feature
   is planned.
3. **Keep both, document the split.** Leave the runtime as a future
   simulation layer. Cheapest now, but it keeps ~1.5k lines of untested,
   unexercised code that will drift from the live model.

### F4 — Hotspot files growing again (medium)

| File | 2026-08-30 | 2026-09-26 | Note |
| --- | --- | --- | --- |
| `hooks/useWorkspaceConsistency.ts` | 2072 | 2234 | largest file; 17 `useState`, 26 `useCallback`, 52-line return |
| `routes/WorldBibleRoute.tsx` | 2044 | 2178 | |
| `routes/WorkspaceRoute.tsx` | 2075 | 2171 | documented target < 800 |
| `routes/CharacterSheetsRoute.tsx` | 2147 | 2126 | 37 `useState` |
| `routes/LoreRoute.tsx` | 1835 | 1827 | 36 `useState` |
| `routes/CompendiumRoute.tsx` | 1551 | 1540 | 59 `useState` |

New features keep landing in the largest files. `useWorkspaceConsistency`
moved complexity out of the route without splitting ownership. Eight
routes/components still import storage modules directly (CanonDecisions,
CharacterSheets, Compendium, Lore, Projects, Settings, Ruleset,
`CategoryEditor`). UI preferences go to `localStorage` ad hoc from six
route/component/hook files with no shared helper; `WorldBibleRoute.tsx:1697`
writes storage from inside JSX.

### F5 — Canon acceptance is non-atomic (medium)

`acceptLoreEntityProposal` (`services/lore/entityProposalActions.ts`) and
`services/lore/canonicalFactActions.ts` issue sequential awaited writes across
categories, characters, entities, aliases, and lore links. Only project
deletion (`projectStorage.ts:44`) uses a multi-store transaction. A mid-flow
failure (quota, tab close) can leave an orphaned category/entity or a
character linked to nothing — on the author-approves-canon boundary.

### F6 — Smaller items

- `apps/desktop` has no tests and no lint script (`pnpm lint` covers 4 of 5
  workspace projects); the IPC validator is the riskiest seam.
- Storage modules live in three layouts: eleven `*Storage.ts` at
  `apps/web/src` root, `services/storage/`, and `services/*/…Storage.ts`.
- `express` / `cors` are `apps/web` runtime dependencies, used only by
  `proxy-server.ts`.
- `apiHandler.ts:63` caps `temperature` at 1 although OpenAI/Gemini accept 2 —
  provider policy enforced at the IPC validator.

## Suggested order

1. Fix CI ordering, get `main` green, push.
2. Move keys to main-process `safeStorage`; add a `baseUrl` scheme/host
   policy; add a renderer CSP and `will-navigate` guard.
3. Decide F3.
4. Freeze growth in the four largest files; split `useWorkspaceConsistency`
   by responsibility.
5. Transaction helper for canon acceptance.
