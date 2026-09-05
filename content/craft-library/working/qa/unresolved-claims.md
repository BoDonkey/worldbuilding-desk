# Unresolved Claims and Open Disagreements

**Status:** running tracker. Purpose: record genuine coverage gaps, weak
sourcing, and unresolved disagreements rather than hiding them behind
confident prose, per the handoff's non-negotiable boundaries.

## Carried forward from the research inputs

1. **Chapter length has no settled optimum.** Both cited platform-convention
   sources cluster around two different ranges (1,500–2,500 and ~4,000
   words) with no resolution. Any future record on chapter length must teach
   the floor (below ~1,500 reads as short) and explicitly decline to name an
   optimum, per `docs/research-litrpg-craft-failures.md` Part D.
2. **Rising Stars rating-to-rank correlation is near zero** (r = −0.17 main
   list, r = −0.03 genre lists), contradicting an earlier, weaker claim about
   engagement ratio. Any future record touching reader ratings or engagement
   metrics must use the corrected figures, not the superseded ratio claim.
3. **How opinionated should trope coaching be about commercially successful
   but fatigue-inducing conventions** (per `research-litrpg-craft-failures.md`
   Part B4/B5, the P23 trope cluster)? Addressed, not resolved, in Batch 12:
   `tropes/craft.trope.fatigue.overused-litrpg-trope-cluster.md` deliberately
   holds "fatigued" and "commercially successful" as both true for each of
   the five conventions rather than picking a side. The underlying question
   — whether that's the right editorial stance — remains open for the
   author's review; this record is a proposed answer in practice, not a
   settled policy.
4. **Does promise consistency deserve to be the library's organizing idea
   rather than one entry among many?** Open question from the source
   research, inherited unresolved into
   `craft.general.promise.promise-consistency`. Worth author attention during
   review: if promise consistency is promoted, several other records may
   need `related` links added retroactively.

## Single-source concentration risk

The Chapter Chronicles vendor (two blog posts, one covering series-longevity
qualitative coding and one covering a 459-fiction Rising Stars dataset) is
currently the sole quantitative source behind: the reader-side failure
hierarchy, the series-longevity/promise-consistency link, no-gap posting,
launch-strategy-by-target-list, and the rating-to-rank correction. None of
these datasets are independently reproducible from the published posts. This
drafting pass treats them as directional leads, sets `source_confidence` to
`limited` where a record rests primarily on this vendor, and avoids ever
presenting one Chapter Chronicles post as independent corroboration of the
other. A stronger secondary source (an academic study of serialized-fiction
retention, or a second platform's own analytics disclosure) would
meaningfully improve confidence here; none was available to this pass.

## Cultivation terminology — flagged for extra care, not yet drafted

Per the handoff's explicit instruction, cultivation/qi records (planned for
Batch 3+) require distinguishing historical Daoist internal-alchemy usage
(`src.book.kohn-introducing-daoism`, `src.wikipedia.neidan`) from modern
xianxia/progression-fantasy genre convention (`src.wikipedia.xianxia`, the
craft-failures research). No cultivation record has been drafted yet as of
Batch 1; this entry is a forward flag so drafting starts from the
distinction rather than arriving at it after the fact.

## Subgenre-profile single-source concentration — flagged in Batch 5, complete as of Batch 6

All 12 subgenre-profile records (the family is now complete) trace their
structural claims to a single internal document,
`docs/research-litrpg-genre.md`, which is itself a synthesis of several
external sources of varying quality (see that document's own source
ledger). This is a different concentration risk from the Chapter Chronicles
vendor dependency above — here the risk is that the entire subgenre-profile
family shares one drafting-stage synthesis as its evidentiary root, so an
error or unexamined assumption in that synthesis would propagate across all
twelve profiles rather than staying contained to one record. An author
revision pass should treat the whole `profiles/` directory as a unit when
checking this concentration, not profile by profile.

## Mana's etymology — sourcing gap flagged in Batch 3 — **RESOLVED 2026-09-05**

**Original entry, kept for the record:**

> `craft.comparison.resource.qi-versus-mana` states that "mana" descends from
> a Polynesian concept substantially reshaped by 20th-century occultism and
> then games. This is treated as general, widely corroborated background
> knowledge in craft and games-studies discussion, but no source in
> `sources.yml` directly supports it. Flagged in the record's own sourcing
> note; before author sign-off, either add a dedicated academic or
> lexicographic source or soften the claim to match what's actually
> supportable.

**Resolution:** sourced, and corrected — the claim turned out to be wrong on
both halves, not merely unsupported.

- "Polynesian" was inaccurate. Mana is an *Austronesian* word appearing
  across languages spanning Polynesia, Melanesia, and Micronesia — regions
  Europeans invented and imposed, and which the concept crosses. Calling it
  Polynesian repeats a colonial division.
- "20th-century occultism" was the wrong route. The documented chain runs
  Codrington's 1891 ethnography → comparative religion, where Eliade
  anthologized Codrington for a mass American readership → the 1960s
  Californian counterculture → tabletop spell-point systems → video games.
  Occultism enters late and narrowly, through the neo-pagan designers of some
  D&D derivatives, rather than as the main vector.

Four sources registered: [[src.article.golub-history-of-mana]] (read in
full), [[src.chapter.golub-peterson-mana-video-game]] (its peer-reviewed
version), [[src.book.codrington-melanesians]], and
[[src.article.keesing-rethinking-mana]]. The last three were verified
bibliographically rather than read in full, which is stated in both the
registry entries and the record itself.

The correction also strengthened the record's own argument. Keesing's case is
that mana in Proto-Oceanic was a stative verb — to be efficacious, to work —
naming a condition inferred from an outcome rather than a substance anyone
holds; Codrington's reading of it as a noun is what travelled. The fuel bar
is therefore a *double* transformation, and the record now says so, which
makes its warning against flattening qi and mana concrete rather than
merely asserted.

One thing is deliberately left unresolved: whether gaming's adoption of the
word constitutes appropriation. Golub declines to settle it, holding that
players borrowed it, likely exoticized it, and also made it genuinely their
own. The record takes the same position rather than issuing a verdict, per
the handoff's instruction to preserve disagreement rather than resolve it
through confident prose.

## LitRPGTools taxonomy — promotional-placement caution

`src.litrpgtools.subgenre-guide` is a commercial property with affiliate
links and one recommended author appearing in nearly every subgenre section.
Any record drawing on its twelve-category taxonomy should use the category
skeleton only (corroborated independently by
`src.litrpgcritic.subgenre-explainers` and `src.wikipedia.progression-fantasy`)
and must never cite it for an author or series recommendation.
