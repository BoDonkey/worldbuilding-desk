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
