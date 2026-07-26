# Navigation IA Decision

Last updated: 2026-07-26

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
4. `Systems`: optional LitRPG rules, sheets, mechanics, and progression tools

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

`Ruleset` remains available as an explicitly advanced surface inside the
optional systems cluster.

Reason:

- It has a distinct audience and task shape.
- Power users may need direct access.
- It should not compete with `World Bible` for ordinary lore authoring.

It should not be a default peer destination for projects that do not use
system-heavy fiction features.

## Canonical Ownership By Concept

The UI should route author intent without exposing storage terminology.

| Author concept | Primary owner | Optional attachment or secondary tool |
| --- | --- | --- |
| Character identity, aliases, and story-facing facts | `World Bible > Characters` | Character sheet, tracked state, linked Lore Documents |
| Location | World Bible | Zone, affinity, settlement, or discovery mechanics |
| Item | World Bible | Item mechanics, recipe/crafting data, character inventory state |
| Creature | World Bible | Bestiary, loot, hunt, or discovery mechanics |
| Faction, concept, culture, or world rule | World Bible | Linked Lore Documents or optional mechanics |
| Longform history, dossier, myth, or exploratory notes | Lore Documents | Extracted proposals that may later become canon |

Creation or review should establish one primary canon anchor. Optional mechanics
must attach deliberately; accepting a detected item, location, or creature
should not automatically create a Compendium record.

Character possession and equipment are not fields on the canonical item. They
belong to character state and manuscript-time mutation events.

## Optional Systems Decision

LitRPG and system-heavy fiction remain a product differentiator, but the
mechanics surfaces are subordinate to writing and canon.

Accepted model:

- `Workspace` remains the daily writing surface.
- `World Bible` remains the structured canon home.
- `Lore Documents` remains the longform source-material surface.
- Rulesets, sheets/state, mechanics/Compendium, and settlement tools form an
  optional systems cluster.
- Optional-system routes remain reachable through `More`, contextual actions,
  and record-level handoffs.
- Projects may surface the cluster more strongly when LitRPG systems are
  enabled, but general-fiction projects should not be framed as incomplete
  without it.
- Pending or actionable system state may use visible badges, provided those
  badges do not turn every mechanics route into primary navigation.

This preserves direct access for power users while keeping the default product
shape writing-first.

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
- AI entry points should be schema-aware and author-invoked: model output fills editable draft fields or candidate proposals, then the author decides what becomes canon. The first non-character World Bible draft path now streams a concept for author review before extracting into the active category field schema; browser smoke and prompt review should determine whether category-specific presets are needed.
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

This aligns with the writing-first principles in `docs/product-blueprint.md`:

- fewer peer tabs
- one primary canon surface
- deeper writing/editing behind focused entry points

It also reduces the current ambiguity around actions like:

- "Is this character supposed to go in Characters or World Bible?"
- "If I rename a character canonically, which surface owns that truth?"
- "Is Lore another canon database or just source notes?"

## Current Product Rules

- New canon anchors should default toward `World Bible`.
- Freeform background writing should default toward `Lore Documents`.
- Review completion and alias cleanup should stay centered in `World Bible`.
- Character sheet/state workflows are specialized tools, not the main character
  canon home.
- New UI should avoid asking the author to choose between `Characters` and `World Bible` for canon ownership.
- Items, creatures, and locations gain mechanics only through an explicit
  author action.
- Optional-system navigation should stay grouped rather than expanding into a
  row of default peer destinations.

## Implementation Status

Implemented:

- Primary navigation is organized around Workspace, World Bible, and Lore
  Documents.
- Canon Review, Corkboard, Settings, and optional system-heavy routes are
  grouped behind `More`.
- Lore route copy uses Lore Documents/source-note framing.
- World Bible is the character-canon home; Character Tools and sheets/state are
  secondary.
- World Bible records can create or open linked Lore Documents.
- Workspace character intake creates World Bible canon first.
- Generic intake no longer treats Compendium as a mandatory second destination.

Remaining validation and refinement:

- Manually verify optional-system discoverability and badges at desktop and
  narrow breakpoints.
- Validate navigation with projects that use no mechanics, light LitRPG
  mechanics, and extensive system tracking.
- Keep AI entry points schema-aware, author-invoked, and proposal-oriented.
- Use `docs/ai-assisted-item-authoring.md` as the first description-first
  mechanics-authoring pilot.
- Resolve future character-tool reduction through this decision document rather
  than another parallel navigation roadmap.

## Working Recommendation

The preferred navigation hierarchy is:

- `Projects`
- `Workspace`
- `World Bible`
- `Lore Documents`
- `More`
  - optional systems
  - planning and review utilities
  - settings

This is the cleanest structure that still respects the current codebase direction and the desired automagic author experience.
