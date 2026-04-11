1# Current State: Stat Blocks in Workspace

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

## Implementation decisions for next pass

### 1) Chip rendering
- Do **not** convert placeholders directly into live stat HTML inside the editor as the chip solution.
- Keep placeholder semantics as a distinct inline representation so templates remain editable/reusable.
- Best fit for the current editor stack:
  - Add a dedicated TipTap inline stat-block token node or equivalent editor decoration.
  - Parse existing `{{STAT_BLOCK:...}}` syntax on load/paste.
  - Render a pill/chip label such as `Stat Block: Aria · Compact`.
  - Preserve the underlying token payload so save/load stays lossless.
- If using a node instead of a pure decoration, store the raw token payload in node attributes and teach stat-block refresh utilities to recognize both:
  - legacy raw token text
  - chip/node HTML representation

### 2) Auto-refresh policy
- Current `Refresh Placeholders` behavior is destructive:
  - it replaces template tokens with static rendered HTML
  - after refresh, the document no longer contains a reusable placeholder
- Because of that, **do not** add save/open auto-refresh on top of the current replacement flow.
- First decide between these two models:
  - **Template-preserving preview model**: chips remain canonical; refresh updates only chip preview/metadata and export/render paths resolve to live blocks.
  - **One-way conversion model**: refresh intentionally burns placeholders into static prose blocks.
- Recommended choice: **template-preserving preview model**.
- After that model is in place, add a stored project preference for refresh policy:
  - `manual`
  - `onOpen`
  - `onSave`
  - `onOpenAndSave`
- Hook points already exist:
  - document open via `handleSelectDocument`
  - manual save via `handleSave`
  - autosave via the existing 800ms autosave effect
- Treat autosave separately from explicit save. Default should remain `manual` until the preview-preserving flow exists.

### 3) Token disambiguation
- Current resolution is first match by `id`, then first case-insensitive name match.
- That is fine for backward compatibility but unsafe for duplicate names.
- Recommended token payload change for newly inserted placeholders:
  - keep a writer-readable label
  - also persist a stable source id
- Example direction:
  - visible chip label: `Aria`
  - canonical token payload: `sourceId=<sheet-id>;label=Aria`
- Resolution order should become:
  1. stable id match
  2. exact normalized label match when unique
  3. unresolved/ambiguous state shown on the chip with a clear action
- For legacy name-only tokens:
  - preserve current behavior
  - when duplicate matches appear, do not silently choose one
  - surface an ambiguous-state chip and prompt the writer to rebind it

### Suggested build order
1. Add token metadata shape that supports stable ids plus human-readable labels.
2. Add chip rendering in the editor while preserving existing raw-token compatibility.
3. Make refresh/token-resolution understand the new metadata and ambiguous states.
4. Add project-level refresh policy only after placeholder-preserving refresh exists.
5. Expand Cypress coverage for duplicate-name tokens, chip rendering, and policy-triggered refresh behavior.
