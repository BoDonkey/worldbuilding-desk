---
id: craft.system.resource.cooldowns-charges-and-sacrifice
version: 1
title: Cooldowns, charges, and sacrifice as expenditure models
document_type: system-mechanic
family: system
summary: >
  Time-gated cooldowns, countable charges, and costly sacrifices are three
  distinct ways to limit how often a character can do something powerful,
  each implying a different rhythm and a different kind of tension.
author_vetted: true
detectability: model-assisted
scopes:
  - scene
  - manuscript
applicability:
  genres:
    - progression-fantasy
    - litrpg
  subgenres: []
  exclusions: []
modifiers: []
aliases:
  - ability limitation models
tags:
  - resource-model
  - combat
related:
  - craft.comparison.resource.renewable-vs-finite-resources
  - craft.system.advancement.experience-sources-and-milestone-growth
  - craft.system.binding.oaths-contracts-and-bindings
  - craft.system.encounter.range-positioning-damage-and-defenses
  - craft.system.resource.health-and-focus-as-core-resources
  - craft.system.resource.resource-lifecycle-design
source_ids:
  - src.book.adams-fundamentals-of-game-design
  - src.book.costikyan-uncertainty-in-games
source_confidence: mixed
---

## What it is

Three common models limit how often a character can use a powerful ability,
each with a different underlying logic: a cooldown gates use by elapsed
time (usable again after some duration has passed, regardless of anything
else); a charge system gates use by a countable, discrete supply (usable a
fixed number of times before needing to be restocked or recovered through a
distinct process); and a sacrifice model gates use by an explicit,
non-recovering cost paid at the moment of use (health, a relationship, a
memory, a piece of the self). All three can coexist with a pool-based
resource system (mana, stamina) as an additional, independent limiting
layer.

## Why readers may care

Each model creates a distinct rhythm of tension. A cooldown creates
predictable pacing — a reader (and character) can track exactly when a
powerful option becomes available again, which supports tactical planning
across a scene or chapter. A charge system creates a countdown feeling —
tension builds as the supply visibly dwindles, with each use bringing the
character closer to being unable to use the ability at all. A sacrifice
model creates the heaviest tension of the three, since every single use
carries an explicit, often irreversible cost that has to be weighed anew
each time, rather than simply waited out or restocked.

## Common forms and variants

- **Simple time-based cooldown**, usable again after a fixed duration
  regardless of other factors — the most predictable and tactically legible
  of the three models.
- **Conditional cooldown**, where the recovery timer depends on
  circumstances (faster if the character rests, slower under specific
  conditions) rather than a flat duration.
- **Countable charges with slow recovery**, where a fixed number of uses
  recover gradually over a longer period, blending charge-scarcity with
  cooldown-style patience.
- **Charges requiring an external recovery action**, where charges refill
  only through a specific activity (crafting, ritual, purchase) rather than
  passively over time.
- **Sacrifice with an escalating cost**, where each successive use within a
  timeframe costs progressively more, discouraging repeated use without
  hard-capping it entirely.
- **One-time sacrifice**, a single, non-repeatable use paid for with
  something the character can never recover — the highest-stakes variant,
  often reserved for climactic moments.

## What it can look like on the page

- A character explicitly tracking a cooldown's remaining duration during a
  tense scene, using that knowledge to plan tactically.
- A charge count narrated as visibly dwindling across a sequence of
  encounters, with the character's tactics shifting as the supply runs low.
- A sacrifice paid explicitly and specifically at the moment of use, with
  the cost's weight given narrative space proportional to its
  significance.
- The inverse, as a warning sign: an ability described as having a
  cooldown, charge limit, or sacrifice cost that's inconsistently applied —
  available again sooner than stated, or used with no visible payment of
  its stated cost.

## Progression, failure behavior, and cross-mechanic interaction

These three models interact directly with tension design and the action-
economy pattern: a cooldown creates predictable, plannable tactical rhythm;
a charge system creates escalating desperation as the supply runs low; a
sacrifice model creates a decision point every single time, since the cost
never becomes free through repetition. They also interact with progression:
does advancement shorten cooldowns, add charges, or reduce sacrifice costs?
Each choice implies something different about what growth actually buys a
character — more frequent access to power, more total uses, or cheaper
costs for the same uses — and mixing more than one axis of improvement per
ability can blur what a given advancement actually accomplished.

## Common failure modes

- **Inconsistently applied limits**, where a stated cooldown, charge count,
  or sacrifice cost isn't honored consistently across scenes.
- **A sacrifice model with no escalating narrative weight**, where a costly
  ability is used repeatedly with the same level of narrative attention each
  time, flattening what should be an increasingly difficult decision.
- **Charges that never actually run out**, undermining the tension a
  visibly dwindling supply is meant to create.
- **Cooldowns used as an unexamined pacing crutch**, gating an ability
  purely to control story pacing with no in-world logic explaining why the
  limitation exists.

## Questions for the author

- For each significantly limited ability, which model (cooldown, charges,
  sacrifice) governs it, and is that model applied consistently?
- If a sacrifice-gated ability is used more than once, does each use carry
  proportional narrative weight, or does repetition flatten the cost?
- Does advancement change how this ability's limitation works, and if so,
  is that change narratively meaningful or purely numeric?
- Is there an in-world logic explaining why this ability is limited the way
  it is, or does the limitation exist only to control pacing?

## Revision or design experiments

1. For each significantly limited ability, name its governing model
   explicitly and audit its use across the manuscript for consistency.
2. For a repeatedly used sacrifice-gated ability, check whether later uses
   carry weight proportional to their accumulating cost, or add that weight
   if it's missing.
3. For a charge-based ability, track its remaining count explicitly across
   a tense sequence and confirm the narrative reflects the dwindling
   supply.
4. Consider whether an unexplained cooldown could be given an in-world
   justification (magical strain, a deity's patience, physical recovery
   time) rather than functioning as an unexamined pacing device.

## When this advice does not apply

- Very lightweight or narrative-only power systems may not need explicit
  limitation models at all, conveying scarcity through story logic rather
  than tracked mechanics.
- A story deliberately keeping an ability's limitation vague or mysterious
  (neither the character nor reader knows exactly when it will be available
  again) may use that ambiguity as a deliberate tension device.

## Evidence and detection limits

Where a project explicitly tracks cooldowns, charges, or sacrifice costs as
structured state linked to scenes, whether stated limits are honored is
close to deterministic. Whether the narrative weight given to a sacrifice's
repeated use is proportional, and whether a limitation model serves the
story's tension, requires interpreting the prose and remains model-assisted.

## Original micro-examples

*Inconsistent charges:* A character is established as having three charges
of a teleportation ability per day; a fourth use occurs later the same day
with no acknowledgment of the stated limit.

*Consistent, weighted sacrifice:* A character's ability to speak with the
dead costs one year of their own remaining lifespan per use, established
early; each subsequent use is narrated with visibly increasing physical
toll, and a late-story decision to use it one final time is treated as the
manuscript's most significant choice specifically because of the
accumulated cost.

## Sources and confidence notes

The three-model framing (cooldown/charges/sacrifice) draws on established
game-design literature covering ability limitation and resource design
([[src.book.adams-fundamentals-of-game-design]]) and on uncertainty and
risk as engagement mechanisms in game systems
([[src.book.costikyan-uncertainty-in-games]]); both established academic/
practitioner texts. `source_confidence` is `mixed` because this record's
application to prose narrative tension (rather than interactive game
balance) is this drafting pass's adaptation rather than a direct claim from
either source.
