# Domain Model — Lore, Canon, State, and AI Proposals

Last updated: 2026-08-01

This is the domain specification authority. It consolidates the durable
contracts from `freeform-lore-ingestion-architecture.md`,
`canon-decision-workflow.md`, `customizable-state-model-spec.md`, and
`ai-assisted-item-authoring.md` (full originals, including design rationale
and historical implementation deltas, are preserved in `docs/archive/`).

Most of the lore/canon/state contracts below are implemented;
`PROJECT_STATUS.md` records what currently exists. Item authoring remains a
proposal. The standing trust rule for everything here:

> Models propose. Deterministic application code validates. Authors approve.

## 1. Lore and Canon Model

Three layers separate "written in notes" from "accepted as canon":

1. **`LoreDocument`** — author-facing free-form source of truth: dossiers,
   place histories, faction notes, timelines, imported `.docx`/`.txt`/`.md`.
   Stored immediately, links to characters/entities, never auto-canon.
2. **`FactProposal` / `LoreEntityProposal`** — internal, schema-validated,
   evidence-backed, confidence-scored interpretations extracted from lore
   documents. Never user-authored JSON; never a direct canon-write path.
3. **Accepted canon** — `CanonicalFact` records (plus alias storage and
   materialized `Character`/`WorldEntity` field updates) linked back to source
   document, evidence span, and acceptance metadata.

Key rules:

- The fact vocabulary (`alias`, `role`, `occupation`, `affiliation`,
  `relationship`, `species`, `heritage`, `trait`, `ability`, `appearance`,
  `belief`, `goal`, `timeline_marker`, …) is application-defined with
  deterministic per-type validation; do not grow it into an open ontology.
- Canon is dual-written: `CanonicalFact` is the authoritative machine-readable
  record; a curated subset materializes into user-facing fields and can be
  rebuilt from facts.
- Alias extraction is a special fact path that writes to alias storage on
  acceptance, keeping consistency matching and lore extraction aligned.
- Blocking consistency checks rely only on accepted canon (records, aliases,
  canonical facts, accepted state mutations) — never on raw lore text, which
  legitimately contains brainstorming and contradictions. Raw lore may appear
  as supporting context only.

### Retrieval integration

RAG document types: `scene`, `worldbible`, `rule`, `lore`, `canon_fact`.
Accepted facts index as compact factual summaries. For consistency
validation, retrieval prefers `canon_fact` > `worldbible` > `lore` > `scene`;
creative assistance may use a broader mix. Assistant context carries explicit
trust-tier labels (accepted canon, accepted canon facts, linked Source Notes,
general Source Notes, scene drafts, rules references), with a modest ranking
boost so accepted canon outranks Source Notes on close matches. Pending and
rejected proposals stay out of ordinary assistant context. Derived RAG/Shodh
indexes are rebuildable and never the source of truth.

## 2. Canon Decision Workflow

The layer between extraction and source-of-truth canon. Extraction is
aggressive about finding candidates; canon decision is conservative about
creating truth.

Flow: `extract -> cluster -> review -> decide -> apply -> reindex`.

- Deterministic clustering groups related candidates into small, comprehensible
  `DecisionCluster`s (entity identity, fact conflict, alias resolution) with
  confidence scores and reason codes (`exact_normalized_match`,
  `high_token_overlap`, `alias_collision`, `same_fact_type_same_target`, …).
  No mega-clusters; the LLM does not form clusters.
- Author resolutions: `merge`, `alias`, `keep_separate`, `accept_new`,
  `accept_update` (supersede), `reject`, `defer`. Each applies through
  deterministic handlers (merge helpers, alias storage, fact supersession).
- Suppression memory remembers `keep separate` / alias decisions so resolved
  pairs are not re-flagged without new evidence.
- LLM rubber-duck role is reasoning aid only: summarize a cluster, compare
  candidates, suggest options, draft wording. Forbidden: creating canon,
  silent merges, silent fact rewrites, resolving identity without author
  action.
