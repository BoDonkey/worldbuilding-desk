# Customizable State Model Spec

_Created: 2026-04-28_

## Purpose

Define a minimal, customizable manuscript-time state model for Worldbuilding Desk.

This spec is meant to stay stable across:

- local LLM proposal work
- deterministic review extraction work
- further Zustand migration
- UI refactors in Workspace, Character Sheets, or World Bible

The core requirement is simple:

- authors should be able to ask what is true **at a specific point in the manuscript**
- authors should be able to choose which state matters to their story

Examples:

- "How much mana did Aria have after scene 12?"
- "Was Rowan already poisoned in chapter 4?"
- "Which realm was Mei in before the duel?"
- "Did the party still have the key after the vault scene?"

## Design Goals

1. Writing-first

- State tracking must support the manuscript, not turn the app into a management dashboard.
- Authors should be able to keep drafting even if state review is incomplete.

2. Customizable but typed

- Authors must be able to track story-specific fields.
- The system must still understand field kinds well enough to validate, preview, and replay changes.

3. Deterministic mutation boundary

- Proposals may come from manual entry, deterministic extraction, or local LLM review.
- Persisted state changes must be written only through typed deterministic commands.

4. Historical replay

- The app must distinguish between current snapshot state and manuscript-history state.
- State at a scene is derived from accepted prior events in manuscript order.

5. Ruleset reuse

- Reuse existing ruleset stat/resource definitions where possible.
- Do not create a parallel state schema system unless the existing ruleset model is insufficient.

## Conceptual Model

The state system has three layers:

1. Schema layer

- Defines what kinds of state a project tracks.
- Source of truth: project ruleset plus a small amount of tracked-state metadata.

2. Snapshot layer

- Defines the current known state of an entity.
- Source of truth: character/entity state records derived from accepted events.

3. Timeline layer

- Defines what changed in which scene.
- Source of truth: accepted mutation events in manuscript order.

Short version:

- canon model says what exists
- state model says what can change
- mutation ledger says when it changed

## Scope

### In scope for the first version

- tracked state for characters
- customizable tracked fields driven by the project ruleset
- scene-scoped accepted mutation events
- replay to derive state at any scene
- manual state edits
- review acceptance flow for proposed changes

### Explicitly out of scope for the first version

- full simulation engine during drafting
- automatic mutation acceptance from LLMs
- deep non-character state across every entity type
- hard blocking "commit" workflow for ordinary drafting
- generalized free-form scripting as part of the author workflow

## Field Taxonomy

Not every tracked field should behave the same way.

The system should distinguish these categories:

### 1. Snapshot stats

Used for tracked values that are part of a character or entity state but are not necessarily consumed like a pool.

Examples:

- strength
- comprehension
- relationship score
- corruption
- suspicion

Typical types:

- `number`
- `boolean`
- `text`

### 2. Resources

Used for values with current/max semantics or spend/regeneration behavior.

Examples:

- health
- mana
- stamina
- qi
- shield

Typical types:

- numeric current/max pair

### 3. Statuses

Used for applied conditions that can begin and end over time.

Examples:

- poisoned
- invisible
- exhausted
- oathbound

### 4. Inventory/equipment state

Used for objects a character has, uses, equips, loses, or consumes.

Examples:

- keys
- potions
- sword
- talisman

### 5. Descriptive state

Used for stateful but non-numeric story facts.

Examples:

- current realm
- current location
- active allegiance
- disguise identity

Typical types:

- `text`
- future `enum`
- future `reference`

## Customization Model

Customization should come from constrained primitives, not unrestricted structure.

### First-version field primitives

- `number`
- `boolean`
- `text`

### Likely next primitives

- `enum`
- `reference`
- `list`

### Schema source

For first version, tracked fields should primarily come from existing ruleset definitions:

- `statDefinitions`
- `resourceDefinitions`

This already supports flexible fields such as:

- health
- mana
- qi
- comprehension
- realm
- custom story-specific numeric or text values

