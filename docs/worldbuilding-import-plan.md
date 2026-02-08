# World-Building Import Expansion Plan

_Last updated: February 8, 2026_

## Goals
1. Support capturing canon from multiple sources (in-app editor, word processor exports, structured data like CSV/JSON).
2. Maintain the existing RAG/Shodh pipelines so imported material is chunked, summarized, and tagged consistently.
3. Give authors clear provenance and reconciliation workflows when the imports overlap with existing canon.

---

## Phase Outline

### Phase A – In-App Editor Enhancements
- **Editor Modes**: extend the current Workspace so writers can mark a document as `scene`, `worldbible`, or `reference` before saving. Route those types through the existing indexing services.
- **Section Templates**: add quick-insert templates (Characters, Locations, History, Rules) to guide structured data capture inside the editor.
- **Bulk Actions**: allow multi-select of scenes/world docs for batch promotion to the series bible.
- **Prompt Layer Controls**: expose per-project system prompt editing plus “style/policy” prompts (e.g., tone presets, "ick words" rules, forbidden words) with the ability to attach them to specific editor documents.
- **Testing**: ensure autosave + Shodh capture continue working when document types change.

### Phase B – Text Processor Imports (DOCX/Markdown)
- **Parser Layer**: integrate a library (e.g., `mammoth` for DOCX → HTML, `gray-matter`/`remark` for Markdown) into a new `DocumentImportService`.
- **Chunk Metadata**: derive titles, headings, and section tags so imported documents land in the correct RAG/Shodh buckets.
- **Wizard UI**: provide a drag-and-drop modal that previews the parsed outline, lets the author assign document types per section, and shows conflicts (existing titles, duplicate IDs).
- **Error Recovery**: log parsing errors per file and offer downloads of the raw text so nothing is lost if a particular converter fails.

### Phase C – Structured Data Imports (CSV / JSON)
- **Schema Detection**: implement adapters for rulesets (CSV) and entity tables. Provide a mapping UI so columns can be aligned with internal fields (name, description, stats, etc.).
- **Validation**: run incoming rows through a lightweight schema check (required columns, unique IDs) before writing to IndexedDB.
- **JSON API**: accept world bible exports in JSON so teams can share canonical datasets without loss of structure.
- **Automation Hooks**: option to run imports via CLI/script in the future; document the expected file formats now to support that evolution.

### Phase D – Provenance & Reconciliation
- **Source Tags**: augment Shodh/RAG metadata with `sourceType` (`editor`, `docx`, `csv`, `json`) and `sourceFile`.
- **Conflict Resolution**: when an imported entry collides with an existing entity/doc ID, offer merge strategies (replace, merge fields, create duplicate).
- **Audit Trail**: store import logs per project so authors can review what changed, undo an import, or re-run with different mapping.

### Phase E – UX Polish & Documentation
- Update the Help/Docs section with a step-by-step guide (with screenshots) describing each import path.
- Record a telemetry-friendly summary (optional) that tracks how many imports succeed/fail (pending your telemetry plan).
- Provide sample templates (Markdown headlines, CSV column layout) inside `docs/import-samples/`.

---

## Open Questions / Follow-Up
- Which file types have the highest priority after DOCX/Markdown? (e.g., Google Docs export, Scrivener)
- How strict should CSV validation be? (hard fail vs. best-effort import with warnings)
- Do we need per-import permission checks before writing to a series bible parent?
- Telemetry: once your plan lands, integrate storage/quota reporting into the import wizard so authors know when they’re nearing limits.

This plan is ready to revisit when development resumes. Let me know which phase to tackle first next session.
