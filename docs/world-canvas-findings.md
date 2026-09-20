# World Canvas — author-orientation findings

Status: **findings, non-authoritative.** Dated 2026-09-20, from an author
walkthrough of the shipped canvas (slices 4.30–4.33 / WC-1–WC-4) plus a code
read. Accepted findings were folded into `docs/road-to-market.md` and slice
4.34; this document remains supporting evidence, not an execution plan.

---

## 1. Provenance of the lens set

The seven lenses were not designed in this repo. They arrived verbatim in the
external planning prompt at `docs/archive/world-canvas.md` ("Received 2026-09-12 from
an external LLM"), which listed them as an illustrative set. The resulting
plan, `docs/archive/world-canvas-plan.md`, flagged this in § 8 as open decision 3 —
*"The seven lenses above are the prompt's list verbatim; confirm, trim, or
reword the prompts"* — and the author accepted the default.

Labels and prompts were already reworded during WC-1 implementation
("History and change", "Power and possibility", "Constraints and costs"), so
wording has never been treated as frozen. The `kind` slugs are the persisted
identity and are a different matter (§ 5).

WC-5 archived `world-canvas-plan.md` with a banner, closing the § 8 decision
record. Any lens-set question worth
keeping open should move into `docs/product-blueprint.md` in the same slice
rather than staying in a doc the standing rules say not to resurrect.

## 2. Finding — the page never says what a lens is

The intro answers *is this canon?* ("Nothing here is canon. Every field is
optional") but never *what is a lens, and why would I open one?* The only
explanatory sentence is the section subhead, and it introduces a second word
for the concept:

> Lenses — "Open only the **perspectives** that help this project."
> (`WorldCanvasView.tsx:548`)

"Perspective" also appears inside the People lens prompt. One concept, two
nouns, and the explanation of "lens" is the only place the other noun is used.

**Remedy:** single vocabulary ("lens"), plus the re-explanation in § 3.

## 3. Finding — an author cannot tell which parts of a lens are theirs

An open lens card stacks three provenance classes in one visual container at
one visual weight:

| Layer | Owner | Rendered by |
|---|---|---|
| lens note textarea | the author | `WorldCanvasView` lens body |
| "From saved material" record/Source Note counts | derived from canon | `renderLensSummary` → `summarizeLens` |
| "Ask for tensions and questions" and its results | the model | `renderBrainstorm` |

Each layer is labeled, but the labels sit inside the same card with the same
prominence, so on first arrival the card reads as one undifferentiated
surface and the author cannot tell what is theirs to write, what was computed
from their own canon, and what a model would supply.

**Remedy:** give the three layers distinct visual treatment (the authored
textarea primary; derived and model blocks visibly secondary and clearly
attributed) rather than relying on label text alone.

## 4. Finding — prompt placement, not prompt wording, creates form pressure

The prompts read as open-ended in isolation. The rigidity comes from where
they sit:

- the prompt renders in **both** closed and open states, directly above the
  textarea — the position of a form field's help text, which reads as
  "answer this";
- the textarea label is `{label} notes` ("People notes"), framing the box as
  a slot;
- seven fixed cards in fixed order, each with an **Open lens** button, reads
  as a seven-item checklist, against which "Open only the ones that help" is
  a single sentence arguing the opposite of the layout.

**Remedy:** keep the prompt in the closed state, where it is doing real
orientation work, and demote or drop it once the lens is open and the author
is writing. Consider relabelling the textarea away from "notes".

## 5. Finding — the derived layer is half-built, and "Other records" shows it

`mapCategoryToLens` (`worldCanvasDerived.ts`) maps only three lenses:

- `category.kind === 'character'` → `people`
- slug contains location / place / region → `places`
- slug contains faction / guild / house / order → `factions`

Everything else returns `null` and falls into `summarizeOtherRecords`.
Consequences:

- **history, power, customs and constraints can never receive a mapped
  record.** Their "From saved material" block permanently reads "None
  mapped" while their records accumulate in the leftovers bucket.
- **"Other records" is rendered inside the Lenses section** as a sibling of
  the lens `<article>`s, but as a bare `<div>` with a bold label and a
  comma-joined name list — no heading, no prompt, no Open lens button, no
  actions, no "From saved material" attribution. It reads as a malformed
  eighth lens. On a mature project it is a long alphabetical name dump.

**Remedy (two parts, independent):**

1. Move "Other records" out of the Lenses section, or give it the derived
   treatment from § 3 and a label that says what it is ("World Bible records
   not mapped to a lens"). It is derived, not authored, and must not look
   like a lens.
2. Extend `mapCategoryToLens` so the other four lenses can map, or accept
   that they are authored-only and stop rendering an always-empty derived
   block for them. Either is defensible; the current state is neither.

## 6. Finding — there is no prose escape hatch

The Questions form offers a **General** option for questions belonging to no
lens. There is no equivalent for lens prose: an author who thinks of an angle
outside the seven has nowhere to put it.

Structural note: adding a lens kind is the cheap change (append to the union,
`LENS_DEFINITIONS`, and the two total `Record` maps; no migration, because
`lenses[]` only holds what the author opened). **Trimming** a kind is not —
`WorldCanvasView` enumerates `LENS_DEFINITIONS` and looks authored content up
by `kind`, so a dropped kind silently orphans its note text: the data survives
in IndexedDB and in backups (nothing validates lens kinds on import) but
becomes unreachable in the UI. Any trim needs a migration.

**Options, cheapest first:**

1. An eighth built-in freeform lens ("Something else", no prompt) — one enum
   member, no migration.
2. Author-defined custom lenses — a real slice: `WorldCanvasLensKind` is a
   closed union used as persisted identity *and* as the key of two total
   `Record` maps, so this needs either a widened type or a parallel
   `customLenses[]`, plus a Source Note kind fallback, no category mapping,
   and no brainstorm prompt.

**Caution:** do not merge an authored "Something else" lens with the derived
"Other records" bucket. They are opposites — one is written by the author,
one is computed from records that failed to map — and combining them
re-creates the § 3 confusion in a single box.

## 7. Proposed re-explanation of Lenses

The current framing presents lenses as optional containers. The framing that
matches what they actually do, and what an author gets from opening one:

> **A lens is an angle to think from, not a category to fill in.**
>
> Each one pushes on a different part of your world and asks what it
> produces — pressures, costs, consequences, things you have not decided
> yet. You open a lens when you want to find out what you have not thought
> about, not when you want somewhere to file what you already know. World
> Bible is for what you know.
>
> Nothing you write in a lens is canon. No lens is required, and there is no
> order to work through them in.

Candidate section copy (replacing the current subhead):

> Angles to think from — not categories to fill in. Open one when you want
> to push on a part of the world and see what it produces. Nothing here is
> canon, and no lens is required.

Where it should appear, in priority order:

1. **The Lenses section subhead** — replaces the current sentence and drops
   the "perspectives" synonym. Cheapest, highest value.
2. **The World Bible rail Onboarding panel** — WC-5 step 2 is already
   scheduled to add a sentence here for world-first authors; it should be
   this framing rather than a procedural pointer.
3. **The closed-lens state** — the per-lens prompt, kept in the closed card
   only (§ 4), is what makes the abstract framing concrete for each lens.

The contrast sentence — *World Bible is for what you know; the canvas is for
what you are working out* — is the load-bearing part. It is the distinction
the author reached for on arrival and the one nothing on the page currently
draws.

## 8. What this does not change

The plan's anti-goals still hold and nothing above requires relaxing them: no
completeness scores or progress indicators, no mandatory wizard, no second
canon owner, no rigid per-lens fields (lenses stay prose), no relationship
graph, no RAG indexing of canvas text, no model-written premise.

Note that "no rigid per-lens **fields**" was never "no additional lenses" —
§ 6 option 1 is compatible with the anti-goals as written.

## 9. Suggested disposition

| # | Item | Size | Note |
|---|---|---|---|
| 1 | Lens re-explanation copy (§ 7) + single vocabulary (§ 2) | XS | fold into 4.34 (WC-5) |
| 2 | "Other records" out of the lens list / labelled as derived (§ 5.1) | XS | copy + markup only |
| 3 | Prompt demoted in the open state (§ 4) | XS | touches Cypress label assertions |
| 4 | Provenance treatment for the three layers (§ 3) | S | design-system tokens only |
| 5 | `mapCategoryToLens` coverage decision (§ 5.2) | S | behaviour change; needs a call first |
| 6 | Eighth freeform lens (§ 6.1) | S | pre-beta is much cheaper than post-beta |
| 7 | Author-defined custom lenses (§ 6.2) | M | backlog; revisit with beta evidence |

Items 1–4 are copy and presentation and change no stored data. Items 5–6
change behaviour or the lens set and should be settled before beta, because
once authors have opened lenses, changes to the set become migrations.

Open item carried from 4.33, unrelated to the above but in the same UI: the
manual brainstorm disclosure-wording check in both themes is still
outstanding. If item 3 or 4 is scheduled, do that check in the same pass.
