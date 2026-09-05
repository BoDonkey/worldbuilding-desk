# LitRPG Genre Research — Taxonomy and Platform

**Status:** active working input. Not an authority and not a plan — reference
material for roadmap slice 4.18 (craft library content). Companion:
`research-litrpg-craft-failures.md`. Archive this after vetted claims have moved
into the versioned library and the continuing content track no longer uses it.

**First written:** 2026-08-29.
**Type:** research input, not a decision record.
**Purpose:** source-grounded raw material for the 4.18 craft-library outline.
**Original scope as set by the author:** subgenre taxonomy and market/platform
conventions. Part A2 was added later as an explicitly unvetted bridge from that
taxonomy to the separate craft-pattern research; it is not settled library
content.

**How to use this.** This is the input that keeps library drafting from being
circular. Correct it against your own reading first; the corrected version is
the drafting brief, not this one. Every claim below carries its source and a
confidence mark. Do not promote anything marked ◇ into a library pattern
without independent confirmation.

Confidence marks used throughout:

- **◆ Documented** — stated consistently across multiple independent sources,
  or specific and falsifiable enough to check.
- **◈ Practitioner consensus** — repeated by working authors in community
  forums. High ecological validity, self-reported, unverified.
- **◇ Weak** — single source, commercially motivated source, or a claim that
  reads like generalization. Treat as a lead, not a finding.

---

## Source quality ledger

Read this before the findings.

**Royal Road author forums** — the platform-conventions material comes largely
from working authors describing what they actually do. Self-reported and
unaudited, with obvious survivorship bias (authors who post about success are
not a random sample), but it is the genuine practitioner consensus and there is
no better source for platform norms. Marked ◈.

**LitRPGTools "Complete Guide to LitRPG Subgenres"** (last updated Feb 2026) —
the most structurally complete taxonomy found, and the backbone of Part A.
**Caution:** it is a commercial property (Pivot Press Publishing) running
Amazon affiliate links, and one author, Aaron Renfroe, is recommended in
essentially every subgenre section including ones where the fit is strained.
That is promotional placement, not curation. The *category structure* appears
sound and matches other sources; the *author and series recommendations should
not be treated as canonical*. Use the skeleton, discard the endorsements.

**LitRPG Critic / Fantasy Ranked** — subgenre explainers, several dated
March–May 2026, so current. Independent of LitRPGTools and agree with it on
category boundaries, which is why the core taxonomy is marked ◆.

**Rising Stars analytics posts (Chapter Chronicles, Plotwrite)** — tool-vendor
content marketing, so motivated. Specific numbers are useful leads, but the
historical datasets and classifications are not independently reproducible
from the posts. Marked ◇ unless corroborated by a primary or independent
source.

---

## Part A — Subgenre taxonomy

### The umbrella relationship ◆

The nesting most sources agree on:

- **GameLit** is the widest umbrella: game-like worlds, mechanics thematic
  rather than numerical, no obligation to show a stat screen.
- **LitRPG** sits inside it and *does* require explicit, visible mechanics —
  stat sheets, numbers, skill trees.
- **Progression fantasy** overlaps rather than nests cleanly. It requires that
  power growth be the engine of the story, but not that the growth be numeric.

The formulation that recurs across sources: **all LitRPG is broadly
progression fantasy; not all progression fantasy is LitRPG.** The distinction
that matters for tooling is *numeric versus narrative* progression — LitRPG
tallies growth explicitly, progression fantasy can convey it through action
and consequence.

Relevance to your product: this is the line your project modes already
straddle. `litrpg` mode assumes numeric state worth tracking; `general` mode
assumes none. Progression fantasy is the case in between — hard, well-defined
power tiers that are *rules* rather than *numbers*. Worth checking whether
your mechanics model can express a tier system with no integers in it.

### The twelve categories ◆ (structure) / ◇ (boundaries)

Category boundaries are soft and sources explicitly say to treat them as
starting points, not fences. Crossovers are the norm among the best-known
works, not the exception.

