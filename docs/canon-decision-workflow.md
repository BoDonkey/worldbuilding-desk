# Canon Decision Workflow

_Drafted: May 10, 2026_

## Goal

Turn noisy extraction output into a trustworthy canon-building workflow.

The problem is no longer just finding possible characters, places, factions, and facts. The problem is deciding:

- is this the same thing as an existing record?
- is this a variant name or a distinct entity?
- should this fact replace earlier canon, extend it, or be rejected?
- should this stay unresolved for now?

This workflow is the missing layer between extraction and source-of-truth canon.

## Product stance

The system should be:

- aggressive about finding candidates
- conservative about creating truth

That means:

- extraction produces proposals
- canon decision consolidates proposals
- accepted anchors and accepted facts become source of truth
- LLM support helps the author reason, but does not decide canon

## Why this is needed

Without a canon-decision layer, the app risks becoming noisy in two ways:

1. duplicate anchors
2. fragmented facts

Examples:

- `Terra clan` and `House Terra`
- `Verdezian police` and `Verdezian Police Force`
- `Dhemon` as species vs lineage vs magical concept
- `Camila` and `Camila Garcia deTerra`

If every extracted candidate can become a new record too easily, the World Bible stops being authoritative. If every ambiguity is hidden, the app feels wrong and brittle.

## Core workflow

The canon-decision layer should group extraction output into reviewable decision clusters.

A cluster is a small set of related candidates that likely refer to the same underlying canon object or competing canon interpretations.

### High-level flow

`extract -> cluster -> review -> decide -> apply -> reindex`

Detailed flow:

1. Lore extraction creates:
   - `LoreEntityProposal[]`
   - `LoreFactProposal[]`
2. The canon-decision service groups related records into `DecisionCluster[]`.
3. The author reviews one cluster at a time.
4. For each cluster, the author can choose:
   - `merge`
   - `alias`
   - `keep separate`
   - `accept as new`
   - `reject`
   - `defer`
5. Optional LLM rubber-duck assistance explains the tradeoffs.
6. Accepted decisions update:
   - `Character`
   - `WorldEntity`
   - alias storage
   - `CanonicalFact`
   - RAG fact summaries

## What belongs in a decision cluster

Clusters should be intentionally small and comprehensible.

Examples:

- one proposed entity plus one likely existing match
- one proposed fact plus one conflicting accepted fact
- several extracted names with strong lexical overlap
- several titles/aliases that probably belong to one anchor

Do not create giant “everything related to Camila” mega-clusters. That will paralyze review.

## Proposed data model

This layer should be explicit in storage, not inferred only at render time.

### New types

```ts
export type CanonDecisionKind =
  | 'entity_merge'
  | 'entity_identity'
  | 'fact_conflict'
  | 'fact_supersession'
  | 'alias_resolution';

export type CanonDecisionResolution =
  | 'merge'
  | 'alias'
  | 'keep_separate'
  | 'accept_new'
  | 'accept_update'
  | 'reject'
  | 'defer';

export interface CanonDecisionCluster {
  id: string;
  projectId: string;
  kind: CanonDecisionKind;
  title: string;
  summary: string;
  memberRefs: Array<
    | {type: 'lore_entity_proposal'; id: string}
    | {type: 'lore_fact_proposal'; id: string}
    | {type: 'canonical_fact'; id: string}
    | {type: 'character'; id: string}
    | {type: 'world_entity'; id: string}
    | {type: 'alias'; id: string}
  >;
  status: 'open' | 'resolved' | 'deferred';
  suggestedResolution?: CanonDecisionResolution;
  createdAt: number;
  updatedAt: number;
}

export interface CanonDecisionRecord {
  id: string;
  projectId: string;
  clusterId: string;
  resolution: CanonDecisionResolution;
  notes?: string;
  createdAt: number;
}
```

## Clustering rules

Start deterministic. LLM assistance can explain clusters later, but should not be required to form them.

### Entity identity cluster triggers

Create a cluster when:

- normalized names match exactly
- one name contains the other and token overlap is high
- a proposed entity matches an existing alias candidate
- multiple proposed entities from different lore docs strongly overlap

Examples:

- `terra clan` vs `house terra`
- `camila` vs `camila garcia deterra`
- `verdezian police` vs `verdezian police force`

### Fact conflict cluster triggers

Create a cluster when:

- a proposed fact targets the same anchor and fact type as an accepted fact
- values differ materially
- both facts are likely canonical rather than clearly additive

Examples:

- occupation: `detective` vs `inspector`
- heritage: `human + Dhemon hybrid` vs `full Dhemon`
- membership: `Terra clan` vs `House Verde`

### Alias resolution cluster triggers

Create a cluster when:

- a proposed entity might be better represented as an alias
- a proposed alias conflicts with another record’s canonical name
- a fuller name and short name likely refer to the same anchor

## Deterministic ranking

Each cluster should have a confidence score and a reason list.

Example:

```ts
interface ClusterReason {
  code:
    | 'exact_normalized_match'
    | 'high_token_overlap'
    | 'alias_collision'
    | 'same_fact_type_same_target'
    | 'name_contains_other'
    | 'shared_lore_document';
  confidence: number;
  explanation: string;
}
```

This matters because the UI should show why the system thinks a decision is needed.

## Author actions

### 1. Merge

