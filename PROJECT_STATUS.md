# Worldbuilding-Desk Project Status

**Last Updated:** April 5, 2026

## Project Overview

A comprehensive desktop application for LitRPG/GameLit authors that bridges narrative writing with integrated RPG mechanics. Built as an Electron app using React, TypeScript, and IndexedDB.

---

## Current Features ✅

### Core Systems
- **Rules Engine Package** (`packages/rules-engine/`)
  - Stat definitions with formulas (derived stats)
  - Resource definitions with regeneration
  - Dice roller with standard notation (2d6+3, etc.)
  - State manager for character progression
  - Modifier system (add/multiply/override)
  - Active effects and status tracking
  - Time-based mechanics and triggers

- **Project Management**
  - Create/delete projects
  - IndexedDB storage
  - Per-project rulesets
  - Settings storage with character styles

- **Character Sheets**
  - Linked to project rulesets
  - Dynamic stat/resource fields
  - Visual stat/resource editors
  - CRUD operations with persistence

- **World Bible System**
  - Dynamic categories (Characters, Locations, Items, etc.)
  - Custom field schemas per category
  - Rich text descriptions
  - Tagging and relationships
  - `needs completion` / draft state for review-created records
  - First-class `Alternative names` editing with alias sync

- **Item Editor**
  - Combined lore and mechanical properties
  - Damage formulas
  - Armor/resistance values
  - Weapon types and item categories

- **TipTap Rich Text Editor**
  - Custom character styles (stored marks)
  - Dynamic style toolbar
  - Settings UI for managing styles
  - Color picker and font styling

- **AI Integration**
  - Anthropic API integration via local proxy
  - Prompt management system
  - Context-aware assistance
  - Text insertion at cursor/selection
  - AIExpandMenu (right-click selected text)
  - RAG system for document indexing
  - Prompt-tool presets with built-in `Writing Critic` and `Line Editor` personas
  - Explicit workspace persona actions for critique and line edit flows
  - Character import AI review with conservative JSON-based suggestions
  - Character Coach discussion panel during character editing

### UI Components
- Ruleset creation wizard + desktop import (planned).
- Character style editor.
- Project selector + parent-canon controls.
- Navigation system.
- Split editor/AI panel layout.
- Workspace command palette, drawer shell, system history, and lore inspector.
- Workspace context rail upgrades:
  - collapsible `Scene Actions`, `In This Scene`, and `Canon Memories` cards
  - scene entity badges, compact scorecards, temporary tracked entities, and related-memory jumps
  - grouped canon-memory highlights (`Local canon`, `Parent canon`, `Scene recall`, `Recent changes`)
  - memory entity badges with click-to-filter behavior
- Import modes (`strict`, `balanced`, `lenient`) with deferred review for imported scenes.
- Inline consistency review highlights + action popovers.
- Inline lore highlights + quick lore popovers for known entities/characters.
- Selection bubble with AI, critique, lore, and review shortcuts for highlighted text.
- Review queue for unresolved entities with create/link/dismiss actions, queue persistence, and highlight-to-review flow.
- Alias visibility in World Bible and alias-aware linking in workspace review.
- Optional compendium seeding from review-created World Bible records.
- Draft record visibility in Workspace and Compendium flows.
- Editor appearance controls for reading width, editor surface, serif/sans/mono presentation, and line spacing.
- Sticky editor toolbar with stabilized long-document behavior.
- Editor slash-command workflow:
  - `/character`, `/item`, `/memory`, `/system`, `/stat-block`
  - command-first parsing with `/command query` behavior
  - context-aware ranking using active/pinned scene entities and related memory tags
  - exact-match auto-advance, richer menu previews, and lightweight discoverability hinting
- Softened theme system for buttons, cards, badges, and modal surfaces.
- Shared import/export preview flows for scene and compendium JSON portability.
- Project-scoped scratchpad popover for freeform note capture from any route.
- Story corkboard route with per-project brainstorm document and chapter-card storage.
- Corkboard beat editing with title + optional notes structure.
- Corkboard progression snapshot planning fields with General Fiction mode suppression.
- Corkboard AI planning panel with story/chapter/beat scope, project-context prompts, and selection-based promotion actions.
- Corkboard AI context enrichment from project Characters and World Bible summaries.
- Markdown rendering for corkboard AI results and markdown-aware paste handling in the brainstorm editor.
- Workspace writer-first layout pass:
  - reduced persistent route chrome above the editor
  - scene title and scene actions moved into the scene rail
  - review/details moved into on-demand modals
  - independent scrolling across scene rail, editor column, and context/AI rail
