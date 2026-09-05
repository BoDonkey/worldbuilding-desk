---
id: craft.system.combat.action-economy
version: 1
title: Action economy in encounters
document_type: system-mechanic
family: system
summary: >
  Action economy — who gets to act, how often, and in what order — is the
  hidden logic behind whether a fight scene feels tactically legible or
  arbitrary, whether or not a story ever states a number.
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
  - initiative and turn structure
tags:
  - combat
  - encounter-design
  - resource-model
related:
  - craft.general.plot.stakes
  - craft.system.combat.death-and-respawn
  - craft.system.encounter.healing-teamwork-and-information-asymmetry
  - craft.system.encounter.range-positioning-damage-and-defenses
  - craft.system.encounter.status-effects-crowd-control-and-counters
  - craft.trope.structure.trial-and-tournament
source_ids:
  - src.book.adams-fundamentals-of-game-design
  - src.book.salen-zimmerman-rules-of-play
source_confidence: mixed
---

## What it is

Action economy describes who gets to act, how often, in what order, and with
what range or positioning constraints during a conflict — the underlying
logic tabletop and video games make explicit through initiative, turns, and
action points. Prose fiction rarely states this logic as numbers, but a
fight scene still has an implicit action economy: a reader can tell, even
without a number, whether one side is meaningfully outnumbered, whether a
character's "turn" makes tactical sense, and whether the story is applying
its own implied rules consistently.

## Why readers may care

A fight whose implicit rules are inconsistent — a character taking several
actions in the time another gets one, with no explanation, or ignoring an
established range or positioning constraint when convenient — can register
as unfair or arbitrary even to a reader who couldn't name why. A fight with
a legible, consistently applied action economy lets tactical cleverness
actually read as clever, because the reader can follow the logic of why a
particular maneuver worked.

## Common forms and variants

- **Implicit/prose-native**, where the story never states turn order or
  action counts explicitly, but consistently implies who can act when
  through pacing and description.
- **Semi-explicit**, where a LitRPG or system-driven story states some
  mechanical elements (an ability's cooldown, a stated range) without a full
  formal turn structure.
- **Fully explicit**, rare in prose but present in some LitRPG, where turn
  order, action counts, or initiative are stated directly as system
  information.
- **Numbers advantage / positioning play**, where the tactical interest
  comes from managing how many opponents can act on a character at once,
  independent of any individual character's raw power.

## What it can look like on the page

- A character using terrain, positioning, or timing to ensure they only face
  one opponent's action at a time, rather than being surrounded.
- A consistent implied rhythm to exchanges — attack, response, complication —
  that a reader can track even without stated numbers.
- The inverse, as a warning sign: a character taking several unanswered
  actions in a row with no established reason (an ability, a
  speed advantage) while opponents simply wait their narrative turn.

## Progression, failure behavior, visibility, and cross-mechanic interaction

Action economy interacts directly with progression: an ability that grants
an extra action, an interrupt, or a way to act out of turn is often far more
valuable than a raw damage increase, because it changes the fundamental math
of who acts how often — worth flagging explicitly if a system grants such
abilities, since they can trivialize encounters the story hasn't accounted
for. It also interacts with stakes: a character facing multiple opponents
simultaneously is facing a harder action-economy problem than raw
individual strength comparisons would suggest, which is part of why
"surrounded" reads as dangerous even against individually weaker
opponents.

Action economy is usually invisible to characters and only semi-visible to
readers, which is precisely what makes it easy to break without anyone
noticing at the time. Characters in a fight do not perceive turn order; they
perceive being outnumbered, being too slow, or having no opening. A reader
perceives the economy indirectly, through whether a scene's outcomes feel
earned. This asymmetry cuts both ways: an author can quietly cheat the
action economy and get away with it in the moment, and readers who cannot
articulate the rule will still register its violation as a fight that felt
unearned. In systems where characters *can* see the economy — visible
turn-based interfaces, initiative displays, speed statistics — it becomes a
tactical resource characters can reason about aloud, which is a distinctly
different kind of fight scene and a different promise to the reader.

## Common failure modes

- **Unearned extra actions**, where a character acts more often than
  established rules would allow, with no in-story explanation (a granted
  ability, an opponent's choice to hold back).
- **Ignored numbers disadvantage**, where a character facing many opponents
  simultaneously fights as if facing them one at a time, with no
  acknowledgment of the tactical problem multiple simultaneous actors
  create.
- **Action-economy-breaking abilities introduced without consequence**,
  where an ability that should trivialize ordinary encounters (an extra
  action every turn, an interrupt) is granted without the story examining
  how it changes the encounters that follow.

## Questions for the author

- In this fight scene, is it clear who can act, how often, and why, even
  without stated numbers?
- If a character faces multiple opponents, does the scene acknowledge the
  tactical problem that creates, or treat it as equivalent to facing one at
  a time?
- Does any granted ability effectively give a character an extra action or a
  way to act out of turn, and if so, has the story accounted for how that
  changes future encounters?
- Would a reader tracking this fight closely be able to follow why a
  particular maneuver worked tactically?

## Revision or design experiments

1. For a fight scene that feels arbitrary, sketch an informal turn order (who
   acts, in what sequence) and check whether the prose is consistent with
   it.
2. For a character facing multiple opponents, make the numbers disadvantage
   legible on the page — through positioning, exhaustion, or explicit
   acknowledgment of being outnumbered — rather than treating it as
   equivalent to a one-on-one fight.
3. If a character gains an action-economy-breaking ability, test one future
   encounter to see whether the story needs to escalate opponent numbers or
   tactics to keep the fight meaningfully contested.
4. Read a key fight scene aloud, tracking only who acts when, to catch
   unintentional inconsistencies in implied turn structure.

## When this advice does not apply

- Stylized, non-tactical action prose (some literary or impressionistic
  fight scenes) may deliberately avoid legible action economy in favor of
  sensory or emotional impact, and applying this pattern would work against
  the intended effect.
- Very short, one-sided confrontations (an ambush, an execution) may not
  need a tracked action economy if the scene's point is the mismatch itself
  rather than tactical exchange.
- Non-combat conflict scenes (negotiation, a chase) can have an analogous
  "turn" logic but this pattern's combat-specific framing may not transfer
  directly without adaptation.

## Evidence and detection limits

Whether a fight scene's implicit action economy is internally consistent
requires tracking who acts, how often, and under what stated constraints
across the scene — a close-reading task with no deterministic substitute.
Where a project explicitly tracks mechanical combat data (initiative,
cooldowns) linked to scenes, a coach could surface that data directly, but
judging whether the prose honors it remains model-assisted.

## Original micro-examples

*Inconsistent action economy:* A character single-handedly exchanges blows
with four opponents in sequence, each waiting politely for their turn, with
no narrative reason given for why they don't simply attack together.

*Consistent action economy:* The same character deliberately backs into a
narrow corridor specifically so only one opponent can reach them at a time,
and the prose explicitly notes this as the reason the fight remains
survivable — the numbers problem is acknowledged and tactically addressed.

## Sources and confidence notes

The action-economy framing draws on established game-design literature
covering turn structure, encounter design, and resource management in
formal game systems ([[src.book.adams-fundamentals-of-game-design]],
[[src.book.salen-zimmerman-rules-of-play]]); both are established academic/
practitioner texts. `source_confidence` is `mixed` because this record's
application of a formal game-design concept to prose fiction craft (where
it is rarely made explicit) is this drafting pass's adaptation rather than a
direct claim from either source about prose narrative specifically.