Important note:

- `qi` is only an example of a field that fits this model.
- It is not a priority signal and should not receive special-case architecture.

## Existing Ruleset Alignment

The existing rules engine already provides the correct base shape:

- flexible stat definitions in `packages/rules-engine/src/types/WorldRuleset.ts`
- flexible resource definitions in `packages/rules-engine/src/types/WorldRuleset.ts`
- cultivation preset including `qi`
- runtime `CharacterState` with stats, resources, inventory, statuses, and custom data

Therefore:

- do not create a separate field-definition system for tracked state in v1
- extend and reinterpret the current ruleset/state model for manuscript history

## State Subjects

First version should support one primary subject type:

- `character`

Later versions may extend to:

- `location`
- `faction`
- `item`
- `world`

The event schema should allow future subject expansion, but v1 behavior should stay character-first.

## Mutation Model

Mutation events are the durable timeline layer.

Events should remain:

- typed
- scene-scoped
- explicitly ordered within a scene
- replayable
- invalidatable when source scenes change

### Existing ledger direction

The current `StateMutationEvent` already includes:

- `projectId`
- `sceneId`
- `sceneTitle`
- `sceneOrder`
- `sceneSequence`
- `sourceRevision`
- `sourceHash`
- `status`
- `commands`

That is the correct backbone.

### Command categories for first version

The first version should support a deliberately small command set.

#### Resource commands

- `resource_set`
- `resource_change`

Examples:

- set health to 20
- decrease mana by 15
- increase qi by 30

#### Stat commands

- `stat_set`
- `stat_change`

Examples:

- set realm to `Foundation Establishment`
- increase comprehension by 5
- set corruption to `true`

#### Status commands

- `status_apply`
- `status_remove`

#### Inventory commands

- `inventory_add`
- `inventory_remove`
- `inventory_consume`
- `inventory_equip`
- `inventory_unequip`

#### Position/state commands

- `location_set`

This may later generalize into descriptive-state commands, but keeping one simple location-oriented command early is reasonable.

## Recommended Event Shape

The current command union is a useful start but should evolve toward narrower, more explicit operations.

Recommended direction:

```ts
type StateMutationCommand =
  | {
      type: 'resource_change';
      actorId: string;
      resourceDefinitionId: string;
      delta: number;
    }
  | {
      type: 'resource_set';
      actorId: string;
      resourceDefinitionId: string;
      value: number;
    }
  | {
      type: 'stat_change';
      actorId: string;
      statDefinitionId: string;
      delta: number | boolean | string;
    }
  | {
      type: 'stat_set';
      actorId: string;
      statDefinitionId: string;
      value: number | boolean | string;
    }
  | {
      type: 'status_apply' | 'status_remove';
      actorId: string;
      statusName: string;
    }
  | {
      type: 'inventory_add' | 'inventory_remove' | 'inventory_consume';
      actorId: string;
      itemName: string;
      quantity?: number;
    }
  | {
      type: 'inventory_equip' | 'inventory_unequip';
      actorId: string;
      itemName: string;
    }
  | {
      type: 'location_set';
      actorId: string;
      locationName: string;
    };
```

Notes:

- `set` and `change` are distinct and should not be conflated.
- `delta` is better than `amount` for additive operations.
- text and boolean state should use explicit `set` operations.
- commands should stay human-auditable in backup/export data.

## Proposal Layer vs Mutation Layer

This distinction is mandatory.

### Proposal layer

Used for "I think this happened in the manuscript."

Proposals may be created by:

- manual author input
- deterministic parser/extractor
- local LLM reviewer

Proposal data may include:

- `confidence`
- `evidenceText`
- `sourceSpan`
- `proposedBy`
- `proposalStatus`

### Mutation layer

Used for "this state change is accepted and now part of project history."

Mutation events must:

- use typed commands
- be deterministic before persistence
- survive reload/export/import
- support invalidation when source text changes

LLM integration should affect proposal generation only.