- Ollama integration path fixes and wider AI panel mode.
- Lore/review inline workflow convergence:
  - related-record context, alternative names, and compendium status in lore surfaces
  - direct compendium seeding/open actions from inline lore and Lore Inspector
  - richer review-queue candidate context with inspect-before-link actions
  - focused navigation into matching Character Sheets and Compendium entries
- Character authoring/import follow-up:
  - `Project Mode` selection moved into project creation for first-use clarity
  - General Fiction copy/gating tightened across Projects, Settings, Characters, and World Bible
  - review-first long-form character import for `.docx`, `.rtf`, and pasted text
  - structured imported sections preserved instead of flattening immediately into one notes blob
  - richer character editing surface for imported sections and source residue
  - compact character list/details split for better authoring space use
  - Character Coach AI panel for in-editor character development discussion
  - field-level AI discussion modal for descriptions, notes/residue, and character detail sections

---

## How to Run the Project

### Prerequisites
```bash
# Node.js 18+ and pnpm
npm install -g pnpm
```

### Development Setup

**1. Install dependencies:**
```bash
pnpm install
```

**2. Start the proxy server (for AI features):**
```bash
# In one terminal
cd apps/web
npx tsx proxy-server.ts
# Runs on http://localhost:3001
```

**3. Start the web app:**
```bash
# In another terminal
pnpm dev:web
# Opens on http://localhost:5173
```

**4. Start Electron for desktop testing:**
```bash
# In another terminal
cd apps/desktop
pnpm start:dev
```

### Project Structure
```
worldbuilding-desk/
├── apps/
│   └── web/                    # Main Electron app
│       ├── src/
│       │   ├── routes/         # Main UI routes
│       │   ├── components/     # React components
│       │   ├── services/       # Business logic
│       │   └── entityTypes.ts  # TypeScript types
│       └── proxy-server.ts     # AI API proxy
│
├── packages/
│   └── rules-engine/          # Standalone rules package
│       ├── src/
│       │   ├── core/          # Engine, evaluator
│       │   ├── state/         # Character state
│       │   ├── utils/         # Dice roller
│       │   └── types.ts       # Type definitions
│       └── examples/          # Usage examples
│
└── pnpm-workspace.yaml        # Monorepo config
```

### Testing Examples
```bash
# Run rules engine examples
cd packages/rules-engine
pnpm build
npx tsx examples/basic-usage.ts
```

---

## Recent Changes & Fixes

### Character Creation / Promotion Follow-up (April 5, 2026)
- Continued the character dogfooding pass with a stronger mode-based `Characters` route:
  - default state now emphasizes three entry paths in human-first order: manual, import, then AI-assisted draft
  - focused workspaces hide the roster/list while creating, reviewing imports, reviewing AI drafts, or editing a character
  - manual creation now supports full-width editing plus author-added custom sections
- Extended AI-assisted character work beyond the initial draft:
  - AI-generated drafts now share the same review flow as imports
  - review and edit surfaces both support per-section AI actions (`Expand`, `Sharpen`, `Find tension`)
  - AI/import review now allows adding new sections before save instead of forcing a save-first workaround
  - AI suggestions can now be applied into descriptions, notes, or section bodies instead of staying discussion-only
  - `Character Coach` replies now support direct apply actions and a lightweight field-level discussion modal
- Hardened fragile AI/import paths uncovered during dogfooding:
  - tolerant JSON parsing now handles several malformed model responses that previously crashed draft creation
  - import parsing now recognizes broader labels such as `Character:` and approximate age phrases like `mid 20s`
  - inline section starts like `Background: ...` and `Goals: ...` now become real structured sections during import
- Added character lifecycle groundwork between `World Bible` and `Characters`:
  - World Bible people-like entries can now be promoted into full Characters records
  - roadmap notes now explicitly track future author-editable prompt overrides and a companion `Demote to World Bible` flow

