---
id: craft.trope.convention.fantasy-genre-conventions
version: 1
title: Fantasy genre conventions
document_type: trope
family: trope
summary: >
  Fantasy readers bring specific expectations about internal consistency
  and earned wonder that differ from other genres' promises — a fantasy
  world's magic doesn't need to follow real-world rules, but it does need
  to follow its own rules once it's established them.
author_vetted: false
detectability: model-assisted
scopes:
  - manuscript
applicability:
  genres:
    - general-fiction
    - progression-fantasy
  subgenres: []
  exclusions: []
modifiers: []
aliases:
  - epic fantasy conventions
tags:
  - genre-convention
  - trope
related:
  - craft.system.resource.resource-lifecycle-design
  - craft.system.consequences.systemic-social-consequences
source_ids:
  - src.internal.litrpg-genre-research
source_confidence: limited
---

## What it is

Fantasy as a genre convention promises a world that operates by different
rules than the reader's own, with wonder and strangeness as part of the
core appeal — but readers of fantasy specifically also expect internal
consistency: a world's magic, creatures, and cosmology don't need to
follow real-world physics or history, but once the story establishes its
own rules, readers hold it to them with a rigor genres without an explicit
magic system often don't face. This is closely related to, but broader
than, this library's resource-lifecycle-design and systemic-social-
consequences patterns, which address the mechanical and social
implications of a magic system specifically; this record addresses
fantasy's broader genre contract, including elements (mythology, secondary-
world geography, non-human cultures) that aren't strictly mechanical.

## Why readers may care

Fantasy's appeal often depends on a world feeling large and coherent
enough to sustain genuine wonder — the sense that there's more to this
world than what's on the page, and that what is on the page holds
together. A worldbuilding inconsistency (a stated rule violated with no
explanation, a culture that behaves inconsistently with its established
values, a geography that doesn't hold together) can break immersion more
sharply in fantasy than in genres where the reader isn't tracking an
internally consistent secondary world in the same way.

## Common forms and variants

- **High or epic fantasy**, set in a fully secondary world with its own
  history, geography, and cosmology, typically expecting the most
  sustained internal consistency.
- **Low fantasy**, set in a world close to the reader's own with limited
  magical elements, where consistency expectations may be narrower
  (focused tightly on the magic system) but still real.
- **Mythic or fairy-tale-adjacent fantasy**, drawing on established
  folklore logic (rule of three, symbolic causality) rather than a fully
  systematized magic system, with its own, looser consistency
  expectations rooted in mythic rather than mechanical logic.
- **Portal or contemporary fantasy**, blending a real-world setting with
  fantastical elements, requiring consistency both within the fantastical
  logic and in how it interacts with the established real-world rules.

## What it can look like on the page

- A stated worldbuilding rule (a magic limit, a cultural taboo, a
  geographic fact) honored consistently across the manuscript, even at
  moments when it would be convenient to bend it.
- A non-human culture or society whose behavior and values remain
  internally consistent even as the story explores their differences from
  human norms.
- The inverse, as a warning sign: an established magical limit, cultural
  rule, or geographic fact quietly violated later in the story with no
  acknowledgment.

## Common failure modes

- **Rules bent for plot convenience**, violating an established magical or
  worldbuilding limit with no explanation, undermining the internal
  consistency fantasy readers specifically track.
- **Inconsistent non-human cultures**, where a culture's established values
  or behaviors shift depending on what a given scene needs rather than
  remaining coherent.
- **Geography or history that doesn't hold together**, where travel times,
  historical dates, or spatial relationships contradict earlier
  established facts.

## Questions for the author

- Has a stated magical, cultural, or geographic rule been violated
  anywhere in this manuscript with no explanation?
- Does a non-human culture behave consistently with its established values
  across every scene it appears in?
- Do this world's geography and history hold together across the whole
  manuscript, or are there contradictions a careful reader might notice?

## Revision or design experiments

1. List the manuscript's key established worldbuilding rules (magical
   limits, cultural taboos, geographic facts) and audit later chapters for
   consistency.
2. For a non-human culture, write a short list of their core values and
   check their depicted behavior against it across the manuscript.
3. Build or check a rough timeline and map for the manuscript's key events
   and locations to catch geography or history inconsistencies.

## When this advice does not apply

- Mythic or fairy-tale-adjacent fantasy operating on symbolic rather than
  mechanical logic may reasonably have looser, more associative
  consistency expectations than a fully systematized secondary world.
- A story deliberately depicting an unreliable or unstable world (where
  inconsistency is itself a plot element, such as a setting under active
  magical corruption) is using apparent inconsistency intentionally,
  provided that's legible as a choice.

## When straightforward execution is the right choice

A classical secondary-world fantasy with clearly established, consistently
honored rules remains a satisfying and reliable structure — its
familiarity doesn't require subversion, and consistency itself is often
the primary craft achievement readers are responding to when they describe
a fantasy world as feeling "real."

## Evidence and detection limits

Whether a manuscript's established worldbuilding rules are honored
consistently requires tracking those rules across the manuscript's full
length — a close-reading task with no full deterministic substitute,
though where a project explicitly tracks canon facts as structured data,
some consistency checks could be partially automated.

## Original micro-examples

*Broken consistency:* A magic system establishes that resurrection is
impossible in this world; a beloved character is resurrected two hundred
pages later with no explanation for the violated rule.

*Honored consistency:* The same rule instead holds firm even at the
story's most emotionally costly moment, and the story's resolution
explicitly depends on characters finding a different way to address their
loss — the established limit does real narrative work by staying
established.

## Sources and confidence notes

The internal-consistency-as-genre-contract framing draws on
`docs/research-litrpg-genre.md`'s general survey of fantasy conventions
([[src.internal.litrpg-genre-research]]), which marks its subgenre material
as partly inferential; no dedicated fantasy-craft literature source was
available to this drafting pass. `source_confidence` is set to `limited`
accordingly.
