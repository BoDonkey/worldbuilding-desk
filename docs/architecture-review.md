# Architecture Reference — Worldbuilding Desk

Last reviewed: 2026-07-26

## Purpose

This document records durable architecture boundaries and current structural
risks. It is not a completed-work log or sprint roadmap.

Use:

- `PROJECT_STATUS.md` for the current implementation snapshot
- `docs/road-to-market.md` for execution order
- `docs/domain-model.md` for detailed domain contracts
- `docs/archive/architecture-review-2026-05-10.md` for the prior point-in-time
  review and its completed action history

## System Shape

Worldbuilding Desk is a local-first writing application with:

- `apps/web`: React authoring UI and application orchestration
- `apps/desktop`: Electron host and privileged provider/network bridge
- `packages/rules-engine`: framework-independent rules and state logic
- `packages/rules-ui`: reusable React integration for rules-engine concepts

The writing workspace is the primary product surface. Canon, AI, retrieval, and
LitRPG mechanics support the writing flow rather than owning it.

## Domain Ownership

| Concern | Owner |
| --- | --- |
| Manuscript scenes and writing flow | Writing Workspace |
| Canonical identities and world records | World Bible |
| Longform source material and exploratory notes | Lore Documents |
| Candidate facts and entity interpretations | Proposal/review layer |
| Accepted machine-readable truth | Canonical facts plus canon records |
| Character runtime state through the manuscript | State mutation ledger and replay |
| Optional progression/system behavior | Ruleset and Compendium |
| Derived retrieval context | RAG and Shodh indexes |

Derived indexes are rebuildable and must not become the only source of truth.

## Trust Boundary

The standing rule is:

> Models propose. Deterministic application code validates. Authors approve.

Model output is untrusted input even when it satisfies a JSON schema.

Any model-proposed mutation must pass through:

1. a versioned runtime schema
2. project-aware reference resolution
3. domain validation
4. a deterministic create/update diff
5. an editable author review
6. an explicit acceptance action

Providers may have different structured-output, tool-calling, streaming,
context, and sampling capabilities. Product workflows should depend on a
provider-neutral proposal/action contract rather than native provider behavior.

Unsupported or malformed model output must degrade to editable text, an
unresolved proposal, or a retry. It must not be repaired and silently committed.

## Canon and Lore Boundary

Lore Documents preserve author-written source material. Extraction may produce
entity and fact proposals with evidence and confidence. Accepted proposals may
create or update canon through app-owned services.

Normal assistant context should distinguish:

- accepted canon
- accepted canonical facts
- linked Source Notes
- general Source Notes
- scene drafts
- rules references

Pending and rejected proposals are excluded unless the author enters an
explicit proposal-review workflow.

Primary reference: `docs/domain-model.md` (§ lore/canon model and canon
decision workflow).

## Ruleset and State Boundary

Project rulesets define available stats, resources, templates, and typed game
rules. Character state records runtime values, inventory, equipment, statuses,
and custom data.

Manuscript-time changes belong in ordered, scene-scoped mutation events.
Accepted events can be replayed to derive state at a point in the manuscript.
Proposal extraction must remain separate from accepted mutation persistence.

Do not create parallel field-definition or item-schema systems when the current
ruleset/state models can be extended.

Primary reference: `docs/domain-model.md` (§ state model and AI proposal
boundary).

## Persistence

Primary project data is stored locally through IndexedDB-backed services.
Application and workspace UI preferences use Zustand with persistence where
appropriate. Components should not introduce new direct persistence paths when
an owning service or store already exists.

Project backup is the portability boundary. Derived RAG/Shodh data may be
rebuilt from primary records.

Current structural risk:

- persisted records and snapshots need an explicit schema-version and migration
  contract before further high-impact shape changes

## Application Boundaries

### Web UI

Routes compose workflows and presentation. Domain transformations, matching,
validation, persistence, and replay should live in services or framework-neutral
helpers rather than growing inside route components.

Large routes should be decomposed incrementally around coherent workflows.
Avoid broad rewrites that move complexity without clarifying ownership.

### Desktop host

The Electron process owns privileged operations and provider streaming that
cannot safely live in the renderer. Keep the IPC surface narrow, validate
payloads at the boundary, and allow external URLs only through an explicit
scheme/host policy.

### Rules engine

The rules engine remains framework-independent and testable without React.
Rules UI should adapt engine concepts for authoring without moving domain logic
into components.

## UI Architecture

The application uses shared theme tokens in
`apps/web/src/styles/theme.css`. Component styles must use the established
token vocabulary rather than one-off variables or hardcoded colors.

Shared page chrome, dialogs, alerts, focus behavior, and form primitives should
be reused across routes. The product must remain operable at the mobile
breakpoint and by keyboard.

Design authority: `docs/product-blueprint.md` (design system and
navigation/IA sections).

## Verification Strategy

Use layered verification:

- type checking and lint for static correctness
- unit tests for schemas, services, matching, state replay, and transformations
- rules-engine tests for deterministic mechanics
- web and desktop builds for integration
- focused browser smoke for author workflows
- packaged desktop validation for IPC, provider streaming, file operations, and
  external links

Smoke coverage should target trust and data-loss boundaries rather than mirror
every visual detail.

## Current Architecture Risks

1. Persisted schema versioning and migrations are incomplete.
2. Several route components still own too much workflow state and orchestration.
3. Provider capabilities are not yet normalized behind one proposal/action
   contract.
4. Ruleset collections still contain weakly typed areas that should be tightened
   before advanced AI generation.
5. Electron and transformer dependencies need supported upgrade paths.
6. Some assistant/retrieval behavior still needs realistic provenance testing.

These risks are prioritized and scheduled in `docs/road-to-market.md`.

## Change Rule

Update this document only when a durable architecture boundary changes.

Implementation status belongs in `PROJECT_STATUS.md`; execution tasks belong in
`docs/road-to-market.md`; point-in-time audits and completed plans belong in
`docs/archive/`.
