# Systems Experience Design Review — Working Decision Artifact

**Status:** non-authoritative working review; no roadmap slice is claimed.
**Created:** 2026-09-20.
**Scope:** the author-facing journey through Rules, Sheets/State, Mechanics,
World Bible mechanics entry points, Workspace state actions, and optional
settlement/zone systems.

This review exists to decide the author-facing model before implementation
work is scheduled. Current application truth remains in `PROJECT_STATUS.md`,
durable UX and ownership decisions remain in `docs/product-blueprint.md` and
`docs/domain-model.md`, and open work remains authoritative only in
`docs/road-to-market.md`. After the author accepts a direction, fold durable
decisions into those authorities, add approved slices to the roadmap, and
archive this review with a replacement banner.

## 1. Review instruction

Do not assume that the existing Rules, Sheets, and Mechanics destinations are
the correct author-facing boundaries merely because they are valid technical
owners.

Evaluate the experience from the author's intentions:

- What do I want the story to remember?
- What changed for this character in this scene?
- What can this item, ability, or creature do repeatedly?
- How does advancement unlock something?
- Does this place, settlement, or group need simulation at all?

For each journey, identify what the author must understand, where identity and
state are owned, which prerequisites are real, which are implementation
artifacts, and whether a contextual action can preserve the author's current
character/scene/item. Prefer one clear next action over a generic reveal of an
entire subsystem.

Before accepting the recommendations below, manually walk a blank, partially
configured, and mature project in both LitRPG and Game Simulation modes at
desktop and narrow widths. Confirm general-fiction projects remain unaffected.
This review changes no code, storage, or roadmap status.

## 2. Executive finding

The systems layer has legitimate domain separation but exposes too much of
that separation as navigation. Progressive disclosure has overcorrected into
concealment:

```text
Rules     → Open World Bible, or reveal Advanced rules
Sheets    → Open World Bible, or reveal Advanced sheet setup
Mechanics → Open World Bible, or reveal Advanced mechanics
```

The basic character journey is materially better than the old all-controls-at-
once experience: a saved World Bible character can create one tracked value,
receive one canon-linked sheet, and record an explicit scene change. The
problem is what surrounds that journey. Three visible destinations now look
redundant until the author crosses an opaque **Advanced…** boundary, and
**Advanced mechanics** hides several different author jobs rather than one
coherent advanced version of the basic task.

The recommended direction is a single author-facing **Systems** entry under
`More`, organized by recognizable jobs. It should initially orchestrate the
existing owners rather than merge stores or rewrite domain services. Contextual
entry from Workspace and World Bible remains important, but World Bible stops
being presented as the universal starting point for all system work.

## 3. Current ownership is valid

The app needs the distinctions below even if navigation stops exposing them as
peer destinations.

| Owner | Durable responsibility | Author-facing explanation |
|---|---|---|
| World Bible | canonical identity and descriptive truth | What it is |
| Ruleset | definitions, limits, formulas, templates, and reusable value vocabulary | What can be measured and how the measurement behaves |
| Character sheet + state ledger | baseline plus accepted scene-scoped changes for one canonical character | What is true for this character at this point in the story |
| Compendium/mechanics | reusable behavior for entries, effects, actions, progression, recipes, zones, and settlements | What it can do and how it participates in a system |
| Workspace | prose-proximate proposal and explicit scene evidence | What changed here in the manuscript |

These are ownership boundaries, not necessarily navigation labels. A Systems
hub must call the existing services and routes; it must not add a second write
path or blur canon, definitions, and manuscript-time state into one record.

## 4. Current-state evidence

### Navigation and project gating

- `Navigation.tsx` exposes `Rules`, `Sheets`, and `Mechanics` as separate items
  under the `Systems` group. Rules and Sheets depend on rule-authoring
  capability; Mechanics depends on game systems.
- `projectMode.ts` enables the full system toggle set by default for LitRPG and
  Game Simulation, and disables it for General Fiction.
- Routes remain separate: `/ruleset`, `/sheets`, and `/compendium`.

### Rules

- `RulesetRoute.tsx` begins with a calm panel. If no ruleset exists it sends
  the author to World Bible to add one value to a character. If a ruleset
  exists it again points to World Bible for ordinary use.
- The route's other meaningful action is **Advanced rules**, which reveals the
  full `WorldBuildingWizard`, import/export, definitions, templates, types,
  and limits.
