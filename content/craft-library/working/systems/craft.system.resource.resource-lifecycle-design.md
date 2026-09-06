---
id: craft.system.resource.resource-lifecycle-design
version: 1
title: Resource lifecycle design (source, storage, access, expenditure, recovery, limits)
document_type: system-mechanic
family: system
summary: >
  Any power resource — mana, stamina, qi, faith, charges — has six design
  questions worth answering deliberately (where it comes from, where it's
  held, who can reach it, what spends it, how it returns, and what caps it),
  and gaps in any one of them tend to surface as plot holes or exploits.
author_vetted: true
detectability: model-assisted
scopes:
  - manuscript
  - series
applicability:
  genres:
    - progression-fantasy
    - litrpg
    - cultivation
  subgenres: []
  exclusions: []
modifiers: []
aliases:
  - resource design checklist
tags:
  - resource-model
  - worldbuilding
  - systemic-consequences
related:
  - craft.comparison.resource.pools-vs-thresholds
  - craft.comparison.resource.qi-versus-mana
  - craft.comparison.resource.renewable-vs-finite-resources
  - craft.system.consequences.systemic-social-consequences
  - craft.system.economy.crafting-and-economy-loops
  - craft.system.resource.cooldowns-charges-and-sacrifice
  - craft.system.resource.environmental-and-hybrid-power
  - craft.system.resource.resource-archetype-survey
  - craft.trope.convention.fantasy-genre-conventions
  - craft.trope.convention.science-fiction-conventions
  - craft.trope.structure.survival
source_ids:
  - src.book.adams-fundamentals-of-game-design
  - src.book.salen-zimmerman-rules-of-play
source_confidence: high
---

## What it is

Any power resource in a progression system — mana, stamina, health, qi,
rage, faith, charges, sacrifices — has an implicit or explicit answer to six
questions: where does it come from (**source**), where is it held
(**storage**), who or what can reach it (**access**), what uses it up
(**expenditure**), how does it return (**recovery**), and what caps its
total or its rate (**limits**). Game-design literature treats these as a
standard analytic frame for any resource economy; fiction rarely needs to
state all six explicitly, but a story that has clearly thought through all
six tends to avoid the plot holes and unexamined exploits that show up when
one is left implicit.

## Why readers may care

A resource system a reader can predict is one they can use to judge tension
honestly — if they know roughly how much a character has left and how it
recovers, a scene where the character nearly runs out actually carries risk.
A resource system with unstated or inconsistent rules on any of the six axes
tends to produce moments that feel like the author didn't think it through:
a character conveniently having exactly enough, a power source that's never
explained, a recovery method that appears only when the plot needs it.

## Common forms and variants