It should not redefine:

- the mutation event schema
- replay rules
- source-of-truth ordering

## Replay Rules

Replay is how the app answers historical state questions.

### Ordering

Replay order should be:

1. accepted events only
2. ascending `sceneOrder`
3. ascending `sceneSequence` within the same scene
4. ascending `sourceRevision`
5. ascending `createdAt`

This matches the current ledger sorting direction.

### Base state

Replay needs a starting snapshot.

For v1, use:

- character sheet / character-state baseline at project start
- plus accepted events applied in order

### Invalidation

If a scene changes materially:

- prior accepted mutation events from that scene may need invalidation
- invalidated events remain in the ledger for auditability
- replay ignores invalidated events

### Conflict posture

For first version:

- last accepted relevant event wins when multiple set-style commands target the same field in ordered replay
- additive commands accumulate
- invalid or schema-mismatched commands are rejected before persistence

## Snapshot Derivation

The app should eventually support these derived views:

- current state for a character
- state at a selected scene
- event history for a character
- before/after preview for a proposed mutation

The important boundary:

- replay logic is domain logic
- caching or memoization strategy is not part of the spec

That means Zustand adoption may improve how replayed state is shared in the UI, but it should not affect the replay contract itself.

## Impact of Zustand Migration

Further Zustand integration should not change this spec.

Zustand affects:

- where active scene state is cached
- how review queue state is shared
- how derived replayed state is memoized
- reload/restoration behavior

Zustand should not decide:

- command types
- field taxonomy
- replay order
- persistence semantics

Rule:

- domain model first
- store implementation second

## Impact of Local LLM Integration

Small-model integration should not change this spec either.

Local LLM work affects:

- how candidate state deltas are proposed
- proposal confidence and evidence
- how much review UX is needed

Local LLM work should not affect:

- accepted event schema
- deterministic validation rules
- replay behavior
- source-of-truth ordering

Rule:

- proposal generation is replaceable
- accepted mutation history is not

## Manual-First Implementation

The first working version should not depend on automatic extraction.

Minimum useful flow:

1. Author opens a character state panel.
2. Author records a scene-scoped change manually.
3. App writes a typed mutation event to the ledger.
4. App can reconstruct state at later scenes.

After that works, add:

5. deterministic suggestions
6. local LLM suggestions
7. richer review/audit UX

## First-Version Acceptance Criteria

The first version is successful if:

- authors can define tracked fields through the existing ruleset model
- authors can record state changes against a scene
- accepted changes are stored as durable mutation events
- replay can reconstruct state for a character at an arbitrary scene
- invalidated scene events are ignored in replay
- no LLM is required for the core workflow

## Recommended Build Sequence

1. Finalize command taxonomy and event schema.
2. Add manual mutation-entry flow for character state.
3. Add replay for a single character at a chosen scene.
4. Add invalidation flow when scene source changes.
5. Add proposal objects and review acceptance flow.
6. Add deterministic extraction and later local LLM proposal generation.
7. Move derived state and review orchestration into broader Zustand slices as needed.

## Non-Goals

This spec does not assume:

- hard blocking review on every draft edit
- a fully generalized world simulator
- auto-accepted LLM state mutation
- immediate support for every entity type
- that system-heavy fiction is the only use case

It is designed to support both:

- simple author needs such as health, mana, and inventory
- custom story-specific tracked values chosen by the author

## Working Summary

Worldbuilding Desk should treat manuscript-time state as:

- customizable through typed ruleset definitions
- persisted as scene-scoped accepted mutation events
- replayed deterministically to answer historical questions
- insulated from both proposal-generation changes and UI store refactors

That gives the project a real state-history foundation without forcing the product to lead with systems complexity.

## Implementation Status

As of 2026-04-28, the manual-first character-state workflow is implemented in the app.

Current implementation includes:

