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
