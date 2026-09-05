# Writing Coach Craft Library — Working Corpus

**Status:** active draft content production, run in parallel with roadmap
Slice 4.18 per `docs/writing-coach-corpus-production-handoff.md`.
**This is not the 4.17 runtime schema, not canon, and not author-vetted.**
Every record here carries `author_vetted: false` and stays that way until the
author reviews it.

## What this is

A draft library of craft-coaching reference documents: general fiction craft,
tropes/conventions, and RPG/progression-system mechanics. Records are
Markdown with YAML front matter, organized by family:

- `general/` — Family A, general fiction craft (target 60)
- `tropes/` — Family B, tropes and conventions (target 60)
- `systems/` — Family C, RPG/progression mechanics (target 60)
- `comparisons/` — design-choice comparison records (e.g., qi vs. mana),
  counted toward whichever family they most directly serve
- `profiles/` — subgenre-profile modifier records
- `qa/` — coverage, duplication, citation, and open-question tracking

`catalog.yml` is the authoritative inventory. `sources.yml` is the
deduplicated source registry; documents cite it by `source_ids`.

## Resume protocol

If a session ends mid-production: check the **Batch Log** below for the last
completed batch, check `catalog.yml` for the exact record count and IDs on
disk, then continue with the next batch in the plan. Do not re-open a batch
marked done below unless its QA step flagged unfinished work.

## Batch plan (from the handoff, alternating families)

1. **Batch 1 — Tranche-1 alignment** (8 records, `systems/` +
   `general/`): the eight candidates from
   `docs/research-litrpg-craft-failures.md` Part C.
2. **Batch 2 — General coaching foundation** (`general/`).
3. **Batch 3 — System choice foundation** (`systems/` + `comparisons/`).
4. **Batch 4+** — alternate `general/` / `tropes/` / `systems/` /
   `comparisons/` / `profiles/`, filling the coverage matrix evenly until the
   180-document target (or a documented shortfall) is reached.

## Batch Log

_(Batches are appended here only after they are drafted, QA'd, and their
files exist on disk. Do not mark a batch done in advance.)_

### Batch 1 — Tranche-1 alignment (done)

Drafted the eight tranche-1 candidate records identified in
`docs/research-litrpg-craft-failures.md` Part C, corrected against source
review, with honest detectability and scope, all `author_vetted: false`.

- `systems/craft.system.progression.decorative-chapter-test.md`
- `systems/craft.system.progression.advancement-rate.md`
- `systems/craft.system.progression.stat-block-density.md`
- `systems/craft.system.progression.fake-progression.md`
- `general/craft.general.practice.no-gap-posting.md`
- `general/craft.general.character.power-as-sole-motivation.md`
- `general/craft.general.plot.negative-space-problems-power-cannot-solve.md`
- `general/craft.general.promise.promise-consistency.md`

QA: ran `python3 qa/build_catalog.py` — front matter validated, IDs unique,
`catalog.yml` regenerated, all `author_vetted: false`. 7 `related` links
point to records planned for Batch 2/3 (logged in
`qa/duplication-report.md`, not silently broken). One `source_ids` typo
found and fixed during this batch (see `qa/citation-audit.md`). See
`qa/coverage-matrix.md` for the running family/type breakdown.

### Batch 2 — General coaching foundation (done)

Drafted 14 general-craft foundation records (scene/plot/character/pacing/POV
plus the two practice-cluster records promised as `related` links from
Batch 1), all `author_vetted: false`:

- `general/craft.general.scene.goal-conflict-outcome.md`
- `general/craft.general.scene.scene-turns.md`
- `general/craft.general.scene.sequel-and-reflection.md`
- `general/craft.general.pacing.tension-and-release-cycles.md`
- `general/craft.general.plot.causal-escalation.md`
- `general/craft.general.plot.setup-and-payoff.md`
- `general/craft.general.character.want-versus-need.md`
- `general/craft.general.character.agency.md`
- `general/craft.general.plot.stakes.md`
- `general/craft.general.plot.climax-and-resolution.md`
- `general/craft.general.pacing.pacing-across-scales.md`
- `general/craft.general.pov.information-control.md`
- `general/craft.general.practice.buffer-discipline.md`
- `general/craft.general.practice.author-burnout-as-craft-problem.md`

