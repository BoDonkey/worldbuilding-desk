# SagaSpine Project Status

**Last Updated:** October 31, 2026

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

- Project data is stored locally. Unprotected working projects are not
  encrypted by SagaSpine. Optional **Protect with Passphrase** on the Projects
  page seals a project's live app-owned records and keeps its retrieval index,
  memories, and browser-storage text in memory only. Packaged-profile
  verification confirms the planted text leaves every live store after
  protection; because Chromium storage is append-only, fragments from earlier
  unprotected writes can remain in reclaimable IndexedDB pages. Protection is
  not secure deletion, does not hide an unlocked project, and does not cover
  deliberately unencrypted exports. Backups can be encrypted (Slice
  5.14): **Export Backup** offers a plain `.zip` or an encrypted
  `.sagabackup` file. The passphrase is never stored and cannot be recovered.
- Local AI stays on the computer only on a verified route: Ollama at a
  loopback address with a model `/api/tags` lists as installed and not cloud,
  or a local OpenAI-compatible server (KoboldCPP, LM Studio, llama.cpp) at a
  loopback address. Ollama cloud models and remote addresses for either are
  blocked, and anything unverified is disclosed and budgeted as remote.
- There is no diagnostic telemetry or automatic crash-report upload.
- The search (embedding) model, `Xenova/all-MiniLM-L6-v2` (Apache-2.0) at a
  pinned revision, and its ONNX Runtime Web WebAssembly files (MIT) ship in
  the app under `renderer/models/` with their licenses and a notice. The
  web build fetches them by checksum (`apps/web/scripts/prepare-embedding-model.mjs`,
  manifest in `apps/web/embedding-model/`); at run time transformers.js may
  load only those files, and the renderer CSP allows no download host. Earlier
  builds downloaded the model from Hugging Face on first use (found in 5.8).
  Project retrieval and the writing coach's query embeddings both use it in
  packaged builds; dev and Cypress keep the lexical/fallback paths. The
  installer is about 45 MB larger.
- The desktop app keeps its data (projects, settings, saved keys) in a
  `SagaSpine` folder: `~/Library/Application Support/SagaSpine`,
  `%APPDATA%\SagaSpine`, or `~/.config/SagaSpine` (Slice 5.2). Earlier builds
  used a folder named `desktop`; the first launch moves it in one rename, and
  sets aside (never deletes) any unrelated folder already named `SagaSpine`.
  If the move fails, the app keeps using `desktop` and tries again next launch.
- Update checks (Slice 5.1) are the desktop app's only network contact
  outside author-invoked AI requests. The installed app asks once whether to
  check GitHub Releases automatically at startup and never checks before that
  answer; Settings → Updates changes it or checks by hand. A check sends no
  project data, and downloads and installs wait for the author. Windows and
  Linux AppImage install in place; macOS opens the release page until signed
  builds (5.2). Releases upload as drafts and reach authors only when
  published (`docs/release-process.md`).

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
- Inline lore highlights and quick lore popovers are reserved for World Bible entities and aliases (exact name or alias, ignoring case, plus possessives). Non-character records (races, places, factions, items) also highlight in the other number — `Dhemons` matches `Dhemon`, `Fairy` matches `Fairies` — by deterministic last-word rules; character names stay exact, and an exact name or alias of another record always wins. This widening applies to editor highlighting only, not to project review or unknown-name detection; unresolved legacy character capability records remain available to resolution tools without being presented as canon, and Lore Inspector routes them to World Bible resolution.
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
- Source Notes store Markdown. `.md` imports keep their text and are saved
  as Markdown (notes imported from `.md` before this were saved as plain text
  and are now read as Markdown). DOCX imports convert heading styles,
  bullet/numbered lists, bold/italic, and tables (pipe tables, first row as
  header) to Markdown. Notes open in a visual editor (TipTap: block style,
  bold, italic, insert table, add/delete rows and columns) loaded through the
  same sanitized renderer that displays them; **Edit Markdown** / **Edit
  text** shows the stored text in a textarea. The editor serializes back to
  Markdown only when the content changes, so opening and saving a note
  without edits keeps its text byte-for-byte (an undone edit restores the
  original). A plain-text note opens as written and becomes Markdown on its
  first edit, with markup characters escaped so it reads the same. Fact and
  entity extraction read Markdown label rows (`- **Age:** Mid-30s`), escaped
  bullets from converted notes, and `#` headings as sections.
