# Duplication and Related-Link Report

**Status:** running tracker, updated after every batch.

## Purpose

1. Flag near-duplicate concepts before they become competing entries with no
   declared relationship.
2. Track every `related` link that points to a record not yet drafted
   ("pending"), so it can be resolved (confirmed once the target exists) or
   corrected (removed/repointed if the plan changes).

## Pending related-links (as of Batch 3)

All Batch-1 and Batch-2 pending links resolved. 1 link remains pending:

| Referencing record | Pending target | Planned in |
|---|---|---|
| craft.general.character.want-versus-need | craft.general.character.internal-and-external-arcs | Batch 4+ (Family A) |

Re-run `python3 qa/build_catalog.py` after each batch; any pending link still
unresolved after its planned batch should be corrected or logged here as a
genuine gap, not left silently broken.

## Near-duplicate watch (as of Batch 3)

`craft.general.pacing.tension-and-release-cycles` and
`craft.system.progression.advancement-rate` both touch "pacing," but at
different altitudes (felt pressure rhythm vs. a computable tier-interval
metric) and are already cross-linked via `related`; not a duplicate.
`craft.system.progression.stat-block-density` and
`craft.system.progression.system-as-narrator-intrusion` both concern LitRPG
system presentation but are explicitly distinguished (numeric density vs.
voice/frequency of interjection) and cross-linked; not a duplicate.
`craft.comparison.progression.hard-numbers-versus-named-tiers` and
`craft.system.progression.visible-vs-hidden-systems` are adjacent
presentation comparisons (what's shown vs. who can see it) — now directly
cross-linked via `related` (fixed same-batch); not a duplicate.

## Near-duplicate watch list

None flagged yet at 8 records. Revisit after Batch 2–3 once the `general`
and `system` families have more entries — the concepts most likely to
attract accidental duplicates are tension/stakes/pressure/urgency (several
near-synonyms planned across Batch 2) and mana/qi/resource-model comparisons
(Batch 3). Each will get a single canonical entry plus explicit
`related`/`exclusions` cross-links rather than separate near-identical
records.

## Near-duplicate check (Batch 6)

`tropes/craft.trope.structure.time-loop.md` (Batch 4) and
`profiles/craft.profile.time-loop.md` (Batch 6) cover the same subgenre but
were deliberately scoped to be complementary rather than redundant: the
trope record describes the loop mechanic and its own variants; the profile
record describes how loop structure changes the *applicability* of other
already-drafted patterns (rescoping, non-application). Cross-linked via
`related`; not a duplicate.

## Near-duplicate check (Batch 10)

Four Batch 10 records sit close to existing records and were checked for
genuine distinction rather than restatement:

- `craft.general.plot.foreshadowing` vs. `craft.general.plot.setup-and-payoff`:
  setup/payoff is the general principle that payoffs need grounding;
  foreshadowing is specifically about subtlety calibration of that
  grounding. Distinct scope, cross-linked.
- `craft.general.plot.complications` vs. `craft.general.plot.causal-escalation`:
  causal-escalation is about events causing and raising stakes on each
  other; complications is about a specific technique (changing a problem's
  shape rather than its scale) within that broader principle. Distinct
  scope, cross-linked.
- `craft.general.pov.psychic-distance-and-interiority` vs.
  `craft.general.pov.information-control`: information-control is about
  what the reader knows and when; psychic-distance-and-interiority is
  about how close narration sits to a character's experience, independent
  of what information is being conveyed. Distinct scope, cross-linked.
- `craft.general.voice.voice-as-craft-element` vs.
  `craft.general.voice.dialogue-and-subtext`: dialogue-and-subtext is
  about what's said versus meant; voice-as-craft-element is about
  narrative and character voice as a rhythm/sensibility question
  independent of subtext. Distinct scope, cross-linked.

All four pairs verified as complementary rather than redundant; no merge
needed.

## Merges/splits performed

None yet.

---

# Whole-corpus audit pass A (after Batch 12, 130 records)

**Run:** 2026-09-05, via `python3 qa/audit_corpus.py` (new draft tooling,
committed alongside this entry) plus hand review of every flagged pair.
**Scope:** the holistic pass the Batch 12 coverage-matrix note said was due —
all 8,385 record pairs compared, not each batch against its neighbours.

## Method

`qa/audit_corpus.py` scores every pair twice: tf-idf cosine over the full
body text, and over the title/summary/tags/aliases/id surface with the
corpus's mandated boilerplate vocabulary stripped. It then reports the
closest pairs, marks which are already cross-linked, and separately measures
link-graph health, structural conformance to the handoff's required
sections, and sourcing shape. The script only reports; every judgment below
is a hand decision.

## Headline finding: the problem is the link graph, not duplication

**No merge candidates were found.** Of the 60 closest pairs in the corpus,
every one that a human reviewed turned out to be genuinely distinct — the
similarity is produced by the handoff's mandated eleven-section template and
by shared subject vocabulary, not by redundant coaching advice. The
batch-by-batch near-duplicate discipline held up under a whole-corpus check.

What the same pass exposed instead is that **`related` is a
backward-pointing tree, not a knowledge web**:

| measure | value |
|---|---|
| link edges | 264 |
| records with exactly 2 outbound links | 126 of 130 |
| records with 3 outbound links | 4 |
| mutual pairs (A names B *and* B names A) | 27 (~10% of edges) |
| records nothing links to | **62 (48%)** |
| one-way links | 210 |
| highest inbound degree | 14 (`advancement-rate`, `systemic-social-consequences`) |

The cause is mechanical rather than careless. Each record was drafted with a
fixed quota of roughly two `related` links, chosen from whatever already
existed on disk at drafting time. Links therefore point backward in batch
order and nothing was ever updated to point forward. Records drafted in
Batches 8–12 are structurally unreachable: a future coach traversing
`related` from an early record can never arrive at them.

Intra-family linking is uneven in the same way:

| family | records | outbound links | intra-family | zero inbound |
|---|---|---|---|---|
| general | 42 | 85 | 78 | 13 |
| system | 34 | 69 | 52 | 16 |
| trope | 36 | 72 | 25 | 23 |
| comparison | 6 | 13 | 3 | 2 |
| profile | 12 | 25 | **0** | 8 |

`profile` is the sharpest case: not one of its 25 links stays inside the
family. An author weighing classic LitRPG against GameLit against
progression fantasy — the single most common real subgenre decision this
corpus exists to support — has no path between those three records.

## Unlinked close pairs, with dispositions

Nineteen of the 60 closest pairs are not cross-linked. Eleven are
profile-to-profile, which is the systematic gap above rather than eleven
separate oversights. All dispositions are **cross-link**, none are **merge**:

| pair | body | disposition |
|---|---|---|
| `classic-litrpg` / `gamelit` | 0.374 | cross-link: adjacent subgenres separated by whether a stat screen exists at all; each already explains that boundary in prose without naming the other |
| `classic-litrpg` / `progression-fantasy` | 0.343 | cross-link: numeric vs. non-numeric growth is the choice an author is actually making here |
| `classic-litrpg` / `cultivation` | 0.303 | cross-link |
| `gamelit` / `progression-fantasy` | 0.299 | cross-link |
| `classic-litrpg` / `dark-horror-litrpg` | 0.296 | cross-link: same numeric surface, opposite promise about whether numbers mean safety |
| `base-building` / `dungeon-core` | 0.259 | cross-link: both relocate progression away from an individual protagonist |
| `convention.fantasy` / `convention.horror` | 0.251 | cross-link: sibling Batch 12 convention records |
| `role.companion` / `role.ensemble-cast-dynamics` | 0.251 | cross-link: one companion vs. a group; closest genuine overlap outside `profile`, reviewed and kept separate |
| `diminishing-returns-rarity-gates-and-catch-up` / `attributes-and-soft-hard-caps` | 0.250 | cross-link: two treatments of growth ceilings, one advancement-side and one attribute-side |
| `institutions-labor-and-governance` / `medicine-religion-and-crime` | 0.249 | cross-link: sibling Batch 11 depth records, both children of `systemic-social-consequences`, linked to the parent but not to each other |
| `hard-numbers-versus-named-tiers` / `gamelit` | 0.248 | cross-link: the comparison record is the design choice the profile assumes |
| `pools-vs-thresholds` / `health-and-focus-as-core-resources` | 0.243 | cross-link |
| `hard-numbers-versus-named-tiers` / `progression-fantasy` | 0.243 | cross-link |
| `isekai-portal-fantasy` / `progression-fantasy` | 0.243 | cross-link |
| `cultivation` / `progression-fantasy` | 0.238 | cross-link |
| `setup-and-payoff` / `trope.structure.mystery` | 0.238 | cross-link: fair-play clue planting is the same craft principle applied under genre contract; a valuable general↔trope bridge, and cross-family bridges are the corpus's scarcest link type |
| `cultivation` / `dark-horror-litrpg` | 0.234 | cross-link |
| `dungeon-core` / `progression-fantasy` | 0.234 | cross-link |
| `pools-vs-thresholds` / `renewable-vs-finite-resources` | 0.232 | cross-link: sibling resource comparisons |

## Closest linked pairs, re-verified

The four highest-scoring pairs in the corpus are all already cross-linked
and all survived re-reading as genuinely distinct:

- `profile.cultivation` / `system.cultivation.realms-and-breakthroughs`
  (0.417) — the profile modifies other records for the subgenre; the system
  record specifies the mechanic. Distinct altitude.
- `practice.buffer-discipline` / `practice.no-gap-posting` (0.393) — no-gap
  posting is the cadence commitment; buffer discipline is the mechanism that
  makes it survivable. Each names its own scope in its first paragraph. The
  closest non-`profile` pair in the corpus and the one most worth a second
  look at author review, but kept separate.
- `combat.action-economy` / `encounter.range-positioning-damage-and-defenses`
  (0.366) — turn budget vs. spatial relationships. Distinct.
- `pov.information-control` / `pov.psychic-distance-and-interiority` (0.352)
  — re-confirms the Batch 10 disposition already recorded above.

## Structural conformance

- enum violations (document_type, detectability, scopes, source_confidence):
  **0**
- id / filename / family / directory mismatches: **0**
- word counts: min 707, median 976, max 1,393, mean 982 — every record
  inside the handoff's 700–1,400 band (1,800 for comparisons); **0**
  out of band
- broken `related` targets: **0** (unchanged since Batch 7)

Twenty-one records have a required-section gap. Two are missing a top-level
required section outright:

- `craft.comparison.resource.qi-versus-mana` — no "Revision or design
  experiments" section. This is Batch 3's flagship comparison record and
  the omission has gone unnoticed for nine batches.
- `craft.trope.fatigue.overused-litrpg-trope-cluster` — no "Common forms
  and variants" and no "Common failure modes" section. Arguably deliberate,
  since the record is organized as five named conventions each with its own
  fatigue mechanism, but the handoff's structure is not optional and this
  is the corpus's most sensitive record; worth an explicit decision rather
  than a silent exception.

Twenty records (qi-versus-mana appears in both counts) miss one or more of
the handoff's *additional* system-mechanic and comparison requirements.
**"Visibility to characters and readers" is missing from fourteen of them**
— by far the most-skipped requirement in the corpus, and a meaningful one,
since whether a mechanic is legible to the character, to the reader, or to
neither changes the coaching advice completely. Also missing: "exploits,
edge cases, and interaction" (6 records), "consequences" (4), "progression
and failure behaviour" (3).

These twenty are keyword-detected rather than read, so treat them as a
review queue, not a verdict: a record could conceivably cover visibility
without ever using the word. Spot-checking suggests that is rare in a
~1,000-word body, but each should be confirmed by eye before it is edited.

## Sourcing shape

- 49 records cite at most one non-synthesis source. 44 of them correctly
  declare `source_confidence: limited` — the known, deliberately logged
  Family B pattern.
- **Five declare `mixed` while citing a single source**, which overstates
  support and should be corrected to `limited` (logged in
  `qa/citation-audit.md`): `general.plot.negative-space-problems-power-cannot-solve`,
  `general.plot.reader-expectation-and-genre-signaling`,
  `general.scene.scene-turns`, `trope.role.trickster`,
  `trope.structure.sacrifice-and-return`.
- 36 distinct sources in use; 11 cited exactly once. The two internal
  research documents are the two most-cited sources (37 and 35 records),
  which is expected but keeps them load-bearing — the Batch 12 caveat about
  not treating internal research as independent corroboration still stands.
- corpus-wide `source_confidence`: 66 mixed, 52 limited, 12 high.

## Recommended remediation, in priority order

1. **Reciprocal and intra-family links.** Add the 19 cross-links above,
   make the 27 mutual pairs the norm rather than the exception, and give
   `profile` an intra-family link set. Highest value per unit of effort:
   it makes 62 currently unreachable records reachable.
2. **Raise the link quota.** Two links per record was a drafting
   convenience, not a retrieval requirement. Four to six, with at least one
   pointing outside the record's own family, would serve a coach far
   better. Cross-family bridges (106 of 264 edges) are the corpus's most
   useful and scarcest link type.
3. **Add the missing "visibility" treatment** to the thirteen system and
   comparison records that skip it, and fill the two outright section gaps.
4. **Correct the five overstated `source_confidence` values.**
5. Only then continue to Batch 13. The 50 remaining records should be
   drafted against a raised link quota so the gap does not widen.