- typed `StateMutationCommand` support for resource, stat, status, inventory, and location changes
- durable `StateMutationEvent` writes with:
  - `sceneId`
  - `sceneOrder`
  - `sceneSequence`
  - `sourceRevision`
  - `sourceHash`
  - accepted/invalidated status
- manual mutation entry in Character Sheets
- mutation editing and same-scene step reordering
- replayed state inspection at a selected scene
- stale-event detection when source scene text changes
- workspace stale badges and selected-scene state timeline
- character hover-card preview in the workspace editor using replayed scene state

Still intentionally not implemented:

- automatic deterministic proposal ingestion into the ledger
- local LLM proposal ingestion into the ledger
- non-character-first generalized entity coverage
- hard-blocking drafting flow tied to state review

## Current Implementation Delta

This section compares the current codebase with the recommended spec and identifies the next concrete work items.

### Already aligned

The following infrastructure is already present and should be reused:

- `state_mutation_events` IndexedDB store exists in `apps/web/src/db.ts`
- ledger save/query/invalidate helpers exist in `apps/web/src/services/state/stateMutationLedger.ts`
- project snapshot export already includes `stateMutationEvents`
- project backup import already restores `stateMutationEvents`
- `StateMutationEvent` already includes:
  - `projectId`
  - `sceneId`
  - `sceneTitle`
  - `sceneOrder`
  - `sourceRevision`
  - `sourceHash`
  - accepted vs invalidated status
- ruleset stat/resource definitions already provide a customizable field schema

This means:

- storage scaffolding is not the blocker
- backup portability is not the blocker
- customization primitives already exist for first-version tracked fields

### Current gaps

The main gaps are in command design, replay behavior, and author-facing mutation flows.

#### Gap 1: Command taxonomy is too narrow and partly mis-shaped

Current `StateMutationCommand` in `apps/web/src/entityTypes.ts` supports:

- `equip_item`
- `unequip_item`
- `consume_item`
- `move_entity`
- `apply_status`
- `remove_status`
- `increment_stat`
- `decrement_stat`
- `resource_change`
- `level_up`

Problems:

- no `set` operation for resources
- no `set` operation for stats
- no way to represent text/boolean field updates cleanly
- additive stat commands assume numeric semantics only
- inventory supports equip/consume but not clear `add` or `remove`
- `level_up` is domain-opinionated and may be better represented as simpler stat/resource mutations in v1

Concrete delta:

- replace the current command union with a smaller and more explicit operation set:
  - `resource_set`
  - `resource_change`
  - `stat_set`
  - `stat_change`
  - `status_apply`
  - `status_remove`
  - `inventory_add`
  - `inventory_remove`
  - `inventory_consume`
  - `inventory_equip`
  - `inventory_unequip`
  - `location_set`

#### Gap 2: No stable replay service exists yet

The ledger can be stored and queried, but the app does not yet expose a deterministic replay layer that answers:

- current state for a character
- state at scene N
- event-by-event state history

Concrete delta:

- add a dedicated replay service, for example `apps/web/src/services/state/stateReplay.ts`
- define functions such as:
  - `getAcceptedStateMutationEventsByProject(projectId)`
  - `replayCharacterStateToScene({ projectId, characterId, sceneId | sceneOrder })`
  - `replayCharacterStateToEvent(...)`
  - `getCharacterStateTimeline(projectId, characterId)`

#### Gap 3: No baseline snapshot contract is defined

Replay needs a deterministic starting point. The current codebase has:

- `CharacterSheet`
- rules-engine `CharacterState`

But there is no declared rule for which one is the replay base for manuscript history.

Concrete delta:

- choose a first-version base state contract
- recommended v1 choice:
  - use `CharacterSheet` as the persisted author-facing baseline
  - map it into a replayable working state shape
- document when the baseline is read:
  - project start
  - first scene
  - selected checkpoint

#### Gap 4: No manual-first mutation entry flow exists

The current ledger is only scaffolding. There is no clear author flow for:

- selecting a character
- selecting a scene
- recording a change
- reviewing before/after state
- persisting the event

Concrete delta:

