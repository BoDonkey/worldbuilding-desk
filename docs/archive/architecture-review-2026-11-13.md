> **Archived on creation, 2026-11-13.** This is a dated, read-only review of
> the code at one commit. It is evidence, not a plan. Nothing here is
> scheduled until the author copies a slice onto the status board in
> `docs/road-to-market.md`. Durable boundaries live in
> `docs/architecture-review.md`; current truth lives in `PROJECT_STATUS.md`.
> Line numbers are for commit `c74523d` and will drift.

# Architecture and Code Review — 2026-11

**Audited:** `origin/main` at `c74523d` ("Merge pull request #116 from
BoDonkey/claude/places-movement"), in a clean worktree on branch
`review/architecture-2026-11`.
**Compared against:** `docs/archive/architecture-review-2026-10-17.md`.
**Judged against:** `AGENTS.md`, `PROJECT_STATUS.md`,
`docs/architecture-review.md`, `docs/domain-model.md`, the Design System
section of `docs/product-blueprint.md`, and `scripts/file-size-baseline.json`.
**Changed by this review:** this file only. No source, test, or existing doc
was edited.

**Paths.** A path with no prefix is relative to `apps/web/src/`. Paths that
start with `apps/`, `packages/`, or `docs/` are relative to the repo root.

**Labels.** CONFIRMED means I read every step of the path in the code, or a
tool reported it. WORTH A LOOK means the mechanism is in the code but I did
not prove the effect. Nothing was run in the app itself: no finding here was
reproduced in a running build. Where that matters, the finding says so.

## Verification baseline

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | passed |
| `npx tsc -b` in `apps/web` | passed, no errors |
| `pnpm check:file-sizes` | passed: 4 files over 1,000 lines, none grew |
| `pnpm lint` | 0 errors, 1 warning (`components/Mechanics/ConsumableEffectEditor.tsx:65`, `react-hooks/exhaustive-deps`) |
| `pnpm test` | web 257 files / 1,521 tests; rules-engine 13 / 70; rules-ui 6 / 13; desktop 10 / 54. All passed. |
| Desktop tests, first run | failed once: `src/main/apiHandler.test.ts`, "Electron failed to install correctly". The Electron binary was still unpacking in the fresh worktree. Passed on the second run with no change. |
| Web build, Cypress, desktop E2E, packaged app | not run |

## Summary: the five that matter most

1. **State changes do not follow the manuscript when a scene is deleted or
   moved.** Replay trusts a scene number stored on each change. Nothing
   updates it, and a deleted scene's changes stay accepted. (D1, high)
2. **One of the assistant's "answered from accepted canon" replies contains a
   hardcoded word from the dogfood story** and reports a current job as a
   former one. (T1, high)
3. **Accepting a suggested state change does no validation of its own.** The
   only check is a display flag, and that flag says "acceptable" when the
   character can no longer be found. (T2, medium)
4. **The local AI review mode calls Ollama directly from the renderer**, past
   the one service that tags, gates, and routes every other model request.
   (T3, medium)
5. **The canon decision workflow lives inside a 979-line route component.**
   Three more files sit within 15 lines of the 1,000-line gate, and no open
   slice covers any of them. (B1 and S1, high and medium)

No path was found where model output writes to canon, mechanics, the state
ledger, or World Bible records without an author action. See "Paths traced
and found sound" under focus area 1.

---

## 1. AI trust boundary

### Paths traced and found sound

Every module that can reach a model was listed by search (`LLMService`,
`useModelRun`, `useAssistantRequestPolicy`, the provider classes, and the
Electron bridge). For each one I followed the reply to where it lands.

| Path | Where the reply goes | Author step |
| --- | --- | --- |
| Assistant chat (`components/AIAssistant/AIAssistant.tsx`) | chat only; **Insert** goes through a preview with the `aiText` mark; **Save as Source Note** goes through a preview | yes, both |
| Canon decision advice (`routes/CanonDecisionsRoute.tsx:606`) | text plus one parsed `Suggested Action` token that only highlights a button (`services/lore/canonDecisionRecommendation.ts:43`) | yes, the click |
| Model canon check (`hooks/useModelCanonCheck.ts:105`) | candidates checked against sent facts and verbatim scene text, then a preview | yes, **confirm** |
| Character from a description (`services/characterLab/characterFromDescription.ts:185`, `:317`) | schema, quote check, then a draft record, a Source Note, and `proposed` facts | yes, accept |
| AI actions on a selection (`hooks/useSelectionActionRun.ts:133`) | a note, or a rewrite preview with the `aiText` mark | yes |
| Local AI review notes (`services/worldEngine/LocalAiReviewWorldEngine.ts`) | summary, confidence, and evidence span on an issue the deterministic check already raised | none needed; nothing is written |
| Source Note extraction (`services/lore/loreFactExtraction.ts`, `loreEntityExtraction.ts`) | no model is called; proposals only | yes |
| State changes found in prose (`services/state/stateMutationDerivation.ts:80`) | no model is called; events are saved as `proposed` | yes |

Read at the call site only, not line by line: scene drafts
(`components/SceneDraft/SceneDraftDialog.tsx`), character scenes
(`components/CharacterLab/CharacterSceneDialog.tsx`), Canvas brainstorm and
coaching, the writing coach, and progression continuity. Each calls
`LLMService` with a feature tag. Their write paths were not traced.

No code captures a model reply into retrieval or memory by itself. The only
way in is a Source Note the author chose to save (see T4).

### T1 — A deterministic fact answer carries story-specific wording

**CONFIRMED · high · XS**

- `components/AIAssistant/AIAssistant.helpers.ts:43-48` (the question pattern)
- `components/AIAssistant/AIAssistant.helpers.ts:162-167` (the answer)
- `components/AIAssistant/AIAssistant.test.ts:64`, `:99` (the only tests)

**What is wrong.** The pattern matches "What did X do before she became a
…?" for any ending. The answer is built as
`` `${subject} was a ${acceptedFact.value} before becoming a delver.` ``.
"Delver" is a word from the dogfood story. It is in production code. The
value used is the character's accepted `occupation` fact. Nothing shows that
this fact is the *earlier* job. So "What did Mara do before she became
queen?", with an accepted occupation of "queen", answers "Mara was a queen
before becoming a delver."

**Why it matters.** This reply is shown without calling a model, as the
answer from accepted canon. It is the one place where the app itself, not a
model, states a wrong fact. The tests pass because every test question ends
in "delver".

**Suggested fix.** Remove the `prior` branch. Answer only "X's accepted
occupation is Y." Add a test whose question does not use the fixture's
words. The other direct answers in the same function ("has served the … for
…", "is treated with …") are also shaped by one story; move them to
`services/assistant/` with tests on neutral wording (part of B2).

### T2 — Accepting a suggested state change is not validated at the point of acceptance

**CONFIRMED · medium · S**

- `hooks/useStateMutationReview.ts:83-97` (accept: sets `status: 'accepted'` and saves)
- `services/consistency/mutationReviewGrouping.ts:120-134` (where `canAccept` is computed)
- `components/Workspace/WorkspaceStateChangeReview.tsx:150-156` (the button)

**What is wrong.** `acceptStateMutationReviewItem` checks only that the
event is still `proposed`. It does not run the schema check, the ruleset
check, or the check against replayed state. Those checks exist, and the
Character Sheets form runs all three before it saves
(`hooks/useCharacterSheetSceneChanges.ts:226-253`). For suggestions, the only
guard is the `canAccept` flag on the list item. That flag is
`(preview?.validationIssues.length ?? 0) === 0`. When no preview can be built
(the character was deleted or merged after the suggestion was made, shown as
"Unknown actor") the flag is `true`. Only the first command of an event is
previewed. The ruleset is not checked at all.

**Why it matters.** The rule is "deterministic code validates, authors
approve". Here validation happens when the suggestion is made, and approval
happens later against state that may have changed. It is also the path any
future model-made observation will use (`docs/architecture-review.md:215-220`).

**Suggested fix.** One service function, `acceptStateChangeProposal`, that
loads the current event, validates schema, ruleset, and state for every
command, and then saves. The hook and the batch accept call it. `canAccept`
becomes `false` when there is no subject. Move the two other ledger writes
that build events by hand (`hooks/useWorkspaceSceneRoster.ts:640-651`,
`hooks/useCharacterSheetSceneChanges.ts:226-254`) onto the same function.

### T3 — The local AI review mode goes around `LLMService`

**CONFIRMED · medium · S**

- `services/worldEngine/LocalAiReviewWorldEngine.ts:270-298` (builds an `OllamaProvider` and calls it)
- `services/worldEngine/LocalAiReviewWorldEngine.ts:354` (`fetch` to the saved base URL)
- `services/worldEngine/LocalAiReviewWorldEngine.ts:385` (uses the first model listed)
- `components/Settings/AISettings.tsx:724-739` (the setting: "Local AI review annotations")
- `hooks/useSceneSaveReview.ts:95`, `hooks/useConsistencyReviewRuns.ts:217`, `:293` (it runs on save, autosave review, and refresh)

**What is wrong.** Every other model request goes through `LLMService`,
which refuses an untagged request, checks the project's AI switches, and in
the desktop app sends the request through the main process
(`services/llm/LLMService.ts:90-109`). This engine does none of that. The
request has no `feature`. It runs in the renderer. Its own model lookup
fetches `/api/tags` from whatever address is saved, with no loopback check,
and picks the first model in the list without filtering cloud models.

What still protects the author: the AI coaching switch is checked when the
engine is built (`services/worldEngine/getWorldEngine.ts:18`), and
`OllamaProvider` itself refuses a remote address or a cloud model before it
sends text (`services/llm/providers/ollama.ts:113-123`). In the packaged app
the CSP also limits requests to loopback. So I found no way for scene text to
leave the computer. If the first listed model is a cloud model, the request
is refused and the review silently falls back to the deterministic notes.

**Why it matters.** `docs/architecture-review.md:129-131` says every provider
request runs in the main process. This one does not. A later change to the
request policy (a new switch, a budget, a provider rule) will miss it. It is
also the only model call that runs without an author asking for it each time.

**Suggested fix.** Send the request through `LLMService` with its own
feature tag under the coaching switch, and use the shared model lookup. Or
retire the mode: it is labelled "preview" in the stored value
(`'local-ai-preview'`) and adds notes only.

### T4 — Source Notes written by a model are not told apart later

**WORTH A LOOK · medium · S**

- `services/lore/sourceNoteCapture.ts:46` and `services/characterLab/characterFromDescription.ts:375` (write `source: {type: 'ai-session'}`)
- `services/characterLab/characterFromDescription.ts:307`, `:359` (the "Suggested details … (not canon)" block inside the note)
- `services/llm/contextProvenance.ts:38-39` (the labels a note gets in a prompt)
- `hooks/useSourceNoteExtractionReview.ts:139-146` (extraction reads the whole note)

**What is confirmed.** Nothing reads `'ai-session'`. A search finds the two
writers and the type and no reader. A note saved from an assistant reply is
labelled in later prompts exactly like a note the author typed. Extraction is
given the note's full text, including the suggested-details block.

**What is not proven.** That the extractor turns a suggested detail into a
fact proposal. I did not run it. If it does, the proposal's "evidence" quotes
the model, not the author.

**Why it matters.** Author approval still stands at every step, so this is
not a bypass. It weakens the evidence the author approves from.
`docs/architecture-review.md:149` describes Source Notes as author-written
material.

**Suggested fix.** Show "AI-written" on these notes and in the prompt label.
Have extraction skip the suggested-details block, or mark proposals that come
from it.

### T5 — Canon writers that skip the transaction are still exported

**CONFIRMED · low · XS**

- `services/storage/repositories/loreFactStorage.ts:66` (`saveCanonicalFact`), `:79` (`saveCanonicalFactSupersession`), `:99` (`deleteCanonicalFact`)

**What is wrong.** Nothing calls these three, in code or tests. Canon is
written through `putCanonicalFactInTransaction`
(`services/lore/canonicalFactActions.ts:329`, `:355-356`), which commits the
fact, its proposal, and its side effects together (Slice 3.13).

**Why it matters.** They are the easy way to write canon without the
transaction. The next person to add a canon path will find them first.

**Suggested fix.** Delete them (part of the dead-code slice).

---

## 2. Architecture boundaries

### B1 — The canon decision workflow is inside the route component

**CONFIRMED · high · M**

- `routes/CanonDecisionsRoute.tsx:110-200` (loads the project's records and rebuilds clusters)
- `routes/CanonDecisionsRoute.tsx:268-604` (resolve, three suppression writers, alias, accept new, supersede, keep separate, reject, defer)
- `routes/CanonDecisionsRoute.tsx:606-712` (the model consultation)
- file length: 979 lines

**What is wrong.** The route decides and writes canon. It builds a
`CanonicalFact` from a proposal by hand (`:450-466`), calls the supersession
transaction, updates memory and the retrieval index, resolves the cluster,
and saves a suppression record. It calls `saveLoreEntityProposal`,
`saveLoreFactProposal`, `saveCanonDecisionCluster`,
`saveCanonDecisionSuppression`, and `replaceCanonDecisionClusters` directly.
It also builds the model request itself.

**Why it matters.** This is the most trust-sensitive workflow in the app, and
it can only be tested by rendering a route. The file has 21 lines of room
before the size gate stops the next change to it.

**Suggested fix.** A real seam exists, twice. `services/lore/canonDecisionActions.ts`
holds one function per resolution, with tests. `useCanonDecisionActions`
keeps the busy and feedback state. `useCanonDecisionConsultation` keeps the
model run. The route keeps loading and layout. Fold D4 into this.

### B2 — The assistant component holds the evidence gate

**CONFIRMED · medium · M**

- `components/AIAssistant/AIAssistant.tsx:356-634` (`handleSendPrompt`, about 280 lines)
- `components/AIAssistant/AIAssistant.helpers.ts:38-258` (fact questions and direct answers)
- file length: 985 lines

**What is wrong.** One callback decides whether a question needs grounding,
resolves the follow-up subject, searches, filters facts by scene, tries the
direct answer, returns the "not established" reply, and otherwise assembles
the prompt, tools, and context budget. The rule that unverified factual
wording must never reach a provider (`docs/architecture-review.md:79-84`) is
enforced by the order of `if` statements in a React component.

**Why it matters.** The gate cannot be unit-tested as a whole. T1 sat in this
code unnoticed.

**Suggested fix.** A plain function in `services/assistant/` that takes the
question and the retrieved material and returns one of: clarify, direct
answer, unverified answer, or a provider request. The component renders the
result. The helpers file moves beside it.

### B3 — Thirteen places build an `LLMService` by hand

**CONFIRMED · medium · M**

Sites: `components/WorldBible/WorldCanvasCoaching.tsx:84`, `:146`;
`components/WorldBible/WorldCanvasBrainstorm.tsx:152`;
`components/CharacterLab/CharacterSceneDialog.tsx:193`;
`components/CharacterLab/CharacterFromDescriptionDialog.tsx:113`;
`components/CharacterLab/CharacterLabDialog.tsx:203`, `:293`;
`components/CharacterLab/characterLabProvider.ts:12`;
`components/Corkboard/ProgressionContinuitySection.tsx:121`;
`components/Corkboard/WritingCoachSection.tsx:89`;
`components/SceneDraft/SceneDraftDialog.tsx:211`;
`routes/CanonDecisionsRoute.tsx:671`;
`hooks/useSelectionActionRun.ts:133`; `hooks/useModelCanonCheck.ts:105`.

**What is wrong.** Slice 3.17 put readiness, disclosure, budget, and
execution into `useAssistantRequestPolicy`. Only `AIAssistant.tsx:170` uses
it. The other features repeat the same three lines in their own component:
build the service, `budget.spend(feature)`, `modelRun.run(...)`. Six of the
sites were read and match (`WorldCanvasBrainstorm.tsx:152-154`,
`WritingCoachSection.tsx:89-94`, `SceneDraftDialog.tsx:211-213`,
`CanonDecisionsRoute.tsx:671-682`, `useModelCanonCheck.ts:104-105`,
`useSelectionActionRun.ts:131-133`). The rest were found by search only.

**Why it matters.** The switch check is safe, because `LLMService` enforces
it. Budget, disclosure, and provider readiness are not enforced there. Each
feature must remember them.

**Suggested fix.** One hook that takes a feature tag and returns `run`,
`budget`, `disclosure`, and `providerIssue`. Each feature keeps its prompt
and its parser.

### B4 — Persistence is called from routes and components

**CONFIRMED · medium · S for the panel, XS each for the rest**

- `components/WorldBible/PortableDataPanel.tsx:255-311` (475-line component: builds records, `saveEntity`, indexes, captures memory)
- `routes/CompendiumRoute.tsx:475`, `:526` (`saveCompendiumEntry`)
- `components/CategoryEditor.tsx:102`; `components/WorldBible/CategoryManager.tsx:79`, `:89` (`saveCategory`)
- `components/WorldBible/WorldBibleDialogueStyleControl.tsx:55` (`saveCharacter`)

Six route files and 19 component files import `services/storage`.

**Why it matters.** `AGENTS.md` says domain logic lives in services and
hooks. `PortableDataPanel` is a whole import pipeline in a component, and it
is one of the copies in D3.

**Suggested fix.** Move the portable import into a service and a hook
(D3's slice). Move the small saves into the hooks that already sit beside
those components.

### B5 — The state ledger repository holds domain logic and imports a domain service

**CONFIRMED · low · S**

- `services/storage/repositories/stateMutationLedger.ts:5-13` (imports `services/worldBible/placePositions` and three other repositories)
- `:41-104` (`reconcileSceneStateMutationEvents`: which accepted events survive a re-review)
- `:120-131`, `:245-253` (links positions to places while saving)
- `:141-148` (`saveStateMutationEvents` saves "as they are", with no linking)

**What is wrong.** Two save functions behave differently, and the difference
is a domain rule (4.77) hidden in the storage layer. Storage now depends on
World Bible code.

**Suggested fix.** Move reconcile and place linking into `services/state/`.
The repository writes what it is given. Do this with T2, so there is one
function that prepares an event for saving.

### B6 — The IPC surface is narrow; the architecture doc is behind the code

**CONFIRMED · low · XS (doc only)**

- `apps/desktop/src/main/preload.ts:11-35`; `apps/desktop/src/main/apiHandler.ts:238-309`; `apps/desktop/src/main/updateIpc.ts:27-36`

The bridge exposes 13 fixed `invoke` channels and 4 event channels. No
channel name comes from the renderer. Payloads are checked in the main
process. I found nothing wider than needed.

Doc drift, for the author to fix:

- `docs/architecture-review.md:384` lists `llm:*` and `provider-keys:*` only.
  The six `updates:*` channels (5.1) and `llm:local-context-size` are
  missing.
- `docs/architecture-review.md:137-141` and risk 7 at `:484-485` say the CSP
  allows Hugging Face and jsDelivr. It does not:
  `apps/desktop/src/main/windowPolicy.ts:39` allows the app and loopback
  only, and `windowPolicy.test.ts:30` asserts it. `PROJECT_STATUS.md` is
  already right.

---

## 3. Duplication and drift

### D1 — State changes keep a stored scene number that nothing updates

**CONFIRMED by reading the code; not reproduced in the app · high · M**

- `packages/rules-engine/src/manuscript/replay.ts:23-27` (replay sorts by the stored `event.sceneOrder`)
- `packages/rules-engine/src/manuscript/replay.ts:208-218` (the "up to this scene" cut-off compares against the stored number)
- `services/state/characterSnapshot.ts:76-86` (callers pass the scene's *current* position)
- `hooks/useWorkspaceDocuments.ts:515-554` (`handleMoveDocument` saves scenes only)
- `hooks/useWorkspaceDocuments.ts:675-676` and `hooks/useWorkspaceDocumentReviewBridge.ts:74-80` (delete removes the scene, its search entry, and its memories)
- `services/storage/repositories/stateMutationLedger.ts:181` (`invalidateStateMutationEventsFromScene`: exported, no caller)
- `services/state/stateContinuityReview.ts:109-112` (the continuity review already works around it)

**What is wrong.** Each state change stores `sceneOrder`, the scene's
position when the change was saved. Replay orders changes by that number and
cuts off at it. Three things then disagree:

1. *Move a scene.* The scenes are renumbered. The changes are not. A search
   for any code that rewrites `sceneOrder` on existing events finds only the
   re-review of a scene that is saved again
   (`stateMutationLedger.ts:72-76`). Manual changes keep the old number until
   someone edits them.
2. *Delete a scene that is not the last.* Every later scene moves up one.
   Their changes keep the old numbers. "State at the end of scene 4" now
   passes 4, while that scene's own changes still say 5, so they are left
   out.
3. *Delete any scene.* Its accepted changes stay accepted. The function that
   would invalidate them is never called. Replay has no check for a missing
   scene, so they still apply.

The continuity review knows: it looks up the scene's current position first
and uses the stored number only as a fallback. Replay, the character
snapshot, stat blocks, and **Where is everyone** do not.

**Why it matters.** The state model's promise is "what is true at this point
in the manuscript". After an ordinary edit to the scene list, the answer can
be wrong, with no warning. Canonical facts avoid this on purpose: "ordinal
positions are never persisted" (`docs/domain-model.md:80-84`). State changes
do the opposite.

**Suggested fix.** Give replay the current scene order: one function that
takes events and the ordered scene ids, drops or flags events whose scene is
gone, and sets the order from the scene list. Call it in the few places that
load events. Stop storing the number, or treat it as a cache. Decide what a
deleted scene does to its changes (invalidate them, with a confirm that says
so). Add a replay test that moves and deletes a scene. This fits the
"ordering through replay" rule in `docs/architecture-review.md:221-225`.
Fold D8 into it.

### D2 — The single-scene review is written four times; the save path leaves two checks out

**CONFIRMED for the copies · medium · S. WORTH A LOOK for the gap.**

- `hooks/useConsistencyReviewRuns.ts:215-286` (`refreshDeferredReview`)
- `hooks/useConsistencyReviewRuns.ts:288-367` (`refreshActiveDraftReview`)
- `hooks/useConsistencyReviewRuns.ts:445-461` (the project run)
- `hooks/useSceneSaveReview.ts:94-124` (scene save)

**What is wrong.** The first two bodies are the same 50 lines. They differ in
the `source` value and a status announcement. Each calls
`findCanonContradictions` and `findStateContinuityReviewItems` with the same
nine inputs and builds the same list. The project run calls both again. The
save path builds the list a fourth time, from name issues only. It removes
the scene's old items and does not add contradiction or state-continuity
items back.

**Not proven.** That an author sees those items vanish after a save. A
refresh may run straight after and restore them
(`hooks/useWorkspaceReviewRefresh.ts:57-58`). I did not trace the timing.

**Suggested fix.** One `reviewScene` function in `services/consistency/`
that returns the full item list for a scene. All four callers use it.

### D3 — "Create a World Bible record" is written at least nine times, and three paths skip search indexing

**CONFIRMED · medium · M**

| Where | Saves | Aliases to the alias store | Indexes for search and memory |
| --- | --- | --- | --- |
| `hooks/useWorldBibleEntityActions.ts:161-188` (the editor) | yes | yes | yes |
| `hooks/useWorldBibleImports.ts:747`, `:890` (document and JSON import) | yes | no | yes, through a callback |
| `components/WorldBible/PortableDataPanel.tsx:282-311` | yes | no, written to a field only | yes, written inline |
| `hooks/useWorldBibleRecordResolution.ts:234-235` | yes | n/a | yes |
| `hooks/useUnknownEntityResolution.ts:263`, `:300` (new name from the Workspace) | yes | yes | **no** |
| `hooks/useUnlinkedPlacePositions.ts:96-123` (**Create place**) | yes | no | **no** |
| `services/lore/entityProposalActions.ts:218` (accepting an entity proposal; called from `routes/CanonDecisionsRoute.tsx:385`, `:415` and `hooks/useSourceNoteExtractionReview.ts:308`) | yes, in a transaction | not checked | **no** |
| `services/characterLab/characterFromDescriptionStorage.ts:21-40`, `services/characterCards/characterCardStorage.ts:27-45` | yes | n/a | yes, written inline |

`services/worldBible/indexWorldBibleEntity.ts` exists for the indexing step.
Three of the paths use it.

**Why it matters.** A record made from an unknown name in the Workspace,
from the place queue, or by accepting an entity proposal ("created as new
canon") is not in search or memory until something rebuilds the index. The assistant will not find it. No listener re-indexes on
`wbd:entity-records-changed`. Place rules also run in the editor path only
(P1).

**Suggested fix.** One `createWorldBibleRecord` / `saveWorldBibleRecord`
service: normalize, save, write aliases, index. Every path above calls it.

### D4 — A canon fact is built from a proposal in two places and indexed in four

**CONFIRMED · low · S (with B1)**

- Build: `routes/CanonDecisionsRoute.tsx:450-466`; `hooks/useSourceNoteExtractionReview.ts:233-250`
- Index: `routes/CanonDecisionsRoute.tsx:494-518` (twice); `hooks/useSourceNoteExtractionReview.ts:266-277`; `services/contextHealth/contextHealthRebuild.ts:137-147`

The rebuild copy uses `getFactTargetId(fact)` for the entity id. The others
use `fact.targetId`. That is a small drift today and the kind that grows.

**Suggested fix.** `buildCanonicalFactFromProposal` and
`indexCanonicalFact` in `services/lore/`.

### D5 — Names are compared by more than a dozen helpers with three different rules

**CONFIRMED · medium · S**

- Trim, lowercase, collapse spaces: `services/consistency/reviewLinkOptions.ts:14`; `services/worldBible/worldBibleEntityHelpers.ts:36`; `services/characters/characterIdentity.ts:71`; `services/lore/canonDecisionClustering.ts:11`; `services/lore/loreFactExtraction.ts:56`; `services/state/itemStateAuthoringService.ts:17`; `services/characters/characterTransferService.ts:107`
- Trim and lowercase only: `services/storage/repositories/aliasStorage.ts:18`; `components/WorldBible/PortableDataPanel.tsx:58`
- Strip everything except `a-z` and `0-9`: `services/state/stateContinuityReview.ts:59`; `services/state/manuscriptCustody.ts:20`; `components/AIAssistant/AIAssistant.helpers.ts:18`; and `services/worldBible/placePositions.ts:21-26`, which also drops a leading "the"
- Unicode-aware: `services/consistency/textMatcher.ts:17`

**What is wrong.** Two parts of the app can disagree on whether two names
are the same. The `a-z0-9` group also removes every letter outside basic
Latin. A place named in Cyrillic, Greek, or CJK normalizes to an empty
string. `placePositions.ts:43` then skips it when building the index, and
`:159` skips it in the review queue. So that place never links to a
position and is never offered for linking. The main name matcher handles the
same names correctly.

**Why it matters.** `docs/domain-model.md:355-358` says surfaces must not
recreate normalized-name joins. Maps (4.79, 4.80) will add more place-name
matching on top of the weakest of these.

**Suggested fix.** Two exported functions in one module: an exact form
(trim, lowercase, collapse spaces) and a loose form (Unicode letters and
digits, optional leading article). Replace the copies. Add a non-Latin place
test.

### D6 — Four ZIP readers and two DOCX readers

**CONFIRMED · low · S**

- `utils/unzip.ts` (backups)
- `utils/workspaceImport.ts:32-115` (scene import)
- `services/worldBible/docxImport.ts:4-84` (World Bible and Source Notes)
- `services/characters/characterImportService.ts:80-160` (dead file, see area 6)

**What is wrong.** Each has its own central-directory walk and its own
`inflateRaw`. Scene import turns DOCX into plain text by stripping tags
(`utils/workspaceImport.ts:117-130`). World Bible and Source Note import use
the structure-aware reader from Slice 4.54. An author importing the same file
as a scene and as a Source Note gets headings in one and not the other.

**Suggested fix.** One `readZipEntry` in `utils/`. Scene import calls
`parseDocxFile` and keeps what it needs.

### D7 — Smaller copies

**CONFIRMED · low · S in total**

- `hashString`: `services/state/stateMutationStaleness.ts:28`, `services/consistency/sceneReviewHelpers.ts:25`, `services/characters/characterSheetDefaults.ts:11`. The first two must agree, because one writes `sourceHash` and the other checks it.
- HTML to plain text: ten functions, among them `utils/textHelpers.ts:5`, `services/state/manuscriptCustody.ts:3`, `services/state/stateMutationStaleness.ts:16`, `services/consistency/modelCanonCheck.ts:53`, `services/workspace/sceneRoster.ts:49`, `services/portability/portableData.ts:81`. Evidence offsets depend on which one made the text.
- Runtime modifiers are assembled the same way in four hooks: `hooks/useWorkspaceRuntimeModifiers.ts:45`, `hooks/useCharacterLabData.ts:201`, `hooks/useCharacterSheetsData.ts:192`, `hooks/useCharacterStatPeekData.ts:162`.
- "Is this a location category" has three hint lists: `services/worldBible/worldBibleEntityPlans.ts:13`, `services/worldBible/worldCanvasDerived.ts:31`, `services/consistency/unknownCategorySuggestion.ts:181`. A category with the slug `zone` is a place for containment and not for the Canvas.
- Eleven `wbd:*-changed` event names are typed as string literals in about 110 places. A typo fails silently.

### D8 — The ledger repository sorts with a copy of the engine's comparator

**CONFIRMED · low · XS (with D1)**

- `services/storage/repositories/stateMutationLedger.ts:154-173` is the same code as `packages/rules-engine/src/manuscript/replay.ts:23-42`.

`docs/architecture-review.md:221-225` says code outside replay should not
sort events by scene order. The file was last changed in 4.77.

---

## 4. Size and shape

### S1 — Eight files are near or over the limit and no open slice covers them

**CONFIRMED · medium**

| File | Lines | State |
| --- | --- | --- |
| `styles/WorkspaceRoute.module.css` | 2,349 | over; on the baseline |
| `services/consistency/ConsistencyEngineService.ts` | 1,250 | over; on the baseline |
| `components/Editor/EditorWithAI.tsx` | 1,134 | over; on the baseline |
| `components/Settings/AISettings.tsx` | 1,080 | over; on the baseline |
| `routes/ProjectsRoute.tsx` | 997 | 3 lines of room |
| `routes/WorkspaceRoute.tsx` | 988 | 12 lines of room |
| `components/AIAssistant/AIAssistant.tsx` | 985 | 15 lines of room |
| `routes/CanonDecisionsRoute.tsx` | 979 | 21 lines of room |

Next behind them: `hooks/useWorldBibleImports.ts` (965),
`routes/CompendiumRoute.tsx` (944),
`services/worldBible/worldBibleImportParsing.ts` (922), `entityTypes.ts`
(901).

**Why it matters.** `AGENTS.md` says a file that grows past the limit must be
covered by an open breakup slice. Slice 3.32 is done and 3.32a split only the
World Bible CSS. The next feature that touches Projects, the assistant, or
Canon Decisions will hit the gate. That is the situation 3.32 was written to
avoid: small extractions made for the line count.

### S2 — Where a real seam exists

**CONFIRMED (the code blocks exist as described) · sizes below**

By the `AGENTS.md` test: one named feature a reader would search for, with
its own state or logic, in the same folder.

- `routes/ProjectsRoute.tsx` — **backup import and validate.** State at `:84-93`, handlers at `:400-600`, plus its panel. `useProjectBackupImport` and `ProjectBackupImportPanel`. **M.** The parent-project handlers (`:303-372`) are a second, smaller seam: `useProjectSeriesLinks`. **S.**
- `routes/CanonDecisionsRoute.tsx` — see B1. **M.**
- `components/AIAssistant/AIAssistant.tsx` — see B2. **M.**
- `hooks/useWorldBibleImports.ts` — **two pipelines in one hook**: document drafts (ends near `:812`) and JSON rows (ends near `:930`). `useWorldBibleDocumentImport` and `useWorldBibleJsonImport`, both saving through D3's service. **M.**
- `services/consistency/ConsistencyEngineService.ts`, `components/Editor/EditorWithAI.tsx`, `components/Settings/AISettings.tsx`, `styles/WorkspaceRoute.module.css` — not read closely enough to name a seam. They need a seam map first, as 3.32 did.

### S3 — `WorkspaceRoute.tsx` is wiring; the cost is in the width of what it wires

**CONFIRMED (measurements) · low to act on · L if taken up**

- `routes/WorkspaceRoute.tsx`: 988 lines, about 35 hook calls, then JSX from about `:723`.
- `components/Workspace/WorkspaceContextDrawer.tsx`: `WorkspaceContextDrawerProps` has 67 fields.
- `hooks/workspaceSceneRosterTypes.ts`: `UseWorkspaceSceneRosterOptions` has 33 fields.
- `hooks/useWorkspaceConsistency.ts`: 29 parameters in, about 50 values out (`:417-470`).
- `hooks/useWorkspaceProjectData.ts`: about 60 values out (`:487-553`).
- `hooks/useSceneSaveReview.ts:34-73`: 19 parameters, six of them state setters owned by other hooks.
- `hooks/useWorkspaceDocumentReviewBridge.ts`: mutable refs so that the documents hook and the review hook can call each other.

I did not find another seam in the route that meets the `AGENTS.md`
definition. Cutting it further would be for the line count. The author's
decision on 2026-11-12 to accept 991 lines looks right.

What would help is narrower inputs. Most of those parameters are the same
project data (documents, entities, characters, ruleset, state events, actor
resolutions) passed down by hand. A Workspace data store that hooks read from
would remove most of the lists and the ref bridge. That is a design change,
not a split, and it needs its own plan. The app already uses Zustand
(`store/appStore`). I would not start it before beta.

---

## 5. Recent fast-moving areas

### P1 — Place rules run on one write path

**CONFIRMED · low · S (with D3)**

- `hooks/useWorldBibleEntityActions.ts:161-162` is the only caller of `normalizePlaceData` (`services/worldBible/places.ts:160`), which trims connections, drops links to missing places, and refuses a cycle.

Other paths that save a record can carry `place` data without that check:
`hooks/useWorldBibleMergeActions.ts:90`, `:340`, `:354`,
`hooks/useWorldBibleRecordResolution.ts:234`, and backup import. Reads are
defensive (`services/worldBible/places.ts:34-46` stops at a missing parent or
a cycle), so nothing hangs. The rule "containment is always a tree"
(`docs/domain-model.md:423-426`) is kept by the editor, not by the data path.

### P2 — Merging a place drops its containment, connections, and position links without saying so

**WORTH A LOOK · medium · S**

- `hooks/useWorldBibleMergeActions.ts:90-97`, `:340-357` (save the merged record, delete the source)

A search of the merge hook and its helpers finds no handling of `place`,
`parentId`, or `placeId`. So when place A is merged into B: places inside A
lose their parent, connections that pointed at A stop showing, and positions
linked to A fall back to their written name. `PROJECT_STATUS.md` records that
references to merged-away places are "ignored when read", so this is known.
What I could not find is any message to the author when it happens. I did not
run a merge.

**Suggested fix.** On merge, repoint `parentId`, `toId`, and `placeId` from
the source to the target, in the same write. Or list what will be dropped in
the confirm dialog.

### P3 — "Accepted changes are never rewritten" no longer describes the code

**CONFIRMED · low · XS (doc decision)**

- `docs/domain-model.md:343`, `:373`, `:590` (the invariant)
- `hooks/useUnlinkedPlacePositions.ts:89`, `:116` (adds `placeId` to accepted events)
- `hooks/useWorkspaceSceneRoster.ts:575` (re-anchors an accepted event)
- `services/storage/repositories/stateMutationLedger.ts:70-85` (rewrites order, position, and label on re-review)

Each of these is deliberate. Slice 4.77 says the place link is not part of a
change's identity. The doc should say what is fixed (who, what, how much) and
what may be updated (position, anchor, place link). Otherwise the next author
of a migration reads the invariant and either breaks it or is blocked by it.

### P4 — The movement check compares scene order itself

**CONFIRMED · low · XS (with D1)**

- `services/state/placeMovementReview.ts:56-66`; `services/worldBible/placeMovement.ts:157-160`

`characterPath` walks events in stored order and labels each stop with the
scene's current position. After D1's fix these agree. Until then a path can
list stops out of order. This is new code (4.78, 2026-11-12) written after
the "ordering through replay" rule of 2026-11-08.

### P5 — State subjects and the kind modules

No finding. Checked:

- No direct `projectMode` comparison outside `projectMode.ts` (search for `=== 'litrpg' | 'game' | 'general'`: none).
- The app registry (`services/state/kinds/index.ts:24-31`) and the engine registry are both typed over the whole command union.
- Code that names a kind directly does so for a check about that kind (`services/state/stateContinuityReview.ts`, `services/dashboard/storyDashboard.ts`), which `docs/domain-model.md:300-303` allows.
- `translateEffectToStateMutationCommand` (`packages/rules-engine/src/manuscript/kinds/index.ts`) is used only by tests. That matches the docs: rules are not wired in yet.

---

## 6. Dead code

Found with a script that lists exported names with no reference outside
their own file, and source files that nothing imports. Each item below was
then checked by search. The script matches whole words, so it can miss a name
that is also an ordinary word.

### X1 — Seven source files that nothing imports

**CONFIRMED · low · S**

| File | Lines | Note |
| --- | --- | --- |
| `services/characters/characterImportService.ts` | 264 | third copy of the DOCX reader (D6) |
| `extensions/CustomMarks.ts` | 198 | |
| `config/toolbarConfig.ts` | 140 | |
| `utils/exportWorldBible.ts` | 33 | |
| `hooks/useAppShellState.ts` | 24 | wrapper over the app store |
| `extensions/WordCountExtension.ts` | 22 | `config/editorConfig.ts:12` defines its own |
| `hooks/commonWords.ts` | 4 | says "intentionally empty" |

Used only by its own test: `services/characters/characterMergeHelpers.ts`
(175 lines).

### X2 — Exported functions with no caller

**CONFIRMED · low · XS**

- Repositories: `saveCanonicalFact`, `saveCanonicalFactSupersession`, `deleteCanonicalFact` (T5); `invalidateStateMutationEventsFromScene`, `getStateMutationEventsByScene` (`stateMutationLedger.ts:181`, `:173`; the first is the missing call in D1); `getAllEntities`; `deleteAliasById`; `deleteProjectReviewRun`.
- Services: `getAcceptedStateMutationEventsByProject` (`services/state/stateReplay.ts:20`); `ensureCanonicalCharacterForIntake` (`services/characters/characterIntakeService.ts:105`, a tenth copy of record creation); `getChildProjects`, `isChildProject` (`services/seriesBible/SeriesBibleService.ts`); `addQuestion`, `updateQuestion` (`services/worldBible/worldCanvasService.ts`); `switchForFeature`, `OFF_PROSE_NOTE` (`services/llm/aiSwitches.ts`).
- Editor: `createConsistencyHighlightsExtension` and `createLoreHighlightsExtension`. Both files are now imported for their types only (`components/Editor/EditorWithAI.tsx:9-12`, `components/Editor/extensions/WorkspaceAnnotationsExtension.ts:6-7`).
- Rules engine: `createCondition`, `createConditionGroup`, `createEffect`, `createFormulaEffect`, `createRule`, `createConditionalRule` in `packages/rules-engine/src/types/`. These may be public API for authored rules. The author should decide.

The script also lists 520 names that are exported and used only inside their
own file. Most are types. They are not dead, only wider than needed. Not
worth a slice.

### X3 — A field that is always empty

**CONFIRMED · low · XS**

- `entityTypes.ts:738`, `:752` (`CompendiumRewardEffect`, `CompendiumMilestone.permanentEffects`)
- `components/Compendium/useCompendiumMilestoneForm.ts:27` (always writes `[]`)

Nothing reads it. It is a third effect shape in the types, beside consumable
effects and rules-engine effects. `docs/architecture-review.md:215-220` asks
for one.

### X4 — Flags

- `reviewEngineMode: 'local-ai-preview'` (`entityTypes.ts:233`) is the one "preview" switch still offered in Settings. See T3.
- The four project feature toggles in `projectMode.ts:30-52` are all read.
- `wbd:dogfood-tools` is dev-only by design (`services/onboarding/dogfoodTools.ts`).

No stale flag found.

---

## 7. Styling

The web app is clean. A script found no hardcoded colour in any CSS file
under `apps/web/src` outside `styles/theme.css`, no `var(--…)` that is not
defined, and no component-level custom property. `styles/themeTokens.test.ts`
guards the second point. All 86 tokens in `theme.css` are used.

### Y1 — The rules wizard stylesheet ignores the theme

**CONFIRMED for the code · medium · M. WORTH A LOOK for the visual effect.**

- `packages/rules-ui/src/styles/wizard.css` (871 lines): 108 hardcoded colours, no `var(` at all. For example `:7` `background: #ffffff`, `:30` an indigo-to-violet gradient, `:84` `#4f46e5`.
- Loaded by `routes/RulesetRoute.tsx:7`.
- `styles/themeTokens.test.ts` scans `apps/web/src` only, so the guard does not see it.

The design system asks for theme tokens and an earthy green primary. The
wizard is white panels with indigo buttons. In the dark theme I expect a
white wizard inside a dark app. I did not open it to check.

**Suggested fix.** Replace the colours with theme tokens. Extend the token
test to `packages/rules-ui/src`.

### Y2 — Inline styles remain in three files

**CONFIRMED · low · S**

73 `style={{…}}` blocks in 15 files. Three files hold 48 of them:
`components/ShodhMemoryPanel.tsx` (19), `routes/RulesetRoute.tsx` (15),
`components/Mechanics/ConsumableEffectEditor.tsx` (14). The tokens they use
are valid. The layout values (`'0.85rem'`, `'8px'`, `'14px'`) are one-offs
that Slices 2.5 and 2.6 removed elsewhere.

---

## Proposed slices

Written to be copied onto the status board. Numbers are left for the author
to assign. Sizes use the roadmap's scale. Order within each group is the
order I would do them in.

### Trust and correctness (before beta)

| Slice | Scope | Size | Depends on |
| --- | --- | --- | --- |
| **State changes follow the scene list** | D1, D8, P4. Replay gets scene order from the current scene list. Decide and build what deleting a scene does to its changes. Replay tests for move and delete. | M | none; do before 4.79 |
| **Assistant fact answers: remove story-specific wording** | T1. Drop the prior-occupation answer; tests with neutral wording for every direct answer. | XS | none |
| **One validated path for saving a state change** | T2, B5. `acceptStateChangeProposal` and one "prepare and save" function used by review, the Workspace composer, and the Character Sheets form. Move reconcile and place linking out of the repository. | S | easier after the first slice |
| **Local AI review through the request gate, or retired** | T3. Author decision first: keep or remove. | S | none |
| **AI-written Source Notes are labelled** | T4. Label in the UI and in prompt context; extraction skips or marks the suggested-details block. Prove or dismiss the open question first. | S | none |

### Boundaries (code fitness)

| Slice | Scope | Size | Depends on |
| --- | --- | --- | --- |
| **Canon Decisions: actions out of the route** | B1, D4, T5. Service functions per resolution, two hooks, shared fact builder and indexer. Behaviour-preserving. | M | none |
| **Assistant turn planning out of the component** | B2. One function decides clarify, direct answer, unverified answer, or provider request. | M | after the T1 slice |
| **One way to create a World Bible record** | D3, B4 (portable import), P1, P2. One service: normalize, save, aliases, index. Portable import moves to a service and hook. Merge repoints place references. | M | none |
| **One name matcher** | D5. Two shared functions; non-Latin test for places. | S | before 4.79 and 4.80 |
| **Shared model-run hook for AI features** | B3. Feature tag in; run, budget, disclosure, and provider issue out. | M | after the Canon Decisions slice; relates to 4.82 |

### Size headroom (before the next feature that touches these files)

| Slice | Scope | Size | Depends on |
| --- | --- | --- | --- |
| **Projects: backup import as its own hook and panel** | S2. `routes/ProjectsRoute.tsx` has 3 lines of room. | M | none |
| **World Bible imports: split the two pipelines** | S2. Document import and JSON import. | M | after "One way to create a World Bible record" |
| **Seam maps for the four baseline files** | S1. Plan only: `ConsistencyEngineService.ts`, `EditorWithAI.tsx`, `AISettings.tsx`, `WorkspaceRoute.module.css`. Keeps an open slice over them, as `AGENTS.md` requires. | S | none |

### Tidy-up (any time)

| Slice | Scope | Size | Depends on |
| --- | --- | --- | --- |
| **Dead code sweep** | X1, X2, X3. Delete seven files and the listed exports. Decide on the rules-engine factory helpers. | S | T5 lands with Canon Decisions if that goes first |
| **One ZIP and DOCX reader; shared text helpers** | D6, D7. | S | after the dead code sweep |
| **Scene review in one function** | D2. Also settles whether the save path drops items. | S | none |
| **Rules wizard on theme tokens** | Y1, Y2. Extend the token test to `packages/rules-ui`. Needs a look in both themes. | M | none |
| **Architecture doc catch-up** | B6, P3. IPC list, CSP paragraph, risk 7, and the wording of the ledger invariant. | XS | none |

## What this review did not cover

- Nothing was run in the app. D1, T2, and T3 are confirmed from the code, not from a session.
- Model paths marked "read at the call site only" in area 1 were not traced to their writes.
- `apps/desktop` was read for the IPC surface and the CSP only.
- Backup import and export, the vault, and the schema migrations were not reviewed.
- `ConsistencyEngineService.ts`, `EditorWithAI.tsx`, and `AISettings.tsx` were measured, not read.
- The dead-code list comes from a word-match script, checked by hand for the items named here.
