# Technical Specification: Entity Guardrails & State Enforcement

Version: 1.1  
Scope: V1 implementation for local-first Electron/Tauri LitRPG authoring tool  
Status: Proposed implementation architecture

## 1. Objective
Prevent narrative commits that introduce undefined entities, ambiguous references, or state-invalid actions.

Core outcomes:
- Deterministic game state enforcement.
- Hard guardrails before editor commit.
- LLM restricted to extraction and intent detection, not state mutation math.

## 2. Non-Negotiable Rules
- Game state is authoritative in SQLite/JSON-backed deterministic store (SQLite preferred for V1).
- RAG is lore-only. RAG data must never be used for HP, inventory, durability, ownership, cooldowns, etc.
- No draft text can be committed to the main editor if blocking issues are unresolved.
- All state mutations are executed by TypeScript backend command handlers.
- All overrides are auditable with actor, reason, and timestamp.

## 3. High-Level Pipeline
`propose -> validate -> apply -> commit`

### 3.1 Propose
Input:
- User raw text and/or LLM draft text.

Output:
- `Proposal` containing extracted entity mentions, action intents, and unresolved spans.

### 3.2 Validate
`GuardrailEngine` validates proposal against canonical entity/state store.

Checks:
- `UNKNOWN_ENTITY`
- `AMBIGUOUS_REFERENCE`
- `STATE_CONFLICT`
- `INVALID_MUTATION`

Output:
- `allowCommit: boolean`
- `issues[]`
- `proposedMutations[]`

### 3.3 Apply
If `allowCommit = true` (or user override for overrideable issue types), backend applies typed mutation commands.

Output:
- Persisted mutation event log.
- Updated state snapshot/hash.

### 3.4 Commit
Only after successful apply, text is committed to main editor buffer/history.

## 4. Extraction & Canonicalization

### 4.1 Extraction Strategy (Hybrid)
Pass 1: Deterministic matcher
- Dictionary/entity index lookup.
- Regex and phrase patterns for common entities and verbs.

Pass 2: Lightweight LLM extraction
- Runs only on unresolved spans.
- Returns candidate entity type and intent classification with confidence.

### 4.2 Canonicalization
Resolve surface forms to canonical IDs using:
- Alias table (`entity_aliases`).
- Fuzzy string match threshold.
- Optional contextual hints (entity type in sentence).

Rules:
- High-confidence single match: auto-link.
- Low-confidence or multiple matches: emit `AMBIGUOUS_REFERENCE`.
- No match: emit `UNKNOWN_ENTITY`.

## 5. State Engine Responsibilities
The state engine is the only component allowed to mutate game state.

Allowed mutation model:
- Intent -> typed command(s) -> transactional apply.

Examples:
- `CONSUME_ITEM` -> `decrement_inventory(actorId, itemId, qty)`
- `ATTACK_WITH_ITEM` -> `decrement_durability(itemId, amount)`
- `MOVE_TO_LOCATION` -> `set_location(actorId, locationId)`

Constraints:
- LLM never calculates resulting values.
- Command handlers enforce preconditions and invariants.

## 6. Data Model (V1)

### 6.1 Core Tables
- `entities(id, type, name, attributes_json, created_at, updated_at)`
- `entity_aliases(id, entity_id, alias, confidence_hint, created_at)`
- `world_state(entity_id, state_json, state_hash, updated_at)`
- `consistency_rules(id, key, config_json, enabled)`
- `mutation_events(id, proposal_id, actor_id, commands_json, before_hash, after_hash, override_reason, created_at)`
- `proposals(id, source, text, extraction_json, created_at)`
- `proposal_issues(id, proposal_id, code, severity, span_start, span_end, details_json, resolved)`

### 6.2 Entity Types (Initial)
- `character`
- `item`
- `location`
- `status_effect`
- `ability`

### 6.3 Intent Types (Initial)
- `CONSUME_ITEM`
- `EQUIP_ITEM`
- `UNEQUIP_ITEM`
- `ATTACK_WITH_ITEM`
- `CAST_ABILITY`
- `MOVE_TO_LOCATION`
- `APPLY_STATUS`
- `REMOVE_STATUS`

## 7. API Contracts (Local Backend)

### 7.1 `POST /proposal/extract`
Purpose:
- Build `Proposal` from text.

Request:
```json
{
  "text": "Kael drank the healing potion and ran to Ironhold.",
  "source": "llm-draft"
}
```

Response:
```json
{
  "proposalId": "prop_123",
  "entities": [
    { "surface": "Kael", "type": "character", "entityId": "char_kael", "confidence": 0.99 },
    { "surface": "healing potion", "type": "item", "entityId": "item_potion_healing", "confidence": 0.92 },
    { "surface": "Ironhold", "type": "location", "entityId": "loc_ironhold", "confidence": 0.98 }
  ],
  "intents": [
    { "type": "CONSUME_ITEM", "actorId": "char_kael", "targetId": "item_potion_healing", "params": { "qty": 1 }, "confidence": 0.93 },
    { "type": "MOVE_TO_LOCATION", "actorId": "char_kael", "targetId": "loc_ironhold", "params": {}, "confidence": 0.89 }
  ],
  "unresolvedSpans": []
}
```

### 7.2 `POST /proposal/validate`
Purpose:
- Run guardrails and produce blocker list + mutation preview.

