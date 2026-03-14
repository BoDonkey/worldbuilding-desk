# Import Pipeline v2

## Problem Statement
Current import behavior in `WorkspaceRoute` is too tightly coupled to consistency extraction and unresolved-entity handling. This creates a poor author experience:

- Import can feel blocked or unclear even when text parsing succeeded.
- Authors can be forced into compendium/consistency workflows they did not ask for.
- Unknown-entity handling can produce long lists with no efficient bulk decision path.
- `.pages` (Apple Pages) input is not explicitly supported and fails silently from an author perspective.

## Goals

- Import should always result in visible scene text when parsing succeeds.
- Authors should choose strictness at import time (strict vs. flexible workflows).
- Unknown entities should be manageable in bulk and deferrable.
- Consistency checks should remain available without forcing immediate resolution.
- Provide a pragmatic path for Apple Pages users.

## Non-Goals

- Full native fidelity parser for all `.pages` variants.
- Replacing the existing consistency engine.
- Automatic perfect entity linking during import.

## Import Modes

### 1) Strict
- Run consistency extraction during import.
- Block final commit of imported scenes when unresolved entities exist.
- Intended for users who prioritize canonical rigor over speed.

### 2) Balanced (Default)
- Import always saves scenes and opens the latest imported scene.
- Run consistency extraction post-import and queue unresolved entities as warnings.
- Author can continue writing immediately.

### 3) Lenient
- Import only.
- Skip automatic consistency extraction at import time.
- Allow optional manual review later.

## Pipeline Stages

1. Parse file input
- Supported now: `.txt`, `.md`, `.markdown`, `.html`, `.htm`, `.docx`
- Supported now (best effort): `.pages` preview extraction + fallback guidance.

2. Persist scenes
- Always write parsed scenes to storage on successful parse.
- Set current editor scene to last imported file by default.

3. Optional consistency pass
- Controlled by selected import mode and settings.
- Generate warnings/issues without blocking in Balanced/Lenient.

4. Present import summary
- Show imported count, failed count, unresolved count.
- Include explicit “Continue writing” behavior.

5. Review queue (if applicable)
- Unknown entities become review items (non-blocking by default).

## Unknown Entity UX

### Bulk Actions
- `Accept all as new entities`
- `Dismiss all for now`
- `Ignore all from this import` (batch-level suppression)

### Per-Item Actions
- Create entity
- Link alias to existing entity
- Dismiss

### Behavior
- In Balanced mode, unresolved issues remain warnings and do not block editing.
- In Strict mode, unresolved issues can block commit/publish-style actions.

## Apple Pages (`.pages`) Strategy

### Primary approach
- Attempt best-effort text extraction from the `.pages` package/zip format when available.

### Fallback path
- If extraction fails, show clear actionable guidance:
  - “Export as `.docx` or `.txt` from Pages, then import.”
- Do not imply successful import when no text was recovered.

## Settings + Per-Import Overrides

### Project-level defaults
- `Default import mode` (`Strict` / `Balanced` / `Lenient`)
- `Run consistency after import` (boolean)
- `Block on unknown entities` (boolean)

### Import modal overrides
- Mode selector for current batch.
- Toggle to skip consistency for this import only.

## Success / Error Messaging

### Success (parse + persist)
- “Imported X scene(s). Opened: <title>. Unresolved entities: Y.”

### Partial success
- “Imported X scene(s); Y failed.”
- Include reason examples (unsupported format, parse failure).

### Failure
- No scenes persisted only when all files failed parsing.
- Provide explicit reasons and next actions.

## Data Model / State Changes (Expected)

- Import session summary object (ephemeral UI state):
  - `importedCount`, `failedCount`, `unresolvedCount`, `mode`, `files[]`
- Optional batch identifier for unresolved items:
  - allows “ignore this batch” behavior.

No immediate required schema migration is expected if unresolved queues remain derived from existing consistency output and local UI state.

## Rollout Plan

### Step 1
- Add import mode selector and decouple scene persistence from consistency blocking.

### Step 2
- Add import summary panel and guaranteed post-import editor focus.

### Step 3
- Add bulk unknown-entity actions.

### Step 4
- Add `.pages` best-effort extraction + fallback UX.

### Step 5
- Add settings defaults and per-import overrides.

## QA Checklist

### Happy Paths
- Import `.txt` -> scene opens immediately, text visible.
- Import `.docx` -> scene opens immediately, text visible.
- Balanced mode with unknown entities -> warnings shown, writing unblocked.
- Lenient mode -> no auto consistency run.
- Strict mode -> unresolved issues enforced as designed.

### Bulk Unknown Handling
- Accept all creates entities and clears queue.
- Dismiss all clears queue for current review.
- Ignore batch suppresses repeated prompts for same batch.

### Apple Pages
- `.pages` extract success -> scene created.
- `.pages` extract failure -> clear fallback guidance shown.

### Regression Checks
- Existing manual consistency review still works.
- Existing save/autosave behavior unchanged.
- Existing export behavior unchanged.