- Settings → Reading & Editor has **Source Notes open in** (Visual editor,
  the default, or Markdown source), an app-wide preference kept in this
  browser. New, opened, and imported notes follow it. Switching view on one
  note changes only that note; when the switch differs from the preference,
  **Always open notes this way** saves it as the new preference.
- Choosing several files in the Source Notes import saves each as its own
  Source Note from a modal dialog (one file still loads into the form for
  review). The dialog lists the files, marks any already imported (same
  import file name, ignoring case) as skipped, and offers one optional record
  to link every note to as its primary subject. While running it shows
  progress and cannot be dismissed; afterwards it lists imported (Open),
  skipped (Open the existing note), and failed (reason) files. Notes are
  saved, linked, and indexed exactly like a manual save; an indexing failure
  still reports the note as imported, with a Rebuild Context hint. No
  extraction runs and nothing writes canon.
- The Source Notes **Start here** intake panel collapses (**Hide intro** /
  **Show intro**, `aria-expanded`) to one row that keeps **Start Writing** and
  **Import File**; the choice is remembered per browser and the row wraps on
  narrow screens.
- Entity candidates keep the author's casing: words already containing a
  capital ("deTerra", "McAllister", "De") are left as written, lowercase name
  particles (van, von, da, del, ...) stay lowercase after the first word, and
  only all-lowercase words captured from prose are capitalized.
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
- Any assistant reply with content (coach or chat, wherever the shared
  assistant appears) has an **Expand** button that opens it in a wide
  reading view (bottom slide-up on narrow screens) with its Markdown
  formatted through the sanitized Source Note renderer, its craft
  references, and Copy/Close. Display only: stored messages are unchanged.
  Escape closes just the reading view, not the narrow-viewport drawer.
- Assistant conversations stay one session (Slice 5.17). Each request sends
  earlier question/answer turns as the author saw them: only the reply
  version shown, never discarded alternatives, with model thinking removed,
  newest turns first within a quarter of the model's context (512–6,000
  tokens). Answering "Option 1" therefore reaches the model with the
  question and the options it offered. The reading view shows the question
  a reply answered, has **Copy with question**, and has its own composer: a
  follow-up stays in the same conversation, the view follows the new reply,
  and the main draft is kept.
- **Save as Source Note** (chat and inline coach) offers the author's
  question plus the reply shown as an editable transcript; only the text the
  author confirms is saved, as a draft Source Note. Cards under **Sources
  used** and **Left out** can each be dismissed (display only), and a card
  from a Source Note or World Bible record offers **Open** to that exact
  record only when it still exists in the project.
- Writing stays put during autosave (Slice 5.17): scroll restore runs only
  when a scene opens, the editor is ready, or a reset is asked for, never on
  each edit, and the editor ignores late echoes of text it already emitted,
  so typing, deletion, and autosave in a long scene keep the caret, scroll,
  and text in place.
- To give the assistant a passage, the author selects it and chooses **Ask
  AI about this** (selection menu or right-click). While that passage is the
  assistant's context it stays marked in the editor, even after focus moves
  to the assistant. The mark is display only: it follows edits and is never
  saved into the scene or its undo history. The assistant's **Selected
  text** card has a **Clear** action that returns the assistant to the whole
  scene and removes the mark.
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
  backup ZIP remains the full-fidelity restore format. Both live on the
  **Portable data** page (`/portable-data`, More → Utilities), not on the
  World Bible page.
- The World Bible create/import panel (Create Manually, From a description,
  Import Docs, Paste Text) shows only on a category's record list; it hides
  while a record is open in the editor, for every category.
- Pending Mechanics completion counts now aggregate onto the `More` navigation
  control at both desktop and narrow breakpoints, keeping optional-system work
  discoverable without promoting systems into the writing-first primary nav.
