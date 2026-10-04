# AI Scene Drafting and Text Provenance — Plan

**Status:** Accepted 2026-10-03 and scheduled as roadmap Slices 4.50–4.52.
Durable rules are folded into `docs/product-blueprint.md` (UX principle 4,
AI language) and `docs/domain-model.md` § 5; archive this plan once the
slices land.

**Author decisions already made (2026-10-03):** AI drafting is opt-in **per
project**, **off by default**, and covers **scene drafts only**. Watermark
removal is out of scope: the app will not strip or disguise provider
watermarks. Follow-up decisions the same day: the setting stays **quiet**
(no marketing change), character-scene inserts keep their current gate, and
all copy is **platform-neutral and non-judgmental** — drafting is a normal
choice, not a warning-laden one, and the product's assistive stance for
default projects is unchanged.

## Why

Some authors want AI to draft prose; others chose SagaSpine because it does
not. The product today is positioned firmly on the second side:
`product-blueprint.md` UX principle 4 ("AI is assistive … does not generate
large unsolicited chunks or replace the author's voice") and the marketing
plan's "do not say AI co-author". A per-project switch serves both groups
without changing what a default project does.

Two outside facts make provenance part of the same change:

- **Disclosure.** Some publishing platforms ask authors whether a book
  contains AI-generated text, and count text as AI-generated even after
  substantial human editing, while assisted work (brainstorming, grammar,
  refining the author's own text) is treated differently. Authors currently
  have no reliable record of which manuscript text came from a model.
  (Research note only; product copy stays platform-neutral.)
- **Watermarks.** Since 2 August 2026 the EU AI Act (Article 50) requires
  providers to mark generated text in a machine-readable way. Gemini text has
  carried SynthID since 2024, and Claude models released after 2 August 2026
  carry a SynthID-derived watermark on every surface, the API included. These
  are statistical patterns in word choice, not hidden characters, so they
  cannot be filtered out, only paraphrased away. Open-weight models run
  locally through Ollama are not watermarked by a provider.

So the honest, useful feature is the reverse of watermark stripping: the app
knows exactly which text a model wrote, and tells the author.

## What already writes AI prose into the manuscript

| Path | Gate today | Under this plan |
| --- | --- | --- |
| Assistant scene revision (replace selection, or append) | AI consultation on | unchanged gate; output marked as AI text |
| Character lab: character scene, Insert at cursor (4.44) | AI consultation on | unchanged gate (author decision); output marked |
| **New: Draft this scene** | — | requires the new project setting; output marked |

## Design

### 1. Text provenance (applies to every path above)

- A TipTap mark, `aiText`, stored in scene HTML as
  `<span data-ai-text="…">`, carrying: origin (`scene-draft`,
  `scene-revision`, `character-scene`), provider, model, route kind
  (`private-local` / `hosted`, from `providerRoute.ts`), and timestamp.
- Applied by the app in the same undoable transaction that inserts the text.
  Never applied in the background and never applied to text the author
  typed.
- The mark is non-inclusive at its edges: typing next to AI text is the
  author's writing. Edits inside a marked span keep the mark, matching how
  platforms that ask treat edited AI text.
- **Mark as my writing**: the author can clear the mark from a selection. The
  app records nothing about why; the author owns that judgment.
- Subtle highlighting in the editor (theme tokens only) with a persisted
  **Show AI text / Hide AI text** toggle, on by default; the controls appear
  only in scenes that contain AI text. (Changed in 4.50 from "off once seen":
  a plain toggle is easier to understand.)
- **AI text report** (project level): words and passages marked per scene,
  by origin and provider. Copy is platform-neutral (no named store or
  publisher) and factual: it says what the app inserted, notes that some
  publishing platforms ask about AI-generated text, and leaves the judgment
  to the author. It is a record, not legal advice and not a detector.
- Export (Markdown, DOCX, EPUB) strips the marks by default; the backup ZIP
  keeps them. Storage is additive HTML, so no project schema migration is
  needed. An older app build would drop the marks when it re-saves a scene;
  the plan accepts that, since backups carry the app version.

### 2. Project setting: "Allow AI scene drafts"

- New `ProjectAISettings` field, default `false`, set in Settings → AI
  (advanced, not promoted in onboarding or marketing) with a plain,
  neutral description: the AI may draft whole scenes on request; drafts are
  previews until accepted; accepted text is marked as AI text. No warning
  dialogs or moralizing copy.
- Turning it off hides the drafting action and keeps existing marks and text
  untouched. Child projects do not inherit it; each project decides.
- Not offered while AI consultation is off.

### 3. Draft this scene

- Available only when the setting is on, from an **empty or near-empty
  scene** (Workspace, scene header) and from a Corkboard chapter card's
  linked scene. Not on populated scenes: rewriting existing prose stays the
  job of the reviewed revision flow.
- Inputs the author sees and can edit before sending: scene goal (or the
  chapter card summary), point-of-view character, characters present,
  setting, beats, target length, and optional notes. Grounding follows the
  character lab: World Bible records and accepted facts valid at that story
  point, dialogue styles, the previous scene's ending, and story state when
  game systems are on. Source Notes and other manuscript scenes are not sent
  unless the author adds them.
- Output appears in a preview with the same disclosure, consultation cost,
  Stop, and Regenerate pattern as the character lab. Nothing reaches the
  manuscript until **Insert into scene** (one undoable transaction, marked)
  or **Save to Scratchpad**.
- Drafts never write canon, state, or World Bible records. Facts in an
  accepted draft reach canon only through the normal consistency review,
  exactly as if the author had typed them.
- Respects the provider route: private-local, hosted, and the blocked Ollama
  routes behave as they do everywhere else (`docs/architecture-review.md`
  privacy section). Consultation accounting is unchanged.
- Length cap per request (default about 1,500 words) so a single run cannot
  produce a chapter.

### 4. Out of scope

- Removing, weakening, or disguising provider watermarks, including
  "humanizing" paraphrase passes.
- Continue-writing, whole-chapter, or whole-book generation.
- Detection of AI text the app did not insert (pasted text is unmarked; the
  report says so).
- Any change to marketing positioning: the setting is quiet.

## Proposed slices (provisional numbers)

| # | Slice | Size | Depends on |
| --- | --- | --- | --- |
| 4.50 | `aiText` provenance mark + marking on existing AI insert paths + Mark as my writing + export stripping | M | — |
| 4.51 | AI text report (project level) | S | 4.50 |
| 4.52 | "Allow AI scene drafts" project setting + Draft this scene (preview, insert, scratchpad) | M | 4.50 |

4.50 lands first so that no AI text, old path or new, enters a manuscript
unmarked. Each slice runs the full battery, Cypress for the routed surfaces,
and the close-out CI rule.

**Verification focus:** a mark is applied only inside the insert
transaction; typing adjacent to marked text is unmarked; undo removes text
and mark together; export output contains no `data-ai-text`; the backup
round-trip keeps marks; the drafting action is absent when the setting is
off or AI consultation is off; a draft never changes canon, state, or
records (store snapshot before/after, as in the character-lab specs).

## Decisions (2026-10-03)

1. **Positioning:** quiet. No marketing, onboarding, or landing-page change;
   default projects keep the assistive stance.
2. **Character scenes:** keep their current gate; their inserts are marked
   by 4.50 like every other AI insert.
3. **Report wording:** platform-neutral; no named platforms.

## Related, small, and independent

Some model output contains stray invisible characters (zero-width spaces,
narrow no-break spaces). They are not watermarks, but they cause odd spacing
and search misses. Normalizing them when the app inserts AI text is ordinary
text hygiene and can ride along with 4.50.
