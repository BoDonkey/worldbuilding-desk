# World Canvas — work-slice plan

Status: **accepted 2026-09-12; scheduled as roadmap slices 4.30–4.34
(WC-1–WC-5 in that order), to land before beta.** Dated 2026-09-12. Produced
from the planning prompt in `docs/world-canvas.md` after inspecting the
current World Bible, Source Notes, Scratchpad, canon-decision, onboarding,
navigation, and persistence code. The author accepted every recommended
default in § 8: the name "World Canvas", the dedicated `world_canvases`
record, the seven lenses as listed, a shared consultation budget (whose
model roadmap slice 4.39 settles before WC-4/4.33), and the guide entry on
all guide-marked projects. The status board in
`docs/road-to-market.md` is authoritative for execution; this document holds
the full prompts.

## 1. Product finding

The app already owns every container worldbuilding material needs:

| Container | What it is today | Code |
|---|---|---|
| Scratchpad | one free-text document per project, opened from a header button | `scratchpadStorage.ts`, `useWorkspaceScratchpad` |
| Source Notes | longform `LoreDocument`s with a fixed `kind` enum, links to World Bible records (`LoreDocumentLink`), and the only entry to extraction | `loreStorage.ts`, `services/lore/*` |
| World Bible | the single canon owner: categories, records, aliases, accepted `CanonicalFact`s, entity `links` | `WorldBibleRoute.tsx` (view modes `category` and `review`) |
| Canon Decisions | clustering and resolution of extracted proposals; the model is a reasoning aid only | `services/lore/canonDecision*` |
| Assistant capture | chat output becomes a draft Source Note through the 1.5 proposal surface, never canon | `sourceNoteCapture.ts`, `AIProposalPreview` |

