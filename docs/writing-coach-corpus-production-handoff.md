# Writing Coach Corpus — Content Production Handoff

**Status:** active working brief for the parallel content track of roadmap
Slice 4.18  
**Created:** 2026-08-30  
**Audience:** a research-capable writing agent producing draft craft-library
content for later author review  
**Authority:** this document is a production brief, not a product authority or
parallel roadmap. `docs/road-to-market.md` remains authoritative for scope and
execution status; `docs/domain-model.md` and `docs/architecture-review.md`
govern trust, retrieval, and privacy boundaries.

## Assignment

Produce a broad, useful, well-sourced library of writing-coach documents. The
library should teach general fiction craft, explain common tropes and
conventions without treating them as rules, and help authors reason about RPG
and progression-system mechanics such as mana, qi, cultivation realms,
classes, skills, resources, advancement, combat, crafting, and economies.

The target for this production pass is **at least 180 draft documents**:

- 60 general-fiction craft documents
- 60 trope and convention documents
- 60 RPG/progression-system documents

Treat 180 as a coverage target, not permission to pad the set. Merge entries
that would be near-duplicates. Split an entry when its variants create
meaningfully different reader promises, failure modes, or coaching advice.
Record genuine coverage gaps rather than inventing weak material. If time and
source quality permit, extend the corpus beyond 180 with comparison guides and
subgenre modifiers.

This is not an encyclopedia project. Every document must help a coach do at
least one of the following:

1. teach an unfamiliar craft concept;
2. ask a better diagnostic question about a draft;
3. explain the tradeoffs of a trope or convention;
4. compare design choices without prescribing one correct answer; or
5. suggest specific revision experiments while protecting author intent.

## Read Before Writing

Read these files in order before creating corpus content:

1. `docs/README.md`
2. `PROJECT_STATUS.md`
3. `docs/road-to-market.md`, especially Slices 4.17–4.20
4. `docs/domain-model.md`, especially §6
5. `docs/architecture-review.md`, especially Privacy and Data Egress and the
   craft-library boundary
6. `docs/research-litrpg-genre.md`
7. `docs/research-litrpg-craft-failures.md`

The two research documents are starting evidence, not settled truth. Correct
them where stronger sources disagree. Preserve disagreements and uncertainty
instead of resolving them through confident prose.

## Non-Negotiable Product Boundaries

- Craft material is instructional reference, never canon, manuscript evidence,
  a Source Note, or a factual claim about the author's world.
- A library entry must never claim that it inspected an author's manuscript.
  The future coach combines library guidance with separately cited manuscript
  evidence only after an explicit author request.
- Models propose. Deterministic code validates. Authors approve. Coaching is
  read-only unless a separate save/apply proposal is explicitly approved.
- `deterministic` means the complete observation can be computed from explicit
  stored inputs. Semantic judgments about tension, agency, payoff, relevance,
  motivation, or whether a power would solve a problem are normally
  `model-assisted`.
- Absence of a keyword is not proof that a narrative quality is absent.
- `practice` material teaches an author behavior or publishing practice and
  must not imply that the manuscript was checked for it.
- Corpus research must not contain user manuscripts, private project data,
  credentials, or local diagnostics. Use public sources only.
- Do not add telemetry, hosted services, runtime dependencies, retrieval code,
  embeddings, or packaged build artifacts during this content pass.
- Do not update `author_vetted` to true. Only the product author can do that.
- Do not mark Slice 4.18 complete or alter its status-board row.

## Working Location and Deliverables

Create draft corpus work beneath:

```text
content/craft-library/working/
  README.md
  catalog.yml
  sources.yml
  general/
  tropes/
  systems/
  comparisons/
  profiles/
  qa/
    coverage-matrix.md
    duplication-report.md
    citation-audit.md
    unresolved-claims.md
```

Do not guess the final runtime packaging shape. Slice 4.17 owns that contract.
The working files should be easy to review and convert once its schema is
available. If 4.17 establishes a compatible source schema before this work is
finished, adapt the working files to it while retaining readable Markdown
bodies and version-control-friendly metadata.

`catalog.yml` is the complete inventory and should include each record's ID,
title, family, document type, version, detectability, scopes, applicability,
author-vetted status, and file path. `sources.yml` is a deduplicated source
registry. Use stable source IDs from it in individual documents.

