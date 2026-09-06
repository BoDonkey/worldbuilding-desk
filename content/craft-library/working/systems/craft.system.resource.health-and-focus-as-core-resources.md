---
id: craft.system.resource.health-and-focus-as-core-resources
version: 1
title: Health and focus as core resources
document_type: system-mechanic
family: system
summary: >
  Health and focus function differently from other power resources — health
  is usually the resource whose depletion ends the story for a character,
  and focus governs sustained attention rather than raw output — and both
  deserve separate design treatment from mana-style spendable pools.
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
  - hit points and concentration
tags:
  - resource-model
  - combat
related:
  - craft.comparison.resource.pools-vs-thresholds
  - craft.system.combat.death-and-respawn
  - craft.system.encounter.status-effects-crowd-control-and-counters
  - craft.system.resource.cooldowns-charges-and-sacrifice
  - craft.system.resource.environmental-and-hybrid-power
  - craft.system.resource.resource-archetype-survey
source_ids:
  - src.book.adams-fundamentals-of-game-design
source_confidence: limited
---

## What it is

Health and focus are common enough as resources that they warrant separate
treatment from the broader resource-archetype survey. Health is usually the
resource whose depletion carries the story's most severe consequence —
typically death, incapacitation, or defeat — which sets it apart
structurally from spendable resources like mana: characters don't usually
choose to spend health tactically the way they spend mana, they lose it
involuntarily and try to prevent or recover from that loss. Focus (or
concentration) governs sustained attention rather than raw output — the
ability to maintain a difficult action, spell, or state of awareness over
time — and its depletion typically causes a loss of control or effect
rather than direct harm, distinguishing it from both health and
mana-style expenditure pools.

## Why readers may care

Health's involuntary-loss structure means tension around it comes from
threat and defense rather than allocation choice — a reader tracks how
close a character is to a dangerous threshold, not how they're choosing to
spend it. Focus's sustained-attention structure creates a different kind
of tension: a character maintaining focus is vulnerable to disruption, so
scenes involving focus often generate tension through interruption threats
rather than through resource scarcity per se. Treating both resources with
the same tactical-allocation logic that suits mana can flatten what makes
each one distinct.

## Common forms and variants

- **Direct health pools**, a straightforward depleting quantity reduced by
  harm and restored by rest or healing — the most common model, closely
  tied to the death-and-respawn record's stakes.
- **Layered health systems**, separating a temporary buffer (armor,
  shields) from an underlying, harder-to-restore core health value,
  creating a two-stage tension (buffer depleting, then core health at
  risk).
- **Focus as interruptible sustained action**, where maintaining an effect
  or state requires ongoing focus that can be broken by damage,
  distraction, or a specific disruption mechanic.
- **Focus as a limited-duration resource**, depleting over time regardless
  of interruption, functioning more like a stamina-adjacent pool with its
  own recovery logic.
- **Focus tied to mental or sensory capacity**, where its depletion causes
  specifically cognitive effects (confusion, tunnel vision, inability to
  track multiple threats) rather than a generic "can't act" state.

## What it can look like on the page

- A character's health loss shown as involuntary and threat-driven, with
  tension coming from the approaching danger rather than a spending
  decision.
- A sustained action or maintained effect broken by a specific disruption
  (a hit, a distraction, an environmental interruption), dramatizing
  focus's vulnerability directly.
- The inverse, as a warning sign: health spent voluntarily and tactically
  the same way a mana pool would be, without acknowledging the story or
  physical cost that would normally accompany deliberate self-harm; or a
  "focus" mechanic that behaves identically to a generic mana pool with no
  interruption vulnerability at all.

## Progression, failure behavior, and cross-mechanic interaction

Health interacts most directly with the death-and-respawn pattern, since
its zero-point typically triggers that mechanic's consequences. Focus
interacts with action economy and with status-effects/crowd-control,
since disrupting an opponent's focus is often a specific, valuable tactic
distinct from simply dealing damage. Both interact with progression: does
advancement increase maximum health or focus capacity, improve recovery
rate, or reduce vulnerability to disruption — each implies something
different about what growth buys a character in these specific resources.

## Common failure modes

- **Health spent voluntarily with no acknowledged cost**, treating it as an
  ordinary tactical resource (a "blood magic" mechanic, for instance) with
  no narrative engagement with the fact that the character is deliberately
  harming themselves.
- **Focus with no interruption vulnerability**, functioning identically to
  a generic resource pool and losing the distinct tension its
  sustained-attention framing implies.
- **Layered health systems used inconsistently**, where a stated buffer/
  core-health distinction isn't honored in how damage is actually applied
  across different scenes.

## Questions for the author

- Is health ever spent voluntarily in this system, and if so, does the
  story engage the cost of deliberate self-harm rather than treating it as
  routine resource management?
- Does a focus-based mechanic have genuine interruption vulnerability, or
  does it function as a reskinned mana pool?
- If a layered health system (buffer plus core) exists, is the distinction
  honored consistently across combat scenes?
- Does advancement change health or focus capacity, recovery, or
  vulnerability in a way that's narratively meaningful, not just numeric?

## Revision or design experiments

1. For a voluntary health-spending mechanic, add a scene engaging its cost
   directly — hesitation, physical toll, or social stigma around its use.
2. For a focus mechanic with no interruption vulnerability, introduce a
   specific disruption tactic an opponent can use against it.
3. Audit a layered health system's application across several combat
   scenes for consistency between buffer and core health depletion.

## When this advice does not apply

- Very lightweight combat systems with no tracked health or focus don't
  need this level of distinction.
- A story deliberately depicting a character's casual relationship to
  self-harm as characterization (examined directly, not glossed over) may
  intentionally show health spent without visible hesitation, as long as
  that choice is itself meaningful to the story.

## Evidence and detection limits

Where a project explicitly tracks health or focus values linked to scenes,
depletion and recovery consistency is close to deterministic. Whether the
narrative engages the distinct tension each resource implies (threat-driven
for health, interruption-driven for focus) requires interpreting the prose
and remains model-assisted.

## Original micro-examples

*Health as casual currency:* A blood-magic system lets a character spend
health points identically to mana, cast after cast, with no narrated
hesitation, physical toll, or acknowledgment that they're bleeding
themselves dry.

*Focus with real vulnerability:* A ritual requiring sustained focus is
broken when an enemy lands a glancing but unexpected hit, forcing the
caster to restart from the beginning — the mechanic's vulnerability to
interruption is dramatized as a specific tactical option opponents can
pursue.

## Sources and confidence notes

The health/focus distinction from generic spendable resources draws on
established game-design literature covering resource types and their
distinct design roles ([[src.book.adams-fundamentals-of-game-design]]); no
dedicated craft-literature source specifically addressing health or focus
as narrative resources was available to this drafting pass.
`source_confidence` is set to `limited` accordingly.
