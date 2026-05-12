# Consistency Engine Implementation Plan (Tickets + Positioning)

_Last updated: February 25, 2026_

## Objective
Ship Guardrails V1 as a **Consistency Engine**: a deterministic validation and state-enforcement layer that prevents narrative/state drift.

This plan translates [`docs/guardrails.md`](/Volumes/T7/Development/worldbuilding-desk/docs/guardrails.md) into engineering tickets with acceptance gates and evidence artifacts that directly address "AI slop" criticism.

## Messaging Pillars (Product + Technical)
- Deterministic state mutations only (no freeform LLM state changes).
- Pre-commit blocking on unknown/ambiguous/conflicting state assertions.
- Human approval for entity creation and conflict overrides.
- Full audit trail for every accepted/rejected mutation.

## Phase Plan
1. Phase 1: Guardrail skeleton + unknown entity blocking.
2. Phase 2: Alias/canonicalization + ambiguity resolution.
3. Phase 3: Consistency rules + override audit.
4. Phase 4: Hardening, QA, and proof artifacts for launch messaging.

## Epic A: Guardrail Core Pipeline
Branch: `codex/consistency-engine-core-pipeline`

### A1. Proposal extraction service
Estimate: 2-3 days  
Owner: Backend

Deliverables:
- `POST /proposal/extract` implementation.
- Proposal persistence (`proposals` table).
- Structured extraction payload: entity refs, intents, unresolved spans.

Acceptance criteria:
- Returns stable schema for deterministic parser output.
- Handles both user text and LLM draft source types.

### A2. Validation gate service
Estimate: 2-3 days  
Owner: Backend

Deliverables:
- `POST /proposal/validate` implementation.
- Guardrail issue model with `UNKNOWN_ENTITY`, `AMBIGUOUS_REFERENCE`, `STATE_CONFLICT`, `INVALID_MUTATION`.

Acceptance criteria:
- Unknown entities always return blocking issue.
- `allowCommit` false when blocking issues exist.

### A3. Apply-before-commit workflow
Estimate: 2 days  
Owner: Backend + Editor Integration

Deliverables:
- `POST /state/apply` implementation.
- Commit orchestration: validate -> apply -> commit only.

Acceptance criteria:
- No narrative commit path bypasses apply step.
- Failed apply prevents commit and surfaces actionable error.

## Epic B: Deterministic State Engine
Branch: `codex/consistency-engine-state-commands`

### B1. Typed mutation command handlers
Estimate: 3-4 days  
Owner: Backend

Deliverables:
- Command handlers for V1 intents:
  - `decrement_inventory`
  - `set_location`
  - `decrement_durability`
  - `apply_status`
- Transaction wrapper and invariant checks.

Acceptance criteria:
- LLM never writes final numeric state values.
- Preconditions enforced (inventory >= qty, durability > 0, etc.).

### B2. State hashing + snapshot consistency
Estimate: 1-2 days  
Owner: Backend

Deliverables:
- Before/after state hashes on each mutation event.
- Replay-safe mutation event format.

Acceptance criteria:
- Mutation events store before/after hash for every successful apply.

## Epic C: Entity Canonicalization and Clarification
Branch: `codex/consistency-engine-canonicalization`

### C1. Alias model and lookup
Estimate: 2 days  
Owner: Backend

Deliverables:
- `entity_aliases` schema + lookup service.
- Confidence-based canonicalization API.

Acceptance criteria:
- High-confidence match resolves automatically.
- Low-confidence/multiple matches return `AMBIGUOUS_REFERENCE`.

### C2. Undefined entity creation flow
Estimate: 2-3 days  
Owner: Frontend + Backend

Deliverables:
- `POST /entities/create` endpoint.
- Undefined entity modal with manual form + optional auto-draft.

Acceptance criteria:
- Entity is never auto-persisted without explicit user approval.
- After create/link, validation can succeed without text rewrite.

## Epic D: Consistency Rules and Overrides
Branch: `codex/consistency-engine-rules-overrides`

### D1. Rule engine scaffolding
Estimate: 2-3 days  
Owner: Backend

Deliverables:
- Rule interface and runner in `GuardrailEngine`.
- Initial rules from spec (`broken leg`, `durability`, `inventory`, co-location).

Acceptance criteria:
- Rule violations produce `STATE_CONFLICT` with span and rule key.

### D2. Override workflow
Estimate: 2 days  
Owner: Frontend + Backend

Deliverables:
- UI override action with required reason input.
- Backend override policy enforcement and audit logging.

Acceptance criteria:
- Override without reason is rejected.
- Every override is tied to actor + timestamp + rule key.

## Epic E: UI Guardrail Experience
Branch: `codex/consistency-engine-ui-guardrails`

### E1. Inline issue highlighting
Estimate: 2 days  
Owner: Frontend

Deliverables:
- Color-coded issue spans (red/yellow/orange).
- Click-to-focus issue and panel synchronization.

Acceptance criteria:
- Spans render consistently after text edits and re-validation.

### E2. Guardrail panel + mutation preview
Estimate: 2-3 days  
Owner: Frontend

Deliverables:
- Blocking-first issue list.
- Proposed mutation preview component.

Acceptance criteria:
- Users can resolve each issue via panel actions.
- Commit button disabled while blockers remain.

## Epic F: Evidence, QA, and Launch Proof
Branch: `codex/consistency-engine-proof-and-qa`

### F1. Test matrix for anti-slop guarantees
Estimate: 2 days  
Owner: QA + Backend

Deliverables:
- Scenario tests:
  - Unknown entity blocks commit.
  - Ambiguity blocks until clarified.
  - State conflict blocks or requires override reason.
  - RAG retrieval cannot mutate state.

Acceptance criteria:
- All guardrail scenarios pass in CI.

### F2. Audit export/report
Estimate: 1-2 days  
Owner: Backend

Deliverables:
- Exportable mutation/override audit report.
- Basic metrics: blocked commits, overrides, resolution times.

Acceptance criteria:
- Can generate report showing deterministic enforcement activity.

### F3. Positioning-ready demo script
Estimate: 0.5-1 day  
Owner: Product + Engineering

Deliverables:
- Repeatable scripted demo showing:
  - Unknown entity hard block.
  - Manual approval flow.
  - Deterministic mutation and audit trace.

Acceptance criteria:
- Non-technical viewer can see why this is not unconstrained generation.

## Cross-Cutting Implementation Tasks
- Add feature flag: `consistencyEngineV1`.
- Add telemetry events (local analytics):
  - `proposal_validated`
  - `guardrail_issue_raised`
  - `override_submitted`
  - `mutation_applied`
- Add migration scripts for all new tables.
- Add developer docs for endpoint contracts and local test fixtures.

## Suggested Delivery Order (2-week sprint framing)
1. Week 1: A1, A2, B1, E1.
2. Week 2: A3, C1, C2, D1, E2.
3. Week 3 (stabilization): D2, B2, F1, F2, F3.

## Definition of Done (Consistency Engine V1)
- Guardrail checks run on every commit attempt.
- Blocking issues prevent commit reliably.
- All state mutations route through typed command handlers.
- Manual approval required for new entities and overrides.
- Audit record available for every mutation/override event.
- Demo script + QA matrix proves deterministic enforcement behavior.

## Public-Facing Claims Supported by This Plan
- "The system enforces world consistency before text is accepted."
- "State changes are deterministic and auditable, not improvised by the model."
- "Authors remain in control of all unresolved entities and exceptions."
