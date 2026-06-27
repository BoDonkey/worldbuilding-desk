# Product Health Audit

Last updated: 2026-06-27

Purpose: reset the next work away from accumulating smoke tests and toward the parts of the product that decide whether the app actually helps authors keep lore consistent over a long manuscript.

## Summary

The current codebase has more lore infrastructure than the UI currently proves. Lore Documents can import, save, extract entity/fact proposals, accept facts, create/link World Bible records, and feed Canon Decisions. RAG indexes scenes, World Bible records, Lore Documents, rules, and accepted canon facts. Shodh memory captures scene, World Bible, and ruleset summaries, but not Lore Documents or accepted canon facts. Character consistency is currently strongest for names, aliases, age, occupation, and simple contradictions; richer character details such as relationships, goals, heritage, traits, and evolving state are present as accepted facts or state events but are not yet a coherent author-facing character-detail experience.

The first product-health slice is now implemented on Lore Documents: the route exposes RAG document/chunk counts, indexed document type counts, Shodh memory counts, project data counts, and a retrieval probe.

## Current Source Of Truth

- `PROJECT_STATUS.md`: current product/engineering snapshot.
- `docs/next-steps.md`: active roadmap and branch order.
- `docs/README.md`: documentation map and doc authority.
- `docs/style-bible.md`: UI/styling authority.

Everything else should be treated as supporting context, a focused checklist, or historical reference unless `docs/README.md` says otherwise.

## Lore Documents Health

What exists:

- `apps/web/src/routes/LoreRoute.tsx` imports files, saves Lore Documents, links them to World Bible records, extracts entity proposals, extracts fact proposals, accepts/rejects proposals, and shows accepted canon from the current document.
- Lore Documents are indexed into RAG on save via `indexLoreDocument(...)`.
- Accepted facts are saved as `CanonicalFact` records and indexed into RAG as `canon_fact` documents.
- Accepted facts can apply limited side effects through `applyCanonicalFactSideEffects(...)`.
- Entity proposals can create or link World Bible records through `acceptLoreEntityProposal(...)`.
- Cypress coverage exists for manual Lore Document lifecycle, dossier import/extraction, linked World Bible records, accepting facts for multiple linked records, Canon Decisions fact conflicts, and Canon Decisions entity aliasing.

Gaps:

- The Lore Documents tab still has not been judged with realistic author material: multiple chapters, dossiers, partial notes, contradictions, and repeated character references.
- Lore Documents are not mirrored into Shodh memory, so the memory panel can underrepresent important source notes even when RAG has indexed them.
- Accepting an entity proposal creates/links canon, but the accepted entity path itself does not visibly explain whether the new/linked record is now indexed, remembered, or usable by assistant context.
- Accepted facts are visible in the Lore Document review section, but there is no product-level view that answers: "What did this source note change in canon?"

Recommended next feature slice:

- Use the new Lore Documents health panel to manually audit a realistic imported lore set through: import -> extract -> accept/link -> ask assistant -> write chapter -> run review.
- Decide whether Lore Documents should also auto-capture Shodh summaries, since they are currently RAG-indexed but not Shodh-mirrored.

## RAG Health

What exists:

- `RAGService` stores chunks in an IndexedDB database named `rag-${projectId}`.
- Indexed document types include `scene`, `worldbible`, `lore`, `rule`, and `canon_fact`.
- Workspace scenes are indexed after save in `useWorkspaceConsistency`.
- World Bible records are indexed from World Bible entity actions/import paths.
- Lore Documents are indexed on save in `LoreRoute`.
- Accepted canon facts are indexed from Lore and Canon Decisions.
- Rulesets are indexed from `rulesetService`.
- Project deletion deletes the auxiliary `rag-${projectId}` database.

Current diagnostics:

- Lore Documents now shows RAG document/chunk counts, counts by indexed document type, and a retrieval probe powered by `RAGService.search(...)`.

Risks:

- There is no in-app way to inspect whether RAG is populated, stale, or missing document types.
- Dev and Cypress use a deterministic one-dimensional embedding fallback, so local smoke can prove indexing calls happen but not prove useful semantic retrieval quality.
- Production falls back to lightweight local embeddings if the transformer model fails, but there is no visible warning or health state for the author.
- Backup/export includes primary project data, but RAG is derived auxiliary storage and is not the source of truth.

Recommended next feature slice:

- Add a rebuild action from source project data if the health panel exposes stale or missing index coverage during manual audit.

## Shodh Memory Health

What exists:

- `ShodhMemoryService` stores project memories in `shodh-memory-${projectId}`.
- Scene saves auto-capture a 500-character summary.
- Workspace can capture manual scene memory.
- World Bible saves auto-capture record summaries.
- Rulesets auto-capture summaries.
- Series/child projects can inherit parent Shodh memories.
- Project deletion deletes the auxiliary Shodh database.

Gaps:

- Lore Documents and accepted canon facts are not captured into Shodh memory.
- Shodh memory is summary-based, not semantic retrieval; the assistant combines Shodh chunks and RAG chunks, but there is no UI to explain what context was used.
- There is no stale-memory indicator if a document changes and memory capture fails.

Current diagnostics:

- Lore Documents now shows Shodh memory counts and local-memory counts alongside RAG diagnostics.

Recommended next feature slice:

- Add memory provenance to assistant context so authors can see which Shodh/RAG context was used in an answer.
- Decide whether Lore Documents should auto-capture Shodh summaries or remain RAG-only.

## Character Detail Consistency

What exists:

- Character canon ownership has moved to `World Bible > Characters`; Character Tools are secondary.
- Name/alias matching is now relatively strong, including full names, short aliases, hyphenated names, and known-lore highlighting.
- Accepted character facts can fill Character Tools fields for `age` and `occupation` when those fields are empty.
- Accepted alias facts create consistency aliases.
- Workspace contradiction review can compare simple assertions like `Name is descriptor` against accepted facts and record fields.
- State mutation ledger/replay can track accepted scene-scoped state changes for rules-heavy character state.

Gaps:

- Relationships, heritage, goals, traits, abilities, and appearance can become accepted canon facts, but they do not yet become an obvious character-detail surface.
- Character Tools still show only a small subset of detail fields in list cards, so accepted character facts can feel hidden unless the author knows where to look.
- There is no single character consistency view that answers: "What does the app currently believe about this character across chapters, Lore Documents, World Bible, and state?"
- Cross-chapter consistency for character details beyond names/simple assertions still needs real author-material evaluation.

Recommended next feature slice:

- Build a Character Detail Health view for one selected World Bible character: canonical name, aliases, accepted facts grouped by type, linked Lore Documents, scene mentions, Shodh memories, RAG probe hits, and state events.

## Documentation Health

Current state:

- There are many docs because the project has kept implementation plans, smoke checklists, product decisions, architecture notes, and research artifacts together.
- `docs/archive/` already contains older material, but top-level docs still mix active roadmap, active checklists, and older plans.

Decision:

- Keep `PROJECT_STATUS.md`, `docs/next-steps.md`, `docs/README.md`, and `docs/style-bible.md` as the standing source-of-truth set.
- Keep focused checklists in place while their workflows are active.
- Treat older strategy/spec docs as reference, not marching orders, unless promoted in `docs/README.md`.

Recommended next docs slice:

- After the product-health feature pass, archive or demote stale top-level docs that are not listed in `docs/README.md`.
