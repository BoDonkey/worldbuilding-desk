# Architecture Reference — SagaSpine

Last reviewed: 2026-10-06

## Purpose

This document records durable architecture boundaries and current structural
risks. It is not a completed-work log or sprint roadmap.

Use:

- `PROJECT_STATUS.md` for the current implementation snapshot
- `docs/road-to-market.md` for execution order
- `docs/domain-model.md` for detailed domain contracts
- `docs/archive/architecture-review-2026-10-06.md` for the latest
  point-in-time code health review and its evidence
- `docs/archive/architecture-review-2026-10-03.md` and
  `docs/archive/architecture-review-2026-09-26.md` for the prior reviews
- `docs/archive/architecture-review-2026-05-10.md` for the earlier
  point-in-time review and its completed action history

## System Shape

SagaSpine is a local-first writing application with:

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
Ollama is an on-device provider path only when the configured endpoint is
loopback and the selected model is verified local; remote endpoints and Ollama
cloud models cross the egress boundary and must not inherit local-provider
claims or policy.

One provider-route classification (`services/llm/providerRoute.ts`) drives
the data-flow disclosures and consultation accounting: `private-local` only
for loopback Ollama with a model that `/api/tags` lists as installed and not
cloud; anything unverified is disclosed and budgeted as remote. The request
policy enforces the same rule before any text is sent: the desktop main
process (and the browser build's Ollama provider) reads `/api/tags`, refuses
cloud and not-installed models, and auto-selects only local models. Remote
Ollama addresses are blocked outright. There is no opt-in for Ollama cloud
models; private mode is the only mode.

Provider API keys belong to the desktop main process. They are encrypted with
the operating system keychain (Electron `safeStorage`) and stored under the
app's user data folder; when OS encryption is unavailable the app refuses to
save a key rather than storing plaintext. The renderer can only set, clear, or
ask which providers have a key, and never reads one back. Every provider
request, Gemini included, runs in the main process, which attaches the key and
refuses requests whose payload carries one. Provider addresses pass a
scheme/host policy at the IPC boundary: hosted providers only over HTTPS to
their own origin, Ollama (and an explicitly local OpenAI-compatible server)
only on loopback. The browser-only dev build keeps keys in browser storage
behind the same `providerKeyStore` module.

The packaged renderer runs under a Content-Security-Policy that allows code
only from the app and network requests only to loopback and to the hosts the
in-app embedding model and its runtime are downloaded from (Hugging Face and
jsDelivr). Those downloads carry no author content. Hosted AI providers are
not reachable from the renderer at all.

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

A change that spans several stores and must not be left half-done — accepting
or removing canon is the main case — commits through
`runProjectWriteTransaction` (`services/storage/projectWriteTransaction.ts`):
read with the ordinary getters, plan in plain code, then write every record in
one `readwrite` transaction using each store's `…InTransaction` writer, which
keeps that store's validation and change event. Change events fire only after
commit. Derived indexes (retrieval, memory) update after the commit and can
be rebuilt; bookkeeping such as resolving a canon-decision cluster may follow
as a separate step, because leaving it open is safe.

Project backup is the portability boundary. Derived RAG/Shodh data may be
rebuilt from primary records.

Roadmap Slice 5.15 adds an optional project-vault boundary. A vault must cover
every project-owned persistence service and persistent derivative, not only
document content. A random per-project data key encrypts records with
authenticated encryption; a versioned passphrase-derived key wraps that data
key so passphrase changes do not require rewriting the project. Only the
minimal versioned unlock manifest may remain outside the vault. Plaintext may
exist in process memory while unlocked, but no component may introduce a
parallel plaintext persistence path, preview, cache, search index, recovery
copy, or migration backup.

Vault enablement and disablement are verified, rollback-safe migrations. The
encrypted copy must be complete and readable before plaintext removal;
failure or cancellation leaves the original representation unchanged. The
normal pre-migration backup rule below does not authorize a plaintext backup
while enabling a vault. There is no application or hosted passphrase-recovery
path.

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

The Electron process owns privileged operations, provider credentials, and
every provider request. Keep the IPC surface narrow (`llm:*` and
`provider-keys:status|set|clear`), validate payloads at the boundary, allow
provider addresses and external URLs only through explicit scheme/host
policies, and keep the main window on the renderer (`will-navigate` guard).
The desktop package is linted and unit-tested like the other workspaces.

### Rules engine

`packages/rules-engine` is framework-independent and testable without React.
It owns the live manuscript-time state core (`src/manuscript/`), the ruleset
and game-rule schemas, and the rule evaluation classes (`RulesEngine`,
`ConditionEvaluator`, `EffectApplicator`, `FormulaParser`). Rules UI adapts
engine concepts for authoring without moving domain logic into components.

- Formulas are evaluated by a restricted mathjs instance; functions that can
  evaluate code or modify the instance are disabled inside expressions. Keep
  it that way before evaluating any author- or model-supplied formula.
- Wall-clock simulation (`StateManager`, effect timers, exposure tracking)
  lives under the non-exported `src/experimental/` path. Nothing in the app
  may import it until those concepts are rebuilt on manuscript time.
- Design reference for later rule work (derived values, rule-proposed
  commands, rule-based continuity checks):
  `docs/archive/rules-engine-plan.md`.

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

1. The shared assistant still combines provider lifecycle, retrieval,
   factual gating, pending-proposal policy, model execution, consultation
   accounting, coaching, conversation persistence, and presentation. That
   fragmented request policy let ordinary assistant calls bypass the project
   consultation budget. Slice 3.17 centralizes the boundary.
2. The Ask route's pending-proposal opt-in has no explicit loading or error
   state, so a request can silently omit the context the author just enabled.
   Slice 1.4a makes the opt-in fail closed after 3.17.
3. The rule evaluation classes are tested and hardened (Slice 3.11) but no
   app path uses them yet; wiring them in (backlog R3–R5) must keep rule
   output to derived views and author-confirmed proposals.
4. The hotspot freeze from Slice 3.14 holds, and Slice 3.16 split
   `useWorkspaceConsistency`; several route components remain over 1,500
   lines, especially World Bible, Character Sheets, Workspace, Lore, and
   Compendium. Continue incremental responsibility-based extraction rather
   than broad rewrites.
5. Provider capabilities are not yet normalized behind one proposal/action
   contract.
6. Some assistant/retrieval behavior still needs realistic provenance testing.
7. Remaining egress worth watching is the embedding-model download from
   Hugging Face/jsDelivr; it carries no author content.

Evidence for risks 1–2 and the current hotspot state:
`docs/archive/architecture-review-2026-10-06.md`. Prior hardening evidence:
`docs/archive/architecture-review-2026-10-03.md`. Scheduled in
`docs/road-to-market.md`: risk 1 as Slice 3.17 and risk 2 as Slice 1.4a.

## Change Rule

Update this document only when a durable architecture boundary changes.

Implementation status belongs in `PROJECT_STATUS.md`; execution tasks belong in
`docs/road-to-market.md`; point-in-time audits and completed plans belong in
`docs/archive/`.
