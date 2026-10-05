# SagaSpine Project Status

**Last Updated:** October 3, 2026

## Project Overview

SagaSpine is a desktop writing environment for fiction authors. The current product direction is **writing first**: authors should be able to open the app, start drafting immediately, and let structure, lore tracking, and consistency support appear progressively instead of blocking the writing flow.

### Product Brand

- Public product name: **SagaSpine**.
- Canonical web domain: **sagaspine.com** (secured October 3, 2026).
- Defensive domain: **saga-spine.com**, reserved to redirect to the canonical
  domain when the website is configured.
- Brand promise: build stories that hold together.
- Compatibility identifiers such as the `@worldbuilding-desk` package scope,
  `worldbuilding-desk/portable/*` schema names, persisted storage keys, and the
  desktop app ID remain unchanged during this light rebrand.

### Current Privacy Boundary

- Project data is stored locally but working projects are not currently
  encrypted by SagaSpine. Optional encrypted backup files remain planned as
  roadmap Slice 5.14; optional password-protected working project vaults are
  planned separately as Slice 5.15 before beta.
- The configured Ollama path defaults to `http://localhost:11434`, but the
  current UI does not yet distinguish a verified local model from an Ollama
  cloud model or reject a remote base URL. Until provider hardening lands,
  `Ollama` alone is not proof that a request stayed on the computer.
- There is no diagnostic telemetry or automatic crash-report upload.

Under the hood, the app still includes rich systems for world data, rules, character state, AI assistance, and consistency review. The difference in the current direction is presentation: those systems are support infrastructure, not the primary surface.

---

## Current Product Direction

### UX North Star
- Open directly into writing.
- Hide advanced systems by default.
- Keep feedback soft and ignorable.
- Make lore and structure auto-assisted where possible.
- Treat AI as a collaborator, not an authoring replacement.

### Product Positioning
- Primary value: maintain creative flow while keeping story context coherent.
- Secondary value: provide optional structured systems for authors who want deeper world/rules support.
- Differentiator: passive context awareness and narrative consistency support, without forcing up-front setup.

---

## Current Features

### Writing Workspace
- TipTap-based rich text editor.
- Workspace command palette and drawer-based shell.
- Active projects now route directly into the writing workspace.
- Scene/context drawers now default closed so the editor remains primary.
- Scene creation, deletion, autosave, and export.
- Markdown, DOCX, and EPUB export flows.
- Import modes for scene ingestion: `strict`, `balanced`, `lenient`.
- Deferred consistency review for imported scenes so writing is not blocked.
- Imported scene text is persisted before post-import review runs.
- Inline consistency highlights and action popovers.
- Review candidates carry deterministic detection reasons for easier import-noise triage.
- Review readiness counts dedupe inline deferred issues against manual sidebar review results.
- Project review results for the active scene now feed editor review highlights, so the side rail and editor underlines stay aligned.
- Resolving, linking, dismissing, or ignoring a review surface now clears both the active editor highlight and the project review rail item.
- Active-scene review refreshes when canon, aliases, or characters change, including after returning from World Bible.
- Returning from World Bible now restores the previously selected scene instead of resetting to scene one.
- Workspace scene initialization now waits for the active project's documents
  before resolving persisted selection, so returning to Workspace restores the
  selected scene without briefly initializing or reviewing an empty draft.
- Editor, window, and workspace-element scroll snapshots are isolated by both
  project and scene. Switching scenes with no saved position resets to the top
  instead of inheriting another scene's scroll, while route remounts restore the
  exact selected scene snapshot.
- A distinct current-scene Find surface is available from the editor toolbar or
  Cmd/Ctrl+F. It highlights all matches, supports Enter/Shift+Enter wrapping,
  reports the active match count, and returns focus to the editor on Escape;
  app-shell search remains the separate scene/World Bible search surface.
- Editable review capture flow for detected names/places before adding to world records.
- Manual selection-to-world capture from the editor for non-detected text.
- Temporary dismiss and project-level `Always ignore` review actions.
- Inline lore highlights and quick lore popovers are reserved for World Bible entities and aliases; unresolved legacy character capability records remain available to resolution tools without being presented as canon, and Lore Inspector routes them to World Bible resolution.
- World Bible review queue for finishing review-created records and alias follow-up.
- World Bible review queue now supports queue filtering by review reason and recommended action (`complete`, `alias`, `merge`, `ignore`).
- Editor appearance controls for width, surface style, and serif/sans presentation.
- Character dialogue style list/editor surfaces now use responsive CSS modules
  and shared theme tokens in place of hardcoded colors; author-configured style
  values remain dynamic in the live preview.
- Shared themed `ConfirmDialog`/`InlineAlert` components (`src/components/common/`) now replace native `window.confirm`/`alert` across the app (delete/merge/replace confirmations, validation and status messages), wired through a reusable `useConfirmDialog` hook; delete actions that previously had no confirmation (character style, corkboard chapter card, corkboard plot point) now do.
- Category editing now renders missing category-name and field key/label errors
  beside the offending inputs with themed error styling and accessible
  `aria-invalid` / description links. API-key save feedback now appears beside
  the save action instead of at the top of the full AI settings panel.
- Passive review readiness indicator in the workspace header and Review drawer tab.
- Review drawer issues now split into explicit `Current document` and `Other documents` sections so document scope is visible instead of implied by changing sort order.
- Review drawer context actions now switch to the target scene, scroll to the reviewed term with a header offset, briefly flash the term, and keep the chosen review row in view inside the drawer.
- Review focus now applies selection and flash in one editor transaction, with guarded fallback cleanup, so late-line context jumps do not silently select without a visible flash.
- Imported/new scenes reset editor scroll to the top, and importing while the Review drawer is open refreshes the drawer with the newly imported scene's review candidates.
- Workspace page chrome now uses the shared page-header rhythm and keeps the active scene primary: the top header carries project/scene context plus the passive review badge, while new scene/import/planning actions live in empty-state, footer, drawer, modal, and command surfaces.
- Deterministic state-change suggestions stay in the Review drawer, can be accepted or rejected explicitly, support per-scene batch actions, and can be hidden until the source scene changes so drafting is not blocked.
- In mechanics-enabled projects, selecting acquisition or consumption prose now
  opens an editable item/state proposal inside Workspace. Acquisition defaults
  to a scene-scoped inventory entry; reusable World Bible creation/linking is
  explicit. Consumption offers a combined inventory-and-attribute preview,
  reusable effects only when the author chooses to remember them, and explicit
  absent-inventory branches. General-fiction selection tools do not introduce
  this mechanics action.
- Deterministically detected acquisition and consumption observations can open
  the same Workspace proposal from Review. Detection remains proposal-only;
  confirmation validates the current source hash and atomically writes the
  accepted event plus any author-requested item/effect records while
  superseding the reviewed proposal.
- Hidden deterministic state suggestions now surface only as lightweight review summaries with per-scene and project-level restore actions.
- Project scratchpad is available as an autosaved quick-access modal and remains available from the workspace context drawer.
- Scratchpad quick access is now available from active-project chrome on World Bible, Lore, and Canon Decisions so loose ideas can move into structured canon, longform lore, or review decisions without navigating back to Workspace.
- Planning now presents World Canvas beside Corkboard as a sibling brainstorming
  tool: Corkboard develops what happens, while Canvas develops the world behind
  it through a Core Idea, seven optional lenses, repeatable sketches, and Open
  Threads. World Canvas has its own `/world-canvas` route rather than appearing
  as a World Bible category; World Bible remains the sole canon owner.
  Canvas content is explicitly exploratory and non-canon, stays out of
  extraction and retrieval, and participates in full project backup/restore.
