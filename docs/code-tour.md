# Code Tour

Last checked against the code: 2026-11-20 (slice 3.33).

A map of where the code lives and how it connects, for the author first and
any coding agent second. It takes 15–20 minutes to read. The rules and
boundaries are in `docs/architecture-review.md` and `docs/domain-model.md`;
this tour points at them and does not repeat them.

Paths under `apps/web/src/` are written relative to that folder (so
`services/storage/db.ts` means `apps/web/src/services/storage/db.ts`). Every
other path starts at the repository root. `node scripts/check-code-tour.mjs`
checks that every path and symbol named here still exists; CI runs it.

**Keep it current.** A slice that moves a seam, renames a folder, or changes a
traced path updates this tour in the same PR (`AGENTS.md`).

## 1. Mental model

```
 apps/web (React, runs in the browser or in Electron's window)
 ┌─────────────────────────────────────────────────────────────────────┐
 │ routes/            one screen each; compose hooks and components     │
 │   │                                                                  │
 │   ▼                                                                  │
 │ hooks/             React state for one workflow; call services       │
 │   │                                                                  │
 │   ▼                                                                  │
 │ services/<area>/   domain logic, plain TypeScript, unit-tested       │
 │   │         │                         │                              │
 │   │         │                         └── services/llm/LLMService ───┼──┐
 │   ▼         ▼                                                        │  │
 │ services/storage/   rag/, shodh/  (derived indexes, rebuildable)     │  │
 │   │  (only door to IndexedDB; vault seals records here)              │  │
 └───┼─────────────────────────────────────────────────────────────────┘  │
     ▼                                                                    │
  IndexedDB  `worldbuilding-db` + `worldbuilding-desk` (rulesets)         │
             + one `rag-<project>` and `shodh-memory-<project>` each      │
                                                                          │
 packages/rules-engine  replay, schemas, rules  ◄── imported by services  │
 packages/rules-ui      React wizard/forms for rules ◄── imported by UI   │
                                                                          │
 apps/desktop (Electron main process)                                     │
 ┌────────────────────────────────────────────────────────────────────┐   │
 │ preload.ts  exposes window.electronAPI (fixed channel names) ◄─────┼───┘
 │ apiHandler.ts  llm:*, provider-keys:*   → providers/ProviderRegistry │
 │ providerKeyVault.ts  keys encrypted with the OS keychain            │
 │ updateIpc.ts / updates.ts  app updates                              │
 └────────────────────────────────────────────────────────────────────┘
                     │ HTTPS / localhost
                     ▼
        Anthropic, OpenAI, Gemini, Ollama, local OpenAI-compatible server
```

- **Routes** (`routes/`, wired in `App.tsx`) decide what a screen shows.
  They should not hold domain logic (`docs/architecture-review.md`, Web UI).
- **Hooks** (`hooks/`) hold one workflow's React state and call services.
  Most are named after the screen and feature, for example
  `useWorldBibleEntityActions`.
- **Services** (`services/`) are plain TypeScript and the place to look for
  behavior. Storage is reached only through `services/storage/index.ts`;
  ESLint rejects deep imports into that folder and `indexedDB` anywhere else.
- **AI requests** all go through `LLMService` (`services/llm/LLMService.ts`).
  In the desktop app it sends them to the main process over IPC, and the main
  process holds the keys and makes the network call. The browser dev build
  calls the provider classes in `services/llm/providers/` directly.
- **`packages/rules-engine`** has no React. It owns manuscript-time state
  replay (`packages/rules-engine/src/manuscript/`), ruleset schemas, and rule
  evaluation. The app re-exports replay through
  `services/state/stateReplay.ts`.
- **`packages/rules-ui`** holds the reusable rules authoring components
  (`packages/rules-ui/src/components/wizard/`) used by the Rules route.

## 2. Folder map

**Core** is code most changes touch or depend on. **Peripheral** is a single
feature or support code you can usually ignore until you work on it.

### `apps/web/src/`

