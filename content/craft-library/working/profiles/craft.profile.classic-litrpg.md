---
id: craft.profile.classic-litrpg
version: 1
title: "Subgenre profile: classic LitRPG"
document_type: subgenre-profile
family: profile
summary: >
  Growth you can track numerically — stat sheets, skill trees, XP, loot
  tiers — is the reader promise; the characteristic failure is numbers with
  no worldly weight, and this profile modifies several other library
  records accordingly.
author_vetted: false
detectability: practice
scopes:
  - practice
applicability:
  genres:
    - litrpg
  subgenres:
    - classic-litrpg
  exclusions: []
modifiers: []
aliases:
  - classic litrpg coaching profile
tags:
  - subgenre-profile
  - litrpg
related:
  - craft.comparison.progression.hard-numbers-versus-named-tiers
  - craft.profile.cultivation
  - craft.profile.dark-horror-litrpg
  - craft.profile.gamelit
  - craft.profile.progression-fantasy
  - craft.system.encounter.range-positioning-damage-and-defenses
  - craft.system.progression.stat-block-density
  - craft.system.progression.system-as-narrator-intrusion
source_ids:
  - src.internal.litrpg-genre-research
  - src.litrpgtools.subgenre-guide
  - src.litrpgcritic.subgenre-explainers
source_confidence: mixed
---

## What it is

Classic LitRPG is the subgenre where explicit, visible game mechanics — stat
sheets, skill trees, experience points, loot tiers — are not just present
but central to the reading experience. Unlike progression fantasy, which
requires only that power growth drive the story, classic LitRPG specifically
requires that growth be *numeric and displayed*: the reader is meant to see
the numbers, not just infer growth from narrated consequence.

## Why readers may care

This subgenre's specific promise is legibility and optimization pleasure: a
reader can track exactly how strong a character is, compare builds, and
anticipate the tactical effect of a new stat or skill. That promise is what
makes stat-block density and presentation choices matter more here than in
almost any other subgenre — the numbers aren't decoration, they're the
point.

## Common forms and variants

Classic LitRPG ranges from lighter, more comedic treatments of game-world
logic to serious, tactically dense builds-focused fiction; it frequently
overlaps with tower climbing (floor-gated numeric progression) and system
apocalypse (numeric systems imposed on a modern setting), and the category
boundary with progression fantasy is genuinely soft — the distinguishing
question is whether growth is displayed as numbers or conveyed narratively.

## What this profile modifies in other records

- **Stat-block density and interval** applies at full strength here — this
  is the subgenre where the pattern's core complaint (reflexive full-sheet
  reveals) is most reported and most consequential.
- **Hard numbers versus named tiers** — classic LitRPG is the default case
  for the numeric-display side of that comparison; named-tier-only display
  would be an unusual choice worth the author noting deliberately.
- **System-as-narrator intrusion** applies at full strength — the formal
  system voice this pattern addresses is a structural feature of the
  subgenre, not an occasional device.
- **Meaningless numbers** (a related pattern in Family C) is a specific risk
  here precisely because numbers are so central: the subgenre's promise
  depends on numbers mattering tactically, not just appearing.

## What it can look like on the page

- Explicit stat sheets, skill trees, and level-up notifications appearing
  regularly and driving tactical decisions.
- Combat and problem-solving scenes that reference specific numeric values
  (damage totals, resistances, cooldowns) as part of how a solution is
  reached.
- The inverse, as a signal this profile doesn't fit: a manuscript that
  conveys growth entirely through narrated consequence, with no displayed
  numbers at all — better matched to the progression-fantasy or GameLit
  profile.

## Characteristic failure mode

Numbers that never affect tactics, choices, or consequences — the
formulation worth keeping is that without worldly weight, a number is just
inventory. This is the reader-side complaint that pairs most directly with
this subgenre's core promise.

## Revision or design experiments

1. Audit a chapter's displayed numbers and mark which ones affected a
   subsequent tactical decision; consider cutting or consolidating the rest.
2. If stat reveals feel reflexive, apply the reserved-for-consequence
   practice from the related stat-block-density record.
3. Test one scene where a specific numeric value (not just its narrated
   effect) is the deciding factor in a choice, to sharpen the subgenre's
   core promise.

## Questions for the author

- Does every displayed stat or skill eventually matter to a tactical
  decision, or are some purely decorative?
- Is the frequency of stat reveals proportional to narrative significance,
  or reflexive?
- If this manuscript were stripped of all displayed numbers, would readers
  still be able to follow what's happening — and if not fully, is that
  acceptable given the subgenre's numeric promise?

## When this profile does not apply

A manuscript using LitRPG-adjacent vocabulary without displaying numeric
stat information to the reader is better served by the progression-fantasy
or GameLit profiles instead; applying classic-LitRPG-specific patterns (stat-
block density in particular) to a manuscript with no displayed stat blocks
would misdiagnose a nonexistent problem.

## Original micro-examples

*Weightless number:* A character's "Perception +3" stat is announced on
leveling up and never referenced again in any scene involving noticing,
searching, or reacting to danger.

*Weighted number:* The same stat increase is followed, two chapters later,
by the character noticing a specific detail (a mismatched footprint) that a
lower Perception score would plausibly have missed, and that detail changes
the scene's outcome — the number did tactical work.

## Evidence and detection limits

Whether a manuscript displays numeric system information to the reader is
directly observable from the text. Whether that display serves the story's
promise (numbers mattering tactically) requires interpreting the
surrounding prose and remains model-assisted; this profile itself is
`practice`-scoped in the sense that subgenre classification is an author
declaration, not something a coach should infer and assert as fact.

## Sources and confidence notes

The umbrella taxonomy (GameLit/LitRPG/progression-fantasy nesting, numeric-
versus-narrative distinction) is corroborated across independent sources
([[src.litrpgtools.subgenre-guide]], used for its category skeleton only,
not its promotional author recommendations; [[src.litrpgcritic.subgenre-
explainers]]) and synthesized in `docs/research-litrpg-genre.md`
([[src.internal.litrpg-genre-research]]), which marks the "what this profile
modifies" material as its own inference from the taxonomy, not a directly
sourced claim. `source_confidence` is `mixed` accordingly.