- Each lens now keeps one strong directed question visible before opening,
  offers optional non-AI guidance and question starters after opening, and can
  collapse and reopen without changing its exact sketches or links. Each lens
  has one autosaved working composer; a routed sketch remains in reopenable
  history, and starting another is always an explicit author action. The author-facing
  name is Core Idea while the persisted `premise` field remains backward
  compatible. Guide-marked projects explain that Canvas works both before and
  after drafting and distinguish it from Corkboard.
- Sketches and Open Threads can be developed as provenance-marked manual Source
  Notes, linked to existing Source Notes or World Bible records, or handed to
  the normal prefilled World Bible create form when suited to a named canon
  entity. Open Threads accept question- and statement-form ideas with Open,
  Settled, and Set aside statuses; settled material remains as reopenable
  history. Links resolve current target names and preserve visibly stale targets
  for explicit unlinking. No Canvas action writes facts, aliases, or canon
  records directly.
- Core Idea can be kept as a provenance-marked, indexed Source Note snapshot;
  later Core Idea edits do not rewrite the saved note, duplicate creation is
  guarded while linked, and stale links remain visible for unlinking. Core Idea
  can also open the normal World Bible create form with an author-selected
  category and preserve the backlink after explicit save. Hands-on review found
  the ordinary concept/setting anchor sufficient, so there is no separate World
  Foundation canon owner before 4.34b.
- A separate Reference Palette keeps author-pinned project material beside the
  Canvas without mixing it into sketches. Existing stable Source Note and World
  Bible links become pinned references with live names and visibly stale
  targets. Deterministic suggestions state their category, note-kind, or
  record-link rule and never pin themselves; unmatched custom material stays in
  a separate browse area. General-fiction suggestions exclude mechanics-only
  categories. Pin, unpin, open, rename, and deletion handling do not change AI
  context or write to canon.
  The former flattened per-lens saved-material summaries and Other-records list
  remain removed.
  Worth a Look and its age/missing-link rules have been removed: World Bible
  completion stays in World Bible review, unresolved candidates stay in Canon
  Review, and an old creative thread or absent Source Note is not treated as a
  defect.
