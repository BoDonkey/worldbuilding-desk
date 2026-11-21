> **Archived on creation, 2026-11-21.** This is a dated, read-only review of
> the code at one commit. It is evidence, not a plan. Nothing here is
> scheduled until the author copies a slice onto the status board in
> `docs/road-to-market.md`. Durable boundaries live in
> `docs/architecture-review.md`; current truth lives in `PROJECT_STATUS.md`.
> Line numbers are for commit `9760aae` and will drift.

# Code Cleanliness Review — 2026-11-21

**Audited:** `main` at `9760aae` ("Merge pull request #148 from
BoDonkey/claude/code-tour"), after every author-independent 3.x slice had
shipped and before the next dogfood round.
**Compared against:** `docs/archive/architecture-review-2026-11-13.md`.
**Judged against:** `AGENTS.md`, `docs/architecture-review.md`,
`docs/code-tour.md`, and `scripts/file-size-baseline.json`.
**Scope.** A cleanliness pass, not a full architecture review: dead code,
copies that can drift, write paths nobody reads, and leftovers from the
3.32–3.61 refactors. The AI trust boundary was not re-traced; no slice since
the last review changed a model path.
**Changed by this review:** this file only.

**Paths.** A path with no prefix is relative to `apps/web/src/`.

**Labels.** CONFIRMED means I read every step of the path in the code, or a
tool reported it. WORTH A LOOK means the mechanism is in the code but I did
not prove the effect. Nothing was run in the app.

## Verification baseline

| Check | Result |
| --- | --- |
| `npx tsc -b` in `apps/web` | passed |
| `pnpm lint` | 0 errors, 1 warning: `components/Mechanics/ConsumableEffectEditor.tsx:66` (`react-hooks/exhaustive-deps`), the same warning as the last review |
| `pnpm check:file-sizes` | passed: 0 files over 1,000 lines, baseline empty |
| `pnpm check:code-tour` | passed: 211 paths, 83 symbols |
| `pnpm test` | web 280 files / 1,659 tests; rules-engine 13 / 70; rules-ui 6 / 13; desktop 10 / 54. All passed. |
| Web build, Cypress, desktop E2E | not run |

Leftover markers are nearly gone: one `TODO` (`packages/rules-engine/src/utils/DiceRoller.ts:11`, a feature note), no stray `console.log` (the rules engine's are behind `enableLogging`), no `@ts-ignore`. All eight `eslint-disable` lines carry a reason.

## Scoring the 2026-11-13 review

All 18 proposed slices shipped (3.38–3.55), plus five follow-ons (3.56–3.61).
The file-size baseline went from four files to none. What it got wrong or
left incomplete:

- **D7 named the location hint lists but not the character ones.** 3.52 gave
  locations one predicate (`services/worldBible/locationCategory.ts`). The
  same problem for characters is still there and now saves different data
  depending on where you click (K1).
- **D7 missed `sanitizeFileNamePart`.** 3.61 found three copies and left them.
- **The dead-code section (X1–X4) looked for unimported code, not
  unread data.** Two IndexedDB stores are written on every review and never
  read (K2).
- **The lint warning in its baseline was never scheduled.** It is still the
  only warning.

Accuracy held up: every finding I re-checked was real. No reviewer change is
needed, but the next review should also look for write-only stores and for
predicates copied by name rather than by text.

## Summary: what matters before dogfooding

1. **The review list and the inline popover disagree about which categories
   are characters**, so resolving the same unknown name in the two places can
   save different aliases. (K1, medium)
2. **Every scene review stores a full copy of the scene text in two stores
   that nothing reads.** They grow for the life of the project and go into
   every vault. (K2, medium)
3. **Backup and restore list their stores by hand in four places**, with no
   test that ties them to the schema. Nothing is missing today. (K3, low)

Everything else is small: dead exports, a few copied helpers, and dialog
behaviour that differs from dialog to dialog.

---

## K1 — Two rules for "is this a character category"

**CONFIRMED · medium · S**

Since CX-4 a category has `kind: 'character' | 'general'`. Most code uses it.
Three places still guess from the category's name or slug:

- `components/Workspace/WorkspaceReviewIssueItem.tsx:72-79` defines its own
  `isCharacterLikeCategory` that matches `character`, `npc`, `person`, or
  `people` anywhere in the slug or name. It has the same name as the
  kind-based function in `services/workspace/workspaceView.ts:622`, which
  `WorkspaceReviewSurfacePopover.tsx:105` and
  `WorkspaceManualWorldCapturePopover.tsx:83` use.
- In the review item, that flag decides the alias preview (`:149-156`), and
  the preview is what **Create** saves (`:344`).
- `services/worldBible/worldBibleEntityPlans.ts:15`, `:21-26`
  (`isCharacterLikeEntity`, used by `WorldBibleEntityList.tsx:81`) and
  `:87-89` (whether a new record gets a first-name alias) use the same
  substring rule, the last on the slug only.

There are also two identical kind-based `isCharacterCategory` functions,
`services/worldBible/worldBibleSummary.ts:41` and
`services/characters/characterIdentity.ts:87`, each with its own importers,
and an exported `CHARACTER_CATEGORY_HINTS` in `worldBibleSummary.ts:18` that
nothing imports.

**Example.** A character category named "Cast" or "Heroes": the popover
offers first-name aliases, the review list does not, and a new record in it
gets no first-name alias. A general category named "Personnel" or "Peoples
of the North": the review list and the record editor treat it as characters.

**Suggested fix.** One kind-based predicate (keep
`characterIdentity.ts`), delete the other copy, the local shadow in the
review item, and the unused hint export; switch `worldBibleEntityPlans.ts` to
the category's `kind`. Keep the hint list in `inferLegacyCategoryKind`
(`characterIdentity.ts:62`): that is the migration's guess, which is the one
place a guess belongs. The hint lists in `unknownCategorySuggestion.ts:181`
and `worldCanvasService.ts:87` suggest a category for an unknown name and can
stay. Add a test with a character category whose name has none of the hint
words.

## K2 — The consistency engine writes two stores that nothing reads

**CONFIRMED (write-only) · medium · S · WORTH A LOOK (size)**

- `services/consistency/ConsistencyEngineService.ts:224-227` saves every
  extracted proposal, including the full scene text (`text: input.text`,
  `:214`) and every entity mention.
- `:292` and `:308` save a guardrail event per validation and per apply,
  carrying every issue.
- `services/storage/repositories/consistencyStorage.ts` has only the two
  save functions. A search for both store names finds no read anywhere
  outside `db.ts` setup and project deletion.
- `DeterministicWorldEngine.reviewText` (`services/worldEngine/DeterministicWorldEngine.ts:122-124`)
  runs both on every save review (`hooks/useSceneSaveReview.ts:103`) and on
  every scene of a project review (`hooks/useConsistencyReviewRuns.ts:193`,
  `:294`).

**Why it matters.** A project's database gets a new copy of a scene each time
it is reviewed, and nothing ever removes one short of deleting the project.
The stores are in `PROJECT_INDEXED_STORE_NAMES` (`services/storage/db.ts:88`),
so vault lock and unlock encrypt and decrypt all of it. Backups leave them
out, which is right, but only by omission (see K3). I did not measure how
large they get; a long dogfood project is the place to look (DevTools →
IndexedDB → `consistency_proposals`).

**Suggested fix.** Author decision first: is a guardrail audit log wanted?
If not, stop writing (remove `saveProposal` and `saveGuardrailEvent`), and
clear and drop the two stores in a schema migration. A `DB_VERSION` bump needs
the packaged desktop E2E run. If the log is wanted, cap it (last N per scene)
and store a hash instead of the text.

## K3 — Backup store lists are kept by hand in four places

**CONFIRMED (mechanism) · low · XS**

- Schema: `PROJECT_SCOPED_STORE_NAMES`, `services/storage/db.ts:47-87`.
- Export: the `ProjectSnapshot.data` type (`services/storage/projectSnapshotService.ts:81-114`),
  the reads that fill it (`:176`), and the counts (`:272`).
- Import: the transaction's store list in
  `services/storage/projectBackupImport.ts:295-326`.

Three stores are left out on purpose (project review runs, the two K2
stores); the reason is a comment in
`services/storage/repositories/projectReviewRunStorage.ts:10-12`, not code.
Maps were added at `DB_VERSION` 31 and had to be added to every list by hand.
No test fails if the next new store is missed, and the result would be a
backup that restores without it.

**Suggested fix.** Declare the left-out stores next to
`PROJECT_SCOPED_STORE_NAMES`, and add a test that every project-scoped store
is either in the snapshot or in that list. Do it with or after K2, which
changes the list.

## K4 — Acquisition and consumption plans copy their item lookup

**CONFIRMED (copy) · low · S · WORTH A LOOK (behaviour)**

`services/workspace/sceneRosterItemPlans.ts:76-114` and `:207-240` are the
same 35 lines: find the subject, find the scene order, resolve the reusable
item, find or create the item record. The two copies have already drifted:

- A missing subject returns `null` silently in one (`:71-72`) and an error
  in the other (`:201-203`), and the legacy-sheet messages differ.
- The compendium definition is found by name plus source in one (`:111-117`)
  and by resolution id or source in the other (`:237-241`).

I could not tell whether these differences are intended. **Suggested fix.**
One shared step for the common part, with the two lookups kept separate and
named, and a test for each edge where they now differ.

## K5 — Dead and test-only production code

**CONFIRMED · low · XS**

Found by a word-match script over imports and checked by `grep`.

Not used anywhere:

- `EntityType` (`entityTypes.ts:3`), `KnownHighlightSurface`
  (`components/Editor/extensions/ConsistencyHighlightsExtension.ts:23`),
  `TrackedFieldKind` (`services/state/stateMutationSchemas.ts:24`),
  `resetProjectBrowserStorageForTests`
  (`services/storage/vault/projectBrowserStorage.ts:113`),
  `CHARACTER_CATEGORY_HINTS` (`services/worldBible/worldBibleSummary.ts:18`,
  goes with K1).

Production functions only tests call (the feature that used them changed):

- `summarizeCharacterSnapshot` (`services/state/characterSnapshot.ts`),
  `placePathLabel` (`services/worldBible/places.ts`), `getCategorySlug`
  (`services/worldBible/worldBibleEntityPlans.ts`), `summarizeLens` and
  `summarizeOtherRecords` (`services/worldBible/worldCanvasDerived.ts`),
  `countStaleReviewItems` (`services/consistency/incrementalReview.ts`),
  `isPossessiveFormOf` (`services/consistency/textMatcher.ts`),
  `isRichTextEffectivelyEmpty` (`services/worldBible/worldBibleEntityHelpers.ts`),
  `removePreference` (`utils/browserPreferences.ts`).

The test-reset helpers (`resetVaultRegistryForTests`,
`clearModelContextSizeCache`, and similar) are fine as they are.

Also: 289 exports are used only inside their own file. That is noise, not
risk; not worth a slice.

**Suggested fix.** Delete the first list and the second list with their
tests. Check `summarizeLens` against `docs/world-canvas-findings.md:52`,
which names it, and update that dated note or leave it.

## K6 — Modal dialogs each build their own shell

**CONFIRMED · low · M · defer**

Twenty-three components set `aria-modal`. Most share `useFocusTrap` but
each writes its own overlay and Escape handling. Seven close when you click
the backdrop (the four Character Lab dialogs, `SceneDraft/SceneDraftDialog.tsx`,
`CharacterStatPeekDialog.tsx`, `CommandPalette.tsx`); the rest do not.
`CharacterSceneDialog.tsx:217` and `SceneDraftDialog.tsx:251` also share a
"save to Scratchpad" handler word for word.

**Suggested fix.** Not now. If dogfooding finds a stray backdrop click
losing work, decide the rule once and add a shared dialog shell then.

## K7 — Desktop copies of renderer policy have no parity check

**WORTH A LOOK · low · XS · defer**

`apps/desktop/src/main/localServerPolicy.ts`, `ollamaModelPolicy.ts`, and
`geminiThinkingConfig` in `providers/ProviderRegistry.ts:544` copy renderer
code, as their headers say. I compared them: they match today. Nothing would
notice if one side changed. A small script in `scripts/` that compares the
shared functions would cover it; leave it unless one of these files changes.

## K8 — Small leftovers

**CONFIRMED · low · XS in total**

- `sanitizeFileNamePart` in `utils/sceneExport.ts:6`,
  `services/storage/projectBackupExport.ts:6`, and
  `services/storage/jsonTransfer.ts:1`; the third differs from the other two.
  Already noted in 3.61.
- Two `slugifyFieldKey` functions with different fallbacks:
  `hooks/useWorldBibleAuthoringAssistant.ts:59` falls back to `'section'`,
  `services/worldBible/worldBibleImportParsing.ts:124` to a random UUID. A
  heading with no Latin letters (for example "背景") gets a new random field
  key on every import. WORTH A LOOK: I did not check whether import then
  duplicates the field.
- The one lint warning, `components/Mechanics/ConsumableEffectEditor.tsx:66`:
  the effect resets the form when the entry changes, on purpose. Give it a
  reason comment and a disable like the other eight, or key the component by
  `entry.id`.
- `hooks/useAIProviderSetup.ts:122`: `as any` on the new provider config.
- `components/Workspace/WorkspaceSceneDrawer.tsx`: nine static inline styles
  (`:82`, `:94`, `:124`, `:132`, `:140`, `:148`, `:200`, `:215`, `:222`); move
  them into its CSS module.
- `entityTypes.ts:388`: a stray `// apps/web/src/entityTypes.ts` comment.

---

## Proposed slices

Numbers are left for the author.

| Slice | Scope | Size | Depends on |
| --- | --- | --- | --- |
| **One character-category rule** | K1, plus the K5 hint export. | S | none; worth doing before dogfooding, since it changes saved aliases |
| **Stop the write-only consistency log** | K2. Author decision first; schema migration and packaged desktop E2E if the stores go. | S | none |
| **Backup store list in one place** | K3. | XS | after K2 |
| **Tidy-up sweep** | K5, K8. | XS | after K1 |
| **Scene item plans: one lookup** | K4. Decide the edge cases first. | S | none |

Deferred: K6 (unless dogfooding hits it), K7.

## What this review did not cover

- Nothing was run in the app; K2's size and K4's behaviour are from the code.
- The AI trust boundary, the IPC surface, and the CSP were not re-traced.
- `apps/desktop` was read only for K7.
- The dead-code and copy lists come from scripts that match words and lines;
  copies that were reworded would not show up.
- The last review's open note from 3.45 (map placement saves and backup
  restore skip place rules) was not re-checked.
