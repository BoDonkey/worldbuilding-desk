# Places and Maps Brief

Status: design brief (slice 3.37). The author's decisions of 2026-11-08 are
recorded in § 11; slices 4.76–4.81 build it, all before the beta. Not a
commitment to a date. It records how places, character positions,
distances, and maps fit the existing model, so the location work done before
the map does not need to be redone later.

## 1. Why

LitRPG and Game Simulation projects need to know **where places are** and
**where characters are**. Prose writers benefit from the same thing at a
smaller scale: "she was in the capital yesterday, how is she at the border
today?" Tools such as World Anvil offer interactive maps with pins. The
desk's strength is continuity, so a map here is only useful when the data
behind it is correct and checkable.

## 2. What exists today

- **Location is a World Bible category** (default slug `locations`). Records
  have no hierarchy and no connections to each other.
- **Character position is a state change.** `location_set` records "actor X
  is now at Y" in the scene ledger, with the place stored as free text
  (`locationName`). "Ember Archive", "the Archive", and "ember archive" are
  three different places to the ledger.
- **Continuity review** (1.2b, 4.26) flags prose that puts a character
  somewhere other than the ledger says, without a movement cue in between.
  It compares names as text.
- **Sheet-free state** (4.27): every World Bible character carries location
  and items held, with or without a sheet. Positions are free-text names
  until 4.77.
- **No in-story time.** Scenes have an order, not a date or an elapsed time.
- **World Canvas** is a text brainstorming surface, not a spatial one.

## 3. Places

- **A place is a World Bible record**, as today. No new record type.
- **Containment.** A place may name one parent place, and parents can have
  parents of their own: a tavern inside a district, inside a city, inside a
  region, to any depth. One parent only; a place that straddles two regions
  picks one. Cycles are refused. Being in the tavern implies being in the
  city.
- **Connections.** Two places may be linked by a connection (road, river,
  portal, stairway). A connection may carry an **authored distance** and/or
  **travel times** by mode ("3 days on foot, 1 by horse"). Connections are
  two-way unless marked one-way.
- **Positions refer to records.** `location_set` gains a place **record id**.
  The free-text name stays as the fallback and as the label for places that
  have no record yet. Existing free-text entries are matched to records by
  name and alias where the match is unambiguous; anything else stays text
  and is offered for review, never guessed.

## 4. Maps and coordinates

Coordinates belong to a **map**, not to a place.

- **A map** is a project record: a name, an optional background image, a
  **distance unit** chosen for that map (miles, leagues, feet, squares), a
  **scale** (map units per distance unit, such as 1 pixel = 0.5 miles), and
  an optional **parent placement** (the city map sits at a
  point on the region map).
- **A placement** says "place X is at (x, y) on map M". A place can have
  placements on several maps at different scales: the tavern is a building
  on the city map and part of a dot on the region map.
- **Extent.** A placement is a point first. Areas (a region's outline) are a
  later addition and must not be required for any check.
- **No global grid.** There is no single world coordinate space. Distances
  are measured within one map, or across maps through their parent
  placements, in the unit of the map they are measured on. Comparing
  distances from maps with different units needs a conversion the author
  sets (for example 1 league = 3 miles); without one, the app shows both
  figures side by side and does not compare them.
- **Grid or hex** is an optional per-map setting for gaming use (dungeons,
  tactical zones). It changes how distance is measured on that map, not the
  placement model.

## 5. Distance

When the app needs a distance or travel time between two places, it uses the
most trusted source available:

1. **Authored** distance or travel time on a direct connection.
2. **Route**: the shortest chain of connections, adding up the authored legs.
3. **Straight line** from placements on a shared map, times the map's scale
   ("as the crow flies").

The source is always shown with the answer ("3 days, authored on the
Kingsroad" versus "about 40 miles in a straight line"). A straight-line
figure never overrides an authored one.

## 6. Time between scenes

Travel checks need to know how much story time passes between two scenes.
Today nothing records that. Options:

- **A. Optional in-story time tag per scene** ("day 12", "three days
  later"). Ordering stays by scene order, as the Game Simulation brief
  (§ 4) requires; the tag is never an ordering key.
- **B. No time.** Checks only flag movement with no travel cue in the prose,
  as today, and show the distance so the author can judge.

Decision: start with B. Option A stays possible later without a schema
change to positions; it is not scheduled.

## 7. Checks (warnings, never blocks)

All of these are continuity findings the author can accept, fix, or dismiss,
like current review findings.

- **Two places at once**: one character at two places in the same scene,
  unless one contains the other.
- **Teleporting**: a move between places with no connection or route and no
  travel cue in the prose.
- **Too fast** (later; needs § 6 option A): a move faster than the fastest
  known travel time. Not scheduled.
- **Unknown place**: a position that matches no record (offer to create one
  or link to an existing record).

## 8. The map surface (an extension)

The graphical map is an optional surface on top of the data, in the same
spirit as the game-systems toggles.

- **Input**: import an image made elsewhere (Inkarnate, Wonderdraft, a hand
  drawing, a scan) and **pin** place records onto it, which creates
  placements. Drawing tools are out of scope.
- **View**: show who is where at any chosen scene, with a character's path
  over a range of scenes.
- **Output**: export the pinned map as an image, and placements as data in
  the portable export (4.29 format) and backups.
- Images live in the project, so backups, vaults, and export must carry
  them; large images need a size limit and a clear message.

## 9. Trust boundary

Unchanged. AI may **propose** a position ("Mira arrives at the Ember
Archive"), a new place, a parent, or a connection, as an observation the
author accepts. AI never places pins, sets scales, or writes distances
directly. Inside a Game Simulation playthrough, movement follows that brief's
§ 6 rules.

## 10. Slices

All before the beta (author decision, 2026-11-08). Story time (§ 6 A) and
the "too fast" check are not scheduled.

| Slice | What | Needs |
|---|---|---|
| 4.76 Containment and connections | Parent place (nested, no cycles), connections with authored distance and travel times, editing in the World Bible location record | — |
| 4.77 Place records in the ledger | `location_set` by record id, name fallback, one-time matching with review; containment-aware "two places at once" | 3.34 (done), 4.76 |
| 4.78 Where-is-everyone view | Positions at a chosen scene, a character's path, teleport and unknown-place checks | 4.76, 4.77 |
| 4.79 Maps and placements (data) | Map and placement records, per-map unit and scale, parent placement, unit conversions, straight-line and route distance, portable export and backup | 4.76 |
| 4.80 Map surface | Image import, pinning, scene-time view, image export | 4.78, 4.79 |
| 4.81 Grid and hex maps | Per-map grid or hex setting, distance in squares or hexes | 4.80 |

4.27 (sheet-free state for general fiction) comes after 4.76 and before
4.77, so positions reach characters without a sheet from the start.

## 11. Decisions

Recorded with the author on 2026-11-08:

- Coordinates and distances are needed eventually; connections alone are not
  enough. The model plans for them from the start (§ 4, § 5).
- Coordinates are per map, through placements; there is no global grid.
- The map is an extension built last, on top of correct location data.
- Maps are imported images with pins, not drawn in the app.
- All slices come before the beta (§ 10).
- Start without story time between scenes (§ 6 B).
- One parent per place is enough, as long as parents can themselves have
  parents (§ 3).
- Distance units are set per map (§ 4).
- 4.27 (sheet-free state) moves before the beta, ahead of 4.77 (§ 10).
