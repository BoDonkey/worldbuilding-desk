# Freeform Lore Ingestion Architecture

_Drafted: May 10, 2026_

## Goal

Support free-form worldbuilding intake without making authors fill rigid forms, while preserving deterministic consistency validation and useful RAG retrieval.

This design treats longform lore as a first-class authoring surface and converts only the subset needed for machine reasoning into typed, reviewable proposals.

## Product stance

Authors should be able to write:

- character dossiers
- place histories
- faction notes
- religion and myth notes
- timelines
- exploratory canon brainstorming

The app should then:

1. store that source material as free-form lore
2. extract machine-readable candidate facts from it
3. require author approval before those facts become canon
4. use accepted canon for blocking consistency checks
5. use both raw lore and accepted canon for retrieval, but with different weights and purposes

This is consistent with the existing architecture principle in [docs/architecture-review.md](/Volumes/T7/Development/worldbuilding-desk/docs/architecture-review.md):

- LLMs propose
- deterministic TypeScript validates
- authors approve

## Why the current model is insufficient

The current app already supports imported `.docx` text in [apps/web/src/hooks/useWorldBibleImports.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/hooks/useWorldBibleImports.ts), but the World Bible flow mainly maps imported text into a single entity field in [apps/web/src/routes/WorldBibleRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/WorldBibleRoute.tsx).

That is too narrow for:

- longform dossiers with mixed sections
- notes that contain both hard canon and speculation
- one source document describing multiple entities
- future “companion book” or exportable world-guide workflows

The current `WorldEntity` shape is useful as an anchor, but it should not be the only storage container for deep lore.

## Core model

Introduce a three-layer lore model:

1. `LoreDocument`
2. `FactProposal`
3. accepted canonical facts attached to `Character` or `WorldEntity`

### Layer 1: LoreDocument

`LoreDocument` is the author-facing free-form source of truth.

It stores:

- title
- rich or plain text body
- origin metadata
- optional links to related entities or characters
- status flags such as draft, reference, or archived

This is where imported dossiers, world notes, and longform lore live.

### Layer 2: FactProposal

`FactProposal` is an internal structured interpretation of claims found in lore documents.

It is not user-authored JSON.

It is:

- machine-readable
- schema-validated
- evidence-backed
- confidence-scored
- reviewable before canon write

Examples:

- `occupation = detective`
- `member_of = Terra clan`
- `partner_of = Leo Muller-Sarkisian`
- `trait = earth manipulation`
- `heritage = human + Dhemon hybrid`

### Layer 3: Canonical facts

Accepted facts become part of the deterministic canon layer used by consistency review.

They should be stored in a typed, auditable way and linked back to:

- the source lore document
- the source evidence span
- acceptance metadata

This allows the app to answer:

- “what is established canon?”
- “where did this canon come from?”
- “what is still tentative?”

## Recommended data model

This proposal avoids a big-bang replacement of `WorldEntity` and `Character`.

### Keep

- `Character` for actor identity
- `CharacterSheet` for runtime stats/resources/inventory/state
- `WorldEntity` for canon anchors
- `CompendiumEntry` for optional mechanics

### Add

- `LoreDocument`
- `LoreDocumentLink`
- `FactProposal`
- `CanonicalFact`

## Proposed TypeScript shapes

These types belong in [apps/web/src/entityTypes.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/entityTypes.ts) or nearby service-local schema files, with Zod mirrors where proposals cross the world-engine boundary.

