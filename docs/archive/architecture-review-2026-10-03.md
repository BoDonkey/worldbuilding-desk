# Code Health + Architecture Review — 2026-10-03

**Type:** dated audit (archive convention, same as the fitness reports).
**Audited:** local `main` at `1074093` ("Mark roadmap slice 4.49 complete"),
in sync with `origin/main`.
**Compared against:** `docs/archive/architecture-review-2026-09-26.md`
(base `f7fc35e`). 28 commits since; 102 files, +10.7k / −1.3k. The window
landed Slice 3.10 (live state core into `rules-engine`), the character lab
(4.42–4.45), stat peek (4.46–4.48), and Ollama context parity (4.49).
**Scope:** code health and architecture boundaries. No code changed during
the audit. Durable conclusions are folded into the Current Architecture Risks
list in `docs/architecture-review.md`.

## Baseline

| Check | 2026-09-26 | 2026-10-03 |
| --- | --- | --- |
| `pnpm lint` | 1 carried warning | unchanged — same `ConsumableEffectEditor.tsx:65` `exhaustive-deps` warning |
| `tsc -b` (web) | clean | clean |
| Unit tests (web / rules-engine / rules-ui) | 696 / 6 / 12 | **763 / 14 / 12** — all pass |
| CI `web-verify`, `desktop-verify` | red (unit tests could not resolve `rules-engine`) | **green** |
| CI `cypress-smoke` | red (masked) | **red** — 115/117; 2 failing specs (see F1) |
| Non-test `any` in web | ~12 | 12 |
| `@ts-ignore` / `@ts-expect-error` | 0 | 0 |
| `pnpm audit --prod` | not recorded | 12 (6 high, 6 moderate) |

## Resolved or improved since 2026-09-26

- **Old F1 (CI could not build):** fixed by `apps/web` `pretest:unit`
  building the rules packages, plus a Vitest alias that resolves
  `@worldbuilding-desk/rules-engine` from `src`. Unit, lint, and build jobs
  now pass from a clean checkout.
- **Old F3 (two state models), partly:** Slice 3.10 (`90b64dd`) moved command
  types, schemas, ordering, application, and replay into
  `packages/rules-engine/src/manuscript/` (722 lines, 2 test files). The web
  `services/state/stateReplay.ts` and `stateMutationSchemas.ts` are now
  ~25-line re-export shims, and a replay-parity harness
  (`services/state/replayParity.test.ts`) guards the move. The package now
  owns the live model the architecture doc describes.
- New feature code mostly lands in the right layer: the character lab and
  stat peek put their logic in plain-TypeScript services with colocated tests
  (`services/characterLab/*`, `services/state/characterSnapshot.ts`,
  `characterPeek.ts`, `statPanel.ts`), with hooks (`useCharacterLabData`,
  `useCharacterStatPeekData`) doing the orchestration.
- Trust boundary holds in the character lab: character-from-description
  saves a draft entity and a Source Note, and quoted facts go in as
  `LoreFactProposal`s for the existing review rather than as canon
  (`services/characterLab/characterFromDescriptionStorage.ts`). Each lab
  dialog shows a per-provider data-flow notice, and the voice context is
  built from accepted facts, snapshot state, and dialogue style, not
  manuscript prose.
- 4.49 put context rendering behind one formatter
  (`services/llm/contextPrompt.ts`), so trust labels reach the model the same
  way on every provider and process. Without it there would be one more
  provider-specific path.

## Findings

### F1 — Cypress smoke has failed on CI since the new specs landed (high)

The only `main` run since 4.46 (`36319122392`, 2026-09-27) fails
`cypress-smoke` with 2 of 24 specs red:

- `character-lab.cy.ts` › *character scenes › writes a directed scene … and
  inserts it as an undoable edit*. The assertion expected only the inserted
  text (`'Borin laughs, and does not.'`), but the editor held the whole
  document (`'Aria: "Put the hammer down."Borin laughs, and does not.Alpha
  content'`).
- `stat-peek.cy.ts` › *peeks by shortcut on rostered and non-rostered
  characters*. The selected text was cut off by one character
  (`'…while Borin s'` vs `'…while Borin'`).

Both are editor-selection/insertion timing assertions that pass locally
(`abc36fe` already tried a fix for the second). So the green verification
recorded for 4.43–4.49 on the status board was local-only. The CI gate the
previous review restored is red again. The failures look like flakes, and a
red gate that people learn to ignore loses most of its value.

### F2 — Provider API keys still in plaintext `localStorage` (high; unchanged, and unscheduled)

Unchanged since 2026-09-26: `components/Settings/AISettings.tsx:105-145`
reads and writes `*_api_key` in `localStorage`. `apps/desktop/src/main/apiHandler.ts:139`
still only type-checks `providerConfig.baseUrl`. There is no `safeStorage`,
renderer CSP, or `will-navigate` guard anywhere in `apps/desktop/src` or
`apps/web/index.html`.

