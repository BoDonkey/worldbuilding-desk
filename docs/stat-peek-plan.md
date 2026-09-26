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
| Workspace prose | Inserted **stat block tokens** (templated status windows) with a resolve/preview popover. |
| Sheets route; World Bible mechanics panel | Full sheet and mutation preview; a navigation away from writing. |
| World Canvas, Corkboard, Scratchpad, AI assistant | None. |

Gaps: no way to look up a character who is not on the current roster; no
lookup from a name in the prose; nothing on the brainstorming surfaces; no
"what changed since the last chapter" view; roster card rendering and
snapshot assembly live inside `useWorkspaceSceneRoster` (1,437 lines), so no
other surface can reuse them.

## Slices

### 4.46 — Character snapshot service + shared stat card (S–M)

- Extract a pure `buildCharacterSnapshot({character, position})` service from
  the roster hook. `position` is a scene plus moment (`opening` / `cursor`
  offset / `ending`) or `latest` (end of the last scene in manuscript order).
  Output: stats, resources, statuses, location, inventory/equipment, the
  scene the snapshot is taken at, and a `changesSince` list against a second
  position (default: the start of the previous chapter). Consumes replay from
  the web state services, or from `rules-engine` once 3.10 has landed.
- A shared `CharacterStatCard` component (compact and full densities, theme
  tokens only, keyboard and screen-reader friendly), reusing
  stat-block template styling where a project has chosen one so the peek
  matches the book's own status window.
- The scene roster switches to the service and card with no behavior change
  (existing roster tests and Cypress stay green).
- Tests: snapshot equals roster output across the continuity corpus;
  `changesSince` correct for set/change/status/inventory commands; hidden
  when game systems are disabled.

### 4.47 — Peek from the editor and command palette (M, after 4.46)

- In Workspace, with the cursor in or a selection on a character's name or
  alias (existing exact matching; ambiguous names ask), a keyboard shortcut
  and a context-menu item **Show stats** open the card in the existing
  `ContextPopover`, snapshot at the cursor. Escape returns focus to the
  editor.
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
- Each card offers **Changes since previous chapter** (from `changesSince`)
  and **Open sheet**.
- Pins are a per-project UI preference in the existing app/workspace store,
  not project data; not included in backups.
- Mobile: the panel becomes a bottom sheet; the standing mobile breakpoint and
  keyboard rules apply.

## Related scheduled work

- **Character lab (4.43, 4.44):** show each participant's `CharacterStatCard`
  beside the conversation or scene setup, from the same snapshot the model is
  given (see `docs/character-lab-plan.md`). 4.42 builds its state section
  from `buildCharacterSnapshot`.
- **Rules-engine R3 (backlog):** when derived values land, cards show
  effective values next to base values with a "why" breakdown. The card's
  layout reserves room for this.

## Out of scope

Editing values from the peek (state changes stay on the existing proposal
path), party/stat comparison tables, charts of progression over the whole
manuscript, and non-character subjects (items, locations) until the state
model expands beyond characters.