| Folder | Holds | |
|---|---|---|
| `routes/` | One component per screen; the route table is in `App.tsx` | core |
| `hooks/` | Workflow state for routes and components | core |
| `services/` | Domain logic, storage, AI, retrieval (see below) | core |
| `components/` | UI, one folder per screen or feature; shared pieces in `components/common/` | core |
| `entityTypes.ts` | The record types every layer shares | core |
| `store/` | Zustand stores: app shell and active project (`store/appStore.ts`), Workspace layout, notifications | core |
| `styles/` | Route CSS modules and the theme tokens (`styles/theme.css`) | core |
| `extensions/` | TipTap editor extensions: AI text mark, stat-block tokens | peripheral |
| `commands/` | Command palette registry and Workspace commands | peripheral |
| `contexts/` | React contexts: theme, accessibility, command palette | peripheral |
| `config/` | Editor configuration | peripheral |
| `utils/` | Small helpers: downloads, zip/unzip, text, browser preferences | peripheral |
| `help/` | In-app Help topics and search | peripheral |
| `fixtures/` | Sample project and trust-dogfood fixture content | peripheral |
| `generated/` | Generated craft library data (do not edit by hand) | peripheral |
| `types/` | The `window.electronAPI` type (`types/electron.d.ts`) | peripheral |
| `assets/` | Editor CSS and older component CSS modules (`assets/components/`) | peripheral |
| `test/` | Vitest setup and test helpers | peripheral |

`projectMode.ts` decides which features a project's mode turns on (General
Fiction, LitRPG, Game Simulation).

### `apps/web/src/services/`

| Folder | Holds | |
|---|---|---|
| `services/storage/` | IndexedDB connection, one repository per store (`services/storage/repositories/`), migrations, backup export/import, the vault (`services/storage/vault/`) | core |
| `services/llm/` | `LLMService`, providers, AI switches, context budget, model runs | core |
| `services/state/` | State changes through the manuscript: save, validate, scene order, snapshots | core |
| `services/consistency/` | The consistency engine: names, contradictions, review items | core |
| `services/lore/` | Source Notes, fact and record proposals, canon decisions, accepted facts | core |
| `services/worldBible/` | World Bible records: save, places, maps, merge, import, World Canvas | core |
| `services/characters/` | Character identity, intake, sheets, transfer | core |
| `services/assistant/` | The assistant chat's turn planning and context, selection actions, scene revisions | core |
| `services/rag/` | Retrieval index (`RAGService`), one database per project | core |
| `services/shodh/` | Project memory (`ShodhMemoryService`), one database per project | core |
| `services/workspace/` | Scene roster, Find, chapter card links, stat-block resolution | core |
| `services/worldEngine/` | Scene review: deterministic, or with local AI annotations | core |
| `services/editor/` | AI text provenance, the AI text report, inspector budget | core |
| `services/errors/` | `describeError` and the local diagnostics buffer | core |
| `services/compendium/` | Compendium entries and runtime modifiers (LitRPG) | peripheral |
| `services/rules/` | Ruleset service and ruleset import/export | peripheral |
| `services/characterLab/` | Talk to a character, character scenes, character from a description | peripheral |
| `services/characterCards/` | Character card import and export | peripheral |
| `services/coach/` | Writing coach consultation | peripheral |
| `services/craft/` | Craft library search for the coach | peripheral |
| `services/contextHealth/` | Index coverage checks and rebuild of the RAG/Shodh indexes | peripheral |
| `services/portability/` | Markdown/CSV portable export and import | peripheral |
| `services/prompts/` | Prompt templates (`PromptManager`) | peripheral |
| `services/onboarding/` | First run, sample project, dogfood fixture | peripheral |
| `services/progressionContinuity/` | Progression continuity review (LitRPG) | peripheral |
| `services/sceneDraft/` | Draft this scene | peripheral |
| `services/seriesBible/` | Series canon shared between projects | peripheral |
| `services/dashboard/` | Story dashboard numbers | peripheral |
| `services/names/` | The one name matcher (`services/names/nameMatching.ts`) | peripheral |
| `services/retrieval/` | Lexical search scoring | peripheral |
| `services/embeddings/` | Bundled embedding model loader | peripheral |
| `services/system/` | System history (LitRPG notifications) | peripheral |

