---
id: craft.system.character.attributes-and-soft-hard-caps
version: 1
title: Attributes and soft versus hard caps
document_type: system-mechanic
family: system
summary: >
  Base attributes (strength, agility, and their equivalents) and whether a
  system caps their growth softly or hard sets a ceiling on how open-ended a
  story's power fantasy can be, and how that ceiling is written matters as
  much as where it sits.
author_vetted: true
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
  - stat caps
  - attribute ceilings
tags:
  - character-architecture
  - progression
related:
  - craft.general.pacing.escalation-ceilings-urgency-and-pressure
  - craft.system.advancement.diminishing-returns-rarity-gates-and-catch-up-mechanics
  - craft.system.character.perks-feats-and-talents
  - craft.system.encounter.enemy-design-and-difficulty-scaling
  - craft.system.progression.advancement-rate
  - craft.system.progression.vertical-vs-horizontal-progression
source_ids:
  - src.book.adams-fundamentals-of-game-design
  - src.book.koster-theory-of-fun
source_confidence: mixed
---

## What it is

Attributes are a character's foundational, usually numeric traits —
strength, agility, intelligence, and their setting-specific equivalents —
that other capabilities (skills, abilities, combat performance) are
typically built on top of. A soft cap is a point past which further
investment yields diminishing returns without becoming impossible; a hard
cap is an absolute ceiling that cannot be exceeded by any known means within
the story's established rules (until or unless the story explicitly breaks
it). Whether a system uses no caps, soft caps, hard caps, or a mix by
attribute is a foundational design choice with direct narrative
consequences for how "endless" the story's power fantasy can plausibly feel.

## Why readers may care

A system with no caps at all promises limitless growth, which can generate
excitement but also risks the fake-progression problem if the story can't
keep pace with ever-rising numbers. A hard cap creates a legible ceiling a
reader can use to calibrate expectations and stakes — once a character
approaches the cap, the reader knows further growth in that dimension is
implausible, redirecting anticipation toward other axes (see the related
vertical-vs-horizontal comparison). A soft cap sits between the two,
promising that growth remains possible but increasingly costly, which can
create a satisfying "grinding toward the ceiling" dynamic distinct from
either extreme.

## Common forms and variants

- **Uncapped attributes**, with no stated ceiling, implying an open-ended
  power fantasy — carries the highest risk of eventually reading as
  unbounded or arbitrary if the story doesn't manage escalation carefully.
- **Hard-capped attributes**, with an absolute, stated maximum, providing a
  clear reference point the story can build tension and stakes around
  (how close is this character to their absolute limit).
- **Soft-capped attributes**, where investment past a threshold still
  works but yields progressively less return, encouraging horizontal
  investment in other attributes or systems once a soft cap is reached.
- **Per-attribute variation**, where different attributes use different
  cap models (a hard-capped physical attribute alongside an uncapped
  magical one, for instance), which can be a deliberate way to differentiate
  what kind of growth story is being told about which capability.
- **Breakable hard caps**, where a stated absolute ceiling can be exceeded
  through a specific, narratively significant event — effective when rare
  and earned, risky when it undermines the cap's credibility if overused.

## What it can look like on the page

- A character's approach toward a stated cap treated as a meaningful
  narrative marker — increasing difficulty, increasing stakes, or a shift
  in strategy as the ceiling nears.
- Diminishing returns on continued investment shown through narrated effort
  (training harder for smaller gains) rather than only reported numbers.
- The inverse, as a warning sign: attributes that keep climbing steadily
  with no acknowledgment of any ceiling, even as the story's own logic
  implies one should exist.

## Progression, failure behavior, and cross-mechanic interaction

Caps interact directly with the vertical-versus-horizontal progression
comparison: once an attribute approaches its cap, a system without other
growth axes risks stalling the character's sense of forward motion,
while a system with rich horizontal options (skills, tactics, equipment)
can keep growth feeling alive even after a core attribute plateaus. Caps
also interact with the multi-character cast: if supporting characters
operate under the same cap structure as the protagonist, their relative
standing can remain legible even as the protagonist advances, mitigating
the side-cast-obsolescence risk discussed in the vertical/horizontal
record.

## Common failure modes

- **An implied but unstated cap**, where the story's own logic suggests a
  ceiling should exist but the manuscript never acknowledges one, leaving
  escalation feeling directionless.
- **A hard cap broken too casually**, undermining its credibility as an
  absolute limit if exceeded more than once or without sufficient narrative
  weight.
- **Soft caps with no visible diminishing returns**, where the story states
  that growth slows past a threshold but continues narrating identical-
  feeling gains regardless.

## Questions for the author

- Does this system have a stated or implied ceiling for its core
  attributes, and is that ceiling ever acknowledged in the story?
- If a hard cap exists, has it been broken, and if so, does that moment
  carry proportional narrative weight?
- As a character approaches a soft cap, does the story show diminishing
  returns through narrated effort, or only through unstated numeric
  reasoning?
- If supporting characters operate under the same cap structure, does that
  keep their relative standing legible as the protagonist advances?

## Revision or design experiments

1. Decide explicitly whether the manuscript's core attributes are capped,
   and if so, state the cap somewhere the reader can register it, even
   implicitly.
2. For a character nearing a stated cap, add a scene showing the effort-to-
   reward ratio shifting, rather than only reporting numbers.
3. If a hard cap has been or will be broken, check that the moment receives
   narrative weight proportional to breaking an established absolute rule.
4. Audit whether horizontal growth options are available once a core
   attribute nears its cap, to keep the character's sense of progress alive.

## When this advice does not apply

- Narrative-only power systems with no tracked numeric attributes don't
  need explicit cap logic.
- A story deliberately depicting a limitless, escalating power fantasy as
  its subject (with the absence of caps itself being examined) is using
  uncapped growth on purpose rather than by unexamined default.

## Evidence and detection limits

Where a project explicitly tracks attribute values over time, whether
growth follows a stated cap model is close to deterministic. Whether the
narrative gives appropriate weight to approaching or breaking a cap requires
interpreting the prose and remains model-assisted.

## Original micro-examples

*Unacknowledged ceiling:* A character's strength attribute climbs steadily
across a hundred chapters with no stated maximum, and by the story's end the
numbers have grown so large the story stops referencing them directly,
leaving the reader unsure what the numbers still mean.

*Acknowledged soft cap:* The same attribute instead is established to yield
sharply diminishing returns past a stated threshold; the character's late-
story training montages explicitly shift focus to a different attribute
once the first visibly plateaus, and a mentor character remarks on the
wisdom of that shift.

## Sources and confidence notes

The soft-cap/hard-cap framing and its connection to diminishing returns
draws on established game-design literature covering progression curves
([[src.book.adams-fundamentals-of-game-design]],
[[src.book.koster-theory-of-fun]]); both established academic/practitioner
texts. `source_confidence` is `mixed` because this record's application to
prose narrative stakes (rather than interactive game balance) is this
drafting pass's adaptation rather than a direct claim from either source.
