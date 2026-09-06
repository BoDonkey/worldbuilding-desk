# Domain Model — Lore, Canon, State, and AI Proposals

Last updated: 2026-08-30

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

1. **`LoreDocument`** — author-facing free-form source material: dossiers,
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
- Canon-grounded consistency checks rely only on accepted canon (records,
  aliases, canonical facts, accepted state mutations) — never on raw lore
  text, which legitimately contains brainstorming and contradictions. Raw lore
  may appear as supporting context only. Consistency findings remain advisory
  and never block drafting.

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

Bundled writing-craft references are not another project RAG document type in
the trust hierarchy above. A `craft` chunk belongs to a separate, read-only,
coach-scoped corpus. It is instructional reference material: never canon,
never a Source Note, never project evidence, and never eligible to answer a
factual question about the author's world. Only an explicit coaching request
may retrieve it and pair it with separately cited manuscript evidence.

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

## 4. Character Identity Contract

_Status: adopted target contract. `PROJECT_STATUS.md` records which parts are
implemented; `docs/road-to-market.md` owns the migration and delivery order._

Authors have one character identity: a `WorldEntity` in a character-kind
World Bible category. Dialogue styling, sheets, state, and transfer are
optional capabilities attached to that identity by stable IDs, not separate
author-facing identities.

### Identity and capability records

- **`WorldEntity` is the sole character identity.** `EntityCategory.kind`
  explicitly distinguishes `'character'` from `'general'`; custom category
  names and slugs remain free-form. Canonical name, aliases, accepted facts,
  provenance, review state, and lore links key off `entity.id`.
- **`Character` narrows to an extension record.** New records require an
  `entityId` foreign key and retain only capability data that has no canon
  home, currently `characterStyleId`. Legacy descriptive fields may remain
  readable during migration but do not own name, description, age, role, or
  notes. Creating or deleting an extension never creates, renames, or deletes
  canon.
- **`CharacterSheet` attaches to canon directly.** New sheets require
  `characterEntityId`, unique per project and entity. `characterId` is a
  legacy-read compatibility field; sheet display names derive from canon.
  A character may exist without a sheet. A sheet cannot create a hidden
  identity: if no canon record exists, creating one is an explicit author
  action first.
- **State events use canonical actor identity.** New commands store the
  character entity ID as `actorId`. Accepted ledger events are immutable; a
  persisted actor-resolution map translates legacy character and sheet IDs to
  entity IDs during replay. Name-based actor matching is not part of the
  target model.
- **Facts, aliases, and lore links converge on entities.** All new writes use
  the `entity` target. The legacy `character` target remains a compatibility
  adapter only and resolves through the same identity map until retired.
- **Parent/child inheritance covers canon only.** Inherited entities remain
  read-only context. Character extensions, sheets, and state ledgers do not
  inherit; importing a prior end state as a new baseline requires a future
  explicit author action.

One tested character link resolver owns entity ↔ extension ↔ sheet ↔
legacy-ID resolution for roster, capture, review linking, health, inspector,
grounding, and other consumers. Surfaces must not recreate normalized-name
joins. Legacy records are classified exactly once as `already-linked`,
`unambiguous-same-identity`, `tools-only-orphan`, `world-bible-only`,
`ambiguous-collision`, or `sheet-only`. Unresolved records remain usable where
safe but are never presented as canon or assistant grounding.

### Migration invariants

1. **Versioned and idempotent.** Character migration runs under the persisted
   schema-version contract, takes an automatic backup first, and uses restore
   as rollback.
2. **No silent merges.** Automatic linking is allowed only for an exact
   normalized-name match that is unique on both sides within character-kind
   categories. Every other collision enters author resolution.
3. **No canon invention.** Migration never creates a `WorldEntity`; only an
   explicit author action can create canon.
4. **Ledger immutability.** Accepted `StateMutationEvent`s are never rewritten;
   legacy identity resolves through the actor-resolution map.
5. **Replay parity.** For each linked character, replayed state at every scene
   is byte-identical before and after migration.
6. **Rename stability.** Renaming canon after migration changes no identity
   linkage.
7. **Conservation.** Every legacy character-related record receives exactly
   one classification, and migration-report totals reconcile with store
   counts.
8. **Backup completeness.** Snapshot v2 includes consistency aliases and all
   new link fields. Snapshot v1 and character-package v1 remain importable
   through the classifier; round-trip preserves counts, links, and replay.

These rules preserve the trust boundary: deterministic code classifies and
validates possible links; the author resolves ambiguity and creates canon.

## 4.1 System Negative-Space Records

Mechanics-enabled projects have one explicit built-in World Bible category
whose `recordType` is `system-negative-space`. Its records capture problems
that character progression cannot solve. The category identity comes from the
typed field, never from its editable display name or slug. General-fiction
projects do not expose this category.

Each record remains a normal `WorldEntity` for canon, retrieval, aliases, and
Source Note linking, with an additional author-maintained
`systemNegativeSpace` structure:

- `status`: `open`, `worsening`, `changed`, or `resolved`;
- `sceneIds`: unique stable IDs of explicitly linked manuscript scenes.

