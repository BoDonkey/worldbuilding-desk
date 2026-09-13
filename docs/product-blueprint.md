# Product Blueprint — Worldbuilding Desk

Last updated: 2026-09-12

This is the product, UX, navigation, and design authority. It consolidates the
former `product-blueprint.md`, `navigation-ia-decision.md`, `style-bible.md`,
`multi-mode-directives.md`, and the UI-language/a11y guardrails (originals in
`docs/archive/`).

## Core Thesis

Worldbuilding Desk should feel like a calm writing workspace that quietly
understands the story around the draft.

The editor is the primary product surface. World data, rules, AI tooling, and
consistency logic are supporting systems that stay mostly invisible until the
author needs them.

**One-sentence summary:** a writing-first narrative workspace that helps
authors draft with live story context, soft consistency support, and optional
deep world/rules systems when they need them.

## Product Promise

What the author should feel:

- I can start writing immediately.
- The app notices important story context without interrupting me.
- I can inspect or correct structure when I want to, not when the app demands it.
- AI helps me refine and reason, but does not take over authorship.

What the product should do: preserve flow, surface context progressively,
track entities and canon passively, offer soft consistency feedback, and keep
advanced systems available for power users without making them mandatory.

### Privacy and data movement

Privacy is a product promise and a selling point, not an advanced setting.

- Projects and manuscripts are stored locally.
- Worldbuilding Desk does not send diagnostic telemetry and does not use
  author writing to train AI.
- No background feature sends manuscript or project context to a hosted model.
- Text leaves the computer only when the author explicitly invokes a hosted AI
  provider they configured. The surface must disclose that destination before
  first use and keep the request author-triggered.
- Local Ollama workflows remain on-device. The app remains useful with AI
  disabled.
- Provider retention or training claims belong to that provider's current API
  terms; Worldbuilding Desk must not imply control it does not have.
- Errors and diagnostics remain local. The author may copy a redacted
  diagnostic into a support request, but the app never uploads it
  automatically.

Author-facing copy should say `Stored locally`, `Runs on this computer`, or
`Sends this request to <provider>` where appropriate. Do not use an absolute
`never leaves your computer` claim on a workflow that can invoke a hosted
provider.

## Positioning

Against general AI writing tools (which optimize for generation speed and
prompt-driven output), Worldbuilding Desk differentiates on context continuity,
story-aware assistance, passive lore/canon capture, and consistency support
inside the writing flow.

Against wiki-style lore tools (which require manual upkeep), Worldbuilding Desk
grows structure from the manuscript, connects writing to world context, and
makes references and consistency useful in the moment of drafting.

Differentiators worth preserving: integrated lore and manuscript context,
inline consistency review, parent/child canon inheritance, local/project
memory support, optional rules/stat infrastructure for system-heavy fiction,
and import/export/backup flows suitable for real writing projects.

## UX Principles

1. **Writing comes first.** No onboarding wall before drafting, no required
   schema setup before the first scene; the default route privileges the
   manuscript editor.
2. **Structure is progressive.** Characters, lore, rules, and systems appear
   when relevant; advanced surfaces stay collapsed or hidden by default.
3. **Feedback is soft.** Consistency review flags, never blocks; suggestions
   are dismissible; review feels closer to a linter than a compiler.
4. **AI is assistive.** AI refines, explains, summarizes, and suggests; it
   does not generate large unsolicited chunks or replace the author's voice.
5. **Systems support narrative.** Rules, stats, compendium state, and
   progression enrich narrative continuity; they never dominate the primary
   interface.

## Product Layers

1. **Writing Workspace** — manuscript editor, scene navigation, import/export,
   selection tools, lightweight inline feedback. Absorbs most interaction time.
2. **Context and Canon** — World Bible, aliases, memories, lore inspection,
   parent/child canon inheritance. Supports recall and continuity.
3. **Assistance** — AI tools, prompt management, contextual retrieval,
   consistency review, and author-triggered writing coaching grounded in a
   curated craft reference plus cited manuscript evidence.
4. **Advanced Systems** — rulesets, stats, resources, compendium mechanics,
   settlement progression, LitRPG runtime logic. Valuable and differentiating,
   but optional and discoverable rather than foregrounded.

## Navigation and Information Architecture

Decided hierarchy (settled 2026-07-26; do not open parallel navigation
roadmaps — refine through this document):

- `Projects`
- `Workspace` — write
- `World Bible` — structured canon (the single canonical record system)
- `Lore Documents` — longform source material and deep notes, not a second
  canon database
- `More` — optional systems (Ruleset, Sheets, Mechanics, Settlement), planning
  and review utilities, character-package transfer, settings

The writing coach is not a separate destination. It is available when the
author explicitly asks for craft feedback anywhere an existing AI interaction
lives, scoped to the current selection or scene. A manuscript-level coach
section lives in the derived Corkboard dashboard. These scopes remain visibly
different so a local question does not silently become an expensive,
whole-manuscript review.