```ts
export type LoreDocumentKind =
  | 'character_dossier'
  | 'place_history'
  | 'faction_notes'
  | 'item_history'
  | 'myth'
  | 'timeline'
  | 'general_lore';

export type LoreDocumentFormat = 'plain_text' | 'html' | 'markdown';

export interface LoreDocument {
  id: string;
  projectId: string;
  title: string;
  kind: LoreDocumentKind;
  format: LoreDocumentFormat;
  content: string;
  summary?: string;
  source:
    | {type: 'manual'}
    | {type: 'import'; fileName: string; mimeType?: string}
    | {type: 'ai-session'; sessionId: string};
  status: 'active' | 'archived';
  createdAt: number;
  updatedAt: number;
}

export interface LoreDocumentLink {
  id: string;
  projectId: string;
  loreDocumentId: string;
  targetType: 'character' | 'entity';
  targetId: string;
  relationship:
    | 'primary_subject'
    | 'secondary_subject'
    | 'mentions'
    | 'supports';
  createdAt: number;
}

export type CanonicalFactValue =
  | string
  | number
  | boolean
  | string[]
  | {label: string; value?: string};

export interface CanonicalFact {
  id: string;
  projectId: string;
  targetType: 'character' | 'entity';
  targetId: string;
  factType: string;
  value: CanonicalFactValue;
  sourceLoreDocumentId?: string;
  sourceProposalId?: string;
  evidenceText?: string;
  evidenceStart?: number;
  evidenceEnd?: number;
  status: 'accepted' | 'superseded';
  acceptedAt: number;
  updatedAt: number;
}
```

`FactProposal` should remain in the proposal/review boundary rather than being modeled as plain storage-only records. It should use a Zod schema similar to the existing world-engine proposal types.

```ts
export interface FactProposal {
  id: string;
  projectId: string;
  loreDocumentId: string;
  targetHint?: {
    type: 'character' | 'entity';
    id?: string;
    name: string;
  };
  factType: string;
  value: CanonicalFactValue;
  confidence: number;
  evidence: {
    start: number;
    end: number;
    text: string;
  };
  status: 'proposed' | 'accepted' | 'rejected';
  createdAt: number;
}
```

## Fact typing strategy

Do not begin with an enormous ontology.

Start with a narrow stable fact vocabulary that is useful for consistency and retrieval:

- `alias`
- `role`
- `occupation`
- `affiliation`
- `membership`
- `relationship`
- `species`
- `heritage`
- `location_association`
- `trait`
- `ability`
- `appearance`
- `belief`
- `goal`
- `timeline_marker`

This vocabulary should be application-defined, not model-defined.

Each fact type should have deterministic validation rules. For example:

- `alias` must normalize to non-empty text and cannot duplicate a canonical name
- `relationship` should prefer a normalized structure such as `{label: 'partner_of', value: 'Leo Muller-Sarkisian'}`
- `timeline_marker` should preserve the original text if hard normalization is ambiguous

## Canon storage strategy

Accepted facts should not be written straight into arbitrary `fields` blobs and forgotten.

Use a dual-write model:

1. keep `CanonicalFact` as the authoritative machine-readable record
2. optionally materialize a curated subset into user-facing `Character.fields` or `WorldEntity.fields`

This avoids making `fields` the only canon source while still letting the UI show familiar summary cards.

Recommended materialized examples:

- `Character.description`
- `Character.fields.role`
- `WorldEntity.fields.description`
- `WorldEntity` alias displays via alias storage

The materialized view can be rebuilt from canonical facts if needed later.

## Relationship to aliases

Alias handling already exists in [apps/web/src/services/consistency/aliasStorage.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/services/consistency/aliasStorage.ts).

This proposal should treat alias extraction as a special fact path:

1. extract alias candidates from lore documents
2. review them as fact proposals
3. on acceptance, write to alias storage and optionally to `CanonicalFact`

This keeps consistency matching and free-form lore extraction aligned.

## Ingestion pipeline

### Input sources

The first version should support:

- manually created lore docs
- imported `.docx`
- imported `.txt`
- imported `.md`
- future import of copied AI chat transcripts

### Pipeline

`import/create lore doc -> link targets -> extract proposals -> review -> accept/reject -> index`

Detailed steps:

1. User creates or imports a `LoreDocument`.
2. The app stores the raw document immediately.
3. The app optionally asks for a primary subject:
   - linked character
   - linked world entity
   - no subject yet
4. The extraction service produces:
   - candidate entity links
   - candidate aliases
   - `FactProposal[]`
5. Deterministic validators check proposal shape and target eligibility.
6. The author reviews proposals.
7. Accepted proposals become:
   - `CanonicalFact` records
   - alias storage entries where relevant
   - selective materialized field updates
8. RAG is updated for:
   - the raw lore document
   - accepted canon fact summaries

