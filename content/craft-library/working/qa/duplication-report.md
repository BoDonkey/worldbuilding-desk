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

---

# Remediation pass 1 — link graph repaired (2026-09-05)

Acts on recommendations 1 and 2 of audit pass A. Tooling:
`qa/relink.py` (`propose` → hand review → `apply`); the applied graph is
preserved in `qa/relink-plan.yml`.

## Policy adopted

Now written into `docs/writing-coach-corpus-production-handoff.md` under
"Related-Link Policy", so Batch 13 onward is drafted against it rather than
the old informal two-link convention:

1. links are mutual;
2. at least five per record, no maximum;
3. at least one crosses families;
4. subgenre profiles link to each other at least twice;
5. relevance beats quota — log a shortfall rather than pad it.

## Result

| measure | before | after |
|---|---|---|
| unique linked pairs | 237 | 399 |
| records with zero inbound links | 62 (48%) | **0** |
| one-way links | 210 | **0** |
| mutual pairs | 27 | 399 (all) |
| cross-family directed edges | 106 | 308 |
| profile intra-family links | 0 | 18 |
| minimum degree | 0 | 5 |
| median degree | 2 | 6 |
| maximum degree | 14 | 28 (`advancement-rate`, `systemic-social-consequences`) |

Degree distribution: 60 records at 5, 43 at 6, 27 above. **No hand-chosen
link from any drafting batch was dropped** — all 237 original pairs survive;
the pass only adds.

Where the 162 new pairs came from:

- **210 reciprocity completions** — existing one-way links made mutual. No
  new relationships, just the other half of relationships already asserted.
- **31 hand-specified pairs** — the 19 cross-links identified in audit pass A,
  plus 12 authored during review where similarity scoring kept reaching for a
  weak partner. The `practice` cluster (buffer discipline, no-gap posting,
  author burnout) needed most of these: a scheduling practice shares almost
  no vocabulary with the serial-publishing conventions it exists because of,
  so the score could not see a relationship obvious to a person.
- **9 profile intra-family** and **21 cross-family** links closing rules 4
  and 3.
- **101 similarity-proposed fills**, each read before applying.

## Rejected during review

23 proposed pairs were rejected as vocabulary artifacts rather than real
relationships, and are recorded in `qa/relink.py` so a re-run cannot
reintroduce them. Representative: `voice-as-craft-element` /
`power-as-sole-motivation`, `the-prophecy` / `the-heist`,
`narrative-summary-vs-scene` / `renewable-vs-finite-resources`,
`author-burnout` / `decorative-chapter-test`. The pattern is instructive:
the score reliably finds records that *sound* adjacent — shared craft
vocabulary, similar section headings — and cannot tell that a scheduling
practice and a progression metric have nothing to say to each other. Every
edge in this corpus still needs a human to confirm it.

One rule-3 exception was resolved by hand rather than by threshold:
`buffer-discipline` → `serial-fiction-conventions` scores 0.099, just under
the cross-family floor, because a practice record and a convention record
share little wording. The relationship is nonetheless direct, so the link
was pinned.

## Still open from audit pass A

- Recommendation 3: the 14 system/comparison records missing a "visibility
  to characters and readers" treatment, plus `qi-versus-mana`'s missing
  experiments section and the fatigue cluster's two missing sections.
- Recommendation 4: five records declaring `source_confidence: mixed` on a
  single source (see `qa/citation-audit.md`).
- Recommendation 5: Batch 13, now unblocked, drafted against the new policy.

---

# Remediation pass 2 — sections and sourcing marks (2026-09-05)

Closes the last two open recommendations from audit pass A. With this pass,
**every structural finding from that audit is resolved**: the audit now
reports zero required-section gaps, zero enum violations, zero naming
mismatches, zero broken or one-way links, and zero orphans.

## Required sections filled (20 records)

Each of the 20 flagged records was read before editing rather than patched
from the keyword report, and each addition was written to that record's own
subject rather than from a template. The keyword flags proved accurate: all
20 were genuine gaps.

- **Visibility to characters and readers — 14 records.** The most-skipped
  requirement in the corpus, and the one that most changes coaching advice.
  Ten records already carried a "Progression, failure behavior, and
  cross-mechanic interaction" section and had visibility added to it (the
  heading now names visibility explicitly); four had no such section and
  received one.
- **Exploits, edge cases, and interaction — 6 records**, including new
  sections for `experience-sources-and-milestone-growth`,
  `institutions-labor-and-governance`, and `medicine-religion-and-crime`.
- **Consequences — 4 records**, including the social and economic
  consequences of `vertical-vs-horizontal-progression` and of
  `visible-vs-hidden-systems`, both of which had treated their subject purely
  as a pacing or POV decision.
- **Progression and failure behaviour — 3 records.**

Three outright missing top-level sections were also written:

- `craft.comparison.resource.qi-versus-mana` gained the "Revision or design
  experiments" section it had been missing since Batch 3 — nine batches
  during which it was the corpus's flagship comparison record.