**Immediate Next Slice**
- Dogfood the new field-level `Discuss` modal in real use and decide whether assistant replies inside that modal also need `Make section` / `Add section(s)` actions.
- Keep tightening `Character Coach` response structure so multi-section suggestions become reusable character detail blocks more reliably across providers.
- Validate whether the `Promote to Characters` flow needs linked provenance UI before adding demotion.

### Character Import / Editing / Coaching Pass (April 4, 2026)
- Closed the first major dogfooding loop around character authoring:
  - fixed the Characters route blank-screen crash
  - moved `Project Mode` into project creation so new projects stop silently inheriting the wrong posture
  - clarified `General Fiction` expectations and the `World Bible` vs `Characters` boundary in the UI
- Reworked long-form character import into a review-first flow:
  - import now supports `.docx`, `.rtf`, and pasted text on the Characters surface
  - imports extract likely basic info, section blocks, and source residue before save
  - per-section actions now use clearer language (`Keep in details`, `Add to short description`, etc.)
  - structured imported sections are preserved in the saved character instead of being flattened immediately
- Hardened the RTF and AI-assist paths during dogfooding:
  - improved RTF cleanup for Apple/Word-style exports after several real-file failures
  - fixed duplicate-key issues from repeated section titles
  - made AI import suggestions resilient to fenced/non-ideal JSON responses
  - surfaced what the AI actually changed so success is visible instead of silent
- Extended character editing beyond the original minimal form:
  - imported sections and source residue are editable after save
  - age was demoted from the compact list in favor of name/role emphasis
  - added a `Character Coach` panel so AI can help identify missing dimensions, tensions, and texture during editing

**Immediate Next Slice**
- Dogfood the new character-coach/editor loop in real use.
- Decide whether coach suggestions need lightweight apply/promote actions.
- Decide whether imported sections should remain structured details or become first-class character fields.

### Workspace Lore/Review Convergence + Focused Record Navigation (April 3, 2026)
- Finished the workspace inline-authoring follow-up after the initial slash-command pass:
  - slash menu now auto-advances exact command matches instead of always requiring `Enter`
  - visible `/event` labeling replaces `/system` in the root menu while keeping `system` as an accepted alias
  - slash rows now show clearer descriptions, metadata, and section headers
  - lightweight `type /` hinting was added for low-content scenes
- Extended inline lore and canon workflows:
  - lore popovers and Lore Inspector now show alternative names, connected-record context, and compendium-link status
  - entity lore can seed a Compendium entry directly or open the existing entry without leaving a dead-end route hop
  - review popovers and the review queue now show top suggested matches with inspectable context before linking aliases
- Tightened cross-route navigation:
  - character lore now opens the matching Character Sheet directly in edit mode
  - compendium actions now land on the `Entries` tab with the linked entry focused/highlighted
  - review/open actions across workspace surfaces now behave like one connected canon-resolution flow instead of separate tools

**Immediate Next Slice**
- Corkboard dogfooding/polish is now the clearest product-work follow-up if time is available.
- Strategic/document follow-ups worth carrying forward:
  - translate broader-market table stakes into explicit roadmap slices without diluting the LitRPG/GameLit wedge
  - decide which generic-fiction planning features are required for parity vs which should stay secondary to consistency/state differentiation
  - revisit portability/versioning after the workspace UX settles further

### Workspace Context Loop + Slash Commands (April 3, 2026)
- Finished a substantial workspace context pass:
  - added collapsible side-rail cards for `In This Scene` and `Canon Memories`
  - added a matching collapsible `Scene Actions` card in the left rail
  - made rail cards collapsed by default for lower-noise writing sessions
- Built a more coherent scene-state workflow:
  - scene-presence badges for characters/items/locations
  - compact scorecards with pinning for currently tracked entities
  - direct `Related memories` jump from selected scene entity into filtered canon memories
- Reworked canon memory relevance:
  - manual memories are preserved instead of being overwritten by auto-capture
  - auto-capture now emits typed records such as `Scene snapshot`, `Open loop`, and `Canon fact`
  - right rail groups highlights into `Local canon`, `Parent canon`, `Scene recall`, and `Recent changes`
  - extracted memories now use entity-aware scoring and carry `entity:<id>` tags when possible
  - memory cards show clickable entity badges and support temporary entity filtering
