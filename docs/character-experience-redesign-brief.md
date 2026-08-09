# Character Experience Redesign Brief

**Status:** Problem brief and decision input — not an implementation plan
**Created:** 2026-08-09
**Authority:** Product, architecture, and domain decisions remain in
`docs/product-blueprint.md`, `docs/architecture-review.md`, and
`docs/domain-model.md`. Open work remains authoritative only in
`docs/road-to-market.md`.

## Executive Summary

The product already states the right author-facing principle:

> Detect or create a character once, store it in one obvious canon home, and
> expose deeper options from that record when they become relevant.

The current application does not yet deliver that experience. A single story
person can be represented by a World Bible entity, a Character Tools record,
a Character Sheet, canonical facts, aliases, Source Notes, and scene-scoped
state. Several of those records repeat the character's name and descriptive
fields. Some connections are explicit IDs, while others are inferred from
normalized names. The UI therefore exposes internal storage distinctions as
author decisions: where to create the character, where to edit them, and which
version is authoritative.

The redesign goal is not to collapse every internal record into one database
object. Canon, longform source material, manuscript-time state, and optional
mechanics have genuinely different lifecycles. The goal is to make those
differences invisible until they provide value:

> **The author experiences one character with optional sections.**

World Bible remains the canonical identity owner. Source Notes, continuity
state, mechanics, and writing aids attach to that identity through stable
links and appear from one character-centered experience. Creating an optional
capability must never create a competing character identity.

## Why This Matters

This is a trust and comprehension problem, not merely an information-
architecture preference.

The recent trust-dogfood flow exposed a representative failure: `Tam` was
underlined as known lore because a secondary Character Tools record existed,
even though no Tam entry appeared in World Bible. The application knew about a
stored object named Tam, but the author reasonably interpreted the underline
as a claim that Tam was established canon. Fixing the underline policy removes
the immediate symptom; it does not remove the underlying representational
ambiguity.

The costs of the current model are:

- Authors must learn storage architecture before they can confidently enter a
  character.
- Duplicate names and fields make it unclear which edit will affect canon,
  consistency review, AI grounding, exports, or mechanics.
- Name-based reconciliation can silently link the wrong records or fail after
  a rename.
- Empty optional records can make a project look incomplete without providing
  author value.
- Product copy must repeatedly explain that one surface is canonical and
  another is not, which is evidence that the interaction model is carrying too
  much internal complexity.
- Tests and services must defend against duplicate identities across aliases,
  review matching, extraction, state replay, scene rosters, and retrieval.

## Current Character Representations

| Representation | Legitimate responsibility | Current overlap or risk |
| --- | --- | --- |
| World Bible character `WorldEntity` | Canonical identity, canonical name, aliases, description, role, structured story facts | Shares name, description, role, age, and notes with `Character`; category membership is used to infer that an entity is a character |
| `CanonicalFact` | Accepted, machine-readable truth with evidence and provenance | Can target either a `character` or an `entity`, preserving two possible canon identities for a person |
| Consistency alias | Stable manuscript name matching | Can target either record family; linked pairs require deduplication and special handling |
| Character Tools `Character` | Dialogue styling, exportable tool metadata, and bridge to optional systems | Carries identity and descriptive fields despite being declared non-canonical; can exist without World Bible canon |
| `CharacterSheet` | Level, experience, stats, resources, inventory, equipment, statuses, and state baseline | Repeats the name; `characterId` is optional; state code must accept either a character ID or sheet ID |
| State mutation events | Scene-ordered, accepted changes to mutable character state | Actor resolution supports multiple possible identifiers and depends on sheets for replay |
| Source Note / `LoreDocument` | Longform dossiers, exploratory writing, imported background, evidence source | Correctly separate from canon, but the author must navigate to another surface to understand the complete character context |
| Scene roster and Lore Inspector | Scene-specific presence, status, and quick context | Must merge World Bible, Character Tools, sheets, aliases, and state into one display model |
| RAG/Shodh derived context | Rebuildable retrieval and assistant grounding | Must preserve trust tiers and avoid elevating secondary records to accepted canon |