- World Canvas Core Idea (stored as `premise`) and every opened lens now offer author-invoked
  brainstorming (**Ask for tensions and questions**). One click sends the
  premise, that lens's active sketch, relevant Open Threads, and accepted World Bible
  record names and aliases (never Source Note text) under an explicit
  "exploratory — not canon" framing, and spends one `canvas-brainstorm` unit of
  the shared project consultation budget (local Ollama exempt). The reply must
  validate as at most 12 alternative/tension/implication/question items of at
  most 280 characters each, or it is rejected whole with a fallback message.
  Each item can be kept as a provenance-marked Source Note ("From World Canvas
  brainstorm — …"), kept directly as an Open Thread in either question or
  statement form, or dismissed. Unreviewed ideas are held in memory only, survive in-app
  navigation, and prompt before a reload or window close; nothing else persists
  and nothing is written to canon. With no usable provider, the control
  explains why and links to Settings without sending a request.
- Core Idea and each opened lens also offer optional craft-guided coaching with
  four explicit author actions: focus, deeper question, central tension, and
  clearer wording. Each request retrieves only applicable author-vetted craft
  chunks and sends the focused Canvas text; project references are opt-in per
  request and disclose World Bible names/aliases or Source Note titles only,
  never Source Note text or manuscript prose. Craft citations remain separate
  from project references. The whole reply is schema-validated and its wording
  or Open Thread stays in the shared proposal preview until explicit author
  confirmation; stale focused text fails closed and no model output writes
  directly to Canvas, canon, or state. Hosted runs spend one `canvas-coach`
  consultation; local Ollama remains exempt from that budget.
- Author-triggered model runs (writing assistant and its context actions,
  writing coach in both places, progression continuity, canon-decision
  consultation, World Canvas brainstorming and coaching) now stream through one shared run
  that shows the phase (waiting / thinking / writing the answer), elapsed
  time, the model's thinking live in a collapsible area, and a **Stop** button
  that aborts the request, including in the desktop app, where the main
  process now cancels the provider request. After a run, "Show thinking"
  keeps the latest reply's thinking readable; it is never saved, indexed,
  parsed as output, or sent back to the model, and answers never contain
  `<think>` text. Local (Ollama) runs send no response-token cap and no longer
  force thinking off.
- Hosted Anthropic, OpenAI, and Gemini runs use the project response limit as
  a hard response-cost ceiling, including hidden reasoning/thinking tokens.
  Settings shows the largest effective token cap and the maximum response-only
  charge when the exact model is in a dated maintained price table; unknown
  models are never assigned a guessed price, and input cost is clearly
  separate. Provider-specific policy keeps hidden thinking off or low,
  OpenAI reasoning models use `max_completion_tokens`, and all three providers
  detect cap stops. An incomplete capped reply is cleared, never parsed or
  saved, and the author is told how to raise the limit. The default Gemini
  fallback is now the priced `gemini-2.5-flash-lite`.
- Lore Documents are now framed as source-note intake rather than a parallel canon database, with manual writing, dossier import, and extraction paths kept separate from accepted canon.
- World Bible records can create or open a linked Lore Document for longform source notes, and Lore Documents can navigate back to the linked World Bible record.
- Lore Documents now has a project context health panel that shows RAG document/chunk counts, indexed document type counts, Shodh memory counts, project data counts, and a retrieval probe.
- World Bible character records now include a Character detail health panel showing aliases, accepted facts, linked Lore Documents, scene mentions, Shodh memories, state events, and an explicit RAG context probe for the selected character.
- Scratchpad records are included in project backup snapshots and restore paths.
- Corkboard has a dedicated `/corkboard` Planning route for chapter cards,
  beats, explicit scene links, and the read-only Story Dashboard, plus a quick
  Workspace modal over the same cards. Both surfaces share scene-link controls:
  linked-scene chips, explicit checklists, current-scene link/unlink in the
  modal, open-scene actions on the route, and removable stale links when a
  scene no longer exists. Links use stable scene ids only and never infer from
  titles or manuscript order. Either surface can create a normal manuscript
  scene through the Workspace owner and link it to the card in one action;
  failures never delete the created prose and offer an idempotent link-only
  retry. A linked scene now names its chapter card beneath the Workspace title;
  one card opens directly in the quick modal with its title focused, while the
  dedicated Corkboard link selects the same card. Scenes linked to several
  cards expose a compact expandable chip row without changing editor width.
- Corkboard chapter-card records are included in project backup snapshots and restore paths.
- Corkboard now includes a read-only Story Dashboard derived entirely from
  saved manuscript text, accepted state events, configured rules, and explicit
  Chapter Card-to-scene links. It reports scene/chapter word counts and quoted
  dialogue ratio, accepted-change distribution, and mechanics-only axis
  co-movement plus explicitly tracked advancement rates/intervals. Every
  observation identifies its source scenes; general-fiction projects never
  show mechanics analysis, and dashboard results cannot be edited.
- A writing coach is reachable two ways, deliberately scoped differently.
  Inline, an "Ask the writing coach" action lives beside the assistant's
  existing scene-revision and Source Note actions, scoped to the current
  selection or (with nothing selected) the open scene. In the Story
  Dashboard, a "Writing coach" section asks about the whole manuscript's
  shape using only the dashboard's own deterministic measurements — never
  raw scene prose. Both pair cited, labeled craft-library reference material
  (never presented as canon) with the evidence given; both are strictly
  author-triggered, share the project's daily AI-consultation budget, and
  are read-only advice — the only follow-up action is the existing
  propose-preview-confirm surface (save as a draft Source Note).
- The Story Dashboard also has a "Progression continuity" section: a
  deterministic shortlist of two craft-and-canon-consistency observations —
  a character with an established priority ability (movement, teleportation,
  anything time-related) never lexically referenced across several scenes
  where they appear, and a named rapid-advancement method never referenced
  again after the accepted event that established it. Absence is
  deterministic; whether it is a genuine finding is author-triggered and
  model-assisted, cited to the shortlisted scenes, sharing the same
  AI-consultation budget as the coach. A dismissed candidate persists
  (localStorage, project-scoped) so a false positive costs one click; it is
  never recomputed as canon or written anywhere. The abandoned-method side
  depends on accepted advancement events carrying a descriptive label — a
  real, documented coverage limit, not a guess about author intent.
- App-shell search is now visibly exposed and returns unified scene plus World Bible results.
- World Bible now exports a human-readable portable ZIP: one Markdown file per
  record with JSON-compatible YAML frontmatter, one CSV per category, and one
  Markdown file per Source Note, plus an included schema README. A reviewed
  Markdown-folder importer supports Obsidian-style vaults: every file is
  staged as a Source Note or incomplete World Bible draft, and wikilinks are
  opt-in link/alias proposals. Source Notes continue through extraction and
  proposal review; import never writes accepted facts directly. The project
  backup ZIP remains the full-fidelity restore format.
- Pending Mechanics completion counts now aggregate onto the `More` navigation
  control at both desktop and narrow breakpoints, keeping optional-system work
  discoverable without promoting systems into the writing-first primary nav.
- A brand-new install now lands directly in a draft-ready Workspace instead of
  an empty Projects screen: a one-time, one-scene blank project is created
  automatically (general fiction, no provider or ruleset setup required) the
  first time the app has no projects at all. A dismissible "Getting started"
  panel — shown only on that project, never on projects the author already
  had — walks through write → capture canon → review, and offers a bundled,
  read-only-in-spirit sample project ("The Emberglass Key", trimmed from the
  Slice 1.1 trust-dogfood fixture) with a deliberate, self-contained factual
  conflict between two lore documents for the author to find and resolve
  themselves through the real extraction and canon-decision pipeline — no
  fixture stands in for that pipeline's own output. The sample is also
  reachable directly from Projects at any time. Dismissal persists per
  project; the automatic first-project creation is a true one-time check,
  never re-triggered by later deleting all projects.
- AI provider setup in Settings is now a short Setup section (provider,
  data-flow disclosure, model, the one API key field the selected provider
  actually needs, Test connection) plus a collapsed Advanced section
  (Ollama base URL, Lore Inspector review-engine/consultation/budget
  controls, relabeled in author language). Test connection makes one real,
  cheap call per provider — a single-token completion for hosted providers,
  a reachability + installed-model check for Ollama — and reports success,
  a rejected key, or an unreachable provider in plain language; no request
  runs just to discover whether configuration works outside that explicit
  action. The provider select states plainly that Ollama stays on-device
  while a hosted provider receives the necessary text under its own terms,
  only when invoked. The assistant's "provider not configured" notice now
  links directly to Settings instead of leaving the author to find it.
- Internal codenames and ML jargon are retired from rendered UI: "Shodh
  memories" reads as "Project memory," "RAG documents"/"Inherit RAG data"
  read as "Indexed context"/"Inherit indexed context," and the canon
  rubber-duck panel reads "Think it through." Internal service, type, and
  identifier names (`ShodhMemoryService`, `RAGProvider`, `inheritShodh`,
  etc.) are unchanged — this was a string-layer, behavior-preserving sweep.
  A source-scanning test asserts the retired standalone words never
  reappear.
- Error handling is local-only and author-facing. Every rendered error
  string goes through one `describeError(error, fallback)` helper: the app's
  own validation messages ("This character already has a mechanics sheet.")
  still reach the author unchanged; network, rejected-key, rate-limit,
  provider-outage, local-storage-full, newer-project-version, and cancelled
  failures map to fixed plain-language sentences; technical noise (`Failed to
  fetch`, `QuotaExceededError`, JSON parse errors, `undefined is not …`)
  falls back to the caller's text. The raw error is recorded in a redacted
  local log (50 entries, `localStorage`, plus uncaught errors and unhandled
  rejections captured at the window) and shown under Settings → Diagnostics,
  where the author can copy a plain-text report into a support request or
  clear it. Redaction strips API keys (known shapes, bearer/header values,
  long tokens, URL query strings, and the project's configured keys by exact
  value), local file paths, and prose-length quoted text; only an error's
  name, message, and first stack frames are ever serialized, never request
  payloads, `cause` objects, or manuscript text. There is no telemetry,
  crash reporting, or automatic transmission of any kind.
- Transient feedback now has one home. An app-shell notification store and
  viewport (bottom-right, polite live region, four-second auto-dismiss,
  repeats replaced) receives success confirmations from every route through
  a shared `RouteFeedback` bridge, replacing the Workspace-only toast and the
  nine route-local banners; errors stay anchored beside their control as an
  `InlineAlert`, except Workspace, whose feedback was already a toast and
  keeps errors there with a Dismiss control. The Workspace resolver notice is
  an action toast with the same primary action and dismiss. One shared,
  visually hidden status live region (plus an assertive alert twin) announces
  autosave completion, consistency review start/finish, Source Note
  extraction start/finish, project storage migration on load, and assistant
  streaming start/finish via `useStatusAnnouncement`. `aria-invalid` and
  `aria-describedby` now also cover the new World Bible type name, the
  mechanics first-value name/starting value, and the dialogue style select.

- Dev-only dogfood tooling: in a dev build (or with the `wbd:dogfood-tools`
  localStorage flag), Projects offers **Load trust-dogfood fixture**, which
  seeds the Slice 1.1 runbook project — five chapters as scenes, four lore
  files as Source Notes, the fixture ruleset linked — with no World Bible
  records, aliases, facts, sheets, or state events, so the manual run starts
  at review instead of at ten file imports. The content module is generated
  from `fixtures/trust-dogfood/` by `pnpm --filter web dogfood-fixture:build`
  and a parity test plus the prebuild check keep it from drifting.

- The continuity review pipeline has a regression corpus
  (`apps/web/src/fixtures/continuityCorpus.ts`): thirteen short cases from
  the trust-dogfood chapters and the sample project encode the answer-key
  plants as expected findings, the fixed false-positive shapes (sentence
  starts, number words, bracketed system lines, "Ma", article-equivalent
  names, Bran/Brannic boundaries, "deep vault" ≠ the Undervault) as expected
  absences, and one recorded gap. A harness runs the real deterministic
  extraction, validation, and contradiction code over every case, and the
  test prints recall, findings, noise, mislinks, and healed gaps whenever a
  case fails, so a matcher change names what it lost.

- Canon contradiction detection is fact-anchored, not rule-coded. The
  hard-coded eye-color check is gone; every accepted fact with a
  "modifier + noun" or numeric value (gray eyes, black scales, twenty years,
  twenty-six) becomes a comparison slot, and scene text attributed to that
  entity is checked in that slot for an explicit negation, a different
  number, or a modifier from the same value class. Classes are linguistic
  (built-in colors and numbers) or learned from the author's other accepted
  values for the same fact type and noun, so a world's own vocabulary (oak
  staff vs. ash staff) is enforced without the app knowing what a staff is;
  adjectives outside any class ("tired eyes") never fire. Attribution is per
  claim by nearest preceding mention, never the speaker of a quotation.
  Synonym normalization (grey/gray, number words) is a small data table with
  a per-project synonym hook; an author-editable synonym list is a follow-up.

