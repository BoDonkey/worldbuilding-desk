---
id: craft.system.progression.visible-vs-hidden-systems
version: 1
title: Visible versus hidden systems
document_type: comparison
family: system
summary: >
  A system can be shown openly to characters and readers (a stat screen
  everyone can see), or kept partly or fully hidden — the choice shapes
  dramatic irony, character agency, and how much the prose can lean on
  system text versus narration.
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
  - system transparency
tags:
  - system-presentation
  - comparison
  - pov
related:
  - craft.comparison.progression.hard-numbers-versus-named-tiers
  - craft.general.plot.exposition-and-info-delivery
  - craft.general.pov.information-control
  - craft.general.pov.psychic-distance-and-interiority
  - craft.system.progression.stat-block-density
  - craft.system.progression.system-as-narrator-intrusion
source_ids:
  - src.internal.litrpg-genre-research
  - src.internal.litrpg-craft-failures-research
source_confidence: mixed
---

## What it is

A progression system's visibility describes who can see it and how
completely: fully visible to the character and the reader (a literal HUD or
status screen the protagonist can call up at will), visible to the reader
but not fully to the character (dramatic irony about the character's own
growth), visible to the character but withheld from the reader for a time
(a mystery about what the system actually is), or hidden from both until a
plot event reveals it. This is a design choice independent of whether the
system uses numbers or named tiers (see the related comparison record) —
visibility is about who can see it at all, not how it's formatted once seen.

## Why readers may care

A fully visible system lets the reader track stakes precisely and plan along
with the character, which is much of classic LitRPG's appeal. A hidden or
partially hidden system creates a different pleasure: mystery, discovery,
and the reader piecing together rules alongside or ahead of the character.
Neither is more sophisticated than the other; they're different contracts
about how much the reader is meant to know and when.

## Common forms and variants

- **Fully transparent** — a status screen or system interface available to
  the character on demand, and shown directly to the reader in-text.
- **Character-visible, reader-partial** — the character has full access, but
  the narration filters or summarizes it rather than reproducing full
  screens, common in non-LitRPG progression fantasy.
- **Reader-visible, character-blind** — the reader is shown mechanical
  information (via an omniscient or multi-POV structure) that the POV
  character doesn't have access to, creating dramatic irony about their own
  situation.
- **Mutual mystery** — neither character nor reader knows the system's full
  rules at first, and both discover them together, common in system
  apocalypse openings and portal fantasy.
- **Selectively hidden** — a system visible for some mechanics (combat
  stats) and hidden for others (a special or forbidden ability whose exact
  rules stay unclear even to the character who has it).

## What it can look like on the page

- Explicit system-text blocks reproduced in the narration, addressed
  directly to the character.
- Narration that conveys system information indirectly, through the
  character's sensation or inference, without reproducing formal system
  text.
- A scene where the reader is given information (via a different POV or
  narrative aside) that the current POV character doesn't have.
- The inverse, as a warning sign: inconsistent visibility, where a system
  that has been fully transparent suddenly withholds information from the
  character with no in-world explanation.

## Progression, failure behavior, and cross-mechanic interaction

Visibility interacts directly with tension: a hidden system raises stakes
through uncertainty (the character doesn't know their own limits, which can
create genuine risk), while a visible system raises stakes through
legibility (the reader can calculate exactly how close to failure a
character is). Visibility can also change over the course of a story — a
system that starts opaque and becomes legible as the character gains
understanding is itself a progression arc, distinct from the character's
power growth.

## Common failure modes

- **Inconsistent visibility rules**, where the system is transparent when
  convenient for exposition and opaque when convenient for suspense, without
  a consistent underlying logic.
- **A fully transparent system used purely as an info-dump delivery
  mechanism**, reproducing lengthy system text with little narrative
  integration (closely related to the mechanical info-dump pattern).
- **A hidden system that never clarifies**, leaving the reader unable to
  track stakes at all for so long that tension collapses into confusion
  rather than mystery.

## Questions for the author

- Is the system's visibility to the character and to the reader consistent
  throughout, or does it shift without an in-world reason?
- Does a hidden or partially hidden system create productive mystery, or
  does it leave the reader unable to track what's actually at stake?
- Is a fully visible system's information delivered in a way that's
  integrated into the narrative, or does it read as inserted interface text?
- If reader and character visibility diverge, is the resulting dramatic
  irony being used deliberately?

## Revision or design experiments

1. Chart, scene by scene, whether the system is visible to the character,
   the reader, both, or neither, and look for unexplained inconsistencies.
2. For a fully transparent system that reads as an info-dump, try converting
   one system-text block into narrated sensation or inference instead.
3. For a hidden system that's left readers confused rather than intrigued,
   consider a partial reveal to restore legibility without fully resolving
   the mystery.
4. Try withholding one piece of system information from the reader that the
   character already knows, to test whether the resulting dramatic
   structure serves a scene better than full transparency would.

## When this advice does not apply

- GameLit and non-numeric progression fantasy may have no formal "system" to
  make visible or hidden at all, sidestepping this comparison.
- A story alternating between full transparency and mystery as a structural
  device (visibility itself changing as a plot beat, like a system going
  dark during a crisis) is using inconsistency deliberately, not failing to
  maintain a consistent rule.

## Evidence and detection limits

Whether a passage presents system information to the character, the reader,
both, or neither is often directly observable from the text. Whether the
resulting visibility pattern serves the story's intended tension or mystery
is an interpretive judgment requiring a coach to read the surrounding
narrative context, not something the presence or absence of system text
alone can answer.

## Original micro-examples

*Fully transparent:* "[Skill Gained: Ember Lash, Rank 1]" appears directly in
the text, visible to both Kest and the reader in identical form.

*Character-blind, reader-visible:* A separate POV chapter reveals that
Kest's mentor has been quietly suppressing her true level from her own
status screen; Kest continues to believe she's weaker than she actually is,
and the reader knows before she does.

## Sources and confidence notes

The visibility taxonomy and its connection to genre convention (system
apocalypse's mutual-mystery openings, classic LitRPG's full transparency)
draws on `docs/research-litrpg-genre.md`
([[src.internal.litrpg-genre-research]]) and the system-presentation
patterns in `docs/research-litrpg-craft-failures.md`
([[src.internal.litrpg-craft-failures-research]]); both mark their genre-
convention material as partly inferential. `source_confidence` is `mixed`
accordingly.