### What genuinely benefits from separation

- Canonical identity and accepted facts need provenance, review, and stable
  identity semantics.
- Source Notes need unrestricted longform writing and may intentionally
  contradict canon.
- Manuscript-time state needs ordered events, replay, invalidation, and a
  baseline distinct from permanent character facts.
- Mechanics need mode-gating and ruleset-defined schemas; general-fiction
  authors should not need them.
- Derived retrieval indexes must remain rebuildable and separate from source
  data.

### What does not provide author value

- Entering or maintaining the character's name in several places.
- Choosing whether a fact belongs to a `Character` or character
  `WorldEntity` target.
- Creating a tools profile before using a sheet or writing aid.
- Treating an optional sheet name or tools record as an independent identity.
- Reconciling linked records by normalized name after creation.
- Seeing multiple navigation destinations that each appear to be a character
  editor.

## Proposed Author-Facing Model

### One character, one entry point

Every character begins as a World Bible character record, whether created
manually, accepted from review, imported from a dossier, or promoted from a
legacy tools record. This record owns:

- Canonical name and aliases
- Canonical description, role, relationships, appearance, and other accepted
  facts
- Review/completion state
- Provenance and links to supporting Source Notes
- Stable character identity used by every optional subsystem

The character detail experience then exposes optional sections:

1. **Canon** — identity, aliases, accepted descriptive facts, and provenance.
2. **Notes** — linked Source Notes and a clear action to create or open
   longform material. Notes remain non-canon until reviewed and accepted.
3. **Continuity** — scene presence, recent events, mutable descriptive state,
   and timeline history.
4. **Mechanics** — sheet, level, stats, resources, inventory, equipment, and
   statuses. Hidden when the project mode does not support mechanics and
   absent until explicitly enabled for that character.
5. **Writing aids** — dialogue style and genuinely useful export or prompt
   metadata. This section should exist only if those capabilities demonstrate
   author value; it must not reproduce canon fields.

These may remain separate records internally. The UI presents them as
sections of one character and creates their backing records only when the
author invokes the capability.

### Progressive disclosure by project mode

- **General fiction:** Canon, Notes, and Continuity are available. Mechanics
  is hidden. Writing aids appear only when the author invokes a relevant
  action.
- **LitRPG:** The same character detail includes an optional Mechanics
  section. A sheet is not required merely because the project supports it.
- **Game simulation:** Mechanics may be more prominent, but canonical
  identity still belongs to World Bible and is never duplicated.

Project mode changes discoverability and defaults, not ownership.

### Author-language rules

- Use **character** for the story person.
- Use **canon** for accepted story truth. Avoid exposing storage terms such as
  entity, target type, materialized record, or tools profile.
- Use **Source Notes** for longform or exploratory material.
- Use **sheet** and **state** only when mechanics or continuity requires them.
- Retire **Character Tools profile** from ordinary author-facing language.
  Name the specific capability instead: Dialogue Style, Character Sheet,
  Export, or State History.

## Proposed Internal Direction

The high-reasoning design pass should validate, refine, or reject the
following direction before implementation slices are added to the roadmap.

### Stable canonical identity

- A World Bible character entity ID becomes the stable identity key for all
  new character-linked records.
- Optional records use explicit foreign keys to that canonical ID. No new
  name-based linkage is created.
- Renaming canon never changes linkage.
- Character categories must have a stable semantic discriminator; character
  identity should not depend indefinitely on a category slug containing the
  word `character`.

### Character Tools record

Choose explicitly between:

1. **Deprecate it:** move dialogue-style and export metadata into a narrowly
   scoped character-extension record keyed by World Bible character ID; or
2. **Retain it as an implementation adapter:** remove identity/descriptive
   ownership, require a canonical entity foreign key, and stop exposing
   independent create/rename flows.

The current free-standing `Character` shape should not remain a second
identity authority.

### Sheets and state

- A sheet links to the stable canonical character ID; its display name is
  derived from canon rather than independently authored.
- Decide whether the product supports exactly one active sheet per character
  or multiple named sheets/builds. Encode that cardinality instead of leaving
  it implicit.
