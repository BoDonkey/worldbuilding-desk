# Current State: Stat Blocks in Workspace

## What shipped
- Added a writer-friendly **Status Block Builder** modal in the Writing Workspace.
- Added support for two insertion modes:
  - **Live block now** (renders stats/resources immediately)
  - **Reusable placeholder** (`{{STAT_BLOCK:...}}` token)
- Added placeholder refresh action:
  - **Refresh Placeholders** replaces matching `STAT_BLOCK` tokens with fresh rendered content.
- Added project-level saved preferences for:
  - Source type (`character` or `item`)
  - Style (`full`, `buffs`, `compact`)
  - Insert mode (`block`, `template`)
- Added mode-aware behavior:
  - **LitRPG mode** auto-resolves placeholder intent into live inserted text.
  - **Game/General modes** can keep reusable placeholders.

## Current behavior (important)
- Placeholder format is writer-friendly by default:
  - Example: `{{STAT_BLOCK:character:Aria:compact}}`
- Token resolution supports both:
  - Name-based references (preferred for writers)
  - ID-based references (backward compatibility)
- If no token matches at refresh time, user gets a clear status message.

## Testing status
- Web build passes.
- Lint passes.
- Cypress smoke suite includes coverage for:
  - Rendered stat block insertion
  - Placeholder insertion + refresh flow

## Known limits
- Placeholders are still plain text in-editor (not yet rendered as visual chips/components).
- Refresh is currently manual via button, not automatic on save/open.
- Name-based token matching may be ambiguous if multiple entities/sheets share identical names.
- LitRPG mode forces live insertion for readability; token persistence in LitRPG is intentionally blocked in UI.

## Recommended next steps
1. Render placeholders as inline chips so writers are not exposed to raw token syntax.
2. Add optional auto-refresh policy (for example on save, on open, or both).
3. Add duplicate-name disambiguation for token generation and resolution.
4. Add small UX copy/help tooltip in the modal clarifying when to use placeholders vs live blocks.
