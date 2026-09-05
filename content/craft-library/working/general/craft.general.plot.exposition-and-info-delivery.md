---
id: craft.general.plot.exposition-and-info-delivery
version: 1
title: Exposition and information delivery
document_type: pattern
family: general
summary: >
  World, backstory, and system information land best when a character needs
  it in the moment they need it — exposition delivered ahead of its
  narrative need is one of the most common sources of reader disengagement
  in early chapters.
author_vetted: false
detectability: model-assisted
scopes:
  - scene
  - chapter
applicability:
  genres:
    - general-fiction
  subgenres: []
  exclusions: []
modifiers: []
aliases:
  - the info-dump
  - worldbuilding delivery
tags:
  - exposition
  - pacing
  - foundational
related:
  - craft.general.pov.information-control
  - craft.general.scene.entry-and-exit-points
  - craft.general.voice.narrative-summary-vs-scene
  - craft.system.onboarding.system-introduction-and-tutorialization
  - craft.system.progression.system-as-narrator-intrusion
  - craft.system.progression.visible-vs-hidden-systems
source_ids:
  - src.book.mckee-story
  - src.book.gardner-art-of-fiction
source_confidence: mixed
---

## What it is

Exposition is any information the reader needs about the world, characters'
history, or a story's rules that isn't dramatized as it happens — delivered
instead through narration, dialogue, or explicit explanation. Every story
needs some exposition; the craft question is timing and method, not whether
it exists. Information generally lands best when a character (and by
extension the reader) needs it to understand or act on the immediate scene,
rather than delivered in advance "just in case" the reader needs it later.

## Why readers may care

Exposition delivered before it's needed asks a reader to hold information in
memory with no immediate use for it, which is both harder to retain and less
engaging than information that answers a question the reader is already
asking. Exposition delivered exactly when needed does double duty: it
informs and it maintains momentum, because the reader receives the answer to
a question the scene itself just raised.

## Common forms and variants

- **Dramatized exposition**, conveyed through action, consequence, or
  behavior rather than direct statement — a character's habit reveals
  backstory without narration naming it.
- **Dialogue-delivered exposition**, conveyed through characters discussing
  what they'd plausibly discuss, distinct from characters explaining things
  to each other purely for the reader's benefit.
- **Direct narrative exposition**, stated plainly by the narrator or POV
  character's own thoughts — legitimate and often efficient when kept brief
  and well-timed.
- **Front-loaded exposition**, delivered in a concentrated block before the
  story's action begins, common in opening chapters and system explanations.
- **Trickle exposition**, spread thinly across many scenes, revealed as each
  piece becomes relevant — generally the more reliable default, though it
  requires more structural planning than a single upfront block.

## What it can look like on the page

- Information delivered in the same scene, or shortly before, the moment a
  character needs to act on it.
- Dialogue where characters share information neither would plausibly need
  to state to each other, existing only to inform the reader (sometimes
  called "as you know" dialogue).
- The inverse, as a warning sign: a lengthy block of world or backstory
  information delivered before any scene has raised a question that
  information answers.

## Common failure modes

- **Front-loaded info-dumps**, especially common in opening chapters and
  system-heavy fiction, delivering worldbuilding before the reader has any
  reason to want it.
- **"As you know" dialogue**, where characters state information they'd
  already both know, purely to inform the reader.
- **Exposition halting momentum at the wrong moment**, particularly costly
  when it interrupts an action or tension sequence to explain something the
  reader could receive later without losing anything.
- **Withholding needed information too long**, the inverse failure, leaving
  a reader confused rather than intrigued because information they actually
  need to follow the scene never arrives.

## Questions for the author

- Is there a block of exposition in the opening chapters that could be
  delayed until a scene actually raises the question it answers?
- Does any dialogue exist mainly to inform the reader, rather than because
  the characters would plausibly say it to each other?
- Is there a point where exposition interrupts momentum at a costly moment,
  and could it be moved to a lower-tension point instead?
- Is there information the reader needs to follow a scene that's currently
  missing, leaving confusion rather than productive mystery?

## Revision or design experiments

1. Find the manuscript's largest block of exposition and identify the
   specific scene where the information it contains first becomes
   necessary; try moving the exposition closer to that point.
2. Audit dialogue for "as you know" exchanges and either cut them or give
   the characters a real reason to be having that specific conversation.
3. For a tension sequence interrupted by exposition, try moving the
   explanatory material to a lower-stakes moment before or after.
4. If a scene reads as confusing rather than intriguing, check whether a
   small, targeted piece of exposition (not a full block) would resolve the
   confusion without dumping unnecessary information.

## When this advice does not apply

- Some genres and traditions (epic fantasy prologues, certain LitRPG system
  explanations) have readers who expect and enjoy front-loaded worldbuilding
  as part of the genre's pleasure; this isn't a universal failure, but it's
  worth being a deliberate choice rather than a default.
- A story deliberately creating disorientation as an effect (dropping
  readers into an unfamiliar system apocalypse opening with no
  explanation) may withhold exposition intentionally past the point of
  ordinary comfort.
- Reference or glossary-style supplementary material (appendices, in-world
  documents) exists outside the main narrative's pacing concerns and can
  carry more front-loaded information without the same cost.

## Evidence and detection limits

Whether a passage delivers information before, at, or after the point a
reader needs it requires reading and interpreting the manuscript's scene-by-
scene structure — a judgment no structured data substitutes for. A coach
could flag unusually long expository passages by length alone, but whether
timing serves or hinders the story remains model-assisted.

## Original micro-examples

*Front-loaded info-dump:* Chapter one opens with three pages explaining a
kingdom's history, succession laws, and regional geography before any
character has appeared or any scene has begun.

*Trickle exposition:* The same information instead surfaces across several
early scenes — the succession law mentioned only when a character's claim to
the throne is challenged, the geography described only as a journey
requires crossing it — each piece landing exactly when a scene has already
made the reader want to know it.

## Sources and confidence notes

The information-delivery-and-timing principle draws on Robert McKee's
writing on exposition as a component of story craft
([[src.book.mckee-story]]) and John Gardner's writing on maintaining the
"vivid, continuous dream" ([[src.book.gardner-art-of-fiction]]); both
established, widely taught texts. `source_confidence` is `mixed` because the
specific variant taxonomy (dramatized/dialogue/direct/front-loaded/trickle)
here is this drafting pass's synthesis rather than a direct claim from
either source.