## Provisional Record Shape

Use Markdown with YAML front matter until the 4.17 schema supersedes this
provisional form. Every draft must contain at least:

```yaml
id: craft.general.pacing.tension-release-cycles
version: 1
title: Tension and release cycles
document_type: pattern
family: general
summary: One or two sentences describing the coaching value.
author_vetted: false
detectability: model-assisted
scopes:
  - scene
  - chapter
applicability:
  genres:
    - general-fiction
  subgenres: []
exclusions: []
modifiers: []
aliases: []
tags: []
related:
  - craft.general.pacing.scene-sequel-rhythm
source_ids: []
source_confidence: mixed
```

Allowed `document_type` values for this pass:

- `pattern` — a craft principle or recurring failure mode
- `trope` — a recognizable narrative convention and its useful variations
- `system-mechanic` — a building block of an RPG/progression system
- `comparison` — a choice framework such as qi versus mana
- `subgenre-profile` — modifiers that change how other records apply

Allowed `detectability` values are `deterministic`, `model-assisted`, and
`practice`. Allowed scopes are `selection`, `scene`, `chapter`, `manuscript`,
`series`, and `practice`. Multiple scopes are allowed when each is genuinely
supported.

Use namespaced, lowercase, stable IDs. An ID must describe the concept rather
than its current title so that wording can evolve without breaking links. Do
not recycle retired IDs.

## Related-Link Policy

**Added 2026-09-05, after whole-corpus audit pass A.** The first twelve
batches drafted `related` as an informal quota of about two links each,
chosen from whatever already existed on disk. That produced a graph pointing
backward in batch order: 62 of 130 records had nothing linking to them, only
27 pairs were mutual, and the twelve subgenre profiles had no links to each
other at all. A coach traversing `related` could not reach half the library.
The following rules replace that convention and apply to every record,
including the 130 already drafted (repaired in the remediation pass logged in
`content/craft-library/working/qa/duplication-report.md`).

1. **Links are mutual.** If A names B, B names A. A relationship between two
   records is a property of the pair, not of whichever one happened to be
   drafted second. Adding a link to a new record means editing the older one
   too.
2. **At least five links per record.** There is no maximum. Foundational
   records legitimately accumulate more — capping them would break rule 1 —
   and a high inbound count is a useful signal that a record is load-bearing.
3. **At least one link crosses families.** A record that only points inside
   its own family teaches an author nothing about how craft, trope, and
   system questions bear on each other. These bridges are the corpus's most
   valuable links and were its scarcest.
4. **Subgenre profiles link to each other**, at least twice. Choosing between
   adjacent subgenres is a decision authors actually make, and a profile that
   only points at the records it modifies cannot support it.
5. **Relevance beats quota.** A link must carry a real coaching relationship
   a person could explain in a sentence. If a record cannot reach five
   genuinely related neighbours, log the shortfall in the coverage matrix
   rather than padding with a weak link — the shortfall usually means a
   missing record, which is useful to know.

`content/craft-library/working/qa/relink.py` proposes a graph under these
rules and reports violations; every edge it proposes is reviewed by hand
before it is applied.

## Required Body Structure

Write each document in a warm, practical coaching voice. Prefer questions and
tradeoffs over commandments. A typical entry should be 700–1,400 words; a
focused entry may be shorter, and a comparison may be as long as 1,800 words
when the extra length earns its place.

Each body must include:

1. **What it is** — a clear, compact definition.
2. **Why readers may care** — the experience or promise it can create.
3. **Common forms and variants** — including inversions where useful.
4. **What it can look like on the page** — observable signals, not a claim
   that every signal proves the pattern.
5. **Common failure modes** — including overuse, underdevelopment, and genre
   mismatch where applicable.
6. **Questions for the author** — diagnostic questions that preserve intent.
7. **Revision or design experiments** — two to five concrete options, not
   automatic rewrites.
8. **When this advice does not apply** — counterexamples, exclusions, and
   deliberate uses.
9. **Evidence and detection limits** — what inputs a future coach would need,
   what can be measured, what needs interpretation, and what it cannot know.