| Subgenre | Defining move | Structural signature |
|---|---|---|
| Classic LitRPG | Explicit game mechanics in a game-like world | Stat sheets, skill trees, XP, loot tiers |
| Progression fantasy | Power growth as the story engine | Hard tiers, training arcs, tournaments, mentors |
| Dungeon core | Protagonist *is* the place | Resource loop: mana in → rooms/monsters → stronger invaders → more mana |
| System apocalypse | A system is imposed on the modern world | Day-one collapse, survival urgency → faction building |
| Tower climbing | Vertical, floor-gated progression | Floors as self-contained arcs; always a known next goal |
| Cultivation | Internal refinement toward transcendence | Named realms, breakthrough events, sect politics |
| Base building | Progression applied to a community | Settlement upgrades, NPC roles, siege events |
| GameLit | Game-adjacent without the crunch | Quests and respawns, no obligatory stat screen |
| Dark / horror LitRPG | The system itself is hostile | Permadeath, antagonistic system design, moral compromise |
| Isekai / portal | Transported protagonist | Fish-out-of-water; modern knowledge as an advantage |
| Crafting / economy | Advancement without combat | Recipes, material tiers, markets |
| Time loop | Iteration as the progression mechanic | Knowledge retention across resets; optimization |

---

## Part A2 — Subgenre coaching profiles (drafted library content)

**Status: draft for author review, not vetted content.** The *reader promise*
and *structural signature* fields are grounded in the sources cited above. The
*characteristic failure* and *pattern modifiers* fields are **my inference from
the research, not sourced claims** — they are the reasoning that connects the
taxonomy to the pattern pool in `research-litrpg-craft-failures.md`, and they
are the fields most likely to be wrong. Treat them as a starting argument.

**Why this shape rather than encyclopedia entries.** A description of dungeon
core is freely available on several genre sites and adds nothing a reader
cannot get elsewhere; it is also not citable against a manuscript, so the coach
could not use it to say anything. What an encyclopedia cannot do is record
**which patterns apply, invert, or do not apply** in a given subgenre. That
turns each profile from a page into a modifier on the pattern set, which is
what makes per-subgenre coaching possible at all.

Pattern IDs below refer to `research-litrpg-craft-failures.md` Part B.

### 1. Classic LitRPG

- **Reader promise:** growth you can track numerically; optimise the build,
  watch the numbers climb, face challenges that test strategy.
- **Structural signature:** stat sheets, skill trees, XP thresholds, loot tiers.
- **Characteristic failure:** numbers with no worldly weight — advancement that
  never changes what the character can attempt (P18).
- **Pattern modifiers:** the full pool applies. P17 and P18 are central here in
  a way they are not anywhere else, because this is the only subgenre where
  visible mechanics are the point rather than a device.

### 2. Progression fantasy

- **Reader promise:** an earned journey from nothing to something, where the
  grind has weight and breakthroughs are paid for.
- **Structural signature:** hard tiers, training arcs, tournaments, mentors.
- **Characteristic failure:** fake progression (P1) — the defining complaint of
  this subgenre specifically, and the reason the genre argues about itself.
- **Pattern modifiers:** P1, P3, and P9 are the core. **P17/P18 may not
  apply** — progression fantasy need not be numeric, so a coach that assumes
  stat blocks will give advice about a system the author deliberately does not
  have. This is the clearest case for gating patterns on subgenre.

### 3. Dungeon core

- **Reader promise:** inverted power fantasy — you are the monster, the place,
  the architect. Base-building satisfaction in narrative form.
- **Structural signature:** closed resource loop (mana in → rooms and monsters
  → stronger invaders → more mana); floor themes; gradual awakening into
  something with goals.
- **Characteristic failure:** the core has no goal beyond growing, so the loop
  runs without a story attached to it.
