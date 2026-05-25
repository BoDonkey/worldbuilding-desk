# Character / Cast UI Parity Checklist

Target reference: `codex/review-completion-state` character tab.

## Why the Current UI Differs

- Character rich fields currently use `WorldBibleRichTextField`, which wraps `TipTapEditor` in a compact World Bible field shell.
- The writing workspace uses the larger workspace editor composition with workspace-specific controls, context, and document ergonomics.
- The reference branch character UI did not feel like the workspace editor either; it felt like a character dossier/editor surface with softer panels, rounded form controls, explicit task cards, and section-level workflows.
- The current World Bible/Cast implementation inherited generic World Bible ordering and layout, so it is correct for canon ownership but not yet visually or structurally faithful to the reference character tab.

## Exact Visual / Layout Targets

- The Cast view must not show a persistent right rail/list while editing.
- Default Cast landing should show the three task cards in this order:
  1. Manual Character
  2. Import Character
  3. AI-Assisted Draft
- Task cards should use the reference card feel:
  - elevated soft panel background
  - rounded panel corners
  - compact title and supporting copy
  - one primary action per card
- Character editor should be one main panel, not a generic World Bible two-column editor.
- The character editor panel should use the reference branch form-panel feel:
  - rounded panel, soft border, subtle elevated background
  - constrained width
  - grouped fields with consistent spacing
  - bottom action row separated from content
- Character list should only appear when not focused on an authoring/import/review task.

## Target Field Order

For the general-fiction Cast editor, fields should appear in this order:

1. Header: `New Character` / `Edit Character`
2. Identity row:
   - Name
   - Age
   - Role
3. Description rich field
4. Description actions:
   - AI Assist
   - Suggest Expansion
5. Dialogue Style selector only if the existing style system remains relevant in this surface
6. Notes rich field
7. Notes actions:
   - AI Assist
   - Review Notes
8. Custom character sections, in author-defined order
9. Add Section affordance
10. Canon/alias controls, visually secondary:
   - Alternative names
   - duplicate/merge/canonical overlap guidance
11. Character Coach / AI discussion area, future AI slice
12. Bottom actions:
   - Save/Create
   - Cancel

## Custom Sections

- Add Section must create a reusable rich text section on the Characters category schema.
- Added sections should render as first-class rich fields, not as plain textareas.
- Added sections should appear after Notes and before secondary canon controls.
- Suggested examples: Education, Traumas, Addictions, Relationships, Voice, Secrets, Wounds, Motivations.
- Section keys should be generated from the label, de-duped, and hidden from the author-facing UI.

## Import / Paste Flow

- Import Or Paste remains route-local to World Bible/Cast for general fiction.
- Import review should preserve the reference branch feel:
  - Review source in a focused panel
  - Extracted identity fields visible
  - Extracted sections listed with destination controls
  - Draft content lands in rich fields before save
- Import section destinations should support:
  - Description
  - Notes
  - Any custom character section
  - Ignore

## Toolbar Parity Decision

- Do not blindly make character fields look like the workspace editor.
- Instead, make all rich character fields use one consistent character-field toolbar.
- If we keep `TipTapEditor`, style its toolbar inside character fields to match the reference character dossier feel:
  - compact
  - visually quieter than workspace
  - consistent across Description, Notes, and custom sections
- If workspace toolbar behavior is desired later, extract a shared editor-toolbar variant rather than duplicating workspace-only controls.

## Guardrails

- General fiction should still not expose sheets, ruleset, compendium, runtime modifiers, or game-system controls.
- Canonical names, aliases, and merge decisions remain owned by World Bible.
- `/characters` should continue routing general-fiction projects to World Bible/Cast.
- Character sheets remain available only behind project capabilities.
- Any UI reordering must preserve rich text persistence, alias handling, import behavior, and review queue behavior.
- Fresh copy, rounded-system-language, i18n readiness, and accessibility work should follow `docs/ui-language-i18n-a11y-audit.md`.

## Implementation Slices

1. Done: reorder the Cast editor to match the target field order.
2. Done: move Alternative names and overlap review into a secondary canon section below authoring fields.
3. Done: render custom sections after Notes and update import destination choices to include them.
4. Done: tune Cast/editor CSS toward the reference branch card/panel feel using the shared style-bible tokens.
5. Decide and implement the character rich-field toolbar variant.
6. Restore AI-Assisted Draft into this final Cast surface.
7. Add Cypress checks for field order, no persistent rail, custom section persistence, and import-to-custom-section.