- Added editor discovery/help affordances:
  - `Writing Shortcuts` modal on `Cmd/Ctrl+/`
  - command-palette entry for the same modal
- Shipped first slash-command support in the workspace editor:
  - `/character`, `/item`, `/memory`, `/system`, and `/stat-block`
  - slash flow now supports command-style parsing (`/command query`) instead of only a flat insert search
  - `/system` now favors useful quest/resource/status updates rather than consistency-review noise
- Closed several UX bugs during the pass:
  - dismissed review highlights now stay dismissed across later review updates
  - scratchpad content now scrolls correctly
  - writing-shortcuts modal is available without needing to clear review state first

**Immediate Next Slice**
- Completed later the same day:
  - exact-match slash auto-advance and menu polish
  - richer lore/compendium inline actions from popovers
  - review/lore convergence pass and focused record navigation
- Remaining nearby follow-up candidates:
  - corkboard dogfooding based on real outlining sessions
  - portability/versioning hardening once current workspace UX settles
  - market/table-stakes planning for broader fiction feature parity

### Corkboard Planning Workspace + AI/UX Pass (March 29, 2026)
- Completed the first real corkboard implementation after the scratchpad groundwork:
  - added a first-class `Corkboard` route with navigation + command-palette access
  - added IndexedDB-backed chapter-card storage and a per-project brainstorm document
  - shipped chapter CRUD, beat CRUD, and progression snapshot fields
  - hid progression snapshot controls automatically in `General Fiction` mode while preserving stored data
- Added the first corkboard AI workflow:
  - scope-aware planning prompts at `Story`, `Chapter`, and beat-level `Card` scope
  - AI results now stay in the corkboard AI panel instead of auto-writing into the brainstorm document
  - selected AI result text can be inserted into the brainstorm doc or promoted directly into chapters / beats
  - AI prompts now treat brainstorm notes as provisional rather than silently endorsing them as canon
- Enriched corkboard AI context:
  - lightweight character summaries
  - lightweight World Bible entity/category summaries
  - narrower context targeting for selected chapters and beats
- Finished a substantial corkboard UX/QOL pass:
  - independent scrolling for brainstorm and structure/AI panes
  - shared sticky scope header instead of duplicated scope controls inside both panes
  - beat selection now powers real `Card` scope behavior
  - dismissible feedback banner
  - improved AI-result workflow using selection-based actions
  - markdown-rendered AI results and markdown-aware brainstorm paste support
- Small cross-route cleanup:
  - removed default unordered-list bullets from the Projects list UI

**Immediate Next Slice**
- Dogfood the corkboard AI in real outlining sessions to see where context still feels thin or too generic.
- Highest-value likely next step: a focused corkboard UI/authoring polish pass informed by real use.
- Strong follow-up candidates:
  - richer canon/progression context for system-enabled projects
  - better AI result management/history
  - clearer chapter/beat editing hierarchy and affordances
  - split future AI context architecture into:
    - stable canon context from Characters / World Bible / Compendium
    - narrative memory context from scene/chapter recall systems such as SHODH

### Cross-Route Polish + Re-Entry Cleanup (March 28, 2026)
- Re-entered the repo, revalidated the current workspace/package/doc baseline, and cleaned up repository drift:
  - removed tracked `package-lock.json` files so the repo consistently follows the `pnpm` workspace setup
  - refreshed `apps/web/README.md` so it reflects the actual app/package responsibilities instead of the Vite starter template
  - updated roadmap/session docs to reflect current commands and current priorities
- Closed the Workspace AI verification follow-up:
  - confirmed provider selection persists across full restart
  - confirmed Ollama selection remains stable
  - confirmed AI input remains visible without dragging the editor column
  - confirmed assistant-message scrolling stays inside the AI pane
- Finished the Compendium `world-systems` UI sweep:
  - zone affinity now uses grouped creation/logging controls and denser milestone/status cards
  - community/logistics now presents party selection, active combo buffs, and roster opportunities in the newer card system
  - settlement progression now breaks cleanly into module setup, tier/base-stat controls, and installed-effect summaries
