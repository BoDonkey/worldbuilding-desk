---
id: craft.general.voice.tense-and-narrative-person
version: 1
title: Tense and narrative person
document_type: pattern
family: general
summary: >
  First or third, past or present — two choices made once and felt on every
  page, each with real costs that are easier to weigh before drafting than
  after.
author_vetted: true
detectability: deterministic
scopes:
  - manuscript
  - series
applicability:
  genres:
    - general-fiction
  subgenres: []
  exclusions: []
modifiers: []
aliases:
  - first person versus third
  - present tense
  - grammatical person
tags:
  - voice
  - pov
  - prose
related:
  - craft.general.pov.multiple-viewpoint-management
  - craft.general.pov.psychic-distance-and-interiority
  - craft.general.voice.narrative-summary-vs-scene
  - craft.general.voice.voice-as-craft-element
  - craft.system.progression.system-as-narrator-intrusion
source_ids:
  - src.book.burroway-writing-fiction
  - src.book.card-characters-and-viewpoint
  - src.book.leguin-steering-the-craft
source_confidence: high
---

## What it is

Two grammatical choices shape every sentence of a narrative: person (first,
third, occasionally second) and tense (past, present). They are usually
settled early, often unconsciously, and are expensive to change later.

This is distinct from the POV records this library already holds. Viewpoint
is about *whose* experience the reader occupies; psychic distance is about
how close the narration sits to it. Person and tense are the grammar those
choices are delivered in — and the grammar constrains what the other two can
easily do.

## Why readers may care

The choices carry different promises. First person offers intimacy and a
voice the reader spends the book inside; it also caps what can be shown to
what the narrator knows, and implies a narrator who survived to tell it,
unless the story does something deliberate about that. Third person buys
flexibility and range at the cost of a degree of immediacy.

Tense works similarly. Present tense produces immediacy and a sense that
outcomes are not yet settled; sustained across a long work it can also
flatten, since everything arrives at the same urgency and the narration loses
the retrospective register that lets a past-tense narrator weigh events. Past
tense is the unmarked default in most prose traditions, which is itself an
advantage: readers do not notice it.

## Common forms and variants

- **First past** — the retrospective personal narrator; room for hindsight,
  irony, and a narrator who understands more now than they did then.
- **First present** — maximum immediacy, minimum retrospect; common in
  contemporary YA and in serialized fiction.
- **Third limited past** — the workhorse of most genre fiction: one
  viewpoint at a time, flexible distance.
- **Third limited present** — immediacy without the first-person voice
  commitment.
- **Third omniscient** — a narrator above the characters, with its own
  sensibility; unfashionable for a stretch and entirely viable.
- **Second person** — rare, marked, and immediately foregrounded; in
  progression fiction it also happens to be the register system interfaces
  speak in, which is worth knowing before adopting it for narration.

## What it can look like on the page

- A first-person narrator who knows how the story ends, and lets that leak —
  a resource third person does not have.
- A present-tense passage where a summary of three weeks sits awkwardly,
  because present tense resists summary.
- Tense slippage during flashbacks, which is where most drafts lose control
  of a present-tense narrative.
- Conversely: a first-person story that repeatedly needs the reader to know
  something the narrator cannot, and reaches for contrivances to deliver it.

## Common failure modes

- **The unconsidered default.** A choice made by habit and never tested,
  usually surfacing as a persistent awkwardness the author cannot locate.
- **First person with an information problem.** A plot requiring knowledge
  the narrator has no access to, patched with overheard conversations and
  convenient letters.
- **Present tense across long time-skips.** The tense that resists summary,
  asked to cover months.
- **Inconsistent slippage.** Drifting between tenses or distances without
  intent, which readers feel as unsteadiness even when they cannot name it.
- **Retrospect wasted.** A past-tense first-person narrator who never once
  uses the fact that they already know what happened.

## Questions for the author

- Why this person and this tense? If the answer is "it's what I write," is
  that working here?
- What does this story need the reader to know that the narrator cannot?
- Does the narration ever use hindsight — and if not, would past tense first
  person be earning its keep?
- How will time-skips be handled, and has that been tested at length?
- If the whole book switched, what would be gained and what would be lost?

## Revision or design experiments

1. Rewrite one scene in the other tense, and one in the other person. Ten
   minutes of this settles arguments that months of instinct do not.
2. Find the passage that has been hardest to write and check whether the
   difficulty is grammatical rather than structural.
3. For first person, list three things the reader needs to know that the
   narrator does not. That list is the cost of the choice.
4. For past-tense first person, add one sentence of retrospect and see
   whether the voice gets more interesting.

## When this advice does not apply

- Established series, where the choice is locked by the volumes already
  published and consistency outweighs any gain.
- Deliberate tense-shifting as a technique — frame narratives, mixed-mode
  works — where variation is designed rather than drifting.
- Serialized work already deep into publication, where a change would read as
  a break in the contract with returning readers.

## Evidence and detection limits

This record's `detectability` is `deterministic`, unusually for this library.
Person and tense are grammatical facts of the text: a coach can classify the
dominant person and tense of any passage with high reliability, and — more
usefully — can locate *inconsistencies*, since an isolated present-tense
paragraph inside a past-tense manuscript is detectable without interpretation.

What is not deterministic is whether the choice is right. Every combination
above has produced excellent books. The coach can report what the manuscript
is doing and flag drift; whether the intimacy of first person is worth its
information cost is the author's judgment about their own story.

## Original micro-examples

*Retrospect used:* "I thought Bel was joking. I want to be clear that
everyone thought Bel was joking, because of what happened after." — a
first-past narrator spending the one thing that tense gives them.

*Retrospect unused:* "I thought Bel was joking." — indistinguishable from
third limited, and paying first person's costs for none of its returns.

## Sources and confidence notes

Janet Burroway ([[src.book.burroway-writing-fiction]]) supplies the standard
taxonomy of person and its effects; Orson Scott Card
([[src.book.card-characters-and-viewpoint]]) supplies the treatment of first
person's information constraints and the reader-intimacy trade; Ursula K. Le
Guin ([[src.book.leguin-steering-the-craft]]) supplies the exercises and the
argument about tense and voice as things to be tested by ear rather than
chosen by rule.

`source_confidence` is `high`: three independent, established craft sources
address person and tense directly and agree on the substance, which is
unusual in this corpus and reflects that this is one of the most thoroughly
documented areas of prose craft. Two smaller claims are this pass's
extension and are marked as such here rather than attributed: the note that
present tense resists summary across long time-skips, and the observation
that second person is the register progression-fiction system interfaces
already use, which comes from this library's genre material rather than from
any craft source.