- There is no middle-level task model explaining when an author would edit a
  definition, add another tracked value, or use a formula.

### Sheets and state

- `BasicCharacterStatePanel.tsx` is the clearest current task surface:
  **Record a scene change** with character, scene, value, Change by/Set to,
  before/after preview, and explicit confirmation.
- The secondary choices are **Inventory, equipment, status, or location** and
  **Advanced sheet setup**. The former names an author job; the latter names
  complexity rather than purpose.
- With no sheet, the route sends the author to World Bible. Advanced mode
  contains baseline construction, runtime/history tools, and repair-oriented
  controls under the broad heading **Advanced sheet and state**.

### World Bible entry

- `WorldBibleMechanicsPanel.tsx` gives a saved canonical character the best
  first-use flow in the system: choose Stat or Resource, name it, set a starting
  value, and confirm one atomic setup.
- Once configured, it shows current values and scene-change count, with actions
  for **Record a scene change** and **Advanced sheet and state**.
- This contextual entry is useful because character identity already exists.
  Repeating it as the required first step on every system route makes World
  Bible look like the systems hub even though it owns canon rather than system
  design.

### Mechanics/Compendium

- `CompendiumRoute.tsx` initially shows only **Open World Bible** and
  **Advanced mechanics**.
- Revealing advanced mechanics exposes four tabs: Overview, Entries,
  Progression, and World Systems.
- Entries combines custom creatures/resources/artifacts, World Bible-linked
  entities, reusable effects, discovery scope, and action logging.
- Progression combines milestones, recipes, unlocks, and craftability.
- World Systems combines zones, settlements, and party synergy and has another
  project setting prerequisite.
- The route also presents completion-like next steps such as creating an entry,
  milestone, recipe, action log, and zone. Although technically optional, the
  checklist language can imply that a project is incomplete until unrelated
  systems are configured.

### Workspace

- Prose selection and deterministic review can prepare item acquisition,
  consumption, inventory, and attribute-change proposals in context.
- This is directionally correct: the shortest path for a story event stays next
  to the prose, while reusable definitions and state remain distinct behind the
  proposal.
- The wider Systems experience does not currently use this contextual model as
  its organizing principle.

## 5. Findings

### F1. “Advanced” hides purpose

`Advanced rules`, `Advanced sheet setup`, and `Advanced mechanics` communicate
difficulty, not outcome. An author cannot know whether the hidden surface is
relevant without opening it. Replace complexity labels with the job revealed:

| Current | Directional replacement |
|---|---|
| Advanced rules | Edit tracked values, limits, and formulas |
| Advanced sheet setup | Set character baselines |
| Advanced mechanics | Items, abilities, and progression |
| World Systems | Zones, settlements, and group systems |
| Hide advanced mechanics | Return to Systems overview |

Exact wording remains an author decision; the rule is durable: disclosure
labels name a capability or outcome, never merely its complexity tier.

### F2. World Bible is overused as a router

World Bible is the correct entry when the author is already looking at a
canonical character, item, or location. It is not the natural entry for
defining a project-wide value, creating a generic one-use item, designing a
milestone, or deciding whether settlement simulation is useful.

Explain the relationship once:

> World Bible identifies what something is. Systems tracks what it can do and
> how it changes through the story.

From Systems, let the author choose an existing canonical record in place. If
none exists and stable identity is genuinely required, explain why and offer a
focused creation/link handoff. Do not send the author to a general World Bible
landing page and require rediscovery of the original task.

### F3. The navigation mirrors stores, not author intentions

Rules, Sheets, and Mechanics are implementation nouns. The author arrives with
a verb: track, define, create, design, or configure. A task-based front door can
preserve all existing owners while preventing authors from learning storage
topology before they can use the feature.

### F4. Mechanics is several products behind one reveal

Reusable entries/effects, progression/rewards, crafting, and world simulation
do not share one obvious first journey. Calling all of them “advanced
mechanics” obscures when each becomes valuable. They should be separate task
areas even if they continue to share the Compendium route and services.

### F5. Optional setup is presented as completion work

Counts such as “Completed in this section: 0/2” and next-step lists spanning
entries, milestones, recipes, logs, and zones risk recreating a completeness
score. Optional systems should say what manuscript problem each solves and
appear only when the author chooses that problem. “Not configured” must not
mean “unfinished.”