- Completed a broader polish pass across Settings, Workspace, Navigation, and Characters:
  - Settings sections are now collapsible with explicit chevron state indicators
  - Project Mode was moved near the top of Settings for easier discovery
  - workspace selection-action bubble is centered within the editor pane instead of hiding under the left rail
  - workspace shell spacing/header treatment was tightened further
  - unchecked checkboxes now use custom themed rendering instead of dark browser-default boxes
  - `Ruleset` is hidden from main navigation in `General Fiction` mode unless rule authoring is explicitly enabled
  - Character Sheets now suppress most overt LitRPG/system-heavy affordances in `General Fiction` mode
  - Characters / Character Sheets surfaces now use the newer softened panel/card treatment instead of harsher legacy inline styling
- Started the planning-support implementation slice:
  - added a project-scoped scratchpad popover mounted at the app shell so notes can be captured without leaving the current route
  - added dedicated IndexedDB scratchpad storage with debounced autosave
  - exposed scratchpad launch through the shell UI, command palette, and shortcut
  - rewrote the scratchpad/corkboard feature spec to match the current app architecture and storage model

**Immediate Next Slice**
- Continue the planning-support slice from the new baseline.
- Highest-value next step: scaffold the corkboard route and chapter-card storage model described in the updated spec.

### Workspace Writer-First Cleanup + Ollama Follow-up (March 22, 2026)
- Reduced route-level workspace noise so the editor appears much sooner:
  - removed the large top workspace heading
  - moved routine notices to toast-style overlays
  - converted consistency/review details into on-demand modal flows
  - moved scene title and scene-level actions into the left scene rail
- Reworked workspace desktop scrolling:
  - left scene rail scrolls independently
  - editor column scrolls independently
  - right context/AI rail scrolls independently
- Improved AI panel behavior:
  - assistant messages now auto-scroll within the assistant pane instead of trying to scroll ancestor containers
  - assistant pane has a wider expandable mode for longer responses
- Fixed Ollama-related wiring issues:
  - desktop provider registry now receives custom provider `baseUrl`
  - Workspace now syncs canonical app settings instead of relying on a stale local settings copy
  - reduced the chance of stale workspace settings writing an old provider back over current AI settings

**Immediate Follow-up**
- Verified on March 28, 2026:
  - AI provider persistence across full restart is stable, including Ollama-selected projects.
  - AI input remains visible and assistant scrolling stays internal after full app restart.
- Focus can stay on cross-route polish and remaining low-risk UI cleanup instead of more workspace AI follow-up.

### Portability, Popover Convergence, and UI Sweep (March 21, 2026)
- Softened the visual language across the app:
  - rounded button shapes
  - muted/pastel but accessible action states
  - warmer panel/input/card surfaces
- Unified workspace lore/review interactions around the shared popover shell:
  - shared header/tone treatment
  - outside-click + `Escape` close
  - viewport clamping
  - direct jump from lore popover to World Bible / Characters
  - `needs completion` warnings inside lore peek + inspector flows
- Finished the main persona/settings UX pass:
  - clearer separation of provider/model setup vs prompt/persona management
  - explicit default-persona summary by project mode
  - clearer distinction between installed personas and supporting prompt tools
- Added JSON portability flows:
  - scene JSON export
  - scene JSON import with preview/validation before commit
  - compendium JSON export
  - compendium JSON import with section-level preview/validation
- Started and partially completed a broader UI sweep:
  - workspace import/export modals and banners now use the softened surface system
  - compendium shell, JSON import preview, help panels, tabs, and status chips now match the newer theme
  - compendium overview, entries, and progression sections now use the shared card/layout treatment

**Immediate Next Slice**
- Finish the remaining Compendium `world-systems` body sweep so zone affinity, party synergy, and settlement progression match the newer route styling.
- Do one final cross-route polish pass across Workspace, Compendium, and Settings after the compendium sweep is complete.
- Reassess whether any roadmap feature gaps remain after the UI sweep is fully done.

### Review Completion, Persona Workflow, and Editor Stability (March 21, 2026)
- Added explicit workspace persona actions:
  - `Critique selected passage`
  - `Critique current scene`
  - `Line edit selected passage`