`services/recordEvents.ts` names the window events (`RECORDS_CHANGED`) that
repositories fire after a write, so open screens can reload.

### Other packages

| Path | Holds |
|---|---|
| `apps/desktop/src/main/` | Electron main process: window, IPC, providers, key vault, data folder, updates |
| `apps/desktop/e2e/` | Playwright tests against the packaged desktop app |
| `apps/web/cypress/e2e/` | Cypress browser tests, one spec per workflow |
| `packages/rules-engine/src/` | Rules and state core (`packages/rules-engine/src/manuscript/`, `packages/rules-engine/src/engine/`; `packages/rules-engine/src/experimental/` is not exported) |
| `packages/rules-ui/src/` | Rules authoring components and hooks |
| `scripts/` | File-size check, this tour's check, CI planning (`scripts/ci/`) |

## 3. Traced features

Each trace names the files in the order a request passes through them.

### 3.1 Saving a World Bible record

1. `components/WorldBible/record/WorldBibleRecordEditor.tsx`: the author
   presses Save, which calls `saveEntityDraft`.
2. `hooks/useWorldBibleEntityActions.ts`: `saveEntityDraft` builds the record
   and its alias list with `planEntityDraft`
   (`services/worldBible/worldBibleEntityPlans.ts`).
3. `services/worldBible/worldBibleRecordSave.ts`: `saveWorldBibleRecord` is
   the one save path (slice 3.45). Imports, merges, accepted proposals, and
   the place queue call it too.
   - `applyWorldBibleRecordRules` runs the place rules for location records
     (`normalizePlaceData` in `services/worldBible/places.ts`: missing links
     dropped, a parent that would make a cycle refused).
   - `saveEntity` (`services/storage/repositories/entityStorage.ts`) writes
     the record and fires `RECORDS_CHANGED`.
   - `replaceAliasesForEntity`
     (`services/storage/repositories/aliasStorage.ts`) replaces its aliases.
   - `indexWorldBibleRecords` calls `indexWorldBibleEntity`
     (`services/worldBible/indexWorldBibleEntity.ts`), which updates
     `RAGService` and `ShodhMemoryService`. A failure there does not undo the
     save; a rebuild catches it up.
4. Back in the hook, the saved record and aliases replace the copies in
   React state.

Tests: `services/worldBible/worldBibleRecordSave.test.ts`,
`apps/web/cypress/e2e/post-merge-smoke.cy.ts`.

### 3.2 Running a custom AI selection action

The trust boundary in action: the model proposes, the author approves.

1. `components/Editor/EditorSelectionMenu.tsx` shows the actions through
   `SelectionMenuAIEntries` (`components/Editor/SelectionMenuAIEntries.tsx`).
2. `hooks/useSelectionActionRun.ts` (created in `routes/WorkspaceRoute.tsx`):
   - **Switch check.** `menuSelectionActions`
     (`services/assistant/selectionActions.ts`) lists only actions whose AI
     switch is on: notes need coaching, rewrites need prose
     (`selectionActionFeature`).
   - **Budget.** `useConsultationBudget` refuses once today's consultations
     are spent.
   - **Prompt.** `selectActionRecords` picks the World Bible records the
     selection names and their accepted facts; `buildSelectionActionPrompt`
     builds the request.
3. `hooks/useFeatureModelRun.ts` checks provider readiness and the budget
   and spends one consultation under the action's feature;
   `hooks/useModelRun.ts` runs the streamed, stoppable request.
4. **Provider.** `services/llm/LLMService.ts`: `assertFeatureAllowed` refuses
   the request if its switch is off (`services/llm/aiSwitches.ts`), before
   the cache or a provider. In the desktop app, `completeViaElectron` sends it
   through `apps/desktop/src/main/preload.ts` to
   `apps/desktop/src/main/apiHandler.ts`, which calls the provider in
   `apps/desktop/src/main/providers/ProviderRegistry.ts`.