QA: `python3 qa/build_catalog.py` now reports 22 total records (18
`general`, 4 `system`), all `author_vetted: false`, no duplicate IDs. All
Batch 1 pending `related` links to `general/*` records now resolve. 4
`related` links remain pending: 3 to `systems/` records planned for Batch 3,
1 (`craft.general.character.internal-and-external-arcs`) to a Family A
record not yet scheduled — logged in `qa/duplication-report.md`. See
`qa/coverage-matrix.md` for the updated breakdown.

### Batch 3 — System choice foundation (done)

Drafted 12 system-mechanic/comparison records covering resource models,
progression architecture, combat, economy, and systemic consequences, all
`author_vetted: false`:

- `comparisons/craft.comparison.resource.qi-versus-mana.md`
- `systems/craft.system.resource.resource-lifecycle-design.md`
- `comparisons/craft.comparison.progression.hard-numbers-versus-named-tiers.md`
- `systems/craft.system.progression.visible-vs-hidden-systems.md`
- `systems/craft.system.progression.system-as-narrator-intrusion.md`
- `systems/craft.system.cultivation.realms-and-breakthroughs.md`
- `comparisons/craft.comparison.progression.classes-versus-skill-based-growth.md`
- `systems/craft.system.progression.vertical-vs-horizontal-progression.md`
- `systems/craft.system.combat.action-economy.md`
- `systems/craft.system.combat.death-and-respawn.md`
- `systems/craft.system.economy.crafting-and-economy-loops.md`
- `systems/craft.system.consequences.systemic-social-consequences.md`