- Fixed queued AI persona prompts so RAG/Shodh lookup uses the actual queued prompt text instead of the manual input box state.
- Added active persona / prompt-stack visibility in the AI assistant panel.
- Added second built-in persona preset: `Line Editor`.
- Added `completionStatus` / `needs completion` draft state to World Bible entities.
- Review-created World Bible records now default to `needs completion`.
- Added first-class `Alternative names` editing in World Bible and synced it to alias storage.
- Added alias replace/delete support so World Bible alias editing is now the source of truth instead of one-way display.
- Added optional compendium seeding from workspace review actions.
- Surfaced draft record counts and quick links in the Workspace context drawer.
- Surfaced draft source warnings in Compendium import and linked-entry views.
- Replaced the editor toolbar's custom scroll/fixed-position logic with a sticky implementation to stop flashing and disappearing during long-scroll editing.
- Cleaned up the AI assistant panel header and improved panel tab readability.

**Immediate Next Slice**
- Completed in the later March 21, 2026 portability + UI sweep pass.

### Workspace Review, Canon UX, Editor Config, and First Persona (March 15, 2026)
- Extended smoke coverage for workspace/editor flows:
  - editor appearance persistence
  - drawer persistence
  - `.txt`, `.md`, `.html`, `.docx`, and `.pages` import paths
- Reworked unresolved-entity handling into a lightweight review queue instead of blind mass creation.
- Added per-item category selection, link-to-existing, dismiss, and batch create from the queue.
- Added `Add to Review` from editor text selection for missed mentions such as nicknames.
- Improved unknown-name normalization for possessives and honorifics (`Evelyn Harlow's`, `Dr.Harrison`, etc.).
- Persisted review queue state across route switches so authors can leave Workspace and resume review later.
- Fixed alias linking so aliases can target World Bible entries or characters, and surfaced aliases in World Bible cards.
- Reduced accidental canon creation risk by moving bulk create into the review queue.
- Cleaned up World Bible category management so category editing no longer overlaps the entry-create UI.
- Improved editor toolbar behavior for long documents and collapsed Canon Consistency Review into a compact summary by default.
- Expanded editor appearance settings:
  - serif / sans / mono text style
  - focused / wide reading width
  - paper / mist / contrast surface presets
  - tight / comfortable / airy line spacing
- Added theme-aware dark-mode variants for editor surfaces and tuned highlight readability.
- Added first built-in AI persona preset: `Writing Critic`, installable from Settings and usable through existing prompt-tool defaults.

**Immediate Next Slice**
- Completed in the March 21, 2026 follow-on slice.

### Workspace Review + Editor UX (March 14, 2026)
- Added import modes and deferred review flow so non-strict imports remain writable without losing review context.
- Added best-effort `.pages` preview extraction with fallback guidance.
- Tightened unknown-entity extraction to suppress more connective/prose false positives.
- Moved unknown-entity handling into inline editor highlights with create/link/dismiss popovers.
- Added shared popover primitive and reused it for quick lore peeks on known entities and characters.
- Added editor readability controls:
  - serif/sans text style
  - focused/wide reading width
  - paper/mist/contrast editor surface presets
- Hardened import/save so RAG indexing and Shodh auto-memory failures do not block scene persistence.
- Added lightweight local embedding fallback when transformer model bootstrap fails in-browser.
- Improved settings copy for consistency detection keywords and import defaults.

**Follow-on**
- Persist `needs completion` state for review-created World Bible / Compendium records and surface that with badges in navigation.
- Promote alias handling into a first-class `Alternative names` field on World Bible entries and use it as the shared source of truth for review/lore matching.
- Continue editor appearance work later with richer font/color customization if needed.

### Systems Integration + Imports (February 22, 2026)
- Added settlement aura model and UI flow with generalized module sources (`trophy`, `structure`, `station`, `totem`, `custom`).
- Added community/logistics party synergy engine and surfaced active combo buffs + roster opportunities.
- Added settlement base stats and fortress progression tier effects, including explicit base-stat save/reset flow with validation/clamps.
- Integrated runtime modifiers into craftability checks (effective level + material multiplier from settlement/synergy state).
- Integrated runtime-adjusted previews into Character Sheets (effective level/stat/resource values shown alongside base values).
- Added Workspace multi-file import for `.txt`, `.md`, `.html`, and `.docx`; `.doc` now returns explicit convert-to-docx guidance.
- Added `docs/next-steps.md` with prioritized roadmap and phase exit criteria.