5. **Proposal.** A note opens read-only in
   `components/Workspace/WorkspaceSelectionActionPanel.tsx`. A rewrite is
   cleaned (`cleanReplaceResult`), tagged with `buildAITextProvenance`
   (`services/editor/aiTextProvenance.ts`), and handed to the editor as a
   pending insert (`hooks/useWorkspaceContextActions.ts`).
6. **Author approval.** `components/TipTapEditor.tsx` shows
   `SceneRevisionPreview` (`components/Editor/SceneRevisionPreview.tsx`). On
   Confirm, `applySceneRevision` (`services/assistant/sceneRevision.ts`)
   applies it as one undoable change, and only if the scene still matches what
   the model saw. The text is marked as AI text (`extensions/AITextMark.ts`),
   and the scene as it was is kept as an automatic snapshot
   (`takeSceneSnapshot`, `services/editor/sceneSnapshots.ts`).

Tests: `hooks/useSelectionActionRun.test.tsx`,
`services/llm/aiSwitches.test.ts`, `apps/web/cypress/e2e/ai-actions.cy.ts`.
Manual: `docs/smoke-tests.md` § 1i.

### 3.3 Replaying character state through the manuscript

A sheet holds starting values. Everything after that is a ledger of accepted
changes, each tied to a scene, replayed in scene order
(`docs/domain-model.md` § 3).

**Writing a change.**

1. `components/Workspace/PositionedStateChangeComposer.tsx` collects the
   commands; `hooks/useWorkspaceSceneRoster.ts` turns them into a
   `StateMutationEvent` for the scene. (Sheets save through
   `hooks/useCharacterSheetSceneChanges.ts` the same way.)
2. `services/state/stateChangeSave.ts`: `saveStateChange` checks it with
   `assertStateChangeValid` (`services/state/stateChangeValidation.ts`: shape,
   ruleset, and the replayed state before each command), then
   `saveStateChangeRecord` links position names to place records and writes
   it with `saveStateMutationEvents`
   (`services/storage/repositories/stateMutationLedger.ts`).
   `acceptStateChangeProposal` reloads the ledger first, so a suggestion is
   checked against the story as it is now.

**Reading state at a point in the story.**

1. `hooks/useCharacterStatPeekData.ts` (stat peek and the pinned stat panel)
   calls `loadStateMutationEventsInSceneOrder`
   (`services/state/stateSceneOrder.ts`), which puts the ledger in current
   scene order and saves any repair. Always read the ledger through it, not
   the repository.
2. `buildCharacterSnapshot` (`services/state/characterSnapshot.ts`) calls
   `replayCharacterState` (`packages/rules-engine/src/manuscript/replay.ts`)
   with a cutoff: scene opening, cursor, or scene ending.
3. Replay applies each accepted command through `applyStateMutationCommand`,
   one module per change kind in `packages/rules-engine/src/manuscript/kinds/`.
4. The snapshot adds runtime modifiers (Compendium) and names, and
   `components/CharacterStatPeekDialog.tsx` or `components/StatPinPanel.tsx`
   shows it.

Tests: `packages/rules-engine/src/manuscript/replay.test.ts`,
`services/state/characterSnapshot.test.ts`,
`services/state/stateChangeSave.test.ts`,
`apps/web/cypress/e2e/stat-peek.cy.ts`.

### 3.4 Backup and restore

**Export.** `routes/ProjectsRoute.tsx` →
`exportProjectBackupZip` (`services/storage/projectBackupExport.ts`) →
`buildProjectSnapshot` (`services/storage/projectSnapshotService.ts`) reads
every project store → zipped (`utils/zip.ts`), and with a passphrase sealed
by `encryptBackup` (`services/storage/backupEncryption.ts`) →
`triggerBytesDownload` (`utils/downloadJson.ts`).

**Import.**

1. `components/Projects/ProjectBackupImportPanel.tsx` with
   `hooks/useProjectBackupImport.ts` (a passphrase prompt from
   `hooks/useBackupPassphraseFlow.tsx`).
2. `parseProjectBackupZip` (`services/storage/projectBackupImport.ts`)
   unzips or decrypts it, then `normalizeProjectSnapshot` runs the snapshot
   migrations (`migrateProjectSnapshotPayload` in
   `services/storage/projectSnapshotMigrations.ts`) and validates it.
