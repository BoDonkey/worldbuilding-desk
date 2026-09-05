# Coverage Matrix

**Status:** running tracker, updated after every batch. Regenerate the
family/type/detectability counts with `python3 qa/build_catalog.py` (draft
tooling only, not runtime code) and update this file by hand with narrative
notes the script doesn't produce.

## Target

180 draft records: 60 `general`, 60 `trope`, 60 `system`, plus additional
`comparison` and `profile` records as time and source quality allow, counted
toward whichever family they most directly serve.

## After Batch 1 (Tranche-1 alignment)

Total: **8 records** (4 `general`, 4 `system`, 0 `trope`, 0 `comparison`,
0 `profile`).

| document_type | count |
|---|---|
| pattern | 8 |

| detectability | count |
|---|---|
| model-assisted | 5 |
| practice | 2 |
| deterministic | 1 |

**Covered so far:** decorative chapter test, advancement rate, stat-block
density, fake progression, no-gap posting, power as sole motivation,
negative-space problems, promise consistency.

**Immediate gaps this creates (feeds Batch 2/3 planning):**

- General fiction craft (Family A) has only two entries not tied to
  progression fiction (power-as-sole-motivation and promise-consistency both
  generalize, but neither is a foundational scene/plot-mechanics entry yet).
  Batch 2 must open with premise, scene structure, and tension/release
  fundamentals.
- Tropes (Family B) has zero entries. Not started until Batch 4+ per the
  handoff's alternating-family instruction.
- System mechanics (Family C) has four progression-pattern entries but no
  resource-model or comparison entries yet (mana/qi, hard numbers vs. named
  tiers, etc.) — Batch 3's focus.
