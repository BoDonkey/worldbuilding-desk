---
id: craft.system.progression.fake-progression
version: 1
title: Fake progression (relative position never moves)
document_type: pattern
family: system
summary: >
  A protagonist can climb an absolute power scale while their standing
  relative to the world around them never actually changes — readers respond
  to the relative gap, not the raw numbers.
author_vetted: false
detectability: model-assisted
scopes:
  - manuscript
applicability:
  genres:
    - progression-fantasy
    - litrpg
    - cultivation
  subgenres: []
  exclusions: []
modifiers:
  - subgenre: dungeon-core
    note: >
      Relative position works differently for an immobile protagonist whose
      "peers" may be invading adventurers rather than a social cohort; apply
      the underlying question (has the gap between capability and demand
      stayed alive?) rather than the literal peer-comparison framing.
aliases:
  - the treadmill problem
  - relative power stagnation
tags:
  - progression
  - stakes
  - dashboard
related:
  - craft.general.plot.negative-space-problems-power-cannot-solve
  - craft.profile.dark-horror-litrpg
  - craft.profile.progression-fantasy
  - craft.system.advancement.experience-sources-and-milestone-growth
  - craft.system.chance.luck-randomness-and-probability
  - craft.system.progression.advancement-rate
  - craft.system.progression.decorative-chapter-test
  - craft.system.quest.quest-and-reward-design
source_ids:
  - src.internal.litrpg-craft-failures-research
  - src.tam.meaningful-progression
source_confidence: mixed
---

## What it is

Fake progression is what readers describe when a character's absolute power
keeps rising on paper while their position relative to the world's challenges
never actually changes: overpowered against the surrounding cast in chapter
five, still just as overpowered — no more, no less — in chapter five hundred.
The tier numbers climbed. Only the numbers climbed; everyone and everything
around the character scaled up in step, so the *experience* of progression
never arrives even though its evidence is everywhere on the page.

## Why readers may care

The genre's core appeal is the felt sensation of getting stronger relative to
what's in front of you — outmatched, then even, then dominant, then facing a
new kind of outmatched. A story that keeps the character permanently in the
"comfortably dominant" band, just with bigger numbers attached, removes the
sensation the numbers exist to produce. Readers name this specifically as
"progression that doesn't progress," which is a description of their felt
experience of relative standing, not a complaint about the math.

## Common forms and variants

- **Peer inflation.** Every antagonist, rival, and encounter scales up in
  lockstep with the protagonist, so the gap between them is constant across
  the whole manuscript.
- **Comfort-zone plateau.** The protagonist reaches a power level early and
  the story keeps generating challenges calibrated to exactly that level
  indefinitely, rather than letting the character outgrow a tier of problem
  entirely.
- **Cosmetic tier changes.** A rank or title changes (apprentice to journeyman,
  for instance) with no accompanying change in what kinds of problems the
  character can now solve that they couldn't before.
- **The inverse, done well:** three distinct relative positions across an
  arc — excluded from an activity, competing at its edge, and having
  absorbed the old limit into routine — which is the shape fake progression
  fails to deliver (see the three-stages pattern for the fuller treatment of
  this positive form).

## What it can look like on the page

- Encounters that consistently cost the protagonist the same relative
  effort across a long span of the manuscript, regardless of stated tier
  changes.
- A rank-up or level-up that changes no subsequent scene's difficulty,
  tactics, or stakes.
- Antagonists introduced late in the book who are narrated as comparably
  threatening to antagonists from early in the book, despite the stated power
  gap.
- A character who never gets to revisit an old challenge and find it trivial
  — the "absorbed into routine" beat that signals real relative growth is
  simply absent.

## Common failure modes

- **Mistaking bigger numbers for real progression**, especially in serials
  under pressure to show visible advancement every installment; escalating
  the number is easier than escalating the story's actual demands.
- **Escalating everything at once**, so relative position is preserved by
  construction — every threat is designed to be exactly hard enough,
  regardless of the character's stated tier.
- **Never letting a former ceiling become routine**, which denies the reader
  the payoff moment where visible growth is confirmed by an old problem
  becoming trivial.

## Questions for the author

- If you removed every stated number from this manuscript, would a reader
  still be able to tell the character got stronger relative to the world
  around them?
- Is there a scene where an old obstacle is revisited and now trivial? If
  not, would one be possible to add?
- Are late-book antagonists actually harder for this character specifically,
  or are they simply narrated with bigger numbers attached to a
  similarly-costly fight?
- Across the manuscript, does the protagonist ever get to feel dominant
  before the story raises the ceiling again?

## Revision or design experiments

1. Chart, at several points across the manuscript, an approximate "relative
   standing" (dominant / even / outmatched) rather than the raw tier number,
   and look for a flat line.
2. Identify one early obstacle that could plausibly be revisited later in the
   book and made explicitly trivial, to give the reader concrete proof of
   growth.
3. For a late antagonist that feels no more threatening than an early one
   despite a stated power gap, consider raising the *kind* of challenge
   (a new axis of difficulty) rather than only its magnitude.
4. Try deliberately allowing one arc where the protagonist is dominant with
   no immediate new threat, before introducing the next ceiling-raiser, to
   let the reader register the change before erasing it.

## When this advice does not apply

- A story whose explicit premise is a treadmill or trap (a cursed loop, a
  simulation designed never to let the character win) can use flat relative
  standing on purpose, provided that stagnation is itself the narrative
  problem the story engages.
- Ensemble or community-focused subgenres (base building, dungeon core) may
  not have a single protagonist whose relative peer standing is the right
  lens; apply the underlying capability-versus-demand question instead of the
  literal peer comparison.
- Early-arc chapters legitimately keep a character in a comfort zone briefly
  before the story raises stakes; a single early plateau is not the pattern.

## Evidence and detection limits

Where a project tracks explicit numeric capability and something like
encounter difficulty, deterministic code can compare the two over time and
surface a flat or widening gap as a candidate signal. Whether that flat gap
is a craft problem, a deliberate structural choice, or simply an early-arc
stretch requires reading the actual prose and cannot be concluded from
tracked numbers alone; this pattern stays model-assisted even when a
partial metric is available.

## Original micro-examples

*Fake progression:* Across ten chapters, Kest advances from tier three to
tier seven. Each chapter's fight costs the same three combat beats to win,
regardless of stated tier, and no antagonist from tier seven reads as more
dangerous than the tier-three rival from chapter one.

*Real relative movement:* Kest advances the same tiers, but the tier-three
rival reappears at the story's midpoint and is dispatched in one paragraph,
explicitly because Kest has outgrown that entire category of threat — and the
new tier-seven antagonist introduces a kind of danger (political, not
physical) that Kest's old toolkit cannot touch at all.

## Sources and confidence notes

The core formulation is Jacob Tam's ([[src.tam.meaningful-progression]]),
describing readers responding to relative position rather than raw numbers;
`docs/research-litrpg-craft-failures.md` (pattern P1) frames the partial
deterministic angle (comparing tracked capability against tracked encounter
difficulty) as available only where both are explicitly recorded. Both
sources are practitioner-level, not controlled research; the dungeon-core
modifier is this drafting pass's synthesis, extending the genre-profile
reasoning in `docs/research-litrpg-genre.md` rather than a directly sourced
claim.