QA: `python3 qa/build_catalog.py` now reports 34 total records (18
`general`, 13 `system`, 3 `comparison`, 0 `trope`, 0 `profile`), all
`author_vetted: false`, no duplicate IDs. All 3 Batch-2-pending `related`
links to `systems/` records now resolve. Cultivation/qi records were
drafted with the historical-versus-genre-convention distinction the handoff
requires (see each record's closing sourcing note). Only 1 pending
`related` link remains, to a Family A record not yet scheduled. See
`qa/coverage-matrix.md` for the updated breakdown.

### Batch 4 — Tropes and conventions, opening set (done)

Drafted the first 12 `trope` records, opening Family B (previously at
zero, a deviation from the alternating-family plan now corrected), all
`author_vetted: false`:

- `tropes/craft.trope.role.mentor.md`
- `tropes/craft.trope.role.chosen-one.md`
- `tropes/craft.trope.role.found-family.md`
- `tropes/craft.trope.role.reluctant-hero.md`
- `tropes/craft.trope.romance.romantic-subplot-conventions.md`
- `tropes/craft.trope.structure.the-quest.md`
- `tropes/craft.trope.structure.the-heist.md`
- `tropes/craft.trope.identity.hidden-identity-and-secret-heritage.md`
- `tropes/craft.trope.structure.the-prophecy.md`
- `tropes/craft.trope.structure.time-loop.md`
- `tropes/craft.trope.setting.academy-story.md`
- `tropes/craft.trope.role.antihero-and-redeemed-enemy.md`

Each explicitly distinguishes presence from quality (a "when straightforward
execution is the right choice" section) per the handoff's trope-specific
requirement. Several records (found-family, romantic-subplot-conventions,
the-heist, hidden-identity, the-prophecy, time-loop, academy-story) rest on
`source_confidence: limited` because no dedicated craft-literature source
for that specific trope was available to this pass — logged in
`qa/citation-audit.md` as a revision-pass target rather than hidden.

QA: `python3 qa/build_catalog.py` reports 46 total records (18 `general`,
13 `system`, 3 `comparison`, 12 `trope`, 0 `profile`), all
`author_vetted: false`, no duplicate IDs, no new broken `related` links.

### Batch 5 — Subgenre coaching profiles (partial: 8 of 12)

Converted 8 of the 12 subgenre coaching profiles drafted as research in
`docs/research-litrpg-genre.md` Part A2 into full catalog records
(`document_type: subgenre-profile`), each with corrected sourcing marks,
the full 11-part required body structure, and an explicit "what this
profile modifies in other records" section connecting it to already-drafted
patterns, all `author_vetted: false`:

- `profiles/craft.profile.classic-litrpg.md`
- `profiles/craft.profile.progression-fantasy.md`
- `profiles/craft.profile.dungeon-core.md`
- `profiles/craft.profile.system-apocalypse.md`
- `profiles/craft.profile.tower-climbing.md`
- `profiles/craft.profile.cultivation.md`
- `profiles/craft.profile.base-building.md`
- `profiles/craft.profile.gamelit.md`

**Not yet converted (remaining coverage gap, next session should start
here):** dark/horror LitRPG, isekai/portal fantasy, crafting and economy,
time loop (note: a `trope` record for time-loop structure already exists —
`tropes/craft.trope.structure.time-loop.md` — but the *subgenre-profile*
modifier record, covering what it changes about other patterns the way the
other 8 profiles do, is still open).

QA: `python3 qa/build_catalog.py` reports 54 total records (18 `general`,
13 `system`, 3 `comparison`, 12 `trope`, 8 `profile`), all
`author_vetted: false`, no duplicate IDs, no new broken `related` links (the
1 pending link from Batch 2 is still open, unrelated to this batch).

### Batch 6 — Remaining subgenre coaching profiles (done)

Converted the final 4 of the 12 subgenre coaching profiles from
`docs/research-litrpg-genre.md` Part A2, closing out the `profile` family
at its full 12-subgenre target, all `author_vetted: false`:

- `profiles/craft.profile.dark-horror-litrpg.md`
- `profiles/craft.profile.isekai-portal-fantasy.md`
- `profiles/craft.profile.crafting-and-economy.md`
- `profiles/craft.profile.time-loop.md`

The time-loop profile is explicitly a companion to
`tropes/craft.trope.structure.time-loop.md` (drafted in Batch 4): the trope
record covers the loop mechanic itself, this profile covers how loop
structure rescopes or suspends other library patterns (per-loop rather than
per-chapter application of the decorative chapter test, non-application of
the abandoned-progression-methods pattern, restated advancement-rate
guidance). Each of the 4 records includes the required "what this profile
modifies in other records" section connecting it to already-drafted
patterns, matching the Batch 5 template.

QA: `python3 qa/build_catalog.py` reports 58 total records (18 `general`,
13 `system`, 3 `comparison`, 12 `trope`, 12 `profile`), all
`author_vetted: false`, no duplicate IDs, no new broken `related` links. The
`profile` family is now complete at its 12-subgenre scope; the 1 pending
`related` link (unrelated to this batch, open since Batch 2) is unchanged.

### Batch 7 — Family A general craft cluster (done)

Drafted 12 `general` records covering premise/theme, character arcs,
plot structure, exposition, chapter architecture, tension-adjacent pacing,
antagonism, supporting cast, voice/dialogue/description, and revision
practice — the largest single-batch addition to Family A so far, all
`author_vetted: false`:

- `general/craft.general.premise.dramatic-question-and-controlling-idea.md`
- `general/craft.general.character.internal-and-external-arcs.md`
  (closes the `related` link pending since Batch 2)
- `general/craft.general.plot.midpoint-and-reversals.md`
- `general/craft.general.plot.exposition-and-info-delivery.md`
- `general/craft.general.structure.chapter-architecture-and-transitions.md`
- `general/craft.general.pacing.suspense-uncertainty-and-anticipation.md`
- `general/craft.general.character.antagonistic-force.md`
- `general/craft.general.character.supporting-cast-purpose.md`
- `general/craft.general.voice.dialogue-and-subtext.md`
- `general/craft.general.voice.description-and-specificity.md`
- `general/craft.general.voice.narrative-summary-vs-scene.md`
- `general/craft.general.revision.triage-and-beta-reader-signal.md`

QA: `python3 qa/build_catalog.py` reports 70 total records (30 `general`,
13 `system`, 3 `comparison`, 12 `trope`, 12 `profile`), all
`author_vetted: false`, no duplicate IDs, **zero pending `related` links**
— the single link open since Batch 2 is now resolved. `general` is halfway
to its 60-record target.

### Batch 8 — Family C system mechanics cluster (done)

Drafted 12 records covering resource archetypes, character architecture,
advancement design, encounter mechanics, and object economy — the largest
single-batch addition to Family C so far, all `author_vetted: false`:

- `comparisons/craft.comparison.resource.renewable-vs-finite-resources.md`
- `systems/craft.system.resource.resource-archetype-survey.md`
- `systems/craft.system.resource.cooldowns-charges-and-sacrifice.md`
- `systems/craft.system.character.attributes-and-soft-hard-caps.md`
- `systems/craft.system.character.perks-feats-and-talents.md`
- `systems/craft.system.character.affinities-resistances-titles-and-bloodlines.md`
- `systems/craft.system.advancement.experience-sources-and-milestone-growth.md`
- `systems/craft.system.advancement.diminishing-returns-rarity-gates-and-catch-up-mechanics.md`
- `systems/craft.system.encounter.range-positioning-damage-and-defenses.md`
- `systems/craft.system.encounter.status-effects-crowd-control-and-counters.md`
- `systems/craft.system.encounter.healing-teamwork-and-information-asymmetry.md`
- `systems/craft.system.economy.loot-durability-inventory-and-ownership.md`

Several records deliberately consolidate adjacent coverage-plan topics into
one entry rather than splitting into many thin records (e.g., affinities +
resistances + titles + bloodlines; diminishing returns + rarity gates +
catch-up mechanics) — consistent with the handoff's instruction to merge
entries that would be near-duplicates and avoid padding the count. Four
records (perks/feats/talents, affinities/titles/bloodlines,
loot/durability/inventory/ownership, plus one from Batch 4) carry
`source_confidence: limited` for lack of a dedicated craft-literature
source, logged explicitly rather than borrowed confidence.

QA: `python3 qa/build_catalog.py` reports 82 total records (30 `general`,
24 `system`, 4 `comparison`, 12 `trope`, 12 `profile`), all
`author_vetted: false`, no duplicate IDs, zero pending `related` links.
`system` has now passed the halfway mark toward its 60-record target.

### Batch 9 — Family B trope cluster (done)

Drafted 12 records addressing the roles, structures, and identity-plot
tropes flagged as the coverage plan's remaining Family B gaps, all
`author_vetted: false`:

- `tropes/craft.trope.role.rival.md`
- `tropes/craft.trope.role.trickster.md`
- `tropes/craft.trope.role.heir-and-succession.md`
- `tropes/craft.trope.structure.trial-and-tournament.md`
- `tropes/craft.trope.structure.mystery.md`
- `tropes/craft.trope.structure.revenge.md`
- `tropes/craft.trope.structure.survival.md`
- `tropes/craft.trope.structure.transformation.md`
- `tropes/craft.trope.identity.betrayal.md`
- `tropes/craft.trope.identity.resurrection.md`
- `tropes/craft.trope.structure.faction-conflict-and-war.md`
- `tropes/craft.trope.structure.sacrifice-and-return.md`

Two records (heir-and-succession, sacrifice-and-return) deliberately
consolidate adjacent coverage-plan topics per the handoff's merge
instruction. Eight of twelve carry `source_confidence: limited` for lack
of a dedicated craft-literature source on that specific trope — consistent
with Batch 4's pattern, logged explicitly in each record rather than
borrowed confidence, and flagged again in `qa/citation-audit.md`.

QA: `python3 qa/build_catalog.py` reports 94 total records (30 `general`,
24 `system`, 4 `comparison`, 24 `trope`, 12 `profile`), all
`author_vetted: false`, no duplicate IDs, zero pending `related` links.
`trope` has doubled and now sits at 40% of its 60-record target, closing
most of the gap with `general` and `system`.

### Batch 10 — Family A general craft cluster, second pass (done)

Drafted 12 records closing the remaining gaps identified after Batch 7 —
scene entry/exit points, values/contradiction, relationship arcs,
complications, foreshadowing, earned resolution, escalation ceilings/
urgency/pressure, psychic distance/interiority, voice as a craft element,
continuity passes, protecting reader experience, and genre signaling — all
`author_vetted: false`:

- `general/craft.general.scene.entry-and-exit-points.md`
- `general/craft.general.character.values-contradiction-and-meaningful-choice.md`
- `general/craft.general.character.relationships-and-relational-arcs.md`
- `general/craft.general.plot.complications.md`
- `general/craft.general.plot.foreshadowing.md`
- `general/craft.general.plot.earned-resolution.md`
- `general/craft.general.pacing.escalation-ceilings-urgency-and-pressure.md`
- `general/craft.general.pov.psychic-distance-and-interiority.md`
- `general/craft.general.voice.voice-as-craft-element.md`
- `general/craft.general.revision.continuity-passes.md`
- `general/craft.general.revision.protecting-reader-experience.md`
- `general/craft.general.plot.reader-expectation-and-genre-signaling.md`

Each new record is deliberately scoped distinct from its closest existing
neighbor rather than restating it — e.g., foreshadowing versus the broader
setup/payoff pattern, complications versus causal-escalation, psychic
distance versus the existing POV/information-control record — with each
record's own text naming the distinction explicitly to guard against
future duplication.

QA: `python3 qa/build_catalog.py` reports 106 total records (42 `general`,
24 `system`, 4 `comparison`, 24 `trope`, 12 `profile`), all
`author_vetted: false`, no duplicate IDs, zero pending `related` links.
`general` is now at 70% of its 60-record target, the closest any family has
come to completion.

### Batch 11 — Family C system mechanics, second pass (done)

Drafted 12 records filling the genuinely new gaps identified after Batch
10 — two comparison records plus resource, cultivation, character-
architecture, economy, and systemic-consequences depth beyond the Batch 8
survey pass, all `author_vetted: false`:

- `comparisons/craft.comparison.progression.universal-vs-class-bound-access.md`
- `comparisons/craft.comparison.resource.pools-vs-thresholds.md`
- `systems/craft.system.resource.health-and-focus-as-core-resources.md`
- `systems/craft.system.resource.environmental-and-hybrid-power.md`
- `systems/craft.system.cultivation.body-and-soul-cultivation.md`
- `systems/craft.system.cultivation.alchemy-and-pill-refinement.md`
- `systems/craft.system.cultivation.sects-inheritance-and-deviation.md`
- `systems/craft.system.character.specialization-and-respec.md`
- `systems/craft.system.economy.currencies-markets-and-inflation.md`
- `systems/craft.system.economy.enchanting-and-item-crafting.md`
- `systems/craft.system.consequences.institutions-labor-and-governance.md`
- `systems/craft.system.consequences.medicine-religion-and-crime.md`

The two systemic-consequences records deliberately present themselves as
depth applications of the existing general systemic-social-consequences
record rather than restatements, each naming the distinction in its own
text. Cultivation records continue the historical-versus-genre-convention
separation established in Batch 3 and 6 (e.g., sects-inheritance-and-
deviation is explicit that qi deviation is a fictional convention, not a
documented historical Daoist practice).

QA: `python3 qa/build_catalog.py` reports 118 total records (42 `general`,
34 `system`, 6 `comparison`, 24 `trope`, 12 `profile`), all
`author_vetted: false`, no duplicate IDs, zero pending `related` links.
`system` is now at 57% of its 60-record target.

### Batch 12 — Family B trope cluster, second pass (done)

Drafted 12 records closing the remaining Family B coverage-plan gaps —
companion and ensemble-cast roles, portal/other-world structure, genre-
specific convention records (horror, mystery, fantasy, science fiction,
serial fiction, progression fiction), inversions/combinations as a
standalone record, and the delicate fatigue-sensitive trope cluster — all
`author_vetted: false`:

- `tropes/craft.trope.role.companion.md`
- `tropes/craft.trope.role.ensemble-cast-dynamics.md`
- `tropes/craft.trope.role.the-outsider-and-belonging.md`
- `tropes/craft.trope.structure.portal-and-other-world.md`
- `tropes/craft.trope.convention.horror-genre-conventions.md`
- `tropes/craft.trope.convention.mystery-genre-conventions.md`
- `tropes/craft.trope.convention.fantasy-genre-conventions.md`
- `tropes/craft.trope.convention.science-fiction-conventions.md`
- `tropes/craft.trope.convention.serial-fiction-conventions.md`
- `tropes/craft.trope.convention.progression-fiction-reader-expectations.md`
- `tropes/craft.trope.combination.inversions-and-combinations.md`
- `tropes/craft.trope.fatigue.overused-litrpg-trope-cluster.md`

The fatigue-cluster record required particular care per the handoff's
voice standard: it names five reader-fatigue-associated conventions from a
single working author's candid, ranked opinion, holds their commercial
success and their fatigue risk as simultaneously true rather than
resolving the tension, avoids "problematic" framing, and gives each
convention its own specific, descriptive fatigue mechanism and freshening
strategy rather than a blanket verdict. This closes open question #1 from
`qa/unresolved-claims.md` — not by resolving it, but by drafting the
record the open question was actually about, with the tension deliberately
preserved in the record's own text rather than hidden.

QA: `python3 qa/build_catalog.py` reports 130 total records (42 `general`,
34 `system`, 6 `comparison`, 36 `trope`, 12 `profile`), all
`author_vetted: false`, no duplicate IDs, zero pending `related` links.
`trope` is now at 60% of its 60-record target, closing the gap with the
other core families.

### Audit pass A — whole-corpus review (done, no new records)

Not a batch. The holistic near-duplicate and cross-link audit flagged as due
in the Batch 12 coverage-matrix notes, run 2026-09-05 with new draft tooling
`qa/audit_corpus.py` (pairwise tf-idf over all 8,385 record pairs, plus
link-graph, structural, and sourcing checks). Record count unchanged at 130.

**No merges or splits.** All 60 closest pairs reviewed by hand and found
genuinely distinct; the per-batch duplication discipline held up.

**Found instead:** `related` is a backward-pointing tree, not a web — a
fixed ~2-link quota per record, chosen from what existed at drafting time,
leaves 62 of 130 records (48%) with zero inbound links, only 27 mutual
pairs, and zero intra-family links among the 12 `profile` records. Also 21
records with a required-section gap (most often "visibility to characters
and readers" in system/comparison records, 14 of them), and 5 records
declaring `source_confidence: mixed` on a single source.

Full findings and a prioritised remediation list: `qa/duplication-report.md`.
Confidence-mark corrections: `qa/citation-audit.md`.

**Next session should decide between** a remediation pass (links, sections,
confidence marks) and Batch 13 drafting. The audit recommends remediation
first, and that any further drafting use a raised link quota of four to six
`related` links with at least one crossing families.
