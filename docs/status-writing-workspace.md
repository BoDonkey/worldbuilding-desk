# Writing Workspace Status

> Part of `PROJECT_STATUS.md`, split out on 2026-10-31 to keep that file
> readable. Same rule: this lists what is true in the current application
> for the Writing Workspace (editor, scenes, import/export, review, and
> in-editor state proposals). Update it in the same change as the behavior.

## Current behavior

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