- Seven `related` links point to records not yet drafted (see
  `qa/duplication-report.md`'s pending-links log). All seven are already
  planned for Batch 2 or Batch 3.

## After Batch 2 (General coaching foundation)

Total: **22 records** (18 `general`, 4 `system`, 0 `trope`, 0 `comparison`,
0 `profile`).

| document_type | count |
|---|---|
| pattern | 22 |

| detectability | count |
|---|---|
| model-assisted | 17 |
| practice | 4 |
| deterministic | 1 |

**Added:** scene goal-conflict-outcome, scene turns, sequel/reflection,
tension-and-release cycles, causal escalation, setup/payoff, want vs. need,
character agency, stakes, climax/resolution, pacing across scales, POV/
information control, buffer discipline, author burnout as craft problem.

**Gaps carried into Batch 3+:**

- `general` family still needs: premise/dramatic question/theme/controlling
  idea, reversals/midpoint/complications, exposition/transitions/chapter
  architecture, suspense/uncertainty/urgency/mystery/anticipation (distinct
  from tension/release), internal-vs-external arcs, values/contradiction,
  relationships/antagonistic force/supporting-cast purpose, voice/
  interiority/dialogue/subtext/description/specificity/narrative summary,
  revision triage/beta-reader signal/continuity passes. ~46 slots remain
  against the 60 target.
- `trope` family: still zero entries. Starts Batch 4.
- `system` family: 4 progression-pattern entries; Batch 3 adds the resource-
  model and comparison foundation (qi vs. mana, hard numbers vs. named
  tiers, visible vs. hidden systems, cultivation realms, classes vs.
  skill-based growth, vertical vs. horizontal, costs/limits, action economy,
  death/respawn, crafting/economy, systemic consequences).
- 4 pending `related` links remain (see `qa/duplication-report.md`); 3
  resolve in Batch 3, 1 in a later Family A batch.

## After Batch 3 (System choice foundation)

Total: **34 records** (18 `general`, 13 `system`, 3 `comparison`, 0
`trope`, 0 `profile`).

| document_type | count |
|---|---|
| pattern | 23 |
| system-mechanic | 6 |
| comparison | 5 |

| detectability | count |
|---|---|
| model-assisted | 29 |
| practice | 4 |
| deterministic | 1 |

**Added:** qi vs. mana, resource lifecycle design, hard numbers vs. named
tiers, visible vs. hidden systems, system-as-narrator intrusion, cultivation
realms/breakthroughs, classes vs. skill-based growth, vertical vs.
horizontal progression, action economy, death/respawn, crafting/economy
loops, systemic social consequences.

**Gaps carried into Batch 4+:**

- `trope` family: still zero entries. Must start Batch 4 per the handoff's
  alternating-family instruction — three batches of non-trope content in a
  row is already a deviation worth correcting next.
- `system` family (target 60): 13 drafted. Still needs: resource models not
  yet covered individually (stamina, rage, faith/divine favor, psionics,
  soul/spirit, blood, life force, cooldowns/charges, sacrifice, environmental
  power, hybrid resources — currently only qi/mana and a generic lifecycle
  framework exist), character-architecture entries beyond classes-vs-skills
  (attributes, perks/feats/talents, affinities/resistances, titles,
  bloodlines, multiclassing detail, soft/hard caps), advancement entries
  (experience sources, milestone growth, training, diminishing returns,
  rarity gates, catch-up mechanics), encounter entries beyond action economy
  (range/positioning, damage/defenses, healing, status effects/crowd
  control, counters, teamwork, information asymmetry), and object/economy
  entries beyond crafting loops (loot/rarity, durability, inventory/
  encumbrance, currencies/sinks/inflation, quest rewards, ownership).
- `general` family (target 60): 18 drafted. Still needs: premise/dramatic
  question/theme/controlling idea, plot escalation/reversals/midpoint/
  climax-adjacent beats not yet covered, exposition/transitions/chapter
  architecture, suspense/uncertainty/mystery/anticipation (distinct from the
  drafted tension/release record), values/contradiction, internal-and-
  external-arcs (already referenced as a pending link), relationships/
  antagonistic force/supporting-cast purpose, voice/interiority/dialogue/
  subtext/description/specificity/narrative summary, revision triage/
  beta-reader signal/continuity passes.
- `comparison`/`profile`: comparisons started (3); subgenre `profile`
  records (the twelve-subgenre coaching profiles drafted as research in
  `docs/research-litrpg-genre.md` Part A2) not yet converted into catalog
  records at all — a natural, largely research-ready Batch 4 or 5 target.
- 1 pending `related` link remains
  (`craft.general.character.internal-and-external-arcs`, referenced from
  `craft.general.character.want-versus-need`), planned for the next
  Family A batch.

## After Batch 4 (Tropes and conventions, opening set)

Total: **46 records** (18 `general`, 13 `system`, 3 `comparison`, 12
`trope`, 0 `profile`).

| document_type | count |
|---|---|
| pattern | 23 |
| system-mechanic | 6 |
| comparison | 5 |
| trope | 12 |

| detectability | count |
|---|---|
| model-assisted | 41 |
| practice | 4 |
| deterministic | 1 |

**Added:** mentor, chosen one, found family, reluctant hero, romantic
subplot conventions, the quest, the heist, hidden identity/secret heritage,
the prophecy, time loop, academy story, antihero/redeemed enemy.

**Gaps carried into Batch 5+:**

- `trope` family (target 60): 12 drafted, 48 remain. Still needs: rivals,
  heirs, tricksters (named but not yet drafted), inclusive/varied romance
  beyond the general convention record, trials/tournaments/mysteries/
  revenge/survival/transformation/return/sacrifice/succession, betrayal/
  resurrection/portal-other-world/faction-conflict/war, horror/mystery/
  science-fiction/serial-fiction-specific conventions, deliberate
  inversions/combinations as their own records, and fatigue-sensitive
  conventions beyond what's touched in chosen-one/antihero.
- `general` and `system` gaps from Batch 2/3 notes remain open (detectability
  mix is now 41 model-assisted / 4 practice / 1 deterministic — the single
  `deterministic` record, advancement-rate, is worth revisiting: Batch 5+
  should look for 1-2 more genuinely deterministic candidates, e.g. among
  encounter/economy structured-data patterns, so the corpus doesn't
  under-represent deterministic-scope content).
- `profile` family: still zero. The twelve subgenre coaching profiles in
  `docs/research-litrpg-genre.md` Part A2 are drafted research, not yet
  catalog records — converting them (with corrected sourcing marks) is a
  self-contained, high-value Batch 5 or 6 target.
- 1 pending `related` link remains, unchanged from Batch 3.

## After Batch 5 (Subgenre coaching profiles, partial)

Total: **54 records** (18 `general`, 13 `system`, 3 `comparison`, 12
`trope`, 8 `profile`).

| document_type | count |
|---|---|
| pattern | 23 |
| system-mechanic | 6 |
| comparison | 5 |
| trope | 12 |
| subgenre-profile | 8 |

| detectability | count |
|---|---|
| model-assisted | 41 |
| practice | 12 |
| deterministic | 1 |

**Added:** subgenre profiles for classic LitRPG, progression fantasy,
dungeon core, system apocalypse, tower climbing, cultivation, base
building, GameLit.

**Immediate next-session priorities (see README Batch 5 note for detail):**

1. Finish the remaining 4 subgenre profiles: dark/horror LitRPG, isekai/
   portal fantasy, crafting and economy, time loop.
2. Resume Family A (`general`, target 60, currently 18): premise/dramatic
   question/theme/controlling idea cluster; plot escalation/reversals/
   midpoint cluster; exposition/transitions/chapter-architecture cluster;
   suspense/uncertainty/mystery/anticipation cluster (distinct from the
   drafted tension/release record); `craft.general.character.internal-and-
   external-arcs` specifically (resolves the one open pending `related`
   link); relationships/antagonistic-force/supporting-cast-purpose cluster;
   voice/interiority/dialogue/subtext/description/specificity/narrative-
   summary cluster; revision-triage/beta-reader-signal/continuity-pass
   cluster.
3. Resume Family C (`system`, target 60, currently 13): remaining resource
   models (stamina, rage, faith/divine favor, psionics, soul/spirit, blood,
   life force, cooldowns/charges, sacrifice, environmental power, hybrid
   resources); character-architecture beyond classes-vs-skills (attributes,
   perks/feats/talents, affinities/resistances, titles, bloodlines,
   multiclassing detail, soft/hard caps); advancement cluster (experience
   sources, milestone growth, training, diminishing returns, rarity gates,
   catch-up mechanics); encounter cluster beyond action economy (range/
   positioning, damage/defenses, healing, status effects/crowd control,
   counters, teamwork, information asymmetry); object/economy cluster
   beyond crafting loops (loot/rarity, durability, inventory/encumbrance,
   currencies/sinks/inflation, quest rewards, ownership).
4. Resume Family B (`trope`, target 60, currently 12): rivals, heirs,
   tricksters, trials/tournaments/mysteries/revenge/survival/
   transformation/return/sacrifice/succession, betrayal/resurrection/
   faction-conflict/war, horror/mystery/sf/serial-fiction-specific
   conventions, deliberate inversions/combinations, fatigue-sensitive
   conventions as their own records.
5. Comparisons (currently 3): visible-progression comparisons not yet
   covered as standalone comparison records (universal vs. class-bound
   access, pools vs. thresholds) could be split out from existing records
   or drafted fresh.

At 54/180 (30%), roughly proportional progress across all three core
families plus a meaningful start on comparisons and profiles. No family has
been neglected relative to the others by more than the profile/trope
late-start already noted and now corrected.

## After Batch 6 (Remaining subgenre coaching profiles)

Total: **58 records** (18 `general`, 13 `system`, 3 `comparison`, 12
`trope`, 12 `profile`).

| document_type | count |
|---|---|
| pattern | 23 |
| system-mechanic | 6 |
| comparison | 5 |
| trope | 12 |
| subgenre-profile | 12 |

| detectability | count |
|---|---|
| model-assisted | 41 |
| practice | 16 |
| deterministic | 1 |

**Added:** subgenre profiles for dark/horror LitRPG, isekai/portal fantasy,
crafting and economy, time loop.

**`profile` family is now complete** at its full 12-subgenre scope from
`docs/research-litrpg-genre.md` Part A2. No further profile records are
planned unless the author identifies a genuinely new subgenre during
review; this family is out of scope for future batches unless revisited.

**Next-session priorities, updated:**

1. Family A (`general`, target 60, currently 18) — see the cluster list
   under "After Batch 5" above; unchanged and still the largest gap
   relative to target.
2. Family C (`system`, target 60, currently 13) — see the cluster list
   under "After Batch 5" above; unchanged.
3. Family B (`trope`, target 60, currently 12) — see the cluster list
   under "After Batch 5" above; unchanged.
4. `comparison` (currently 3) — candidates: universal vs. class-bound
   access, pools vs. thresholds, could be split out fresh rather than
   folded into existing records.
5. The single open `related` link
   (`craft.general.character.internal-and-external-arcs`) should be closed
   in the next Family A batch, since it's been open since Batch 2.

Batch 7 should return to Family A or alternate A/B/C per the handoff's
instruction, now that profiles are done and shouldn't be the reason
another family falls behind again.

## After Batch 7 (Family A general craft cluster)

Total: **70 records** (30 `general`, 13 `system`, 3 `comparison`, 12
`trope`, 12 `profile`).

| document_type | count |
|---|---|
| pattern | 35 |
| system-mechanic | 6 |
| comparison | 5 |
| trope | 12 |
| subgenre-profile | 12 |

| detectability | count |
|---|---|
| model-assisted | 52 |
| practice | 17 |
| deterministic | 1 |

**Added:** dramatic question/controlling idea, internal/external arcs,
midpoint/reversals, exposition/info delivery, chapter architecture/
transitions, suspense/uncertainty/anticipation, antagonistic force,
supporting-cast purpose, dialogue/subtext, description/specificity,
narrative summary vs. scene, revision triage/beta-reader signal.

**Zero pending `related` links** for the first time since Batch 1 — the
`internal-and-external-arcs` link open since Batch 2 is now resolved.

**`general` is now at 30/60 (halfway).** Remaining Family A gaps per the
handoff's coverage plan: plot escalation/complications/earned-resolution
framing distinct from what's drafted; scene entry/exit points (distinct
from the chapter-level record just added); values/contradiction/meaningful
choice; relationships beyond antagonist/supporting-cast (found-family-
adjacent general-fiction relationship dynamics, distinct from the trope
record); continuity passes specifically (only lightly touched inside the
revision-triage record); psychic-distance/interiority as their own
close-up record (touched inside POV/information-control but not developed
standalone).