- A brand-new install now lands directly in a draft-ready Workspace instead of
  an empty Projects screen: a one-time, one-scene blank project is created
  automatically as **My First Project** (General Fiction, empty **Chapter
  One**, no provider or ruleset setup required) the first time the app has no
  projects at all. A dismissible "Getting started"
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
- First-release project creation and ordinary-project Settings offer only
  **General Fiction** and **LitRPG**. Existing Game Simulation projects remain
  openable and keep their current mode and data until the author changes mode.
  Workspace status-block actions are hidden when game systems are off and
  return when the author deliberately enables that capability.
- Representative Getting Started, Workspace, Settings, and destructive-dialog
  surfaces now run automated WCAG A/AA scans in both themes. Editor controls
  have accessible names, dark soft-accent text meets contrast, toast/nav
  colors use shared theme tokens, and transient nav color transitions no
  longer dip below contrast requirements.
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
  Every model reported by Ollama or a local OpenAI-compatible server remains
  available in a keyboard-focusable, scrollable result list; manual model
  entry remains available and no model is selected silently.
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

### Help
- **Help** (More → App, `/help`, command palette **Go to Help**; Slice 5.8)
  is an offline, in-app page of seven short topics: getting started; World
  Bible, Source Notes, and canon; reviewing suggestions; importing; backups
  and exports; setting up AI; and where your data goes. It has a word filter,
  **Open …** links to each topic's screens, `/help?topic=<id>` deep links,
  and the portable export README (rendered from the same constant the export
  writes). Content lives in `apps/web/src/help/helpTopics.ts`; update a
  topic in the same change as the workflow it describes.

### Story Context Systems
- World Bible with dynamic categories and custom field schemas.
- World Bible document import detects Markdown `#` headings and DOCX heading
  paragraphs (Word style ids, Pages-style named styles with outline levels,
  `basedOn` chains, paragraph outline levels), treats a leading title heading
  with no content of its own as the document title, reads list and bold
  `**Label:** value` rows anywhere in the document (Occupation/Profession fill
  an empty Role), keeps Markdown structure in rich-text fields with
  record-section titles as headings, appends same-named sections that land
  in one field, drops HTML comments from Markdown and deleted tracked-change
  text from DOCX, and lists every detected heading. Parsing lives in
  `services/worldBible/worldBibleImportParsing.ts` and `docxImport.ts`.
  HTML imports still flatten headings to text.
- Each detected import heading has a destination picker: **Keep in
  Description**, any text or rich-text field of the target category by name,
  **New field: <label>** (its own title or a new field planned by another
  heading or open draft in the same category), or **Skip**. A heading whose
  chosen field no longer exists shows as Keep in Description. Open drafts
  reconcile with the category whenever its fields change, so a field
  created by one import in a batch becomes a normal field choice for the
  rest; renaming an entry keeps chosen destinations. Characters show the
  category's custom fields on Canon, saved or not.
- Character import suggestions deterministically strip the exact record name
  (including possessive and separator variants) from a heading when a useful
  label remains. A **New field** destination exposes an editable, validated
  field name before import; blank, control-character, and overlong labels are
  refused, while duplicate choices stay in the normal reconciliation flow.
- The World Bible import preview states that nothing is saved until a draft
  is imported and shows a waiting / imported / failed count. Imported drafts
  stay listed as **Imported** with an **Open** action; failed drafts show the
  reason and stay importable; drafts are never imported twice. **Import
  and open** scrolls the opened record into view. **Import selected (N)**
  replaces Apply Imports, and closing with unsaved drafts asks before
  discarding them. **Manage Categories** is a modal dialog (focus trap,
  Escape backs out of field editing then closes, closes on navigation,
  bottom sheet on mobile).
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
- Optional encrypted backups (slice 5.14). Export asks for a plain backup
  (default) or an encrypted `.sagabackup`: a versioned JSON envelope around
  the same backup zip, using PBKDF2-SHA256 (600,000 iterations) and
  AES-256-GCM, with the header authenticated. Import and Validate recognize
  the envelope by content, ask for the passphrase, and read nothing until it
  opens; a wrong passphrase keeps the dialog open with a plain error, a newer
  envelope asks for an app update, and plain backups work as before.