3. `importProjectBackup`: as a new project, every id is remapped
   (`remapImportedSnapshot`, `services/storage/projectBackupIdRemap.ts`); a
   merge keeps ids. `assertNoProjectBackupCollisions`
   (`services/storage/projectBackupCollisions.ts`) refuses, before any write,
   an import that would overwrite another project's record. Then it writes
   the records.
4. Back in the hook, `diffSnapshotCounts`
   (`services/storage/projectSnapshotService.ts`) compares the records now
   stored with the backup's counts and reports any difference.
5. The RAG and Shodh indexes are not in the backup. They are rebuilt from the
   restored records (section 4).

Tests: `services/storage/projectBackupIdRemap.test.ts`,
`services/storage/projectBackupCollisions.test.ts`,
`apps/web/cypress/e2e/encrypted-backup.cy.ts`,
`apps/desktop/e2e/backup-files.e2e.ts`. Manual: `docs/smoke-tests.md` § 1.

## 4. Where data lives

**IndexedDB, primary data.** The `worldbuilding-db` database
(`services/storage/db.ts`) holds every project's records, one object store per
kind; the store names are the constants at the top of that file. Rulesets
live in a second database, `worldbuilding-desk`
(`services/storage/repositories/rulesetStorage.ts`). Both open through
`openDb()`, so a protected project's records are sealed by the vault
(`services/storage/vault/`). Three version numbers are separate contracts:
`DB_VERSION` (store layout), each project's storage schema version
(`services/storage/projectSchemaMigrations.ts`), and the backup snapshot's
`schemaVersion` (`services/storage/projectSnapshotMigrations.ts`).

**IndexedDB, derived indexes (rebuildable).** Each project has a retrieval
database `rag-<project>` (`RAGService`) and a memory database
`shodh-memory-<project>` (`ShodhMemoryService`). Both open through
`openDerivedRecordStore` (`services/storage/derivedRecordStore.ts`), which
keeps a protected project's indexes in memory only. Rebuild either from saved
records with `rebuildProjectContextHealth`
(`services/contextHealth/contextHealthRebuild.ts`): Source Notes (the Lore
route) → context health panel → Rebuild (`components/SourceNotes/SourceNoteContextHealthPanel.tsx`).
Unlocking a vault rebuilds them automatically
(`services/contextHealth/vaultContextLifecycle.ts`).

**Browser storage.** Preferences and a few content keys in `localStorage`
and `sessionStorage`. The full list and what a vault does with each is the
browser storage inventory in `docs/architecture-review.md`.

**In memory only.** The 5-minute AI response cache (`LLMCache`), vault data
keys (a reload locks every vault), and protected projects' indexes.

**Files on disk (desktop app).** The app's data folder, `SagaSpine`
(`apps/desktop/src/main/dataFolder.ts`), holds Electron's copy of the
databases above and a file named provider-keys.json, the provider keys encrypted with
the OS keychain (`apps/desktop/src/main/providerKeyVault.ts`). Backups and
exports are ordinary downloads wherever the author saves them.

## 5. Troubleshooting playbook