- `craft.trope.fatigue.overused-litrpg-trope-cluster` gained "Common forms
  and variants" and "Common failure modes". Both were written to preserve the
  record's deliberate position: its failure-modes section names the failure
  of using a convention unexamined *and* the failure of overreacting to
  fatigue talk — dropping a convention the author wants, treating "subverted"
  as automatically better than "executed well", or hedging until the book
  delivers neither promise. The second direction is the one a coach is more
  likely to cause.

### One length-band waiver

The fatigue-cluster record now runs 1,700 words against a 1,400-word
guideline. The handoff calls that band "typical" rather than absolute, and
this record consolidates five distinct conventions that each need their own
promise, fatigue mechanism, and freshening strategy; splitting it into five
records would give each a thinner evidence base than the single source
supports. The waiver is recorded in `qa/audit_corpus.py` with its reason so
it stays a decision rather than drift, and is flagged for the author's
editorial pass. `qi-versus-mana` was tightened to land at 1,799 words, inside
the comparison ceiling.

## Sourcing marks — finding retracted

Audit pass A's recommendation 4 ("five records overstate `mixed` on a single
source") **was wrong and is retracted**; see `qa/citation-audit.md` for the
full correction. Reading the five sourcing notes showed that four of them
already explain their mixture as a well-supported principle extended by this
pass's own synthesis or adaptation — a legitimate use of `mixed` that the
handoff had simply never disambiguated from "a mixture of sources."

The fix was therefore definitional rather than record-by-record: the handoff
now defines all four `source_confidence` values and requires a `mixed`
record's sourcing note to say which kind of mixture it means.
`qa/audit_corpus.py` now tests for that explanation instead of counting
sources. One genuine change resulted —
`craft.trope.structure.sacrifice-and-return` moved to `contested`, which its
own note had already described in all but name.

The lesson is worth keeping: a whole-corpus script is good at finding places
where records disagree with each other, and bad at knowing which side of the
disagreement is right. Both of this pass's tooling changes came from reading
records the tool had confidently flagged.

## Corpus state after both remediation passes

| check | result |
|---|---|
| records | 130 (unchanged) |
| required-section gaps | 0 |
| enum violations / naming mismatches | 0 / 0 |
| broken, one-way, or orphan links | 0 / 0 / 0 |
| records outside the length band | 0 (1 waived with reason) |
| `source_confidence` | 65 mixed, 52 limited, 12 high, 1 contested |
| word count min / median / max | 707 / 987 / 1,799 |

**Open, and not a structural problem:** 44 records rest on a single source at
`limited`, and the two internal research documents are cited by 37 and 35
records. That is a research task for a later pass, not a labeling one.

**Next:** Batch 13, drafted under the new related-link policy — 50 records
remain against the 180 target (18 `general`, 26 `system`, 24 `trope`).

---

# Batch 13 near-duplicate check (2026-09-05, 142 records)

Every pair involving one of the twelve new records was scored against the
whole corpus. **The closest scores 0.233** — well below the 0.417 maximum the
corpus carried before this batch, and below every pair reviewed in audit pass
A. No merge or re-scope candidates.

The four closest, each checked by hand:

- `pov.multiple-viewpoint-management` / `role.villain-protagonist` (0.233) —
  shared vocabulary only ("viewpoint"), no overlap in subject. Not linked and
  should not be.
- `encounter.enemy-design-and-difficulty-scaling` /
  `progression.fake-progression` (0.217) — genuinely adjacent: fake
  progression is the reader-facing symptom, enemy scaling is one mechanism
  that produces it. Each names the other; the new record states the
  distinction in its own text.
- `pov.multiple-viewpoint-management` /
  `structure.opening-pages-and-reader-commitment` (0.206) — both discuss
  reader attachment, at different scales. Distinct, not linked.
- `onboarding.system-introduction-and-tutorialization` /
  `quest.quest-and-reward-design` (0.204) — both new, both about system
  interfaces; scoped apart deliberately (teaching versus paying) and
  cross-linked through the system cluster.

Each new record was also scoped in its own text against its nearest existing
neighbour before drafting: opening pages against promise consistency and
genre signaling; multiple viewpoints against information control and psychic
distance; subplots against complications and causal escalation; setting as
pressure against description and specificity; quests against the quest trope;
parties against ensemble-cast dynamics and encounter teamwork; enemy design
against advancement rate; onboarding against system-as-narrator intrusion;
the hub against the academy story and the base-building profile; the villain
protagonist against the antihero; coming-of-age against internal and external
arcs; amnesia against hidden identity.

One incidental finding worth recording: "supplies" ranks as a shared
high-weight term across several pairs. It is a drafting tic in the sources
sections of records written in this pass, not a signal about content — a
reminder that a similarity score measures wording, and that a corpus written
to a fixed template will always score its own scaffolding.

## Link graph after Batch 13

459 mutual pairs across 142 records (was 399 across 130). The twelve new
records were drafted with five hand-chosen links each under the policy;
`qa/relink.py` then reciprocated those into 60 existing records. No
algorithmic fill was needed — degree fill and cross-family fill both added
zero — because every new record already met the policy on its own. Zero
orphans, zero one-way links, zero records without a cross-family link.