- Project deletion commits its manifest, project-owned main-database records,
  and migration backups in one transaction. A failed primary deletion rolls
  back those records and restores the ruleset from its separate database.
  Cached retrieval and memory providers, including inherited views, close
  before their databases are removed; blocked or failed context cleanup keeps
  primary data intact and reports a retry instruction. Populated version-1
  retrieval databases upgrade without recreating the existing chunk store.
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
  resolver rather than a display-name join. Canon holds identity, aliases,
  Age, Role, Description, every custom field (including fields created by
  import), and **Add character section**; Notes holds the Notes field and the
  linked Source Note.
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
- Multi-provider abstraction for Anthropic, OpenAI, Gemini, Ollama, and a local OpenAI-compatible server (KoboldCPP, LM Studio, llama.cpp).
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
- Factual project requests cross a deterministic evidence gate before provider prompting. The gate is table-driven and tested (`services/assistant/factualQuestionBoundary.ts`): it covers questions that open with a question word or auxiliary, report-style requests (tell me, remind me, give me, show me, list, recall), polite forms (please, can/could you), and continuations (and, so, what about, how about). Requests for new text (write, draft, describe, brainstorm, suggest, rewrite, expand, and similar), should/could/might/would questions, and requests for invented material ("give me five complications") stay on the creative path. Wording outside these tables is not gated, so the boundary is the tested phrasing set rather than every possible factual sentence. A gated follow-up that refers back ("What is her occupation?", "And his rank?") and names no World Bible record takes its subject deterministically from the records named in the immediately preceding author question and its answer in the same conversation; the reply states the assumed name, and zero or several candidates produce a clarifying question with no provider call. Prior turns are never sent to a provider. Recognized lookups for accepted occupation, service-length, membership, treatment, and eye-color facts are answered deterministically. Storage/custody questions bypass retrieval rank and inspect all primary saved scenes in manuscript order, distinguishing designated storage from later sign-out, named possession, and use; incompatible later custody returns explicit uncertainty with every relevant scene cited. Accepted canon remains a fallback only when saved scenes contain no custody evidence, and Source Notes cannot supply the answer. Any other factual wording that cannot be deterministically verified fails closed with the retrieved sources reviewed; it never reaches prompt tools or a creative provider. Missing membership canon fails closed, conflicting facts/locations are surfaced rather than chosen, and provider output strips leaked silent-system scaffolding.
  - **Known gap (2026-10-06, from code reading; not yet reproduced in the app):**
    the gate recognizes a factual question by its opening word. A factual
    request phrased as an instruction ("Tell me how long Brannic served") or
    as a continuation ("And his rank?") is not gated and can reach the
    provider. Retrieval, the resolvers, and the provider also see only the
    current message, so a follow-up that relies on the previous turn for its
    subject ("What about her brother?") cannot be resolved. Tracked as
    roadmap Slice 1.4b.
- Workspace assistant conversations are retained in session-local, project-scoped storage, so navigating to World Bible or another route and returning restores the conversation immediately without mixing projects or persisting chat indefinitely.
- Workspace and Ask now authorize every ordinary provider request through the
  shared `useAssistantRequestPolicy` boundary. It owns provider readiness and
  route disclosure, consultation blocking/accounting, streaming and Stop, and
  plain-language failures. Deterministic factual answers remain outside that
  boundary and spend zero consultations; successful hosted assistant requests
  record exactly one `assistant` unit, verified private-local runs use the
  existing runaway guard, and writing-coach requests record
  `writing-coach`. Both assistant surfaces show the same point-of-use route and
  budget disclosure beside Send.
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
- Password-protected projects (slice 5.15b).
  - Projects page: protect, unlock, lock, change passphrase, and remove
    protection; the command palette can lock the open project. A locked
    project shows only its label. Locking reloads the page.
  - A protected project locks on restart and when another project opens,
    and is never saved as the last open project.
  - Its retrieval index, memories, and browser-storage text live in memory
    only and are rebuilt after unlock; enabling protection deletes the old
    derived databases. Any legacy unfinished-mechanics draft is moved from
    browser storage into primary project storage before sealing. Its backup
    defaults to encrypted.
  - Zone-affinity records use random ids (project schema 8).
