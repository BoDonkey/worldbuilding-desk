---
id: craft.profile.time-loop
version: 1
title: "Subgenre profile: time loop"
document_type: subgenre-profile
family: profile
summary: >
  Iteration and optimization define this subgenre's reader promise; several
  standard progression patterns need explicit rescoping (per-loop rather
  than per-chapter, or set aside entirely) rather than applied by default.
author_vetted: false
detectability: practice
scopes:
  - practice
applicability:
  genres:
    - progression-fantasy
    - litrpg
  subgenres:
    - time-loop
  exclusions: []
modifiers: []
aliases:
  - time loop coaching profile
tags:
  - subgenre-profile
  - time-loop
related:
  - craft.profile.base-building
  - craft.profile.progression-fantasy
  - craft.profile.system-apocalypse
  - craft.system.progression.advancement-rate
  - craft.trope.structure.time-loop
source_ids:
  - src.internal.litrpg-genre-research
  - src.internal.litrpg-craft-failures-research
source_confidence: limited
---

## What it is

The time-loop subgenre profile describes how loop-based structure changes
the *scope and applicability* of other library records, complementing
`craft.trope.structure.time-loop`, which describes the loop mechanic itself.
Structural signature: knowledge retention across resets, hidden mechanics
revealed gradually as loops accumulate, and loop conditions that escalate or
shift rather than staying static.

## Why readers may care

The promise is iteration and optimization: the pleasure of watching a
"perfect run" assembled from the accumulated knowledge of prior failures.
This is a fundamentally different pacing and progression logic from linear
subgenres, which is why several patterns written for linear manuscripts need
explicit rescoping rather than direct application here — applying them
without adjustment risks flagging the subgenre's own defining structure as a
craft failure.

## Common forms and variants

See `craft.trope.structure.time-loop` for the mechanic's own variant
taxonomy (full/partial knowledge retention, externally imposed versus
self-chosen loops, shared loops, escalating conditions). This profile
focuses specifically on how those variants interact with the broader
pattern library rather than restating that taxonomy.

## What this profile modifies in other records

- **Abandoned progression methods** (referenced pattern pool concept, P12)
  does not apply — methods reset by design in a time loop, so checking
  whether a rapid-advancement method was narratively abandoned would fire
  constantly and wrongly; a method's disappearance between loops is the
  premise working as intended, not an unexplained gap.
- **The decorative chapter test** should be scoped per-loop rather than
  per-chapter: what does this loop ask that the last one did not is the
  more meaningful question than a strict chapter-by-chapter application.
- **Advancement rate** needs a fundamentally different unit of analysis:
  don't skip to the end (the standard caution against compressed
  advancement) needs restating here, since compressed re-advancement across
  each loop is the subgenre's form rather than a flaw — a character
  reaching the same capability level in loop nine in a fraction of the pages
  it took in loop one is the point, not a pacing problem.
- **Fake progression** still applies conceptually, but its evidence changes:
  relative standing should be measured against how efficiently the
  protagonist reaches a known capability ceiling, not against a rising
  absolute tier.

## What it can look like on the page

- A later loop visibly reaching a capability or understanding level faster
  than an earlier loop did, using knowledge the earlier loop lacked.
- A rapid-advancement method used in one loop simply absent, without
  explanation, in the next — consistent with the premise rather than an
  unaddressed plot hole.
- The inverse, as a warning sign: loops that take the same narrative time
  and space to reach the same point, with no visible compression despite
  accumulated knowledge.

## Characteristic failure mode

Loops that do not compound — iteration without accumulating insight, so
resets read as repetition rather than progress, the same core failure named
in the companion trope record but specifically relevant here to how
progression-pacing patterns should be read.

## Revision or design experiments

1. Before applying the decorative-chapter-test or advancement-rate patterns
   to a time-loop manuscript, explicitly rescope them per-loop rather than
   per-chapter or per-manuscript-position.
2. Check that a rapid-advancement method's disappearance between loops is
   consistent with the reset premise, rather than flagging it as an
   unexplained abandonment.
3. Chart how much narrative space each successive loop spends reaching a
   comparable capability point; look for compression as loops accumulate.

## Questions for the author

- Does each successive loop reach its comparable point measurably faster or
  more efficiently than the loop before it?
- Are progression-pacing patterns being applied per-loop, or accidentally
  applied across the whole manuscript as if it were linear?
- Is there a loop where accumulated knowledge should have compressed the
  narrative but didn't, and is that gap intentional?

## When this profile does not apply

A manuscript with a single, brief time-loop device embedded in an otherwise
linear story (a single-chapter loop used once, not a structural
throughline) doesn't need this profile's full rescoping — apply the
underlying patterns normally outside the loop's brief span.

## Evidence and detection limits

Whether a manuscript is structured around a sustained time-loop mechanic is
directly observable from its structure. Whether successive loops actually
compound in efficiency or insight requires interpreting the manuscript
across multiple loop iterations and remains model-assisted; where loop
count and per-loop outcomes are explicitly tracked as structured data,
compression could be partially reported deterministically.

## Original micro-examples

*Non-compounding pacing, misapplied pattern:* A coach flags a time-loop
manuscript's rapid loop-nine advancement as "skipping to the end" using the
standard advancement-rate caution, without accounting for the fact that
loop nine's protagonist already knows everything loop one's protagonist
had to discover from scratch.

*Correctly rescoped:* The same manuscript is instead evaluated by comparing
loop nine's pacing only to other loops, where the compression reads as the
subgenre's central pleasure — visible proof that accumulated knowledge is
paying off — rather than a violation of general advancement-rate guidance.

## Sources and confidence notes

This subgenre's structural signature and its specific pattern-rescoping
needs (P12 non-application, P2 per-loop scoping, P10 restatement) draw on
`docs/research-litrpg-genre.md`
([[src.internal.litrpg-genre-research]]) and
`docs/research-litrpg-craft-failures.md`
([[src.internal.litrpg-craft-failures-research]]); both mark this
connective material as the author's own inference rather than independently
sourced claims. `source_confidence` is set to `limited` accordingly.
