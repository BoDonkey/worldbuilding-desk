# Navigation IA Decision

Last updated: 2026-06-03

## Goal

Reduce top-level navigation noise and give the app one clear canon model.

The current route set is too easy to misread:

- `World Bible`
- `Characters`
- `Lore`
- `Ruleset`

These are not four equally distinct concepts in the user's mind. In practice, they overlap:

- character identity can live in `Characters`
- character canon can also live in `World Bible`
- deep character notes can also live in `Lore`

That creates avoidable confusion around where something "really belongs."

## Decision

Use **World Bible as the central structured canon surface**.

Accepted model:

- `World Bible` is the canonical record system.
- `Characters`, `Locations`, `Items`, `Factions`, `Creatures`, `Concepts`, and custom categories live inside `World Bible`.
- Each World Bible record can optionally link to a **Lore Document** for deeper, longform writing.
- `Lore Documents` are source material and deep notes, not a second competing canon database.
- AI assistance should follow the same ownership model: it can help draft or extract candidates, but accepted World Bible records and accepted canonical facts remain the source of truth.
- The app should prefer an **automagic** author experience:
  - authors should not have to decide between multiple canon homes
  - structure should appear progressively
  - deep detail should be available, but not demanded up front

This means the app should communicate a simple hierarchy:

1. `Workspace`: write
2. `World Bible`: structured canon
3. `Lore Documents`: longform background and supporting source material
4. `Ruleset`: optional advanced systems

## What This Means For Tabs

### World Bible

Keep as a top-level destination.

Reason:

- It is already the main review-completion and canon-cleanup surface.
- It maps well to the user's mental model of "the place where world facts live."
- It can absorb most of the current character/location/item browsing complexity.

### Lore

Keep the concept, but rename the route/surface to **Lore Documents**.

Reason:

- `Lore` sounds like "the place where canon lives."
- In the current architecture, the route is closer to freeform dossiers, notes, imported background documents, and extraction source material.
- Renaming it lowers collision with `World Bible`.

### Characters

Do **not** keep `Characters` as a second equal top-level canon home.

Accepted end state:

- Character identity, aliases, canon role, and descriptive editing move into `World Bible`.
- The current `Characters` route is reduced and ultimately removed as a separate canon destination.
- Any remaining character-specific tooling should be subordinate to World Bible records, not a competing record system.

Implementation stance:

- If the surface is about identity, aliases, canon role, or descriptive editing, it belongs to `World Bible`.
- If the surface is about sheets, tracked state, resources, progression, or system-heavy actor inspection, it can exist as a **secondary tool attached to a World Bible character record**.

That avoids the current ambiguity where `Characters` appears to be both:

- the canonical character database
- and the operational sheet/state surface

### Ruleset

`Ruleset` can remain top-level for now, but only as an explicitly advanced surface.

Reason:

- It has a distinct audience and task shape.
- Power users may need direct access.
- It should not compete with `World Bible` for ordinary lore authoring.

Longer-term possibility:

- Keep `Ruleset` top-level only when advanced systems are enabled.
- Otherwise expose it from `World Bible` or an advanced menu.

## Record Model

Recommended record relationship:

- `World Bible Record`
  - canonical name
  - alternative names / aliases
  - category-specific structured fields
  - optional short summary
  - optional linked `Lore Document`

- `Lore Document`
  - longform dossier, history, or notes
  - may mention one or many canon records
  - may produce extractable proposals
  - does not become canon automatically

AI drafting implication:

- Character/Cast AI drafting should not remain the only pattern.
- Custom World Bible categories may represent races, faeries, factions, species, organizations, or other grouped entity types.
- Future AI entry points should be schema-aware and author-invoked: model output fills editable draft fields or candidate proposals, then the author decides what becomes canon.
- Do not model every non-character category as an individual character list. Category hierarchy and entity type should be resolved before adding more category-specific AI buttons.

This supports the desired user flow:

1. Add or accept a canon record in `World Bible`
2. Keep it lightweight if only a simple record is needed
3. Attach or open a linked `Lore Document` when the author wants deep detail
4. Open specialized secondary tools only when the author needs them

## Automagic Principle

The author should not have to reason about internal data ownership.

Desired experience:

- detect or create a character once
- store that character in one obvious canon home
- let the app expose deeper options when they become relevant

Examples:

- A new named person should land in `World Bible > Characters` by default.
- If the author later needs sheet/state behavior, the app should offer it from that record.
- If the author later needs a deep dossier, the app should offer `Create linked lore document`.

The app should feel like one coherent writing tool, not a set of adjacent databases.

## UX Implications

This aligns with `ux-refactor.md` Pattern 3 and Pattern 4:

- fewer peer tabs
- one primary canon surface
- deeper writing/editing behind focused entry points

It also reduces the current ambiguity around actions like:

- "Is this character supposed to go in Characters or World Bible?"
- "If I rename a character canonically, which surface owns that truth?"
- "Is Lore another canon database or just source notes?"

## Near-Term Product Rules

Until the full navigation simplification lands, use these rules:

- New canon anchors should default toward `World Bible`.
- Freeform background writing should default toward `Lore Documents`.
- Review completion and alias cleanup should stay centered in `World Bible`.
- Character sheet/state workflows may remain separate temporarily, but should be described as specialized tools, not the main character canon home.
- New UI should avoid asking the author to choose between `Characters` and `World Bible` for canon ownership.

## Suggested Follow-Up Work

1. Rename `Lore` route copy to `Lore Documents`.
2. Collapse character canon editing into `World Bible`.
3. Reframe any remaining character-only route as sheet/state tooling, or remove it entirely.
4. Update navigation copy and empty states to reflect the model above.
5. Add explicit linked-lore affordances inside World Bible records:
   - `Create linked lore document`
   - `Open linked lore document`
6. Decide how author-invoked AI drafting generalizes beyond Cast to other World Bible categories without silently creating canon.
7. Stop presenting `Characters` and `World Bible > Characters` as two equally primary homes for character canon.
8. Add a record-level entry point for optional character-sheet/state tooling from World Bible character records.

## Working Recommendation

If a simplification pass starts now, the preferred top-level nav is:

- `Projects`
- `Workspace`
- `World Bible`
- `Lore Documents`
- `Ruleset` (advanced / optional)
- optional system-heavy surfaces only when enabled

This is the cleanest structure that still respects the current codebase direction and the desired automagic author experience.
