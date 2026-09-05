# LitRPG Craft Conventions and Failure Modes

**Status:** active working input. Not an authority and not a plan — reference
material for roadmap slice 4.18 (craft library content). Archive this after
vetted claims have moved into the versioned library and the continuing content
track no longer uses it.

**First written:** 2026-08-29.
**Type:** research input (second pass). Companion to
`research-litrpg-genre.md`, which covers taxonomy and platform.
**Purpose:** the material that converts directly into 4.18 coaching patterns.
**Scope:** craft conventions per subgenre, and reader-expectation failures —
the two areas deferred from the first pass.

**How to use this.** Part B is a candidate pattern pool, not the library.
Tranche 1 picks 6–8 from it. Correct it against your own reading before
drafting; a pattern you disagree with should be cut, not softened.

Two mark systems are used.

Source confidence, as in pass one:

- **◆ Documented** — multiple independent sources, or a primary source with
  enough published evidence to verify the claim.
- **◈ Practitioner consensus** — working authors and readers say so repeatedly.
- **◇ Weak** — single or motivated source. A lead, not a finding.

Detectability, new in this pass and the thing that matters most for the
library schema:

- **[D] Deterministic** — the complete observation is computable from explicit
  manuscript/canon/state inputs with no semantic inference. A deterministic
  shortlist followed by an interpretive conclusion is still [M].
- **[M] Model-assisted** — needs interpretation, but a finding can still cite
  specific scenes.
- **[P] Practice** — not present in the prose at all. Teachable only.

---

## Summary of what changed

The first pass produced a map. This pass produced the actual content, and
three things came out of it that affect the design rather than just the
library:

1. **The [D]/[M]/[P] split is real and unavoidable.** Roughly a third of the
   strongest patterns are practice advice that no analysis of the manuscript
   can surface. 4.18's pattern schema has to carry this distinction or the
   coach will promise checks it cannot perform.
2. **Several of the best craft patterns overlap continuity evidence without
   becoming deterministic checks.** The engine can shortlist known abilities,
   methods, state, and scenes, but whether an ability would solve a narrative
   situation remains interpretation. This is still a valuable reuse seam, but
   it belongs behind author-triggered, model-assisted review.
3. **One vendor analysis points toward a longitudinal concern worth testing.**
   In its selected discussion sample, whether a series stays good appeared
   more often than pacing, prose, or character development. That supports
   testing manuscript-level coaching, but outside-reader validation—not this
   dataset—decides whether the dashboard should outweigh the inline view.

---

## Source quality ledger

**Andrew Rowe** — professional game designer and novelist, credited with
naming the progression-fantasy subgenre. His craft posts are the single
highest-quality source in either pass: primary, practitioner, and explicitly
hedged ("not everyone is going to agree on these points"). Where he is cited
below, confidence is ◈ at minimum and often ◆.