**Next-session priorities, updated:**

1. Continue Family A toward 60, or alternate to Family B/C per the
   handoff's instruction — both are reasonable; Family A has more
   momentum right now with a clear template established this batch.
2. Family C (`system`, target 60, currently 13) — unchanged list from
   Batch 5/6.
3. Family B (`trope`, target 60, currently 12) — unchanged list from
   Batch 5/6.
4. `comparison` (currently 3) — unchanged candidates from Batch 6.

## After Batch 8 (Family C system mechanics cluster)

Total: **82 records** (30 `general`, 24 `system`, 4 `comparison`, 12
`trope`, 12 `profile`).

| document_type | count |
|---|---|
| pattern | 35 |
| system-mechanic | 17 |
| comparison | 6 |
| trope | 12 |
| subgenre-profile | 12 |

| detectability | count |
|---|---|
| model-assisted | 64 |
| practice | 17 |
| deterministic | 1 |

**Added:** renewable vs. finite resources, resource archetype survey,
cooldowns/charges/sacrifice, attributes and caps, perks/feats/talents,
affinities/resistances/titles/bloodlines, experience sources/milestone
growth, diminishing returns/rarity gates/catch-up mechanics, range/
positioning/damage/defenses, status effects/crowd control/counters,
healing/teamwork/information asymmetry, loot/durability/inventory/
ownership.

