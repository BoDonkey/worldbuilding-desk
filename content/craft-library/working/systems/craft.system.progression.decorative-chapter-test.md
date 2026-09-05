---
id: craft.system.progression.decorative-chapter-test
version: 1
title: The decorative chapter test
document_type: pattern
family: system
summary: >
  A diagnostic question for progression-driven chapters — did the chapter add
  a new capability, a new demand on the character, or only one of the two?
author_vetted: false
detectability: model-assisted
scopes:
  - chapter
applicability:
  genres:
    - progression-fantasy
    - litrpg
    - cultivation
    - tower-climbing
  subgenres:
    - tower-climbing
    - cultivation
  exclusions: []
modifiers:
  - subgenre: tower-climbing
    note: >
      Consider applying the test per floor rather than strictly per chapter;
      a floor is often the natural capability/demand unit in this subgenre.
  - subgenre: time-loop
    note: >
      Apply per loop rather than per chapter; a single loop is the unit that
      carries new capability and new demand in this structure.
aliases:
  - the capability-and-demand test
tags:
  - progression
  - pacing
  - stakes
  - chapter-architecture
related:
  - craft.general.plot.negative-space-problems-power-cannot-solve
  - craft.general.promise.promise-consistency
  - craft.general.scene.entry-and-exit-points
  - craft.general.scene.scene-turns
  - craft.general.scene.sequel-and-reflection
  - craft.profile.tower-climbing
  - craft.system.progression.advancement-rate
  - craft.system.progression.fake-progression
source_ids:
  - src.internal.litrpg-craft-failures-research
  - src.tam.meaningful-progression
source_confidence: mixed
---

## What it is

At the end of a chapter, two questions are worth asking side by side: what can
the protagonist now do that they could not do at the start, and what does the
world now ask of them that it did not ask before? A chapter that answers only
the first question — capability grew, but nothing new presses on the
character — is functioning as decoration. The numbers moved; the story did
not.

This is a chapter-level test, not a scene-level one, and it is specific to
progression-driven fiction, where capability change is tracked explicitly
enough that a reader (and possibly a coach) can notice when it happens without
a matching rise in what the story demands.

## Why readers may care

Progression fiction sells a promise of forward motion. A reader who feels the
tier climb but not the stakes climb experiences the same sensation prose
readers describe as "nothing happened this chapter," except here it happens
inside chapters that are visibly full of events — fights won, loot gained,
levels announced. The chapter reads as busy and feels empty at the same time,
which is a harder problem to name than plain slowness, and one authors can
miss because activity is present.

## Common forms and variants

- **Pure capability chapters.** A level-up, a new skill, a stronger weapon —
  with the next scene functioning exactly as the last one did, just with
  bigger numbers.
- **Pure demand chapters.** A new threat, obligation, or complication
  introduced with no accompanying growth — valid and common, especially early
  in an arc, but a chapter type distinct from the failure this pattern names.
- **The compounding chapter.** Capability and demand rise together: a new
  ability is gained and immediately required by a harder problem than the
  character has faced. This is the target shape, not a rule that every
  chapter must hit it — see "when this advice does not apply" below.
- **The delayed-demand chapter.** Capability is granted now and the matching
  demand arrives two or three chapters later. This can work as a deliberate
  set-up, provided the eventual payoff actually lands (see
  [[craft.general.plot.negative-space-problems-power-cannot-solve]] for the
  related question of what capability never gets used against).

## What it can look like on the page

- A skill or stat increase followed by a scene in which the previous
  difficulty ceiling still applies unchanged.
- A new tier or rank announced, with the subsequent conflict resolved as
  easily, or with the same tactics, as the one before the increase.
- Conversely: a threat escalates, and the protagonist's toolkit is
  unchanged from three chapters earlier, forcing an unearned reach or a
  convenient rescue.
- A training or grinding montage that ends with a number changing but no new
  scene, obligation, or choice attached to the new number.

None of these signals is proof by itself — a chapter can show a stat increase
and still be doing real narrative work that isn't visible in the increase
alone. The test is a prompt for author reflection, not a lint rule.

## Common failure modes

- **Numbers substituting for stakes**, especially in serialized fiction where
  a chapter is expected to contain visible progress on a regular cadence.
- **Escalating threats with no escalating toolkit**, which produces either
  suspiciously convenient solutions or protagonist competence that reads as
  plot armor.
- **Repeating the test too literally**, treating every single chapter as a
  failure if it doesn't hit both halves — some chapters exist to develop
  relationships, build dread, or let the story breathe, and forcing capability
  or demand into all of them flattens pacing rather than improving it.

## Questions for the author

- What did this chapter's protagonist gain, and what does the story now need
  from them that it didn't need before?
- If you can answer the capability half easily but struggle with the demand
  half, is that an intentional breather chapter, or did the demand get lost?
- Where is the next chapter or scene that will actually spend the capability
  this chapter granted?
- Are there chapters in this arc where the reverse is true — demand rising
  with no matching growth — and is that gap deliberate?

## Revision or design experiments

1. List, chapter by chapter across one arc, what was gained and what was
   newly demanded. Look for chapters where one column is empty.
2. For a chapter that reads as decorative, try moving its capability gain to
   land immediately before the scene that needs it, rather than in its own
   chapter.
3. Try converting one "pure capability" chapter into a "delayed demand" setup
   by seeding, in the same chapter, the shape of the problem this new
   capability will eventually meet.
4. If several chapters in a row show capability with no demand, consider
   whether the story has entered an extended plateau and needs either a
   compressing edit or a new complication introduced earlier than planned.

## When this advice does not apply

- Rest, bonding, and worldbuilding chapters can be valuable without either
  half of this test, especially directly after a high-intensity arc.
- Subgenres with front-loaded power growth (system apocalypse, for example)
  legitimately compress this pattern into a shorter span; applying it
  chapter-by-chapter in the opening act may flag intentional structure as a
  problem.
- A slow-burn story that is deliberately withholding demand to build dramatic
  irony (the reader senses a threat the protagonist hasn't met yet) is using
  the gap on purpose.

## Evidence and detection limits

Deterministic code can report the capability half where the project tracks
explicit state changes — a stat, skill, or level change linked to a scene.
It cannot determine, from that data alone, whether the world's demands
changed in the same chapter; that requires reading what actually happens in
the prose, which is a semantic judgment. A future coach could shortlist
chapters with a tracked capability change and flag them for the author's own
review against this question, but it cannot claim to have verified the demand
half from prose alone.

## Original micro-examples

*Capability with no demand (decorative):* Wren's spellbook gains a new tier
of fire magic in chapter twelve. Chapter thirteen opens on the same bandit
patrol difficulty Wren cleared in chapter nine, resolved the same way, just
faster.

*Compounding:* Wren's spellbook gains the same tier of fire magic, and the
chapter ends with a scout reporting that the bandits have called in a
fire-resistant mercenary company specifically because word of Wren's magic
reached them. The next fight has to be won a different way.

## Sources and confidence notes

The core formulation — capability gained versus demand raised — comes from
Jacob Tam's progression-fantasy craft writing
([[src.tam.meaningful-progression]]), a practitioner essay describing this as
the single most operational diagnostic the source material identified; it is
practitioner consensus rather than an academic or quantitative finding.
`docs/research-litrpg-craft-failures.md` (Part B1, pattern P2) frames it as
the most checkable pattern in its candidate pool and notes the deterministic
half (capability, where tracked) versus the model-assisted half (demand,
always). This record adds the tower-climbing and time-loop scope modifiers
and the explicit caution against applying the test to every chapter
uniformly, which is this drafting pass's synthesis rather than a sourced
claim.