| Symptom | Look first | Covered by |
|---|---|---|
| A saved record doesn't show in search or assistant answers | `indexWorldBibleEntity`; then rebuild from the context health panel | `services/rag/RAGService.test.ts`, `apps/web/cypress/e2e/ask-project.cy.ts` |
| A stat or item is wrong at a scene | `loadStateMutationEventsInSceneOrder`, then `replayCharacterState` | `services/state/replayParity.test.ts`, `apps/web/cypress/e2e/stat-peek.cy.ts` |
| A state change is refused | `findStateChangeIssues` (`services/state/stateChangeValidation.ts`) | `services/state/stateChangeValidation.test.ts` |
| An AI feature is missing or refuses | `readAISwitches` and `aiSwitchRefusal` (`services/llm/aiSwitches.ts`), then the budget (`hooks/useConsultationBudget.ts`) | `apps/web/cypress/e2e/ai-switches.cy.ts`, `apps/web/cypress/e2e/consultation-budget.cy.ts` |
| A provider call fails only in the desktop app | `apps/desktop/src/main/apiHandler.ts` and `apps/desktop/src/main/endpointPolicy.ts` | `apps/desktop/e2e/llm-streaming.e2e.ts` |
| A rewrite preview won't apply | `applySceneRevision`: the scene changed after the run | `apps/web/cypress/e2e/ai-scene-revision.cy.ts` |
| Scene review flags a name wrongly or misses one | `services/consistency/mentionExtraction.ts`, `services/names/nameMatching.ts` | `services/consistency/ConsistencyEngineService.test.ts`, `apps/web/cypress/e2e/lore-review-matching.cy.ts` |
| A backup won't import | `normalizeProjectSnapshot`, then `assertNoProjectBackupCollisions` | `apps/web/cypress/e2e/encrypted-backup.cy.ts`; `docs/smoke-tests.md` § 1 |
| A locked project shows content or loses it | `services/storage/vault/` and `services/storage/vault/projectBrowserStorage.ts` | `apps/web/cypress/e2e/project-vault.cy.ts`, `apps/desktop/e2e/project-vault.e2e.ts` |
| A project won't open after an update | `services/storage/projectSchemaMigrations.ts` | `services/storage/projectSchemaMigrations.test.ts` |
| An error message is vague | `describeError` (`services/errors/describeError.ts`); recent errors in the diagnostics buffer | `apps/web/cypress/e2e/local-diagnostics.cy.ts` |
| Colors wrong in one theme | Tokens in `styles/theme.css` | `styles/themeTokens.test.ts` |
| CI ran more (or fewer) browser tests than expected | `scripts/ci/plan.mjs` | `scripts/ci/plan.test.mjs` |

## 6. Glossary

- **Canon.** What the author has accepted as true: World Bible records plus
  accepted canonical facts (`CanonicalFact`). Never written by a model
  directly.
- **Source Notes.** Free-form source material (`LoreDocument`, the Lore
  route). Searchable, never canon on its own.
- **Proposal.** A candidate fact or record extracted from Source Notes or
  suggested by AI, waiting for the author (`docs/domain-model.md` § 1, § 5).
- **Canon decision.** A group of conflicting or related proposals the author
  settles on the Canon Decisions route.
- **State ledger.** The accepted state changes (`StateMutationEvent`), each
  tied to a scene. Replay in scene order gives a character's state at any
  point.
- **State-change kind.** One command type, such as `resource_change` or
  `location_set`, with its module in
  `packages/rules-engine/src/manuscript/kinds/`.
- **Ruleset.** A project's stats, resources, and rules (`WorldRuleset`).
- **Compendium.** LitRPG items, skills, recipes, and milestones; it feeds
  runtime modifiers into snapshots.
- **RAG.** Retrieval: chunks of scenes, records, and notes searched to give
  the assistant context (`RAGService`). Derived and rebuildable.
- **Shodh.** Project memory: short summaries of records and accepted facts
  (`ShodhMemoryService`). Derived and rebuildable.
- **AI switches.** Two per-project switches, both off by default:
  **coaching** (notes, review annotations, talk to a character) and **prose**
  (text that can enter the manuscript). Every request carries a feature tag
  that maps to one switch.
- **Consultation budget.** The daily cap on AI requests per project.
- **Provider.** An AI service (hosted or local) behind `LLMService`.
- **AI text.** Text a model wrote that the author applied; it keeps a mark
  and provenance (`buildAITextProvenance`) for the AI text report.
- **Selection action.** A custom AI action run on selected text (slice 5.19).
- **World Engine.** Scene review: deterministic, optionally with local AI
  annotations (`services/worldEngine/`).
- **Vault.** Optional per-project encryption with a passphrase
  (`services/storage/vault/`).
- **Project mode.** General Fiction, LitRPG, or Game Simulation
  (`projectMode.ts`); decides which systems are on.
- **World Canvas.** The planning space: Core Idea, sketches, Open Threads.
  Never canon.
- **Corkboard.** Chapter cards linked to scenes.