**Family progress by proportion of target:** `general` leads at 30/60
(50%), `system` follows at 24/60 (40%), `trope` lags at 12/60 (20%). Zero
pending `related` links maintained through this batch.

**Remaining Family C gaps, updated:** the coverage-plan list is now mostly
addressed at a survey level; remaining candidates are narrower or more
comparison-shaped: universal vs. class-bound resource access, pools vs.
thresholds (both already flagged as comparison candidates), currencies/
market-sinks/inflation as its own dedicated record (touched only lightly
inside crafting-and-economy-loops and the new loot/inventory record), and
quest-reward design specifically (touched only implicitly). Family C's
broad-strokes coverage is now solid; further system batches should lean
toward comparisons and depth rather than more survey breadth.

**Next-session priorities, updated:**

1. Family B (`trope`, target 60, currently 12) — now the most
   underdeveloped family proportionally (20% vs. 40–50% for the others).
   Should be the next batch's focus. Unchanged cluster list from Batch 5/6:
   rivals, heirs, tricksters, trials/tournaments/mysteries/revenge/
   survival/transformation/return/sacrifice/succession, betrayal/
   resurrection/faction-conflict/war, horror/mystery/sf/serial-fiction-
   specific conventions, deliberate inversions/combinations, fatigue-
   sensitive conventions as their own records.