- Accepted canon facts now support manuscript-time validity through optional
  stable scene links. Canon Decisions supersedes a conflicting fact at an
  author-selected scene instead of deleting history: the earlier fact ends
  exclusively at that scene and the new fact begins inclusively there.
  Reordering scenes changes the resolved window without rewriting IDs;
  missing boundaries fail closed. Deterministic contradiction review,
  progression-continuity candidates, and assistant
  RAG/local-memory grounding filter canon for the scene in question, while
  assistant answers and canon displays state bounded windows. Project and
  snapshot schema 6 preserve these links; character-package imports drop them
  because those packages do not include manuscript scenes.

- Project review is persisted and incremental. The last run is stored per
  project (`project_review_runs`, one record keyed by project id, in the
  project-scoped store list so project deletion and migration backups cover
  it) with each scene's deterministic result keyed by a content hash and the
  run's non-text inputs hash (known entities, action cues, engine). Re-running
  reuses unchanged scenes, including their local-AI annotations, and only
  sends changed or new scenes through the engine; canon contradictions always
  recompute. On reload the Review drawer restores the last run and its
  timestamp; items whose scene text changed since show a "Scene changed since
  review" marker and the header counts them. Dismissing a conflict also
  updates the stored run. The stored run is deliberately not part of project
  backups: snapshots carry accepted canon, not review output, and a restored
  project simply runs review again.

### Story Context Systems
- World Bible with dynamic categories and custom field schemas.
- World Bible now follows shared page chrome, uses a compact utility rail for import/help tools, opens category tabs in browse/list mode by default, and reveals manual entry forms only after explicit create/edit selection.
- World Bible category task cards reserve stable description height so switching between Characters, Locations, and Items does not shift the list below.
- World Bible AI assistance is being reshaped away from top-level AI draft cards and toward an explicit helper model. The current helper is an interim floating chat with selected-text apply to editable fields; the target model is open brainstorming plus confirmable model-proposed actions for names, aliases, fields, and new sections.
- Character records and character sheets.
- The World Bible AI helper now uses a shared read-only proposal preview and
  confirmation hook. Confirmation disables repeat clicks while the app-owned
  action is pending; failed actions retain the preview with inline feedback.
  Workspace assistant output now opens a reviewed scene revision with current
  and proposed text for replacements, or an explicit append-to-scene action.
  Confirmation validates project/scene identity, the original scene snapshot,
  and the selected range against the live editor before one undoable plain-text
  insertion. Stale revisions stay unapplied with recovery guidance. The
  assistant can also capture its own output as a draft Source Note (never
  canon; enters the normal extraction/review pipeline), and the canon
  rubber-duck can prefill its alias/accept/reject choice from a deterministic,
  position-anchored `Suggested Action:` tag in its response — never free-prose
  matching — with the rationale visible and the author's click still required.
  Slice 1.5 is complete.
- World Bible categories now carry an explicit `character` / `general` kind,
  including an author-editable category-kind control; active character-aware
  surfaces no longer infer category identity from names or slugs.
- Character extensions and sheets now support canonical World Bible entity
  links. Project storage schema 2 deterministically classifies legacy World
  Bible characters, Character Tools records, and sheets; it auto-links only
  exact normalized names that are unique on both sides, persists legacy
  character/sheet actor-ID mappings, and retains a conserving migration report
  for unresolved tools-only, sheet-only, and ambiguous records.
- A shared character link resolver now owns explicit entity ↔ extension ↔
  sheet resolution plus the exact-unique legacy fallback. Review linking,
  alias migration, workspace capture/roster/lore snippets, and Character Tools
  handoffs use it instead of independent name joins; unlinked tools records do
  not enter character lore snippets.
- New World Bible items now begin with a generous name-and-description draft
  that saves without AI; aliases, rarity, custom sections, and the existing
  full editor remain available through explicit progressive disclosure.
- Alias tracking and consistency storage.
- Review linking can now target either World Bible entries or characters.
- World Bible review completion now treats saving or marking reviewed as clearing both record completion and alias follow-up.
- World Bible review actions now support explicit canonical rename, alias conversion, persistent `keep separate` / `ignore this match`, and recommended next-action guidance.
- System history and lore inspection surfaces.
- Shared lore/review text matcher now owns canon normalization, possessives, longer-match priority, and in-progress known-name prefix suppression.
- Workspace editor annotations now use the shared lore/review annotation decision pass, so known canon and unresolved review candidates are arbitrated together before TipTap decorations render.
- Deterministic project review now compares accepted eye-color appearance facts with unambiguous paragraph-local manuscript claims, including dialogue about an addressee, so conflicting categorical values surface as canon conflicts. All canon conflicts use a shared evidence contract: they focus and distinctly highlight the conflicting prose, render as high-attention review cards, present known records as related context, omit unknown-name capture actions, and can be dismissed until the next project review. Unknown-name review also distinguishes closing dialogue punctuation from direct address and no longer promotes common single-word nouns solely because an article precedes them.
- Full-name, hyphenated-name, and alias smoke coverage now exists for cases such as `Mira Voss`, `Lantern-Mira`, `Iron Warrens`, and `Warrens`.
- Imported-scene review now keeps strong typed multiword names such as named doors, factions, locations, and items while suppressing bare generic fragments and verb-complement phrases; the trust-dogfood chapters cover the planted hazards and unknowns directly.
- Lore extraction now proposes evidence-backed facts and typed entities from both structured labels and common natural-prose dossier/faction/place patterns, including the trust-dogfood occupation, aliases, relationships, appearance, service conflict, historical faction name, and explicitly speculative claims. All results remain review-only until author acceptance.
- Lore fact review now exposes an editable World Bible target on every fact
  proposal and writes new accepted facts only against stable World Bible entity
  IDs. Explicit but unresolved subjects fail closed instead of inheriting an
  unrelated linked record; accepting a sibling entity refreshes its fact
  candidates against authoritative records. Removing or superseding an
  accepted fact conservatively reverses fact-owned aliases and legacy
  materialized fields, while new background/appearance/trait/ability facts no
  longer copy untracked text into World Bible Notes.
- Parent/child canon inheritance with promotion and sync flows.
- Project backup export/import with validation and conflict review.
- Project backup snapshots now use schema 5 and include consistency aliases,
  canonical character link fields, persisted legacy actor resolutions, and
  character identity migration reports plus stable optional World
  Bible/Compendium references for reusable inventory items plus stable,
  optional Chapter Card-to-scene links, plus typed system-negative-space
  categories and author-maintained record status/scene links. Project storage
  schema 5 registers those additive World Bible fields without inferring
  categories, status, or links during migration. Earlier backups
  upgrade through deterministic migrations, including the
  deterministic character classifier before import, with replay parity
  preserved.
