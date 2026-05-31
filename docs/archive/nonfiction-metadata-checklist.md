# Nonfiction Metadata & Citation Checklist

Last updated: 2026-02-26

## Purpose

Prevent architecture drift so nonfiction citation workflows can be added later with minimal rework.

Use this checklist in PR reviews for shared-core changes.

## Non-Negotiable Metadata Rules

1. Every retrievable chunk must retain stable provenance fields:
- `sourceId`
- `sourceTitle`
- `chunkId`
- `location` (page/section/offset, whichever applies)
- `projectId`
- `createdAt` / `updatedAt`

2. Citation payloads must be machine-linkable, not display-only:
- include IDs + location metadata
- UI labels are derived from metadata, not stored as authoritative references

3. Never store citation data only inside rendered text.
- citation records must exist as structured data
- rendered text may include human-readable citation markers

4. Keep metadata immutable where possible.
- updates create new version records or replace by deterministic key
- avoid ad-hoc mutation of provenance history

## Shared-Core Interface Rules

1. Retrieval interfaces must return evidence objects, not plain strings.
2. Evidence objects must include enough fields to open source context directly.
3. Shared interfaces must stay mode-neutral (fiction/nonfiction).
4. Mode-specific ranking/scoring logic belongs in domain adapters.

## Ingestion Rules

1. Ingestion remains staged: parse -> normalize -> chunk -> index.
2. Parser outputs must preserve source location data (page/heading/timestamp when available).
3. Chunking must not discard source boundaries.
4. If a source lacks precise location data, mark it explicitly (do not fake page numbers).

## PR Checklist (Required for Shared-Core Changes)

1. Does this change preserve structured provenance fields on stored chunks?
2. Does retrieval output still include machine-linkable evidence metadata?
3. Does this avoid embedding mode-specific business logic in shared services?
4. Can a citation still open the exact source context after this change?
5. Are migration and backward-compatibility notes documented when metadata shape changes?

If any answer is "no", the PR is not merge-ready.

## Minimal Target Data Shapes

```ts
interface EvidenceRef {
  sourceId: string;
  sourceTitle: string;
  chunkId: string;
  location?: {
    page?: number;
    section?: string;
    startOffset?: number;
    endOffset?: number;
  };
  snippet: string;
  confidence?: number;
}

interface CitationRecord {
  id: string;
  projectId: string;
  claimText: string;
  evidence: EvidenceRef[];
  createdAt: number;
}
```

## Current Decision

1. Fiction MVP remains shipping priority.
2. Nonfiction citation-readiness is enforced through shared metadata discipline now.
3. Product fork decisions remain gated by market validation.
