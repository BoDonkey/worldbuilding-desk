# Product Blueprint — Worldbuilding Desk

Last updated: 2026-08-01

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
   consistency review.
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
  and review utilities, settings

Canonical ownership rules:

- Characters, locations, items, factions, creatures, concepts, and custom
  categories live inside World Bible. There is no second equal top-level canon
  home; `Characters`/Character Tools is a secondary tool attached to World
  Bible character records, never the canon owner.
- If a surface is about identity, aliases, canon role, or descriptive editing,
  it belongs to World Bible. If it is about sheets, tracked state, resources,
  or progression, it is a secondary tool attached to a World Bible record.
- New canon anchors default to World Bible; freeform background writing
  defaults to Lore Documents; review completion and alias cleanup stay
  centered in World Bible.
- Items, creatures, and locations gain mechanics only through an explicit
  author action; accepting a detected entity never auto-creates a Compendium
  record.
- Character possession and equipment are not fields on the canonical item;
  they belong to character state and manuscript-time mutation events.
- Optional-system routes stay grouped behind `More` with actionable-state
  badges; general-fiction projects are never framed as incomplete without
  mechanics.

The automagic principle: the author should never have to reason about internal
data ownership. Detect or create a character once, store it in one obvious
canon home, and expose deeper options (sheets, linked lore documents) from that
record when they become relevant.

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