10. **Original micro-examples** — short examples created for this library,
    never copied from or written in the recognizable voice of a living author.
11. **Sources and confidence notes** — identify which claims each source
    supports and distinguish research, practitioner consensus, reader
    preference, and the writer's own synthesis.

System-mechanic and comparison records must additionally cover:

- narrative promise and emotional texture;
- source, storage, access, expenditure, recovery, and limits;
- progression and failure behavior;
- visibility to characters and readers;
- social, economic, political, and ecological consequences;
- exploits, edge cases, and costs;
- interaction with other mechanics;
- ways the mechanic can generate plot rather than merely decorate it; and
- subgenre or cultural assumptions that should not be treated as universal.

Trope records must additionally distinguish **presence** from **quality**. A
trope being recognizable does not mean it is stale, harmful, or badly
executed. Explain reader promise, sources of fatigue, freshening strategies,
inversions, and cases where straightforward execution is the correct choice.

## Coverage Plan

### Family A — General fiction craft: 60 documents

Cover the foundations a newer writer may not know to ask about:

- premise, dramatic question, reader promise, theme, controlling idea, and
  story-level causality;
- plot escalation, reversals, complications, midpoint change, climax,
  denouement, setup/payoff, foreshadowing, and earned resolution;
- scene goals, conflict, outcomes, scene turns, sequels/reflection, entry/exit
  points, exposition, transitions, and chapter architecture;
- tension, suspense, uncertainty, stakes, urgency, pressure, mystery,
  anticipation, release, breathing room, pacing, and escalation ceilings;
- character want/need, agency, motivation, values, contradiction, internal and
  external arcs, relationships, antagonistic force, supporting-cast purpose,
  and meaningful choice;
- point of view, psychic distance, voice, interiority, information control,
  dialogue, subtext, description, specificity, and narrative summary;
- revision triage, developmental versus line concerns, beta-reader signal,
  continuity passes, and protecting the intended reader experience.

Avoid presenting one beat sheet or one pacing curve as the universal shape of
a novel. Where schools of craft disagree, write a comparison or label the
approach rather than collapsing the disagreement.

### Family B — Tropes and conventions: 60 documents

Build a representative, extensible taxonomy rather than claiming to document
every trope. Include a balanced range across:

- protagonist and antagonist roles;
- mentors, rivals, companions, found family, heirs, chosen figures, reluctant
  heroes, antiheroes, tricksters, and redeemed enemies;
- romance and relationship conventions, handled inclusively and without
  assuming one relationship model;
- quests, trials, tournaments, heists, mysteries, prophecies, revenge,
  survival, transformation, return, sacrifice, and succession;
- hidden identity, secret heritage, betrayal, resurrection, time loops,
  portal/other-world stories, academy stories, faction conflict, and war;
- horror, mystery, fantasy, science-fiction, serial-fiction, and progression
  conventions that materially change reader expectations;
- common inversions and combinations, especially where two familiar elements
  produce a different promise together; and
- fatigue-sensitive conventions, discussed descriptively rather than as a
  blacklist.

Do not reproduce TV Tropes pages, fan wikis, trope-list articles, or their
distinctive wording/taxonomies. Generic names may be used where they are truly
common vocabulary. Otherwise create a plain descriptive label and cite the
underlying craft or genre discussion.

### Family C — RPG and progression mechanics: 60 documents

Cover mechanics as narrative systems, not only as game rules:

- resource models: mana, qi/chi, stamina, health, rage, focus, faith/divine
  favor, psionics, soul/spirit, blood, life force, cooldowns, charges,
  sacrifices, environmental power, and hybrid resources;
- comparisons: qi versus mana; renewable versus finite resources; internal
  versus ambient power; pools versus thresholds; hard numbers versus named
  tiers; visible versus hidden systems; universal versus class-bound access;
- cultivation: realms, bottlenecks, breakthroughs, foundations, meridians,
  cores/dantians, tribulations, insights/dao, techniques, body cultivation,
  soul cultivation, alchemy, sects, inheritance, deviation, and lifespan;
- character architecture: attributes, classes, levels, skills, perks, feats,
  talents, affinities, resistances, titles, bloodlines, multiclassing,
  specialization, respecs, and soft versus hard caps;
