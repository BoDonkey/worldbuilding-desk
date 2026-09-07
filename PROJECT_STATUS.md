# Worldbuilding-Desk Project Status

**Last Updated:** September 6, 2026

## Project Overview

Worldbuilding-Desk is a desktop writing environment for fiction authors. The current product direction is **writing first**: authors should be able to open the app, start drafting immediately, and let structure, lore tracking, and consistency support appear progressively instead of blocking the writing flow.

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
- Lore Documents are now framed as source-note intake rather than a parallel canon database, with manual writing, dossier import, and extraction paths kept separate from accepted canon.
- World Bible records can create or open a linked Lore Document for longform source notes, and Lore Documents can navigate back to the linked World Bible record.
- Lore Documents now has a project context health panel that shows RAG document/chunk counts, indexed document type counts, Shodh memory counts, project data counts, and a retrieval probe.
- World Bible character records now include a Character detail health panel showing aliases, accepted facts, linked Lore Documents, scene mentions, Shodh memories, state events, and an explicit RAG context probe for the selected character.
- Scratchpad records are included in project backup snapshots and restore paths.
- Lightweight Corkboard is back as a workspace planning modal for chapter cards and plot points.
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
- App-shell search is now visibly exposed and returns unified scene plus World Bible results.
- Pending Mechanics completion counts now aggregate onto the `More` navigation
  control at both desktop and narrow breakpoints, keeping optional-system work
  discoverable without promoting systems into the writing-first primary nav.

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
- Mechanics-enabled projects expose a built-in World Bible record type for
  problems power cannot solve. Authors maintain each problem's structured
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
- Decide whether Corkboard graduates from a quick-access modal into a dedicated planning tab/route while keeping the modal for in-scene reference.
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
- `pnpm audit --prod` reports 0 vulnerabilities after the React Router 8.3
  security upgrade and transformer migration.
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
