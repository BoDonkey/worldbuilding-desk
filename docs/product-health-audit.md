# Product Health Audit

Last updated: 2026-06-27

Purpose: reset the next work away from accumulating smoke tests and toward the parts of the product that decide whether the app actually helps authors keep lore consistent over a long manuscript.

## Summary

The current codebase has more lore infrastructure than the UI currently proves. Lore Documents can import, save, extract entity/fact proposals, accept facts, create/link World Bible records, and feed Canon Decisions. RAG indexes scenes, World Bible records, Lore Documents, rules, and accepted canon facts. Shodh memory captures scene, World Bible, ruleset, and accepted canon fact summaries; Lore Documents remain RAG-only source material. Character consistency is currently strongest for names, aliases, age, occupation, and simple contradictions; richer character details such as relationships, goals, heritage, traits, and evolving state now have a selected-character diagnostic surface, but still need realistic cross-chapter evaluation.

The first product-health slices are now implemented on Lore Documents and World Bible character records: Lore Documents exposes RAG document/chunk counts, indexed document type counts, Shodh memory counts, project data counts, and a retrieval probe; World Bible character records expose aliases, accepted facts, linked Lore Documents, scene mentions, Shodh memories, state events, and explicit RAG probe hits for the selected character.

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
- Decide whether Lore Documents need an explicit author-triggered Shodh summary action; they are currently RAG-indexed but intentionally not Shodh-mirrored by default.

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
- Lore Documents now includes an explicit rebuild action that refreshes RAG from saved scenes, World Bible records, Lore Documents, accepted canon facts, and rulesets.
- The health panel shows when to rebuild and only switches to `May need rebuild` when source data counts are greater than indexed RAG counts, keeping the warning local to the diagnostic surface.
- Retrieval probes now require lexical evidence when vector scores are tied, avoiding unrelated fallback results for named searches. The probe is explicitly framed as a capped health diagnostic that shows up to five indexed chunks, and hits can open their source scene, Lore Document, World Bible record, or source Lore Document for accepted facts.
- Assistant RAG context now maps chunk metadata into trust labels before provider prompts are built, distinguishing accepted World Bible canon, accepted canon facts, linked Source Notes, general Source Notes, scene drafts, and rules references.
- RAG search now applies a modest trust-tier ranking boost so accepted canon facts and World Bible records outrank Source Notes when similarity/lexical evidence is otherwise close.

Risks:

- Dev and Cypress use a deterministic one-dimensional embedding fallback, so local smoke can prove indexing calls happen but not prove useful semantic retrieval quality.
- Production falls back to lightweight local embeddings if the transformer model fails, but there is no visible warning or health state for the author.
- Backup/export includes primary project data, but RAG is derived auxiliary storage and is not the source of truth.

Recommended next feature slice:

- Use realistic author material to verify that rebuild makes stale/missing RAG coverage visible and recoverable before adding more diagnostics.

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

- Lore Documents are not captured into Shodh memory by default; accepted canon facts are captured when accepted or rebuilt.
- Shodh memory is summary-based, not semantic retrieval. The assistant combines Shodh chunks and trust-labeled RAG chunks, and assistant answers now expose a collapsed `Sources used` list for the specific Shodh/RAG context sent with that answer.
- There is no stale-memory indicator if a document changes and memory capture fails.

Current diagnostics:

- Lore Documents now shows Shodh memory counts and local-memory counts alongside RAG diagnostics.
- The context rebuild action refreshes Shodh summaries for saved scenes, World Bible records, accepted canon facts, and rulesets, matching the current automatic capture paths.

Recommended next feature slice:

- Audit the accepted-canon-fact Shodh summaries against realistic imported lore, and decide whether Source Notes need an explicit manual summary action beyond RAG indexing.

## Character Detail Consistency

What exists:

- Character canon ownership has moved to `World Bible > Characters`; Character Tools are secondary.
- Name/alias matching is now relatively strong, including full names, short aliases, hyphenated names, and known-lore highlighting.
- Accepted character facts can fill Character Tools fields for `age` and `occupation` when those fields are empty.
- Accepted alias facts create consistency aliases.
- Workspace contradiction review can compare simple assertions like `Name is descriptor` against accepted facts and record fields.
- State mutation ledger/replay can track accepted scene-scoped state changes for rules-heavy character state.
- World Bible character records now include a selected-character health panel that shows aliases, accepted facts, linked Lore Documents, scene mentions across writing documents, Shodh memories tied to the record, state events, and explicit RAG probe hits.

Gaps:

- Relationships, heritage, goals, traits, abilities, and appearance now surface as accepted facts on the character health panel, but they are not yet grouped into a richer character-detail reading view.
- Character Tools still show only a small subset of detail fields in list cards, so accepted character facts can feel hidden unless the author knows where to look.
- Cross-chapter consistency for character details beyond names/simple assertions still needs real author-material evaluation.
- The new health panel surfaces current evidence, but it does not yet explain which specific assistant answer used which RAG/Shodh evidence.

Current diagnostics:

- The selected World Bible character panel reads from primary project records, accepted canonical facts, Lore Document links, writing documents, Shodh memories, the state mutation ledger, and `RAGService.search(...)`.

Recommended next feature slice:

- Use the Lore Documents health panel, context rebuild action, and Character detail health panel to manually audit a realistic imported lore set across import, extraction, accepted facts, assistant context, chapter drafting, and review.

## Documentation Health

Current state:

- The documentation set was consolidated on 2026-07-26.
- `docs/README.md` now separates source-of-truth documents, active domain
  references, work plans, guardrails, smoke procedures, and archive material.
- The active roadmap was reduced to open work; its detailed history is archived
  as `docs/archive/next-steps-through-2026-07-26.md`.
- The architecture reference now contains durable boundaries and current risks;
  its earlier action-review form is archived.
- Completed implementation plans, branch handoffs, dated fitness audits, and
  the stale April release checklist moved out of the active top level.
- Historical review smoke execution notes were separated from the reusable
  smoke procedure.

Decision:

- Keep `PROJECT_STATUS.md`, `docs/next-steps.md`, `docs/README.md`, and `docs/style-bible.md` as the standing source-of-truth set.
- Keep focused checklists in place while their workflows are active.
- Treat older strategy/spec docs as reference, not marching orders, unless promoted in `docs/README.md`.

Ongoing maintenance:

- Keep completion history out of `docs/next-steps.md`.
- Give new proposals and plans an explicit status and date.
- Archive completed execution plans with a replacement note.
- Revisit the larger domain specifications only when their implementation delta
  becomes difficult to distinguish from their stable contract.