- Mechanics-enabled projects can opt in to a built-in World Bible record type
  for problems power cannot solve: Manage Categories offers **Add Problems
  Power Cannot Solve** with a one-line explanation, and the category can be
  deleted like any other. It is never created automatically; a fixed
  per-project id means it can exist only once. Authors maintain each problem's structured
  status and explicit scene links; the World Bible deterministically summarizes
  counts and cited scenes without making semantic claims about the prose.
  General-fiction projects do not expose the record type.
- Character package export now uses schema 2 and carries the canonical
  character categories/entities, aliases, accepted facts, Character Tools
  extensions, and optional sheets as one identity-linked unit. Schema-1
  character packages remain importable through exact-unique classification;
  unresolved records are conserved in the identity report instead of being
  guessed into canon.
- Modern character intake now converges on World Bible identity: Character
  Tools creation establishes or exact-uniquely links canon before writing its
  extension, review capture writes character-kind entities, lore proposal
  acceptance targets canonical entities, v2 packages reject broken claimed
  identity links, and new sheets require a canonical entity link. Storage
  guards prevent new free-standing Character Tools or sheet records while
  still permitting unresolved legacy records to be updated and classified.
- Character sheets and tracked state now use canonical World Bible entity IDs
  as the actor identity for every new mutation. Replay resolves immutable
  legacy character/sheet actor IDs through the persisted identity map, and
  deterministic state derivation no longer matches actors by display name.
  Linked sheet names derive from canon, duplicate sheets for one character are
  blocked on write, and any conserved legacy collisions surface in World Bible
  review for repair.
- Inventory commands and replayed inventory entries now support optional stable
  World Bible item and Compendium definition IDs while retaining name-only
  quick entries. Project storage schema 3 migrates earlier state without
  guessing links, and linked inventory labels follow canonical item renames.
- The World Bible review surface now includes a distinct `Needs canon link`
  queue for tools-only, sheet-only, and ambiguous legacy character records.
  Authors can link an existing World Bible character, explicitly create a
  review-required canon draft from the legacy record, or keep the record
  separate. Resolutions update extension/sheet links and legacy actor mappings
  together; unresolved legacy capability records and sheets carry visible
  `Not linked to canon` badges and remain excluded from canon presentation.
- World Bible character detail now owns dialogue-style assignment and
  single-character export directly. Sheet creation and character-scoped state
  open in the project-gated `/sheets` optional-system surface with canonical
  context prefilled. Batch import/export lives in the `Character packages`
  utility under `More`; `/characters` is compatibility-only and redirects to
  World Bible. The former Character Tools route and independent roster UI are
  removed while storage adapters, v1 packages, and legacy resolution remain.
- World Bible character detail is now one sectioned experience: `Canon`,
  `Notes`, `Continuity`, project-gated `Mechanics`, and `Writing aids`. New
  characters remain focused on Canon until the canonical record is saved;
  general-fiction projects do not see Mechanics; saved characters expose
  linked notes, scene/state continuity, dialogue style, export, and sheet
  handoffs without another identity or name-entry surface. The composition
  resolves extensions and sheets through the shared stable-ID character
  resolver rather than a display-name join.
- Rules-enabled projects now start character mechanics inside the saved World
  Bible character: one author-confirmed Stat or Resource creates a minimal
  project ruleset plus exactly one canon-linked sheet through a deterministic
  setup service with partial-write rollback. The character stays in context,
  shows the tracked value, and resumes an interrupted first-setup draft.
- Rules, Sheets/State, and Mechanics now open with calm contextual guidance.
  First-use scene changes use plain-language `Change by` / `Set to`, replay
  preview, stable actor identity, and explicit confirmation. Templates and
  limits, level/XP/runtime/history repair, compendium, progression, recipes,
  zones, settlement, transfer, and memory/promotion remain available behind
  explicit advanced reveals; general-fiction projects remain unaffected.
- Character continuity now hands authors directly from the simple numeric
  change form to detailed inventory, equipment, status, and location changes.
  The detailed form uses author-facing action labels, retains character/scene
  context, previews every change, shows replay at the selected scene, and keeps
  recording explicit and scene-scoped; advanced sheet setup remains a separate
  destination.
- The trust-dogfood fixture now includes importable v1 packages for the Tam
  containment boundary and an exact legacy identity-classification matrix,
  plus a scripted G1–G6 character-identity addendum mapped into the active
  smoke procedure. Fixture contract tests lock conservation and classifier
  expectations; the manual A–G run is now the active Phase 1.1 checkpoint
  before release-engineering work begins.
- Project records now carry an application-data schema version independent of
  IndexedDB's structural version. Project load runs a deterministic,
  one-version-at-a-time migration chain, fails closed on newer schemas, and
  takes a restorable project-scoped backup before applying pending migrations.
  Backup snapshot files use a separate version contract and compatibility
  runner, with newer snapshot versions rejected before import writes begin.

### AI and Retrieval
- Multi-provider abstraction for Anthropic, OpenAI, Ollama, and Gemini.
- Prompt management and provider diagnostics.
- Local RAG and Shodh memory services for contextual assistance.
- Selection-aware AI insertion and editor assistance tools.
- Inherited canon support in AI grounding for parent/child projects.
- Deterministic `WorldEngine` boundary for workspace review, with schema-validated observation/classification shapes.
- Feature-flagged local review annotations now run through the `WorldEngine` boundary using project-scoped Ollama settings while keeping deterministic validation as the source of truth.
- Local review annotation requests now use issue-local context windows instead of full-scene text, reducing latency on longer scenes and falling back cleanly to deterministic annotations on timeout or parse failure.
- Dev-mode RAG embedding loads now default to deterministic lightweight fallback instead of noisy browser-transformer fetch failures.
- Assistant RAG context now carries explicit trust-tier labels before provider prompts are built. World Bible records are labeled as accepted canon, accepted canon facts are labeled separately, linked Source Notes are labeled as source material, general Source Notes are labeled as project reference material, and scene/rules chunks remain clearly draft/reference context. RAG ranking now applies a modest trust boost so accepted canon and accepted canon facts win over Source Notes when matches are otherwise close.
- Assistant input now waits for project RAG/Shodh initialization, honors parent-context inheritance, labels relevant Shodh summaries by trust tier, and refuses to guess when a named factual question has no retrieved project source. Development retrieval uses the deterministic meaningful fallback embedding rather than constant vectors, and lexical ranking ignores common question-word noise.
- All factual project questions now cross a universal evidence gate before provider prompting. Recognized lookups for accepted occupation, service-length, membership, treatment, and eye-color facts are answered deterministically. Storage/custody questions bypass retrieval rank and inspect all primary saved scenes in manuscript order, distinguishing designated storage from later sign-out, named possession, and use; incompatible later custody returns explicit uncertainty with every relevant scene cited. Accepted canon remains a fallback only when saved scenes contain no custody evidence, and Source Notes cannot supply the answer. Any other factual wording that cannot be deterministically verified fails closed with the retrieved sources reviewed; it never reaches prompt tools or a creative provider. Missing membership canon fails closed, conflicting facts/locations are surfaced rather than chosen, and provider output strips leaked silent-system scaffolding.
- Workspace assistant conversations are retained in session-local, project-scoped storage, so navigating to World Bible or another route and returning restores the conversation immediately without mixing projects or persisting chat indefinitely.
- Future AI expansion should follow the adapter/tool boundary now captured in `docs/architecture-review.md`: provider/model capabilities are explicit, named workflow routes can choose model/reasoning/capability/cache policies per feature, structured output is schema-validated, tool-like actions produce confirmable proposals, and shared read-only project-context extraction feeds features without silently mutating canon or state.
- Scene-scoped state mutation tracking now exists as a project-scoped persistence layer with accepted/invalidation flow, replay, and workspace inspection surfaces.
- Deterministic `state_delta_candidate` extraction now feeds the same typed mutation ledger as proposed `deterministic-review` events rather than mutating tracked state automatically.
- Mechanics-enabled project review now replays accepted character state at each
  scene observation and warns about impossible inventory changes, custody or
  equipment use after removal/consumption, and static location claims that
  contradict the last accepted location without an intervening movement cue.
  Findings cite the earlier accepted scene and never block saving. The
  assistant and review share one ordered manuscript-custody interpreter.

