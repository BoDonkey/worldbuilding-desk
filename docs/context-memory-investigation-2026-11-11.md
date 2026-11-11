# Context and Memory Investigation

**Date:** 2026-11-11  
**Status:** Active, non-authoritative investigation for roadmap Slice 1.6  
**Scope:** Current code and deterministic baseline only; no application behavior changed

This report corrects the assumptions in the external `writing-block.md` brief
against the current SagaSpine code. It is working input, not a replacement for
`PROJECT_STATUS.md`, `docs/domain-model.md`, or `docs/architecture-review.md`.

## Executive summary

SagaSpine already has a hybrid context architecture: structured canon and
manuscript-time state, full-text indexed retrieval, a small bundled embedding
model, explicit trust labels, prompt budgeting, and bounded recent
conversation history. It does not need a bundled generative model in order to
have a viable context system.

The weak component is the feature presented as **Project memory**. The
internal `ShodhMemoryService` is not the Shodh associative-memory library. It
stores one derived entry per source containing the first 500 plain-text
characters. The ordinary assistant then selects at most three entries by
literal query-term overlap. This duplicates indexed context while omitting
events later in a scene and carrying no narrative-time interpretation.

The deterministic baseline confirms that indexed context retrieves a crucial
end-of-scene detail that project memory omits. It also shows project memory
selecting an earlier “were enemies” extract alongside the indexed later
“became allies” event. Both derived stores correctly replace a revised scene,
and project-scoped databases isolate same-named characters. Ordinary assistant
history drops older turns under pressure instead of summarizing them.

Decisions from this investigation:

1. Do not bundle a generative LLM now.
2. Schedule author-visible rolling summaries for the ordinary assistant after
   its 3.32 seam is stable, reusing the Character Lab trust pattern.
3. Do not replace project memory with generated scene digests in production
   yet. First run a source-linked digest pilot against a representative corpus
   using an already installed local model and compare it with indexed context.
4. Treat the current 500-character memory as a rebuildable derived hint, never
   as canon or a reliable scene summary.

## Observed architecture

### Save and rebuild path

When a scene is saved, the primary writing record is authoritative. The save
path then rebuilds two derived representations for that scene:

- `RAGService.indexDocument` normalizes the full scene, divides it into
  overlapping chunks of roughly 1,000 characters, embeds each chunk, and
  replaces prior chunks for the document.
- `ShodhMemoryService.captureAutoMemory` deletes prior entries for the
  document and stores the first 500 plain-text characters as one memory.

World Bible records, accepted canon facts, and rules also feed these derived
stores. Source Notes feed indexed context but not project memory. Deletion and
context rebuild use the same project-scoped derived-store boundaries.

The production embedding path ships `Xenova/all-MiniLM-L6-v2` quantized to q8
and configured for local-only loading through Transformers.js. Development,
Cypress, and load failure use the deterministic lightweight fallback.

### Ordinary assistant prompt

For a creative request, the assistant assembles:

1. The author's selected text, when present.
2. Up to three project-memory entries: current-document entries first, then
   query-term matches.
3. Up to three indexed-context results ranked by vector similarity, lexical
   score, and source trust.
4. Explicitly requested pending proposals.
5. Recent completed conversation turns within 25% of model context, bounded
   to 512–6,000 estimated tokens.
6. Base instructions and author-selected Prompt Tools.

The context budget gives highest priority to author selection, canonical
records, and accepted facts, followed by state and source material. The UI
records sources kept and left out. A factual request takes a safer branch:
deterministic resolvers answer when possible, and otherwise the evidence gate
refuses to let a provider invent an answer.

### Character Lab

Character Lab does not rely on project memory for its principal grounding. It
builds structured context from the selected character's World Bible record,
accepted facts valid at the selected manuscript position, dialogue style,
replayed state, and optionally one-hop linked records.

Its Talk mode already implements the desired rolling-summary trust pattern:

- offer summarization when conversation reaches 35% of model context;
- keep the two latest exchanges verbatim;
- cap the summary at 200 words / 2,000 characters;
- show it to the author and allow editing;
- label it as session-only and non-canon.

The summary request currently uses the configured project generation model,
not a dedicated small model or the optional routine-check override.

## Corrections to the source brief

| Brief assumption | Current code |
|---|---|
| Embedding or vector retrieval may not exist | A bundled local embedding model and hybrid vector/lexical ranking are implemented. |
| Shodh cognitive memory is already in use | Only the internal service name remains; no Shodh library, association, reinforcement, consolidation, importance, or decay exists. |
| Chapter summaries sometimes fail | There is no general chapter-summary pipeline. Project memory truncates; Character Lab summary is author-invoked. |
| Persona conversations persist long term | Character Lab transcripts and summaries last for the current app session only. |
| Story and persona memory may cross unexpectedly | Current paths are keyed by project and, in Character Lab, character. No current cross-project path was found. Explicit parent-project inheritance is separate and deliberate. |
| Memory extraction requires an LLM | Project auto-memory is deterministic. Only Character Lab rolling summaries call a generative model. |
| A separate memory model may exist | It does not. |
| Retrieval may be model-initiated | Current retrieval is application-initiated. The model receives selected context; it does not call project-memory tools. |
| Revision behavior is unknown | Saving replaces both derived representations for the scene; deletion removes them. Canon facts and structured state additionally support manuscript-time resolution. |

