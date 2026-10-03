# Domain Model — Lore, Canon, State, and AI Proposals

Last updated: 2026-09-23

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

`WorldCanvasDocument` sits outside these three layers. It is optional,
project-scoped exploratory planning: a compatible persisted `premise` presented
as Core Idea, author-opened lenses containing stable repeatable sketches, and
Open Threads. Sketches preserve explicit destinations to Source Notes, Open
Threads, and World Bible records; Open Threads retain open/settled/set-aside
history. It is never canon, never an extraction source, never indexed for
retrieval, and never written into World Bible records, canonical facts, or
state. Moving a Canvas idea into canon requires the same explicit author
action and validation as any other proposal or source material.

Keeping Canvas material as a Source Note creates a provenance-marked snapshot
through the normal `LoreDocument` and indexing path; later Canvas edits never
rewrite that note. A canon anchor opens the normal author-selected World Bible
create flow and records only a backlink after the author saves the record. It
does not accept factual assertions. The ordinary World Bible concept/setting
record remains the owner for an overarching canon anchor; there is no separate
World Foundation canon object.

The Canvas Reference Palette is a derived view over those existing stable
links plus deterministic project-record suggestions. A palette pin reuses the
Canvas link arrays; it does not copy source text or create a second record.
World Bible references retain their accepted-canon trust label, Source Notes
retain their source-material label, and missing targets remain explicit until
the author unpins them. Suggestions never become links without an author
action and are not added to retrieval or model prompts.

Canvas coaching is a separate, author-invoked proposal path. Deterministic
retrieval supplies only applicable author-vetted craft chunks, while an
explicit per-request selection may supply World Bible names/aliases or Source
Note titles. Source Note bodies and manuscript prose are outside this contract.
The application validates the entire model response and expected proposal kind
before showing anything actionable. Replacement wording and proposed Open
Threads remain read-only previews until confirmation, then deterministic
application code verifies that the focused Canvas text is still current before
writing only the confirmed Canvas change. The model cannot write Canvas,
canon, or state directly.

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
- Canonical facts may have optional manuscript-time boundaries stored as
  stable scene references: `validFromSceneId` is inclusive and
  `validUntilSceneId` is exclusive. Their meaning is resolved from current
  manuscript order at use time; ordinal positions are never persisted. A
  conflicting later fact is accepted by superseding the current fact at an
  author-selected scene, preserving both records and closing the earlier
  fact at that boundary. Missing boundary scenes fail closed rather than
  making a bounded fact timeless. Character-package imports remove these
  project-specific scene references because the package does not carry the
  manuscript; full project backups preserve them.
- Canon-grounded consistency checks rely only on accepted canon (records,
  aliases, canonical facts, accepted state mutations) — never on raw lore
  text, which legitimately contains brainstorming and contradictions. Raw lore
  may appear as supporting context only. Consistency findings remain advisory
  and never block drafting.
- **Fact-anchored contradiction detection carries no fictional attribute
  rules.** Which attributes matter comes only from accepted facts: each
  fact's value is parsed into a slot (head noun plus one modifier, or a
  number) and scene text attributed to the fact's entity is compared in that
  slot. The engine may know *linguistic* value classes — colors, numbers,
  negation — because they are true of English, not of any story; it must
  never carry lists of what characters, creatures, or places have. A
  competing scene modifier is a conflict only when it is an explicit
  negation, a different number, or a member of the same value class, where
  classes are built-in linguistic ones or *learned* from the author's own
  canon (other accepted values of the same fact type and head noun).
  Adjectives outside any class never fire. Attribution is per claim: the
  nearest preceding known-entity mention; the speaker of quoted dialogue is
  never the subject of claims inside the quotes; second-person speech
  resolves to the preceding narrative block's remaining entity. Paraphrase
  and implication are out of reach for this path by design and belong to
  the author-triggered, evidence-validated model check (roadmap 4.38).
  Precision is measured against the checked-in continuity corpus.

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
  Supersession requires an explicit "as of this scene" choice; it never
  deletes the earlier truth or guesses a manuscript boundary.
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
- Deterministic review may compare prose observations with replay immediately
  before their evidence span. Impossible proposed commands surface as
  warning-level `INVALID_MUTATION` findings; incompatible custody, equipment,
  or static-location claims surface as warning-level `STATE_CONFLICT`
  findings citing the accepted scene that established the prior state.
  Movement cues suppress static-location conflicts until state catches up.
  Review and assistant custody answers use the same ordered manuscript walk.
- Proposal layer (manual, deterministic extraction, or local LLM — with
  confidence/evidence/status) is strictly separate from the accepted mutation
  ledger. LLM integration affects proposal generation only; it never changes
  the event schema, replay rules, or ordering.
- Subject scope is character-first; the event schema permits later expansion
  to locations, factions, items, and world.
- The command types, schemas, ordering, application, replay, and ruleset
  validation live in `packages/rules-engine/src/manuscript/`; persistence and
  project lookups stay in the web app.
- Authored game rules (`WorldRuleset.rules`) are typed by `GameRuleSchema`.
  Every ruleset write moves rules that fail the schema into
  `quarantinedRules`, kept verbatim with their validation issues. Quarantined
  rules are never executed or sent as AI context, survive exports and
  backups, and are shown to the author on the Ruleset route.
- Rule output, when rules are wired in (backlog R3–R5), takes only two forms:
  derived views recomputed at replay and never stored, or proposed
  `StateMutationCommand`s that go through the normal author confirmation.
  Rules never write to the ledger directly.

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

Mechanics-enabled projects may opt in to one explicit built-in World Bible
category whose `recordType` is `system-negative-space`. The author adds it from
Manage Categories; nothing creates it automatically. Its id is fixed per
project (`system-negative-space-<projectId>`), so it can exist at most once. Its records capture problems
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

### Character lab boundary

_Status: implemented (Slices 4.42–4.45, 2026-09-27)._

- **Grounding** comes only from `buildCharacterVoiceContext`: the canonical
  World Bible record and aliases (through the shared character link
  resolver), accepted canon facts valid at the chosen position, the assigned
  dialogue style name, and replayed story state from `buildCharacterSnapshot`.
  A canonical fact whose known source proposal is not `accepted` is
  excluded. Story state is labelled as what is true at that point, never as
  what a character knows; per-character knowledge attribution is not modelled.
- **One prompt module** (`buildCharacterVoicePrompt`) carries the
  in-character rules (may disagree or refuse, no people-pleasing, no invented
  major biography, state uncertainty) for talk, reaction, scene, and
  generation, and embeds grounding in the system prompt so every provider,
  including local Ollama, receives it.
- **Character from a description** treats the reply as untrusted input: a
  strict schema; a name is kept only if the description contains it; every
  stable fact must quote the description and carries that span as evidence.
  Accepting is an explicit author action that creates a draft `WorldEntity`
  (`needsCompletion`), a linked Source Note holding the author's description
  and any kept suggestions, and `LoreFactProposal`s in the ordinary review.
  Model suggestions never enter World Bible fields. A name that matches an
  existing character's canonical name or alias requires an explicit choice:
  add to that character (proposals only, no merge) or create a separate one.

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
