# Character Experience Design Review — Decision Record

**Status:** Decision record for the redesign proposed in
`docs/archive/character-experience-redesign-brief.md`
**Created:** 2026-08-09
**Authority:** This document resolves the brief's ten open decisions and
defines the target domain contract, migration invariants, author journeys, and
acceptance criteria. Its durable contract now lives in `docs/domain-model.md`
and J1–J6 live in `docs/smoke-tests.md`; the original brief is archived. Open
work remains authoritative only on the `docs/road-to-market.md` status board;
this document carries no execution status.

## 1. Verdict on the Proposed Model

The brief's author-facing model — one canonical character in World Bible,
optional capabilities attached by stable ID, presented as sections of one
experience — is correct and is adopted. The code review confirms the problem
is worse than the brief states in three places and overbuilt in one:

**Worse than stated — no explicit link exists at all.** The brief says "some
connections are explicit IDs." For character↔canon linkage, none are.
`Character` has no foreign key to `WorldEntity`; every association is a
normalized-name join computed at read time
(`buildCharacterLoreEntityIdByCharacterId` in
`services/consistency/reviewLinkOptions.ts`,
`resolveCharacterAliasEntityMigrations` in
`services/consistency/aliasStorage.ts`,
`buildManualCaptureLinkOptions` in `services/workspace/workspaceView.ts`).
World Bible's "link to Character Tools" action
(`useWorldBibleEntityActions.handleImportEntityToCharacters`) copies
name/description/age/role/notes into a new `Character` and dedupes by
normalized name — the reported "link" is a field copy.

**Worse than stated — intake is not unified even after Phase 1.** Workspace
review capture correctly creates `WorldEntity` records, but accepting a
character `LoreEntityProposal` with no existing target still creates a
free-standing `Character`
(`services/lore/entityProposalActions.acceptLoreEntityProposal`), and the
character package import creates `Character`+`CharacterSheet` records with no
canon. Two of the four intake paths still mint the secondary identity.

**Worse than stated — actor identity is triple-keyed plus name-matched.**
Replay accepts a command if its `actorId` matches any of the target's
`actorId`, `characterId`, or `sheetId` (`stateReplay.matchesActor`), and
deterministic mutation derivation resolves actors by sheet id, `characterId`,
or *normalized sheet name* (`stateMutationDerivation.findSheetForActor`). A
sheet rename can therefore change which character future derived mutations
attach to.

**Overbuilt in one place — the unified read model.** Candidate D proposes one
view model consumed by lore inspection, rosters, World Bible detail, search,
assistant context, and export. Built before migration, it would have to encode
every legacy name-matching behavior; built as a grand composition, it is a
horizontal slice with no author-visible outcome. What the code actually needs
first is one small, tested **character link resolver** (entity ↔ extension ↔
sheet by explicit IDs, with the legacy-classification fallback) replacing the
four independent name-join implementations. Fuller composition (canon + notes
+ state-at-point) stays scoped to the surfaces being rebound; expansion to
search/export is post-v1.

Two additional findings the brief missed, both relevant to beta trust:

- **Consistency aliases are not in project backups.** The schemaVersion-1
  snapshot (`services/storage/projectSnapshotService.ts`) includes characters,
  sheets, canonical facts, and state events but no consistency-alias store,
  while `deleteProject` does clear that store. A backup/restore cycle silently
  loses all alias records — accepted canon, by the domain model's own
  definition. This must be fixed regardless of the redesign.
- **Character-category identity is inconsistent per surface.** Four different
  hint sets decide whether a category "is characters": slug contains
  `character` (`aliasStorage`); slug or name contains `character`
  (`reviewLinkOptions`, `useWorkspaceConsistency`); slug/name contains
  `character|characters|npc|person|people` (`workspaceView`); slug contains
  `character|cast` (`useWorldBibleSelectedEntity`). The same project can
  classify an entity as a character on one surface and not another.

## 2. Current-State Evidence Summary