- **Pattern modifiers:** the most heavily modified subgenre in the set.
  **P21 (power as sole motivation) needs a variant** — growth is legitimately
  the protagonist's condition here, so the standard note is wrong as written.
  **P8 (side-cast obsolescence) inverts** — adventurers are antagonists, and
  the recurring cast may be the invaders. Protagonist-agency patterns need a
  variant for an immobile protagonist. **P4 (negative space) is unusually
  strong** — a dungeon literally cannot leave, which is the richest built-in
  set of problems power cannot solve in any subgenre here.

### 4. System apocalypse

- **Reader promise:** urgency. No logging off, monsters at the door, level up
  or your family dies tonight.
- **Structural signature:** day-one collapse, rapid early power growth, then a
  transition to factions and settlements.
- **Characteristic failure:** urgency decays after the first act and nothing
  replaces it; the book becomes faction management with the stakes of the
  opening still being claimed rather than felt.
- **Pattern modifiers:** **P6 (tier pacing) partially inverts** — front-loaded
  growth is the convention here, not a mistake, so the standard "fast early,
  slow middle" advice needs restating rather than repeating. P3's three stages
  are compressed into a much shorter span.

### 5. Tower climbing

- **Reader promise:** always a known next goal. Clean, legible progression.
- **Structural signature:** floors as self-contained arcs with their own
  ecosystems and rules; escalating tiers; often a mystery about the tower.
- **Characteristic failure:** floors become interchangeable — new biome, same
  beat — so structure substitutes for stakes.
- **Pattern modifiers:** **P2 (the decorative chapter test) is strongest here**
  and should probably be phrased per-floor rather than per-chapter: what does
  this floor ask that the last one did not? Structurally the cleanest subgenre
  to analyse mechanically, and the best proving ground for 4.19's structural
  passes.

### 6. Cultivation

- **Reader promise:** transcendence. The path to power is also a path of
  self-understanding, and breakthroughs are events.
- **Structural signature:** named realms, dramatised breakthroughs, sect
  politics, alchemy and refinement.
- **Characteristic failure:** breakthroughs become mechanical and the
  philosophical half goes vestigial — realms as levels with better names.
- **Pattern modifiers:** readers of this subgenre **care about reasons more
  than numbers** (the reverse of classic LitRPG readers), so P18's framing
  needs inverting: the failure here is unexplained advancement rather than
  weightless numbers. P6 is central — spending longer per realm later is the
  convention. Western cultivation compresses pacing relative to the source
  tradition and expects stakes within the first few pages.

### 7. Base building and kingdom management

- **Reader promise:** watch a campfire become a kingdom; macro satisfaction.
- **Structural signature:** settlement upgrades, NPC recruitment with roles and
  loyalty, resource logistics, siege events.
- **Characteristic failure:** management without personal stakes — the
  settlement grows and no one in it matters.
- **Pattern modifiers:** **P8 (side-cast obsolescence) fully inverts** — the
  supporting cast is the subject, not a liability, and a coach warning about
  side-cast irrelevance here has misread the book. P21 needs a variant: the
  protagonist's goal is legitimately communal rather than personal.

### 8. GameLit

- **Reader promise:** game-world fun without parsing stat tables.
- **Structural signature:** quests, respawns, NPCs; mechanics thematic rather
  than numerical.
- **Characteristic failure:** neither fish nor fowl — too gamey for fantasy
  readers, too soft for LitRPG readers, satisfying neither promise.
- **Pattern modifiers:** **P17, P18, and P19 largely do not apply** — there is
  no stat-block density problem in a book with no stat blocks. This is the
  subgenre where a coach assuming LitRPG conventions will be most obviously
  wrong, and it is the strongest argument for making subgenre an explicit
  project setting rather than an inference.

### 9. Dark / horror LitRPG

- **Reader promise:** the numbers do not mean safety. Real menace, real cost.
- **Structural signature:** permadeath or severe penalties, antagonistic system
  design, morally compromised choices.
