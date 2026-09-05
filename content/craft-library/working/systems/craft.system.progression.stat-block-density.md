---
id: craft.system.progression.stat-block-density
version: 1
title: Stat-block density and interval
document_type: pattern
family: system
summary: >
  How often and how completely a story shows raw system numbers changes
  whether those numbers read as significant or as clutter — density and
  interval are measurable, but their felt effect is medium- and
  reader-dependent.
author_vetted: false
detectability: model-assisted
scopes:
  - chapter
  - manuscript
applicability:
  genres:
    - litrpg
  subgenres:
    - classic-litrpg
  exclusions:
    - gamelit
    - progression-fantasy
modifiers:
  - subgenre: gamelit
    note: >
      This pattern largely does not apply — a book with no obligatory stat
      screen has no stat-block density to manage.
  - subgenre: progression-fantasy
    note: >
      Applies only if the project's power system is genuinely numeric;
      hard-tier systems without displayed numbers should not be evaluated
      against this pattern.
aliases:
  - stat sheet frequency
tags:
  - progression
  - system-presentation
  - litrpg
related:
  - craft.comparison.progression.hard-numbers-versus-named-tiers
  - craft.general.voice.narrative-summary-vs-scene
  - craft.profile.classic-litrpg
  - craft.profile.gamelit
  - craft.system.progression.system-as-narrator-intrusion
  - craft.system.progression.visible-vs-hidden-systems
source_ids:
  - src.internal.litrpg-craft-failures-research
  - src.litrpgreads.integrating-systems
  - src.litrpgreads.audiobook-tropes
source_confidence: mixed
---

## What it is

Stat-block density describes two related, countable things: how often a
manuscript shows a full or partial system readout (skill lists, attribute
sheets, level-up summaries), and how much of each readout is actually
relevant to what just happened. A story can show numbers constantly, rarely,
or selectively — and the interval and completeness of those reveals shape
whether a stat block reads as a meaningful punctuation mark or as clutter the
reader learns to skip.

## Why readers may care

Reader discussions in the LitRPG community return to this complaint more
often than almost any other mechanical one: a full stat sheet reprinted after
every minor encounter, most of it unchanged from the last printing. The
promise of visible numbers is that they mean something is happening; a
reader who has to scan past six unchanged attributes to find the one that
moved stops trusting the sheet to tell them anything, and the genre's core
appeal — legible, trackable growth — degrades into inventory the reader
tunes out.

## Common forms and variants

- **Full-sheet-every-time.** The complete character sheet reprinted at every
  level or encounter, regardless of what changed.
- **Delta-only reveals.** Only the changed values shown, with the full sheet
  reserved for occasions when the character (and reader) genuinely needs the
  whole picture.
- **Reserved-for-consequence reveals.** Stat blocks appear only at narratively
  significant moments, so their appearance itself signals "this matters,"
  distinct from routine encounters.
- **Diegetic partial reveals.** The system shows the character only what is
  currently relevant to a decision, mirroring how a game UI might
  contextually highlight one stat during a specific action.
- **No stat block at all.** A legitimate choice in progression fantasy and
  GameLit, where growth is conveyed through action and consequence rather
  than displayed numbers.

## What it can look like on the page

- A level-up scene followed by ten or more lines of unchanged attributes
  before the one that actually moved.
- Stat reveals clustering at consequential turning points rather than routine
  encounters.
- A skill list that grows every chapter versus one that is shown only when a
  new or changed skill is about to matter to the immediate scene.
- Repetition of near-identical blocks across consecutive chapters with only
  minor numeric drift.

## Common failure modes

- **Reflexive full reveals** at every advancement event, regardless of
  significance, which trains readers to skip the block entirely.
- **Numbers with no worldly weight** — a related but distinct pattern (see
  the "meaningless numbers" pattern) where even a well-paced reveal fails
  because the numbers never affect a choice or outcome.
- **Applying print conventions to audio, or vice versa.** Reader discussion
  suggests stat blocks that read as tedious on the page can work better in
  audiobook form, where a narrator can integrate or elide them; this is a
  single-source, weakly supported claim and should be treated as a lead for
  author testing rather than a rule.

## Questions for the author

- When a stat block appears, does the reader learn something they didn't
  already know, or is most of it a repeat?
- Would removing every non-changed line from this reveal make it stronger or
  would it lose needed context?
- Does the frequency of stat reveals track the frequency of things that
  actually matter in the story, or does it track a fixed narrative rhythm
  (every chapter, every fight)?
- If this manuscript is likely to be read in audio, has the stat-heavy
  passage been tested read aloud?

## Revision or design experiments

1. Audit every stat-block appearance in a chapter range and mark which lines
   changed since the last reveal; consider trimming unchanged lines from
   routine reveals.
2. Reserve one full-sheet reveal per arc for a genuinely pivotal moment, and
   convert the rest to delta-only or diegetic partial reveals.
3. Try reading a dense stat passage aloud (or having someone else read it) to
   test whether the format still works outside the page.
4. For a chapter with no consequential change, experiment with omitting the
   reveal entirely and see whether the scene loses anything.

## When this advice does not apply

- GameLit and non-numeric progression fantasy have no obligatory stat screen
  and this pattern is not meaningful for them.
- A story deliberately parodying or subverting stat-block conventions (a
  system that floods the character with irrelevant readouts as a joke or a
  horror beat) is using density on purpose.
- Early chapters establishing the system for the first time reasonably need a
  fuller reveal than later routine ones.

## Evidence and detection limits

Reveal frequency and the proportion of unchanged lines per reveal are
countable from explicit text or structured state data where a project tracks
stat changes per scene, making the raw density and delta ratio partially
deterministic. Whether a given density serves or hurts a specific manuscript,
and whether print-versus-audio format should change the recommendation,
require interpretation a coach should offer as a question, not a verdict.

## Original micro-examples

*Reflexive full reveal:* After defeating a single low-level pest, the
narrative reprints a fourteen-line sheet; thirteen lines match the previous
chapter's sheet exactly.

*Reserved reveal:* The same character defeats a mid-tier rival for the first
time, and the narrative shows only the two skills that changed, in the
context of the fight that changed them, saving the full sheet for the
volume's climactic breakthrough two chapters later.

## Sources and confidence notes

The core complaint about reflexive full-sheet reveals and the
reserved-for-consequence practice come from
[[src.litrpgreads.integrating-systems]], corroborated by the broader pattern
research in [[src.internal.litrpg-craft-failures-research]] (pattern P17),
which marks the pattern as practitioner/reader consensus rather than
controlled study. The print-versus-audio distinction rests on a single
source, [[src.litrpgreads.audiobook-tropes]], from a heavily monetized site,
and is marked weak; it is included as a lead for author testing rather than
established fact.