- State mutation actor IDs resolve through the canonical character ID.
  Transitional adapters may accept legacy character or sheet IDs only during
  migration.
- A character can exist without a sheet. Creating canon never auto-creates
  mechanics.

### Canon facts and aliases

- New character facts and aliases target the canonical World Bible character
  identity.
- Legacy character-targeted facts and aliases require a deterministic,
  reviewable migration when an unambiguous canonical link exists.
- Ambiguous or orphaned legacy records must be surfaced for author resolution,
  never silently merged by name.

### Unified read model

Build one tested, read-only character view model that composes:

- Canon record and accepted facts
- Aliases and provenance
- Linked Source Notes
- Optional writing-aid metadata
- Optional sheet baseline
- State at a selected manuscript point
- Recent accepted mutations and scene mentions

Workspace lore inspection, scene rosters, World Bible character details,
search, assistant context, and export should consume this shared composition
instead of independently reconciling record families.

This view model is not a new persistence source of truth.

## Trust and Safety Constraints

The redesign must preserve the standing boundary:

> Models propose. Deterministic application code validates. Authors approve.

Specifically:

- Extraction may propose a new character or facts but cannot create canon
  without author acceptance.
- Enabling a sheet or writing aid is an explicit author action.
- No migration silently merges ambiguous same-name people.
- Source Notes remain non-canon even when displayed inside the character
  experience.
- Consistency review and factual assistant answers use accepted canon and
  accepted state only.
- Derived character summaries and indexes remain rebuildable.
- Removing an optional capability does not delete the canonical character.

## Migration Principles

This redesign changes persisted relationships and therefore depends on the
storage-versioning and migration contract in roadmap Slice 4.2. It must not be
implemented as ad hoc reads that gradually reinterpret existing records.

Migration should classify every legacy character-related record as:

- **Already linked:** preserve the stable relationship.
- **Unambiguous same identity:** propose or deterministically apply the link
  only under a documented rule with backup and migration coverage.
- **Tools-only orphan:** offer creation/linking of World Bible canon; do not
  present it as canon before author action.
- **World-Bible-only:** valid and complete; optional records remain absent.
- **Ambiguous collision:** require author resolution.
- **Sheet-only legacy record:** preserve mechanics and request an identity
  link without inventing canon.

Backup import/export, character-package import/export, parent/child canon,
aliases, canonical facts, state events, and retrieval rebuilds all require
explicit migration tests.

## Candidate Slice Topology

These are design inputs, not authorized roadmap slices. A high- or
extra-high-reasoning pass should challenge their boundaries and then place
approved work in `docs/road-to-market.md` rather than treating this section as
an execution queue.

| Candidate | Outcome | Key dependencies | Suggested size |
| --- | --- | --- | --- |
| A. Product decisions and usability contract | Resolve the open decisions below; define author journeys and acceptance criteria for general-fiction, LitRPG, and legacy projects | Trust dogfood evidence | S |
| B. Persisted identity contract | Specify canonical character ID, extension links, sheet cardinality, legacy classifications, and migration invariants | A; roadmap 4.2 design | M |
| C. Storage migration and compatibility adapters | Add versioned migration, explicit links, orphan/collision reporting, backup compatibility, and rollback-safe tests | Roadmap 4.2 complete; B | L |
| D. Unified character read model | Compose canon, notes, optional metadata, sheets, and manuscript-time state behind one tested service contract | C | M |
| E. Character-centered World Bible experience | Present one character with Canon, Notes, Continuity, optional Mechanics, and optional Writing Aids; use existing design tokens and progressive disclosure | A, D | L |
| F. Intake and review unification | Ensure workspace review, Source Note extraction, import, alias resolution, and manual creation all produce or link the same canonical identity | C, D | M |
| G. Optional-system handoff cleanup | Remove independent identity editing from Character Tools and Sheets; derive names from canon; route capability-specific actions from the character | D, E | M |
| H. State and roster rebinding | Use canonical character identity through state proposals, replay, scene rosters, mutation review, and inspector context | C, D | M |
| I. Legacy target cleanup | Migrate or retire character-targeted aliases/facts and normalized-name joins after compatibility telemetry/tests show no remaining dependence | C–H | M |
| J. Trust dogfood and usability validation | Repeat the character-canon smoke and trust fixture; add author-language comprehension checks, mode checks, backup round-trip, accessibility, and routed UI coverage | E–I | M |

