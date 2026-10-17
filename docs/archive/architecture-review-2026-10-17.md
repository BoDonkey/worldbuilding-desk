# Code Health + Architecture Review — 2026-10-17

**Type:** dated audit (archive convention, same as the fitness reports).
**Audited:** local `main` at `79fe92d` ("docs: record cypress-smoke for slice
4.65") with uncommitted Slice 4.66 work in progress (assistant selection
handoff; 13 files, +152/−14). Findings describe committed code unless they
name the in-progress diff.
**Compared against:** `docs/archive/architecture-review-2026-10-06.md`. The
intervening 35 commits landed Slices 3.17 and 1.4a, document-import fidelity
(4.54–4.56), Source Notes (4.57–4.61), and World Bible and assistant
readability work (4.62–4.65).
**Scope:** cleanliness and architecture tidiness, with emphasis on the
project's standing goal of breaking up monolithic files: file size, where
domain logic lives, persistence ownership, layering, test coverage of large
modules, and style-token use. No application code changed during the audit.
Durable conclusions are folded into `docs/architecture-review.md`;
implementation work is scheduled only in `docs/road-to-market.md`.

## Verification baseline

The audit ran on a machine without Node.js, so the automated battery was not
run. Every finding below comes from static inspection (`git`, `grep`, `wc`)
and must be re-checked against a green battery when its slice starts.

| Check | Result |
| --- | --- |
| Working tree | Slice 4.66 in progress (uncommitted) |
| File sizes (`wc -l`, same rule as `check:file-sizes`) | 7 non-test files over 1,500 lines, all at or below baseline; `WorkspaceRoute.tsx` 1,854 → 1,831 since 2026-10-06 |
| `pnpm check:file-sizes`, lint, unit tests, builds, Cypress | not run (no Node.js on the audit machine) |

## What improved

- The 1,500-line freeze holds. No file on the baseline grew, and the
  baseline shrank from 8 to 7 files.
- Slice 3.17 moved provider readiness, disclosure, budget, and execution
  into `hooks/useAssistantRequestPolicy.ts`; findings F1 and F2 of the
  2026-10-06 review are closed by 3.17 and 1.4a.
- `packages/rules-engine` stays framework-independent, and nothing imports
  its `experimental/` path. `apps/desktop` is small (largest file
  `ProviderRegistry.ts`, 553 lines), with tests for 6 of 9 source files.
- Hygiene markers are low: no TODO/FIXME/HACK in non-test source, 11
  `any`/`@ts-ignore`/`@ts-expect-error` sites, and 8 `eslint-disable`
  comments.

## Findings

### F1 — Persistence has no single owning boundary (high)

Twenty-eight non-test modules call `openDb` directly. Eleven repository
modules live at the `apps/web/src` root (`entityStorage.ts`,
`characterStorage.ts`, `writingStorage.ts`, `loreStorage.ts`,
`categoryStorage.ts`, `corkboardStorage.ts`, `scratchpadStorage.ts`,
`worldCanvasStorage.ts`, `projectStorage.ts`, `settingsStorage.ts`, `db.ts`).
Six routes and about 25 hooks import them directly, beside a separate
`services/storage/` folder that owns backup, migration, and transactions.
Several services (`canonDecisionStorage`, `loreFactStorage`,
`loreEntityProposalStorage`, `stateMutationLedger`, `compendiumService`,
`characterTransferService`) each open the database themselves. The same
`requestToPromise` helper is copied into 12 files.

Project-scoped reads load every project's records and filter in memory.
For example, `getEntitiesByProject` calls `getAllEntities` and filters by
`projectId`. Only two object stores (`worldCanvas`, `reviewRun`) have a
`projectId` index, so the cost of opening one project grows with the size of
all projects. Hooks such as `useWorkspaceProjectData` and
`useCharacterLabData` issue several of these full scans on load.

This conflicts with the architecture rule against new direct persistence
paths. It also blocks Slice 5.15: the vault design requires every
project-owned record to be "encrypted through the owning persistence
boundary," and today there is no single boundary to encrypt.

**Evidence:**

- `apps/web/src/entityStorage.ts:10-31`
- `apps/web/src/db.ts` (`createIndex` only at lines 94 and 233)
- `routes/CanonDecisionsRoute.tsx:15-18`, `routes/LoreRoute.tsx:17-26`,
  `routes/CharacterSheetsRoute.tsx:23-51`, `routes/CompendiumRoute.tsx:67-68`,
  `routes/ProjectsRoute.tsx:5-15`, `routes/RulesetRoute.tsx:8`
- `requestToPromise` copies, including `loreStorage.ts:15`,
  `services/compendium/compendiumService.ts:165`, and
  `services/storage/projectWriteTransaction.ts:24`

**Disposition:** roadmap Slices 3.23a (one storage layer and import guard)
and 3.23b (project indexes). Both before 5.15.

### F2 — Domain logic in large hooks and an untested service (high)

AGENTS.md requires domain logic to live in services or hooks rather than
route components, and the Phase 3 pattern moves pure logic into tested
services with no hook over 600 lines. Several modules fall outside that
pattern, and no test file references them by name:

