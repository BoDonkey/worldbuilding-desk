# Verification Log (archived)

> **Archived 2026-10-31.** Verbatim copy of the "Verified Recently" section of
> `PROJECT_STATUS.md` before it was slimmed. It is a dated record of past
> verification runs, newest first. Current verification truth lives in
> `PROJECT_STATUS.md` (Verification Status) and in CI. Relative links below
> were written for the repository root and may not resolve from `docs/archive/`.

- Slice 5.15c project-vault verification and copy passed full main Web CI in
  [run 40317006961](https://github.com/BoDonkey/worldbuilding-desk/actions/runs/40317006961),
  including all three Cypress shards, `cypress-smoke`, and packaged Electron
  tests on macOS and Windows without retries. Coverage: 16 CI-policy tests,
  file-size gate, lint with the existing warning, 1310 web + 47 engine + 12 UI
  + 38 desktop unit tests, both builds, project-vault Cypress 3/3, and a local
  packaged macOS profile scan 1/1. The parallel PR run lost Cypress's Electron
  renderer late in `post-merge-smoke`; the identical main shard passed, and
  Cypress memory reclamation was then enabled and verified on the focused
  smoke at 18/18 instead of adding retries.
- Slice 5.15b project vault UX and derived data passed full remote Web CI,
  including `cypress-smoke` and `Desktop E2E` on macOS and Windows, in
  [run 40196961910](https://github.com/BoDonkey/worldbuilding-desk/actions/runs/40196961910)
  for [PR #81](https://github.com/BoDonkey/worldbuilding-desk/pull/81).
  Two Cypress failures on the first attempts were pre-existing flakes also
  seen on main (the `ai-scene-revision` AI tab, run 40120019885; a seed
  `cy.then()` timeout, run 40143329410) and passed on rerun. Coverage: 16
  CI-policy tests, file-size gate, lint with the existing warning, 1306 web
  (8 new) + 47 engine + 12 UI + 37 desktop unit tests, both builds, and
  Cypress 167/167 locally with retries disabled.
- Slice 5.15a project vault core passed full remote Web CI, including
  `cypress-smoke` and `Desktop E2E` on macOS and Windows, in
  [run 40194139403](https://github.com/BoDonkey/worldbuilding-desk/actions/runs/40194139403)
  for [PR #80](https://github.com/BoDonkey/worldbuilding-desk/pull/80).
  Coverage: 16 CI-policy tests, file-size gate, lint with the existing
  warning, 1298 web (14 new vault tests) + 47 engine + 12 UI + 37 desktop
  unit tests, both builds, and Cypress 164/164 with retries disabled. The
  packaged Electron suite passing on both platforms confirms the synchronous
  cipher and the wrapped database work in the installed app.
- Slice 5.14 optional encrypted backups passed full remote Web CI, including
  `cypress-smoke` and `Desktop E2E` on macOS and Windows, in
  [run 40186887061](https://github.com/BoDonkey/worldbuilding-desk/actions/runs/40186887061)
  for [PR #79](https://github.com/BoDonkey/worldbuilding-desk/pull/79).
  Coverage: 16 CI-policy tests, file-size gate, lint with the existing
  warning, 1284 web + 47 engine + 12 UI + 37 desktop unit tests, both builds,
  Cypress 164/164 with retries disabled, and 14 Electron E2E tests per
  platform, including an encrypted backup exported to disk, refused with a
  wrong passphrase, and imported with the right one.
- Slice 5.3 packaged-app validation passed full remote Web CI, including
  `cypress-smoke` and the new `Desktop E2E` jobs on macOS and Windows, in
  [run 40185198414](https://github.com/BoDonkey/worldbuilding-desk/actions/runs/40185198414)
  for [PR #78](https://github.com/BoDonkey/worldbuilding-desk/pull/78).
  Coverage: 16 CI-policy tests, file-size gate, lint with the existing
  ConsumableEffectEditor warning, 1276 web + 47 engine + 12 UI + 37 desktop
  unit tests, both builds, 13 Electron E2E tests against the unsigned
  packaged app per platform, and Cypress 161/161 with retries disabled. The
  first Windows runs found a CRLF build failure and two startup races in the
  new tests; all three are fixed in the PR.
- Slices 3.19–3.21 (theme tokens, Compendium form extraction, scene-roster
  mutation services) passed full remote Web CI, including `cypress-smoke`,
  in [run 39273413648](https://github.com/BoDonkey/worldbuilding-desk/actions/runs/39273413648)
  for [PR #59](https://github.com/BoDonkey/worldbuilding-desk/pull/59).
  Coverage: 16 CI-policy tests, file-size gate (13 baseline files), lint with
  the existing ConsumableEffectEditor warning, 999 web + 47 engine + 12 UI +
  24 desktop unit tests, both builds, and 149 Cypress tests in three disjoint
  groups with retries disabled. Earlier local browser stalls remain recorded
  in the implementation commits; this remote full run completed successfully.
- Slice 4.59 remembered Source Note view: `sourceNoteView` in
  `AccessibilityContext` (localStorage, like the other editor preferences),
  Settings control, and a per-note override in `SourceNoteContentField`
  (null follows the preference). Battery: lint (one existing warning), 923
  web + 47 engine + 12 UI + 24 desktop tests, web/desktop builds, file-size
  gate, Cypress 141/141 in two batches with no retries; field header and
  Settings group checked at desktop and 390px.
- Slice 4.61 multi-file Source Note import: `sourceNoteBatchImport`
  (`importSourceNoteFiles`, `findImportedSourceNote`, shared
  `indexSourceNote` now also used by the manual save),
  `SourceNoteBatchImportDialog`, and `SourceNoteDocumentList` split out of
  `LoreRoute.tsx` (1,814 to 1,787 lines). Battery: lint (one existing
  warning), 921 web + 47 engine + 12 UI + 24 desktop tests, web/desktop
  builds, file-size gate, Cypress 140/140 in two batches with no retries;
  dialog checked at desktop and 390px.
- Slice 4.60 collapsible Source Notes intake panel: state inside
  `SourceNoteStarterPanel` (localStorage, guarded), so `LoreRoute.tsx` is
  unchanged. Battery: lint (one existing warning), 918 web + 47 engine + 12 UI
  + 24 desktop tests, web/desktop builds, file-size gate, Cypress 139/139 in
  two batches with no retries; collapsed row checked at desktop and 390px.
- Slice 4.58 Source Note visual editor: `SourceNoteEditor` (dedicated
  TipTap editor without code blocks/strike/underline/trailing node, plus
  `@tiptap/extension-table`), `sourceNoteDocToMarkdown` serializer, and
  renderer support for backslash escapes and inline `<br>`. Round-trip tests
  show canonical Markdown survives the editor unchanged and other spellings
  normalize once, then hold. Battery: lint (one existing warning), 917 web +
  47 engine + 12 UI + 24 desktop tests, web/desktop builds, file-size gate
  (`LoreRoute.tsx` held at 1,814), Cypress 139/139 in two batches with no
  retries (one earlier first-run retry came from Vite optimizing the new
  dependency mid-seed; clean on rerun); editor checked in light and dark.
- Slice 4.57 Source Note import fidelity and formatted display:
  `docxToMarkdown` (shares the World Bible DOCX reader's style and zip
  helpers; the Source Note copy of the old reader is removed),
  `sourceNoteFormat` (legacy `.md` format, sanitized display HTML), and
  `SourceNoteContentField` / `SourceNoteStarterPanel` split out of
  `LoreRoute.tsx` (1,829 to 1,814 lines). The shared Markdown renderer now
  honors escaped pipes and `<br>` in table cells and links only http(s)/mailto
  URLs. Battery: lint (one existing warning), 905 web + 47 engine + 12 UI +
  24 desktop tests, web/desktop builds, file-size gate, Cypress 138/138 in two
  batches with no retries; DOCX table import checked visually in light and
  dark themes.
- Slice 4.56 multi-document import flow and category manager dialog:
  per-draft import status in `useWorldBibleImports`, `ImportDraftCard` and
  `ImportDocumentPreviewDialog` split out of the import workspace, record
  editor scrolled into view on open, and `CategoryManager` as a modal.
  `WorldBibleRoute.tsx` fell from 2,229 to 2,202 lines. Battery: lint (one
  existing warning), 890 web + 47 engine + 12 UI + 24 desktop tests,
  web/desktop builds, file-size gate, Cypress 137/137 with no retries.
- Slice 4.55 import heading destinations: destination picker, batch
  carry-over of new fields (`reconcileImportSectionDestinations`), and custom
  fields on unsaved characters. New Cypress spec `world-bible-import.cy.ts`
  covers a two-document batch sharing a planned field and the unsaved
  character field; it fails without the character fix. The guardrails import
  test now uses the picker labels. Battery: lint (one existing warning),
  881 web + 47 engine + 12 UI + 24 desktop tests, web/desktop builds,
  file-size gate, Cypress 134/134 (the guardrails spec re-run after its
  label update).
- Slice 4.54 document import structure fidelity, from the 2026-10-08
  dogfood import of the author's Markdown and Pages-exported DOCX character
  sheets. Before: the Markdown sheet detected one heading and left Age empty;
  the DOCX lost its Heading 3 paragraphs and its first Background section.
  After, checked against both real files: 12 and 19 sections, name, Age, and
  Role filled, both Background sections kept. Also fixes doubled `</li>` in
  Markdown list HTML. `useWorldBibleImports.ts` fell from 1,632 to 912 lines
  and left the file-size baseline. Battery: lint (one existing warning),
  869 web + 47 engine + 12 UI + 24 desktop tests, web/desktop builds,
  file-size gate, Cypress 132/132.
- Slice 3.17 centralized project-assistant provider authorization in
  `useAssistantRequestPolicy`: Workspace and Ask share provider readiness,
  provider-route disclosure, consultation blocking and accounting, streaming,
  Stop, and error handling. Ordinary hosted model runs spend one `assistant`
  unit immediately before execution; private-local runs retain the runaway
  guard; the writing coach records `writing-coach`; deterministic factual
  replies spend zero. `AIAssistant.tsx` fell from 858 to 827 lines. The full
  battery passes: lint (one existing warning), 858 web + 47 engine + 12 UI +
  24 desktop tests, web/desktop builds, file-size gate, and Cypress 132/132.
- Slice 1.4 grounded project Q&A destination: **Ask your project** (`/ask`;
  More → Utilities; command palette) runs the project assistant outside the
  Workspace drawer with its own conversation history
  (`useAssistantConversation(projectId, 'ask')`). Factual questions use the
  same evidence gate and saved-fact answers as the drawer, so they never
  reach a model. **Include pending proposals** (off by default) loads pending
  Source Note fact proposals (`usePendingProposals`): the model sees them
  labeled "Pending proposal, not canon" with an instruction to keep them
  apart from accepted canon, and deterministic answers append a separate
  "Pending, not accepted canon" list for proposals naming someone in the
  question (`services/assistant/pendingProposalContext.ts`). Replies leave
  only through the shared Source Note capture preview. No writing coach here
  (it needs a scene).
  Since slice 1.4a, `usePendingProposals` reports disabled / loading / ready
  / error explicitly. After the option is checked, Send is held (the typed
  question is kept, and the assistant's own send path also refuses) until both
  pending proposals and their Source Note titles have loaded; loading shows
  beside the control, and a failed load shows an error with **Retry** instead
  of reporting zero proposals. Only the newest read can update the state, and
  unchecking returns to the accepted-only path at once.
- Slice 4.53 model-assisted review items in the shared review model: canon
  check items (4.38) now live in the Workspace review state and are saved
  with the project review run (`ProjectReviewRun.modelCheckItems`; a record
  with `reviewedAt: 0` holds them if no review has run yet). They underline
  their quote in the editor, count in the header review indicator, survive
  reloads, scene re-reviews, and project review runs while their quote is
  still in the scene (`survivesSceneRereview`, `pruneModelCheckItems`), and
  their dismissal is saved. The 4.38 session store slice is gone.
- Slice 4.74 rolling Character Lab summaries: when a Talk conversation
  takes about a third of the model's context (35%, from the 4.72 estimate)
  and there are complete Talk turns older than the two most recent, the lab
  offers **Summarize earlier turns**. The summary request sends only those
  turns (no World Bible records or grounding) and asks for at most 200
  words; it is a full model run, so provider checks and the consultation
  budget apply. The summary appears in an editable box labeled "Summary of
  the earlier conversation · N turns · not canon" (plus "edited" once
  changed); the turns it covers stay on screen marked Summarized. From then
  on the model gets the summary, under a heading that calls it a working
  summary and not canon, in place of those turns; the two most recent turns
  always go word for word. **Add earlier turns to the summary** extends it,
  **Remove summary** sends every turn again, and Clear conversation clears
  it. The summary lives only for the app session, like the transcript: it
  is never saved, never written to the World Bible, and Save to Scratchpad
  still saves the turns themselves. The prompt total counts it as
  conversation. The 200-word/2,000-character ceiling is validated before
  model output or author edits become prompt context; the editor is disabled
  during an extension, and a stale-result guard preserves any concurrent edit.
- Slice 4.73 alternative replies: the latest Character Lab reply (Talk and
  Reaction test) and the latest assistant reply have **Another version**,
  which sends the same request again (same question, grounding or context,
  story point, and model). The author steps between versions with ‹ ›
  ("Version 2 of 3", at most five). Each version is a full model run: the
  provider checks, the disclosure, and the consultation budget apply to each
  (with a 1-a-day budget the second version is refused and the first reply
  stays). Only the version shown is used: Preview scene revision and Save as
  Source Note take it, Save to Scratchpad saves it, and sending the next
  message keeps it and discards the others. Unkept versions are never
  written anywhere: the assistant's session history saves only the version
  shown. A failed version is dropped and the previous one is shown again. In
  the Character Lab, another version needs the same story point as the
  original reply.
- Slice 4.72 prompt breakdown with token counts: each line under Grounded in
  (Character Lab, character scenes, scene drafts) and under Sources used (the
  assistant) shows its estimated tokens as sent, after the 4.71 budget, and a
  line totals the prompt against the model's context: instructions,
  conversation, project context, and what is left for the reply ("No room is
  left for the reply" when the prompt fills the context; "(assumed)" when the
  server did not report its size). The dialogs show it before anything is
  typed; the assistant keeps each reply's breakdown with the reply.
  Checked against KoboldCPP 1.123.1's own prompt count (a Qwen model): the
  estimate (about three characters per token) was 1.42× high on prompt
  rules, 1.60× on English prose, 1.18× on JSON, and even (736 against 739,
  inside the 256-token margin) on text full of accented names and CJK. Four
  characters per token would undercount JSON, so the cautious estimate stays;
  on small English-heavy models the budget leaves some room unused.
- Slice 4.71 context budget and linked records: what the model is given now
  fits the configured model's context. The size comes from the running
  server where it says (Ollama's `/api/ps` for the loaded model, checked on
  Ollama 0.40.10 at 40,960; the local model server's `/props` from 4.75),
  the provider's context for hosted models (Anthropic 200,000, OpenAI
  128,000, Google 1,000,000), and 4,096 otherwise, shown as assumed. Project
  context gets the room left after the instructions, the conversation, and
  the reply (a quarter of the context, 768 to 2,048 tokens, or the reply cap),
  never more than 24,000 tokens, so hosted prompts do not grow. Each kind of
  context (the author's selection, World Bible records, accepted facts,
  dialogue style, story state, pending proposals, Source Notes, scene
  drafts, rules, linked records) has a share; what does not fit is left out
  lowest priority first, and leftover room goes to the rest. Accepted facts
  are weighed one at a time, identity, age, occupation, membership, and
  relationships before history, looks, and habits; the model is told how many
  facts were left out so it does not settle them itself. The assistant, the
  Character Lab, character scenes, and scene drafts (point-of-view character
  first) list what was left out. New setting, off by default: **Include
  linked World Bible records** adds the records one step from a grounded
  character: those in its links and those its accepted facts name exactly by
  name or alias, never two steps, at most eight, and lowest priority.
  Estimates are deliberately high (about three characters per token).
  Accepted-fact omission notices and their source headers count inside the
  same hard budget instead of being appended after the fit.
- Slice 4.70 character card export: a World Bible character's Writing aids
  tab has **Export character card**, which downloads `<Name>.card.json` in the
  Tavern Character Card V2 format for SillyTavern. The description holds the
  Description field, the other filled fields (labeled), "Also known as" with
  the aliases, and the accepted facts; trait facts become the personality;
  the Notes field goes in the card's creator notes, with the export date.
  Only what the Character Lab grounds the character with at the latest point
  is written: accepted facts whose proposal finished accepting, and the
  character's own aliases. Pending proposals, Source Notes, story state, and
  other records are never included, and the card's chat fields (first
  message, system prompt, and the rest) are left empty. Rich text keeps its
  paragraphs and list items. Characters have no portraits, so no PNG card is
  written; dialogue style is a display format, not a voice description, so
  it is not exported. The card reads back through the 4.69 importer; it was
  not loaded into a running SillyTavern.
- Slice 4.69 character card import: World Bible → Characters → **Import a
  character card** reads Tavern Character Cards (V1, V2, V3) from JSON or
  from a PNG's `ccv3`/`chara` text chunk (tEXt, iTXt, or compressed), V3
  first when both are present. Checked on SillyTavern's bundled default card
  (both chunks, a four-entry lorebook); only the public format is used, no
  SillyTavern code or assets. A preview shows where each part goes before
  anything is written: description to Description; personality, scenario,
  first message, example dialogue, alternate greetings, and creator notes as
  labeled sections in Notes; the whole card (plus nickname and tags) as a
  `Character card: <name>` Source Note; each kept lorebook entry as its own
  Source Note linked to the character (switched-off entries start unticked).
  `{{char}}` becomes the name; `{{user}}` is kept and pointed out. The card's
  system prompt and post-history instructions are not imported, because
  Source Notes can be retrieved into the app's own prompts, and the portrait
  is not imported. A name already used by a character or alias asks whether
  to add the card to that character (Source Notes only, character unchanged)
  or create a separate one. The draft is marked Needs completion, everything
  is written in one transaction, and no fact is accepted. Malformed,
  oversized (20 MB file, 8 MB decompressed PNG text, 50,000-character field,
  200 lorebook entries), and card-less files are refused with a plain reason;
  compressed PNG text is stopped while streaming before it can expand without
  bound. Other platforms' cards
  (HiWaifu) were not checked: no sample was available.
- Slice 4.75 local reply length from server context: requests to the local
  model server now carry a `max_tokens` sized to the room the prompt leaves
  in the loaded model's context, so replies are no longer stopped at
  KoboldCPP's 2,048-token default. The size comes from `GET /props` at the
  server root (llama.cpp, and KoboldCPP, which mirrors it) or KoboldCPP's
  `/api/extra/true_max_context_length`; both were checked on running servers
  (KoboldCPP 1.123.1, 16,384; llama.cpp b11669, 8,192 per slot). Finding:
  when the prompt and the cap together exceed the context, KoboldCPP drops
  the start of the prompt without saying so (an 11,137-token prompt with an
  8,000-token cap reached the model as its last 8,384 tokens, system prompt
  gone, and the answer was invented). So the prompt is estimated high (three
  ASCII characters or one other character per token, plus 256 tokens of
  margin), a smaller cap a feature sets is kept, and a request that leaves
  under 512 tokens of room is refused before it is sent with a plain "too
  long for the local model" message. On a server that reports no size (LM
  Studio, not available to run), Settings → Advanced → **Maximum reply
  length** sets the cap; blank leaves the server's own limit. A reply that
  still hits a limit is refused as before. The desktop main process applies
  the same rules and checks the setting's bounds (64–131,072). Hosted
  providers and Ollama are unchanged. In the desktop app, the renderer asks a
  narrow `llm:local-context-size` main-process probe for this value, so browser
  CORS cannot force prompt budgeting back to the 4,096-token assumption. Also
  fixed: Projects no longer acts on
  a project list that finishes loading after the page has closed; it could
  clear the active project another page had just set (the cause of the
  intermittent Compendium route unit-test failure, including on PR #70).
- Slice 4.68 constrained local output for proposals: the three features
  that expect a structured reply (Canvas brainstorm, Canvas coaching, and
  character from description) now hand the local model server a JSON Schema
  built from their own Zod schema, sent as `response_format: json_schema`.
  Checked first against a running KoboldCPP 1.123.1: it accepts and enforces
  `json_schema` and a GBNF `grammar`, while `json_object` returns JSON of any
  shape (an array, in the probe). LM Studio and the llama.cpp server were not
  available to run; `json_schema` is the form all three document. Measured
  on KoboldCPP with the features' real prompts and parsers (6 runs each):
  brainstorm 6/6 → 6/6, coaching 6/6 → 6/6, character 4/6 → 6/6, and replies
  2–3× faster, because the model goes straight to the JSON instead of
  reasoning first. A server that refuses the schema (400 or 422) gets the
  request again without it and is not sent one again that session. Replies
  are still parsed and validated by each feature, and nothing becomes canon
  without the author. Hosted providers and Ollama are unchanged. Finding:
  with no `max_tokens`, KoboldCPP stops every reply at 2,048 tokens, and a
  thinking model's reasoning counts toward that; both unconstrained
  character failures were replies cut off there.
- Slice 4.67 local OpenAI-compatible provider: Settings now offers **Local
  server (OpenAI-compatible)** for KoboldCPP (default
  `http://localhost:5001/v1`), LM Studio, and the llama.cpp server. It needs no
  API key, uses the OpenAI request shape with its own code, and never goes
  through the hosted OpenAI provider or its disclosure. It is a private-local
  route like Ollama: at a loopback address it says "Runs on your local model
  server. Nothing leaves this computer." and does not spend the consultation
  budget or show a hosted price ceiling; a remote address is blocked in the
  route, the provider, and the desktop main process. Settings takes the
  server address, tests the connection with a one-token chat request, and
  offers the models the server lists. With no model set, requests name the
  first listed model, or none so the server uses the model it has loaded. No
  `response_format` is sent (4.68 settles what each server accepts), no token
  cap is sent unless a feature sets one (4.75 sizes it from the context), and a reply cut off at a length
  limit is refused with a plain message. Desktop requests run in the main
  process, as Ollama's do. Ollama-only features (local AI review, the canon
  decision "Force local Ollama" mode) stay Ollama-only. Checked against a
  real OpenAI-compatible server (Ollama's `/v1`); KoboldCPP, LM Studio, and
  llama.cpp themselves were not run.
- Slice 3.24b backup import id remapping: importing a backup as a new
  project now gives every record a new id and rewrites every reference
  through one map. A backup can therefore be copied into the browser it came
  from as often as needed, and the source and each copy stay complete and
  independent. Ids the app builds from the project id keep that shape. A
  merge into another project copies records that belong elsewhere; merging
  the same backup again updates them instead of adding duplicates. A restore
  into the source project changes no ids, and no longer duplicates aliases.
  The 3.24a refusal remains as a safety net, and the Projects preview now
  says when an import makes a copy.
- Slice 3.24a backup import collision guard: importing a backup in the
  browser it came from no longer takes records away from the source project.
  Import keeps most record ids, so a new-project import, or a merge into a
  different project, used to overwrite the source's records and move them
  into the copy. Import now checks every incoming id first (plus the
  settings record and the ruleset). If any belongs to another project, it
  refuses and writes nothing. The Projects page shows the import as blocked,
  with the reason, before `Apply Import`. Restoring a backup into its own
  project still works. Copying a project within one browser waits for 3.24b.
- Slice 3.23c browser-storage preferences and mechanics draft: the
  unfinished first-mechanics form in the World Bible (value kind, name, and
  starting value) now lives in project storage, in the `mechanics_drafts`
  store (`DB_VERSION` 30). It survives a reload, travels with backups
  (snapshot `schemaVersion` 10; older backups import with no drafts), and is
  removed with its project, on Cancel, or once tracking is set up. Drafts
  that older builds left in `localStorage` move over the first time a
  character in that project is opened, and the old keys are removed.
  Collapsed rails (Corkboard, World Bible, Lore), the Source Note starter
  panel, and recent commands now share `utils/browserPreferences.ts` and
  `hooks/useCollapsedPreference.ts`, with the same keys, so no setting is
  lost. The remaining browser-storage keys are listed in
  `docs/architecture-review.md` for 5.15.
- Slice 3.23b project-scoped IndexedDB indexes: `DB_VERSION` is 29. The
  upgrade adds a non-unique `projectId` index to every project-scoped store
  and to migration backups; records are not rewritten. Project reads
  (`…ByProject` getters, backup export and import, snapshots, the migration
  chain, and replace-by-project writes) go through
  `services/storage/projectIndex.ts` instead of loading every project's
  records and filtering, with the same order and contents. A missing project
  id reads nothing. Backup and snapshot formats are unchanged.
- Slice 3.23a one storage layer (behavior-preserving): IndexedDB is reached
  only through `apps/web/src/services/storage/`. The 11 root-level
  repositories, the service repositories (canon decisions and suppressions,
  lore facts, entity proposals, state ledger, compendium, character sheets and
  identity, aliases, consistency, review runs), and `db.ts` moved there under
  their own names; one `idbRequest.ts` replaces the 12 `requestToPromise`
  copies. Four modules that mixed logic with a transaction now call storage:
  character package import (`saveCharacterTransferImport`), item-state
  authoring (`saveItemStateAuthoringPlan`), character identity resolution
  (storage runs the read-plan-write transaction around the pure
  `planCharacterIdentityResolution`), and rulesets, whose separate
  `worldbuilding-desk` database is opened by `repositories/rulesetStorage.ts`
  while indexing stays in `rulesetService`. Code outside the folder imports
  its index, which exports repositories and store names but not `openDb`;
  ESLint rejects deep imports into the folder and any `indexedDB` use outside
  it (tests excepted). No schema change, no new stores, same function names.
- Slice 3.22 characterization and extraction (behavior-preserving): the
  compendium now has 31 characterization tests (fake IndexedDB for storage,
  pure tests for mechanics), checked by planting five regressions, and is
  split into `compendiumMechanics.ts` (pure), `compendiumStorage.ts`
  (entries, milestones, recipes, progress, action logs), and
  `compendiumWorldStorage.ts` (zone affinity, settlements) behind the
  unchanged `services/compendium` index. Recorded quirks: a moved settlement
  leaves its previous location record in place, and category substring
  matching reads "stores" as a mineral domain. `useWorkspaceStatBlocks`
  (1,074 → 546 lines) delegates to `services/workspace/statBlockResolution.ts`
  plus `useStatBlockPreferencePersistence` and `useStatBlockRebind`;
  `useWorldBibleEntityActions` (1,125 → 429) delegates to
  `services/worldBible/worldBibleEntityPlans.ts` plus
  `useWorldBibleMergeActions` (the two merges share one commit path) and
  `useWorldBibleLinkActions`. No hook is over 600 lines; return shapes and
  callers are unchanged; the size baseline is down to 10 files.
- Slice 3.16 `useWorkspaceConsistency` split (behavior-preserving): the
  2,234-line hook is now a 450-line composer over `useReviewPreferences`,
  `useSceneSaveReview` (`persistDoc`), `useConsistencyReviewRuns` (refreshes,
  project review run, persistence, item dismissal), `useStateMutationReview`,
  `useUnknownCategorySuggestion`, `useUnknownEntityResolution`, and
  `useUnknownEntityDismissal`, none over 600 lines. Pure logic moved to
  `services/consistency/unknownCategorySuggestion.ts` and
  `sceneReviewHelpers.ts`, with tests. The composer keeps the shared review
  state and the same return shape; callers are unchanged. File-size baseline
  now has 8 entries.
- Slice 4.38 model-assisted canon check: **Check this scene against canon** in
  the Workspace review drawer sends the open scene (paragraph text, up to
  12,000 characters) and the accepted, valid-at-scene facts about entities it
  names by name or alias to the configured provider, with the usual
  disclosure, budget (`canon-check`), and Stop. No facts → nothing sent or
  spent. The reply (`{factId, evidence, summary}`) is parsed strictly;
  candidates citing unknown facts or text not verbatim in the scene are
  discarded and counted. Survivors appear in the shared proposal preview and
  join the review queue only on **Confirm action**, as dismissible
  `STATE_CONFLICT` warnings labeled "Model-assisted check · provider".
  Since 4.53 they are part of the shared review model (persisted,
  underlined, counted); an item drops out when its quoted text leaves the
  scene. Service: `services/consistency/modelCanonCheck.ts`;
  three corpus cases with `modelCheckTargets` (paraphrase, implication,
  reworded denial) are asserted as structural non-hits the check can cite.
- Slice 4.52 opt-in AI scene drafts: **Allow AI scene drafts** in Settings →
  AI → advanced (`ProjectAISettings.allowSceneDrafts`, default off, per
  project, disabled while AI consultation is off). When on, **Draft this
  scene** appears in the Workspace scene header on scenes of 50 words or
  fewer, and on a Corkboard chapter card's linked empty scenes (it opens the
  scene in Workspace with the dialog). The dialog shows every input before
  sending: goal (seeded from linked chapter cards), characters present (up to
  4) and point of view, setting, beats, target length, the previous scene's
  last 150 words (editable), and notes. Grounding follows the character lab
  (records, accepted facts, dialogue styles, story state at the scene's
  start); other scenes and Source Notes are not sent. Same disclosure,
  consultation budget (`scene-draft`), Stop, and **Draft again** as the lab.
  Drafts are cut at 1,500 words in code (the stream stops at the cap).
  **Insert into scene** is one undoable insert marked `scene-draft`; **Save to
  Scratchpad** keeps a labeled copy. Nothing else is written. Service:
  `services/sceneDraft/sceneDraft.ts`.
- Hotspot freeze (Slices 3.14 and 3.18) and behavior-preserving extraction:
  `pnpm check:file-sizes` (`scripts/check-file-sizes.mjs`, run in `web-verify`)
  fails when a non-test source file over 1,000 lines grows past
  `scripts/file-size-baseline.json`, or a new file crosses 1,000; the baseline
  covers 15 existing files and `--update` records shrinkage. Changes to the
  size-check script or baseline also trigger Web CI.
  CI now selects documentation/tooling, fast, focused-UI, or full verification
  through a tested path policy. Full browser coverage runs in three disjoint
  groups with retries disabled. Superseded PR runs are cancelled. An identical
  verified code/coverage fingerprint can reuse successful tests for a
  documentation-only follow-up; unknown or failed evidence requires fresh
  tests, and production dependency advisories remain a fresh check. The
  `cypress-smoke` aggregate fails on missing or failed selected checks. Manual
  dispatch and the `ci:full` PR label request fresh full coverage.
  `EditorWithAI.tsx` 1,636 → 1,285 lines: stat peek moved to
  `useEditorStatPeek` + `EditorStatPeekLayer`, and an unused insert state was
  removed. `WorkspaceRoute.tsx` 2,294 → 1,873: the unknown-name review popover
  and **Add to World** popover moved to `WorkspaceReviewSurfacePopover` and
  `WorkspaceManualWorldCapturePopover`. The character lab dialogs save through
  `useCharacterLabData` (`saveToScratchpad`, `saveFromDescription`), and the
  stat pin panel gets ordered scenes from `useCharacterStatPeekData`, so none
  of them import storage. World Bible category load race fixed: a category
  changed or added while the initial load is in flight is merged into the
  loaded list instead of being overwritten (`mergeLoadedCategories`).
- Slice 4.51 AI text report: **AI text report** in the Workspace scene drawer
  (beside the exports) opens a project-level record of marked AI text:
  words and passages per scene and by feature and provider (with models),
  plus the manuscript's total words. It reads the open scene as edited, so it
  never lags autosave. One multi-paragraph insert counts as one passage;
  **Mark as my writing** in the middle splits it; a word counts when any part
  of it is marked. Unknown provenance shows as unknown rather than dropped.
  Copy is factual and platform-neutral (says what the app inserted, that
  pasted or typed text is never marked, and that the judgment is the
  author's); **Copy report** puts a plain-text record on the clipboard.
  `buildAITextReport` / `formatAITextReport` in
  `services/editor/aiTextReport.ts`; the dialog's open state lives in
  `workspaceUiStore` and closes the scene drawer on narrow screens.
- Slice 4.50 AI text provenance: an `aiText` TipTap mark (registered in every
  editor config, so it survives save and reload) records origin, provider,
  model, route, and time on text a model wrote. `insertAIText` marks the
  content before inserting it, in the same undoable transaction. Marked
  paths: assistant scene revisions (only model-written replies, stamped with
  provenance when generated; app-written answers insert unmarked) and
  character-scene Insert at cursor. Stat snapshots and system history are not
  AI text and stay unmarked. Not inclusive at the edges; edits inside keep
  the mark; **Mark as my writing** clears it; **Show/Hide AI text** toggles a
  neutral highlight. Exports are plain text, so the mark never leaves the app
  except in backups. AI inserts drop zero-width characters and turn no-break
  spaces into spaces.
- Slice 3.13 atomic canon acceptance: `runProjectWriteTransaction` commits a
  multi-store change in one IndexedDB transaction, with change events after
  commit. Accepting an entity proposal (new or existing canon, legacy
  character canonicalization, Source Note links, an optional alias, and the
  proposal's accepted status), accepting a fact (fact, proposal, alias or
  character field), superseding a fact, and removing a fact (revert, delete,
  reopen proposal) each commit together or not at all. Side effects are pure
  planners (`planCanonicalFactSideEffects`,
  `planRevertCanonicalFactSideEffects`, `planAliasSave`). Real-IndexedDB tests
  inject a failing last write and assert nothing persisted; they fail when the
  transaction is not aborted. Retrieval and memory indexing and canon-decision
  cluster resolution follow the commit.
- Slice 3.12b private-local AI classification: one provider-route
  classifier (`services/llm/providerRoute.ts`, `hooks/useProviderRoute.ts`)
  drives disclosures and the consultation budget. Only loopback Ollama with a
  model `/api/tags` lists as installed and not cloud is `private-local` (the
  on-device copy and the budget exemption); cloud models (`remote_host` /
  `remote_model` or a `cloud` tag), remote addresses, not-installed models,
  and an Ollama that does not answer fail closed. A bare `'ollama'` provider
  name no longer exempts a request from the budget. The desktop main process
  and the browser build's Ollama provider verify the model before sending,
  refuse cloud and missing models, and auto-pick only local models (main no
  longer falls back to an unverified `llama3.1`). Settings, the character
  lab, and World Canvas coaching/brainstorm show the verified state; the
  Ollama connection test hides cloud models and blocks a configured one.
  Remote Ollama stays blocked by author decision.
- Slice 3.12a provider credential and endpoint hardening: hosted-provider
  API keys live in the desktop main process, encrypted with the OS keychain
  (`safeStorage`, `providerKeyVault.ts`); saving fails closed when OS
  encryption is unavailable. The renderer reaches them only through
  `provider-keys:status|set|clear` and never reads a key back; keys older
  builds left in `localStorage` move into the vault at startup and the
  plaintext copy is removed only after the vault accepts it. Every provider
  request, Gemini included (new main-process adapter, key in a header), runs
  in main, which refuses payloads carrying `apiKey` and applies a
  scheme/host policy to provider addresses (hosted: HTTPS to their own
  origin; Ollama and local OpenAI-compatible servers: loopback only). The
  packaged renderer has a CSP meta tag (no hosted-provider hosts; loopback
  plus the embedding-model download hosts) and the dev server gets a header
  policy; the main window has a `will-navigate` guard. Settings no longer
  pre-fills saved keys, a blank field keeps the saved key, and each provider
  has Remove saved key. The browser dev build keeps keys behind
  `providerKeyStore`. `apps/desktop` now has lint and 19 Vitest tests, run in
  CI. Verified against the real main process: migration, status/set/clear,
  renderer-key and remote-Ollama rejection, missing-key message, and a local
  Ollama completion through main.
- Slice 3.11 rules-engine hygiene (R2): `FormulaParser` evaluates through a
  restricted mathjs instance (`import`, `createUnit`, `evaluate`, `parse`,
  `compile`, `simplify`, `derivative`, `resolve`, `reviver` throw inside
  formulas). `WorldRuleset.rules` is typed by `GameRuleSchema`; `saveRuleset`,
  project storage migration 6→7, and snapshot migration 8→9 move rules that
  fail it into `quarantinedRules` (kept verbatim, never executed or sent as
  context, noted on the Ruleset route). `StateManager` and wall-clock timer
  and exposure state moved to the non-exported `src/experimental/` path.
  Triggered rules now stop after one level, so a self-triggering rule
  terminates. Engine tests went from 14 to 47.
- Slice 4.49 provider context parity: `LLMRequest.context` is rendered once
  by `services/llm/contextPrompt.ts` (`[Source: label]` blocks after the
  system prompt). The hosted renderer adapters use it unchanged; the
  renderer Ollama adapter and `LLMService`'s Electron request builder fold
  context into the system prompt before the request leaves the renderer.
  Before this, the assistant's canon/Source Note grounding and the coaches'
  craft material never reached local Ollama in the browser or any provider
  except Gemini in the desktop app (the main-process adapters send only the
  system prompt and messages). The Electron IPC surface and the response
  cache key are unchanged. A Cypress case asserts the writing coach's craft
  sources reach a local Ollama request, and fails without the fix.
- Slice 4.45 character from a rough description (CL-4): **Start from a
  description** on the World Bible Characters page opens
  `CharacterFromDescriptionDialog`. The generation reply is strict JSON,
  validated by `parseCharacterProfileReply`: malformed replies are rejected
  whole, a name survives only if the description contains it, and each stable
  fact must quote the description (unquoted facts are dropped and counted).
  The author edits the name, unticks facts, and edits or drops suggestions,
  then explicitly accepts. That creates a draft `WorldEntity`
  (`needsCompletion`, its Description field holding the author's own
  description and its Notes the kept suggestions), a `character_dossier`
  Source Note with
  the description plus kept suggestions under a not-canon heading, its
  primary-subject link, and proposed facts whose evidence spans point into
  the note. The facts are reviewed in Source Notes like any other; unkept
  suggestions never enter World Bible fields; an accepted age or occupation
  fact fills an empty Age or Role field on the character entity. Generation
  invents appearance, biography, personality, voice, wants, relationships,
  and a secret as suggested details only. A name matching an existing
  character's canonical name or alias requires choosing **Add to <name>**
  (proposals only, no merge) or **Create a separate character**. Cypress
  covers create → review → accept to canon, the collision path, and a
  refused invented name. The character lab contract is now in
  `docs/domain-model.md` §5 and `docs/product-blueprint.md`.
- Slice 4.44 character scenes (CL-3): **Write a character scene** in the
  Workspace context drawer's Characters tab opens `CharacterSceneDialog` —
  choose two or three characters and a story point (default: the cursor in
  the current scene). **Directed** takes an author setup; **Surprise me**
  lists and sends the chapter cards explicitly linked to the chosen scene
  plus up to six most-recent open World Canvas threads (settled and set-aside
  threads never). Only the chosen characters' grounding is sent, shown per
  character in the Grounded-in panel. Output is draft prose with
  speaker-attributed dialogue; **Save to Scratchpad** appends a draft-marked
  record of the setup or seeds, and **Insert at cursor** is an ordinary,
  undoable editor insert through the existing pending-insert path. Drafts
  live for the app session; runs share the lab's budget feature, Stop, and
  disclosure. `StoryPointPicker` and the provider checks are now shared with
  the talk dialog.
- Slice 4.43 talk to a character + reaction test (CL-2): `CharacterLabDialog`
  opens from **Talk to <name>** on a saved World Bible character (grounded at
  the latest point) and from **Open character lab** in the Workspace context
  drawer's Characters tab (grounded at the cursor in the current scene). Talk
  (first-person, earlier completed turns replayed) and Reaction test modes;
  story point and moment are adjustable; the `CharacterStatCard` beside the
  conversation is built from the same snapshot the model receives, and a
  "Grounded in" list names every section sent. Runs use the shared model run
  (Stop, elapsed, thinking), the `character-lab` budget feature (local Ollama
  exempt), an explicit hosted/local data disclosure, and no response cache.
  Transcripts live for the app session per character; **Save to Scratchpad**
  appends draft-marked, escaped HTML through `appendToScratchpad`, and open
  scratchpad editors apply the same append in memory so they never save over
  it. No canon, fact, state, or manuscript writes (Cypress asserts the stores
  are unchanged).
- Slice 4.42 character voice contract (CL-1, no UI):
  `services/characterLab/characterVoiceContext.ts` builds read-only grounding
  for one World Bible character at a scene position (opening, cursor, ending,
  or latest) through the shared character link resolver — canonical record
  and aliases, accepted canon facts valid at that position, the assigned
  dialogue style, and `buildCharacterSnapshot` story state — as tagged
  sections with provenance. Facts whose source proposal is known and not
  accepted are excluded (guards the fact-before-proposal write order). The
  story-state section is labelled as what is true, not what the character
  knows. `characterVoicePrompt.ts` holds the shared in-character rules and
  knowledge disclaimer with talk, reaction, scene (2–3 distinct characters,
  directed or surprise), and generation variants; grounding is embedded in the
  system prompt because the Ollama provider does not render
  `LLMRequest.context`. Nothing calls it yet (4.43–4.45).
- Slice 3.10 rules-engine consolidation (R1): the manuscript-time state core
  (state mutation command/event types, schemas, ordering, command
  application, state validation, replay baseline, replay, and ruleset
  validation) lives in `packages/rules-engine/src/manuscript/`; web modules
  re-export it and keep persistence. A replay parity harness
  (`services/state/replayParity.test.ts`) pins the digest of 63 cases
  (~12k replays) and was reproduced exactly. Web Vitest resolves the package
  from source (`extends: true` on each inline project).
- Slice 4.48 pinned stat panel: up to three characters pinned from the editor
  peek, palette dialog, scene roster, or World Bible mechanics panel appear in
  a collapsible app-shell panel (`components/StatPinPanel.tsx`) on Workspace,
  World Canvas, Corkboard, and World Bible, above the Scratchpad dialog. In
  Workspace it follows the scene and cursor through the snapshot function
  Workspace publishes; elsewhere it shows the latest state or the end of a
  chosen scene. Each card has **Changes since previous chapter** (Corkboard
  scene links find the chapter, else the previous scene; pure logic in
  `services/state/statPanel.ts`), **Open sheet**, and unpin. Pins are a
  persisted per-project UI preference in the Workspace UI store, removed with
  the project and never in backups. On narrow screens the panel is a bottom
  sheet. It lifts itself above Workspace's save bar. All card styles moved to
  `styles/CharacterStatCard.module.css`. The stat peek plan is archived and its
  behavior folded into the product blueprint.
- Slice 4.47 stat peek from the editor and command palette: in Workspace, with
  the cursor in or a selection on a character's name or alias,
  **Cmd/Ctrl+Alt+S** or the right-click **Show stats** item opens the shared
  `CharacterStatCard` at the cursor in a focusable popover (Escape returns to
  the editor; a shared name asks which character). The mouse hover card now
  shows the same card. The command palette offers **Show stats for…** (and
  `Show stats for <name>` search results) on every route: in Workspace it
  opens the peek at the cursor, elsewhere a dialog shows the latest state.
  Cards follow the project's stat-block style and stat/resource scope. All of
  it is hidden when game systems are disabled, including the hover card,
  which was previously shown regardless. Name matching lives in the pure
  `services/state/characterPeek.ts`; the palette dialog reads data read-only
  (new `getSettlementState` never creates a settlement record). Verified by
  unit tests and `cypress/e2e/stat-peek.cy.ts` (rostered and roster-hidden
  characters by shortcut, context menu, palette, values match the Sheets
  route, no IndexedDB record changes, gating).
- Slice 4.46 character snapshot service + shared stat card: new pure
  `services/state/characterSnapshot.ts` (`buildCharacterSnapshot` at a scene
  opening/cursor/ending or `latest`, `describeCharacterSnapshotChanges`,
  `summarizeCharacterSnapshot`, `getSceneOrder`) and
  `components/CharacterSheets/CharacterStatCard.tsx` (compact/full card plus
  shared resource, status, and full-state parts). The scene roster and the
  editor character hover card now read state through the service with no
  behavior change: roster model output (54 scene/moment/cursor cases) and
  rendered roster markup (9 renders) were byte-identical before and after,
  and the hover card matched a verbatim copy of its old logic in 24 cases.
  Groundwork for stat peek 4.47–4.48 and the character lab. Lint with 1
  baseline warning; 710 web (+12) + 6 engine + 12 UI tests; web/desktop
  builds; full Cypress 104/104 across 22 specs.
- Slice 4.25 persisted, incremental project review: new `project_review_runs`
  store (DB version 27), `projectReviewRunStorage.ts`, pure
  `incrementalReview.ts` (content and inputs hashing, reuse plan, stale
  marking; 5 unit tests), hook wiring for restore/reuse/persist/dismiss, and
  a drawer stale badge plus header count. Timing on the deterministic engine
  with the trust-dogfood chapters copied to 40 scenes: first run 383 ms
  (0 reused), second run 47 ms (40 reused). New Cypress spec
  `project-review-persistence` covers reload restore, the stale marker after
  an edit, and clearing it by re-running. Lint with 1 baseline warning; 553 web (+5 new) + 6 engine + 12 UI tests; web/desktop builds; full Cypress 79/79 across 18 specs including the new `project-review-persistence` spec.
- Slice 4.24 fact-anchored canon contradiction detection: new
  `services/consistency/factSlotComparison.ts` (slot parsing, linguistic and
  learned value classes, per-claim speaker-aware attribution, negation and
  numeric comparison, per-project synonym hook) replaces the eye-color
  special case in `contradictionReview.ts`; `STATE_CONFLICT` contract,
  highlights, and dismissal unchanged. Corpus: 19 cases, 12/12 planted
  findings matched, 0 noise, 0 mislinks; the 4.23 speaker-attribution
  `knownGap` healed and was removed; six new cases (scales color, transient
  adjective non-hit, negation, numeric age, numeric service years, learned
  staff-wood class). 12 focused comparator unit tests; existing
  contradiction tests unchanged and green. Lint with 1 baseline warning; 548 web (+12 new) + 6 engine + 12 UI tests; web/desktop builds; Cypress not required (no routed UI change).
- Slice 4.23 continuity review regression corpus: 13 cases, 7 expected
  findings all matched (recall 100%), 0 planted-absence violations, 0
  mislinks; 1 `knownGap` recorded for 4.24 (second-person eye-color claims
  attributed to the speaker when only the speaker has an eye-color fact).
  Corpus entity/alias/fact shapes go through the same
  `buildKnownConsistencyEntities`, `buildExtractedProposal`,
  `validateProposal`, and `findCanonContradictions` code the Workspace uses;
  excerpts are quoted from the fixture verbatim. No behavior change. Lint with 1 baseline warning; 536 web (+2 new) + 6 engine + 12 UI tests; web/desktop builds; Cypress not required (no routed UI change).
- Dogfood path simplification: `createTrustDogfoodProject` (unit-tested via
  fake IndexedDB: five scenes in order, escaped paragraph HTML with system
  lines intact, four Source Notes with correct kinds and import provenance,
  ruleset saved and linked, zero entities/facts), generated fixture content
  with a parity test against the source files, dev-gated Projects button, a
  Cypress spec that loads the fixture and lands in Workspace. Runbook gained a
  one-page run sheet, fast-path notes on A-1–A-6, a current-label check
  index, and corrected Character Tools era paths (`Extract Candidates`, More →
  Character packages). Also fixed the recurring `post-merge-smoke` "Add mechanics" flake at its root: the Cypress seed wrote projects without `storageSchemaVersion`, so every spec's first load ran the full migration chain whose project writes raced any IndexedDB mutation a spec made right after reload (the test's `rulesetId` was clobbered); the seed now stamps the current schema version, guarded by `cypressSeedSchema.test.ts`. Lint with 1 baseline warning; 534 web (+5 new) + 6 engine + 12 UI tests; web/desktop builds; full Cypress 78/78 across 17 specs.
- Slice 5.12 app-shell toast viewport + status live region: new
  `store/notificationStore.ts` (toasts + announcement), `AppNotifications`
  mounted once in the app shell (and in the route test helper), `RouteFeedback`
  bridge adopted by Projects, Lore, Canon Decisions, World Bible, Ruleset,
  Compendium (both views), Character Sheets, Character Packages, and
  Workspace (errors-as-toast, resolver notice as an action toast); Workspace's
  local viewport, timer, and toast/resolver styles removed along with the
  now-unused route `.feedback*` styles. `useStatusAnnouncement` wired to
  autosave, both consistency review runners, Source Note extraction, project
  storage migration (via a new `onMigrated` callback on
  `ensureProjectStorageCurrent`, keeping the migration service UI-free), and
  both assistant streaming paths. `aria-invalid`/`aria-describedby` extended
  to three more validated fields. Toast-versus-inline split and live-region
  rule recorded in the blueprint design system. Lint with 1 baseline warning; 529 web (+11 new) + 6 engine + 12 UI tests; web/desktop builds; full Cypress run 75/77 across 16 specs (new `app-notifications` 2/2, `local-diagnostics` 2/2). Both failures were in `post-merge-smoke`: the JSON-conflict assertion legitimately changed from `[role="status"]` to `[role="alert"]` because error feedback is now an inline alert (updated), and the Add-mechanics navigation case is a pre-existing hydration race in that test's setup (it rewrites the persisted `rulesetId` and reloads; a click before rehydration takes the handler's non-sheet branch). After the selector fix the spec passes 18/18 in isolation alongside `app-notifications` 2/2.
- Slice 5.6 local-only error handling: new `services/errors` module with
  `describeError`/`classifyError` (author-facing mapping that preserves
  app-authored validation messages), a redacted `localStorage`-backed
  diagnostics log with exact-secret registration from the active project's
  AI settings, window-level capture of uncaught errors and unhandled
  rejections, and a Settings → Diagnostics panel (copy report, show/hide
  report, clear log). All 107 `error instanceof Error ? error.message :
  fallback` render sites across routes, hooks, components, the app store,
  and the local review engine now call `describeError`; a source-scanning
  test (`errorDescriptions.test.ts`) keeps the raw pattern from returning
  outside the two allowlisted helpers. Tests assert the report and the
  stored log exclude API keys of known and configured shapes, macOS/Linux/
  Windows paths, provider payloads attached as `cause`, and manuscript
  prose. Lint with 1 baseline warning; 518 web (+18 new) + 6 engine + 12 UI tests; web/desktop builds; full Cypress run 73/75 with the new `local-diagnostics` spec 2/2 — the two failures (`lore-review-matching` alias highlight timing, `post-merge-smoke` Add-mechanics navigation timing) are unrelated to error rendering and both pass in isolation (14/14, 18/18); the post-merge spec failed twice in a row before passing on the working tree and passes on the base tree, so it is recorded here as intermittent rather than cleared.
- Slice 5.10 author-facing vocabulary sweep: retired "Shodh," standalone
  "RAG," and "Rubber-Duck" from every rendered string found across a full
  source sweep (JSX text, help copy, empty-state/error strings, plus a few
  developer-facing comments and thrown-error/console messages caught along
  the way) — "Shodh memories" → "Project memory," "RAG documents" →
  "Indexed context," "Inherit RAG data" → "Inherit indexed context" (and
  its inconsistent neighbor "Inherit memories" → "Inherit project memory"
  for the same concept), "Rubber-Duck AI" → "Think it through." Internal
  service/type/identifier names (`ShodhMemoryService`, `RAGProvider`,
  `inheritShodh`, `getRAGService`, etc.) are unchanged — string-layer only,
  behavior-preserving. New `vocabulary.test.ts` scans all non-test
  `.ts`/`.tsx` source for the retired words as standalone tokens (word-
  boundary regex, so compound identifiers like `ShodhMemoryService` are
  correctly excluded) so they cannot silently return. Lint with 1 baseline
  warning; 500 web (+4 new) + 6 engine + 12 UI tests; web/desktop builds;
  full Cypress suite 72/73 (the one failure is the same confirmed
  pre-existing, unrelated flake noted against 1.5/4.20/4.22/5.4/5.5).
- Slice 5.5 AI provider setup UX hardening: `AISettings.tsx` now has a real
  "Test connection" action per provider (a single-token completion for
  Anthropic/OpenAI/Gemini, reachability + installed-model check for
  Ollama — previously only Ollama made a real network call, the hosted
  providers just confirmed a key was present locally) with plain-language
  success/rejected-key/unreachable results, a two-tier Setup/Advanced
  split (only the selected provider's key field shows; base URL and Lore
  Inspector budget/policy controls move behind an explicit "Show advanced
  settings" toggle — not a nested `<details>`, which collides with the
  Settings page's own section-toggle convention and its Cypress helper),
  three author-facing relabels named by the review (context chars → how
  much story context to send; low-cost model override → cheaper model for
  routine checks; project review engine → who checks your draft), an
  on-device-vs-hosted data-flow disclosure next to the provider picker, and
  an actionable "Open Settings" link on the assistant's not-configured
  notice. New services/llm/connectionTest.ts carries the real-call logic
  (11 unit tests) rather than embedding it in the settings component,
  which had zero test coverage before this slice. Lint with 1 baseline
  warning; 496 web (+11 new) + 6 engine + 12 UI tests; web/desktop builds;
  full Cypress suite 73/73, including new ai-provider-setup.cy.ts (6/6)
  and an existing post-merge-smoke.cy.ts case updated for the new
  labels/copy.
- Slice 5.4 progressive first-run onboarding + sample project: a truly
  fresh install (zero projects, one-time check, guarded against ever
  re-triggering) now auto-creates a blank draft-ready project and lands in
  Workspace immediately; a dismissible "Getting started" panel (shown only
  on first-run/sample projects, never on ones the author already had) walks
  the write → capture canon → review loop and offers the bundled sample
  project as an alternative, reachable from that panel or directly from
  Projects. The sample is trimmed from the Slice 1.1 trust-dogfood fixture
  to one self-contained factual conflict (two lore documents disagreeing
  about a character's years of service) that the author discovers by
  running the real extraction/canon-decision pipeline themselves — nothing
  is pre-extracted or pre-accepted as canon by the fixture. Caught and fixed
  a real bug during Cypress verification: the guide component's variant
  defaulted to showing on every project rather than only marked ones,
  which would have put an unrequested banner on every existing project and
  broke unrelated layout in several existing specs. Lint with 1 baseline
  warning; 485 web (+13 new) + 6 engine + 12 UI tests; web/desktop builds;
  full Cypress suite 66/67 (new onboarding.cy.ts 3/3; the one remaining
  failure is the same confirmed-unrelated pre-existing flake noted against
  Slices 1.5/4.20/4.22 — likely local Ollama resource contention with
  Cypress/Electron on this machine, not a code issue).
- Slice 4.22 progression continuity candidates: a new Story Dashboard section
  deterministically shortlists characters with an established priority
  ability never lexically referenced across their scene appearances, and
  named rapid-advancement methods never referenced again after their
  establishing event. Author-triggered, model-assisted, scene-cited
  consultation judges each candidate via a deterministic, position-anchored
  `Verdict:` tag (same pattern as the 1.5 canon-decision prefill — never
  free-prose matching); dismissal persists per-project in localStorage,
  mirroring the Workspace consistency review's existing hidden-item pattern
  rather than adding a new IndexedDB store, backup contract, or schema
  version. Lint with 1 baseline warning; 472 web (+20 new) + 6 engine + 12 UI
  tests; web/desktop builds; Cypress corkboard-route.cy.ts covers the empty
  state and a full seed/dismiss/reload/restore round-trip.
- Slice 4.20 writing coach experience: an inline "Ask the writing coach"
  action (scoped to the current selection, or the open scene when nothing is
  selected) and a Story Dashboard "Writing coach" section (scoped to
  deterministic manuscript-wide measurements, never raw scene prose) both
  pair cited craft-library reference material with the given evidence,
  sharing the project's daily AI-consultation budget and the 1.5
  propose-preview-confirm surface for their only follow-up action (save as a
  draft Source Note). `getCraftLibraryService` now loads its multi-megabyte
  manifest via dynamic import instead of a static one, keeping the corpus's
  first real consumer from bloating the main bundle. Lint with 1 baseline
  warning; 452 web (+7 new) + 6 engine + 12 UI tests; web/desktop builds;
  Cypress 62/63 full run, including new coverage in ai-scene-revision.cy.ts
  and corkboard-route.cy.ts, whose lone remaining failure is the same
  confirmed-unrelated pre-existing flake noted for Slice 1.5. Along the way,
  fixed a real layout bug the new inline button exposed: the assistant's
  action row could overflow and cover the Send button at narrower widths
  (`AIAssistant.module.css` `.actions` now wraps).
- Slice 1.5 shared AI proposal surface is complete: assistant output can be
  captured as a draft Source Note, and the canon rubber-duck can prefill its
  decision from a deterministic, position-anchored `Suggested Action:` tag
  (never free-prose matching), both routed through the same
  `AIProposalPreview`/`useAIProposalConfirmation` surface as reviewed scene
  revisions and the World Bible record helper. Lint with 1 baseline warning;
  445 web (+9 new) + 6 engine + 12 UI tests; web/desktop builds; Cypress
  ai-scene-revision 4/4 and canon-decisions 3/3, plus a clean 61/62 full run
  whose lone failure (an unrelated pre-existing character-capabilities-
  routing assertion) was confirmed independent of this change.
- Slice 4.18a craft-library tranche 2 packages the full 166-record
  author-vetted working corpus as 2,136 embedded chunks in content version
  `2.0.0-tranche-2`, superseding tranche 1's eight-record subset. Working
  `document_type`/`source_confidence` values outside the runtime's three-value
  contract are mapped explicitly and validated; the generated bundle moved
  from an inline TS literal to a `.json` data file with a stable loader to
  stay within TypeScript's structural-checking limits at this size. Web lint
  with 1 baseline warning; 436 web + 6 engine + 12 UI tests; web/desktop
  builds. No routed UI changed, so Cypress was not required.
- Slice 4.18 craft-library tranche 1 packages eight author-vetted, cited
  records as 97 embedded chunks. Source/catalog validation, runtime schema
  validation, bundled lexical retrieval, labeled provenance, and safe citation
  rendering are covered by automated tests.
- Slice 4.19 derived story dashboard passes web lint with one existing hook
  warning, 429 web tests, 6 rules-engine tests, 12 rules-ui tests, web/desktop
  production builds, and the full 61-test Cypress suite. Coverage locks
  deterministic word/dialogue counts, explicit-only chapter links, accepted
  event distribution, general-fiction containment, mechanics co-movement and
  advancement intervals, schema-4 migration/backup conservation, desktop and
  narrow dashboard rendering, and source-scene navigation.
- Slice 4.17 craft-library retrieval infrastructure passes the package
  build/check, web lint with one existing hook warning, 423 web tests, 6
  rules-engine tests, 12 rules-ui tests, and web/desktop production builds.
  Service coverage verifies offline lexical retrieval, compatible hybrid
  ranking, incompatible/unavailable-model fallback, labeled provenance,
  empty/token libraries, rejection of unvetted or mismatched bundles, and
  project-RAG route isolation. Cypress was not required because no routed UI
  changed.
- Slice 1.5 reviewed scene-revision checkpoint passes 416 web tests, 6
  rules-engine tests, 12 rules-ui tests, lint (one existing warning), and
  web/desktop production builds. The full Cypress suite passes 61/61,
  including preview/dismiss/confirm, stale-source rejection, explicit append,
  and narrow-drawer access. Source Note capture and canon prefill remain open.
- Slice 1.5 shared proposal-preview checkpoint passes 410 web tests, 6
  rules-engine tests, 12 rules-ui tests, lint (two existing warnings), and
  web/desktop builds. Cypress passed 55/57 initially; both prompt-tool Settings
  failures passed in the focused 17/17 post-merge rerun. The shared preview's
  light/dark themes and retained failure feedback were browser-checked using
  an isolated temporary fixture. Other Slice 1.5 integrations remain pending.
- Road-to-market Slice 1.2b routes storage/custody questions through all
  primary saved scenes in manuscript order instead of the highest-ranked RAG
  chunks. The five-chapter D4 fixture now distinguishes Odessa's designated
  vault from chapter 4's sign-out/Brannic pocket and chapter 5's Sera use,
  reports the undocumented handoff as current-custody uncertainty, and cites
  all three scenes without invoking a provider. Web lint passes with the three
  existing hook warnings; 390 web unit tests, 6 rules-engine tests, 12
  rules-ui tests, web/desktop production builds, and Cypress 56/56 pass.
- Road-to-market Slice 1.2a makes every inferred fact target editable, keeps
  new canonical fact identity on World Bible entity IDs, fails closed for an
  unresolved explicit subject, refreshes sibling facts after entity
  acceptance, forms the Brannic service conflict on one target, and reverses
  only fact-owned materialization on removal or supersession. Web lint passes
  with the three existing hook warnings; 387 web unit tests, 6 rules-engine
  tests, 12 rules-ui tests, web/desktop production builds, and Cypress 55/55
  pass.
- Road-to-market Slice 2.9 UI close-out confirms Slices 2.1–2.8 match the
  current writing-first product rules: audited dialogs retain Escape/focus
  behavior, production native confirms/alerts are eliminated, field errors
  render inline, Character Style controls follow both themes, Mechanics and
  Character Sheets have zero inline styles across their route/component
  families, all four Mechanics filters render, and pending optional-system
  work remains visible through `More`. Web lint, 259 web unit tests, 6
  rules-engine tests, 12 rules-ui tests, web/desktop builds, and Cypress 43/43
  pass; Scratchpad, Corkboard, shared confirmation, theme, filter, and nav
  behavior were also browser-checked.
- Road-to-market Slice 2.7 Compendium sub-list filtering passes web lint, all
  258 web unit tests (including three focused name-filter tests), 6
  rules-engine tests, 12 rules-ui tests, web and desktop builds, the full
  42-test Cypress suite, and manual entry/recipe filter-and-clear checks with
  no console warnings or errors.
- Road-to-market Slice 2.6 Character Sheets styling extraction passes web
  lint, all 255 web unit tests, 6 rules-engine tests, 12 rules-ui tests, web and
  desktop builds, the full 42-test Cypress suite, and before/after browser
  comparison of build/edit and scene-history views with no console warnings or
  errors.
- Road-to-market Slice 2.5 Compendium styling extraction passes web lint, all
  255 web unit tests, 6 rules-engine tests, 12 rules-ui tests, web and desktop
  builds, the full 42-test Cypress suite, and before/after browser comparison
  of Entries, Progression, and World Systems with no console warnings/errors.
- Road-to-market Slice 2.4 Character Style theming passes web lint, all 255 web
  unit tests, 6 rules-engine tests, 12 rules-ui tests, web and desktop builds,
  the full 42-test Cypress suite, and manual light/dark browser checks with no
  console warnings or errors.
- Road-to-market Slice 2.3 inline field-level validation passes web lint, all
  252 web unit tests (including three focused Category Editor validation
  tests), 6 rules-engine tests, 12 rules-ui tests, web and desktop builds, all
  42 Cypress tests, and manual browser checks of each changed feedback state.
- The July 31 fitness close-out and follow-up extractions pass web lint, all 250
  unit/package tests (232 web, 6 rules-engine, 12 rules-ui), the production web
  build, and all 42 Cypress tests across eight specs.
- `pnpm audit --prod` reports 0 vulnerabilities after the Slice 3.15 sweep
  (TipTap 3.31 with matching ProseMirror pins, and patched `sharp`, `adm-zip`,
  and `qs`). `express`/`cors` are dev-only (used by `proxy-server.ts`), and
  the `web-verify` CI job fails on any high-severity production advisory.
- Pull-request CI now treats verification as blocking across three jobs: web lint/unit tests/rules-engine tests/web build, desktop build, and the full Cypress smoke suite.
- PR #43 passed all three hosted jobs on July 20, 2026; the Cypress job passed all 42 tests after two consecutive 42/42 local runs.
- `pnpm build:web` succeeds on the current tree.
- Backup export/import coverage exists in the smoke checklist.
- Manuscript export flows are covered in smoke documentation.
- World Bible duplicate-name conflict review exists.
- Ollama diagnostics and model detection flows exist.
- Review completion smoke coverage now has a dedicated checklist spanning import -> workspace review -> World Bible queue completion.
- Review queue smoke pass is in progress on `codex/world-bible-review-queue`.
- Initial deterministic World Engine slice is implemented and covered by false-positive unit tests.
- Feature-flagged local review annotations are implemented behind the existing `Project review engine` setting and now use issue-local excerpt windows instead of whole-scene prompts.
- Local review annotation requests now timeout and fall back to deterministic annotations instead of leaving Project Review stuck in `running`.
- Manual scene-derived state mutation commands now write to the ledger, including explicit within-scene `sceneSequence` ordering.
- Character Sheets now supports manual mutation entry, mutation editing, per-scene step reordering, replayed state inspection, stale-event detection, and targeted invalidation.
- Workspace scenes now surface stale-state badges plus a selected-scene state timeline with per-step summaries and end-of-scene snapshots.
- The workspace editor now supports character hover-card previews that show replayed state at the selected scene.
- Passive review indicator state is implemented for deterministic/manual review state.
- Deterministic review can now propose scene-scoped state changes, show before/after previews, explain individual versus batch validity, support scene-level batch accept/reject, and preserve hidden suggestions outside the active queue until restored.
- Import persistence now precedes post-import review in the shared workspace persistence path.
- Import unknown extraction is more conservative for one-off multiword candidates unless a stronger detection reason exists.
- Sidebar review now shows detection reasons for unknown-entity candidates.
- Project Review UI now uses author-facing issue labels such as `Unknown name`, `Repeated name`, and `Context clue` instead of raw internal codes such as `UNKNOWN_ENTITY` and `repeated_unknown`.
- Deferred imported scenes use stricter import-source extraction when rehydrated or reviewed from the sidebar.
- Review readiness counts dedupe the same issue across inline and sidebar review sources, and the context sidebar scrolls independently.
- Review drawer annotation summaries now pair by stable issue key rather than filtered array index, preventing a neighboring item's summary from appearing under the wrong review term.
- Manual Review drawer smoke with a realistic three-chapter set passed on June 26, 2026: passive candidates stayed out of the editor until context was requested, `Current document` / `Other documents` ordering stayed stable across scene jumps, selected rows stayed visible, and flash highlights cleared without persistent inline review marks.
- Manual Project Review results now underline in the active editor scene instead of appearing only in the side rail.
- Creating/linking/dismissing one review item no longer drops remaining unresolved underlines from the active editor scene.
- Returning from World Bible after accepting records now refreshes active-scene review state so known canon turns blue while remaining unknowns stay reviewable.
- Deterministic extraction now handles Unicode hyphenated titled names such as `Dr. Müller-Sarkisian`.
- Common sentence-start words such as `Look`, `Some`, and `Don't` are suppressed before review highlighting.
- Shared lore/review matcher now covers known-lore highlights, review highlights, possessive forms, and in-progress known-name prefix suppression.
- Cypress coverage verifies `Ember Archive` highlights as known lore and partial `Ember Archiv` does not become a review underline.
- Cypress coverage was added for manual Project Review highlighting and for preserving remaining review highlights after creating one reviewed record.
- Cypress coverage now includes passive Review drawer context actions, import-while-drawer-open refresh, cross-document review navigation, and a three-document import/navigation regression.
- Cypress coverage now verifies natural prose around known character canon highlights as lore without adding stray review marks or passive review counts.
- Unit coverage now verifies review annotations remain paired with the correct issue after filtering/dismissal.
- Scratchpad autosave/reload behavior is covered by Cypress.
- Scratchpad backup export/import round-trip is covered by the Cypress post-merge smoke.
- Scratchpad is included in project backup snapshot/import paths.
- Shared page chrome and scratchpad access were browser-smoke-checked on Workspace, World Bible, Lore, and Canon Decisions on June 3, 2026.
- Context rail/header unification was browser-smoke-checked on Workspace, World Bible, Lore, Corkboard, and Canon Decisions on June 3, 2026.
- Lore starter cards were browser-smoke-checked on June 3, 2026: cards render, Scratchpad remains the only header utility, `Extract Facts` is disabled without an active document, and `Start Writing` focuses the editor title input.
- Lore Documents Cypress smoke passes on June 21, 2026: manual document lifecycle, import/extract candidate flow, and World Bible linked-document round trip.
- Canon Decisions Cypress smoke now covers entity identity aliasing from extracted lore, alias persistence to the existing World Bible record, and reload suppression for the resolved decision.
- Project backup smoke now explicitly covers Scratchpad and Corkboard round-trip, and the latest manual pass is green after fixing scratchpad import identity plus merge-category duplication.
- App-shell search is visible from the rail/mobile nav, scene search reloads after writing changes, and World Bible search focus now switches to the correct category tab.
- During the smoke pass, the following review/alias issues were fixed:
  - self-alias creation when a new record name matched the detected surface
  - repeated single-word proper names not surfacing from sentence-start mentions
  - alias linking controls only showing close matches and defaulting to an invalid target value
  - duplicate alias display/counts in World Bible review queue
  - alias lore highlights using canonical names instead of alias surfaces
  - possessive alias normalization mismatch between consistency scan and editor highlights
- `@huggingface/transformers` is dynamically imported behind the RAG embedding path and builds as a separate Vite chunk.
- Zustand workspace UI integration has been smoke-checked manually for Corkboard and Scratchpad memory saving, and the latest focused unit/build passes cover workspace store behavior plus document initialization/save helper behavior.

## Former "Current Verification Notes" (archived 2026-10-31)

- World Canvas WC-6 (repeatable sketches, Open Threads, and Core Idea
  bridges): lint with the single existing hook warning; 658 web unit tests, 6
  rules-engine tests, and 12 rules-ui tests; web and desktop builds; full
  95/95 Cypress suite. Manual desktop and 780×900 inspection confirmed the
  hierarchy and keyboard names, bottom navigation, existing theme-token styling,
  and no horizontal overflow (`scrollWidth === innerWidth`).
- World Canvas WC-5 (purpose and Planning IA): lint with the single existing
  hook warning; 659 web unit tests, 6 rules-engine tests, and 12 rules-ui
  tests; web and desktop builds; full 93-test Cypress suite plus a final 9/9
  focused Canvas rerun. Manual narrow-width inspection confirmed Corkboard and
  World Canvas together under Planning, a single route heading, no horizontal
  crowding, and no World Canvas entry in the World Bible category rail.
- Local model runs (4.40): lint with the single existing hook warning, 655
  web unit tests, 6 rules-engine tests, 12 rules-ui tests, web and desktop
  builds; full 93-test Cypress suite, where `world-canvas.cy.ts` adds a streamed local run with thinking and no
  cap, and Stop during a slow run. Checked against the installed local models
  through the app's Ollama streaming path with no cap: qwen3.8 thought for
  about 4 minutes (first thinking text at 16 s) and returned 10 valid ideas in
  5 min 5 s; writer (26.9B) returned 10 in 6 min 34 s.
- World Canvas WC-4 (brainstorming) passes lint with the single existing hook
  warning, 635 web unit tests, 6 rules-engine tests, 12 rules-ui tests, web and
  desktop builds, and the full 91-test Cypress suite. `world-canvas.cy.ts` covers
  the not-configured state (no request sent), journey 4 against an intercepted
  Anthropic endpoint (one request, budget decremented, names-only canon, keep /
  add / dismiss, provenance after reload), and a malformed reply. The manual
  disclosure-wording check in both themes is still outstanding.
- World Canvas WC-3 passes lint with the single existing hook warning, 585 web
  unit tests, 6 rules-engine tests, 12 rules-ui tests, web and desktop builds,
  and the full 84-test Cypress suite. The seeded return journey covers mapped
  people/faction records, a linked faction Source Note, Other records, and
  rule-stated reminders; a separate 780×900 manual check confirms summary and
  action stacking without horizontal overflow.
- World Canvas WC-2 passes lint with the single existing hook warning, 581 web
  unit tests, 6 rules-engine tests, 12 rules-ui tests, web and desktop builds,
  and the full 83-test Cypress suite. Manual review completion from a
  canvas-created note passed through entity proposal and fact acceptance, and
  the linked controls remain usable at the 780px breakpoint.
- World Canvas WC-1 passes lint with the single existing hook warning, 578 web
  unit tests, 6 rules-engine tests, 12 rules-ui tests, web and desktop builds,
  and the full 82-test Cypress suite. Its backup new-project restore is covered
  in post-merge smoke; desktop and 780px browser checks confirm the rail entry,
  Canvas-only view, labels, and responsive layout.
- The shared dialog system (`ConfirmDialog`/`InlineAlert`) and its migration off
  native `window.confirm`/`alert` pass web lint, tsc build, 249/249 web unit
  tests, and the later full 42-test Cypress rerun recorded for road-to-market
  Slice 2.2.
- The shared Workspace mobile drawer panel extraction passes web lint, all 201
  web unit tests, the production web build, and all 42 Cypress tests on
  July 30, 2026.
- The Workspace unknown-entity/canon panel extraction passes web lint, all 201
  web unit tests, the production web build, and all 42 Cypress tests on
  July 30, 2026.
- The complete Compendium tab extraction passes web lint, all 201 web unit
  tests, both focused Compendium route smoke tests, and the production web build
  on July 30, 2026.
- `pnpm --filter web lint` passes on June 6, 2026 with the existing `useWorkspaceDocuments.ts` hook warning.
- `pnpm --filter web exec tsc --noEmit` passes after the World Bible helper/import slice.
- `pnpm --filter web test:unit -- --run` passes after the World Bible helper/import slice.
- `pnpm --filter web build` passes with the existing Vite large-chunk and `onnxruntime-web` eval warnings.
- Browser smoke on `/world-bible` should confirm manual/import remain the primary category task cards, the helper opens from the record form, and selected assistant text applies only to editable destinations before save.
- `pnpm --filter web e2e:run` passes all 42 tests across eight specs.
- Manual smoke for workspace scene restoration and in-scene search targeting passes after the latest Zustand workspace checkpoint.
- The post-merge Cypress smoke selectors were updated to match the current writing-first UI: `Scenes` / `Context` drawer controls, collapsed `Settings` sections, `/projects` backup flow, and stat-block rebind popovers.
- In the Codex desktop sandbox, Cypress GUI launch can still abort before startup; the suite passes when run outside that sandboxed GUI restriction.
- Stop point for the current session:
  - backup/import validation, scratchpad, review matching, and workspace navigation checks are passing in Cypress
  - search is exposed and World Bible results behave correctly
- workspace scene restore and in-scene search targeting passed the latest manual smoke, but should still be rechecked after future route-state changes
- Latest zustand checkpoint verification:
  - `pnpm --filter web test:unit -- --run apps/web/src/hooks/useWorkspaceDocuments.test.ts apps/web/src/store/workspaceUiStore.test.ts` passes.
  - `pnpm --filter web build` passes with the existing Vite large-chunk and `onnxruntime-web` eval warnings.
- deterministic review proposals now feed scene-scoped mutation ledger events, but the long-scene manual UX pass still needs to confirm the passive review flow feels unobtrusive in practice