### F6. The product has one strong pattern but does not generalize it

The strongest journey is contextual and minimal:

```text
saved character → add one useful value → preview → confirm → record a scene change
```

Other system journeys should follow the same structure:

```text
author goal → smallest useful definition → story-context preview → explicit confirm
```

The product should reveal definitions, templates, formulas, repair tools, and
simulation only when the chosen goal requires them.

## 6. Required author journeys

The manual review must walk these end to end and record every redirect,
prerequisite, term, loss of context, and uncertain next step.

### J1. Track one character value

Start with a saved World Bible character and no ruleset. Add Health, record a
change in a named scene, return to Workspace, and verify the state is visible at
the correct manuscript point. The author should understand the difference
between the Health definition, the character's starting value, and the scene
change without seeing internal record terminology.

### J2. Track a detailed character change

Record inventory, equipment, status, or location from prose and from the
Systems entry. Preserve character and scene context across the handoff. Confirm
that a generic object does not require a World Bible record and a reusable
canonical item remains an explicit choice.

### J3. Add or edit tracked values

From an existing project, add a second Stat or Resource, adjust limits/defaults,
and understand which existing sheets are affected. The entry wording must
explain why the definition is project-wide and why this is not ordinary World
Bible editing.

### J4. Create a reusable item, ability, or effect

Start both from prose and from Systems. Create a generic reusable mechanic and
link a named World Bible entity only when appropriate. Reuse it in a later scene
without silently creating canon or mutating state.

### J5. Design progression and rewards

Create a milestone, define what it unlocks, record progress, and inspect the
result. Explain the relationship among a progression action, threshold,
recipe/unlock, character/global scope, and actual story evidence.

### J6. Configure a world system only when needed

Start with a manuscript need such as “the settlement improves after this
chapter.” Enable the required capability, create the minimum zone/settlement
model, record one supported change, and return to the source scene. The project
must never appear incomplete for omitting this journey.

### J7. Return to a mature project

Open Systems after months away. Identify what the project tracks, which
characters and entities participate, where recent changes came from, and which
actions are available next without reconstructing setup order from three
routes.

## 7. IA alternatives

### A. Keep three visible destinations

Retain Rules, Sheets, and Mechanics under `Systems`, but rename every front
door and replace Advanced reveals with task-specific disclosures.

**Benefit:** smallest routing change. **Cost:** authors still need to understand
the technical partition before choosing where to begin. This treats symptoms
more than the navigation cause.

### B. One Systems hub, existing owners behind it — recommended for v1

Expose one `Systems` navigation item. The hub presents current project state
and author jobs, then opens an existing route or focused mode with intent and
context attached. Deep routes remain addressable for compatibility and
contextual links. World Bible and Workspace continue to open the same owners
directly when the task begins there.

**Benefit:** fixes the mental model without merging persistence or large route
components. It supports incremental slices and reversible navigation changes.
**Cost:** focused route state and return navigation must be designed carefully
so the hub does not become another dashboard that merely adds clicks.

### C. One consolidated Systems route with internal modes

Move Rules, Sheets/State, and Mechanics presentation into one route with modes
such as Character Tracking, Definitions, Items & Abilities, Progression, and
World Systems.

**Benefit:** strongest apparent unity. **Cost:** high-risk horizontal rewrite,
large component composition, difficult rollback, and temptation to combine
valid owners. Consider only after the hub demonstrates that authors repeatedly
cross the same boundaries and beta evidence shows the remaining route changes
are the problem.

## 8. Recommended author-facing model

The Systems landing question is:

> What do you want the story to keep track of?

Suggested task areas:

1. **Character tracking** — health, resources, inventory, equipment, status,
   location, and scene-scoped changes.
2. **Tracked values and rules** — define project-wide Stats, Resources,
   defaults, limits, and formulas.
3. **Items and abilities** — define reusable behavior and optionally attach it
   to established World Bible records.
4. **Progression and rewards** — milestones, unlocks, recipes, and advancement
   scope.
5. **World simulation** — zones, settlements, and group effects, shown only
   when enabled or explicitly requested.

Each area shows:

- what manuscript problem it solves;
- whether the project already uses it;
- the smallest useful next action;
- recent or relevant source scenes where available;
- a direct return to the originating character, entity, or scene.