Use when two records represent the same underlying canon entity.

Effects:

- choose a canonical anchor
- move aliases to the winner
- merge links
- reconcile facts
- delete or archive duplicate anchor

### 2. Alias

Use when a candidate is just another name for an existing anchor.

Effects:

- write to alias storage
- preserve source evidence
- do not create a new anchor

### 3. Keep Separate

Use when similarity is misleading and the author wants both records to exist independently.

Effects:

- mark cluster resolved
- optionally remember separation to suppress future duplicate suggestions

### 4. Accept New

Use when there is no meaningful existing match.

Effects:

- create a new `Character` or `WorldEntity`
- connect fact proposals to that anchor

### 5. Accept Update

Use when a proposed fact should supersede or extend accepted canon.

Effects:

- write new `CanonicalFact`
- optionally mark older fact superseded

### 6. Reject

Use when the proposal is not canon-worthy.

Effects:

- keep source lore unchanged
- mark proposal rejected

### 7. Defer

Use when the author is not ready to decide.

Effects:

- cluster stays open but can leave the primary queue

## LLM rubber-duck role

This is where the LLM adds value without becoming a silent canon mutator.

### Allowed LLM roles

- summarize a cluster
- compare two candidates
- explain likely overlap
- point out meaningful differences
- suggest resolution options
- draft concise canonical wording
- suggest follow-up questions the author should answer

### Forbidden LLM roles

- directly create canon
- silently merge anchors
- silently rewrite accepted facts
- resolve ambiguous identity without author action

### Example rubber-duck prompt

For a cluster containing `Terra clan` and `House Terra`, the assistant should help like this:

- likely same: both use `Terra`, both describe social affiliation
- possible distinction: clan may be kinship structure, house may be political institution
- author choice options:
  - merge into one faction
  - keep both and link them conceptually
  - make one an alias of the other

This is a reasoning aid, not a mutation path.

## UI model

The UI should separate extraction review from canon decision review.

### Lore extraction review

This is where the author accepts:

- initial entity candidates
- initial fact candidates

### Canon decision review

This is where the author resolves:

- duplicates
- aliases
- fact conflicts
- supersession questions

That separation matters because the cognitive task is different:

- extraction review asks: “is this worth tracking?”
- canon decision asks: “how should this fit into truth?”

## Recommended UI surface

Add a dedicated `Canon Decisions` queue rather than burying this inside World Bible forms.

### Queue card contents

Each cluster card should show:

- title
- cluster type
- confidence/reason summary
- compared records/facts
- source lore references
- primary recommended actions

### Cluster detail panel

The detail view should show:

- side-by-side comparison
- current accepted canon
- proposed updates
- source evidence excerpts
- action buttons
- optional `Rubber-Duck This` panel

## Example cluster layouts

### Entity identity cluster

- proposed: `Terra clan`
- existing: `House Terra`
- reasons:
  - shared token `Terra`
  - both linked to Camila dossier
  - both categorized as social groups

Actions:

- merge
- alias
- keep separate
- defer

### Fact conflict cluster

- accepted canon: `Camila occupation = Detective`
- proposed fact: `Camila occupation = Inspector`
- evidence:
  - accepted lore fact from `Character Sheet: Camila Garcia deTerra`
  - new lore fact from `Police hierarchy notes`

Actions:

- keep `Detective`
- supersede with `Inspector`
- keep both with a clearer typed distinction
- defer

## Application rules

Applying a decision should go through deterministic handlers.

Examples:

- `merge` uses existing merge helpers where possible
- `alias` writes to alias storage
- `accept_update` writes a new `CanonicalFact` and marks old fact superseded
- `keep_separate` stores a suppression signal so the same pair is not re-flagged constantly

## Suppression memory

To avoid review spam, the system should remember some author decisions.

Examples:

- the author chose `keep separate` for `House Terra` vs `Terra clan`
- the author chose `alias` for `Camila` -> `Camila Garcia deTerra`

That should reduce future duplicate clusters unless new evidence meaningfully changes the situation.

## Storage implications

Recommended new stores:

- `canon_decision_clusters`
- `canon_decision_records`
- optional `canon_decision_suppressions`

These should be included in snapshot backup/export/import.

## Suggested implementation order

### Slice 1: Deterministic clustering only

- cluster entity proposals against existing anchors
- cluster fact proposals against accepted facts
- render queue
- actions: `accept new`, `alias`, `keep separate`, `reject`, `defer`

### Slice 2: Merge application

- entity merge workflow
- fact supersession workflow
- suppression memory

### Slice 3: Rubber-duck assistance

- add an optional cluster-level reasoning panel
- use explicit author-invoked LLM calls only
- no automatic canon mutation

## Why this should come before more aggressive extraction

Better extraction without better decision-making just increases noise faster.

A canon-decision workflow makes the system safer to scale because:

- authors can consolidate truth deliberately
- the app becomes auditable
- ambiguity is surfaced instead of hidden
- the LLM can help with meaning, not just detection

## Recommendation

The next implementation pass should be:

1. deterministic duplicate/conflict clustering
2. queue UI for canon decisions
3. apply handlers for alias/merge/keep-separate/defer
4. optional rubber-duck panel after the deterministic workflow exists

That sequence keeps the app grounded in explicit author control while creating a real source-of-truth workflow for worldbuilding.