- The project's daily AI consultation budget is now one explained model rather
  than a hidden counter. It stays one budget per project (not per feature) but
  records which feature spent each unit; local (Ollama) requests do not spend it
  at all and stop only at a separate, much higher runaway guard; the day resets
  at the author's local midnight rather than a UTC one. Every action that spends
  a consultation now states the cost and what remains beside its own button
  before the request, and an over-budget author can add more for today in place
  instead of being sent to Settings — the persistent limit stays where they set
  it. Settings carries the limit, the reset time in the author's timezone, and
  today's per-feature breakdown. Storage moved from one `localStorage` key per
  project per day (never cleaned up) to a single `inspectorBudget:<projectId>`
  ledger, migrating today's legacy count forward and sweeping the stale keys.

### Optional Game/System Layers
- Standalone `rules-engine` package with stats, resources, formulas, effects, and dice.
- Ruleset builder and runtime stat/resource evaluation.
- Settlement progression, synergy logic, and compendium systems.
- The Mechanics/Compendium route and its four extracted tab components now use
  a shared CSS module with zero remaining inline `style` attributes while
  preserving the existing presentation.
- Mechanics entries, recipes, milestones, and zone profiles now have local,
  case-insensitive name filters with clear no-match feedback; clearing a
  filter restores the full saved list without changing stored data.
- The Character Sheets route, sheet list, and scene-mutation form now use the
  existing shared route CSS module with zero remaining inline `style`
  attributes while preserving both build/edit and scene-history presentation.
- Character/runtime previews for effective stat and resource values.
- Current IA decision: keep these as optional, project-mode-gated systems attached to writing and canon workflows. Existing rules, mechanics, sheets/state, and settlement surfaces now group under optional systems navigation before any new mechanics depth is added.

---

## Current Architecture Status

### Stabilized
- Service layer reorganized into domain folders with barrel exports.
- `App.tsx` split into routing/layout composition and shared shell concerns.
- `rules-ui` consumes React and React DOM as React 18/19 peer dependencies;
  React 19 copies are development-only, so the web application owns the single
  runtime React instance.
- `rules-ui` owns its ESLint toolchain, and the root `pnpm test` command runs
  the web, rules-engine, and rules-ui test suites instead of a placeholder
  script.
- Internal rules packages use the product-aligned
  `@worldbuilding-desk/rules-engine` and `@worldbuilding-desk/rules-ui`
  namespace consistently across manifests, source imports, workspace scripts,
  Vite resolution, CI, and the lockfile.
- `rules-ui` has jsdom-backed hook and component coverage for its wizard state,
  ruleset mutations, stat/resource editors, and end-to-end world creation flow.
- Web tests now include provider-aware jsdom smoke coverage for all eight
  high-risk application routes plus Compendium tab switching.
- All four Compendium tab panels now live in focused, explicitly typed
  components; `CompendiumRoute.tsx` has been reduced from 3,118 to 1,590 lines
  without changing the rendered interface or route-owned state. The remaining
  route size is primarily state, derived data, and persistence handlers.
- Web and rules-engine tests run on Vitest 4.1, and all workspaces use Zod
  3.25.76 while the breaking Zod 4 migration remains deliberately deferred.
- The web workspace now builds on Vite 8.2 and `@vitejs/plugin-react` 6 with
  Rolldown/Oxc, while Node types remain aligned at 24.x with the Node 22
  runtime. The migration reduced the full development audit from 36 findings
  to 30 by removing the prior Vite Rollup/PostCSS/esbuild and plugin Babel
  findings.
- Cypress end-to-end coverage now runs on Cypress 15.20 with 49 tests across
  nine specs. Legacy browser-side `Cypress.env()` access is disabled, and the
  assistant default-tools smoke opens its target through the public command
  palette instead of mutating persisted UI state. The migration reduced the
  full development audit from 30 findings to 29.
- All four workspaces now compile with the native TypeScript 7.0 toolchain.
  The three ESLint-owning workspaces keep Microsoft's TypeScript 6 compatibility
  API side-by-side for `typescript-eslint`, while `tsc` resolves to 7.0 for
  builds. Legacy `moduleResolution: node` settings have been replaced with
  Node16 resolution for Electron and bundler resolution for the rules packages;
  TypeScript 6 stable-ordering parity checks and unpacked desktop packaging pass.
- The 2026-08-07 code-fitness close-out is grade A. All five targeted
  architecture files are below 2,000 lines; full development and production
  dependency audits report zero known vulnerabilities after targeted
  development-tool overrides; lint remains at 0 errors and the 3 known web
  warnings; 306 unit tests and all 45 Cypress tests pass.
- All linted workspaces use ESLint 10.8-compatible tooling and quoted recursive
  source globs. Lint is clean apart from the existing three web
  `exhaustive-deps` warnings; 77 React Compiler findings remain explicitly
  deferred across `set-state-in-effect`, `purity`, and
  `preserve-manual-memoization` for behavior-aware follow-up refactors.
- React Router is on the patched 8.3 line, React/React DOM are on 19.2, CI uses
  the required Node 22.22 minimum, and the production dependency audit is clean.
- Workspace logic decomposed into focused hooks:
  - `useWorkspaceDrawers`
  - `useWorkspaceMemories`
  - `useWorkspaceStatBlocks`
  - `useWorkspaceConsistency`
  - `useWorkspaceDocuments`
  - `useWorkspaceProjectData`
  - `useWorkspaceLoreSnippets`
  - `useWorkspaceCommands`
  - `useWorkspaceSceneRoster`
  - `useWorkspaceDrawerFocus`
  - `useWorkspaceContextActions`
  - `useWorkspaceSystemHistory`
  - `useWorkspaceUi`
  - `useWorkspaceReviewRefresh`
- World Bible orchestration is decomposed into focused hooks:
  - `useWorldBibleProjectData`
  - `useWorldBibleSelectedEntity`
  - `useWorldBibleAuthoringAssistant`
  - `useWorldBibleRecordResolution`
- World Bible route presentation now delegates category navigation, import
  preview/JSON workflows, record AI assistance, character health, and entity
  list cards to focused components without expanding `useWorldBibleImports`.
- Workspace drawer UI extracted into:
  - `WorkspaceSceneDrawer`
  - `WorkspaceContextDrawer`
  - `WorkspaceDrawerLayout` for shared desktop/mobile placement and responsive
    shell composition
  - focused corkboard, scratchpad, export, memory, and status-block modal
    components that preserve the route's existing workflows and styling
  - `WorkspaceDrawerPanel` for the shared mobile overlay, focus boundary,
    side-specific shell, header, and close behavior