The hub is not a completeness dashboard. It shows no percentage and never asks
the author to configure every area.

## 9. Progressive guidance

### Blank system state

Offer goal choices rather than setup order. A first visit should not require
the author to distinguish ruleset, sheet, state event, and compendium entry.

### Partially configured state

Resume the author's unfinished task with named context: “Continue tracking
Health for Sera,” not “Ruleset exists; open World Bible.” Show prerequisites
only for the chosen goal.

### Mature state

Summarize active capabilities and recent accepted changes. Prefer “3 characters
track Health and Mana” over store counts. Link definitions to consumers and
changes to source scenes.

### Contextual entry

- Workspace keeps prose-proximate changes shortest.
- World Bible keeps entity/character identity in context.
- Systems supports goal-first creation and return.
- No path silently accepts canon, applies state, or defines mechanics.

## 10. Decisions requiring author approval

| Decision | Recommended default | Alternative |
|---|---|---|
| Primary navigation | one `Systems` item under More | keep Rules/Sheets/Mechanics visible |
| V1 composition | hub orchestrates existing routes | consolidate routes now |
| World Bible role | contextual identity entry, not universal router | require all entity mechanics to begin there |
| First-visit question | “What do you want the story to keep track of?” | start with character Health only |
| Rules label | Tracked values and rules | Rules |
| Sheets label | Character tracking | Sheets/State |
| Compendium label | split visibly into Items & Abilities, Progression, World Simulation | Mechanics |
| Generic objects | state/mechanics without required canon | require World Bible record |
| Optional progress | capability summaries, no completion fractions | retain next-step checklist |
| Existing routes | preserve as focused/deep compatibility destinations | remove after hub ships |

## 11. Provisional implementation slices — not scheduled

These are planning candidates only. Do not claim or execute them until the
author accepts the IA and they are moved into `docs/road-to-market.md` with
self-contained prompts.

| Placeholder | Slice | Size | Depends on |
|---|---|---:|---|
| SYS-1 | Manual journey evidence and final IA decision | S | — |
| SYS-2 | Systems hub shell, single navigation entry, and deep-route compatibility | M | SYS-1 |
| SYS-3 | Character tracking and tracked-value journeys | M | SYS-2 |
| SYS-4 | Items/abilities and progression task split | L | SYS-2 |
| SYS-5 | World simulation entry and optional-state guidance | M | SYS-2 |
| SYS-6 | Context-preserving Workspace/World Bible handoffs and vocabulary sweep | M | SYS-3–SYS-5 |

Likely boundaries:

- **SYS-1** runs J1–J7 in blank/partial/mature fixtures, records evidence, and
  resolves the decisions in §10. It changes no product behavior.
- **SYS-2** adds the hub and navigation only; it does not merge stores, clone
  forms, or remove deep routes.
- **SYS-3** makes character tracking and definition editing understandable from
  both hub and context while keeping the current atomic setup/state services.
- **SYS-4** replaces Advanced Mechanics with separate author jobs using the
  current Compendium owners.
- **SYS-5** isolates optional zones/settlements/group systems so their absence
  never reads as incomplete setup.
- **SYS-6** closes navigation loops, removes remaining author-facing Advanced
  labels in scope, updates help/onboarding, and validates source-scene return.

## 12. Acceptance standard for the eventual redesign

An author who has never seen the data model can answer all of these without
external documentation:

- Why would I use Systems?
- What is the smallest useful thing I can do here?
- Why is this separate from World Bible?
- Am I changing a definition, a character baseline, or story-time state?
- Will this action change canon or the manuscript?
- Where can I see the scene that caused this value?
- Can I ignore progression or settlement without leaving the project
  unfinished?

The implementation must preserve the standing trust boundary: models propose,
deterministic code validates, and authors approve. No hub or contextual
shortcut may write directly to canon, reusable mechanics, or state. Existing
backup, migration, replay, stable-identity, and project-mode contracts remain
in force.

## 13. Anti-goals

- No second World Bible or duplicate entity identity.
- No new persistence path merely to support the hub.
- No automatic conversion of prose into accepted state or mechanics.
- No mandatory mechanics wizard at project creation.
- No completion score for optional systems.
- No broad route merge before the task-based hub is validated.
- No general-fiction pressure to enable game systems.
- No relabel-only pass that leaves the same opaque journey underneath.