**Jacob Tam / IlorisNovel** (June 2026) — the sharpest single craft essay
found. Vendor-adjacent (the author runs a web-fiction platform) but the
argument stands alone, is unusually specific, and self-flags its limits
("almost everything I say below has been successfully contradicted by at least
one book I love"). Marked ◈ throughout; its central test is the most useful
single artifact in this document.

**Chapter Chronicles** — two data posts with stated methodology (1,147 Reddit
comments from r/LitRPG tier lists, 2024–2025; 459 Rising Stars fictions,
scraped March 2026) and stated limitations. Vendor content marketing that
concludes by recommending its own product; no raw dataset or reproducible
coding protocol is supplied. Treat the numbers as useful vendor-reported
directional evidence, marked ◇ unless independently replicated.

**Aaron Oster** — working LitRPG author, opinion post. Useful as a candid
practitioner list of overused tropes. ◈.

**LitRPG Reads** — genre blog, heavily monetized (affiliate blocks throughout,
AI-generated header art, promotional interruptions mid-article). The craft
content is serviceable and conventional but not distinctive. Used only for
corroboration, never as sole support. ◇ alone, ◈ when it agrees with Rowe or
Tam.

**Royal Road forums / Goodreads discussions** — reader and author self-report.
◈.

---

## Part A — The reader-side failure hierarchy ◇

From one vendor's 1,147-comment analysis of ten r/LitRPG tier-list
discussions. These are reported topic shares for that selected sample, not a
population estimate or a product-weighting rule:

| Concern | Share | Mentions |
|---|---|---|
| Series quality over time | 34.2% | 507 |
| Power scaling | 23.6% | 350 |
| Subjectivity / taste disputes | 16.0% | — |
| Plot and pacing | 10.1% | — |
| Character development | 8.4% | 124 |
| Audiobook narration | 7.7% | 114 |

The five decline causes that emerged, in the source's ordering: author
burnout, power-scaling problems, character stagnation, plot meander, and
platform fragmentation.

**Two candidate findings worth carrying into author review:**

Readers will forgive mediocre prose for compelling characters; the reverse is
not true ◈. This should shape the entire coaching emphasis. A coach that leads
with prose-craft notes is optimising the thing readers forgive.

Series that sustain quality **deliver consistently on their initial promise**
◈ — if book one promises cozy, it stays cozy; if it promises desperate
survival, stakes stay high. Promise-keeping is the throughline connecting the
series-longevity finding to the retention finding from pass one, where poor
chapter 1→2 retention is diagnosed as promise mismatch rather than bad prose.
**Promise consistency may be the single most valuable concept in the whole
library**, and it operates at both scales the coach has — inline (does this
scene keep the chapter's promise) and dashboard (does this book keep book
one's).

---

## Part B — Candidate pattern pool

### B1. Progression and power (the highest-value cluster)

**P1 — Fake progression.** ◈ [M]
The failure: the tier climbs but the protagonist's *relative* position never
changes. OP against peers in chapter five, OP against peers in chapter five
hundred; only the peers changed. Readers describe this as "progression that
doesn't progress," and they are responding to relative position, not to the
numbers. The test: has the gap between what the character can do and what the
story asks of them stayed alive? Partially [D] if the app can compare the
character's tracked capability against encounter difficulty over time.
*Source: Tam.*

**P2 — The decorative chapter test.** ◈ [M], partially [D]
The single most operational pattern found. At the end of this chapter: what
can the protagonist now do that they could not at the start, **and** what does
the world now ask of them that it did not ask before? An answer to the first
but not the second means capability accrued without stakes, and the chapter is
structurally decorative. This is per-chapter, checkable, and it maps onto data
you already track — state mutations give you the capability half. The second
half needs the model. *Source: Tam.*

**P3 — The three stages of relative strength.** ◈ [M]
A character should be shown at three distinct positions relative to the
world: excluded from the central activity, participating at the limit of their
ability, and having absorbed that former limit into routine. If all three are
not present, what exists is one long middle act — competent but never
transformed. Manuscript-level, so this is a dashboard pattern rather than an
inline one. *Source: Tam.*

**P4 — Negative space: problems the system cannot solve.** ◈ [P] → [M]
The protagonist should get stronger at things that do not solve their actual
problems. Every capability gain that shrinks a human problem moves the book
toward competence porn. The recommended practice is to keep an explicit list
of problems the system cannot solve.
**Product note:** that list is a first-class World Bible structure waiting to
happen. Explicit author-maintained status and scene links can be summarized
deterministically. Whether the prose meaningfully engages a problem or quietly
solves it through power remains [M]. *Source: Tam.*

**P5 — Weak-to-OP honesty.** ◈ [M]
The "weak" phase in weak-to-OP is usually three chapters of survivable
inconvenience, which is why readers call the trope a marketing lie. For the
weak half to register, the protagonist must *lose* things during it, not merely
survive them. The distinction that matters: **complicating** the power rather
than **withholding** it. *Beware of Chicken* grants full power in chapter one
and spends hundreds of chapters on the social and moral cost. *Source: Tam.*

**P6 — Tier pacing curve.** ◈ [D metric] / [M guidance]
Faster than readers expect in the first arc, slower than they expect in the
middle. Books that lose readers around book three typically had exciting early
tiers and mechanical later ones. Each new tier should introduce a new kind of
*problem*, not a new damage number. Tier-advancement intervals are directly
computable if the author tracks tiers; judging whether the resulting curve is
appropriate for this story is [M]. *Source: Tam.*

**P7 — Multi-axis progression.** ◆ [D metric] / [M conclusion]
Systems where attributes advance separately keep the supporting cast relevant;
a single global "power level" that raises everything at once makes every other
character redundant. Rowe's canonical negative example is Dragon Ball's power
level; his positive practice is advancement types that improve one or two
things at a time, often with a cost to another. Detectable if the ruleset has
multiple stat definitions and the app can see whether they move together. The
co-movement metric is [D]; claiming that it made another character redundant
is [M]. *Source: Rowe.*

**P8 — Side-cast obsolescence.** ◆ [M]
The most common reader complaint about long series casts: supporting
characters become irrelevant because they cannot keep pace. Note the honest
caveat — the usual mitigation (letting low-level characters hurt high-level
ones through surprise, weaknesses, or items) is itself something many readers
find unsatisfying. POV counts are [D] only when explicit POV metadata exists;
agency and obsolescence are semantic judgments. *Sources: Rowe; reader
discussions.*

**P9 — Effort equals reward.** ◈ [M]
Power increases must feel earned — through cleverness, work, or barely
surviving. Gains that arrive free or by luck drain the core satisfaction of
the genre. *Source: Rowe.*

**P10 — Don't skip to the end.** ◈ [D metric] / [M guidance]
Level 1 to level 99 inside one book is a different (and lesser) appeal than
gradual growth. Computable as advancement rate against manuscript length.
*Source: Rowe.*

### B2. System and consistency (the cluster closest to your existing engine)

**P11 — Unused solutions.** ◆ [M]
If a character possesses an ability that would plainly resolve the situation,
they must at least visibly consider it. Rowe flags super speed, teleportation,
and time travel as the abilities to be most careful granting.
Deterministic code can shortlist abilities, items, state, and candidate scenes.
Whether an ability would plainly resolve the situation, and whether the prose
adequately considers it, requires interpretation. *Source: Rowe.*

**P12 — Abandoned progression methods.** ◆ [M]
If a rapid-advancement method is introduced, characters will be expected to
keep using it unless the text establishes why they cannot. Rowe's example is
Dragon Ball's zenkai boost, exploited once and then quietly forgotten.
Deterministic code can report that no explicit linked or lexical reference was
found. Deciding that the method was narratively abandoned or that no in-world
reason was given requires interpretation. *Source: Rowe.*

**P13 — Society applies its own powers.** ◆ [M]
Resurrection, teleportation, and elemental magic reshape economies, religion,
trade, and daily life. A world where wizards exist but society stayed medieval
reads as unexamined. Progression fantasy is especially exposed because
society-altering abilities unlock over time. *Source: Rowe.*

**P14 — Competent others.** ◈ [M]
The protagonist should not win by noticing something obvious that a whole
world of intelligent people missed. Rowe's example: being the only person
playing an "unpopular" class in a game with a million players, in a genre
where players datamine everything. *Source: Rowe.*

**P15 — Established limits stay established.** ◆ [M]
Bypassing a stated system limit for plot convenience is repeatedly named as
the fastest way to lose reader trust. Related failure: introducing mechanics
late with no foreshadowing. Partially [D] where the limit is recorded in canon.
*Sources: Rowe; LitRPG Reads.*

**P16 — Options beat linear power.** ◈ [M]
A new conditional ability (a backstab that requires position) engages readers
more than +2% critical rate. When a character already has many attack options,
a utility option is more interesting than another attack. *Source: Rowe.*

### B3. System presentation

**P17 — Stat-block density.** ◈ [M], partially [D]
The most-cited mechanical complaint in the genre: full stat sheets every
chapter, and level-ups after every minor encounter. Guidance converges on
reserving stat reveals for consequential moments so their appearance itself
signals significance, and on partial sheets showing only what is currently
relevant. Notably medium-dependent ◇ — several sources claim stat blocks read
as tedious in print but work in audio because the narrator integrates them.
Density and interval are computable. *Sources: LitRPG Reads; reader
discussions.*

**P18 — Meaningless numbers.** ◈ [M]
Numbers that never affect tactics, choices, or consequences. The formulation
worth keeping: without worldly weight, a number is just inventory. This is the
reader-side complaint that pairs with P1's author-side diagnosis.
*Sources: reader discussions; Tam.*

**P19 — System-as-narrator intrusion.** ◈ [M]
When the system comments on everything, the effect is of a protagonist
travelling with a chat window that will not mute. Distinct from P17: this is
about the system's *voice*, not the density of its numbers. *Source: LitRPG
Reads.*

**P20 — Mechanical info-dump.** ◈ [M]
Front-loading world and system explanation, or halting an action scene to
explain magic. The convention is that the system should be revealed
progressively as the plot requires it. *Sources: LitRPG Reads; Royal Road
forums.*

### B4. Character

**P21 — Power as sole motivation.** ◆ [M]
Protagonists whose only goal is getting stronger become monotonous within a
few books. The most-praised counter-example in the dataset is a protagonist
with goals not tied to strength at all. Pairs with the finding that readers
forgive prose but not character. *Sources: reader analysis; Tam.*

**P22 — Static personality.** ◆ [M]
Emotional arcs neglected while power arcs are carefully plotted; annoying
traits that never evolve. Named explicitly as a thing many LitRPG authors are
weak at. *Source: reader analysis.*

**P23 — Overused trope cluster.** ◈ [M]
A working author's candid list, in his ranking: OP main character (first),
harems (second), the secret lost item or class no one has heard of in
centuries (third), the exposition-dispensing comic-relief companion (fourth),
and uniformly attractive women (fifth). Treat with care — these are tropes
readers *complain* about, and several are simultaneously commercially popular.
The coaching frame should be "this is a convention with known reader fatigue,"
not "do not do this." *Source: Oster.*

### B5. Practice patterns (undetectable in prose)

These cannot be surfaced by any manuscript analysis. They are teaching-only,
and they include some of the most valuable material found.

**P24 — Buffer discipline.** ◈ [P]
Write one fewer chapter than you can sustain. Repeatedly named as the practice
that makes a schedule survivable. *Source: Royal Road forums (pass one).*

**P25 — No-gap posting.** ◇ [P]
The strongest measured behavioural predictor of Rising Stars rank: never going
three or more days without a chapter. Worth +7.4 rank positions on the main
list, +5.7 on genre lists. 34% of main-list fictions had a gap versus 84% of
genre-only fictions — a 50-point spread, larger than any other factor
measured. Regularity beats speed: every-other-day with no gaps outperforms
daily with occasional four-day holes. *Source: Chapter Chronicles, n=459.*

**P26 — Launch strategy by target list.** ◇ [P]
58% of main-list fictions launched with 6+ chapters on day one; only 14% used
a slow launch. On genre lists the pattern inverts — 48% used a slow launch.
The right strategy depends on which list is the target. *Source: Chapter
Chronicles, n=459.*

**P27 — Author burnout as a craft problem.** ◈ [P]
The first of the five named series-decline causes. The observable symptoms are
inconsistent releases, shorter chapters, filler, and abandoned plot threads —
so burnout presents to readers as a *quality* problem, which is why it belongs
in a craft library rather than a business one. *Source: reader analysis.*

**P28 — Plan the power ceiling before publishing.** ◈ [P]
Series praised for power scaling generally designed the system with its
endpoint known. The failure mode this avoids is the "new realm every book"
trap. Adjacent to P6 but a planning practice rather than a pacing check.
*Source: reader analysis.*

---

## Part C — What this means for 4.18's schema

The four-part structure proposed in the roadmap (what the pattern is, what it
looks like present, what absent looks like, what to do about it) survives, but
the versioned library record also needs a stable ID, content version,
author-vetted status, citations, source confidence, genre applicability,
exclusions, and subgenre modifiers.

**A detectability field** — `deterministic` / `model-assisted` / `practice`.
Without it the coach cannot know which patterns it may claim to have checked
against the draft and which it may only teach. Getting this wrong is a trust
failure of exactly the kind the architecture exists to prevent: a coach saying
"I reviewed your manuscript and you're fine on buffer discipline" is lying.

**A scope field** — `selection` / `scene` / `chapter` / `manuscript` /
`series` / `practice`. P2 is per-chapter, P3 and P8 are manuscript-level, and
P17 is per-chapter. Practice advice has no manuscript evidence scope. This is
the concrete form of the inline-versus-dashboard split already recorded in
4.20, and the pattern schema is where it has to live.

A suggested tranche-1 selection, mixed per the author's decision and chosen to
exercise deterministic, model-assisted, and practice behavior:

| # | Pattern | Kind | Why in tranche 1 |
|---|---|---|---|
| 1 | P2 decorative chapter test | [M] chapter | Most operational pattern found; tests a bounded ask |
| 2 | P10 advancement rate | [D] manuscript | Tests a no-key metric from explicit tracked progression |
| 3 | P17 stat-block density | [M] chapter | The genre's most-cited mechanical complaint |
| 4 | P1 fake progression | [M] manuscript | Tests the dashboard path |
| 5 | P25 no-gap posting | [P] practice | Tests whether vendor-sourced practice advice feels legitimate |
| 6 | P21 power as sole motivation | [M] manuscript | General craft; tests non-LitRPG-specific voice |
| 7 | P4 negative space | [P]→[M] manuscript | Tests the World Bible structure without overstating detection |
| 8 | Promise consistency (Part A) | [M] chapter/manuscript | High-value hypothesis; exercises both coach entry points |

That mix is three general-craft, three LitRPG-specific, and two that
straddle — close to the even split you asked for.

---

## Part D — Corrections to the first pass

**Rising Stars engagement ratio — contradicted.** Pass one recorded, marked ◇,
a claim that engagement *ratio* drives rank (100 followers with 30 ratings
outranking 5,000 with 40). The larger dataset contradicts the rating half
directly: rating-to-rank correlation is r = −0.17 on the main list and r =
−0.03 on genre lists, i.e. effectively zero. A 4.3-rated and a 4.7-rated
fiction rank the same. The ◇ mark did its job. Growth velocity is the signal;
ratings are not. Any library pattern about ratings should say so.

**Also reported as having no effect** ◇: the "What to Expect" synopsis
bullet-list format (36% main list vs 38% genre — no difference) and comp
titles in the synopsis. Both are widely repeated advice. They may help reader
conversion, but they do not predict rank.

**Chapter length — unresolved and left that way.** Pass one found sources
clustering at both 1,500–2,500 and ~4,000 words. Nothing in this pass settles
it. The only reliable finding remains the floor (below ~1,500 reads as short).
A library pattern here should teach the floor and decline to name an optimum.

---

## Decisions taken from this research

- Practice patterns use an explicit `practice` scope and are teaching-only;
  the dashboard never claims to have checked them.
- P4 receives an author-maintained World Bible structure in roadmap 4.21.
  Explicit status is deterministic; semantic engagement remains
  model-assisted.

## Open questions

1. **How opinionated should the trope patterns be?** P23's cluster is real
   reader fatigue and also commercially successful. A coach that tells a new
   author not to write the thing that sells is wrong; one that says nothing is
   useless.
2. **Does promise consistency deserve to be pattern zero?** It is the only
   concept that appears independently in the retention data, the
   series-longevity data, and the craft essays. It may be the library's
   organising idea rather than one entry in it.

---

## Sources

Craft (primary and high-quality):

- [Writing Progression Fantasy — Andrew Rowe](https://andrewkrowe.wordpress.com/2019/03/02/writing-progression-fantasy/)
- [Distinctions in Progression Fantasy Styles — Andrew Rowe](https://andrewkrowe.wordpress.com/2022/11/04/distinctions-in-progression-fantasy-styles/)
- [How to Write Meaningful Progression in Progression Fantasy — Jacob Tam, IlorisNovel](https://www.ilorisnovel.com/articles/how-to-write-meaningful-progression-in-progression-fantasy)
- [Top 5 Overused LitRPG Tropes — Aaron Oster](https://www.aaronosterauthor.com/from-the-bean-bag-of-aaron-oster/top-5-litrpg-tropes)

Reader data:

- [Why Do Great LitRPG Series Fall Off? An Analysis of 1,147 Reddit Comments — Chapter Chronicles](https://www.chapterchronicles.com/blog/why-great-litrpg-series-fall-off/) (vendor content; stated methodology)
- [We Analyzed 459 Rising Stars Fictions: The 5-Point Discipline Index — Chapter Chronicles](https://www.chapterchronicles.com/blog/rising-stars-discipline-index/) (vendor content; stated methodology and limitations)
- [Poll: which of these do you consistently have a problem with — Goodreads LitRPG forum](https://www.goodreads.com/topic/show/19548378-poll-which-of-these-do-you-consistently-have-a-problem-with-having-rea)
- [LitRPG Tropes — Royal Road forums](https://www.royalroad.com/forums/thread/103455)

System presentation and general craft:

- [How to Write LitRPG: Integrating Game Systems Into Your Story Without Losing Readers — LitRPG Reads](https://litrpgreads.com/blog/litrpg/how-to-write-litrpg-integrating-game-systems-into-your-story-without-losing-readers) (heavily monetized; corroboration only)
- [LitRPG Audiobook Tropes Readers Love and Hate — LitRPG Reads](https://litrpgreads.com/blog/litrpg/litrpg-audiobook-tropes-readers-love-and-hate)
- [Guide to writing LitRPGs — Royal Road forums](https://www.royalroad.com/forums/thread/124876)
- [How do you deal with/prevent/manage power creep/rising stakes — Scribble Hub forums](https://forum.scribblehub.com/threads/how-do-you-deal-with-prevent-manage-power-creep-rising-stakes-in-story-telling.15591/)
- [Progression fantasy — Wikipedia](https://en.wikipedia.org/wiki/Progression_fantasy)