## JSON interpretation

Yes, the architecture should include JSON interpretation under the hood.

But the interpretation should be:

- internal
- typed
- validated
- review-gated

It should not be:

- a user-facing authoring format
- a requirement for import success
- a direct canon-write path

### Example internal interpretation

For the attached Camila dossier, the intermediate representation might look like:

```json
{
  "targetHint": {
    "type": "character",
    "name": "Camila Garcia deTerra"
  },
  "proposals": [
    {"factType": "membership", "value": "Terra clan", "confidence": 0.93},
    {"factType": "occupation", "value": "Detective", "confidence": 0.97},
    {
      "factType": "relationship",
      "value": {"label": "partner_of", "value": "Leo Muller-Sarkisian"},
      "confidence": 0.88
    },
    {"factType": "heritage", "value": "human + Dhemon hybrid", "confidence": 0.95},
    {"factType": "ability", "value": "earth manipulation", "confidence": 0.82}
  ]
}
```

The raw dossier remains the real source document. The JSON is only the machine-readable extraction product.

## World-engine boundary

The current world-engine contract in [apps/web/src/services/worldEngine/types.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/services/worldEngine/types.ts) already validates proposal-like shapes with Zod.

Extend that model with lore-document extraction contracts rather than bypassing it.

Recommended addition:

```ts
interface LoreFactExtractionInput {
  projectId: string;
  loreDocumentId: string;
  title: string;
  text: string;
  linkedTargets: Array<{
    type: 'character' | 'entity';
    id: string;
    name: string;
  }>;
}

interface WorldEngine {
  extractLoreFacts(input: LoreFactExtractionInput): Promise<FactProposal[]>;
}
```

Important rule:

- world-engine output proposes facts
- deterministic application code validates and applies accepted facts
- the model never writes directly to canon stores

## Deterministic validation rules

Before a fact can be accepted, the app should validate:

- target exists or can be explicitly created by the user
- `factType` is part of the app-defined vocabulary
- value shape matches the fact type
- evidence span is within the lore document bounds
- duplicate accepted fact rules
- contradiction policy

Examples:

- accepting a second `occupation` may supersede the earlier one or require explicit author choice
- accepting an `alias` that already belongs to another character should raise an ambiguity warning
- accepting `partner_of = Leo` without a resolvable target may remain text-valued until linked

## Consistency engine integration

This proposal should strengthen the consistency engine by separating:

1. raw contextual lore
2. accepted canon

### Blocking checks

Blocking consistency review should rely on:

- `Character`
- `WorldEntity`
- alias storage
- accepted `CanonicalFact`
- accepted state mutations

It should not block purely because a raw lore document contains a statement.

That distinction is critical because longform notes often contain:

- alternatives
- uncertain ideas
- abandoned concepts
- contradictory brainstorming

### Retrieval-assisted checks

Raw lore docs can still assist review by giving context:

- “this scene mentions Camila’s earth affinity, which appears in a lore dossier”
- “this contradicts accepted canon, but the raw note includes an earlier draft version”

That should appear as context, not as silent canon.

## RAG integration

The current RAG service in [apps/web/src/services/rag/RAGService.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/services/rag/RAGService.ts) indexes by document type plus optional tags.

Extend document types and tagging rather than replacing the service.

### Recommended RAG document types

- `scene`
- `worldbible`
- `rule`
- `lore`
- `canon_fact`

### Lore indexing

Index each `LoreDocument` as:

- `type = lore`
- tags:
  - lore kind
  - linked target ids
  - subject names where useful

### Canon fact indexing

Index accepted facts as compact factual summaries:

- `Camila Garcia deTerra occupation: Detective`
- `Camila Garcia deTerra member of: Terra clan`
- `Camila Garcia deTerra ability: earth manipulation`

with:

- `type = canon_fact`
- tags:
  - target ids
  - fact type

### Retrieval policy

Search consumers should prefer:

1. `canon_fact`
2. `worldbible`
3. `lore`
4. `scene`

when the task is consistency validation.

Creative assistance can use a broader retrieval mix.

## Storage and migration impact

### IndexedDB

Add stores for:

- `lore_documents`
- `lore_document_links`
- `canonical_facts`
- optionally `lore_fact_proposals` if proposal persistence should survive reloads independently of current consistency proposal storage

[apps/web/src/db.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/db.ts) will need a new `DB_VERSION` bump and store creation logic.

### Project snapshots

[apps/web/src/services/storage/projectSnapshotService.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/services/storage/projectSnapshotService.ts) must include the new records in backup/export/import.

This is also a good moment to finally treat snapshot versioning more explicitly, because this feature adds meaningful new persisted data.

Recommended snapshot additions:

- `loreDocuments`
- `loreDocumentLinks`
- `canonicalFacts`

## Suggested persistence policy

Persist these immediately:

- lore documents
- lore document links
- accepted canonical facts

Persist proposals if:

- you want review state to survive reloads
- you want auditable extraction history

If proposal persistence is added, it should follow the existing proposal/review pattern rather than inventing an unrelated queue model.

## UI model

The UI should reflect the storage model rather than pretending everything is one “World Bible record.”

### Primary surfaces

1. `Lore`
2. `World Bible`
3. `Characters`

### Lore

This is the free-form writing area for reference material.

Capabilities:

- create/import lore docs
- edit longform notes
- link a doc to one or more subjects
- run extraction
- review proposed facts
- open related canon anchors

### World Bible

This remains the canonical anchor layer.

Capabilities:

- manage entities
- review accepted canon summaries
- manage aliases
- connect lore docs
- inspect supporting source docs

### Characters

This remains the actor-centric identity and runtime layer.

Capabilities:

- manage character identity
- view accepted facts relevant to the character
- open linked dossiers
- optionally jump into sheets/state

## First UI slices

Do not try to redesign all routes at once.

### Slice 1: Lore documents without extraction

Build:

- `Lore` route or drawer surface
- create/import/edit/delete lore docs
- link docs to existing characters/entities

No fact extraction yet. This proves the free-form storage model.

### Slice 2: Lore extraction review

Build:

- “Extract facts” action on a lore doc
- proposal review panel
- accept/reject per fact

Acceptance writes:

- `CanonicalFact`
- alias storage where relevant

### Slice 3: Canon summaries in World Bible and Characters

Build:

- accepted fact chips/rows
- “supported by X lore docs”
- open evidence/source

### Slice 4: Retrieval and consistency integration

Build:

- RAG indexing for `lore` and `canon_fact`
- consistency consumers prefer accepted canon facts
- lore appears as supporting context only

## Suggested implementation order

1. Add storage types and DB stores.
2. Add lore document CRUD service.
3. Add snapshot export/import support.
4. Add first `Lore` UI surface with import/edit/link flows.
5. Add world-engine lore fact extraction contract and deterministic validation.
6. Add proposal review UI and canonical fact acceptance.
7. Add alias integration.
8. Add RAG indexing for lore docs and accepted fact summaries.
9. Update consistency retrieval to prefer accepted canon facts.

## Non-goals for the first pass

- full ontology for every imaginable lore fact
- automatic contradiction resolution inside lore docs
- fully automatic entity creation from extracted text without review
- replacing `WorldEntity` or `Character`
- merging runtime state mutation extraction into this slice

## Key design decisions

### 1. Free-form docs are first-class, not import leftovers

The imported dossier should remain a durable object in the system.

### 2. Canon is extracted, not assumed

The app should distinguish between “written in notes” and “accepted as canon.”

### 3. JSON is internal infrastructure

Machine-readable interpretation is necessary, but only behind the scenes.

### 4. Deterministic validation remains the guardrail

Model output can suggest facts. It cannot define canon by itself.

### 5. RAG should index both deep lore and accepted fact summaries

These serve different retrieval purposes and should not be collapsed into one bucket.

## Recommendation

Build this in two large phases:

### Phase 1: Free-form lore foundation

- lore document storage
- lore import/edit/link UI
- backup support

### Phase 2: Structured canon extraction

- fact proposal extraction
- deterministic review/acceptance
- canonical fact storage
- RAG and consistency integration

This sequencing keeps the user-visible value high early while preserving the architecture needed for long-term consistency quality.