What is missing is not storage but **framing**. Every surface starts from
"here is material, file it". Nothing asks the author what the world is for,
what strains it, or what is worth developing next, and nothing shows the
exploratory-to-canon gradient in one place. The World Bible rail's
`Onboarding` help panel is procedural ("choose a category, create a
record"), and the getting-started guide teaches write → capture → review,
which is right for a writer with a scene and wrong for a writer with only a
world in their head. Corkboard answers "what happens, in what order?" with a
derived, read-only dashboard beside authored chapter cards. World Canvas is
the lore-side counterpart: **authored premise, lenses, and questions beside
a derived view of what already exists.**

### Recommended IA

A third World Bible view mode, `canvas`, alongside `category` and `review`,
entered from a **World Canvas** item at the top of the category rail and
(optionally, WC-5) from the getting-started guide. Reasons, checked against
the blueprint's ownership rules:

- World Bible is "the single canonical record system"; the canvas is a
  lens over it and must never look like a second home for canon, so it lives
  inside that route rather than as a top-level destination or a `More` item.
- Lore Documents is "source material, not a second canon database"; the
  canvas is a thinking surface across Source Notes *and* canon, so it does
  not belong there either.
- The existing `viewMode` switch, category rail, and shared page chrome give
  it a place without new navigation entries; `More` badges are unaffected.

Naming: keep **World Canvas** as the working name. Author-facing
alternatives worth one line of consideration at implementation time: "World
Overview" (plainer, but suggests a read-only summary) and "Story World"
(warmer, but collides with the `Workspace`/`World Bible` pairing). Decide in
WC-1's commit; do not spend a slice on it.

## 2. Primary author journeys

1. **Blank project, world-first author.** Opens World Bible → World Canvas.
   Sees a premise field, seven optional lenses collapsed, and an empty
   questions list with one example. Writes a premise, opens two lenses,
   writes a few lines, adds three questions. Nothing else is required.
   Returns to Workspace and writes.
2. **Exploring a lens.** On the "factions and institutions" lens, chooses
   **Keep as Source Note**. A Source Note (`faction_notes`) is created with
   the lens text, back-linked from the lens, and opened for editing. Later,
   **Extract Candidates** on that note runs the existing pipeline; accepted
   entities and facts land in World Bible through Canon Decisions.
3. **Naming something.** The author types "the Cinder Compact" in a lens and
   chooses **Propose as canon**. World Bible's create-record form opens in
   the matching category with the name prefilled (a normal author-authored
   record, not a model write). The lens note gains a link to the new record.
4. **Brainstorming.** With a provider configured, the author chooses **Ask
   for tensions and questions** on a lens. The request states the provider
   and consumes one consultation. The reply renders as a list of discrete
   items (alternatives, tensions, implications, questions), each with **Keep
   as Source Note**, **Add as question**, or **Dismiss**. Nothing persists
   until an item is kept.
5. **Returning to a mature project.** The canvas shows, per lens, what
   exists (counts and names of World Bible records and Source Notes mapped
   to that lens), the open questions, and a short deterministic "worth a
   look" list: records marked `needsCompletion`, records with no Source Note
   linked, questions open for a long time. No percentage, no score.
6. **Imported manuscript, no canon yet.** Same as 5 but the "worth a look"
   list also surfaces unresolved review candidates by count with a link to
   the review queue; the canvas never creates records from them itself.

## 3. Data ownership and trust flow

Recommendation for planning question 1–3: **one small new persisted record
per project**, not a Source Note kind, not Scratchpad.

- A premise and a question list are not source material. Storing them as
  Source Notes would feed them to extraction (a premise sentence becomes
  fact proposals — noise) and to the assistant's `lore` retrieval tier as if
  they were background truth. A dedicated record can be excluded from both
  by construction.
- Scratchpad is a single unstructured string; questions need status and
  links, lenses need identity so back-links survive edits.
- The record stays tiny and author-authored only; the model never writes to
  it except through the per-item **Keep** actions in journey 4, which are
  author clicks.

Smallest durable contract (WC-1):

```ts
type WorldCanvasLensKind =
  | 'people' | 'places' | 'factions' | 'history' | 'power'
  | 'customs' | 'constraints';

interface WorldCanvasQuestion {
  id: string;
  text: string;
  status: 'open' | 'answered' | 'dropped';
  lensKind?: WorldCanvasLensKind;
  linkedSourceNoteId?: string;   // LoreDocument.id
  linkedEntityId?: string;       // WorldEntity.id
  createdAt: number;
  updatedAt: number;
}

interface WorldCanvasLens {
  kind: WorldCanvasLensKind;
  note: string;                  // freeform, never parsed into fields
  linkedSourceNoteIds: string[];
  linkedEntityIds: string[];
  updatedAt: number;
}

interface WorldCanvasDocument {
  id: string;
  projectId: string;
  premise: string;
  lenses: WorldCanvasLens[];     // only lenses the author opened
  questions: WorldCanvasQuestion[];
  createdAt: number;
  updatedAt: number;
}
```

Persistence implications: new IndexedDB store `world_canvases` (DB version
bump, one record per project keyed by id with a `projectId` index), added to
`PROJECT_SCOPED_STORE_NAMES` so migration backups and project deletion cover
it, added to the project snapshot as `worldCanvases` with a snapshot schema
bump `5 → 6` (migration fills `[]`), included in backup export/import and in
the round-trip smoke. No project-schema migration is needed (no existing
record changes shape). Rollback: older builds ignore the extra store; a
schema-6 backup fails closed on a schema-5 build per the existing rule, so
release notes say so. Dangling `linkedSourceNoteId`/`linkedEntityId` values
are tolerated and rendered as "no longer exists" rather than repaired.

Trust flow (planning question 4):

```
exploratory (canvas premise / lens note / question / brainstorm item)
  → Keep as Source Note ........ author click → LoreDocument, source {type:'manual'}
  → Extract Candidates ......... existing deterministic extraction → proposals
  → Canon Decisions ............ author resolves → CanonicalFact / WorldEntity
  → Propose as canon ........... author click → World Bible create form (prefilled name)
```

Only the first arrow is new. The canvas never calls `saveEntity`,
`acceptFact`, alias storage, or mechanics services. Brainstorm output is
rendered from a schema-validated model response and is discarded unless an
item is kept; keeping writes a Source Note or a question, never canon.

Assistant context (planning question 7): the canvas record is **not
indexed** into RAG in v1 and is **not** injected into ordinary assistant
turns. The only model call that sees it is the canvas's own brainstorm
(WC-4), which sends the premise, the current lens note, open questions, and
a compact list of accepted canon *names* under an explicit "exploratory,
not canon" label, and asks for alternatives/tensions/questions rather than
facts. A later, separate decision (deferred) can add an "Exploratory (World
Canvas)" tier below Source Notes in assistant context; the universal
evidence gate from 1.2 already refuses to answer factual questions from
non-canon sources, so that tier would need its own test coverage before
shipping.