- advancement: experience sources, thresholds, milestone growth, training,
  diminishing returns, rarity gates, horizontal versus vertical growth,
  power ceilings, catch-up mechanics, and costs of advancement;
- encounters: action economy, initiative, range, positioning, damage,
  defenses, healing, death, respawn, status effects, crowd control, counters,
  teamwork, and information asymmetry;
- objects and economies: loot, rarity, crafting, enchanting, durability,
  inventory, encumbrance, currencies, markets, scarcity, sinks, inflation,
  quest rewards, and ownership; and
- systemic consequences: institutions, labor, warfare, medicine, religion,
  inequality, crime, ecology, education, governance, and what ordinary people
  do with the same rules.

Treat cultivation terminology with particular care. Distinguish historical,
religious, philosophical, linguistic, and modern genre usages. Do not flatten
Chinese concepts into interchangeable game statistics, and do not present one
novel tradition or translated term as universal. When using `qi`, explain the
chosen transliteration and context. Comparison documents should help an author
choose the experience they want, not declare mana and qi to be Western and
Eastern versions of the same fuel bar.

## Initial Priority Batches

Work in batches of roughly 10–12 documents. Finish the inventory, sources, and
QA notes for one batch before beginning the next. This keeps partially
completed work reviewable if the session ends.

### Batch 1 — Tranche-1 alignment

Draft the eight records already proposed in
`docs/research-litrpg-craft-failures.md` Part C:

1. decorative chapter test;
2. advancement rate;
3. stat-block density;
4. fake progression;
5. no-gap posting practice;
6. power as sole motivation;
7. negative space/problems power cannot solve; and
8. promise consistency.

These are candidates, not pre-approved conclusions. Correct the research,
choose honest detectability, and keep `author_vetted: false`.

### Batch 2 — General coaching foundation

Prioritize tension/release cycles, scene goal-conflict-outcome, scene turns,
causal escalation, setup/payoff, reader promise, character agency, motivation,
stakes, climax/resolution, pacing across scales, and POV/information control.

### Batch 3 — System choice foundation

Prioritize qi versus mana, resource lifecycle design, hard numbers versus named
tiers, visible versus hidden systems, cultivation realms and breakthroughs,
classes versus skill-based growth, vertical versus horizontal progression,
costs and limits, action economy, death/respawn, crafting/economy loops, and
systemic social consequences.

### Remaining batches

Use the coverage matrix to fill the three 60-document families evenly. Do not
write sixty entries in one family before validating that the record shape and
voice work in the other two. Alternate families and add comparison records
where authors face a genuine design decision.

## Research and Citation Standard

- Research claims before drafting. Prefer primary texts, academic or cultural
  scholarship, established craft works, and attributable practitioner essays.
  Use reader discussions as evidence of reader experience, not universal fact.
- Use at least two independent sources for a substantive prescriptive or
  historical claim. Use three or more when a claim is culturally sensitive,
  contested, quantitative, or central to the document.
- Record publication title, author/organization, URL or bibliographic details,
  publication date when available, access date for web sources, source type,
  and a note describing the supported claims.
- Prefer paraphrase. Use quotations only when the exact wording is necessary,
  keep them short, and attribute them directly.
- Never copy an article, book passage, database entry, wiki page, course, or
  another coaching library into the corpus. Do not imitate a living author's
  voice or build examples from recognizable copyrighted characters and worlds.
- Mark synthesis as synthesis. Do not attach a citation to a stronger claim
  than the source makes.
- Quantitative platform or market claims are time-sensitive. Include their
  date, population, methodology limits, and confidence; otherwise omit them.
- For disputed terms or traditions, surface the disagreement and define the
  usage adopted by the record.

Use `source_confidence` values `high`, `mixed`, `limited`, or `contested`.
Confidence describes the support for the document's claims, not how strongly
the advice should be delivered.

**Clarified 2026-09-05.** An audit found the first twelve batches using
`mixed` in two different senses without saying which, so the value could not
be read consistently across the corpus. The four values mean:

- `high` — the record's substantive claims are supported by two or more
  independent, established sources that make the claims directly.