**New in this review:** `docs/architecture-review.md` says these risks "are
prioritized and scheduled in `docs/road-to-market.md`", but the status board
has no slice for key storage, endpoint policy, or CSP. The same goes for F4
and F5 below. Only the rules-engine work (3.10/3.11) was scheduled. This
risk is the main gap between the trust posture in the doc and the code, and
it gets worse with every hosted-provider feature (4.43–4.45 added three).

### F3 — Rules-engine: dormant runtime still exported; typed rules pending (medium)

3.10 fixed the "two state models" problem. What is left is Slice 3.11's
scope, still `—` on the board:

- `RulesEngine`, `EffectApplicator`, `FormulaParser`, and `StateManager`
  (1,543 lines across `engine/` + `state/`) are still exported from the
  package root and still unused by the app.
- `WorldRuleset.rules`, `itemTemplates`, and `statusTemplates` are still
  `z.array(z.any())` (`types/WorldRuleset.ts:84-88`).
- `FormulaParser` still uses `mathjs` without restrictions.

3.11 is the right next step. It is small and should land before any feature
reads authored `GameRule`s.

### F4 — Hotspots: growth continues; direct storage imports spreading (medium)

| File | 2026-09-26 | 2026-10-03 |
| --- | --- | --- |
| `routes/WorkspaceRoute.tsx` | 2171 | **2286** |
| `hooks/useWorkspaceConsistency.ts` | 2234 | 2234 |
| `routes/WorldBibleRoute.tsx` | 2178 | **2229** |
| `routes/CharacterSheetsRoute.tsx` | 2126 | 2126 |
| `routes/LoreRoute.tsx` | 1827 | 1841 |
| `components/Editor/EditorWithAI.tsx` | 1343 | **1626** (+21%) |
| `components/Workspace/WorkspaceContextDrawer.tsx` | 1245 | 1303 |

The freeze the last review recommended was not adopted. `WorkspaceRoute` is
now further over the < 2,000 target Slice 3.2 reached, and `EditorWithAI`
absorbed the stat-peek and character-scene insertion paths, making it the
fastest-growing file.

Direct storage imports in UI code also spread. New since 2026-09-26:

- `components/CharacterLab/CharacterLabDialog.tsx`, `CharacterSceneDialog.tsx` → `scratchpadStorage`
- `components/CharacterLab/CharacterFromDescriptionDialog.tsx` → `characterFromDescriptionStorage`
- `components/StatPinPanel.tsx` → `writingStorage`

So 6 routes and 11 components now import `*Storage` modules directly. Each
case is small. The trend still runs against "no new direct persistence
paths", and the character-lab hook already in place
(`useCharacterLabData`) is the obvious owner for the scratchpad writes.

### F5 — Canon acceptance is non-atomic (medium; unchanged, unscheduled)

There is still no multi-store transaction helper. `entityProposalActions.ts`
and `canonicalFactActions.ts` still issue sequential awaited writes. The new
`saveCharacterFromDescription` also writes sequentially, but it documents a
failure-safe order (draft entity → note → link → proposals), and every
partial state is ordinary unreviewed material. That is a reasonable pattern
when a transaction isn't practical. It could be the stopgap for canon
acceptance too, until a transaction helper exists.

### F6 — Dependency advisories (medium; new data)

`pnpm audit --prod`: 12 advisories (6 high). The ones that matter:

- `@tiptap/core` (high + moderate). This is the editor itself, and it
  handles author content and model-inserted text.
- `sharp` (high) and `adm-zip` (high; despite the `^0.6.0` override) via
  `@huggingface/transformers` → `onnxruntime-node`.
- `qs` (moderate) via `express`, which is a web runtime dependency only
  because of `proxy-server.ts` (carried from the previous review).

The full tree reports 72 (39 high), mostly dev tooling. No audit step
runs in CI.

### F7 — Smaller items (carried)

- `apps/desktop` still has no tests and no lint script; `pnpm lint` covers 4
  of 5 workspace projects. It had no changes in this window, but it holds
  the IPC validator from F2.
- Ad hoc `localStorage` use: 22 non-test files, including 3 routes and
  `useWorkspaceConsistency`, still without a shared preferences helper.
- Storage modules still live in three layouts (`src/*Storage.ts`,
  `services/storage/`, `services/*/…Storage.ts`), and the character lab
  added a fourth naming style (`services/characterLab/characterFromDescriptionStorage.ts`).
- `apiHandler.ts` still caps `temperature` at 1.

## Suggested order

1. **Get `cypress-smoke` green** (F1): fix or make deterministic the two
   editor-timing assertions, then hold "CI green" as part of slice close-out.
2. **Put F2, F4, F5 on the roadmap.** The architecture doc already claims
   they are scheduled. Suggested slices: key storage + endpoint policy + CSP
   (before 5.3 packaged validation, and before beta 6.1); a hotspot freeze
   plus `EditorWithAI` / `WorkspaceRoute` extraction; and a canon-acceptance
   transaction helper or ordered-write stopgap.
3. **Land 3.11** (F3).
4. **Triage `@tiptap/core`** and the transformers chain (F6); consider a
   non-blocking `pnpm audit --prod` CI step.
5. Move the new direct storage imports behind their owning hooks (F4).