- Workspace review/canon status UI now includes focused `UnknownEntityPanel` and
  `CanonPanel` components while preserving the route-owned review and sync
  workflows.
- Zustand app store added to reduce `activeProject` prop drilling.
- Zustand workspace UI store added for project-scoped drawer preferences, selected scene restoration, transient workspace modal state, export/import UI state, and scene create/delete operation flags.
- Shared page chrome component added for Workspace, World Bible, Lore, and Canon Decisions so primary writing/canon surfaces now share title, eyebrow, description/meta, and action placement.
- Shared project scratchpad modal/button component added for non-workspace surfaces while reusing the existing project-scoped scratchpad persistence path.
- Shared context rails now exist on World Bible, Lore, and Corkboard, following the Workspace-side-rail pattern where it helps hide secondary lists/tools without losing access.
- World Bible import/help/template utilities moved out of the top header into the side rail; route headers should stay focused on page identity plus the shared Scratchpad action.
- Source Notes now expose one intake import action and one saved-note extraction
  action. Document context links are explicitly retrieval/proposal-targeting
  metadata rather than canon acceptance or World Bible relationships; only one
  primary subject is persisted, unsaved edits block re-extraction, and accepted
  review candidates are clearly distinguished from the source text itself.
- Workspace review can create and immediately select a World Bible type such as
  Factions without abandoning the open candidate. Article-equivalent identity
  matching prevents `Salt Door`/`the Salt Door` duplicates, while shared
  longest-match and word-boundary arbitration prevents a short alias such as
  `Bran` from decorating inside `Brannic Halloway`.
- Source Notes and Workspace review have focused Cypress coverage for manual
  document lifecycle, dossier import/extraction, World Bible linked-document
  round trips, and in-place review category creation.
- `WorkspaceRoute` now groups workspace store subscriptions by concern instead of scattering individual selectors through the route body.
- `useWorkspaceDocuments` now keeps persistence behavior local while using pure helpers for document selection initialization, editor-document assembly, change detection, and manual-save/autosave consistency mode selection.
- `useCharacterSheetMutationPreview` now owns scene-mutation form state, deterministic preview/replay derivation, and mutation-history orchestration; pure mutation command construction lives in the tested character ruleset service.
- Shared text matching contract added for smoke-critical lore/review matching paths.
- Current targeted architecture sizes are `WorkspaceRoute.tsx` 2,075 lines,
  `WorldBibleRoute.tsx` 2,044, `CharacterSheetsRoute.tsx` 2,140,
  `CompendiumRoute.tsx` 1,551, and `useWorkspaceConsistency.ts` 2,072.

### Current Assessment
- The completed grade-A fitness plan reduced the five targeted files from
  17,564 to 9,441 lines, established tested extraction seams, landed the four
  planned toolchain-major groups, and cleared both production and development
  dependency audits. See
  `docs/archive/code-fitness-report-2026-08-07.md`.
- The remaining work is product shaping and incremental maintainability, not
  emergency architecture repair.

---

## Immediate Priorities

### Product / UX
- Active handoff: the August 22–23 A–G dogfood run is stopped and preserved in
  its fixture runbook after exposing release-blocking fact-target and temporal
  custody failures. The 1.2a–1.2d target, custody, Workspace-continuity, and
  lore-intake repairs are complete; finish 1.2e, then restart the contaminated A–F run
  on one stable post-fix build before claiming roadmap slice 5.1.
- Make the writing workspace the clearest default entry point.
- Reduce visible system complexity on first load through a calm-shell navigation pass before adding more route features.
- Keep `Workspace`, `World Bible`, and `Lore Documents` as the primary active-project mental model: write, structure canon, and keep longform source notes.
- Revisit panel defaults and route emphasis to match the writing-first UX docs.
- Keep the new shared page chrome as the active-project baseline; future route-specific UI should plug into shared title/meta/action placement before inventing local header patterns.
- Character-canon unification through roadmap 4.13 is implemented: character
  canon, dialogue-style assignment, and single-character transfer belong in
  World Bible; sheets/state are contextual optional mechanics; batch transfer
  is a utility; and no separate Character Tools destination remains.
- Character-canon annotation smoke is now covered after the shared annotation integration. Known `Garcia deTerra` prose, titled mentions such as `Detective Garcia deTerra`, and ordinary sentence-start prose stay out of stray review highlights.
- Product health is now the active priority: the Lore/RAG/Shodh health panel and the World Bible Character detail health panel are implemented, and Lore Documents can now quietly flag likely stale retrieval coverage and rebuild derived RAG/Shodh context from saved source data.
- Assistant prompt context now labels retrieved World Bible records, accepted canonical facts, linked/general Source Notes, scene drafts, and rules references by trust tier. Assistant answers also expose a collapsed `Sources used` list for the Shodh/RAG chunks sent with that answer. Pending and rejected Source Note proposals remain out of normal assistant context; include them only through an explicit future proposal-review flow.
- Accepted canonical facts now capture Shodh summaries when accepted or rebuilt; Source Notes remain RAG-only source material by default.
- The docs source-of-truth map now lives in `docs/README.md`; keep
  `PROJECT_STATUS.md` and `docs/road-to-market.md` as the current status and
  roadmap pair. The documentation set was consolidated again on 2026-08-01 to
  six active files under `docs/`, plus `PROJECT_STATUS.md` at the repository
  root.
- The active documentation set was consolidated on 2026-07-26: completed plans,
  branch handoffs, dated audits, and the prior roadmap/architecture action logs
  now live under `docs/archive/`; the active roadmap and architecture reference
  contain only open work and durable boundaries.
- AI-assisted item authoring is now captured as a product proposal:
  description-first manual creation comes first, model output remains
  evidence-backed and review-gated, and the shared proposal infrastructure
  should later support domain-specific ruleset adapters.
- Continue moving alias/review acceptance into a stronger World Bible workflow.
- Manually retest the new World Bible recommended-action filters and resolution paths against the review-completion smoke checklist.
- Extend the passive review-needed indicator into changed-word plus idle-pause background cadence.
- Finish review/count correctness where overlap between known-lore and unresolved-review highlights can still confuse authors.
- Manually retest alias highlighting for short aliases nested inside longer canon names, especially character full names plus nicknames and location short forms.
- Add a deliberate AI-to-Scratchpad capture action so planning thoughts from right-rail conversations are easy to retain.
- Define the next Scratchpad evolution: quick access is now broadly available, so the remaining question is lightweight organization rather than one flat note forever.
- Replace the interim World Bible AI helper apply bar with a proposal/action model: the assistant can suggest "add this section" or "apply this to field X", but every canon or schema mutation remains author-confirmed and editable before save.
- Finish the first search UX pass by manually retesting scene-result restore/jump behavior and deciding whether Compendium should join unified search results.

### Engineering

*Ordering is maintained in `docs/road-to-market.md`; durable boundaries are in
`docs/architecture-review.md`.*

- **Zustand store, slice by slice** — app shell and workspace UI slices are now in place. Continue with dedicated, behavior-preserving slices only; do not move editor `title`, `content`, `saveStatus`, or autosave ownership without a focused editor-state pass.
- Continue trimming `WorkspaceRoute`, `WorldBibleRoute`, and
  `CharacterSheetsRoute` through cohesive orchestration or presentation
  boundaries; canon sync and larger editor-state orchestration remain candidates
  after the workspace UI shell settles.