| Module | Lines | Concern |
| --- | --- | --- |
| `hooks/useWorkspaceSceneRoster.ts` | 1,417 | `saveSelectionInventoryCapture` (lines 393–573) and `saveSelectionConsumptionCapture` (574–774) build state-mutation commands inside `useCallback`; timeline edit, expire, invalidate, and re-anchor actions (lines 972–1160) do the same |
| `services/compendium/compendiumService.ts` | 1,232 | persistence and mechanics logic with no unit tests; only `compendiumPresentation.ts` is tested |
| `hooks/useWorldBibleEntityActions.ts` | 1,125 | entity and character mutation orchestration |
| `hooks/useWorkspaceStatBlocks.ts` | 1,074 | stat-block derivation and actions |

By area, web services have 114 test files for 178 source files. Hooks have
12 for 55.

**Disposition:** roadmap Slices 3.21 (scene roster) and 3.22
(characterization tests, then extraction).

### F3 — The size freeze cannot see the next hotspots (medium)

`scripts/check-file-sizes.mjs` checks only files over 1,500 lines. Files just
below that limit can grow without limit until they cross it:

| File | Lines | Change since 2026-10-06 |
| --- | --- | --- |
| `hooks/useWorkspaceSceneRoster.ts` | 1,417 | 0 |
| `components/Workspace/WorkspaceContextDrawer.tsx` | 1,328 | +3 (4.66 WIP) |
| `components/Editor/EditorWithAI.tsx` | 1,306 | +21 (4.66 WIP) |
| `components/Settings/AISettings.tsx` | 1,262 | 0 |
| `services/consistency/ConsistencyEngineService.ts` | 1,250 | 0 |

Slice 3.14 brought `EditorWithAI.tsx` down to 1,285 and set a target of
"under 1,400"; it is drifting back toward that target.

**Disposition:** roadmap Slice 3.18.

### F4 — Route components hold per-form draft state (medium)

`routes/CompendiumRoute.tsx` declares 59 `useState` values. About 40 are
draft fields for separate forms: entry, import, recipe, milestone, preview,
zone, settlement module, and base stats (lines 146–197). The route already
delegates tabs to `EntriesTab` and `WorldSystemsTab`, but the drafts stay in
the route. Lore (39), Character Sheets (37), and World Bible (30) follow the
same pattern at smaller scale. `EditorWithAI.tsx` has 19 `useEffect` calls,
the pattern most prone to ordering bugs.

**Disposition:** roadmap Slice 3.20 for Compendium. The other routes continue
under the incremental extraction rule.

### F5 — Direct browser storage, including author text (medium)

Three routes repeat the same collapsed-rail flag in `localStorage`
(`CorkboardRoute.tsx:80,153`, `WorldBibleRoute.tsx:212,506`,
`LoreRoute.tsx:184,1101`). `CommandPalette.tsx` and
`SourceNoteStarterPanel.tsx` also write directly. These are UI preferences,
but they bypass the "owning service or store" rule and duplicate the same
code.

`components/WorldBible/WorldBibleMechanicsPanel.tsx:29-43` stores an
unfinished mechanic draft, including the name and default value the author
typed, as plaintext `localStorage` keyed by project and entity. Under 5.15,
that content would sit outside the vault.

**Disposition:** roadmap Slice 3.23c, before 5.15.

### F6 — Services import types from components (low)

`services/workspace/workspaceView.ts:11-15` imports `SceneRosterAddOption`,
`SceneRosterCharacterCard`, and `SceneRosterItemCard` from
`components/Workspace/SceneRosterPanel`. `services/workspace/workspaceConsultation.ts:1`
imports `LoreInspectorRecord` from `components/Editor/LoreInspectorPanel`.
These are type-only imports, but they make services depend on UI modules.

**Disposition:** folded into roadmap Slice 3.21.

### F7 — Undefined theme token and split style homes (low)

`--color-text-muted` is used in
`assets/components/common/ConsultationBudgetNotice.module.css:11,15` and
`assets/components/Settings/AISettingsForm.module.css:262,267`, but no
stylesheet defines it. `theme.css` defines `--color-text-primary`,
`--secondary`, and `--tertiary`. That text renders in the inherited color,
not a muted one. `assets/TipTapEditor.css` keeps 13 hardcoded colors, and
`App.css` has 3. Stylesheets live in two parallel folders
(`assets/components/`, 25 files; `styles/`, 15 files) plus a few colocated
files.

**Disposition:** roadmap Slice 3.19 for the token and hardcoded colors. The
folder split is noted, not scheduled.

### F8 — The durable risk list describes resolved work (low)

`docs/architecture-review.md` § Current Architecture Risks still lists the
assistant request-policy gap and pending-proposal readiness as scheduled
(risks 1–2), although Slices 3.17 (`aa500ea`) and 1.4a have landed. This is
the same drift the 2026-10-06 review recorded as F3.

**Disposition:** corrected as audit close-out, not scheduled as an
application slice.

## Scheduled order

1. **3.18 — Lower the size freeze to 1,000 lines.** Run after 4.66 closes,
   so the baseline records its final sizes.
2. **3.19 — Theme token and hardcoded editor colors.** Independent and
   extra small.
3. **3.20 — Compendium form extraction.** Independent.
4. **3.21 — Scene-roster mutation services.** Includes F6.
5. **3.22 — Characterization tests for untested domain modules.** Must land
   before 3.23a, because it adds the safety net that the storage move relies
   on.
6. **3.23a → 3.23b, 3.23a → 3.23c — Storage boundary.** All three must land
   before 5.15.
