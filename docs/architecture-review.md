# Architecture Reference — Worldbuilding Desk

Last reviewed: 2026-08-30

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

Factual assistant requests cross an evidence gate before provider prompting.
Deterministic code may answer from an unambiguous accepted fact or explicit
saved passage; otherwise the request fails closed with the retrieved sources
reviewed. Unverified factual wording must never fall through to creative prompt
tools or provider generation. Explicitly creative and analytical requests remain
eligible for provider collaboration.

## Privacy and Data Egress

Primary project data, manuscripts, derived indexes, and diagnostics stay on
the author's computer. The application has no diagnostic telemetry or
automatic crash-report upload path and does not use author content for model
training.

Network egress containing author content is allowed only for an explicit
author-invoked request to a hosted provider configured for that project. The
request boundary must identify the destination, send only the context required
for the chosen action, and remain fully optional. Background review, indexing,
health checks, migrations, and error handling do not call hosted providers.
Ollama remains the on-device provider path.

Technical errors remain local. A support workflow may produce a redacted,
copyable diagnostic, but it must exclude manuscript text, API keys, provider
request/response bodies, and local file paths and must never transmit itself.

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

The bundled craft library is a separate read-only reference corpus, not project
context, Source Notes, accepted canon, or factual evidence. It uses a
coach-scoped provider rather than the ordinary project `CompositeRAGService`.
Craft chunks are excluded from factual evidence gates, normal assistant
retrieval, canon decisions, project context-health diagnostics, backup, and
project deletion. Coaching may combine craft references with manuscript
evidence only inside an explicit author-triggered coaching request, with each
source labeled by role.

Bundled craft embeddings carry model, version, dimensions, normalization, and
content-version metadata. Query-time embeddings must be compatible. If the
compatible model is unavailable, retrieval falls back to lexical search rather
than comparing vectors produced by different contracts.

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

IndexedDB's structural `DB_VERSION`, per-project `storageSchemaVersion`, and
portable project-snapshot `schemaVersion` are separate contracts. Opening a
project runs the deterministic per-project migration chain before consumers
read project data. Migrations advance exactly one version, are idempotent, and
checkpoint only after success; a recoverable project-scoped IndexedDB backup
is captured before the first step. Projects or backups written by a newer app
fail closed with an update instruction. Snapshot imports run their own
ordered compatibility chain before validation and persistence.

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

1. Several route components still own too much workflow state and orchestration.
2. Provider capabilities are not yet normalized behind one proposal/action
   contract.
3. Ruleset collections still contain weakly typed areas that should be tightened
   before advanced AI generation.
4. Electron and transformer dependencies need supported upgrade paths.
5. Some assistant/retrieval behavior still needs realistic provenance testing.

These risks are prioritized and scheduled in `docs/road-to-market.md`.

## Change Rule

Update this document only when a durable architecture boundary changes.

Implementation status belongs in `PROJECT_STATUS.md`; execution tasks belong in
`docs/road-to-market.md`; point-in-time audits and completed plans belong in
`docs/archive/`.