- add a manual mutation-entry UI before relying on extraction or LLM proposals
- recommended v1 scope:
  - character picker
  - tracked field picker from ruleset
  - operation picker: set/change/apply/remove/add/consume/equip
  - before/after preview
  - save as accepted mutation event

#### Gap 5: No schema validation boundary for commands

The spec requires typed deterministic acceptance, but there is no explicit validation layer yet for mutation commands before persistence.

Concrete delta:

- add Zod schemas for:
  - individual command variants
  - `StateMutationEvent`
  - future proposal objects
- reject:
  - unknown stat/resource ids
  - wrong value type for target field
  - impossible resource mutation payloads

#### Gap 6: Event queries currently scan all records

`getStateMutationEventsByProject` loads all records and filters in memory.

This is acceptable for scaffolding but weak for long manuscripts or larger projects.

Concrete delta:

- keep current behavior for now if scope is small
- later add IndexedDB indexes for likely access patterns:
  - `projectId`
  - `projectId + sceneId`
  - `projectId + status`

This is not a first-slice blocker.

#### Gap 7: Invalidation exists, but re-proposal flow does not

The code can invalidate all events from a scene when source text changes, which is good. But the larger flow is incomplete:

- invalidate outdated events
- regenerate or re-enter the replacement state changes
- compare old and new accepted state

Concrete delta:

- keep invalidation as-is for first slice
- add follow-up UX later:
  - "this scene changed; N prior state changes were invalidated"
  - rerun review or reopen manual mutation entry

#### Gap 8: No separation between proposal objects and accepted events in code

The architectural docs distinguish proposal extraction from accepted mutation writes, but the state model code does not yet define a proposal object shape for state deltas.

Concrete delta:

- do not overload `StateMutationEvent` to carry proposal metadata
- add a separate proposal type later, for example `StateDeltaProposal`
- include:
  - `confidence`
  - `evidenceText`
  - `sourceSpan`
  - `proposedBy`
  - `status`

This should remain separate from the accepted event ledger.

### Recommended code changes by file

#### `apps/web/src/entityTypes.ts`

- refine `StateMutationCommand`
- optionally add `StateMutationEventStatus` and command-specific helper types
- later add `StateDeltaProposal`

#### `apps/web/src/services/state/stateMutationLedger.ts`

- add accepted-only query helper
- keep sorting logic, since it already matches the intended replay order
- later improve query/index efficiency

#### New file: `apps/web/src/services/state/stateReplay.ts`

- replay accepted events against a chosen baseline
- expose point-in-manuscript state lookups
- centralize deterministic mutation application rules

#### New file: `apps/web/src/services/state/stateMutationSchemas.ts`

- Zod schemas for commands and events
- field-target validation helpers

#### UI layer

Likely first touch points:

- `CharacterSheetsRoute.tsx`
- `WorkspaceRoute.tsx`
- or a new focused state-history panel/modal

Recommended first UI should be narrow:

- manual scene-scoped mutation entry
- character-first
- no attempt to cover every entity type

### Recommended sequencing from the current tree

1. Refine `StateMutationCommand` in `entityTypes.ts`.
2. Add schemas for commands/events.
3. Add replay service over accepted events.
4. Define baseline mapping from `CharacterSheet` into replay state.
5. Add manual mutation-entry flow.
6. Add invalidation-aware replay recalculation.
7. Add proposal object types and review acceptance flow.
8. Only then connect deterministic or local-LLM proposal generation.

### What does not need to change yet

The following should stay as-is until the above exists:

- snapshot export/import plumbing
- Zustand migration planning
- local LLM review architecture
- ruleset preset inventory, including cultivation examples such as `qi`

### Next slice recommendation

If choosing one concrete implementation slice now, the best one is:

- **state command/schema refinement + replay service**

Reason:

- it creates the durable core behavior
- it does not depend on LLM work
- it does not depend on full Zustand migration
- it unlocks both manual entry and later automated proposal acceptance
