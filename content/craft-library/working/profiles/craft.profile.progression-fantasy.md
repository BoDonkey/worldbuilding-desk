---
id: craft.profile.progression-fantasy
version: 1
title: "Subgenre profile: progression fantasy"
document_type: subgenre-profile
family: profile
summary: >
  An earned journey from nothing to something, where power growth need not
  be numeric — the defining failure is fake progression, and stat-block-era
  patterns may not apply at all.
author_vetted: false
detectability: practice
scopes:
  - practice
applicability:
  genres:
    - progression-fantasy
  subgenres:
    - progression-fantasy
  exclusions: []
modifiers: []
aliases:
  - progression fantasy coaching profile
tags:
  - subgenre-profile
  - progression-fantasy
related:
  - craft.comparison.progression.hard-numbers-versus-named-tiers
  - craft.profile.classic-litrpg
  - craft.profile.crafting-and-economy
  - craft.profile.cultivation
  - craft.profile.dungeon-core
  - craft.profile.gamelit
  - craft.profile.isekai-portal-fantasy
  - craft.profile.time-loop
  - craft.profile.tower-climbing
  - craft.system.progression.advancement-rate
  - craft.system.progression.fake-progression
source_ids:
  - src.internal.litrpg-genre-research
  - src.rowe.progression-fantasy
source_confidence: mixed
---

## What it is

Progression fantasy requires that power growth be the engine of the story,
but — unlike classic LitRPG — does not require that growth be numeric.
Structural signatures include hard tiers, training arcs, tournaments, and
mentors; the formulation worth keeping is that all LitRPG is broadly
progression fantasy, but not all progression fantasy is LitRPG.

## Why readers may care

The subgenre's promise is a journey where the grind has weight and
breakthroughs are paid for — readers arguing about this subgenre most often
argue about whether a given book's progression felt earned, which is why its
defining complaint (fake progression) is also its name-defining concern.

## Common forms and variants

Progression fantasy ranges from hard-numeric systems functionally
indistinguishable from LitRPG to entirely narrative power-tier systems with
no displayed numbers at all; it overlaps heavily with cultivation (a
frequent but not required numeric-free tier structure) and with tower
climbing and system apocalypse as adjacent, more specifically structured
variants.

## What this profile modifies in other records

- **Fake progression** applies at full strength — this is the pattern most
  associated with this subgenre specifically, per genre research.
- **Stat-block density** and **system-as-narrator intrusion** may not
  apply — a numeric-free progression-fantasy system has no stat blocks to be
  dense and no system voice to intrude. Applying these patterns without
  first confirming the manuscript actually displays numbers risks
  diagnosing a nonexistent problem.
- **Advancement rate** applies, but its "widening interval" shape (matching
  cultivation's convention) is common here too, even outside cultivation
  specifically.
- **The decorative chapter test** and **the three stages of relative
  strength** (referenced pattern pool, not yet drafted as a separate record)
  are especially central diagnostic tools for this subgenre.

## What it can look like on the page

- Training arcs, tournaments, and mentor relationships structuring the
  narrative's escalation.
- Power tiers described qualitatively and consistently, even without
  numbers, in a way a reader can track and anticipate.
- The inverse, as a signal this profile doesn't fit: a manuscript with fully
  displayed numeric stat sheets driving every tactical decision — likely
  better matched to the classic-LitRPG profile instead, or both profiles
  combined.

## Characteristic failure mode

Fake progression — the tier climbs, but the protagonist's relative position
against the world around them never actually changes, so the numbers (or
their qualitative equivalent) move without the story's felt stakes moving
with them.

## Revision or design experiments

1. Chart the protagonist's relative standing (dominant/even/outmatched) at
   several points across the manuscript, independent of any stated tier, and
   look for a flat line.
2. If the system is numeric-free, confirm that stat-block-density-style
   patterns genuinely don't apply before flagging them in a coaching pass.
3. Test whether an early obstacle could be revisited and shown as
   trivial later, to give the reader concrete proof of earned growth.

## Questions for the author

- Is this system's progression numeric, narrative, or a mix — and does the
  manuscript's actual pattern of coaching concerns match that choice?
- Has the protagonist's relative standing against the wider world visibly
  changed across the manuscript, not just their stated tier?
- Do training arcs and mentor relationships carry real narrative weight, or
  do they function as brief montage before the plot resumes?

## When this profile does not apply

A manuscript with fully numeric, prominently displayed mechanics is better
served treating the classic-LitRPG profile as primary, with this profile as
a secondary modifier if power growth also functions as the central engine.

## Evidence and detection limits

Whether a manuscript's system is numeric or narrative is directly observable
from the text. Whether progression is genuinely "fake" (flat relative
standing despite stated growth) requires interpreting the manuscript's
causal and comparative structure and remains model-assisted.

## Original micro-examples

*Fake progression despite qualitative tiers:* A protagonist advances from
"Apprentice" to "Adept" to "Master" across a manuscript, but every
opponent at "Master" poses exactly the same relative threat "Apprentice"
opponents once did — the tier names changed, relative standing didn't.

*Earned qualitative progression:* The same tier changes are instead marked
by the protagonist casually resolving an early-book crisis that once
required their full effort, freeing the story to introduce a genuinely new
kind of threat instead.

## Sources and confidence notes

The umbrella relationship (progression fantasy overlapping but not nesting
cleanly with LitRPG) and this subgenre's structural signature draw on
`docs/research-litrpg-genre.md` ([[src.internal.litrpg-genre-research]]),
which marks its subgenre-profile material as inference; the fake-progression
framing draws on Andrew Rowe's and Jacob Tam's practitioner essays via the
craft-failure research, represented here through
[[src.rowe.progression-fantasy]]. `source_confidence` is `mixed`.