- Project vault storage layer (slice 5.15a).
  - `openDb()` and the rulesets database return a wrapped connection.
    Records of a protected project are sealed on write and opened on read:
    AES-256-GCM with a per-project data key, bound to the database, store,
    project, and record id. Repositories are unchanged.
  - The passphrase is used through PBKDF2-SHA256 600k and wraps the data key.
    Only the stable id, the KDF settings, the wrapped key, and a label stay
    readable.
  - A locked project reads back as sealed records and a **Locked project**
    placeholder, and writes to it are refused. Every vault locks on reload.
  - Enable and disable rewrite the project in one verified transaction per
    database, with compensation for the separate rulesets database. Changing
    the passphrase re-wraps only the key.
- Editor toolbar, canvas, and stat-block chips now use existing theme tokens
  for their surfaces, shadows, and normal/warning/error colors in both themes.
  AI Settings and consultation notices use the defined secondary-text token
  for helper text. A unit check scans every application stylesheet and fails
  on undefined CSS variable references, including those with fallbacks.
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
- All four Compendium tab panels live in focused, explicitly typed components.
  Eight adjacent form hooks own entry/import, recipe/milestone, craft preview,
  zone/exposure, module, and settlement/base-stat drafts and submit handlers.
  They stay mounted with the route so tab switches preserve unfinished input;
  parsing and validation use tested, pure Compendium helpers. The route is
  951 lines, down from 1,540 before this extraction, with the rendered
  interface, save/reset behavior, and persistence services preserved.
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
- Scene-roster item capture and timeline actions now use pure planners under
  `services/workspace/`, with IDs and timestamps supplied by the hook. The
  hook retains author confirmation, validation, persistence, and React wiring;
  its return shape and workflows are unchanged. Roster cards and Lore Inspector
  records are service-owned types, removing service imports from components.
  Continuity-corpus tests pin write plans, actor bindings, replay ordering,
  stale-source rejection, reusable item links, and anchor/timeline behavior.
  The hook is 786 lines (previously 1,417), with each new service below 600.
  Existing limitation preserved by characterization: timeline edit/expiration
  still look up sheet/legacy actor IDs, so canonical-only actor IDs may report
  that the character must be added to the roster despite already being present.
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
- The desktop app keeps its route in the URL hash (`index.html#/workspace`)
  because it loads the renderer from disk; a path route there pointed at a
  file that does not exist, so a reload showed a blank page. The browser
  build keeps normal paths, and the renderer's origin (so its saved data) is
  unchanged (slice 5.3).
- Packaged-app validation (slice 5.3): `apps/desktop/e2e` drives the built or
  `electron-builder --dir` app with Playwright. It covers startup under the
  packaged CSP, reload and restart, the bridge surface, local model server
  Test connection and its unreachable message, an assistant reply streamed
  chunk by chunk from a fake loopback server through the main process, Stop
  aborting the main-process request, a failed reply, IPC refusal of
  renderer keys and remote addresses, the external-link and navigation
  guards, and a backup zip exported to disk and imported back. Runs block
  the embedding-model hosts, so they also show the assistant works offline.
  The `Desktop E2E` CI job runs it on macOS and Windows for every
  application change.

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
- Older runs (newest first, through 2026-10-31) are archived in
  [`docs/archive/verification-log-2026-10-31.md`](docs/archive/verification-log-2026-10-31.md).
  Add new entries at the top; move old ones to the archive when this list grows long.

### Current Verification Notes
- Older notes (World Canvas WC-1 to WC-6, dialog migration, early Cypress
  runs) are archived at the end of
  [`docs/archive/verification-log-2026-10-31.md`](docs/archive/verification-log-2026-10-31.md).
- The verification tiers and CI policy live in `docs/road-to-market.md`
  ("Verification policy").

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

### Desktop End-to-End Tests
```bash
pnpm package:desktop:dir                          # unsigned app in apps/desktop/release
E2E_APP=packaged pnpm --filter desktop e2e         # the packaged app
pnpm build:web && pnpm build:desktop && pnpm --filter desktop e2e   # the built dist instead
```
Unset `ELECTRON_RUN_AS_NODE` first if your terminal sets it. On macOS set
`CSC_IDENTITY_AUTO_DISCOVERY=false` to package without signing.

### AI Proxy
```bash
cd apps/web
npx tsx proxy-server.ts
```

---

## Working Summary

The project is no longer best described as a systems-heavy LitRPG IDE that happens to contain an editor. The better description of the current direction is:

**a writing-first narrative workspace with optional structured context, consistency support, and deeper systems available when the author wants them.**