**Immediate Next Slice**
- Expand runtime integration beyond previews into persisted gameplay outcomes (rule/action resolution paths).

### Canon Management & Inheritance (February 8, 2026)
- Added parent/child project metadata (RAG + Shodh inheritance toggles, canon timestamps).
- Built composite Shodh/RAG providers so child projects read parent canon read-only while writing locally.
- Implemented promote workflows for scenes, world-bible entries, ruleset summaries, and individual memories.
- Added promote buttons + provenance labels (Local vs Parent) across Workspace, World Bible, Character Sheets, and AI Assistant context.
- Added parent-canon banners with sync controls in Projects, Workspace, and World Bible routes.

### AI Integration
- Multi-provider abstraction (Anthropic, OpenAI, Ollama) with caching.
- Indexed prompt management + Shodh memories feeding context.
- Context-aware assistance with selectable insertion and AIExpandMenu.
- Local RAG/Shodh layers now support inherited canon for AI grounding.


### Prompt & Tooling Controls (Planned)
- Expose per-project system prompt editing with tone/policy presets.
- Allow authors to define “ick” word lists and style rules that attach to documents/imports.
- Tie prompts/policies into import workflows so external documents inherit the right AI context.
### UI Foundation & Theming (January 11, 2026)
**Implemented:** Complete theming and accessibility foundation
- **Theme System:** Light/dark mode with CSS variables and ThemeContext
- **Navigation:** Fixed top navigation bar with active route highlighting
- **Accessibility:** Font size controls (small/medium/large) with system-wide scaling
- **Settings Page:** Reorganized layout with proper sections and styling
- **Design Tokens:** Established consistent color palette and spacing system

**Technical Details:**
- Created ThemeProvider and AccessibilityProvider contexts
- Implemented CSS custom properties for theme variables
- Added keyboard navigation focus indicators (WCAG compliant)
- Fixed navigation positioning (sticky → fixed)
- Consolidated settings UI into clean sectioned layout

---

## Known Issues & Limitations

### Current Architecture
- Running as web app, not full Electron yet
- Proxy server must be started separately
- No native desktop packaging currently

### AI Features
- Proxy server doesn't persist across restarts
- API key must be entered per session
- No streaming UI feedback yet (planned)

### Storage / Canon
- IndexedDB per project, no remote sync yet
- Child projects inherit parent canon read-only; promotion requires approval
- Manual backup/export (multi-source import planned next)

### Workspace / Review UX
- Alias candidate scoping in the review queue still falls back broadly and may need a more explicit category/all-record toggle.

### AI / Persona UX
- Persona defaults and active-stack editing are much clearer in Settings now, but the overall prompt/persona library could still use deeper day-to-day drafting validation.
- Persona actions currently cover critique and line edit flows; broader persona task coverage is still pending.

### Editor UX
- Sticky toolbar behavior is significantly improved, but should get one more real-world smoke pass across long documents and narrow viewport layouts.

### Compendium UX
- The Compendium route shell, overview, entries, and progression sections now follow the newer softened UI language.
- `world-systems` has now received the main UI sweep as well.
- Any remaining Compendium work should be treated as polish/follow-up notes rather than a blocked unfinished route section.

### Data Portability
- Scene and compendium JSON round-trip flows are now present with preview/validation before import commit.
- Portability is functional, but schema/versioning strategy and optional bundle-style export/import are still open future enhancements.

### Editor Appearance
- Editor appearance controls are still intentionally coarse-grained; users cannot yet choose custom fonts, dyslexia-friendly fonts, or custom highlight palettes.
- The fixed toolbar behavior is much better, but may still need refinement if edge scrolling cases show up again.

### AI Authoring Tools
- Built-in `Writing Critic` and `Line Editor` personas both exist now.
- Dedicated critique actions exist for selected passage and current scene; broader persona task coverage is still pending.

---

## Planned Next Steps

### Short Term (Next Phase)
1. **AI Persona Workflow**
   - Add explicit critique actions for selected passage and current scene.
   - Keep persona outputs structured and manual-apply.
   - Confirm the first persona feels useful before adding more.
2. **Review Completion Workflow**
   - Add draft / needs-completion state to review-created World Bible and Compendium records.
   - Surface completion badges in navigation and review flows.
   - Promote `Alternative names` into the World Bible editing model.