- `mixed` — support is uneven *within the record*. This covers two distinct
  situations, and **the sourcing note must say which applies**: either the
  record draws on several sources of differing strength, or a well-supported
  principle has been extended by this drafting pass's own synthesis,
  adaptation, or transfer to a context the source does not itself address.
  A single-source record can legitimately be `mixed` under the second sense
  — a widely taught screenwriting concept adapted to prose, for instance —
  but only if it says so.
- `limited` — the record rests on one source, on sources weaker than the
  claims would ideally have, or largely on first-principles craft reasoning,
  and no better support was available to the drafting pass.
- `contested` — the underlying source or framework is itself disputed by
  later or competing scholarship. This is a statement about the state of the
  evidence, not about the record's usefulness: a contested framework can
  still be a useful lens, and the record should present it as one.

A record's `source_confidence` is a claim about evidence that a reader may
check, so it should be readable from the sourcing note alone without
counting entries in `source_ids`.

## Voice and Coaching Standard

The voice should feel like an observant, well-read coach working beside an
author—not a grader, content mill, or rules engine.

Prefer:

- “A reader may experience…”
- “One question to test is…”
- “If your intended effect is X, consider…”
- “This convention often promises…”
- “The available evidence cannot determine…”

Avoid:

- “Every novel must…”
- “This trope is bad/lazy/problematic” without a precise reason and context
- “Your scene fails…”
- unsupported numerical targets presented as laws
- diagnosing intent, culture, identity, or reader response from keywords
- treating popularity as proof of quality or fatigue as proof of failure

Offer options with different costs. A useful intervention says what it may
improve, what it may weaken, and what author intention would make it a poor
fit.

## Batch QA Checklist

After every batch:

1. validate YAML/front matter and unique IDs;
2. update `catalog.yml` and the coverage matrix;
3. resolve or log every broken `related` and `source_ids` reference;
4. check the batch for duplicated concepts and substantially repeated prose;
5. audit each factual, historical, cultural, and quantitative claim against
   its cited support;
6. confirm every file remains `author_vetted: false`;
7. confirm `detectability` and scopes match the actual evidence requirements;
8. verify that advice includes exclusions, counterexamples, and author-choice
   language;
9. search for copied phrasing, living-author imitation, and copyrighted proper
   nouns in examples;
10. note unresolved disagreements or weak sourcing rather than hiding them;
11. run repository formatting/link checks that apply without adding new
    dependencies; and
12. summarize the batch in `content/craft-library/working/README.md`.

Periodically compare new work against the entire catalog, not only the current
batch. A large corpus becomes less useful when synonyms create competing
entries with no declared relationship.

## Definition of Done for This Production Pass

The handoff is complete when:

- at least 180 useful draft records exist, with approximately 60 in each core
  family, or a clearly documented source-quality reason explains a shortfall;
- every record has unique metadata, the required body sections, citations,
  honest confidence, applicability, exclusions/modifiers, detectability, scope,
  and related-record links where relevant;
- `catalog.yml` and `sources.yml` match the files on disk;
- the QA folder reports coverage, duplicates/merges, citation weaknesses, and
  unresolved claims;
- the eight tranche-1 candidates are clearly identified for the author's first
  review;
- no record is marked author-vetted;
- no runtime code, project retrieval, user data, telemetry, embeddings, or
  final package has been added; and
- a final handoff summary reports counts by family/type/scope/detectability,
  files created or changed, strongest coverage, remaining gaps, questionable
  sources, and the recommended author-review order.

Do not equate completion of this production pass with completion of roadmap
Slice 4.18. The slice still requires the 4.17 schema, author source and wording
review, schema validation, retrieval tests, citation rendering, and the normal
claim/verify/commit/close workflow.

## Ready-to-Use Opening Prompt

Use this concise prompt when starting the content-production session:

> Read `AGENTS.md` and then execute
> `docs/writing-coach-corpus-production-handoff.md`. This is a large,
> multi-batch content-production task, not a planning exercise. Begin with the
> required reading and corpus inventory, then draft and QA the batches in the
> prescribed alternating order. Continue through at least 180 useful records
> while credits and context allow. Keep every record `author_vetted: false`,
> preserve source uncertainty, checkpoint each completed batch in the working
> README, and do not modify runtime code, embeddings, telemetry, or roadmap
> status. If interrupted, leave the catalog and README as an exact resume
> point.