- **Characteristic failure:** gore substituting for consequence — brutality
  that costs the protagonist nothing durable, so stakes are asserted rather
  than felt.
- **Pattern modifiers:** **P5 (weak-to-OP honesty) is central** — this is the
  subgenre where the protagonist must actually lose things, and the one where
  readers most reliably notice when they do not. P9 (effort equals reward) is
  load-bearing for the same reason.

### 10. Isekai / portal fantasy

- **Reader promise:** modern knowledge as an edge; fish-out-of-water
  adaptation; the protagonist's confusion mirroring the reader's.
- **Structural signature:** transported protagonist, cultural learning,
  real-world expertise applied creatively.
- **Characteristic failure:** **P14 is this subgenre's signature failure** —
  the protagonist wins by noticing something obvious that an entire world of
  intelligent people somehow missed. The genre's premise invites it, which is
  exactly why it needs naming here.
- **Pattern modifiers:** P14 promoted to primary. P13 (society applies its own
  powers) is closely related and unusually relevant, since the outsider's
  advantage only holds if the society's own non-use is explained.

### 11. Crafting and economy

- **Reader promise:** power without violence; the satisfaction of recipes,
  discovery, and being indispensable.
- **Structural signature:** material tiers, quality levels, trade routes,
  non-combat advancement paths.
- **Characteristic failure:** an economy that does not cohere — prices, supply,
  and scarcity that exist only when the plot needs them.
- **Pattern modifiers:** **conflict-escalation patterns do not apply** as
  written, since conflict does not escalate through combat. **P13 is central**
  rather than peripheral — this is the subgenre that lives or dies on whether
  society plausibly uses what it has.

### 12. Time loop

- **Reader promise:** iteration, optimisation, the perfect run assembled from
  failures.
- **Structural signature:** knowledge retention across resets, hidden mechanics
  revealed gradually, escalating or shifting loop conditions.
- **Characteristic failure:** loops that do not compound — iteration without
  accumulating insight, so resets read as repetition rather than progress.
- **Pattern modifiers:** **P12 (abandoned progression methods) does not
  apply** — methods reset by design, so the check would fire constantly and
  wrongly. **P2 should be scoped per-loop rather than per-chapter.** P10 (don't
  skip to the end) needs restating, since compressed re-advancement across
  loops is the form rather than a flaw.

### Cross-cutting note

Crossover is the norm among the best-known works, not the exception — several
flagship series occupy three or four of these at once. Profiles should
therefore be **additive modifiers the author can apply in combination**, not a
single exclusive choice. A book tagged dungeon core + dark LitRPG should get
both modifier sets, with conflicts surfaced rather than silently resolved.

**Open product question this raises:** should subgenre be declared by the
author as a project setting, or inferred from the manuscript? Declared is
cheaper, honest, and immediately usable. Inferred is a genuine dashboard
feature and something no competitor could copy without equivalent canon data —
but it is also the kind of claim that is embarrassing when wrong. A reasonable
middle: author declares, dashboard observes when the manuscript disagrees.

---

### Structural notes worth carrying into patterns

**Dungeon core inverts the power fantasy** ◆ — the protagonist is immobile and
the antagonists are the conventional heroes. Its progression is architectural
rather than personal, and its resource economy is a closed loop. Any coaching
pattern about protagonist agency or goal-setting needs a dungeon-core variant,
because the defaults assume a mobile protagonist who wants things.

**Tower climbing has the cleanest progression hook in the genre** ◈ — the next
floor is always the next goal, which keeps pacing tight and lets the author
reinvent the setting without losing momentum. Structurally this is the easiest
subgenre to analyze mechanically, and probably the best first target if the
dashboard's structural passes need a proving ground.

**System apocalypse front-loads power growth** ◆ — rapid early gain during the
survival scramble, then a transition to faction and settlement concerns. That
implies a characteristic pacing curve, which is checkable computationally and
is a strong candidate for a derived-dashboard pattern.