2. Family A (`general`, target 60, currently 30) — remaining gaps per
   Batch 7 notes: scene entry/exit points, values/contradiction/meaningful
   choice, continuity passes as their own record, close-up psychic-
   distance treatment.
3. `comparison` (currently 4) — universal vs. class-bound access, pools vs.
   thresholds.
4. Family C currency/market depth (see note above) — lower priority than
   Family B now.

## After Batch 9 (Family B trope cluster)

Total: **94 records** (30 `general`, 24 `system`, 4 `comparison`, 24
`trope`, 12 `profile`).

| document_type | count |
|---|---|
| pattern | 35 |
| system-mechanic | 17 |
| comparison | 6 |
| trope | 24 |
| subgenre-profile | 12 |

| detectability | count |
|---|---|
| model-assisted | 76 |
| practice | 17 |
| deterministic | 1 |

**Added:** rival, trickster, heir/succession, trial/tournament, mystery,
revenge, survival, transformation, betrayal, resurrection, faction
conflict/war, sacrifice/return.

**Family progress by proportion of target:** `general` 30/60 (50%),
`system` 24/60 (40%), `trope` 24/60 (40% — doubled this batch, now tied
with `system`). All three core families are now within 10 percentage
points of each other for the first time in this production run.

**Remaining Family B gaps:** horror/mystery/sf/serial-fiction-specific
conventions as their own records (mystery is now covered structurally, but
genre-specific *conventions* — e.g., what horror or SF specifically expect
from a trope — remain untouched); deliberate inversions/combinations as
their own dedicated records (touched only within individual trope records'
variant lists so far, not as standalone comparison-style entries); fatigue-
sensitive conventions beyond what chosen-one and antihero already cover
(the P23 overused-trope cluster from the source research — OP protagonist,
harems, secret lost class, exposition companion, uniform attractiveness —
remains an open, deliberately delicate topic per
`qa/unresolved-claims.md`'s open question #1).

**Next-session priorities, updated:**

1. Family A (`general`, target 60, currently 30) — remaining gaps per
   Batch 7 notes: scene entry/exit points, values/contradiction/meaningful
   choice, continuity passes as their own record, close-up psychic-
   distance treatment.
2. Family B (`trope`, target 60, currently 24) — genre-specific
   convention records and the fatigue-sensitive cluster noted above.
3. Family C (`system`, target 60, currently 24) — currency/market/
   inflation depth, quest-reward design; otherwise broad-strokes coverage
   is solid per Batch 8's assessment.
4. `comparison` (currently 4) — universal vs. class-bound access, pools vs.
   thresholds.

At 94/180 (52%), the corpus has now crossed the halfway point.

## After Batch 10 (Family A general craft cluster, second pass)

Total: **106 records** (42 `general`, 24 `system`, 4 `comparison`, 24
`trope`, 12 `profile`).

| document_type | count |
|---|---|
| pattern | 47 |
| system-mechanic | 17 |
| comparison | 6 |
| trope | 24 |
| subgenre-profile | 12 |

| detectability | count |
|---|---|
| model-assisted | 86 |
| practice | 19 |
| deterministic | 1 |

**Added:** scene entry/exit points, values/contradiction/meaningful
choice, relationship arcs, complications, foreshadowing, earned
resolution, escalation ceilings/urgency/pressure, psychic distance/
interiority, voice as a craft element, continuity passes, protecting
reader experience, reader expectation/genre signaling.

**Family progress by proportion of target:** `general` 42/60 (70%),
`system` 24/60 (40%), `trope` 24/60 (40%). `general`'s coverage-plan list
from the handoff is now substantially complete — remaining Family A slots
should mostly come from genuinely new candidates identified during further
QA passes (near-duplicate review, author feedback) rather than a known
backlog, since the original itemized coverage-plan bullets for Family A
are now all represented by at least one record.

**Still notably behind their 60-record targets:** `system` and `trope`,
both at 40%. Per the handoff's alternating-family instruction, the next
batch should return to one of these rather than continuing Family A a
third consecutive time, even though Family A has momentum.

**Next-session priorities, updated:**

1. Family C (`system`, target 60, currently 24) — currency/market/
   inflation depth, quest-reward design; otherwise consider genuinely new
   ground (e.g., environmental power, hybrid resources beyond the
   archetype survey's brief mention, specific class archetypes as
   comparison records) since the coverage-plan list is largely addressed
   at survey depth already.
2. Family B (`trope`, target 60, currently 24) — horror/mystery/sf/
   serial-fiction-specific conventions, deliberate inversions/combinations
   as standalone records, the deliberately delicate fatigue-sensitive
   trope cluster (open question #1 in `qa/unresolved-claims.md`).
3. `comparison` (currently 4) — universal vs. class-bound access, pools
   vs. thresholds.
4. `profile` — complete at 12/12; revisit only if the author identifies a
   genuinely new subgenre.

At 106/180 (59%), the corpus is well past the halfway point with all three
core families in reasonable proportional balance (70/40/40).

## After Batch 11 (Family C system mechanics, second pass)

Total: **118 records** (42 `general`, 34 `system`, 6 `comparison`, 24
`trope`, 12 `profile`).

| document_type | count |
|---|---|
| pattern | 47 |
| system-mechanic | 27 |
| comparison | 8 |
| trope | 24 |
| subgenre-profile | 12 |

| detectability | count |
|---|---|
| model-assisted | 98 |
| practice | 19 |
| deterministic | 1 |

**Added:** universal vs. class-bound access, pools vs. thresholds, health/
focus as core resources, environmental/hybrid power, body/soul
cultivation, alchemy/pill refinement, sects/inheritance/deviation,
specialization/respec, currencies/markets/inflation, enchanting/item
crafting, institutions/labor/governance, medicine/religion/crime.

**Family progress by proportion of target:** `general` 42/60 (70%),
`system` 34/60 (57%), `trope` 24/60 (40%). `system`'s original coverage-
plan list is now thoroughly covered at both survey and depth level;
further system batches should look for genuinely new candidates (author
feedback, QA-driven gaps) rather than a known backlog, similar to
`general`'s status after Batch 10.

**`trope` is now clearly the family furthest behind** at 40% versus 57–70%
for the others. Per the handoff's alternating-family instruction, the next
batch should prioritize Family B.

**Next-session priorities, updated:**

1. Family B (`trope`, target 60, currently 24) — horror/mystery/sf/
   serial-fiction-specific conventions, deliberate inversions/combinations
   as standalone records, the deliberately delicate fatigue-sensitive
   trope cluster (open question #1 in `qa/unresolved-claims.md`).
2. Family A (`general`, target 60, currently 42) — coverage-plan list
   substantially complete; further records should come from genuinely new
   candidates.
3. Family C (`system`, target 60, currently 34) — coverage-plan list
   substantially complete; further records should come from genuinely new
   candidates.
4. `comparison` (currently 6) — both Batch-9-flagged candidates now done;
   no further candidates currently queued.
5. `profile` — complete at 12/12.

At 118/180 (66%), the corpus is roughly two-thirds complete. `trope` is
now the clearest priority for the next batch to keep all three core
families within reasonable proportional balance.

## After Batch 12 (Family B trope cluster, second pass)

Total: **130 records** (42 `general`, 34 `system`, 6 `comparison`, 36
`trope`, 12 `profile`).

| document_type | count |
|---|---|
| pattern | 47 |
| system-mechanic | 27 |
| comparison | 8 |
| trope | 36 |
| subgenre-profile | 12 |

| detectability | count |
|---|---|
| model-assisted | 109 |
| practice | 20 |
| deterministic | 1 |

**Added:** companion, ensemble-cast dynamics, the outsider and belonging,
portal/other-world structure, horror/mystery/fantasy/science-fiction/
serial-fiction/progression-fiction genre conventions, inversions and
combinations, the overused-LitRPG-trope fatigue cluster.

**Family progress by proportion of target:** `general` 42/60 (70%),
`system` 34/60 (57%), `trope` 36/60 (60%). All three core families are now
within 13 percentage points of each other, the tightest balance achieved
in this production run.

**Family B's original coverage-plan list is now substantially complete**:
all itemized bullets from the handoff's Family B section (protagonist/
antagonist roles through fatigue-sensitive conventions) have at least one
representative record. Further trope records should come from genuinely
new candidates rather than a known backlog, matching Family A's and
Family C's status.

**Next-session priorities, updated:**

1. All three core families have their original coverage-plan checklists
   substantially addressed. The next batches should shift from "fill the
   known list" to "find genuinely new candidates" — via a fresh read of
   the whole catalog for gaps, author feedback (once available), or
   comparison-style records that split out a design choice currently only
   addressed as a variant within a larger record.
2. `comparison` (currently 6) — no specific new candidates currently
   queued; a dedicated pass reviewing existing pattern/system-mechanic
   records for comparison-shaped content worth splitting out would be a
   reasonable next source.
3. Continue toward the 180 target with roughly even batches across
   `general`, `system`, and `trope` to preserve the current proportional
   balance, rather than any one family running ahead again.
4. A full-catalog near-duplicate and cross-link audit (comparing all 130
   records against each other, not just each batch against its immediate
   neighbors) is now due — `qa/duplication-report.md`'s batch-by-batch
   spot checks have been thorough but a holistic pass across the complete
   corpus has not yet been done.

At 130/180 (72%), roughly three-quarters of the coverage target is
complete, with balanced progress across all three core families.

## Whole-corpus audit pass A (after Batch 12, no new records)

Not a batch. This is the holistic near-duplicate and cross-link audit the
Batch 12 notes flagged as due, run on 2026-09-05 with new draft tooling
(`qa/audit_corpus.py`). Record counts are unchanged at **130** (42
`general`, 34 `system`, 6 `comparison`, 36 `trope`, 12 `profile`). Full
findings live in `qa/duplication-report.md`; confidence-mark corrections in
`qa/citation-audit.md`.

**No merges or splits resulted.** Every one of the 60 closest record pairs
in the corpus was checked by hand and found genuinely distinct — the
batch-by-batch duplication discipline held.

**What the audit did find** is a structural weakness the per-batch QA could
not see: `related` is a backward-pointing tree rather than a web. Each
record carries a fixed quota of about two links, chosen from what already
existed when it was drafted, so 62 of 130 records (48%) have nothing
pointing at them and only 27 pairs are mutual. `profile` has zero
intra-family links at all. Twenty-one records also have a required-section
gap, most often the handoff's "visibility to characters and readers"
requirement for system and comparison records (14 records).

**This changes the next-batch priority.** The Batch 12 notes assumed Batch
13 would be more drafting. The audit argues for a remediation pass first —
links, sections, and five overstated `source_confidence` marks — because
every further batch drafted under the two-link quota widens the gap. The
50 records still to draft toward 180 should be written against a raised
link quota (four to six, at least one crossing families).