| Fact | Where |
| --- | --- |
| `Character` = name, description, `characterStyleId`, fields age/role/notes; no entity FK | `entityTypes.ts` |
| `CharacterSheet.characterId?` → `Character.id` (never an entity); independently authored `name` | `entityTypes.ts`, `CharacterSheetsRoute.tsx` |
| Sheets gated by ruleset presence + `canUseRuleAuthoring`; one ruleset per project | `CharactersHubRoute.tsx`, `services/rules` |
| Entity→tools "linking" is a name-deduped field copy | `useWorldBibleEntityActions.ts` |
| Lore character proposal acceptance creates free-standing `Character` | `services/lore/entityProposalActions.ts` |
| Facts/aliases/lore links target `'character' \| 'entity'`; character facts materialize into `Character.fields` | `entityTypes.ts`, `services/lore/canonicalFactActions.ts` |
| Alias→entity migration helper exists: exact-unique normalized-name rule only | `services/consistency/aliasStorage.ts` |
| Replay actor match: `actorId \| characterId \| sheetId`; derivation also matches sheet name | `services/state/stateReplay.ts`, `stateMutationDerivation.ts` |
| IndexedDB `DB_VERSION 24`, create-only upgrades, no data migrations | `db.ts` |
| Backup snapshot schemaVersion 1 omits consistency aliases (and consistency proposals/events) | `services/storage/projectSnapshotService.ts` |
| Character transfer package schemaVersion 1: characters + sheets, no canon | `services/characters/characterTransferService.ts` |

## 3. The Ten Decisions

**D1. Character store: narrow now, retire post-v1.** `Character` becomes a
non-identity **character extension** record: required `entityId` FK for all
new records, no independent create/rename/description flows, display name
always derived from canon. The only field with no canon home is
`characterStyleId` (dialogue style is wired into editor marks and was just
themed in Slice 2.4 — it earns its keep). Full retirement — moving
`characterStyleId` into a small keyed map and dropping the store — is post-v1
because sheets, aliases, facts, lore links, transfer packages, and the
accepted state ledger all reference character IDs today; the transition needs
the record as an adapter either way. What genuinely required it: dialogue
style assignment and the package-export anchor. Nothing else.

**D2. Exactly one sheet per canonical character.** Replay assumes a single
baseline per actor; the roster maps character→one `sheetId`; sheet selection
uses `find()` first-match. Multiple builds have no demonstrated demand, and
"one per ruleset" collapses to "one" because a project has one ruleset.
Encode as a service-layer invariant (`unique (projectId, characterEntityId)`);
migration surfaces existing collisions for author resolution rather than
picking a winner. Named builds, if ever justified, are post-v1.

**D3. Continuity appears in both places through the same composition.** The
Workspace inspector answers "state at this manuscript point"; World Bible
character detail answers "who is this character" with latest state and
timeline (the character health panel already lives there). Same read service,
different point-in-time parameter. The thing to eliminate is duplicated
reconciliation logic, not the second surface.

**D4. Writing aids that survive: dialogue style and package export.**
Dialogue style has real editor function (dialogue marks, live preview).
Package export survives **re-based on canon**: a v2 package carries the
entity record, aliases, facts, extension, and optional sheet, because
cross-project character reuse supports the blueprint's import/export
differentiator. What is retired: duplicated identity/descriptive editing
(name/description/age/role/notes on the tools record) and the CharactersRoute
paste-notes AI assist, which duplicates the World Bible record helper. No
other "tool metadata" exists in code to preserve.

**D5. Legacy tools-only and sheet-only records present as unresolved intake,
never as canon.** They surface in the existing World Bible review queue as a
distinct "Needs canon link" reason with three actions: link to an existing
character, create a canon record from the profile (author-confirmed draft
copy), or dismiss/keep-separate. Sheet-only records keep working mechanically
(replay unaffected) with a visible "not linked to canon" badge. Neither is
ever underlined as known lore, counted in canon totals, or offered as
assistant grounding until resolved — extending the underline policy already
adopted after the Tam incident.

