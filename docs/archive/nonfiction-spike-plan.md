# Nonfiction Spike Plan

Last updated: 2026-02-26

## Objective

Evaluate whether a nonfiction-focused variant is commercially and technically viable, without disrupting the fiction MVP roadmap.

## Non-Disruption Guardrails

1. All nonfiction experiments stay on branch `codex/nonfiction-spike`.
2. No required refactors to fiction feature code during spike.
3. No merge to `main` until explicit go decision.
4. Spike work can be paused at any time with no impact on MVP delivery.

## Spike Scope (Thin Vertical Slice)

Build a small proof in `apps/web` or a spike folder that can:

1. Ingest 1-3 source docs (start with plain text/clean markdown, optional PDF later).
2. Chunk text and persist chunk metadata:
- `sourceId`
- `sourceTitle`
- `chunkId`
- location marker (page/section/offset)
3. Submit a user claim and run retrieval against ingested chunks.
4. Return one of:
- `supported`
- `conflict`
- `missing_source`
5. Show top supporting/conflicting snippets with source references.

## Explicitly Out of Scope

1. Full product fork.
2. New app branding/marketing site.
3. Deep UI redesign.
4. Heavy PDF/OCR pipeline hardening.
5. Shared-core package refactor.

## Work Plan

### Phase 1: Planning and Fixtures (0.5 day)

1. Define sample dataset (2-3 known sources with easy truth checks).
2. Define evaluation claims (true/false/ambiguous).
3. Define result rubric for precision and false positives.

### Phase 2: Retrieval + Claim Check Prototype (1-2 days)

1. Implement ingestion/chunk storage for clean text inputs.
2. Implement claim-check service endpoint/function.
3. Render result card with status + citations.

### Phase 3: Reality Test (0.5-1 day)

1. Run 20+ claims across fixture sources.
2. Record outcomes:
- status
- evidence quality
- false positive/negative notes
3. Summarize blockers and rough effort to productionize.

## Go / No-Go Gate

Proceed only if all are true:

1. At least 80% of test claims correctly classified.
2. Citation links are consistently useful and traceable.
3. No critical architecture rewrite is required for a V1.
4. At least 3 target users signal meaningful interest after demo/interview.

If any fail, park nonfiction work and continue fiction roadmap.

## Decision Outcomes

### Go

1. Open follow-up plan for:
- package boundaries
- app mode split strategy
- PDF/OCR ingestion phase
2. Schedule as post-MVP initiative.

### No-Go (Default Until Evidence)

1. Archive spike notes.
2. Keep only reusable retrieval/consistency learnings.
3. Resume focus on fiction MVP priorities.

## Immediate Next Actions

1. Keep current Compendium overhaul work moving on this branch.
2. When ready, create first spike commit with:
- sample sources
- claim checker skeleton
- evaluation checklist template