3. **Lore / Compendium Tooltip Convergence**
   - Expand shared popover into a full lore + compendium review shell.
   - Support cross-linking shorthand references and alias management from tooltip flows.
4. **Editor Customization Follow-up**
   - Add richer typography controls only if the current presets prove too limiting.
   - Consider dyslexia-friendly fonts and custom highlight palettes.

4. **User Experience**
   - Project export/import
   - Auto-save indicators
   - Better error handling

### Medium Term
1. **Memory System Integration**
   - Evaluate Shodh-memory for canon tracking
   - Per-project memory stores
   - Contradiction detection
   - World Bible long-form documents

2. **Advanced Worldbuilding**
   - Timeline/chronology tools
   - Relationship graphs
   - Map integration
   - Scene planner

3. **Rules Engine Extensions**
   - Combat simulator
   - Character progression curves
   - Balance analysis tools
   - Import existing rulesets (D&D, etc.)

### Long Term
- Multi-user collaboration
- Cloud sync option
- Mobile companion app
- Plugin/extension system
- Marketplace for rulesets/templates

---

## Technical Debt & Cleanup

### Code Quality
- [ ] Add comprehensive error boundaries
- [ ] Implement proper TypeScript strict mode
- [ ] Unit tests for rules engine
- [ ] Integration tests for storage layer

### Documentation
- [ ] API documentation for rules-engine package
- [ ] Component documentation
- [ ] User guide/tutorials
- [ ] Video walkthroughs

### Performance
- [ ] Optimize large document rendering
- [ ] Lazy loading for World Bible entries
- [ ] IndexedDB query optimization
- [ ] Editor debouncing improvements

---

## Development Notes

### Key Learnings
- TipTap stored marks require careful state management
- React component remounting can cause editor issues
- Monorepo requires workspace resolution attention
- CORS is real, proxy servers work

### Architecture Decisions
- **Monorepo:** Clear separation between engine and app
- **IndexedDB:** Local-first, offline-capable
- **TypeScript:** Strict typing prevents runtime errors
- **Modular Design:** Each system can evolve independently

### Dependencies Worth Noting
- `@tiptap/react` - Rich text editing
- `@anthropic-ai/sdk` - AI integration
- `immer` - Immutable state updates (rules engine)
- `mathjs` - Formula evaluation
- `express` + `cors` - Temporary proxy

---

## Session Workflow

### Starting a Session
1. Read this file for current state
2. Check "Recent Changes" for context
3. Review "Planned Next Steps" for priorities
4. Start proxy server if testing AI features
5. Run `pnpm dev:web` in the main terminal

### Ending a Session
1. Update "Recent Changes" section
2. Move completed items from "Planned Next Steps"
3. Add new issues to "Known Issues"
4. Update "Last Updated" date
5. Commit PROJECT_STATUS.md

---

## Quick Reference

### Important Commands
```bash
# Full dev setup
pnpm install && pnpm dev:web

# Just the app
pnpm dev:web

# AI proxy (separate terminal)
cd apps/web && npx tsx proxy-server.ts

# Build rules engine
cd packages/rules-engine && pnpm build

# Run examples
cd packages/rules-engine && npx tsx examples/basic-usage.ts
```

### Key Files to Know
- `apps/web/src/routes/` - Main application views
- `apps/web/src/entityTypes.ts` - Core data models
- `packages/rules-engine/src/types/` - Rules system types
- `apps/web/src/components/TipTapEditor.tsx` - Editor implementation
- `apps/web/src/services/` - Storage and business logic

### Port Usage
- `5173` - Vite dev server (main app)
- `3001` - Express proxy server (AI)

---

## Contact & Resources

### Related Documentation
- See `packages/rules-engine/README.md` for engine details
- See `Comprehensive_RPG_Rules_System_Design_Guide.docx` for design philosophy
- See `shodh_memory_integration_vision (1).md` for memory system plans

### External Resources
- TipTap Docs: https://tiptap.dev/
- Anthropic API: https://docs.anthropic.com/
- Shodh Memory: https://github.com/shodh-ai/shodh-memory

---

**Remember:** This file should be updated at the end of each major work session to maintain accurate project state.
