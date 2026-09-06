---
id: craft.system.economy.crafting-and-economy-loops
version: 1
title: Crafting and economy loops
document_type: system-mechanic
family: system
summary: >
  Crafting, trade, and resource economies give a story a non-combat
  advancement path, but the loop only stays satisfying if scarcity, cost,
  and value stay internally consistent rather than existing only when the
  plot needs them.
author_vetted: true
detectability: model-assisted
scopes:
  - manuscript
  - series
applicability:
  genres:
    - progression-fantasy
    - litrpg
  subgenres:
    - crafting-and-economy
  exclusions: []
modifiers:
  - subgenre: crafting-and-economy
    note: >
      This is the subgenre's central mechanic rather than a supporting one;
      conflict-escalation patterns built around combat do not apply as
      written here, since advancement and conflict both typically run
      through the economic loop instead.
tags:
  - economy
  - resource-model
  - systemic-consequences
related:
  - craft.profile.crafting-and-economy
  - craft.system.consequences.systemic-social-consequences
  - craft.system.cultivation.alchemy-and-pill-refinement
  - craft.system.economy.currencies-markets-and-inflation
  - craft.system.economy.enchanting-and-item-crafting
  - craft.system.economy.loot-durability-inventory-and-ownership
  - craft.system.resource.resource-lifecycle-design
source_ids:
  - src.book.adams-fundamentals-of-game-design
  - src.internal.litrpg-genre-research
source_confidence: mixed
---

## What it is

A crafting or economy loop is a closed cycle of gathering or producing
materials, converting them (through crafting, alchemy, enchanting, or trade)
into goods of value, and either using or exchanging those goods — a
non-combat advancement path built on material tiers, quality levels, supply,
and scarcity rather than levels and damage numbers. In game-design terms,
this is a resource economy with sources (gathering, production), sinks
(consumption, decay, loss), and a market or exchange mechanism connecting
producers and consumers.

## Why readers may care

A well-built economy offers a different satisfaction than combat
progression: the pleasure of recipes, discovery, scarcity, and being
indispensable, without requiring violence to advance. That satisfaction
depends on the economy behaving consistently — prices, availability, and
value need to track a legible internal logic, or the loop stops feeling like
a system and starts feeling like set dressing that exists only when the plot
needs a specific price or shortage to happen.

## Common forms and variants

- **Gathering-to-crafting loops**, where raw materials are collected and
  converted into finished goods through a character's own skill.
- **Trade-based loops**, where value comes from moving goods between
  markets with different supply and demand, independent of the character's
  own production.
- **Service loops**, where a character's crafting skill is sold as labor
  (commissions, repairs) rather than through open-market goods.
- **Scarcity-driven loops**, where a specific rare material or component
  gates high-tier production, creating natural narrative tension around
  acquiring it.
- **Closed-loop economies** (notably central to dungeon core), where
  resources cycle within a bounded system (mana in, rooms and monsters out,
  stronger invaders, more mana) rather than connecting to an open market at
  all.

## What it can look like on the page

- Consistent, trackable material tiers and their relative scarcity, honored
  across multiple scenes rather than adjusted for convenience.
- A price or availability shift that's explicable by an established cause
  (a war disrupting trade routes, a monster infestation increasing demand
  for a specific material) rather than appearing arbitrarily.
- The inverse, as a warning sign: a material described as rare and precious
  in one scene and freely available or cheaply purchased in another with no
  explanation for the change.

## Progression, failure behavior, and cross-mechanic interaction

A crafting economy interacts with the broader power system in at least two
directions: crafted goods can substitute for or supplement a character's own
progression (a well-made weapon compensating for lower personal power), and
crafting skill itself can be an advancement axis independent of combat
stats, giving non-combat-focused characters a legitimate path to narrative
relevance. Failure in a crafting loop (a failed attempt, ruined materials,
a botched enchantment) is a design choice worth deciding deliberately: is
failure costly (consumed materials, wasted time) or nearly free, and does
that cost scale with the value of what's being attempted?

## Exploits, edge cases, and systemic consequences

An economy that doesn't cohere invites exactly the exploits a reader will
notice: infinite-money loops (converting a cheap, abundant resource into a
valuable good with no bottleneck), unexplained price stability despite
established scarcity, or supply that never runs out despite being
repeatedly described as limited. Economies also imply social and political
consequences worth at least considering: who controls scarce materials, does
that control map onto existing power structures, and does the economy
create classes of people (crafters, traders, laborers) whose stakes in the
story's conflicts differ from the protagonist's.

## Common failure modes

- **Prices and scarcity that exist only when the plot needs them**, breaking
  the sense that the economy is a real, consistent system.
- **Infinite or trivially exploitable value loops**, where a rational
  character in this world could easily break the economy in ways the story
  doesn't acknowledge.
- **An economy with no visible consequence beyond the protagonist's own
  advancement**, treating trade and scarcity as a personal resource system
  rather than a social one with other stakeholders.

## Questions for the author

- Are this world's material scarcity and prices consistent across the
  scenes where they're mentioned, or do they shift for convenience?
- Is there an obvious way a clever character in this world could exploit the
  economy for effectively unlimited value, and if so, does the story
  address that possibility?
- Does crafting failure cost something, and does that cost scale with the
  stakes of the attempt?
- Who else in this world depends on the resources or goods the protagonist's
  economic activity touches, and does the story ever show their stake in
  it?

## Revision or design experiments

1. List the manuscript's key materials or goods with their established
   scarcity and value, and check each mention against that list for
   consistency.
2. Consider the most exploitative use of the established economy a rational
   character could devise, and decide whether the story should engage,
   forbid, or leave it as background.
3. For a crafting failure that currently carries no cost, add one (lost
   materials, wasted time, a damaged reputation) and see whether the scene
   gains tension.
4. Introduce one scene showing a non-protagonist stakeholder (a laborer, a
   rival trader, a community dependent on a resource) affected by the
   protagonist's economic activity.

## When this advice does not apply

- Very lightweight economic texture (a market scene used once for color) may
  not need the full rigor of a tracked, consistent system if it's never
  load-bearing for plot logic later.
- Closed-loop economies with no external market (dungeon core) should be
  evaluated against their own internal consistency rather than compared to
  an open-market structure that doesn't apply.

## Evidence and detection limits

Where a project explicitly tracks material tiers, prices, or scarcity as
structured data, a coach could report inconsistencies across scenes
deterministically. Whether an economy's apparent inconsistencies are
narratively significant, or whether an exploit the reader might notice is
worth the author's attention, requires interpreting the manuscript's actual
stakes and remains model-assisted.

## Original micro-examples

*Inconsistent economy:* A rare ore is described as "worth more than gold,
barely seen outside royal armories" in chapter three, then purchased in bulk
at a village market with no explanation in chapter eleven.

*Consistent economy:* The same ore's sudden availability is explicitly tied
to a war-disrupted supply route reopening, mentioned in an earlier chapter —
the shift is explicable rather than arbitrary, and a trader character's
excitement (and worry about the price crash to come) shows the economic
ripple affecting someone beyond the protagonist.

## Sources and confidence notes

The resource-economy framing (sources, sinks, markets) draws on established
game-design literature covering economies and progression systems
([[src.book.adams-fundamentals-of-game-design]]); the subgenre-specific
framing (crafting/economy as a non-combat advancement path, dungeon core's
closed-loop economy) draws on `docs/research-litrpg-genre.md`'s subgenre
research ([[src.internal.litrpg-genre-research]]), which marks its
subgenre-profile material as partly the author's own inference.
`source_confidence` is `mixed` accordingly.
