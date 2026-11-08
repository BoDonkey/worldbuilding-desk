# Game Simulation Brief

Status: design brief, signed off by the author on 2026-11-08 (slice 3.36).
**Not a commitment to build.** Game Simulation stays hidden for the first
release. This brief exists so that structural work done now (3.34, 3.35, the
Ruleset and State rules in `docs/architecture-review.md`) keeps the mode
possible without guessing at it.

## 1. What it is

Game Simulation lets an author **design an adventure** and lets someone
**play it**. The designer and the player can be the same person or different
people.

- **Designer.** Builds the adventure with the tools that exist today: World
  Bible (places, characters, factions), ruleset (stats, resources, formulas),
  Compendium (items, consumables, milestones), and the starting state of
  characters and the party.
- **Player.** Imports the adventure and plays it, alone (solo play) or as a
  game master running it for a table. At a table, only the game master uses
  the app; players do not have accounts or a shared view.

Live multi-user play (shared state, permissions, sync) is out of scope.

## 2. Adventures and playthroughs

An adventure is a **locked copy** for the player. Importing it creates a
**playthrough**: the player's sessions, state ledger, and notes. The
adventure's world, rules, characters, and starting state are read-only inside
a playthrough. Several playthroughs can use the same adventure.

Consequences:

- Play never writes to the adventure's canon. A playthrough's state is
  derived from the adventure's starting state plus the playthrough's own
  ledger.
- Ids in the adventure must survive export and import unchanged, because the
  playthrough's ledger refers to them (backup restore already keeps ids;
  `docs/architecture-review.md` § Persistence).
- Updating an adventure under an existing playthrough is a later question.
  The locked-copy split is what makes it answerable.

## 3. Sessions and the manuscript

A **session** is one sitting of play. It holds an ordered **play log**:
narration, dice rolls and checks, and state changes, in the order they
happened.

**Play feeds prose.** Play does not write the manuscript directly. The player
can turn a session's log into a **draft scene** in the Writing Workspace,
which the author then edits like any other scene. The play log and the
manuscript are two linked timelines; the scene keeps a link back to the
session it came from.

## 4. Time

State changes are **ordered by session, then by position within the
session**: the same shape as scene order and position in a scene today.
An event may also carry an optional **in-world date** (day, season) for
travel, rest, and cooldowns measured in days. The date is a tag. It never
decides replay order.

Combat rounds and exploration turns live inside a single log event (for
example "Round 3: Mira hits the ogre for 7"). They are not ordering units.

Ordering by in-world calendar (for flashbacks and split parties) was
considered and set aside: every event would need a timestamp and replay
would become much more complex.

## 5. Who holds state

- **Characters**, as today (character sheets, actor ids).
- **The party**: shared inventory, shared resources (gold, supplies), and
  party-level progress. Today "party" exists only as a Compendium progress
  scope (`MechanicsProgressScope`); it would become a state holder with its
  own actor id.

Settlements, zones, and world-level state (faction standing, world clocks)
are not state holders in the first version. The settlement and zone systems
stay Compendium data as they are today.

## 6. Trust boundary in play

| What | Happens how |
|---|---|
| Dice rolls and checks against ruleset stats | Automatic. Logged, undoable. |
| Deterministic rule outcomes (damage, costs, cooldowns from ruleset formulas) | Automatic. Logged, undoable. |
| AI game-master narration | Proposed. The player accepts, edits, or rejects it. |
| State changes suggested by the AI | Proposed observations. Code validates them; the player accepts them like any state change today. |
| Turning a session into a draft scene | Started by the player. AI drafting help follows the existing prose rules. |
| Anything touching the adventure's canon | Never, from play. |

This narrows the current rule, "models propose, deterministic code validates,
authors approve". Inside a playthrough, a player's own action (rolling, using
an item) counts as the approval for the deterministic outcomes that follow.
Models still only propose. This exception applies to playthrough state only;
the manuscript ledger in LitRPG and General Fiction is unchanged. When Game
Simulation is built, `docs/architecture-review.md` § Trust Boundary needs a
paragraph recording it.

## 7. First version scope

In:

- AI game-master narration (proposals only, per § 6).
- Dice and checks against the ruleset, written to the session log.
- Play log to draft scene.
- Adventure export and import into a playthrough.

Carries over from LitRPG unchanged: ruleset, character sheets, Compendium,
the state-change kinds (3.34) and the scene ledger's replay rules, stat
blocks, and the continuity review.

Later or out of scope:

- Live multi-user play, player accounts, sync.
- Settlements, zones, factions, and world clocks as state holders.
- Ordering by in-world calendar.
- Updating an adventure under an existing playthrough.
- Publishing or marketplace distribution of adventures.

## 8. What this means for current slices

Checked on 2026-11-08 against 3.34, 3.35, and the Ruleset and State rules.

- **3.34 (state-change kinds).** One addition: kind modules turn effects into
  commands but **never decide whether a command is proposed or applied**.
  The caller decides (the author's form, an AI proposal, or later a
  playthrough's rule step). Kind modules also do not read scene fields
  (`sceneId`, `sceneOrder`, `scenePosition`), so the same modules can serve
  session-scoped events. Recorded in the 3.34 slice text and the Ruleset and
  State rules.
- **3.34a (XP and levels).** No change. The party as a state holder is
  covered by "subject by id".
- **3.35 (capabilities).** No change. The capability table should still
  cover the `game` mode in its tests; capabilities such as "has
  playthroughs" are added when the mode is built, not now.
- **Ordering through replay.** No change. Session order plus position fits
  the rule as written; the in-world date tag must not become an ordering key.
- **Subject by id.** No change. It already covers the party.
- **Mode through capabilities.** No change.
