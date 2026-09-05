---
id: craft.general.character.agency
version: 1
title: Character agency
document_type: pattern
family: general
summary: >
  A character who makes meaningful choices under real constraint reads as
  agentive; a character who is only acted upon, or whose choices don't
  actually matter to the outcome, reads as a passenger in their own story.
author_vetted: false
detectability: model-assisted
scopes:
  - scene
  - manuscript
applicability:
  genres:
    - general-fiction
  subgenres: []
  exclusions: []
modifiers:
  - subgenre: dungeon-core
    note: >
      Agency needs a variant for an immobile protagonist — decisions about
      what to build, who to trust among invaders, and how to interpret
      ambiguous threats can carry real agency without physical mobility;
      don't mistake immobility itself for a lack of choice.
tags:
  - character
  - agency
  - foundational
related:
  - craft.general.character.want-versus-need
  - craft.general.plot.stakes
source_ids:
  - src.book.cron-story-genius
  - src.book.truby-anatomy-of-story
source_confidence: mixed
---

## What it is

Agency is the degree to which a character's choices meaningfully affect what
happens to them and around them, under constraints real enough that the
choice costs something. A character can be extremely active — running,
fighting, talking constantly — while having little agency, if none of it
changes an outcome the plot has already decided; conversely, a character can
have real agency in a single, quiet, constrained decision if that decision
genuinely matters.

## Why readers may care

Readers invest in characters they believe can affect their own story.
A protagonist who is repeatedly rescued, whose plans never actually
determine outcomes, or who exists mainly to receive events rather than shape
them, tends to read as passive even in an action-heavy plot. Meaningful
agency doesn't require winning — a character can choose badly, or choose
correctly and still lose — but the choice needs to matter to what follows.

## Common forms and variants

- **Full agency**, where a character's choice under real constraint directly
  determines the scene or story's next turn.
- **Constrained agency**, where every option available to a character is
  costly, and the choice is which cost to accept rather than whether to act
  at all — often more compelling than unconstrained agency because the
  choice reveals character.
- **Delayed-consequence agency**, where a choice's effect isn't visible
  immediately but shapes a later outcome, requiring the reader to track it
  across time.
- **Structural low-agency roles**, where a supporting character's function is
  specifically to be acted upon (a hostage, a McGuffin-adjacent figure) —
  legitimate for a secondary character, a problem when it's the protagonist
  for extended stretches.

## What it can look like on the page

- A decision point where multiple real options exist, each with a genuine
  cost, and the character's specific choice shapes what follows.
- A character's plan or strategy directly producing the scene's outcome,
  rather than the outcome arriving despite or regardless of the plan.
- The inverse, as a warning sign: a rescue, coincidence, or external event
  resolving a conflict that the character's own choices had no real bearing
  on.

## Common failure modes

- **The convenient rescue**, where a character's peril is resolved by an
  outside force rather than the character's own choice or effort.
- **The false choice**, where a decision point is presented but every option
  leads to the same outcome regardless of what the character picks.
- **Constant action without consequence**, where a character does a great
  deal (fighting, moving, deciding) but none of it demonstrably shapes what
  happens next.

## Questions for the author

- In this scene, does the character's specific choice determine the
  outcome, or would the same outcome have occurred regardless of what they
  chose?
- Are the options available to the character genuinely costly, or is one
  option obviously correct with no real tradeoff?
- Is there a point in the manuscript where the character is rescued or saved
  by an outside force at a moment when their own agency could have resolved
  the situation instead?
- For a structurally low-agency character (in captivity, in a subordinate
  role), what small, real choices remain available to them, and are those
  choices shown?

## Revision or design experiments

1. For a key scene, list the character's available options and their actual
   costs; if one option is obviously correct with no tradeoff, the choice
   isn't doing much work.
2. Find a moment where an outside event rescues the character from a
   consequence of their own situation, and try having the character's own
   choice resolve it instead.
3. For a low-mobility or constrained character, identify the smallest real
   choice still available to them in a given scene and make it visible on
   the page.
4. Trace one major decision forward several scenes to confirm it actually
   changes something, not just that it was dramatized in the moment.

## When this advice does not apply

- A story deliberately about the erosion or absence of agency (a character
  trapped in a system that removes their choices, as its explicit subject)
  is examining low agency on purpose, not failing to provide it.
- Secondary and minor characters can legitimately have limited agency without
  weakening the story, provided the protagonist's agency carries the weight.
- Genuinely random or external events (a storm, an accident) can shape plot
  without undermining agency, provided the character's response to them is
  where the real choice lives.

## Evidence and detection limits

Whether a character's choice genuinely determined an outcome, versus the
outcome occurring regardless, requires interpreting causal relationships
within the prose — a judgment no structured data substitutes for. A coach
could shortlist decision points and their following outcomes as candidate
evidence, but concluding that agency was present or absent is model-assisted.

## Original micro-examples

*Low agency:* A character plans an elaborate escape, and just as the plan
begins, an unrelated explosion breaches the wall instead, letting them walk
out through the new opening. The plan never mattered.

*Real agency, constrained:* The same character, still trapped, chooses
between revealing a secret that would secure release but endanger an ally,
or staying silent and remaining imprisoned — both options costly, and the
choice they make shapes everything that follows.

## Sources and confidence notes

The agency framing draws on Lisa Cron's writing about character choice and
consequence ([[src.book.cron-story-genius]]) and John Truby's structural
writing on character and moral choice
([[src.book.truby-anatomy-of-story]]); both established texts.
`source_confidence` is `mixed` because the dungeon-core modifier and the
low-agency-role framing are this drafting pass's synthesis, extending
`docs/research-litrpg-genre.md`'s subgenre reasoning (itself marked as
inference) rather than a directly sourced claim.