Request:
```json
{
  "proposalId": "prop_123"
}
```

Response:
```json
{
  "allowCommit": false,
  "issues": [
    {
      "code": "UNKNOWN_ENTITY",
      "severity": "blocking",
      "message": "Entity 'Obsidian Cleaver' not found.",
      "span": { "start": 14, "end": 30 },
      "actions": ["CREATE_ENTITY", "LINK_ALIAS"]
    }
  ],
  "proposedMutations": []
}
```

### 7.3 `POST /state/apply`
Purpose:
- Apply approved mutation commands transactionally.

Request:
```json
{
  "proposalId": "prop_123",
  "approved": true,
  "override": {
    "enabled": false,
    "reason": null
  }
}
```

Response:
```json
{
  "applied": true,
  "eventId": "evt_456",
  "beforeHash": "abc",
  "afterHash": "def"
}
```

### 7.4 `POST /entities/create`
Purpose:
- Persist entity from manual form or auto-draft payload.

Request:
```json
{
  "name": "Obsidian Cleaver",
  "type": "item",
  "aliases": ["heavy blade"],
  "attributes": { "durability": 100, "rarity": "rare" }
}
```

Response:
```json
{
  "entityId": "item_obsidian_cleaver",
  "created": true
}
```

## 8. TypeScript Interfaces (Reference)
```ts
export type EntityType =
  | 'character'
  | 'item'
  | 'location'
  | 'status_effect'
  | 'ability';

export type IntentType =
  | 'CONSUME_ITEM'
  | 'EQUIP_ITEM'
  | 'UNEQUIP_ITEM'
  | 'ATTACK_WITH_ITEM'
  | 'CAST_ABILITY'
  | 'MOVE_TO_LOCATION'
  | 'APPLY_STATUS'
  | 'REMOVE_STATUS';

export type IssueCode =
  | 'UNKNOWN_ENTITY'
  | 'AMBIGUOUS_REFERENCE'
  | 'STATE_CONFLICT'
  | 'INVALID_MUTATION';

export interface ProposalEntityRef {
  surface: string;
  type: EntityType;
  entityId?: string;
  confidence: number;
  span: { start: number; end: number };
}

export interface ProposalIntent {
  type: IntentType;
  actorId?: string;
  targetId?: string;
  params: Record<string, unknown>;
  confidence: number;
}

export interface GuardrailIssue {
  code: IssueCode;
  severity: 'blocking' | 'warning';
  message: string;
  span?: { start: number; end: number };
  actions: Array<'CREATE_ENTITY' | 'LINK_ALIAS' | 'CLARIFY_REFERENCE' | 'OVERRIDE'>;
}

export interface ValidationResult {
  allowCommit: boolean;
  issues: GuardrailIssue[];
  proposedMutations: MutationCommand[];
}

export type MutationCommand =
  | { type: 'decrement_inventory'; actorId: string; itemId: string; qty: number }
  | { type: 'set_location'; actorId: string; locationId: string }
  | { type: 'decrement_durability'; itemId: string; amount: number }
  | { type: 'apply_status'; actorId: string; statusId: string };
```

## 9. UI/UX Contract

### 9.1 Issue Highlighting
- Unknown entity: red underline.
- Ambiguous reference: yellow underline.
- Consistency conflict: orange underline.

### 9.2 Guardrail Panel
Displays:
- Blocking issues first.
- Suggested actions with one-click resolution.
- Mutation preview when available.

### 9.3 Undefined Entity Modal
Actions:
- Manual create form.
- LLM auto-draft (suggested fields only).
- Explicit user approval required before persistence.

### 9.4 Commit Behavior
- Commit disabled when blocking issues unresolved.
- Commit enabled when all blockers resolved or override accepted.

## 10. Consistency Rules (Initial Set)
- Broken leg prevents sprint-level movement.
- Item durability must be `> 0` before attack/use.
- Inventory quantity must be `>= requested qty` before consumption.
- Character must be co-located (or rule-allowed range) to interact physically.

Rules run inside `GuardrailEngine` before apply.

## 11. Failure States & Handling
- Unknown entity: block, offer create/link.
- Ambiguous reference: block, force clarification selection.
- State conflict: block by default, allow override with reason (configurable by rule severity).
- Extraction uncertainty: downgrade to warning only if no state mutation depends on it; otherwise block.

## 12. Observability & Audit
Record per proposal:
- Input text hash.
- Extracted refs/intents.
- Validation issues.
- Applied commands.
- Before/after state hashes.
- Override details (if any).

This event trail is required for debugging trust failures.

## 13. Rollout Plan
1. Phase 1: Unknown entity blocking, entity creation modal, deterministic apply.
2. Phase 2: Alias linking, ambiguity handling, confidence thresholds.
3. Phase 3: Consistency-rule engine + override/audit UX.
4. Phase 4: Performance optimization, telemetry dashboards, tuning.

## 14. Acceptance Criteria (V1)
- Unknown entities are always blocked pre-commit.
- No state mutation path bypasses typed command handlers.
- Narrative commit cannot occur before successful validation + apply.
- RAG retrieval path cannot read/write deterministic state fields.
- Every override produces an auditable event with reason.

## 15. Out of Scope (V1)
- Autonomous world simulation ticks.
- Multiplayer conflict resolution.
- Probabilistic state updates.
- Complex temporal reasoning beyond immediate proposal context.
