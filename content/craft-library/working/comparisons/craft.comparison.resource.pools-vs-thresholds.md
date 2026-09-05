---
id: craft.comparison.resource.pools-vs-thresholds
version: 1
title: "Pools versus thresholds"
document_type: comparison
family: comparison
summary: >
  A resource tracked as a depleting pool (mana points spent and refilled)
  and one tracked as a binary threshold (either you qualify or you don't)
  create different tactical textures and different kinds of tension around
  the same underlying capability.
author_vetted: false
detectability: model-assisted
scopes:
  - manuscript
applicability:
  genres:
    - progression-fantasy
    - litrpg
    - cultivation
  subgenres: []
  exclusions: []
modifiers: []
aliases:
  - continuous vs. binary resource tracking
tags:
  - resource-model
  - comparison
related:
  - craft.comparison.progression.hard-numbers-versus-named-tiers
  - craft.comparison.resource.renewable-vs-finite-resources
  - craft.system.resource.environmental-and-hybrid-power
  - craft.system.resource.health-and-focus-as-core-resources
  - craft.system.resource.resource-lifecycle-design
source_ids:
  - src.book.adams-fundamentals-of-game-design
source_confidence: limited
---

## What it is

A pool tracks a resource as a continuous, depleting quantity — a mana bar
spent down and refilled, health lost and restored — where the interesting
tension is how much remains and how it's allocated across multiple
demands. A threshold tracks a resource as a binary or stepped
qualification — a character either has met a prerequisite (enough
accumulated qi to attempt a breakthrough) or hasn't, with no meaningful
in-between state — where the interesting tension is whether and when the
threshold will be crossed, not how much buffer remains above it. The same
underlying capability can be modeled either way, and the choice changes
what kind of moment-to-moment decisions a story's characters (and its
readers, tracking along) actually make.

## Why readers may care

Pool-based resources support ongoing tactical allocation — a character
managing a dwindling mana pool across a long fight makes a series of small
decisions about when to spend and when to conserve, generating sustained,
granular tension. Threshold-based resources support a different rhythm:
tension builds toward a single qualifying or disqualifying moment (will
this be enough, has this been reached) rather than accumulating through
many small allocation decisions. Neither is superior; they produce
different reading experiences, and a story that treats a threshold
resource with pool-style granular tracking (or vice versa) can create a
mismatch between how a mechanic is presented and how it actually functions
dramatically.

## Common forms and variants

- **Pure pool**, a continuously trackable quantity spent and replenished
  across many uses, the default model for most combat resources (mana,
  stamina).
- **Pure threshold**, a single qualify/don't-qualify state with no
  meaningful gradation, common in breakthrough or advancement-gate
  mechanics (has enough experience accumulated to level up).
- **Threshold-with-visible-approach**, a hybrid where the underlying state
  is binary but the character can track how close they are to the
  threshold, blending some of the granular tension of a pool with the
  binary payoff of a threshold.
- **Pool with a threshold event**, where continuous accumulation
  (a filling pool) triggers a distinct, binary event once a cap is reached
  (a resource that "overflows" into a transformation or special ability at
  full capacity) — combining both models deliberately.

## What it can look like on the page

- A character allocating a visibly tracked, depleting resource across
  multiple demands within a single scene, weighing how much to spend now
  against what might be needed later.
- A character's progress toward a qualifying threshold tracked and
  anticipated across a longer stretch of the story, with the actual
  crossing functioning as a single significant event.
- The inverse, as a warning sign: a resource introduced as a threshold
  (you either qualify or you don't) later treated as though partial
  progress toward it grants partial benefit, blurring the two models
  without acknowledgment.

## Common failure modes

- **Model confusion**, where a resource's underlying nature (pool or
  threshold) isn't consistently honored, creating reader confusion about
  what actually determines success.
- **A threshold treated with false granularity**, implying that being
  "close" to a threshold provides some benefit when the system's actual
  rule is binary, misleading the reader about the stakes of any given
  scene.
- **A pool treated as inexhaustible in practice**, undermining the
  granular tactical tension the pool model is meant to provide if it's
  never shown running low enough to matter.

## Questions for the author

- For this resource, is the underlying model a continuous pool or a
  binary threshold, and is that consistently honored across the
  manuscript?
- If it's pool-based, does the story ever show the pool running low enough
  to force a real allocation decision?
- If it's threshold-based, is the character's approach toward the
  threshold tracked in a way the reader can anticipate, or does the
  qualifying moment arrive without buildup?
- Is there a scene where the two models are blurred — partial credit
  implied for a resource that's actually binary?

## Revision or design experiments

1. Identify the manuscript's key resources and label each as pool or
   threshold; audit for consistency across the scenes where each appears.
2. For a pool resource that's never shown depleting meaningfully, add a
   scene where it runs low enough to force a real decision.
3. For a threshold resource, add tracking or anticipation of the approach
   to the threshold, if the qualifying moment currently arrives without
   buildup.

## When this advice does not apply

- Very lightweight or purely narrative-conveyed power systems don't need
  either model made explicit.
- A story deliberately keeping a resource's underlying model ambiguous, as
  a source of tension about whether a character has "enough," may use that
  ambiguity intentionally rather than needing to resolve it.

## Evidence and detection limits

Where a project explicitly tracks a resource's quantity or threshold state
linked to scenes, whether the model is honored consistently is close to
deterministic. Whether the narrative tension matches the resource's actual
underlying model requires interpreting the prose and remains model-
assisted.

## Original micro-examples

*Pool tension:* A caster tracks remaining mana across an extended siege,
weighing whether to spend the last reserve on a decisive strike or hold it
in case of a worse threat later — a genuine allocation decision under
uncertainty.

*Threshold tension:* A cultivator instead has accumulated enough qi to
attempt a breakthrough for several chapters, with the tension centered
entirely on whether and when they'll finally attempt it, not on managing a
depleting quantity moment to moment.

## Sources and confidence notes

The pool/threshold distinction draws on established game-design literature
covering resource representation
([[src.book.adams-fundamentals-of-game-design]]); no dedicated craft-
literature source specifically addressing this distinction's application
to prose fiction was available to this drafting pass. `source_confidence`
is set to `limited` accordingly.