- Extraction review ("is this worth tracking?") and canon decision review
  ("how does this fit into truth?") remain separate UI surfaces.

## 3. Manuscript-Time State Model

Answers "what is true at a specific point in the manuscript?" with three
layers: schema (ruleset stat/resource definitions plus tracked-state
metadata), snapshot (current known state), and timeline (accepted mutation
events in manuscript order). Canon says what exists; state says what can
change; the mutation ledger says when it changed.

- Tracked fields come from existing ruleset `statDefinitions` /
  `resourceDefinitions` — no parallel field-definition system.
- Field taxonomy: snapshot stats, resources (current/max), statuses,
  inventory/equipment, descriptive state (location, allegiance, disguise).
- Command set (typed, explicit, `set` vs `change` never conflated):
  `resource_set`, `resource_change`, `stat_set`, `stat_change`,
  `status_apply`, `status_remove`, `inventory_add`, `inventory_remove`,
  `inventory_consume`, `inventory_equip`, `inventory_unequip`, `location_set`.
- `StateMutationEvent`s are scene-scoped, explicitly ordered
  (`sceneOrder` → `sceneSequence` → `sourceRevision` → `createdAt`),
  replayable, and invalidatable when source scenes change; invalidated events
  stay in the ledger for audit but are ignored in replay.
- Replay: accepted events only, applied over a `CharacterSheet`-derived
  baseline; last accepted set-style command wins, additive commands
  accumulate, invalid commands are rejected before persistence.
- Proposal layer (manual, deterministic extraction, or local LLM — with
  confidence/evidence/status) is strictly separate from the accepted mutation
  ledger. LLM integration affects proposal generation only; it never changes
  the event schema, replay rules, or ordering.
- Subject scope is character-first; the event schema permits later expansion
  to locations, factions, items, and world.

## 4. AI Proposal Boundary and Item Authoring

_Status: item authoring is a product proposal (2026-07-26); the shared
proposal boundary is the reusable pattern for all author-invoked AI actions._

Description-first authoring: the author describes an item in prose, saves it
with or without AI, and optionally gets a compact evidence-backed proposal —
never a full form to page through. Items are the pilot domain; the same
envelope should later serve stats/resources, statuses, recipes, milestones,
and (last, highest-risk) typed rules and formulas, each behind its own domain
adapter, resolver, and fixture suite.

The common proposal envelope carries: untouched source text, domain, contract
version, operation (create/update/unresolved), target and possible matches,
proposed values, resolved project definitions, evidence spans, origin
classification (`explicit` / `derived` / `suggested` — suggested values never
mixed in as if author-stated), confidence, deterministic validation results,
unresolved terms, and the destination of each accepted change.

Validation boundary (model output is untrusted input): strict versioned
schema, discard out-of-contract fields, verify evidence spans, resolve
references against the active ruleset/project, validate types and ranges,
detect duplicate/ambiguous matches, compute the create/update diff
deterministically. Schema-valid ≠ canon-correct; author approval remains
required. Provider failures degrade to editable text or retry — malformed
output is never repaired and silently committed.

The most important failure metric is **unsupported confident invention**: a
useful model may miss optional fields; it must not quietly create false canon.
Build a fixture suite of realistic item descriptions and evaluate each
provider before product commitment.

Delivery slices (detail in `docs/archive/ai-assisted-item-authoring.md`):

1. Description-first manual creation (no AI required)
2. Basic identity and explicit-value extraction
3. Project-aware mechanics mapping
4. Existing-item update diff
5. Workspace-to-item and state-event handoff (item definition changes stay
   separate from character acquisition/equipment/consumption events)
6. Advanced conditional mechanics — only after fixture evaluation

Non-goals: automatically designing balanced items or whole rulesets, inferring
genre-standard mechanics as canon, JSON as an author-facing format, requiring
a hosted model for basic authoring, auto-creating stats/resources/rules/slots.