**D6. Category identity becomes an explicit `kind` field.** Add
`EntityCategory.kind: 'character' | 'general'` (extensible later). One-time
migration derives it with the broadest existing hint set, reports the
classification, and the category editor lets authors change it. Custom
categories are unaffected — `kind` defaults to `'general'`, slugs and names
stay free, and any custom category can be marked character-kind. All four
divergent hint heuristics are replaced by the field.

**D7. Fact, alias, and lore-link targets converge on `entity`.** No new
canonical-subject abstraction: it would be a third identity vocabulary, and
entity IDs already serve locations, items, and factions — characters are not
special at the fact layer. The `targetType` discriminator stays in storage
for compatibility; all new writes use `'entity'`; the `'character'` variant
is retired post-v1 after local migration reports and reader coverage show no
remaining uses.

**D8. Parent/child inheritance covers canon only.** Inherited entities
remain read-only canon context for review and grounding (existing behavior).
Sheets, state ledgers, and extensions do not inherit: replay is ordered
within one project's manuscript, and cross-project replay is undefined. A
sequel wanting to start from a parent's end-state is a future explicit
"promote snapshot as new baseline" action, not implicit inheritance.

**D9. Pre-beta versus post-v1.** Pre-beta (trust and comprehension: beta data
must not
accumulate on ambiguous identity): schema versioning (4.2), explicit FKs and
the link resolver, deterministic legacy classification with author
resolution, backup completeness including aliases, intake convergence,
sheet/state rebinding for new events, single-sheet invariant, capability
routing that removes independent identity editing, and dogfood coverage of
the identity scenarios. Dogfood promoted the fully sectioned character detail
experience and retirement of `/characters` as an author destination into the
pre-beta scope. Post-v1/internal simplification retains retirement of
`'character'` targets and remaining name-join code, dropping the extension
store, read-model expansion to search/export, and snapshot promotion.

**D10. Evidence bar for keeping a separate Character Tools route.** Retain
only if dogfood or beta shows (a) recurring use of dialogue-style or
package-export workflows as a *batch* activity across many characters at
once, and (b) a concrete workflow that cannot be reached in ≤2 interactions
from the World Bible character detail. Active dogfood instead found the split
destination confusing, so the route-retirement portion is promoted to pre-beta
as CX-10a after CX-9. Its capabilities live on character detail plus the
existing `More` group. Style *definitions* (the `CharacterStyle` list) already
have a home in settings; per-character assignment needs no route of its own.
Internal compatibility retirement is separated as CX-10b and remains backlog
until reader coverage proves those adapters safe to remove.

## 4. Capabilities Lost or Simplified

- Free-standing character creation without canon (CharactersRoute create,
  lore-acceptance path, package import): removed by design; every path now
  produces or links a World Bible identity.
- Independent sheet names (e.g. variant builds like "Kael — young"): lost;
  names derive from canon and cardinality is one per character. Migration
  surfaces multi-sheet collisions for the author to pick or archive.
- v1 character packages and v1 backup snapshots: still importable, but only
  through the legacy classifier — tools-only content lands as "needs canon
  link" instead of appearing ready-made.
- Name-based auto-association (rename a tools record to match an entity and
  they "link"): removed deliberately; this is the silent-wrong-link bug class.
- Character-targeted fact materialization into `Character.fields.role/age`:
  replaced by entity-field materialization.
- Roster/capture suggestions from unlinked tools-only records: hidden until
  resolved (they remain visible in the resolution queue).
- CharactersRoute paste-notes AI assist: folded into the World Bible record
  helper rather than maintained twice.

## 5. Target Domain Contract

- **`WorldEntity`** is the sole character identity. `EntityCategory.kind`
  marks character categories explicitly. Canonical name, aliases, facts,
  provenance, review state, and lore links key off `entity.id`.