### Slice-shaping guidance

- Do not combine storage migration and the full UI redesign in one slice.
- Each behavior-changing slice should complete an author journey rather than
  merely move fields.
- Keep compatibility adapters temporary and give their removal an explicit
  exit condition.
- Run migration tests before routed UI work depends on new IDs.
- Preserve the existing manual smoke for character canon unification and
  expand it rather than creating a competing smoke plan.
- Decide whether this work is required before beta. The brief recommends that
  ambiguous identity and migration work land before beta data accumulates;
  purely presentational consolidation may be staged if necessary.

## Open Decisions for the High-Reasoning Pass

1. Should the `Character` store be retired, or narrowed into an extension
   store? Which current capabilities genuinely require it?
2. Is there one sheet per canonical character, multiple sheets/builds, or one
   sheet per ruleset?
3. Should continuity appear inside the World Bible character detail, in the
   Workspace inspector, or both through the same read model?
4. Which writing-aid features have demonstrated enough author value to keep?
   Dialogue styling and character-package export should not survive solely
   because records already exist.
5. How should tools-only and sheet-only legacy characters be presented during
   migration without implying that they are canon?
6. Can character-category identity become explicit without disrupting custom
   World Bible categories?
7. Should all new `CanonicalFact` and alias targets converge on `entity`, or
   should a more explicit canonical-subject abstraction replace both current
   target types?
8. How should parent/child canon inheritance treat optional character state
   and mechanics?
9. Which parts are v1 trust requirements versus post-v1 simplification?
10. What evidence would justify retaining a separate Character Tools route?

## Success Criteria

The redesign succeeds when:

- An author can create Tam once and correctly predict where to edit Tam later.
- A known-lore underline always resolves to visible accepted canon.
- General-fiction authors never encounter a sheet, profile, stat, or resource
  requirement unless they intentionally enable such a capability.
- LitRPG authors can add mechanics from the canonical character without
  recreating identity or descriptive fields.
- Renaming a character preserves every optional link without name matching.
- Source Notes can contradict canon without being presented as accepted truth.
- Workspace review, Lore Inspector, search, Source Note extraction, and
  assistant grounding agree on the same canonical identity.
- Legacy projects migrate without data loss; ambiguous identities are shown
  for author resolution.
- Removing a sheet or writing aid never removes canon.
- The UI no longer needs repeated warnings explaining which character editor
  owns canon.

## Non-Goals

- Flattening canon, Source Notes, state, and mechanics into one persistence
  record.
- Automatically generating sheets or mechanics for every character.
- Letting AI resolve identity or mutate canon without approval.
- Expanding mechanics depth, ruleset authoring, or character-generation AI.
- Replacing the active roadmap with this proposal.
- Preserving every current Character Tools feature without evidence of author
  value.

## Recommended Next Prompt

Use GPT-5.6 Sol at high or extra-high reasoning with the following task:

> Review `docs/character-experience-redesign-brief.md` against
> `PROJECT_STATUS.md`, `docs/road-to-market.md`,
> `docs/product-blueprint.md`, `docs/architecture-review.md`, and
> `docs/domain-model.md`, plus the current character/entity/sheet persistence
> and route code. Challenge the proposed model rather than assuming it is
> correct. Resolve the ten open decisions with explicit rationale; identify
> current capabilities that would be lost or simplified; define the target
> domain contract, migration invariants, author journeys, and measurable
> acceptance criteria. Then propose bounded, dependency-ordered implementation
> slices suitable for incorporation into the single authoritative
> `docs/road-to-market.md`. Do not change application code. Do not create a
> parallel roadmap. Clearly separate required pre-beta trust work from
> deferrable post-v1 simplification.