- **Source**: internal (the character's own body/spirit), external/ambient
  (drawn from the environment or a deity), or extracted (taken from another
  being or object). Each implies different social and ecological stakes.
- **Storage**: a personal reservoir (a mana pool, a qi core/dantian), an
  external vessel (a battery, a focus item), or no storage at all (channeled
  live, with no reserve).
- **Access**: universal (anyone can learn to use it), gated (requires
  training, a bloodline, a class, a contract), or exclusive (a single
  character or small group).
- **Expenditure**: per-use costs, sustained drains, or one-time investments;
  flat costs versus costs that scale with effect size or target resistance.
- **Recovery**: passive (regenerates over time), active (requires rest,
  meditation, or a specific activity), or resource-linked (recovers by
  consuming a different resource, like food or sleep).
- **Limits**: hard caps (a maximum pool size), soft caps (diminishing
  returns past a threshold), or emergent limits (social, ecological, or
  narrative rather than mechanical).

## What it can look like on the page

- A character explicitly tracking or estimating their remaining resource
  before a costly action, making the six-axis logic legible without an
  info-dump.
- A resource cap or recovery method established early and then honored
  consistently at moments of narrative pressure, rather than bent for
  convenience.
- The inverse, as a warning sign: a character running out of a resource in
  one scene and using it freely in the next with no explained recovery.

## Common failure modes

- **Unstated recovery mechanics**, leaving readers unable to judge whether a
  depleted character is actually in danger or will conveniently recover
  off-page.
- **Access rules that shift for plot convenience** — a resource gated to a
  bloodline or class suddenly usable by someone outside it, with no
  explanation.
- **Limits that exist only when convenient**, where a stated hard cap is
  quietly ignored at a climax to let a character do something the system
  shouldn't allow.
- **A source with no examined social or ecological consequence**, especially
  for extracted or externally drawn resources — see the related systemic-
  consequences pattern.

## Progression, failure behavior, and visibility

A resource system's design should also specify what happens at its edges:
what does depletion look like (a hard stop, a penalty, a risk of harm to the
user), and is depletion visible to other characters (an ally can tell a
mage is nearly spent) or hidden (only the character themselves knows)?
Visibility to other characters changes tactics and tension; visibility to
the reader (via POV or exposition) changes suspense independently of
in-world visibility, and the two need not match.

## Exploits, edge cases, and interaction with other mechanics

Every resource design implies exploits worth considering deliberately rather
than discovering accidentally mid-draft: can the resource be stockpiled and
released all at once for an effect the system wasn't built to allow? Can
recovery be gamed (resting constantly, farming a recovery method)? Does the
resource interact with other systems — does spending it interact with health,
sanity, or a separate currency — in ways that create unintended shortcuts or
dead ends? A resource that can be extracted from unwilling sources
implies a use as a weapon or a crime, whether or not the story engages that
implication.

## Questions for the author

- If asked, could you answer all six questions (source, storage, access,
  expenditure, recovery, limits) for this system's main resource, even
  informally?
- Has this system's stated limit ever been bent for plot convenience, and
  would a reader notice?
- Is resource depletion visible to other characters in the story, and does
  that visibility get used tactically?
- What is the most exploitative use of this resource a clever character in
  this world could devise, and does the story ever acknowledge that
  possibility?

## Revision or design experiments

1. Write one sentence each for source, storage, access, expenditure,
   recovery, and limits for the manuscript's central resource; any sentence
   that's hard to write marks a design gap worth deciding on deliberately.
2. Audit scenes where the resource is depleted or recovers, and check
   whether the stated recovery method is consistently honored.
3. Consider the most exploitative use of the resource a rational actor in
   this world could devise, and decide whether the story should engage it,
   explicitly forbid it, or leave it as unaddressed background.
4. If the resource can be extracted from others, test one scene where that
   possibility is raised, even briefly, to see whether it changes the
   world's stakes.

## When this advice does not apply

- A system deliberately left mysterious as a narrative technique (the reader
  and characters alike don't understand the rules yet) can defer answering
  these questions as long as the ambiguity is legible as intentional.
- Very lightweight, thematic magic systems (GameLit, some general fantasy)
  may not need explicit answers to all six axes if the system is never
  load-bearing for plot logic.
- Short fiction may reasonably leave several axes implicit if the resource
  never becomes a plot-critical constraint.

## Evidence and detection limits

Whether a manuscript's resource rules are internally consistent across all
six axes requires tracking every scene where the resource is used, spent, or
recovered, and comparing them — a task requiring close reading and
interpretation. A coach could shortlist scenes mentioning the resource as
candidate evidence where a project explicitly tracks a mechanics resource,
but concluding consistency or inconsistency remains model-assisted.

## Original micro-examples

*Unexamined system:* A character's magic "runs on willpower" with no further
specification; in one scene, exhaustion stops them from casting, and two
chapters later they cast under equal or greater exhaustion with no
explanation for the discrepancy.

*Examined system:* A character's magic draws from a stored reserve
(storage: a bonded stone) that recovers only during specific ritual rest
(recovery: gated, not passive), with a hard cap tied to the stone's size
(limits: hard), and the story consistently shows characters checking the
stone's charge before a costly working — the system's edges are legible and
honored.

## Sources and confidence notes

The six-axis framing (source, storage, access, expenditure, recovery,
limits) draws on established game-design literature covering resource
systems, economies, and progression more broadly
([[src.book.adams-fundamentals-of-game-design]],
[[src.book.salen-zimmerman-rules-of-play]]); both are established academic/
practitioner texts in game design, and their core resource-economy
principles are well-supported, supporting a `high` confidence rating for the
framework itself, while its application to any specific manuscript's
consistency remains model-assisted.
