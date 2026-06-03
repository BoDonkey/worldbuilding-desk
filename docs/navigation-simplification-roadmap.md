# Navigation Simplification Roadmap

Last updated: 2026-06-03

## Purpose

Turn the IA decision in [navigation-ia-decision.md](/Volumes/T7/Development/worldbuilding-desk/docs/navigation-ia-decision.md) into an implementation sequence that:

- reduces tab confusion
- simplifies canon ownership
- stays aligned with the existing roadmap
- avoids creating a parallel “big redesign” track

This roadmap is intentionally narrow. It is about simplifying what already exists, not adding new systems.

## Why This Is The Right Priority

This work is not a detour from the roadmap. It directly advances existing high-priority themes already present in the repo:

- [PROJECT_STATUS.md](/Volumes/T7/Development/worldbuilding-desk/PROJECT_STATUS.md)
  - “Reduce visible system complexity on first load”
  - “Revisit panel defaults and route emphasis to match the writing-first UX docs”
  - “Continue moving alias/review acceptance into a stronger World Bible workflow”
- [docs/next-steps.md](/Volumes/T7/Development/worldbuilding-desk/docs/next-steps.md)
  - “Keep alias and review follow-up centered in World Bible”
  - “World Bible feels like a real lore-writing surface rather than a cramped metadata form”
  - “Bias toward slices that complete the writing-first workflow instead of adding new optional systems”
- [docs/ux-refactor.md](/Volumes/T7/Development/worldbuilding-desk/docs/ux-refactor.md)
  - Pattern 3: tab consolidation
  - Pattern 4: richer lore editing

So this roadmap should be treated as **product-shaping simplification work that checks off current roadmap intent**, not as a new initiative competing with it.

## Accepted Direction

From [navigation-ia-decision.md](/Volumes/T7/Development/worldbuilding-desk/docs/navigation-ia-decision.md):

- `World Bible` becomes the single structured canon home.
- `Characters` stops being a separate primary canon destination.
- `Lore` is reframed as `Lore Documents`.
- `Ruleset` stays top-level for now as an advanced, distinct system surface.

## Current UI Chrome Checkpoint

As of June 3, 2026:

- Workspace, World Bible, Lore, and Canon Decisions share a reusable page-header component for active-project surfaces.
- Workspace is the model for the global feel: calm header, current scene/project context, and only the passive review badge as persistent header action.
- World Bible keeps the stronger canon workflow model: category browsing is list-first, manual forms open only after create/edit selection, and import/help tools live in a compact utility rail.
- Scratchpad is available from World Bible, Lore, and Canon Decisions through a shared project scratchpad modal, while Workspace retains its existing modal/context drawer access.
- Future route work should reuse shared page chrome before adding local page-header patterns.

## Success Criteria

At the end of this sequence:

- authors do not have to choose between `Characters` and `World Bible` for canon ownership
- character rename/alias/canonical-merge work happens in one obvious place
- `Lore Documents` reads as longform supporting material, not a second canon database
- top-level tabs each answer one intuitive question
- the app feels more “automagic” because internal storage boundaries are not exposed as product decisions

## Scope Guardrails

Do now:

- navigation copy and route simplification
- character-canon workflow collapse
- linked-lore affordances
- canon vs lore naming cleanup

Do not do in this roadmap:

- new mechanics systems
- new AI workflows beyond necessary relabeling
- deep ruleset redesign
- large editor-shell rearchitecture not required for the tab simplification

## Execution Order

### Phase 1: Collapse Character Canon Into World Bible

Goal:

- remove the “where does this character belong?” ambiguity first

Why first:

- this is the sharpest confusion
- it already causes workflow mistakes
- it directly affects review, aliasing, canon rename, and author trust

Implementation slices:

1. Make `World Bible > Characters` the primary canon editing surface for characters.
2. Stop treating the `Characters` route as a primary record-creation and primary canonical-rename surface.
3. Move character canonical rename, alias management, and duplicate-resolution language toward `World Bible`.
4. Keep any sheet/state/progression tools reachable from character records as secondary actions, not as a competing record home.
5. Rewrite UI copy that currently implies two equal homes for character truth.

Concrete route implications:

- [apps/web/src/routes/WorldBibleRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/WorldBibleRoute.tsx): absorb more character canon actions
- [apps/web/src/routes/CharactersRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/CharactersRoute.tsx): reduce or reframe toward operational tooling
- [apps/web/src/components/Navigation.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/components/Navigation.tsx): stop presenting `Characters` as equal to `World Bible`

What this checks off:

- stronger World Bible workflow
- route emphasis aligned with writing-first UX
- less visible system complexity

### Phase 2: Reframe Lore As Lore Documents

Goal:

- make canon vs longform source material legible

Why second:

- once character canon has one home, the next confusion is whether `Lore` is another canon database

Implementation slices:

1. Rename route-level copy from `Lore` to `Lore Documents`.
2. Audit empty states, buttons, and helper text so they describe dossiers, notes, imports, and source material rather than “canon records.”
3. Add explicit copy that accepted canon lives in `World Bible`, while `Lore Documents` can support or generate proposals.
4. Keep existing architecture, but make the user-facing model obvious.

Concrete route implications:

- [apps/web/src/routes/LoreRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/LoreRoute.tsx)
- [apps/web/src/components/Navigation.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/components/Navigation.tsx)

What this checks off:

- writing-first discoverability cleanup
- better optional-system framing
- reduced canon/lore confusion without adding new behavior

### Phase 3: Add Linked Lore Affordances To World Bible Records

Goal:

- support the “light canon record + optional deep document” model directly in the UI

Why third:

- after naming is clear, the app should make the relationship between the two surfaces obvious and useful

Implementation slices:

1. Add `Create linked lore document` from World Bible records.
2. Add `Open linked lore document` when one exists.
3. Surface linked-lore presence in record summaries and review views.
4. Prefer one obvious “deep detail” path instead of more World Bible field sprawl.

What this checks off:

- World Bible as real lore-writing surface
- Pattern 4 follow-through without needing a new top-level concept
- stronger longform lore direction already captured in architecture docs

### Phase 4: Reframe Characters Route As Secondary Tooling Or Remove It

Goal:

- finish the collapse so there is no lingering double-home confusion

Two acceptable end states:

1. Remove the top-level `Characters` tab entirely.
2. Keep it only as a specialized operational tool and rename it accordingly, for example:
   - `Character Sheets`
   - `Character State`

Decision rule:

- if the route is still editing identity, aliases, and canon description, it should not remain separate
- if the route is only about sheet/state/progression/runtime inspection, it can remain secondary

What this checks off:

- top-level tab clarity
- “each tab has one intuitive use”
- automagic experience through reduced exposed internals

## Recommended Milestone Breakdown

### Milestone A: Character Canon Unification

Deliverables:

- character canonical rename/alias cleanup centered in World Bible
- clearer navigation and copy
- destructive character alias conversion messaging fixed

Acceptance bar:

- a user no longer needs to think “should I do this in Characters or World Bible?”

### Milestone B: Lore Naming Cleanup

Deliverables:

- `Lore` renamed to `Lore Documents` in visible UI copy
- route descriptions updated
- empty states aligned

Acceptance bar:

- users can explain the difference between `World Bible` and `Lore Documents` in one sentence each

### Milestone C: Linked-Lore Record Flow

Deliverables:

- create/open linked lore document from World Bible records
- visible record linkage

Acceptance bar:

- deep worldbuilding detail feels attached to canon, not stored in a separate competing place

### Milestone D: Character Route Resolution

Deliverables:

- `Characters` either removed from top-level nav or renamed/reduced to secondary operational tooling

Acceptance bar:

- no top-level tab ambiguity remains around character ownership

## What To Deprioritize While This Is Running

To keep this work from turning into endless expansion, avoid pairing it with:

- net-new mechanics features
- broad compendium expansion
- new route families
- speculative authoring surfaces unrelated to canon/lore simplification

This roadmap should simplify first, then let future work land on a cleaner base.

## Verification Plan

Each phase should be considered complete only when:

1. manual smoke confirms the intended user path is more obvious
2. existing review/canon tests still pass
3. route copy and nav copy no longer contradict the accepted IA

Priority smoke paths:

- unknown character -> accept -> canonical rename/alias cleanup
- World Bible review queue -> complete record -> alias follow-up clear
- World Bible record -> create/open linked lore document
- Workspace -> World Bible -> Workspace return path

## Working Recommendation

Updated 2026-05-28:

**Phase 1: Collapse Character Canon Into World Bible** is implemented in the current working tree.

Next validation:

- run [character-canon-unification-smoke-test.md](/Volumes/T7/Development/worldbuilding-desk/docs/character-canon-unification-smoke-test.md)
- fix any smoke findings before starting Phase 2

Next simplification phase after smoke:

**Phase 2: Reframe Lore As Lore Documents**

Reason:

- character canon now has one primary home
- the next likely confusion is whether `Lore` is another canon database
- the change can stay copy/IA-focused before adding linked-lore behavior
