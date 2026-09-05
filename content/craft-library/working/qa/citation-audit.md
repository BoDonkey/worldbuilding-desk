# Citation Audit

**Status:** running tracker, updated after every batch. Checks every
factual, historical, cultural, or quantitative claim against its cited
support, per the handoff's batch QA checklist.

## Method

For each record, verify: (1) every `source_ids` entry resolves in
`sources.yml` — enforced automatically by `qa/build_catalog.py`; (2) no
claim is stated more strongly than its cited source supports; (3)
quantitative/vendor-reported claims carry their date, sample, and
methodology caveat inline, not just in `sources.yml`.

## Batch 1 audit

- **craft.system.progression.decorative-chapter-test** — sourced to Tam
  (practitioner essay) and the internal pattern research. Claims are
  correctly hedged as practitioner consensus, not measured fact. OK.
- **craft.system.progression.advancement-rate** — the only `deterministic`
  record in this batch; the deterministic claim is scoped correctly (interval
  computation only, not curve-quality judgment). Subgenre modifiers are
  explicitly marked as this drafting pass's synthesis, matching the
  confidence of their source (`docs/research-litrpg-genre.md`'s own
  self-assessment). OK.
- **craft.system.progression.stat-block-density** — the audio-vs-print claim
  is explicitly flagged weak/single-source in the body, not just in
  `sources.yml`. OK.
- **craft.system.progression.fake-progression** — no quantitative claims;
  practitioner-sourced. OK.
- **craft.general.practice.no-gap-posting** — carries the Chapter Chronicles
  n=459 figures inline with the same "not independently reproducible"
  caveat used in the source research, and sets `source_confidence: limited`
  rather than `mixed` to reflect the single-study basis. This is stricter
  than the other batch-1 records and is the intended standard for
  vendor-reported quantitative claims going forward.