The derived dashboard is read-only. Authored Chapter Cards and Plot Points must
never look like computed observations, and computed observations are never
editable. Deterministic panels describe only explicit manuscript, planning,
ruleset, and accepted-state inputs; semantic interpretation is labeled as
author-triggered coaching and cites the scenes it considered.

Canonical ownership rules:

- Characters, locations, items, factions, creatures, concepts, and custom
  categories live inside World Bible. There is no separate character
  destination: dialogue-style assignment and single-character transfer live
  in World Bible detail; sheets/state remain an optional system surface; batch
  character-package transfer is a utility, never a canon owner.
- If a surface is about identity, aliases, canon role, or descriptive editing,
  it belongs to World Bible. If it is about sheets, tracked state, resources,
  or progression, it is a secondary tool attached to a World Bible record.
- New canon anchors default to World Bible; freeform background writing
  defaults to Lore Documents; review completion and alias cleanup stay
  centered in World Bible.
- Canon that changes during the story remains one readable history. Canon
  Decisions labels the action **Supersede**, requires an explicit "as of this
  scene" selection, and explains that the earlier fact applies before the
  selected scene while the new fact applies from it onward. Scene order is
  resolved live from stable links, so rearranging chapters does not silently
  rewrite the boundary.
- Items, creatures, and locations gain mechanics only through an explicit
  author action; accepting a detected entity never auto-creates a Compendium
  record.
- Character possession and equipment are not fields on the canonical item;
  they belong to character state and manuscript-time mutation events.
- Prose that introduces, acquires, equips, uses, or consumes an item may
  prepare an in-workspace proposal beside the relevant text. The proposal may
  coordinate an inventory event, an optional reusable World Bible item, and
  optional mechanics, but those remain distinct records and nothing is
  created or applied before author confirmation.
- A named inventory item does not require a World Bible record. Generic or
  one-off objects default to state-only tracking so the app does not turn
  every rope, cup, or ordinary weapon into canon. Creating or linking a
  reusable canonical item is an explicit choice in the proposal.
- Optional-system routes stay grouped behind `More` with actionable-state
  badges; general-fiction projects are never framed as incomplete without
  mechanics.

Optional-system disclosure rules:

- A first mechanics visit starts with one plain-language basic journey, not
  the complete rules/runtime model. The basic journey is: define one useful
  stat or resource, attach a sheet from a World Bible character, and record
  one scene-scoped change.
- Formula, effect, runtime, progression, recipe, milestone, zone, and
  settlement controls remain available, but appear only when their
  prerequisite exists or the author explicitly opens an advanced section.
- Empty states explain what a capability changes in the manuscript workflow,
  the minimum prerequisite, and the next action. They must not read like a
  configuration error or unfinished-project warning.
- First-run guidance teaches writing and canon before optional systems.
  Mechanics guidance is contextual, dismissible, resumable, and entered only
  after an explicit author choice.
- Once mechanics are enabled, the shortest state-change path stays in the
  writing workspace. Selecting or acting on prose such as `Bill drank a
  health potion` opens a compact, keyboard-accessible proposal with actor,
  item, attribute, `Change by` / `Set to`, inventory effect, and before/after
  preview prefilled where deterministic evidence allows. New or ambiguous
  item definitions are resolved in that proposal without forcing navigation
  to World Bible, Sheets, or Compendium.
- Exact author-approved item mechanics may be reused automatically to prepare
  later proposals. Detection and prefill may be automatic; accepting canon,
  defining mechanics, and changing manuscript-time state never are.

The automagic principle: the author should never have to reason about internal
data ownership. Detect or create a character once, store it in one obvious
canon home, and expose deeper options (sheets, linked lore documents) from that
record when they become relevant. Likewise, let prose initiate an item or
state workflow while deterministic application code keeps reusable canon,
mechanics definitions, and scene-scoped state changes correctly separated.

## Fiction-First Product Boundary

Fiction is the shipping product. Nonfiction remains a parked, separate future
product:

- Shared infrastructure is allowed; domain workflows, copy, and packaging stay
  product-specific. No mode-specific business rules in shared services.
- Nonfiction work stays on isolated spike branches until an explicit go
  decision backed by market validation; it must never create fiction release
  timeline risk.
- Treat Fiction and Nonfiction as separate SKUs with separate messaging,
  onboarding, and pricing hypotheses.

## UI Language and Accessibility Guardrails

Apply these when touching any surface; do not run them as a big-bang rewrite.

Language:

- Use author-facing language; never expose storage terms (`entity`, `schema`,
  `field key`, `upsert`, `record`) in primary workflows.
- Prefer direct verbs: `Create character`, `Import profile`, `Save changes`.
- Keep AI language author-controlled: draft, suggest, expand, review. Never
  imply autonomous writing or background mutation.
- Copy must not imply rulesets/sheets/stats are part of the default fiction
  workflow.
- When touching high-churn system copy, extract it into the typed app-copy
  module rather than leaving new hardcoded strings; defer a full i18n
  framework until multi-locale is a real requirement.

Accessibility baseline:

