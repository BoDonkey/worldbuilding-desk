# Stat Peek — Plan

**Status:** Accepted 2026-09-26. Scheduled as roadmap Slices 4.46–4.48.
Archive this plan once the slices land and their durable behavior is folded
into `docs/product-blueprint.md`.
**Goal:** a LitRPG author can see any character's stat block in a second or
two, whether drafting in Workspace or brainstorming elsewhere, without
navigating to Sheets or World Bible.
**Constraints:** product-blueprint principle "systems support narrative" (stats
enrich, never dominate) and the copy rule that stats are not part of the
default fiction workflow — every surface here appears only when game systems
are enabled for the project. Read-only: nothing here changes canon, sheets, or
manuscript-time state.

## What exists today (verified 2026-09-26)

| Surface | Stat visibility |
| --- | --- |
| Workspace → context drawer → **Scene** tab | Scene roster cards: stats, resources (current/max), statuses, location, inventory/equipment, at the scene's opening, cursor, or ending (replayed from accepted events). Only characters on that scene's roster. |
| Workspace prose | Inserted **stat block tokens** (templated status windows) with a resolve/preview popover. Hovering a highlighted character name shows a small **state card** (first four resources and stats, statuses, location) at that mention — mouse-only. |
| Sheets route; World Bible mechanics panel | Full sheet and mutation preview; a navigation away from writing. |
| World Canvas, Corkboard, Scratchpad, AI assistant | None. |

Gaps: no keyboard or touch way to look up a character from the prose (the
hover card is mouse-only); no lookup of a character who is not highlighted or
rostered; nothing on the brainstorming surfaces; no "what changed since"
view. Snapshot assembly lived inside `buildSceneRosterModel`
(`services/workspace/workspaceView.ts`) and was re-implemented separately for
the hover card; card rendering lived inside `SceneRosterPanel`, so no other
surface could reuse either. (Corrected 2026-09-26 during 4.46: an earlier
draft of this plan placed the assembly in `useWorkspaceSceneRoster` and missed
the hover card.)

## Slices

### 4.46 — Character snapshot service + shared stat card (S–M)

- `services/state/characterSnapshot.ts`: `buildCharacterSnapshot({sheet,
  position, ...})` where `position` is a scene (1-based manuscript order, see
  `getSceneOrder`) plus moment (`opening` / `cursor` offset / `ending`) or
  `latest` (every accepted event). Output: level, stats, resources, statuses,
  location, and inventory/equipment with linked names and consumables, with
  runtime modifiers applied — exactly what the roster showed.
- `describeCharacterSnapshotChanges(before, after)`: a pure, ordered diff
  (level, resources, stats, statuses, items, equipment, location). Callers
  choose both points; scenes carry no chapter, so the natural default is the
  previous scene's ending. Chapter-based comparison uses Corkboard links in
  4.48.
- `summarizeCharacterSnapshot` for compact one-line surfaces.
- `CharacterStatCard` (compact/full) built from shared parts
  (`CharacterResourceMeters`, `CharacterStatusChips`,
  `CharacterStateDetails`) in `components/CharacterSheets/`.
- The scene roster (`buildSceneRosterModel`, `SceneRosterPanel`) and the
  editor hover card adopt the service and parts with no behavior change:
  roster output and rendered markup were compared byte-for-byte before and
  after across every scene and moment of a dedicated fixture, and the hover
  card against a verbatim copy of its old logic.
- Deferred to later slices: game-systems gating and stat-block template
  styling (4.47, the first new surface), and a card-owned CSS module (4.48,
  the first surface outside Workspace).

### 4.47 — Peek from the editor and command palette (M, after 4.46)

- Builds on the existing mouse-only hover card. In Workspace, with the
  cursor in or a selection on a character's name or alias (existing exact
  matching; ambiguous names ask), a keyboard shortcut and a context-menu item
  **Show stats** open `CharacterStatCard` in the existing `ContextPopover`,
  snapshot at the cursor; the hover card switches to the same card. Escape
  returns focus to the editor.
- Where the project has chosen a stat-block template, the card uses its
  styling so the peek matches the book's status window.
- Hidden when game systems are disabled (test).
- Command palette: **Show stats for…** with character search, available on
  every route; opens the card for `latest` (or the current scene when invoked
  from Workspace).
- Cypress: peek by shortcut on a rostered and a non-rostered character; value
  matches the Sheets route; no records change.

### 4.48 — Pinned stat panel across writing and brainstorming (M, after 4.47)

- Pin up to three characters from the peek, the roster, or World Bible. A
  compact, collapsible panel in the app shell shows their cards on Workspace,
  World Canvas, Corkboard, Scratchpad, and World Bible.
- Position follows the current scene and cursor moment in Workspace; elsewhere
  it shows `latest`, with a scene picker for "as of" another point.
- Each card offers **Changes since previous chapter** (via
  `describeCharacterSnapshotChanges`, using Corkboard chapter-card links to
  find the chapter boundary, falling back to the previous scene) and
  **Open sheet**.
- The card moves to its own CSS module here, since this is its first surface
  outside Workspace.
- Pins are a per-project UI preference in the existing app/workspace store,
  not project data; not included in backups.
- Mobile: the panel becomes a bottom sheet; the standing mobile breakpoint and
  keyboard rules apply.

## Related scheduled work

- **Character lab (4.43, 4.44):** show each participant's `CharacterStatCard`
  beside the conversation or scene setup, from the same snapshot the model is
  given (see `docs/character-lab-plan.md`). 4.42 builds its state section
  from `buildCharacterSnapshot`.
- Replay reads a sheet's tracked `inventoryEntries`; the legacy
  `inventory: string[]` field is ignored (statuses, by contrast, fall back to
  the legacy list). Existing behavior, noted during 4.46; not changed here.
- **Rules-engine R3 (backlog):** when derived values land, cards show
  effective values next to base values with a "why" breakdown. The card's
  layout reserves room for this.

## Out of scope

Editing values from the peek (state changes stay on the existing proposal
path), party/stat comparison tables, charts of progression over the whole
manuscript, and non-character subjects (items, locations) until the state
model expands beyond characters.