**Cultivation's breakthroughs are narrative events, not just numbers** ◆ —
advancement between named realms is dramatized, and the philosophical arc is
supposed to move with the martial one. Western cultivation ◈ codifies this
with RPG-like clarity (tiered breakthroughs, spiritual stats) and compresses
pacing relative to the Chinese source tradition — Will Wight is repeatedly
cited as the author who established the Western pacing expectation of stakes
inside the first few pages.

**Crafting/economy stories advance without combat** ◆ — a real constraint on
any coaching pattern that assumes conflict escalates through fighting.

---

## Part B — Platform and market conventions

Nearly all ◈: this is practitioner consensus from Royal Road author forums.
Numbers vary between threads; ranges below are where sources cluster, not
measured values.

### Chapter length ◈

Sources cluster in two bands, and disagree:

- **1,500–2,500 words** — the most commonly cited working range.
- **~4,000 words** — described by some authors as ideal.
- **Below ~1,500 words** — consistently described as feeling too short.

The recurring caveat is that length should follow the story rather than a
target. The one reliable finding is the floor, not the optimum.

### Release cadence ◈

The strongest and most consistent finding in the whole platform section:
**consistency matters more than frequency.** Same day, same time, sustained.

Common launch pattern:

- A batch of 4–5 chapters (roughly 20k words) on day one, then
- daily chapters through roughly the first month, then
- a sustainable regular cadence.

The rationale is that launch velocity buys front-page visibility during the
window when the ranking system is most responsive.

**Buffer discipline** ◈ — write one fewer chapter than you can sustain (write
three, publish two). Widely repeated as the practice that makes a schedule
survivable. This is a genuinely good coaching pattern and it is behavioral
rather than textual — worth noting that not every valuable pattern is
something the app can detect in prose.

### Rising Stars ◇

- Reportedly ranks on **recent growth velocity**, not absolute size ◇.
  Consequence:
  small fictions can climb because percentage growth is the signal — 10→100
  followers outranks 100→200.
- **Engagement ratio over raw counts** ◇ — 100 followers with 30 ratings is
  claimed to signal harder than 5,000 with 40. Plausible and widely repeated,
  but this specific framing traces to vendor content. Treat as a lead.
- **Sixteen lists, not one** ◇ — a main list plus fifteen genre lists in the
  cited vendor snapshot.
- **Tenure is short** ◇ — in one 14-month vendor dataset no fiction held the main
  list beyond six weeks; median tenure three weeks. Specific and falsifiable,
  but not independently reproduced.
- The algorithm is **undisclosed** ◆. Royal Road does not publish it. Any
  pattern in the library that claims to know how it works should say plainly
  that it is inferred.

### Early-chapter retention ◈

Self-reported benchmarks, wide variance, but they cluster:

- Chapter 1 → 2: aim **~60%**; front-page stories reportedly hit **80–90%**.
- Chapter 2 → 3: aim **~80%+**.
- A **25–50% decline** across the first few chapters is normal before the
  curve flattens.

Diagnostic framing worth keeping: if chapter 1→2 retention is poor, the usual
diagnosis is **a promise mismatch, not bad prose** — the blurb, cover, and
title set an expectation the opening did not pay off. That is a genuinely
useful coaching frame and it generalizes well beyond Royal Road.

Related ◈: the hook is expected to run across the **first few chapters**, not
just the opening scene — long enough for the reading habit to form. Prologues,
where used, are advised short (500–750 words).

---

## What remains unvetted

The later Part A2 addendum sketches subgenre modifiers, and the companion
research supplies candidate failure patterns. Neither substitutes for author
review. The following remain incomplete:

- **Vetted craft conventions per subgenre** — Part A2's modifiers are
  inference, not sourced or author-approved library content.
- **Representative reader-expectation evidence** — the companion document
  contains useful leads, but several quantitative claims rely on selected
  community samples or motivated vendor analyses.

