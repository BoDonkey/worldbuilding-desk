---
id: craft.system.economy.loot-durability-inventory-and-ownership
version: 1
title: Loot, durability, inventory, and ownership
document_type: system-mechanic
family: system
summary: >
  What a character can acquire, how long it lasts, how much they can carry,
  and who's actually entitled to keep it are four related object-economy
  questions whose answers shape a story's material stakes as much as its
  power system does.
author_vetted: false
detectability: model-assisted
scopes:
  - manuscript
applicability:
  genres:
    - progression-fantasy
    - litrpg
  subgenres: []
  exclusions: []
modifiers: []
aliases:
  - object economy
  - gear and inventory systems
tags:
  - economy
  - resource-model
  - systemic-consequences
related:
  - craft.comparison.resource.renewable-vs-finite-resources
  - craft.system.advancement.diminishing-returns-rarity-gates-and-catch-up-mechanics
  - craft.system.chance.luck-randomness-and-probability
  - craft.system.consequences.systemic-social-consequences
  - craft.system.dungeon.dungeon-structure-and-floors
  - craft.system.economy.crafting-and-economy-loops
  - craft.system.economy.currencies-markets-and-inflation
  - craft.system.economy.enchanting-and-item-crafting
  - craft.system.quest.quest-and-reward-design
  - craft.trope.setting.ruins-and-the-lost-civilization
source_ids:
  - src.book.adams-fundamentals-of-game-design
source_confidence: limited
---

## What it is

Four related design questions shape how objects function within a
progression system. Loot and rarity determine what a character can acquire
and how scarce or exceptional a given item is. Durability determines
whether items degrade, break, or last indefinitely, affecting whether
equipment is a one-time investment or an ongoing cost. Inventory and
encumbrance determine how much a character can carry and under what
constraints, shaping whether resource and equipment management is a
meaningful tactical concern or a non-issue. Ownership determines who is
actually entitled to a given item — a question with narrative weight well
beyond mechanics whenever loot is taken from defeated enemies, discovered
in contested locations, or claimed by multiple characters with competing
claims.

## Why readers may care

An item's rarity and durability shape how much narrative weight its
acquisition and loss can carry — a common, easily replaced item generates
little stakes when damaged or lost; a rare, non-durable one raises real
tension around its use and protection. Inventory constraints, when honored
consistently, create meaningful resource-management tension (what to carry,
what to leave behind); when ignored, a character's unlimited capacity to
carry anything removes a layer of tactical and narrative friction some
stories want. Ownership questions — who actually has the right to loot, an
inheritance, a discovery — frequently generate plot on their own, entirely
independent of the item's mechanical properties.

## Common forms and variants

- **Common-and-disposable items**, low-stakes, easily replaced, generating
  little narrative weight around acquisition or loss.
- **Rare-and-durable items**, high-value and long-lasting, functioning as
  significant, ongoing narrative assets once acquired.
- **Rare-and-fragile items**, combining scarcity with impermanence,
  creating the highest-stakes object category — precious and at risk of
  being lost.
- **Bounded inventory**, where carrying capacity is a real, honored
  constraint affecting what a character can bring into a given situation.
- **Unbounded or narratively invisible inventory**, common in lighter
  systems, where carrying capacity isn't tracked or dramatized at all.
- **Contested ownership**, where a valuable item's rightful claimant is
  ambiguous or disputed among multiple characters or factions, generating
  plot independent of the item's mechanical function.

## What it can look like on the page

- A rare item's acquisition, protection, or loss treated with narrative
  weight proportional to its established scarcity and value.
- Inventory constraints shown affecting a real decision — what to carry into
  a dangerous situation, what to leave behind.
- A dispute over rightful ownership of a valuable item or discovery, shown
  as a genuine point of tension between characters or factions.
- The inverse, as a warning sign: an item established as rare and precious
  handled with the same casual narrative weight as a common one, or an
  inventory constraint stated but never actually limiting any character's
  choices.

## Progression, failure behavior, and cross-mechanic interaction

These object-economy questions interact directly with the crafting-and-
economy-loops record's guidance on scarcity and market consistency, and
with the resource-lifecycle-design record's source/access/limits framework
applied to physical objects rather than abstract resources. Ownership
questions interact with the systemic-social-consequences record, since who
gets to keep looted or discovered wealth often reflects — or exposes
tensions within — a setting's legal and social structures around property
and labor.

## Common failure modes

- **Rarity stated but not honored**, where an item described as unique or
  exceedingly scarce is treated with no special narrative or mechanical
  weight once acquired.
- **Durability inconsistency**, where an item established as fragile or
  prone to breaking survives repeated punishing use with no acknowledgment.
- **Inventory constraints that don't constrain**, stated but never actually
  limiting a character's choices in a scene where the limit should matter.
- **Ownership disputes resolved too easily**, where a contested claim is
  settled with no real cost or tension, undermining the stakes the dispute
  was meant to carry.

## Questions for the author

- Is an item's stated rarity and durability honored consistently across the
  scenes where it appears?
- Does this system's inventory or carrying-capacity constraint (if any)
  ever actually limit a character's choices, or is it purely nominal?
- If ownership of a valuable item or discovery is contested, does the
  dispute carry real narrative weight and cost, or does it resolve too
  easily?

## Revision or design experiments

1. Audit a rare item's stated scarcity against its later treatment for
   consistency.
2. For a stated inventory constraint, find or add a scene where it actually
   forces a meaningful choice.
3. For a contested ownership situation, raise the stakes of its resolution
   — a real cost to whichever side doesn't prevail, or an unresolved
   tension that persists.

## When this advice does not apply

- Very lightweight systems where objects function purely as narrative
  props with no tracked mechanics don't need this level of systemic
  consistency.
- A story deliberately depicting careless or wasteful treatment of valuable
  objects as characterization (a character who doesn't value what others
  would) is using the mismatch intentionally.

## Evidence and detection limits

Where a project explicitly tracks item rarity, durability, or inventory
constraints linked to scenes, consistency checks are close to
deterministic. Whether an ownership dispute carries genuine narrative
weight, and whether stated constraints actually limit character choices,
requires interpreting the prose and remains model-assisted.

## Original micro-examples

*Unhonored rarity:* A weapon described as "the last of its kind, forged by
a lost art" is later damaged in a routine fight with no narrative weight
given to the loss, and reappears fully repaired with no explanation.

*Honored rarity, contested ownership:* The same weapon instead becomes the
subject of a dispute between two factions who both have a claim to it — one
by right of discovery, one by right of ancestry — and the resolution costs
the protagonist an alliance they can't easily replace.

## Sources and confidence notes

The object-economy framing (loot, rarity, durability, inventory) draws on
established game-design literature covering item systems and resource
constraints ([[src.book.adams-fundamentals-of-game-design]]); no dedicated
craft-literature source specifically addressing ownership disputes as a
narrative device was available to this drafting pass. `source_confidence`
is set to `limited` accordingly.