Deterministic code validates statuses, removes duplicate links, discards links
to missing scenes, and may summarize counts and linked sources. It must not
infer that prose meaningfully engages the problem or that a power has quietly
solved it. Those are semantic conclusions and remain author-triggered,
model-assisted observations subject to the normal proposal trust boundary.

Project storage and backup snapshot schema 5 register the additive category
and entity fields. Migration leaves existing categories and records
unclassified and unlinked; it never guesses author intent.

## 5. AI Proposal Boundary and Item Authoring

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

### Prose-proximate item and state handoff

_Status: accepted product/domain direction (2026-08-16); implementation is
owned by roadmap Slice 4.16._

Item prose can initiate three related but independent outcomes:

1. **Reusable identity/canon.** A World Bible item answers what the item is in
   the setting. Creating one is optional and author-confirmed; ordinary or
   one-off inventory objects need not become canon.
2. **Reusable mechanics.** A Compendium consumable/effect definition answers
   what the item does when used. It may link to a canonical item, but it is
   never created merely because an entity was detected and no effect value is
   inferred from genre convention.
3. **Manuscript-time occurrence.** One or more `StateMutationEvent` commands
   answer what happened to a character at a specific point: acquire, consume,
   equip, change a stat/resource, or apply a status. These events do not edit
   the reusable item definition.

The workspace handoff follows these rules:

- Evidence such as `Bill found a health potion` may prepare an inventory-add
  proposal. State-only tracking is the default; `Save as a reusable world
  item` is an explicit option, not a prerequisite.
- Evidence such as `Bill drank a health potion` may prepare a consumption
  proposal. An exact, stable link to previously approved mechanics may
  prefill inventory and stat/resource effects. If no mechanics exist, the
  author can choose an existing tracked attribute, select `Change by` or `Set
  to`, enter the value, and explicitly choose whether to remember that effect
  for later uses.
- Selection or cursor context supplies the evidence span and scene position;
  known character, sheet, scene, item, and current replayed values are
  preselected. The author sees the complete before/after result and may edit
  every proposed destination before confirming without leaving Workspace.
- One confirmation may run a deterministic, rollback-safe orchestration that
  creates or links the explicitly requested reusable records and then writes
  the accepted scene event. Validation failure leaves all destinations
  unchanged; cancellation writes nothing.
- Exact unique matches may resolve automatically for proposal preparation.
  Ambiguous item/canon/mechanics matches require author resolution and never
  silently merge. Stable IDs, not display names, carry accepted links through
  later renames.
- State-only inventory entries may remain name-based quick entries. Once the
  author links or creates a reusable World Bible item or mechanics definition,
  the accepted inventory command/state retains the corresponding stable
  reference; display labels resolve from the linked definition. Backup,
  import, replay, and rename behavior must preserve those references.
- If consumption is proposed for an item absent from replayed inventory, the
  author chooses `Add one and consume it`, `Consume without inventory
  tracking`, or cancel. The application does not invent an acquisition event.
- Later scene edits make affected proposals stale and use the existing
  invalidation/review behavior. Accepted ledger events remain immutable and
  reusable definitions are not deleted or rewritten as a side effect.

Deterministic phrase detection is sufficient for the basic path; model help
may broaden proposal generation only through the same evidence, schema,
validation, and author-approval boundary.

Non-goals: automatically designing balanced items or whole rulesets, inferring
genre-standard mechanics as canon, JSON as an author-facing format, requiring
a hosted model for basic authoring, auto-creating stats/resources/rules/slots.

## 6. Writing Coach and Derived Analysis

_Status: accepted product/domain direction (2026-08-30); implementation is
owned by roadmap Slices 4.17–4.22._

The writing coach combines two explicitly different source roles:

1. **Craft reference** explains a vetted pattern and carries its own citation,
   content version, confidence, applicability, detectability, and scope.
2. **Manuscript evidence** shows what the author's draft or accepted structured
   data contains and cites the scenes or records inspected.

The coach must never turn a craft claim into story truth or present library
text as something established in the author's project. Coaching is
author-triggered. A response is read-only advice; only a separate save/apply
action enters the shared proposal → validation → preview → confirmation flow.

Detectability has three meanings:

- **`deterministic`** — the complete observation is computed from explicit
  stored inputs, with no semantic inference. It names those inputs.
- **`model-assisted`** — deterministic code may shortlist evidence, but a model
  interprets narrative meaning. The note says it is an interpretation and
  cites the evidence considered.
- **`practice`** — advice about author behavior or publishing activity that is
  not present in manuscript text. The coach may teach it but must not claim to
  have checked the draft for it.

Absence of a lexical or structured reference is not proof of narrative
absence. Whether an ability would solve a scene, a character has meaningful
agency, a human problem was solved by power, or an in-world reason is adequate
is model-assisted unless the author explicitly recorded the decisive relation.

Derived dashboard observations are read-only and distinct from authored
Corkboard records. Stable links, not title or order heuristics, connect plans
to scenes. Persisted link additions follow the storage-version, backup, and
migration contracts before any comparison relies on them.