- **craft.general.character.power-as-sole-motivation** — the reader-hierarchy
  claim is attributed to a single vendor's coded sample, not stated as
  general fact. OK. (Front-matter `source_ids` had a formatting bug —
  `src.cron-story-genius` instead of `src.book.cron-story-genius` — caught
  by `qa/build_catalog.py`'s source_id validation and fixed same batch.)
- **craft.general.plot.negative-space-problems-power-cannot-solve** — the
  product-angle note is explicitly separated from the sourced craft claim,
  per the handoff's instruction not to attach a citation to a stronger claim
  than the source makes. OK.
- **craft.general.promise.promise-consistency** — treats promise consistency
  as a "strong hypothesis," matching the source research's own open-question
  framing rather than asserting it as proven. OK.

## No un-sourced substantive claims found in Batch 1.

## Batch 2 audit

All 14 records cite established, long-standing craft texts (Swain, McKee,
Truby, Cron, Maass, Le Guin, Gardner, Weiland) rather than single-blog or
vendor sources, so `source_confidence` sits mostly at `high`/`mixed` in this
batch rather than `limited`. Two records
(`craft.general.practice.buffer-discipline`,
`craft.general.practice.author-burnout-as-craft-problem`) rest on the same
single-vendor concentration flagged in Batch 1
(`src.chapterchronicles.series-falloff`, forum practitioner discussion) and
are correctly set to `source_confidence: limited`. No claim in this batch
attaches a citation stronger than its source supports; every "taxonomy"
subsection (convergent/divergent arcs, POV variants, pacing scales, etc.) is
explicitly framed in each record's closing note as this drafting pass's
synthesis rather than a direct claim from the cited books. No un-sourced
substantive claims found.

## Batch 3 audit

Cultivation/qi records specifically follow the handoff's instruction to
distinguish historical/religious usage from modern genre convention:
`craft.comparison.resource.qi-versus-mana` and
`craft.system.cultivation.realms-and-breakthroughs` both cite an academic
Daoism introduction ([[src.book.kohn-introducing-daoism]]) separately from
genre-convention sources, and each explicitly flags where a genre mechanic
(e.g., heavenly tribulations) is a fictional convention rather than a
documented historical practice — this is the single most citation-sensitive
material drafted so far and got the most explicit hedging as a result. One
gap: the qi-versus-mana record's claim about mana's Polynesian origin and
its 20th-century occultist/gaming reinterpretation has no entry in
`sources.yml` — flagged inline in that record's own sourcing note as a claim
needing a dedicated source before author sign-off, rather than silently
citing an unrelated source for it. Comparison and system-mechanic records
in this batch draw more heavily on established game-design texts (Adams,
Salen & Zimmerman, Costikyan, Koster) than Batch 1–2's craft-book base,
appropriately for Family C content; `source_confidence` is `mixed` across
nearly all of them because the specific taxonomies (variant lists, failure
modes) are this drafting pass's synthesis layered on solidly sourced
general principles, which is flagged in each record's own closing note
rather than only here.

## Batch 4 audit (tropes)

Six of twelve trope records carry `source_confidence: limited` because no
dedicated craft-literature source for that specific trope (found family,
romantic subplots, the heist, hidden identity, the prophecy, time loop,
academy story — seven, not six) was available to this drafting pass; each
says so explicitly in its own closing note rather than borrowing false
confidence from an adjacent citation. The mentor, chosen-one, and reluctant-
hero records lean on Campbell and Vogler, both flagged in-record as
contested/overgeneralized rather than settled. No claim exceeds its
source's actual support; no un-sourced substantive claims found.

## Batch 5 audit (subgenre profiles)

All 8 profile records trace their subgenre-structural claims to
`docs/research-litrpg-genre.md`, and each says explicitly that the source
document itself marks this material as authorial inference rather than
independently sourced fact — `source_confidence` is `limited` or `mixed`
across the whole batch accordingly, with no record overstating its
evidentiary basis. The cultivation profile correctly separates its academic
Daoism citation from its genre-convention citation, consistent with the
qi-versus-mana and cultivation-realms records from Batch 3. No un-sourced
substantive claims found; the main outstanding risk is that all 8 profiles
share the same single underlying research document as their primary source
— a concentration risk analogous to the Chapter Chronicles vendor
dependency already logged in `qa/unresolved-claims.md`, and worth the same
treatment there.

## Batch 6 audit (remaining subgenre profiles)

Same pattern as Batch 5: all 4 records trace their structural claims to
`docs/research-litrpg-genre.md`, explicitly note that source's own
inference marking, and carry `source_confidence: limited` accordingly. The
dark/horror LitRPG record correctly cross-references the death-and-respawn
system-mechanic record rather than duplicating its content. The time-loop
profile correctly separates itself from the Batch-4 trope record covering
the same subgenre's structural mechanic, avoiding an undeclared near-
duplicate — the two records have distinct, complementary scopes (mechanic
vs. pattern-rescoping) and are cross-linked via `related`. No un-sourced
substantive claims found. The `profile` family's single-source
concentration risk (logged in `qa/unresolved-claims.md` after Batch 5) now
applies to all 12 completed profiles rather than 8; no new mitigation
occurred this batch, so the flag stands as-is.

## Batch 7 audit (Family A general craft cluster)

All 12 records cite established, long-standing craft texts (McKee, Truby,
Cron, Forster, Gardner, Le Guin, Weiland, King, Bell, Snyder) consistent
with Batch 2's sourcing base; no record in this batch rests solely on a
single-vendor or forum source, so `source_confidence` sits at `high` or
`mixed` throughout, with no `limited` ratings this batch. The midpoint-and-
reversals record is explicit that Bell's and Snyder's beat-sheet models are
presented as one school among several, consistent with this library's
standing caution against treating any single structure model as universal
(reiterated from `docs/writing-coach-corpus-production-handoff.md`'s
instruction on this point). No claim exceeds its source's actual support;
every record's taxonomy subsections are flagged in their own closing notes
as this drafting pass's synthesis. No un-sourced substantive claims found.

## Batch 8 audit (Family C system mechanics cluster)

This batch leans heavily on established game-design literature (Adams,
Salen & Zimmerman, Costikyan, Koster) rather than progression-fantasy-
specific practitioner sources, which is appropriate for mechanics that
are rarely made explicit in prose craft writing but well documented in
formal game design. Every record explicitly flags that its application to
*prose narrative* (as opposed to interactive game balance) is this
drafting pass's adaptation, not a claim the cited game-design texts make
about fiction — consistent with the citation standard's instruction not to
attach a citation to a stronger claim than the source makes. Three records
(perks/feats/talents, affinities/resistances/titles/bloodlines, loot/
durability/inventory/ownership) carry `source_confidence: limited` for
lack of any dedicated source beyond general game-design texts; flagged in
each record's own closing note. No un-sourced substantive claims found.

## Batch 9 audit (Family B trope cluster)

Eight of twelve records carry `source_confidence: limited` because no
dedicated craft-literature source addressing that specific trope's
structure (rival, trickster, heir/succession, trial/tournament, mystery,
revenge, survival, faction-conflict/war) was available to this drafting
pass — each says so explicitly rather than inheriting confidence from an
adjacent citation. The trickster record is careful to treat Propp's
folktale-corpus analysis as function-based framing rather than a universal
claim, consistent with how Campbell and Vogler are handled elsewhere in
this corpus. The resurrection record correctly cross-references the
death-and-respawn system-mechanic record and the betrayal/sacrifice
records correctly reference the setup/payoff and finite-resource patterns
rather than restating their content. No claim exceeds its source's actual
support; no un-sourced substantive claims found. One drafting artifact (a
stray sentence fragment in the trickster record's antagonist-variant
bullet) was caught and fixed during this same batch rather than left for a
later pass.

## Batch 10 audit (Family A general craft cluster, second pass)

Consistent with Batch 7, all 12 records cite established, long-standing
craft texts rather than single-vendor or forum sources; several
(entry-and-exit-points, complications, earned-resolution, psychic-distance-
and-interiority) rate `source_confidence: high` where the core principle
is foundational and well-attested across multiple established texts. Two
records (continuity-passes, protecting-reader-experience) rate `limited`
for lack of a dedicated source beyond King's general craft writing and this
drafting pass's own synthesis of the library's established voice
standard — both flagged explicitly rather than borrowing confidence. Each
record in this batch explicitly distinguishes itself from its closest
existing neighbor in its own text (not just front-matter `related` links),
which doubles as a duplication safeguard: foreshadowing states its
distinction from setup-and-payoff, complications from causal-escalation,
psychic-distance-and-interiority from information-control, voice-as-craft-
element from dialogue-and-subtext. No un-sourced substantive claims found.

## Batch 11 audit (Family C system mechanics, second pass)

Consistent with Batch 8, most records lean on established game-design
literature (Adams) for mechanical framing, explicitly flagged in each
closing note as this drafting pass's adaptation to prose fiction rather
than a claim the source makes about narrative craft. Six of twelve records
carry `source_confidence: limited` for lack of any dedicated source beyond
general game-design texts (pools-vs-thresholds, health-and-focus,
environmental-and-hybrid-power, specialization-and-respec, currencies-
markets-and-inflation, enchanting-and-item-crafting) — flagged explicitly
in each. The two cultivation records touching historical material
(body-and-soul-cultivation, sects-inheritance-and-deviation) both
separately cite the academic Daoism source from their genre-convention
source and explicitly flag which specific mechanics (qi deviation, the
tribulation-style trial) are fictional convention rather than documented
practice, consistent with the standard set in Batch 3 and 6. The two
systemic-consequences depth records correctly cite the same underlying
Rowe/craft-failures-research sources as the original general record rather
than inventing new support for what is explicitly framed as elaboration of
existing material. No un-sourced substantive claims found.

## Batch 12 audit (Family B trope cluster, second pass)

The fatigue-cluster record (`craft.trope.fatigue.overused-litrpg-trope-
cluster`) received the most careful review of any single record in this
production run, per the voice standard's explicit guidance on this exact
kind of material. It is built on a single source
([[src.oster.overused-tropes]]) already marked weak/single-author-opinion
in `sources.yml`; the record itself repeats that caveat rather than
letting the aggregated framing imply broader support. It avoids "this
trope is bad" language throughout, names a specific, distinct mechanism
for each convention's fatigue risk rather than a blanket judgment, and
explicitly declines to resolve the tension between commercial success and
reported fatigue — consistent with the voice standard's instruction to
avoid treating popularity as proof of quality or fatigue as proof of
failure. This record should be a priority read for the author's first
editorial pass given its subject matter's sensitivity, flagged here and in
`qa/unresolved-claims.md`. The remaining eleven records mostly carry
`source_confidence: limited` (nine of twelve), continuing this batch
family's pattern of drafting from first-principles craft reasoning
informed by the broader research documents where no dedicated genre-
convention craft source exists — each flagged explicitly rather than
borrowing confidence. No un-sourced substantive claims found; one minor
drafting typo (a duplicated word) was caught and fixed within this batch.

## Watch items carried forward

- Every LitRPG-platform quantitative claim (posting cadence, Rising Stars
  correlations, launch-strategy splits) traces to two Chapter Chronicles
  blog posts from the same vendor. This is a real single-source concentration
  risk for Family C practice/dashboard-adjacent records; flag in
  `qa/unresolved-claims.md` and avoid stacking multiple records that treat
  this vendor as independent corroboration of itself.

## Whole-corpus audit pass A (2026-09-05) — overstated confidence marks

The holistic audit (`qa/audit_corpus.py`, findings in
`qa/duplication-report.md`) cross-checked every record's declared
`source_confidence` against how many non-synthesis sources it actually
cites. Forty-nine records cite at most one; forty-four of those correctly
declare `limited`, which is the deliberately logged Family B pattern.

**Five declare `mixed` on a single source.** `mixed` implies support drawn
from more than one place, so these overstate their footing and should be
corrected to `limited` — or given a second source if one exists:

| record | sources cited | declared |
|---|---|---|
| `craft.general.plot.negative-space-problems-power-cannot-solve` | 1 | mixed |
| `craft.general.plot.reader-expectation-and-genre-signaling` | 1 | mixed |
| `craft.general.scene.scene-turns` | 1 | mixed |
| `craft.trope.role.trickster` | 1 | mixed |
| `craft.trope.structure.sacrifice-and-return` | 1 | mixed |

Three are Family A craft records where a second established craft source is
likely findable (scene turns and genre signaling especially); two are Family
B trope records that probably belong at `limited` alongside their siblings.
Prefer adding the source over downgrading the mark where a real second
source exists — but do not leave the mark as it stands.

Source-reuse distribution at 130 records: 36 distinct sources, 11 cited
exactly once, and the two internal research documents cited by 37 and 35
records respectively. That concentration is expected given how this corpus
was produced, but it means the internal research is load-bearing for roughly
half the library. The Batch 12 caution stands: internal research is not
independent corroboration of itself.

## Correction to the above (2026-09-05, remediation pass 2)

**The finding logged immediately above was wrong, and is retracted here
rather than quietly edited.** It reported five records as overstating their
support by declaring `source_confidence: mixed` while citing a single
source. Reading the five sourcing notes shows something different: each one
already explains, in its own text, exactly what the mixture is — a
well-supported principle extended by this drafting pass's synthesis,
adaptation, or transfer to a context the source does not itself address.

- `craft.general.scene.scene-turns` — McKee's value-shift model is widely
  taught, but its transfer from screenwriting to prose scenes is this pass's
  adaptation, and the note says so.
- `craft.general.plot.reader-expectation-and-genre-signaling` — the
  promise-and-expectation principle is established; the signaling taxonomy is
  this pass's synthesis.
- `craft.trope.role.trickster` — Propp's function-based framing is applied
  beyond the corpus he studied, explicitly and with the limit stated.
- `craft.general.plot.negative-space-problems-power-cannot-solve` — the
  practitioner-essay pattern is sourced; the dungeon-core modifier and the
  product angle are marked as synthesis and product note respectively.

The real defect was in the vocabulary, not the records: `mixed` had been
carrying two distinct meanings across the corpus — a mixture of *sources*
and a mixture of *sourced and synthesized claims* — with nothing saying
which applied where, so the value could not be read consistently. That is
now fixed at the definition level. The handoff's citation section defines
all four values explicitly (added 2026-09-05) and requires a `mixed` record's
sourcing note to state which kind of mixture it means. All four records above
already satisfy that requirement.

`qa/audit_corpus.py` was corrected to match: it now flags a single-source
`mixed` record only when the sourcing note does *not* explain the mixture,
rather than treating source count alone as the test.

### One genuine change

`craft.trope.structure.sacrifice-and-return` moved from `mixed` to
**`contested`**. Its own note already said the Campbell monomyth framework it
draws on is "contested by later scholarship as overgeneralized across
cultures" — which is the definition of `contested`, a statement about the
state of the evidence rather than about the record's usefulness. The record's
sourcing note now explains that distinction and says plainly that its
coaching value does not depend on the framework being universal.

Corpus-wide `source_confidence` after this pass: 65 mixed, 52 limited, 12
high, 1 contested.

**Standing caution, unchanged:** 44 records legitimately at `limited` with a
single source remain the corpus's largest sourcing weakness, and the two
internal research documents are still cited by 37 and 35 records
respectively. Neither is a labeling problem; both are research problems for
a later pass.

## Batch 13 (2026-09-05) — research-led sourcing

Batch 13 was drafted against sources located for the purpose rather than from
the existing registry, on an explicit decision to stop the single-source
count growing. Six sources were registered:

| id | what it supports |
|---|---|
| `src.book.burroway-writing-fiction` | setting and atmosphere as active craft, POV taxonomy, scene construction |
| `src.book.card-characters-and-viewpoint` | POV selection, costs of multiple viewpoints, reader attachment |
| `src.book.edgerton-hooked` | opening-page craft, surface versus story-worthy problem |
| `src.book.schell-art-of-game-design` | reward pacing, challenge-and-skill balance, teaching a system through play |
| `src.book.yee-proteus-paradox` | guild social structure, obligation, play becoming labor |
| `src.book.moretti-way-of-the-world` | the coming-of-age novel as a historically situated form |

Bibliographic details for all six were verified against publisher and library
records rather than written from memory.

Eleven of the twelve records cite three independent sources each. Corpus-wide
distinct sources in use rose from 36 to 43, and the internal research
documents' share fell accordingly, though they remain the two most-cited
sources at 37 records each.

### Two `limited` marks, both deliberate

- `craft.trope.setting.the-hub-and-home-base` cites three sources but is
  marked `limited`, not `mixed`, because none of them treats the hub as a
  *prose fiction* convention: Adams describes hub-and-spoke level design,
  Burroway supplies a general principle about recurring settings, and the
  genre observation is internal research. The record says so and names a
  later pass with serial-fiction or long-form-structure scholarship as the
  fix.
- `craft.trope.identity.amnesia-and-lost-memory` cites one source plus the
  synthesis marker. No dedicated craft or scholarly treatment of the amnesia
  convention was found. Rather than attach Card's characterization work to
  claims he does not make, the record cites him only for the attachment
  argument and marks everything else as synthesis.

### Disanalogies stated rather than smoothed over

Three records import game-design sources into prose craft, and each says
where the analogy breaks rather than letting the citation imply more than it
supports. The onboarding record is the clearest case: a game's player must
act to proceed while a reader only reads, so "learning by doing" becomes the
weaker "learning by consequence." The party record notes that Yee describes
real players in real games, not fictional depictions of them. This is the
`mixed` mark being used as the handoff now defines it — a supported principle
extended by this pass's synthesis, with the extension named.

## Batch 14 (2026-09-05) — three sources, four honest gaps

Three sources registered, bibliographic details verified before use:

| id | what it supports |
|---|---|
| `src.book.williams-style-clarity-and-grace` | sentence-level clarity as a structural property — subject placement, information order, end-weight |
| `src.book.browne-king-self-editing` | the developmental/line distinction, show-versus-tell at sentence level, editorial observation of common manuscript habits |
| `src.book.vorhaus-comic-toolbox` | comedy as constructible from identifiable components rather than innate |

Each carries a stated limit in its registry entry: Williams writes about
expository prose, not fiction; Browne and King write from one
commercial-editing tradition; Vorhaus writes for screen comedy. The records
using them repeat those limits rather than letting the citation imply more.

### Four `limited` marks, each with the gap named

Batch 14 has a higher proportion of `limited` records than Batch 13 (four of
twelve against two of twelve), and that is a property of the topics rather
than of the effort:

- `craft.system.binding.oaths-contracts-and-bindings` — Adams supports only
  the general principle that a rule-enforced constraint must be tested. The
  taxonomy, the characterization argument, the coercion edge case, and the
  legal-order consequences are synthesis. **Gap named:** medieval and
  folkloric literary scholarship on oath and vow, which exists and was not
  available to this pass.
- `craft.system.companion.summons-familiars-and-bonded-companions` — the
  game-design sources address companion units mechanically and say nothing
  about the record's actual question, which is whether a characterized
  companion is being written as a person or a possession.
- `craft.trope.setting.the-frontier-and-the-border-town` — **gap named:**
  frontier scholarship in American studies and Western-genre criticism, which
  addresses the displacement question this record raises and cannot cite.
- `craft.trope.structure.captivity-and-escape` — Booker is used only for the
  observation that the shape recurs, with his framework's contested status
  stated. **Gap named:** prison-narrative criticism.

The alternative in each case would have been to attach an adjacent source to
claims it does not make. The handoff forbids that, and these four records
would have looked better sourced and been less honest.

### Corpus sourcing after Batch 14

51 registered sources, 9 of them added across Batches 13 and 14. The internal
research documents remain the two most-cited, but their share continues to
fall as the registry grows. The standing weakness — records resting on a
single source — is now concentrated in exactly the places where the craft
literature is genuinely thin, which is a better position than having it
spread across topics that are well covered.
