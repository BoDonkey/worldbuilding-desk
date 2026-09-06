---
id: craft.system.advancement.experience-sources-and-milestone-growth
version: 1
title: Experience sources and milestone growth
document_type: system-mechanic
family: system
summary: >
  What actually generates advancement — combat, discovery, training,
  narrative milestones — shapes what kind of story a progression system
  rewards, and a mismatch between stated sources and depicted growth
  undermines a system's credibility.
author_vetted: true
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
  - xp sources
  - advancement triggers
tags:
  - advancement
  - progression
related:
  - craft.profile.crafting-and-economy
  - craft.system.advancement.diminishing-returns-rarity-gates-and-catch-up-mechanics
  - craft.system.character.perks-feats-and-talents
  - craft.system.character.skill-acquisition-and-mastery
  - craft.system.progression.advancement-rate
  - craft.system.progression.fake-progression
  - craft.system.quest.quest-and-reward-design
  - craft.system.resource.cooldowns-charges-and-sacrifice
source_ids:
  - src.book.adams-fundamentals-of-game-design
  - src.book.koster-theory-of-fun
source_confidence: mixed
---

## What it is

Experience sources are whatever a system credits as generating advancement:
defeating enemies, discovering new information or places, completing
quests, training deliberately, surviving hardship, or reaching narrative
milestones regardless of specific actions. Milestone growth is a related but
distinct model, where advancement is tied to reaching defined story beats
(completing an arc, surviving a trial) rather than accumulating from many
small actions. What a system credits as advancement-worthy is a direct
statement about what the story values — a combat-only experience source
implies a combat-centric story; a discovery-and-training source implies
something broader.

## Why readers may care

A system's stated experience sources set an implicit contract about what
kind of actions matter in this story. When a story's actual events track
consistently with its stated sources — a character who trains hard visibly
grows, one who avoids conflict grows more slowly in combat capability but
perhaps faster in other areas — the system reads as coherent and the growth
feels earned. When growth happens inconsistently with the stated sources
(a character who's done nothing but travel gains several combat levels),
the mismatch undermines trust in the system's internal logic.

## Common forms and variants

- **Combat-only experience**, tying nearly all advancement to defeating
  enemies — common in classic LitRPG, but narrows what kinds of scenes can
  credibly produce growth.
- **Broad, activity-based experience**, crediting combat, discovery,
  crafting, social success, and other activities individually, supporting a
  wider range of scene types as growth-worthy.
- **Training-based advancement**, requiring deliberate, dramatized practice
  rather than passive accumulation — supports montage and mentor-relationship
  scenes directly.
- **Milestone-only growth**, advancing only at defined story beats
  regardless of specific actions taken along the way, which can simplify a
  system considerably but removes fine-grained legibility about what
  specifically caused a jump.
- **Hybrid systems**, combining incremental activity-based growth with
  occasional milestone bonuses for major story beats.

## What it can look like on the page

- A character's advancement following visibly from the specific activities
  the system credits — training scenes preceding a skill increase, combat
  preceding a combat-related level.
- A milestone-triggered advancement dramatized as tied to completing a
  specific, significant story beat, rather than arriving arbitrarily.
- The inverse, as a warning sign: advancement occurring with no discernible
  connection to any activity the system has established as a credited
  source.

## Common failure modes

- **Advancement disconnected from stated sources**, where growth happens
  without any narrated activity the system credits, undermining the
  system's internal logic.
- **A combat-only system applied to a story that spends significant time on
  non-combat activity**, leaving long stretches with no legible
  advancement mechanism at all.
- **Milestone growth used to paper over pacing problems**, advancing a
  character conveniently whenever the plot needs a boost, rather than at
  consistent, meaningful story beats.

## Exploits, edge cases, and interaction with other mechanics

Any rule about what earns advancement is also a rule about what a clever
character would farm, and a setting is more convincing when someone in it
has noticed. If killing grants experience, someone is breeding or
stockpiling things to kill; if discovery grants it, someone is
manufacturing novelty; if quests grant it, someone is issuing trivial
quests for a cut. The story does not have to dwell on this, but a world
where the obvious exploit has apparently occurred to nobody reads as a game
nobody else is playing.

Milestone growth avoids most farming problems and acquires a different edge
case: because it advances characters on story beats, it can hand a character
power they did not visibly earn, which is the same effect the fake-
progression pattern describes. It also interacts with any experience-
sharing rule — parties, mentors, contribution splits — where the question of
who gets credit is a social problem long before it is a mechanical one, and
usually a better source of conflict.

## Questions for the author

- What does this system credit as generating advancement, and does the
  story's actual depicted growth track consistently with those sources?
- If a character spends significant time on activities the system doesn't
  credit, does their advancement stall accordingly, or does growth continue
  unexplained?
- For milestone-based growth, are the milestones meaningful story beats, or
  do they function as an arbitrary excuse to advance the character when
  convenient?

## Revision or design experiments

1. List the system's stated experience sources and audit a chapter range
   for whether depicted advancement traces back to one of them.
2. For a stretch of non-credited activity (travel, social scenes) that
   still shows advancement, either explain the growth or adjust the pacing
   of when advancement is shown.
3. For milestone-based growth, check that each milestone is a genuinely
   significant story beat, not a convenient excuse to advance the plot.

## When this advice does not apply

- Very lightweight or narrative-only progression systems may not need
  explicit, trackable experience sources at all.
- A story deliberately depicting an opaque or unfair system (advancement
  that doesn't track any legible source, as a dark/horror LitRPG feature)
  is using the inconsistency as a deliberate unsettling device rather than
  an unexamined gap.

## Evidence and detection limits

Where a project explicitly tracks experience gains linked to specific
scenes or activities, whether advancement follows the stated sources is
close to deterministic. Whether the narrative adequately dramatizes the
credited activity requires interpreting the prose and remains
model-assisted.

## Original micro-examples

*Disconnected advancement:* A character spends five chapters traveling with
no combat, training, or notable discovery, and gains two full levels with
no explanation connecting the growth to any activity the system has
established as a source.

*Connected advancement:* The same travel stretch instead includes deliberate
training sessions with a companion, explicitly credited by the system as a
training-based experience source, and the resulting level gain traces
directly to those dramatized sessions.

## Sources and confidence notes

The experience-source and milestone-growth framing draws on established
game-design literature covering progression triggers and mastery curves
([[src.book.adams-fundamentals-of-game-design]],
[[src.book.koster-theory-of-fun]]); both established academic/practitioner
texts. `source_confidence` is `mixed` because this record's application to
narrative credibility (rather than game balance) is this drafting pass's
adaptation rather than a direct claim from either source.