- **Character extension** (today's `Character`, narrowed): `{id, projectId,
  entityId (required for new records), characterStyleId?}` plus frozen legacy
  fields readers must ignore. Created only by capability invocation; deleted
  without touching canon.
- **`CharacterSheet`**: new field `characterEntityId` (required for new
  sheets, unique per project+entity); `characterId` becomes legacy-read-only;
  display name derived from canon. A character exists without a sheet;
  creating a sheet for a character with no canon record first creates the
  canon record as an explicit, visible step.
- **State events**: new commands carry the canonical entity ID as `actorId`.
  Accepted ledger events are never rewritten; a persisted
  **actor-resolution map** (legacy character/sheet ID → entity ID, written
  during migration) makes replay deterministic across old and new events.
  Name-based actor matching is removed from derivation.
- **Facts, aliases, lore links**: new writes target `entity`. Legacy
  `character` targets resolve through the same map until retired.
- **Character link resolver**: one tested service resolving entity ↔
  extension ↔ sheet ↔ legacy IDs, consumed by roster, capture, review
  linking, health, inspector, and grounding — replacing all read-time name
  joins.
- **Classification taxonomy** (from the brief, adopted): already-linked /
  unambiguous same identity / tools-only orphan / World-Bible-only /
  ambiguous collision / sheet-only.

## 6. Migration Invariants

1. **Versioned and idempotent** under the Slice 4.2 contract; automatic
   backup before running; rollback is restore.
2. **No silent merges.** The only automatic link rule: exact normalized-name
   match, unique on both sides, within character-kind categories — the same
   rule `resolveCharacterAliasEntityMigrations` already encodes. Everything
   else goes to the resolution queue.
3. **No canon invention.** Migration never creates `WorldEntity` records;
   only author actions do.
4. **Ledger immutability.** Accepted `StateMutationEvent`s are never
   rewritten; identity flows through the actor-resolution map.
5. **Replay parity.** For every linked character, replayed state at every
   scene is byte-identical before and after migration (tested on the
   trust-dogfood fixture).
6. **Rename stability.** Post-migration, renaming canon changes zero
   linkages (tested).
7. **Conservation.** Every legacy character-related record is classified
   exactly once; report totals reconcile against store counts.
8. **Backup completeness.** Snapshot v2 includes consistency aliases and all
   new fields; v1 snapshots and v1 character packages import through the
   classifier; round-trip preserves all counts and linkages.

## 7. Author Journeys and Acceptance Criteria

**J1 — General fiction, new character.** Type a new name in a scene → review
capture → accept. Criteria: a World Bible character exists; zero sheet,
profile, stat, or resource surfaces were shown; the known-lore underline
resolves to that record in one click; editing its description happens in
exactly one place.

**J2 — LitRPG, add mechanics.** From the character detail, "Add sheet".
Criteria: zero name entry; sheet appears linked with canon-derived name;
mutations recorded in a scene replay on hover cards; renaming the character
updates every surface with zero re-linking.

**J3 — Legacy project.** Open a pre-migration project. Criteria: backup
taken automatically; migration report shows every record classified;
tools-only and ambiguous items appear in the review queue with link / create
/ keep-separate actions; nothing unresolved is presented as canon; no data
lost (count reconciliation).

**J4 — Dialogue style.** From the character detail, assign a style.
Criteria: no second identity is created or edited; removing the style (or
the sheet) never touches canon.

**J5 — Backup round-trip.** Export, wipe, import. Criteria: aliases, links,
facts, sheets, state events, and replay results identical; v1 archives
import with legacy content routed to the resolution queue.

**J6 — Trust fixture (Tam).** A tools-only record with no canon. Criteria:
never underlined as known lore, never in assistant grounding, visible in the
resolution queue; after the author links or creates canon, all surfaces agree
on one identity.

## 8. Proposed Slices

Dependency-ordered; sized S/M/L; each completes an author-verifiable outcome.
These become authoritative only when placed on the `docs/road-to-market.md`
status board (adopted there as Phase 4 slices 4.4–4.11). Storage migration
and UI redesign stay in separate slices throughout.

| # | Slice | Outcome | Depends on | Size | When |
| --- | --- | --- | --- | --- | --- |
| CX-1 | Contract adoption | Fold §5–§6 into `docs/domain-model.md`; add J1–J6 to smoke docs; archive the brief | this review | S | Pre-beta |
| CX-2 | Identity links + classifier + resolver | `EntityCategory.kind`, `Character.entityId`, `CharacterSheet.characterEntityId`, actor-resolution map, deterministic classifier + report, link-resolver service; exact-unique auto-link only; no new UI beyond the report | 4.2 | M | Pre-beta |
| CX-3 | Backup + package completeness | Snapshot v2 with aliases + new fields; v1 snapshot/package import via classifier; round-trip and replay-parity tests | CX-2 | M | Pre-beta |
| CX-4 | Intake convergence | All four creation paths (manual, review capture, lore acceptance, package import) plus sheet creation produce or link canonical entities; no path mints a free-standing `Character` | CX-2 | M | Pre-beta |
| CX-5 | Resolution queue | Tools-only / sheet-only / ambiguous surfaced in the World Bible review queue with link / create / keep-separate actions, author language, unresolved never presented as canon | CX-2 (CX-3 for imports) | M | Pre-beta |
| CX-6 | Sheet + state rebinding | New mutations carry entity actor IDs; replay via resolution map; name-based actor matching removed; single-sheet invariant enforced with collision surfacing; sheet names derived from canon | CX-2 | M | Pre-beta |
| CX-7 | Capability routing | Character detail routes Add sheet / Dialogue style / Export; Character Tools loses create/rename/descriptive editing; "profile" language retired from author-facing copy | CX-4, CX-5, CX-6 | S | Pre-beta |
| CX-8 | Identity dogfood addendum | Extend `fixtures/trust-dogfood/` and the character-canon smoke with J1–J6 (Tam case, rename stability, migration round-trip, mode gating); feeds Slice 1.1 before 6.1 | CX-5, CX-6, CX-7 | M | Pre-beta |
| CX-9 | Sectioned character experience | Full Canon / Notes / Continuity / Mechanics / Writing-aids detail with progressive disclosure per project mode | CX-7 | L | Pre-beta; promoted by dogfood as roadmap 4.12 |
| CX-10a | Character destination retirement | Retire `/characters` as an author destination; move contextual capabilities to World Bible detail and justified batch utility to `More` while preserving compatibility adapters | CX-9 | M | Pre-beta; promoted by dogfood as roadmap 4.13 |
| CX-10b | Internal compatibility retirement | Retire `'character'` fact/alias/link targets, remaining name joins, and eventually the extension store | CX-10a + tests showing no readers | M | Backlog |

Deliberately **not** proposed: a standalone "unified read model" slice. The
link resolver (CX-2) plus per-surface rebinding (CX-6, CX-7) delivers the
shared composition where it pays; expanding it to search/export is part of
CX-9/CX-10b.

## 9. Interaction with the Existing Roadmap

- **4.2 becomes the critical path.** This work is its first real consumer;
  4.2 should land before CX-2 and gain the alias-store backup gap (or CX-3
  fixes it — decide at 4.2 execution time, don't fix it twice).
- **Slice 1.1 (trust dogfood) gains scope, not a new plan.** CX-8 extends the
  existing fixture and runbook; the character-canon smoke is expanded, never
  forked.
- **Beta gate.** CX-1 through CX-10a must be `Done` before 6.1: beta authors'
  projects must not accumulate ambiguous identity data or learn a split
  character workflow that is already scheduled for removal.
- **Compatibility adapters get exit conditions.** The actor-resolution map
  and legacy target support are temporary; CX-10b is their explicit removal
  point.