## 4. Slice index

Roadmap IDs: WC-1 = 4.30, WC-2 = 4.31, WC-3 = 4.32, WC-4 = 4.33, WC-5 = 4.34.

| ID | Slice | Size | Depends on | Delivers |
|---|---|---|---|---|
| WC-1 | Canvas record, view mode, premise, lenses, questions | M | — | authored canvas with persistence and backup |
| WC-2 | Bridges to Source Notes and World Bible | S | WC-1 | Keep as Source Note, Propose as canon, link existing, question status |
| WC-3 | Return experience: derived lens summaries and "worth a look" | S | WC-1 | useful canvas on mature and imported projects |
| WC-4 | Author-invoked brainstorming through the 1.5 surface | M | WC-2, 1.5 (done) | tensions/questions/alternatives with per-item keep |
| WC-5 | Onboarding entry, help, and IA documentation | XS | WC-1 | optional guide step, blueprint/domain updates |

Sequencing: WC-1 → WC-2 → (WC-3 and WC-4 in either order) → WC-5. Each
slice is a PR that leaves the app fully usable without the next.

Smallest valuable release: WC-1 + WC-2. That gives the world-first author a
place to think and a one-click path into the existing note → extraction →
canon pipeline. WC-3 makes the surface worth returning to; WC-4 is the
first slice that spends AI budget and needs the disclosure work; WC-5 is
the last so the guide never advertises something that is not there.

## 5. Slice prompts

Every prompt below is self-contained. Each executor must: claim the slice
on the `docs/road-to-market.md` status board; follow that file's
**Executing a Slice** procedure; reuse existing services, hooks, components,
and `theme.css` tokens (no new colors, no inline styles); run the full
verification battery (lint, web unit, engine, UI, web build, desktop build,
Cypress); run the manual smoke procedures named in the slice; update
`PROJECT_STATUS.md` whenever application truth changes; and mark the slice
`Done <commit>` only with the commit hash and the verified counts.

### WC-1 — Canvas record, view mode, premise, lenses, questions (M)

**Goal.** An optional, dismissible, resumable World Canvas inside World
Bible where an author can write a premise, open any of seven lenses and
write freely in each, and keep a list of questions. Persisted per project,
included in backups.

**Build.**

1. Types in `entityTypes.ts` exactly as in §3. Add
   `WORLD_CANVAS_STORE_NAME = 'world_canvases'` to `db.ts`, create the store
   with a `projectId` index in `onupgradeneeded`, bump `DB_VERSION`, add the
   store to `PROJECT_SCOPED_STORE_NAMES`.
2. `worldCanvasStorage.ts` at the same level as `scratchpadStorage.ts`:
   `getWorldCanvasByProjectId`, `saveWorldCanvas`. No other persistence
   path.