## Deterministic baseline benchmark

The repeatable harness is
`apps/web/src/services/contextHealth/contextMemoryBaseline.test.ts`.
It runs the real `RAGService`, `ShodhMemoryService`, query-term extraction,
and assistant history selector over isolated fake IndexedDB databases.

Run:

```bash
pnpm --filter web exec vitest run src/services/contextHealth/contextMemoryBaseline.test.ts
```

Initial result on 2026-11-11: **5/5 tests passed in 13 ms test time**
(747 ms process duration). These timings use fake IndexedDB and the development
embedding fallback; they demonstrate deterministic repeatability, not packaged
embedding or model-generation latency.

| Case | Indexed context | Project memory | Finding |
|---|---|---|---|
| Distant/end-of-scene detail | Retrieved “beneath the chapel bell” | Omitted it | The 500-character prefix is not a scene summary. |
| Relationship changes | Retrieved later “became allies” event | Selected earlier “were enemies” extract and omitted later event | Memory can add temporally obsolete context beside correct retrieval. |
| Revised history | Replaced old scene chunk | Replaced old prefix; exactly one memory remained | Derived invalidation works on the normal save path. |
| Project isolation | Returned only each project's version of Mara | Separate project databases | Isolation held for same-named characters. |
| Conversation pressure | Not applicable | Not applicable | Ordinary assistant history omitted older complete turns and produced no summary. |

The harness deliberately measures source selection rather than asking a model
whether it remembers correctly. A future digest pilot must add evidence recall,
unsupported-claim rate, context tokens, packaged/local latency, and revision
invalidation. Generation quality and retrieval quality must remain separate
measurements.

## Do we need a small embedded generative model?

Not yet. A small generator could be useful for scene-event extraction and
conversation compression, but bundling it would add weights, runtime memory,
GPU/WASM compatibility work, lifecycle management, licensing, and contention
with the author's already loaded writing model. Model size alone does not
establish faithful narrative summarization.

The first pilot should use a named `memory-extraction` route to an already
installed private-local model. That route should be distinct from the current
“cheaper model for routine checks” string because the latter follows the
project's selected provider and therefore may be hosted. No compatible local
Ollama server was running during this investigation, so no model output was
used and no model was downloaded.

If a later benchmark shows that an installed local model cannot provide a
usable zero-setup experience, evaluate a bundled quantized generator on the
supported macOS and Windows packaged applications. The acceptance gate should
be corpus results and peak resource use, not a model card or parameter count.

## Recommended follow-up boundaries

### Ordinary assistant rolling summaries

This is supported by current evidence: older turns are dropped, while the
Character Lab pattern already provides bounded, visible, editable,
non-canonical compression. The implementation should keep recent turns
verbatim, never silently overwrite the transcript, and invalidate or refuse a
replacement when the source conversation changes during generation.

This work should wait until the relevant Workspace assistant/context seam in
3.32 is stable.

### Source-linked scene digest pilot

This is an experiment, not yet a production feature. Candidate digest fields:

- events and decisions;
- participants;
- state changes;
- information learned by named characters;
- promises and unresolved threads;
- exact supporting source spans.

Every digest must carry project id, scene id, source revision/hash, model and
route provenance, and validation status. Deterministic code must validate the
schema, evidence spans, referenced entities, bounds, and source revision.
Editing the scene invalidates the digest. A digest remains derived and
non-canon; it cannot write to canon, mechanics, or state.

Compare the pilot against indexed context alone and the current prefix memory.
Do not promote it unless it improves relevant-evidence recall without an
unacceptable unsupported-claim or stale-context rate.

### Dedicated extraction route

Add only with the digest pilot. It should select an explicit local model,
bounded output, structured schema where supported, no thinking, no cache, and
on-demand lifecycle. Failure must leave the authoritative project unchanged
and fall back to indexed context.

### Bundled generator

Deferred. Revisit only after the pilot demonstrates value and a separately
installed local model is shown to be an unacceptable product dependency.

## Open questions

1. Should project memory remain author-visible if its automatic entries are
   only prefixes, or should the UI distinguish manual memory from derived
   extracts?
2. Should conversation summaries survive app restart, or remain session-local
   like Character Lab summaries?
3. What representative fiction corpus can be stored as a regression fixture
   without introducing rights or privacy problems?
4. What unsupported-claim rate is acceptable for a derived digest that is
   never canon but may influence creative generation?
5. Should a digest summarize each scene independently, or additionally build
   chapter-level views from source-linked scene digests without recursively
   summarizing prose summaries?

## Verification

Completed 2026-11-11:

- Slice baseline: 5/5 deterministic context-memory tests.
- CI policy: 16/16 tests.
- File-size gate: passed; no over-baseline file grew.
- Lint: 0 errors, one documented existing `ConsumableEffectEditor` hook
  dependency warning.
- Unit tests: 1,435 web, 52 rules-engine, 12 rules-ui, 54 desktop.
- Web and desktop builds: passed.
- Full browser tier selected from the cumulative branch diff: 41/41 specs,
  188/188 tests, no retries.

The first two Cypress invocations ran zero specs because the sandboxed Vite
server was not reachable at the configured address. The recorded full run used
the externally reachable `http://localhost:5174` binding and passed; those
startup attempts are not test retries.