Taxonomy and platform conventions are useful foundation material, but the
twelve-category structure remains an author-review question rather than a
settled product ontology. Tranche 1 should select only the few subgenres the
author is prepared to support well.

---

## Open questions for the author

1. **Does the taxonomy match your reading?** The twelve categories come
   largely from one commercially motivated source, corroborated on boundaries
   but not on emphasis. If your sense of the genre says the real divisions are
   fewer, or cut differently, your version wins.
2. **Which subgenres does v1 actually serve?** Twelve is too many to write
   distinct patterns for. Three or four with real coverage beats twelve with a
   sentence each.
3. **Does the coach address platform strategy at all?** Cadence, buffers, and
   Rising Stars are valuable to a new author and entirely undetectable in
   prose. That may argue for two pattern kinds — textual patterns the app can
   check against the draft, and practice patterns it can only teach. Worth
   deciding before the library structure is fixed, since it changes 4.18's
   pattern schema.
4. **Progression fantasy with no numbers** — can the current mechanics model
   express hard tiers without integers? If not, the coach will be giving
   advice the app cannot represent.

---

## Sources

Taxonomy:

- [The Complete Guide to LitRPG Subgenres — LitRPGTools](https://www.litrpgtools.com/guides/litrpg-subgenres) (commercial; affiliate; promotional author placement)
- [What Is Dungeon Core Fiction? — LitRPG Critic](https://litrpgcritic.com/blog/2026-04-03-what-is-dungeon-core-fiction-the-complete-guide-to-the-sub-genre/)
- [What Is System Apocalypse LitRPG? — LitRPG Critic](https://litrpgcritic.com/blog/2026-04-15-what-is-system-apocalypse-litrpg-the-complete-guide-to-the-sub-genre/)
- [What Is Cultivation Fiction? — LitRPG Critic](https://litrpgcritic.com/blog/2026-04-22-what-is-cultivation-fiction-the-complete-guide-to-xianxia-and-wuxia-fantasy/)
- [What Is Xianxia and Cultivation Fiction? — Fantasy Ranked](https://fantasyranked.com/blog/2026-05-25-what-is-xianxia-and-cultivation-fiction-a-complete-guide-for-new-readers/)
- [Progression Fantasy vs LitRPG — progressionfantasy.net](https://www.progressionfantasy.net/blog/progression-fantasy-vs-litrpg)
- [What Differentiates Progression Fantasy from LitRPG — RPGLit](https://rpglit.net/what-differentiates-progression-fantasy-from-litrpg)
- [Difference between progression fantasy and litrpg? — Royal Road forums](https://www.royalroad.com/forums/thread/156327)
- [LitRPG — TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/Main/LitRPG)
- [Exploring Martial Worlds — Dreamscape Publishing](https://www.dreamscapepublishing.com/blog/exploring-martial-worlds/)

Platform and market:

- [Chapter Length & Release Schedule — Royal Road forums](https://www.royalroad.com/forums/thread/162837)
- [Optimal/Ideal Release Length & Schedule? — Royal Road forums](https://www.royalroad.com/forums/thread/105234)
- [When to Publish? How Often? — Royal Road forums](https://www.royalroad.com/forums/thread/155967)
- [How does the Rising Stars system work? — Royal Road forums](https://www.royalroad.com/forums/thread/166330)
- [Royal Road Rising Stars Data Guide — Chapter Chronicles](https://www.chapterchronicles.com/blog/rising-stars-complete-guide/) (vendor content)
- [The Royal Road Algorithm: How to Get Into Rising Stars — Plotwrite](https://www.plotwrite.ink/learn/royal-road-algorithm-rising-stars) (vendor content)
- [Reader Drop Rate and Retention — Royal Road forums](https://www.royalroad.com/forums/thread/111699)
- [What is the average first to second chapter retention rate? — Royal Road forums](https://www.royalroad.com/forums/thread/134345)
- [User Retention — Royal Road forums](https://www.royalroad.com/forums/thread/102067)