- Every modal, drawer, and overlay traps focus and restores it on close;
  Escape closes.
- Every form control has a programmatic label; validation errors render
  inline, never via native `alert()`/`confirm()`.
- Keyboard-only navigation must work for primary nav, command palette, World
  Bible review queue, workspace drawers, and import dialogs.
- Verify visible focus states and contrast in both themes; respect
  reduced-motion preferences; use `aria-live`/`role="status"` for
  post-action feedback.
- The product remains operable at the mobile breakpoint.

## Design System (Style Bible)

Consult this before creating or altering UI, CSS, layout, or component
styling. Use existing CSS variables from `apps/web/src/styles/theme.css`; do
not hardcode colors or invent one-off component variables. If a token is
missing, use the closest existing token or add shared theme tokens
deliberately.

### Core aesthetic

Warm, tactile, distraction-free — a modern digital writer's desk. Heavy use of
rounded corners (10–16px containers, 12px buttons, 999px pills/badges). Nearly
all surfaces, panels, and inputs use a soft 1px border
(`var(--surface-border-soft)` or `var(--color-border)`) instead of harsh drop
shadows.

### Color tokens

- Backgrounds: `--color-bg-primary` (app), `--color-bg-secondary`
  (sidebar/nav), `--surface-panel` (cards/panels), `--surface-panel-elevated`
  (modals, chat, floating elements).
- Text: `--color-text-primary`, `--color-text-secondary` (muted/helper).
- Accents: `--color-accent` (primary brand blue), `--color-focus` (keyboard
  focus outline).
- Editor canvas: `--editor-surface-bg`, `--editor-text-color`.

### Components

Buttons: 12px radius, 1px solid border matching the variant, slight
`translateY(-1px)` plus background change on hover. Variants: default
(`--button-bg`/`--button-text`/`--button-border`), primary earthy green/sage
(`--button-primary-*`), secondary warm taupe (`--button-secondary-*`), danger
soft red (`--button-danger-*`).

Inputs: 10px radius, `--input-bg` background, `--input-border` border. Focus:
`outline: none`, border switches to `--input-border-focus`, 3px soft focus
ring via `box-shadow` with `color-mix`. Checkboxes are custom-styled, turning
`--color-accent` when checked.

Badges/pills/chips: `border-radius: 999px`, 1px solid border, tight padding
(~`0.2rem 0.5rem`), small font (12px / `--font-size-sm`), weight 600–700.

Chat/AI interface: user messages max-width 80% aligned right, styled like a
primary button; AI messages max-width 80% aligned left, styled like a surface
panel with soft border.

Feedback placement (toast versus inline): transient confirmations ("Scene
saved.", "Source Note created.") post to the single app-shell toast viewport
via the notification store (`RouteFeedback` bridges a route's local feedback
state; `pushToast` for direct use), so every route reports success in one
predictable place: bottom-right, `aria-live="polite"`, auto-dismissed after
four seconds, identical repeats replaced rather than stacked. Errors that
belong to a control stay anchored beside it as an `InlineAlert`; only
Workspace, whose feedback was always a toast, sends errors to the viewport too
(sticky, with a Dismiss control). Routes do not render their own transient
banners. Async work with no visible confirmation of its own (autosave,
consistency review refresh, extraction, project storage migration, AI
streaming) announces through the shell's one shared status live region via
`useStatusAnnouncement` / `announceStatus`; do not add per-component
`aria-live` regions for that. Validated fields carry `aria-invalid` and
`aria-describedby` pointing at their inline error text.

Error text: rendered error strings go through `describeError(error, fallback)`
(`services/errors`), never `error.message` directly. The helper keeps the
app's own plain-language validation messages, maps known failure classes
(network, provider key, provider limit or outage, local storage full, project
saved by a newer version, cancelled request) to fixed author-facing sentences,
and returns the caller's fallback for technical noise. The raw error goes to
the console and to the redacted local diagnostics log shown under Settings →
Diagnostics, which the author may copy by hand; nothing is ever transmitted.

### Layout and breakpoints

Desktop: fixed 88px left rail; main content uses
`padding-left: calc(88px + 1.75rem)`. Mobile (`max-width: 900px`): rail
disappears, a fixed bottom bar (`min-height: 66px`) takes over navigation,
modals become bottom-anchored slide-ups with `rgba(15, 23, 42, 0.45)` overlay,
and bottom padding accounts for `env(safe-area-inset-bottom)`.

### Typography

UI text uses `system-ui`. Text representing user-generated worldbuilding
content hooks into `--editor-font-family` and `--editor-line-height`. Tiny
subheadings/section labels use `letter-spacing: 0.04em`–`0.06em` with
`text-transform: uppercase`.

## Near-Term Emphasis

Focus: tighten the writing-first workspace UX, reduce default UI complexity,
soften review and entity interactions, keep import/review flows resilient.

Avoid: pushing users into system configuration early, foregrounding rules/stat
complexity on first load, or letting the pitch sound like a mechanics IDE
before it sounds like a writing tool.
