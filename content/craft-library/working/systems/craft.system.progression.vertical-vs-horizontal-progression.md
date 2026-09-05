---
id: craft.system.progression.vertical-vs-horizontal-progression
version: 1
title: "Vertical versus horizontal progression"
document_type: comparison
family: system
summary: >
  Vertical growth (numbers get bigger) and horizontal growth (options get
  more varied) solve different problems and create different failure modes
  — a system that is purely vertical tends toward power creep and cast
  obsolescence, while purely horizontal growth can struggle to convey any
  sense of increasing mastery at all.
author_vetted: false
detectability: model-assisted
scopes:
  - manuscript
  - series
applicability:
  genres:
    - progression-fantasy
    - litrpg
  subgenres: []
  exclusions: []
modifiers: []
aliases:
  - power creep vs. option breadth
tags:
  - resource-model
  - comparison
  - systemic-consequences
related:
  - craft.system.progression.advancement-rate
  - craft.comparison.progression.classes-versus-skill-based-growth
source_ids:
  - src.rowe.progression-fantasy
  - src.book.koster-theory-of-fun
source_confidence: mixed
---

## What it is

Vertical progression makes existing capabilities bigger — more damage, more
health, higher stats along axes the character already had. Horizontal
progression adds new kinds of capability — a new tactic, a new interaction,
a new axis of choice — without necessarily making anything the character
already had more powerful. Most systems mix both, but the balance between
them shapes very different play and reading experiences, and leaning too far
toward pure vertical growth is one of the more commonly named failure modes
in progression-fiction craft discussion.

## Why readers may care

Purely vertical growth (a single "power level" that raises everything at
once) tends to make earlier threats and earlier supporting characters
irrelevant, because the whole comparison space just shifted upward together —
nothing that mattered before matters differently now, it just matters less.
Horizontal growth keeps old capabilities relevant by adding new
considerations rather than obsoleting old ones: a new conditional ability
(a backstab that requires positioning) can make combat more interesting even
without raising any number, because it adds a tactical decision rather than
just a bigger output.

## Common forms and variants

- **Pure vertical**, a single or small number of stats scaling up
  uniformly, the failure mode most associated with cast obsolescence and
  fake progression.
- **Pure horizontal**, new tactics and options accumulating with little or
  no increase in raw power, which can struggle to convey a felt sense of
  "getting stronger" if not paired with any vertical growth at all.
- **Multi-axis vertical**, several stats advancing somewhat independently
  (strength, agility, a magic stat) rather than a single unified power
  level — vertical in nature, but with enough independence between axes to
  avoid instantly obsoleting every other consideration.
- **Blended growth**, the most common real-world pattern: numbers increase
  moderately while new options and tactics accumulate at a comparable or
  faster rate, keeping both a felt sense of increasing strength and an
  expanding tactical space.

## What it can look like on the page

- A character solving an increasingly difficult sequence of encounters using
  the same handful of tactics, just executed with bigger numbers.
- A character solving encounters using an expanding toolkit, where new
  situations call for genuinely different approaches rather than a scaled-up
  version of the old one.
- Supporting characters from earlier in the story becoming unable to
  meaningfully contribute to later conflicts, with no narrative
  acknowledgment of why (a symptom of unmanaged pure-vertical growth,
  closely related to the side-cast-obsolescence pattern).

## Progression, failure behavior, and cross-mechanic interaction

Pure vertical growth interacts badly with multi-character casts, since a
uniform power increase for the protagonist widens the gap with every
character who isn't advancing at the same rate — this is the mechanical root
of the side-cast-obsolescence complaint. It also interacts with tension: once
a character's vertical growth outpaces the threats the story can plausibly
offer, either threats must escalate implausibly fast, or every remaining
conflict starts to feel trivial (see the related fake-progression pattern).
Horizontal growth interacts more gently with cast balance, since a character
gaining new options doesn't necessarily make everyone else's contributions
obsolete, but can create its own failure mode if the options accumulate
without ever mattering (an ability the character never actually needs to
use).

## Common failure modes

- **Cast obsolescence from unmanaged vertical growth**, where supporting
  characters become mechanically and narratively irrelevant as the
  protagonist's raw numbers outpace theirs.
- **Numbers with no worldly weight**, where vertical growth accumulates
  without any of it mattering tactically (see the related meaningless-
  numbers pattern).
- **Horizontal bloat**, accumulating options and abilities that never get
  meaningfully used, cluttering the system without deepening play or
  narrative.
- **Escalation that only raises the ceiling**, where each new tier's answer
  to "what's different now" is simply "bigger numbers," rather than a new
  kind of problem or capability.

## Questions for the author

- Is this system's growth mostly about existing stats getting bigger, or
  about new kinds of choices becoming available?
- If a supporting character hasn't advanced at the protagonist's pace, does
  the story address why they still matter, or does their obsolescence go
  unacknowledged?
- When the protagonist gains a new tier or level, does the story introduce a
  new kind of problem, or only a bigger version of the old one?
- Are there horizontal options in this system (skills, abilities) that have
  never actually been used meaningfully in the story?

## Revision or design experiments

1. For a supporting character who hasn't kept pace with the protagonist,
   decide explicitly whether their obsolescence is acknowledged in the
   story or needs a mitigation (a specialized niche, an item, a moment where
   their older skills matter in a way raw power doesn't).
2. For a new tier or level gain, try replacing a "bigger number" with a new
   tactical option or complication instead, and see whether the resulting
   scene reads as more interesting.
3. Audit the system's accumulated horizontal options and find at least one
   scene where an underused ability becomes the actual solution to a
   problem.
4. If vertical growth threatens to outpace plausible threats, consider
   introducing a new axis of difficulty (political, moral, informational)
   rather than only scaling raw numbers further.

## When this advice does not apply

- Base-building and ensemble subgenres, where the "cast" is the point of the
  power system rather than a liability, may be less exposed to cast-
  obsolescence concerns from vertical growth of a single protagonist.
- Very short or single-arc stories may not have enough runway for cast
  obsolescence to become visible, even with purely vertical growth.
- A story deliberately depicting the corrosive effects of unchecked vertical
  power as its subject may use pure vertical growth on purpose, with
  obsolescence as an examined theme rather than an unexamined side effect.

## Evidence and detection limits

Where a project tracks multiple characters' stats explicitly, whether
growth is moving together (vertical, uniform) or independently (multi-axis
or horizontal) is a computable co-movement metric. Whether the resulting
pattern has made a specific character narratively redundant, or whether new
options are being meaningfully used, requires reading and interpreting the
manuscript and remains model-assisted.

## Original micro-examples

*Pure vertical, unmanaged:* A protagonist's single "power level" stat
triples over the story's middle third; a previously significant ally, whose
own power level barely moves, stops appearing in combat scenes with no
narrative acknowledgment of why.

*Blended growth:* The same protagonist's raw stats grow moderately, while
a new positioning-based tactic gained mid-story becomes the specific answer
to a late encounter that raw power alone couldn't solve — and the ally,
though mechanically weaker, contributes a piece of information only their
specialized (non-combat) skill could have found.

## Sources and confidence notes

The vertical/horizontal distinction and the cast-obsolescence connection to
unmanaged vertical growth draws directly on Andrew Rowe's progression-
fantasy craft writing ([[src.rowe.progression-fantasy]]), a practitioner
essay; the broader framing of mastery and option-space growth in game
systems draws on established game-design literature
([[src.book.koster-theory-of-fun]]). `source_confidence` is `mixed` because
the specific taxonomy (pure vertical / pure horizontal / multi-axis /
blended) presented here is this drafting pass's synthesis rather than a
direct claim from either source.