- Add targeted smoke coverage for the newer World Bible rename / alias / ignore resolution paths after the recent extraction and workflow pass.
- Add targeted smoke coverage for the workspace import/review path after the recent extraction.
- Add one Playwright Electron E2E covering the LLM streaming path — smallest change with the highest payoff against silent IPC regressions.
- Decide auto-update strategy (Squirrel / electron-updater / manual) before the first externally shared build; affects main-process structure and code signing.
- Re-enable suppressed React hook lint rules one at a time (`set-state-in-effect`, `purity`, `preserve-manual-memoization`); prefer targeted inline disables with a `// why:` comment over blanket config suppression.

### Documentation
- Keep summary docs aligned with the writing-first UX direction.
- Treat older “functional IDE” language as implementation heritage, not the main pitch.
- Dual LLM review direction is captured in `docs/archive/dual-llm-review-architecture.md`: local World Engine for passive structured review, BYOK providers for explicit creative work.
- Near-term state-tracking direction is now grounded by persisted mutation-ledger scaffolding rather than docs alone: future accepted state deltas can be tied to `sceneId`, `sceneOrder`, `sourceRevision`, and `sourceHash`.
- The current review UX direction for deterministic state suggestions is passive-by-default: proposals stay out of the writing flow, do not affect replay until accepted, and can be hidden and later restored without rejecting them.
- AI assistance for World Bible canon should remain explicit and author-invoked. The direction is not a separate AI draft path per category; it is a floating helper that supports brainstorming and proposes confirmable actions against the current record/schema. Model output must not silently create records, fields, aliases, or canon facts.
- Project-specific AI adapter feedback is documented in `docs/architecture-review.md` and `docs/road-to-market.md`: keep Ollama/local providers first-class but capability-variable, normalize tool/action proposals above provider-specific tool calling, prefer named AI routes/profiles over fixed effort buckets, default hosted routes toward provider-side prompt caching for stable prefixes, use tagged read-only context extraction, and treat future game-engine or persona hooks as typed app-owned capabilities rather than freeform prompt buttons.
- A separate read-only craft-library provider now owns bundled coaching
  references. Its versioned package records content and embedding contracts,
  accepts only author-vetted records, labels every result as craft reference
  material, uses compatible shipped vectors when available, and falls back to
  lexical search when they are not. The project RAG boundary rejects `craft`
  documents, so normal assistant evidence, canon, context health, backup, and
  project deletion cannot consume or own the coaching corpus. Published
  content version `2.0.0-tranche-2` now contains the full 166-record
  author-vetted working corpus as 2,136 checked-in retrieval chunks,
  superseding the eight-record tranche-1 subset; application builds verify
  that the checked-in bundle matches the reviewed source. The bundle is
  generated as a `.json` data file loaded by a small stable TS loader rather
  than an inline object literal, because a literal at this size overflows
  TypeScript's structural checker (`TS2590`). The writing coach (Slice 4.20)
  is the corpus's first real consumer; `getCraftLibraryService` now loads the
  manifest via a dynamic import so it ships as its own on-demand chunk rather
  than bloating the main application bundle every page load downloads.

### Writing-coach craft library (draft content, parallel track)

A draft coaching corpus is being produced under
`content/craft-library/working/`, against the brief in
`docs/writing-coach-corpus-production-handoff.md`. **This is content, not
application truth** — the published subset app code depends on (Slice
4.20's coach) is the reviewed `content/craft-library/published/library.json`
tranche, never this working draft directly; it is not the Slice 4.17
runtime schema, and nothing here changes the roadmap's status board.

- **166 records** as of 2026-09-05 (54 `general`, 48 `system`, 46 `trope`,
  6 `comparison`, 12 `profile`) against a 180 target; 14 remain.
- **All 166 working records carry `author_vetted: true`.** On 2026-09-06 the
  product author explicitly approved the full working corpus after reviewing
  material across every folder and finding it accurate, well written,
  researched, and cited. All 166 are now published as content version
  `2.0.0-tranche-2` (Slice 4.18a).
- `working/README.md` holds the batch log and the resume protocol; `qa/`
  holds the coverage matrix, duplication report, citation audit, and open
  claims. `qa/build_catalog.py`, `qa/audit_corpus.py`, and `qa/relink.py` are
  draft tooling, not runtime code and not a dependency of anything in `apps/`.
- Standing items for the author's editorial pass: 59 records rest on a single
  source at `source_confidence: limited`, concentrated where the craft
  literature is genuinely thin; two records carry documented length waivers;
  the overused-trope cluster is the most sensitive record in the set and is
  flagged as a priority read.

---

## Verification Status

### Verified Recently
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
- Slice 4.53 model-assisted review items in the shared review model: canon
  check items (4.38) now live in the Workspace review state and are saved
  with the project review run (`ProjectReviewRun.modelCheckItems`; a record
  with `reviewedAt: 0` holds them if no review has run yet). They underline
  their quote in the editor, count in the header review indicator, survive
  reloads, scene re-reviews, and project review runs while their quote is
  still in the scene (`survivesSceneRereview`, `pruneModelCheckItems`), and
  their dismissal is saved. The 4.38 session store slice is gone.
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
- Slice 3.14 hotspot freeze and extraction (behavior-preserving):
  `pnpm check:file-sizes` (`scripts/check-file-sizes.mjs`, run in `web-verify`)
  fails when a non-test source file over 1,500 lines grows past
  `scripts/file-size-baseline.json`, or a new file crosses 1,500; `--update`
  records shrinkage. `EditorWithAI.tsx` 1,636 → 1,285 lines: stat peek moved to
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

### Current Verification Notes
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

### Still Worth Rechecking
- Workspace import/retry UX after the drawer extraction.
- Narrow viewport drawer/modal interactions.
- Any route-level assumptions introduced by the newer Zustand migration.
- Full manual review-completion smoke after the next review/workspace UX change, rather than continuing to iterate on the current interaction model.
- Recheck scratchpad backup export/import parity with a populated project.
- Recheck workspace route-return behavior:
  - open a later scene
  - visit World Bible
  - return to Workspace
  - confirm the same scene stays selected
- Recheck scene search targeting:
  - search for a term known to exist in scene text
  - open the scene result
  - confirm the editor lands on the first matching occurrence and scrolls it into view
- Manually retest the new state workflow in long scenes:
  - same-scene step ordering
  - stale badge visibility after scene edits
  - scene timeline readability
  - character hover-card usefulness during drafting
- Recheck passive review ergonomics for deterministic state suggestions:
  - hide a suggestion and confirm writing flow remains unaffected
  - confirm hidden-count summaries appear in Project Review
  - restore one scene's hidden suggestions
  - restore all hidden suggestions
- Decide whether unified search should expand from scene + World Bible into Compendium/canon-wide results.

---

## Run / Dev Notes

### Prerequisites
```bash
npm install -g pnpm
pnpm install
```

### Main Development Commands
```bash
pnpm dev:web
pnpm build:web
pnpm start:desktop:dev
```

### AI Proxy
```bash
cd apps/web
npx tsx proxy-server.ts
```

---

## Working Summary

The project is no longer best described as a systems-heavy LitRPG IDE that happens to contain an editor. The better description of the current direction is:

**a writing-first narrative workspace with optional structured context, consistency support, and deeper systems available when the author wants them.**
