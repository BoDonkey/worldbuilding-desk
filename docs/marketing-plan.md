# Marketing Plan — Worldbuilding Desk v1

Last updated: 2026-08-30 · Companion to `docs/road-to-market.md` Phases 5–6.

Grounded in `docs/archive/deep-research-report.md` (2026-05 market analysis).
Supersedes `docs/archive/brand-positioning.md`: the February "Consistency
Engine / commit blocked" framing predates the writing-first pivot — keep its
local-first and human-authority pillars, drop its enforcement language, which
now contradicts the product's soft-review principle.

## Category and Positioning

Category: **continuity-aware writing software for series fiction**.

One-sentence positioning:

> Worldbuilding Desk is a writing-first drafting tool that catches canon
> drift, reference mistakes, and story-state inconsistencies while you write.

Headline directions to test:

- Keep writing. Catch continuity mistakes before readers do.
- Your story bible should help while you draft, not wait in another tab.
- For series fiction that can't afford canon drift.
- Built for authors whose worlds have rules, not just notes.

## Audience (in order)

1. **System Architects** — LitRPG / progression / system-heavy fiction
   authors tracking levels, skills, inventory, and faction state across many
   chapters. Clearest pain, highest willingness to pay, the beachhead.
2. **Series Stewards** — indie fantasy/SF authors with multi-book canon
   burden. Canon review matters more to them than state machines.
3. **Serial Sprinters** — Royal Road / web-fiction authors publishing fast,
   whose readers catch contradictions in the comments.

General novelists are a later expansion market, not a launch market.
Narrative designers are not a wedge.

## Messaging Pillars

1. **Flow-preserving continuity.** Review flags, never blocks; suggestions
   are dismissible. "Like a linter for canon — except it never stops you
   writing." Precision over recall: a noisy tool is a dead tool.
2. **Your world, one connected workspace.** The World Bible grows from the
   manuscript; lore remains useful in the moment of drafting instead of
   becoming a disconnected reference chore.
3. **Human authority.** AI proposes with evidence; nothing becomes canon
   without the author's explicit acceptance. No silent rewrites, ever.
4. **Private by design.** Manuscripts and project data live on the author's
   machine. Worldbuilding Desk sends no diagnostic telemetry and does not use
   author writing to train AI. Only the context needed for an explicitly
   author-invoked hosted request is sent to the provider they configure, or AI
   can run locally through Ollama. Provider retention and training claims must
   be qualified against that provider's current API terms. This is a major
   selling point and should appear beside the workflow promise, supported by a
   clear data-flow explanation rather than an absolute offline claim.
5. **Craft coaching grounded in the author's draft.** When requested, the
   coach pairs a vetted craft pattern with cited manuscript evidence. It never
   runs in the background and never presents its opinion as canon.

Do **not** say: "AI writing assistant," "AI co-author," "all-in-one authoring
IDE," "worldbuilding database," "project management for writers," or anything
implying autonomous writing. Frame every generative feature as draft support
the author reviews.

Also do not say `your writing never leaves your computer` without the hosted-
provider qualification. Preferred proof points:

- Stored locally by default.
- No diagnostic telemetry.
- Your writing is not used by Worldbuilding Desk to train AI.
- Hosted AI runs only when you ask and uses the provider you configure.
- Ollama keeps AI requests on your computer.

## Pricing

One-time purchase with a 14–30 day full-featured trial, via a
merchant-of-record (Paddle or Creem; provider evaluation remains open under
road-to-market Slice 5.7). Anchors from the research:
non-generative writing tools cluster at $4–15/mo subscription or $60–150
one-time (Scrivener ≈ $60). BYOK means zero AI COGS, so one-time works.

- Launch price hypothesis: **$59–79**, with an introductory beta-cohort
  discount and a public launch discount window.
- Keep a future door open for an optional paid tier (hosted convenience AI,
  sync, or collaboration) — do not promise it at launch.

## Channels

- **Beta recruitment (road-to-market 6.1):** r/litrpg, r/ProgressionFantasy,
  r/fantasywriters, LitRPG Facebook groups, Royal Road author community
  forums, and direct outreach to a handful of mid-list LitRPG authors.
  Personal invitations beat broadcast posts.
- **Launch:** landing page with a 60–90 second demo video showing the core
  loop (write → passive flag → accept alias → assistant answers from canon);
  Product Hunt is optional and secondary — the niche communities above matter
  more. Consider itch.io as a discovery channel alongside direct sales.
- **Proof content:** "caught X errors in a 300k-word series" style
  case studies from beta authors are the single strongest asset; collect
  permission and numbers during beta.
- Author-newsletter sponsorships and podcast appearances (LitRPG podcasts,
  self-publishing shows) after launch, funded only if early conversion
  supports it.

### Post-launch experiments (from 2026-09-12 external research, unscheduled)

- **Job-specific search content over "worldbuilding software."** Free,
  small, deterministic web tools (a timeline validator, a fictional-calendar
  calculator, a magic-system consistency checker) that hand off to the
  product. Only after launch, only if the deterministic services can be
  packaged for the web without forking logic, and only with claims that match
  product truth. The research's competitor traffic figures are unverified and
  must not be reused.
- **Recurring community challenge with a downloadable starter project.** Run
  in the niche communities above with a shareable project or character package
  as the artifact. No hosted sharing, accounts, or public pages; those
  contradict the privacy pillar.
- **Portability as a headline promise** once roadmap 4.29 lands: readable
  Markdown/CSV export plus the full backup zip, with the schema published.

## Demo Narrative

Every demo, video, and screenshot sequence shows, in order: (1) open the app
and just write; (2) a soft underline appears on an unknown name — no modal,
no block; (3) a quick, editable review turns it into canon or an alias; (4)
the assistant answers a story question by prioritizing accepted canon and
clearly distinguishing any supporting Source Notes; (5) optional: a character
sheet replaying state at a chosen scene, for the LitRPG audience; (6) an
author-triggered coach note pairing one vetted pattern with cited scenes. The
demo includes a brief, accurate data-flow card distinguishing local storage,
local Ollama, and explicitly invoked hosted providers.

## Sequencing

Marketing work stays behind product truth: landing-page claims must describe
implemented, verified behavior. Trust dogfooding is now the active checkpoint
before Phase 5; its triage determines which behaviors are safe to demonstrate
or claim. Quantified performance claims and case studies require dogfood or
beta evidence. Order: dogfood + triage (1.1) → landing page + demo video (5.9)
→ beta recruitment copy (with 6.1) → case studies from beta (during 6.2) →
launch announcement (6.4).