3. `services/worldBible/worldCanvasService.ts`: pure helpers —
   `createEmptyWorldCanvas(projectId)`, `openLens`, `updateLensNote`,
   `addQuestion`, `updateQuestion`, `LENS_DEFINITIONS` (kind, author-facing
   label, one-sentence prompt, e.g. *constraints* → "What does this world
   make expensive, forbidden, or impossible?"). Unit-tested.
4. `hooks/useWorldCanvas(projectId)`: load, debounced autosave (reuse the
   scratchpad hook's save-status pattern), status announcements through
   `useStatusAnnouncement` ("World Canvas saved.").
5. `components/WorldBible/WorldCanvasView.tsx`: premise textarea; lens list
   where unopened lenses show as a single row with their prompt and an
   **Open lens** button; opened lenses show a textarea; questions list with
   add, edit, and status (open / answered / dropped). Freeform only: no
   per-lens fields, no counters, no completeness indicator anywhere.
6. `WorldBibleRoute.tsx`: add `viewMode === 'canvas'`; add a **World
   Canvas** entry at the top of `WorldBibleCategoryRail` above the
   categories; keep route logic thin (state and handlers come from the
   hook). Empty state copy explains that nothing here is canon and that
   writing can start without it.
7. Snapshot: add `worldCanvases` to the snapshot payload and counts in
   `projectSnapshotService.ts`; snapshot migration `5 → 6` in
   `projectSnapshotMigrations.ts` filling `[]`; backup export/import carry
   it; conflict review treats it like scratchpads (one per project, merge
   by replace). Character packages are unaffected.
8. Docs: `PROJECT_STATUS.md` (feature + verified entry), `docs/domain-model.md`
   §1 (one paragraph: canvas material is exploratory, excluded from
   extraction and retrieval), `docs/smoke-tests.md` §1 backup round-trip
   gains one canvas assertion.

**Acceptance.**

- A blank LitRPG or general-fiction project can open World Canvas, write a
  premise, open two lenses, add three questions, reload, and see all of it.
- The canvas is reachable in ≤2 clicks from World Bible and leaves no trace
  in navigation badges or the `More` menu.
- No World Bible record, alias, fact, Source Note, or RAG index entry is
  created by anything in this slice.
- Backup export → validate → import as new project restores the canvas
  byte-for-byte; a schema-5 backup imports with an empty canvas.
- Keyboard-only: every control reachable, textareas labeled, question
  status is a labeled `<select>` or radio group, `aria-invalid` on an empty
  question submit, saved status announced.

**Tests.** Unit: service helpers; storage round-trip with fake IndexedDB;
snapshot migration 5→6 and export/import parity. Component: view renders
empty state, opens a lens, adds a question. Cypress: a new
`world-canvas.cy.ts` covering journey 1 with reload. Manual: smoke §1 with
the canvas assertion; desktop and narrow (≤900px) check of the rail entry
and the view.

### WC-2 — Bridges to Source Notes and World Bible (S)

**Goal.** Move an idea out of the canvas into the owners that already
exist, without the canvas becoming one.

**Build.**

1. `worldCanvasService`: `buildSourceNoteFromLens(lens, canvas)` and
   `buildSourceNoteFromQuestion(question)` producing `LoreDocument`s with
   `source: {type: 'manual'}` and a lens-to-kind map (`people` →
   `character_dossier`, `places` → `place_history`, `factions` →
   `faction_notes`, `history` → `timeline`, `customs` → `myth`, `power` and
   `constraints` → `general_lore`). Reuse `deriveSourceNoteTitle` and
   `summarizeContent` from `sourceNoteCapture.ts`. The note's first line
   records "From World Canvas — <lens label>" so provenance is visible.
2. Actions on each opened lens and each question: **Keep as Source Note**
   (creates the note, indexes it exactly as a manual note would through the
   existing RAG index call, stores the back-link, offers **Open note**),
   **Link existing note** (picker over the project's Source Notes),
   **Propose as canon** (navigates to World Bible `category` view with the
   create form open and the name prefilled — reuse the existing
   `focusCategorySlug` location-state handoff; the created record is a
   normal author-authored record; on return the lens gains
   `linkedEntityIds`), and **Link existing record** (picker over World
   Bible records, reusing the record resolver used by Source Note links).
3. Linked items render as chips with the target's current name (resolved at
   render time; a missing target renders "no longer exists" and offers
   unlink).
4. Questions gain **Mark answered** with an optional link to the note or
   record that answered it.

**Acceptance.**

- Keeping a lens as a Source Note creates exactly one `LoreDocument` with
  the right kind, appears in Source Notes, is extractable with **Extract
  Candidates**, and the lens shows the chip.
- Propose as canon never creates a record by itself; the author completes
  the normal World Bible form; cancelling leaves nothing behind.
- No canonical fact, alias, or entity is created or modified by any canvas
  action.
- Deleting a linked note or record leaves the canvas intact with a visible
  "no longer exists" chip.

**Tests.** Unit: note builders and kind map; link resolution with missing
targets. Cypress: extend `world-canvas.cy.ts` with journey 2 and 3
(keep → open note → extract; propose → create record → chip appears).
Manual: smoke §2 review completion starting from a canvas-created note.

### WC-3 — Return experience: derived lens summaries and "worth a look" (S)

**Goal.** Make the canvas useful on a project that already has canon and
manuscript text, without scores.

**Build.**

1. `services/worldBible/worldCanvasDerived.ts` (pure, unit-tested):
   `mapCategoryToLens(category)` using `EntityCategory.kind` and slug hints
   (`character` kind → people; slugs containing location/place/region →
   places; faction/guild/house/order → factions; else unmapped),
   `summarizeLens(lens, {entities, categories, loreDocuments, links})` →
   record names and counts, Source Note titles by kind; and
   `buildWorthALookList(...)` → deterministic items only: records with
   `needsCompletion`, records with no linked Source Note, questions open
   longer than 30 days, and (when review data is supplied) the count of
   unresolved review candidates with a link to the review queue. Each item
   states its rule in plain language ("No Source Note is linked to this
   record.").
2. Render the summary under each lens (opened or not) and the "worth a
   look" list above the questions. Copy must never imply incompleteness of
   the project; general-fiction projects show no mechanics-related items.
3. Imported-manuscript projects with no canon show the review-candidate
   count item first.

**Acceptance.**

- On the sample project, the people lens lists Sera and Brannic after they
  are accepted, and the factions lens lists the Cinder Compact with its
  Source Note.
- No number is presented as a percentage, score, or progress bar; no item
  is ever auto-resolved by the app.
- An unmapped custom category appears under an "Other records" line, not
  hidden.

**Tests.** Unit: mapping and list rules including the 30-day threshold and
the general-fiction exclusion. Cypress: journey 5 on the seeded smoke
project. Manual: narrow-width check that summaries collapse cleanly.

### WC-4 — Author-invoked brainstorming through the 1.5 surface (M)

**Goal.** Let the author ask for alternatives, tensions, implications, and
questions about the premise or one lens, review the result item by item,
and keep only what they choose.

**Build.**

1. `services/worldBible/worldCanvasBrainstorm.ts`: prompt builder that
   sends the premise, the selected lens note, open questions, and accepted
   canon *names* (from World Bible records and aliases, never Source Note
   text) under an explicit "exploratory — not canon" framing, and a
   zod-validated response schema:
   `{items: Array<{kind: 'alternative' | 'tension' | 'implication' |
   'question'; text: string}>}` with a hard cap of 12 items and ≤280 chars
   each. Invalid or oversized responses are rejected with the fallback
   error text through `describeError`. Reuse `LLMService` exactly as the
   canon-decision consultation does; increment the shared consultation
   usage (`inspectorBudgetService`) and refuse with the existing over-budget
   message when exhausted.
2. Button per opened lens and on the premise: **Ask for tensions and
   questions**. Before the first call in a project session, show the
   existing hosted-provider disclosure (Ollama: on-device) inline; the
   not-configured state links to Settings like the assistant does.
3. Results render through `AIProposalPreview`/`useAIProposalConfirmation`
   semantics as a list, each item with **Keep as Source Note** (WC-2
   builder, kind by lens), **Add as question** (kind `question` only, or
   any item rewritten by the author first), and **Dismiss**. The list is
   not persisted; navigating away discards it after a confirm.
4. No background calls, no auto-retry, no streaming into the canvas text.

**Acceptance.**

- With no provider configured, the button explains and links to Settings;
  no request is made.
- One click = one consultation against the shared budget; the disclosure
  names the provider before the first request.
- A malformed model response produces the fallback message and nothing
  else changes.
- Kept items become Source Notes or questions with visible "From World
  Canvas brainstorm" provenance; dismissed items leave no trace.

**Tests.** Unit: prompt builder includes only names from canon and labels
the material exploratory; schema rejects >12 items and long text; budget
refusal. Component: mocked `LLMService` result renders items and keep
actions. Cypress: journey 4 with an intercepted provider (as
`ai-provider-setup.cy.ts` does). Manual: hosted-provider disclosure wording
check in both themes.

### WC-5 — Onboarding entry, help, and IA documentation (XS)

**Build.**

1. Getting-started guide (`GettingStartedGuide.tsx`): add one optional line
   after "write your scene": "Starting from a world instead of a scene? Open
   World Canvas." Only on guide-marked projects; dismissal unchanged.
2. World Bible rail `Onboarding` panel: one sentence pointing to the canvas
   for world-first authors.
3. `docs/product-blueprint.md`: add World Canvas to the IA section as a
   World Bible view mode with the ownership sentence "authored exploratory
   material beside derived summaries; never a canon owner"; Design System
   note that canvas chips reuse the badge/pill pattern.
4. `docs/README.md`: fold this plan's durable outcomes into the authorities
   and archive this file with a banner.

**Acceptance.** Guide and rail copy are dismissible and never block; docs
updated; no behavior change beyond the two links.

**Tests.** Component test for the guide line; docs diff check.

## 6. Anti-goals and deferred ideas

Anti-goals (do not build, in any slice):

- Completeness percentages, "world health" scores, or progress bars.
- Mandatory questionnaires or a project-creation wizard.
- A second canon owner: no fact, alias, or record writes from the canvas.
- Rigid per-lens fields; lenses are prose.
- A relationship graph. Entity `links` exist but no journey above needs a
  graph; revisit only with beta evidence (see roadmap Backlog).
- Indexing canvas text into RAG or the assistant's ordinary context.
- Model-generated premise text inserted directly into the canvas.

Deferred (record in Backlog when scheduling):

- "Exploratory" assistant context tier for canvas material, with evidence-
  gate tests.
- Timeline lens deepening (history events with manuscript-order anchors)
  once roadmap 4.28 lands.
- Lens-scoped extraction hints (pre-selecting the lore kind when extracting
  a canvas-born note).
- Multiple canvases per project (e.g. per book in a series).

## 7. Scheduling recommendation

**Beta-driven, not v1.** The v1 definition and the 6.1 exit criteria are
about trust on real projects; World Canvas addresses activation for
world-first authors, which the 6.1 activation measures (time to first
accepted canon, time to first agreed review catch) will show or not. If the
beta cohort's blank-project feedback reports "I did not know where to
start," schedule WC-1 + WC-2 as the first post-beta product slices; WC-3
and WC-4 follow on demand. Nothing here blocks 6.1, and none of it should be
pulled ahead of the Phase 1 dogfood gate.

If the author prefers to ship it in v1 regardless, WC-1 + WC-2 fit between
5.12 and 6.1 as an M+S pair with no dependency on release engineering; the
cost is beta time not spent on continuity slices 4.23–4.26.

## 8. Risks, open decisions, and approvals needed

Decisions the author must make before WC-1 starts:

1. **Name.** Keep "World Canvas" (recommended) or choose an alternative.
2. **Persistence.** Accept the new `world_canvases` store and snapshot
   schema 6 (recommended), or require the Source-Note-kind alternative
   (cheaper, but leaks exploratory text into extraction and retrieval
   unless both are taught to skip a kind).
3. **Lens set.** The seven lenses above are the prompt's list verbatim;
   confirm, trim, or reword the prompts.
4. **Budget.** Brainstorming shares the project consultation budget
   (recommended) or gets its own.
5. **Guide entry.** Show the optional canvas line to every guide-marked
   project (recommended) or only to blank-project guides.

Risks:

- **Scope creep toward a wiki.** The lens list invites fields; the
  anti-goals and the prose-only rule must hold in review.
- **Provenance confusion.** Canvas-born Source Notes must be visibly marked
  so an author does not later mistake brainstormed text for research; the
  first-line provenance in WC-2/WC-4 is the mitigation.
- **Derived list noise (WC-3).** "No Source Note linked" will be true for
  most records in a large project; cap the list and order by
  `needsCompletion` first, and let the author dismiss items per project via
  the same localStorage pattern 4.22 uses.
- **Backup schema bump.** Every snapshot bump is a fail-closed boundary for
  older builds; batch WC-1's bump with any other pending snapshot change
  (4.28 also needs one) if they land close together.
