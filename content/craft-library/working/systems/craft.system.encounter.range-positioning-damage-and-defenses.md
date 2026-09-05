---
id: craft.system.encounter.range-positioning-damage-and-defenses
version: 1
title: Range, positioning, damage, and defenses
document_type: system-mechanic
family: system
summary: >
  Where combatants are relative to each other, what reach their options
  have, and how offense and defense interact are the spatial and
  mechanical logic underneath a legible fight scene, whether or not a story
  ever states a number.
author_vetted: false
detectability: model-assisted
scopes:
  - scene
applicability:
  genres:
    - progression-fantasy
    - litrpg
  subgenres: []
  exclusions: []
modifiers: []
aliases:
  - combat spatial logic
tags:
  - combat
  - encounter-design
related:
  - craft.profile.classic-litrpg
  - craft.system.chance.luck-randomness-and-probability
  - craft.system.combat.action-economy
  - craft.system.encounter.enemy-design-and-difficulty-scaling
  - craft.system.encounter.healing-teamwork-and-information-asymmetry
  - craft.system.encounter.status-effects-crowd-control-and-counters
  - craft.system.resource.cooldowns-charges-and-sacrifice
  - craft.system.resource.environmental-and-hybrid-power
source_ids:
  - src.book.adams-fundamentals-of-game-design
  - src.book.salen-zimmerman-rules-of-play
source_confidence: mixed
---

## What it is

Range and positioning describe where combatants are relative to each other
and to the environment, and what options that distance makes available or
forecloses — a melee fighter's options differ fundamentally from a ranged
caster's, and terrain (chokepoints, cover, elevation) changes what's
tactically viable for both. Damage and defenses describe the offense/
defense relationship: how much harm an action threatens, and what reduces,
avoids, or absorbs it. Together these form the spatial and numeric logic a
reader uses, consciously or not, to judge whether a fight's outcome makes
sense — a character winning a fight they shouldn't plausibly win, given
established range and defense logic, reads as unearned even if the prose
around it is otherwise strong.

## Why readers may care

A fight scene whose spatial logic is consistent lets a reader track why a
particular tactic worked, which is part of what makes clever combat
solutions feel clever rather than arbitrary. A story that ignores range and
positioning (a melee fighter engaging a ranged threat with no acknowledgment
of the distance problem) or applies damage and defense inconsistently
(the same attack that was lethal in chapter three does nothing in chapter
twelve, with no explained increase in defense) breaks the implicit contract
that lets a reader follow combat as more than a sequence of asserted
outcomes.

## Common forms and variants

- **Explicit range bands**, common in more mechanically detailed LitRPG,
  where melee/close/mid/long range are tracked and matter tactically.
- **Implicit, prose-native positioning**, where range and terrain are
  conveyed through narration without formal bands, still requiring internal
  consistency.
- **Damage-type and resistance interaction**, where offense and defense
  aren't simply a single number comparison but involve type matchups
  (fire versus a fire-resistant target), adding a tactical layer beyond raw
  power.
- **Absorb-versus-avoid defense models**, distinguishing defenses that
  reduce or absorb incoming harm (armor, a shield) from those that avoid it
  entirely (dodging, positioning out of range) — each implies different
  tactical logic and different failure states.
- **Terrain-dependent combat**, where the environment itself is a tactical
  resource (cover, chokepoints, elevation) independent of any character's
  raw stats.

## What it can look like on the page

- A character deliberately closing or maintaining distance as a tactical
  choice, with the resulting advantage or disadvantage narratively
  legible.
- A defense (armor, a ward, a dodge) shown to reduce or avoid a specific,
  established threat consistently across the scenes where it's relevant.
- The inverse, as a warning sign: a character effectively engaging an
  opponent at a range their established capabilities shouldn't allow, with
  no acknowledgment of the mismatch.

## Progression, failure behavior, and cross-mechanic interaction

Range and positioning interact directly with the action-economy pattern,
since being outnumbered or outranged compounds the "who acts, how often"
problem that pattern addresses. Damage and defense interact with
progression: does a character's growth increase raw damage output,
improve accuracy or avoidance, or add resistance to specific damage types —
each implies a different kind of growth and a different set of tactical
consequences (see the related vertical-versus-horizontal progression
comparison for how these choices interact with cast balance).

## Common failure modes

- **Ignored range mismatches**, where a character effectively fights at a
  range their established kit shouldn't support, with no tactical
  explanation.
- **Inconsistent damage-defense math**, where an established threat level
  is lethal in one scene and trivial in another with no explained change in
  either combatant's capabilities.
- **Terrain that's mentioned but doesn't matter**, describing cover or
  elevation without it affecting the fight's actual tactical logic.

## Questions for the author

- Does this fight scene's spatial logic (who's at what range, what terrain
  is available) stay consistent, and does it affect tactical outcomes?
- Is there a mismatch between an established threat's damage output and a
  character's defenses that the scene doesn't acknowledge?
- Does terrain mentioned in a fight scene actually affect anyone's tactical
  options, or is it purely decorative?

## Revision or design experiments

1. Sketch an informal map of a key fight scene's positioning and check
   whether the prose is consistent with it.
2. For an inconsistent damage-defense outcome, either explain the change
   (an item, an injury, a tactical shift) or revise the outcome to match
   established capabilities.
3. Test whether cutting a mentioned terrain feature changes anything about
   the scene; if not, either give it tactical relevance or cut the mention.

## When this advice does not apply

- Stylized or impressionistic combat prose may deliberately avoid tracked
  spatial logic in favor of sensory or emotional impact, where this
  pattern's concerns would work against the intended effect.
- Very brief, one-sided combat (an execution, an ambush) may not need the
  full range/positioning treatment this pattern describes.

## Evidence and detection limits

Whether a fight scene's spatial and damage/defense logic is internally
consistent requires tracking positioning, range, and outcomes across the
scene — a close-reading task with no deterministic substitute. Where a
project explicitly tracks combat-relevant stats linked to scenes, a coach
could surface that data directly, but judging whether the prose honors it
remains model-assisted.

## Original micro-examples

*Ignored range mismatch:* A character established as a short-range melee
specialist effectively fights off a group of archers at a distance with no
acknowledgment of the range disadvantage.

*Honored spatial logic:* The same character instead is shown closing the
distance rapidly under cover fire from an ally, taking visible risk to
reach melee range where their actual advantage applies — the range problem
is acknowledged and tactically addressed.

## Sources and confidence notes

The range/positioning/damage/defense framing draws on established game-
design literature covering combat systems and spatial tactics
([[src.book.adams-fundamentals-of-game-design]],
[[src.book.salen-zimmerman-rules-of-play]]); both established academic/
practitioner texts. `source_confidence` is `mixed` because this record's
application to prose fiction (where these mechanics are rarely made
explicit) is this drafting pass's adaptation rather than a direct claim
from either source.
