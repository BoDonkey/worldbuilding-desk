# RAG + Shodh Memory Notes

- RAG databases live in IndexedDB per project: `rag-{projectId}` with a `chunks` store and indexes for document + type.
- Chunking now normalizes HTML -> text, slices ~1000 chars with ~120 char overlap, and respects paragraph/sentence boundaries when possible.
- Embeddings are computed locally via `@xenova/transformers` (`all-MiniLM-L6-v2`). No network calls or API keys required.
- Entity metadata: call `ragService.setEntityVocabulary([{ id, terms[] }])` to seed alias lookups. `indexDocument` auto-detects entity IDs in each chunk and stores them in metadata for later filtering.
- Available document types today: `scene`, `worldbible`, `rule`. Tags are optional and can be used to scope searches (e.g. category slug for World Bible entries).
- Shodh memory prototype: see `ShodhMemoryService`. `captureAutoMemory` trims each document to a 500-character summary and stores it in `shodh-memory-{projectId}` for future surfacing.
- Auto-ingestion points:
  - Scenes (Writing Workspace) → RAG + Shodh automatically on save/delete.
  - World Bible entities → RAG on save/delete with category tags.
  - Rulesets → RAG whenever `saveRuleset` runs.

To add manual “Extract memory” controls later, wire a button to `shodhService.addMemory()` using user-supplied summaries, and surface `listMemories()` in the UI.
