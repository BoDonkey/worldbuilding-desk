# Entity Ownership And Intake Refactor Plan

_Drafted: April 30, 2026_

## Current status

_Updated: May 2, 2026_

What is now true in the app:

- workspace intake no longer auto-creates compendium records
- character-like intake creates `Character` records instead of forcing world-record-first creation
- workspace character intake can hand off directly into `Characters` and one-click `CharacterSheet` creation
- character stats, resources, inventory, and status editing are now easier to discover from the sheets flow
- workspace category inference is broader and less aggressive about auto-promoting weak place-like phrases into real locations
- `World Bible` now treats compendium as optional `Mechanics`, not a required second destination
- `Characters` can create or open linked World Bible lore entries
- World Bible can import character-like canon entries into `Characters`
- World Bible editor now surfaces duplicate and alias overlap warnings inline, and can merge duplicate world records
- explicit world-record additions now use a lighter `New` state instead of clogging the review queue
- first-time location mechanics no longer silently create a generic discovery record; they open a prefilled mechanics chooser
- compendium discovery can now be character-scoped
- zone profiles can be linked to specific locations and scoped
- settlement/community now attaches to a specific location instead of floating as one generic project-wide concept
- mechanics entries now default to a summary-first location mechanics card, with lower-level controls hidden behind `Edit Mechanics`

What still needs dogfood attention:

- the location mechanics flow is much clearer than before, but still needs real author testing to confirm the chooser and summary surfaces feel obvious
- `per party` mechanics scope is intentionally hidden in the UI until a true party-state model exists
- settlement is now location-keyed, but the UX still needs validation for stories with multiple active settlements
- the next work should probably come from dogfood notes, not more speculative structural refactoring

Recommended next-chat starting point:

- use this document as the product/model baseline
- treat the remaining work as UX validation and targeted cleanup
- start from current dogfood observations, not from older assumptions about the intake architecture

## Dogfood findings added May 2, 2026

Recent author testing exposed a few concrete follow-up gaps:

- World Bible location records do not seem to need heavyweight review cards; lightweight `New` / `Needs completion` / alias badges are likely enough
- the app still lacks a clean path to promote a fuller character name into the canonical base name while preserving the earlier short form as an alias
- consistency can notice some wrong-name problems, but it does not yet reason well about `unexpected scene presence` versus a legitimate mention of an established canon character
- chapter editing still lacks a direct find/replace workflow, which makes fixing consistency slips slower than it should be
- more broadly, World Bible lore handling likely needs a rethink so canon facts, scene references, aliases, and author cleanup do not all collapse into one overloaded record-management surface

Implication:

- the next pass should not just keep adding queue affordances; it should simplify World Bible review burden and separate `canon storage` from `author cleanup workflow` more deliberately

## Longform lore direction added May 2, 2026

Another important dogfood takeaway:

- the current World Bible still behaves too much like a structured database with a few short fields
- that is not a good fit for authors who think in longform character dossiers, item histories, regional history, myths, timelines, and exploratory world notes
- adding more short fields is probably the wrong answer

What the product likely needs instead:

- lightweight canon records for operational facts:
  - name
  - aliases
  - category / type
  - key facts
  - links
  - mechanics attachments when relevant
- separate longform lore documents for deep writing:
  - character backstories
  - item provenance
  - place history
  - faction notes
  - myths and religions
  - historical eras and timelines
  - AI-assisted rubber-ducking sessions that get refined into canon

This suggests a better model:

- `WorldEntity` should be an anchor, not the container for all lore
- a canon record can link to one or more lore documents
- the author should be able to move fluidly between:
  - structured canon facts
  - longform prose notes
  - scene references
  - AI-assisted expansion / refinement

Example:

- one character record might link to:
  - `Character dossier`
  - `Childhood and family history`
  - `Detective career timeline`
  - `House Moreland notes`

Likewise the world itself may need first-class lore documents that are not forced into one entity row:

- `World history`
- `The age before the empire`
- `Religions and myths`
- `Trade routes and cities`
- `Magic theory`

## Companion-book possibility

Dogfood also surfaced a higher-level publishing opportunity:

- deep worldbuilding material should eventually be extractable into a `World of XXX` style companion novel / lore book

That only works well if the app stores rich narrative source material, not just sparse field values.

Product implication:

- the app should eventually support compiling selected lore documents and canon records into export-ready longform artifacts
- that export path could become:
  - companion book drafts
  - setting guides
  - character dossiers
  - in-universe reference books

Recommended design stance:

- do not keep stretching the current World Bible form model
- move toward `canon records + longform lore docs + AI conversation-to-canon workflow`
- treat this as a distinct product direction, not just another World Bible form enhancement

## Why this refactor is necessary

Dogfooding exposed a real product-model problem:

- workspace review acceptance currently creates a `WorldEntity`
- the same action also creates a `CompendiumEntry`
- `CharacterSheet` creation is still a separate path
- character stats and runtime resources exist in the app, but they are not discoverable from the intake flow

This creates three different user-visible destinations for one fictional thing and forces the author to understand storage layers instead of story concepts.

The goal of this refactor is not to rebuild the app. The goal is to make intake ownership coherent and make LitRPG systems feel attached to the writing workflow instead of parallel to it.

## Current code-level problem

These are the main seams causing the confusion:

- [apps/web/src/hooks/useWorkspaceConsistency.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/hooks/useWorkspaceConsistency.ts) `resolveUnknownEntity(...)` creates a `WorldEntity` and immediately calls `upsertCompendiumEntryFromEntity(...)`.
- [apps/web/src/services/compendium/compendiumService.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/services/compendium/compendiumService.ts) treats compendium records as first-class creations derived from `WorldEntity`, but there is no intake policy controlling when that should happen.
- [apps/web/src/routes/WorldBibleRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/WorldBibleRoute.tsx) exposes `Add to Compendium` per entity, which reinforces compendium as a second required destination.
- [apps/web/src/routes/CharacterSheetsRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/CharacterSheetsRoute.tsx) is where stats, inventory, statuses, and runtime mutation history actually live, but workspace intake does not naturally route authors there.
- [apps/web/src/entityTypes.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/entityTypes.ts) contains overlapping concepts:
  - `Character`
  - `CharacterSheet`
  - `WorldEntity`
  - `CompendiumEntry`

## Product decision

The app should adopt this user-facing model:

- `Characters` answers: who acts and changes?
- `World Bible` answers: what is this in canon?
- `Compendium` answers: what has progression or system behavior?

The important constraint is:

`Compendium` is not a primary intake destination.

It is an optional mechanics layer attached to an existing canonical record.

## Canonical ownership by entity type

### Regular fiction mode

- `character` -> `Characters`
- `location` -> `World Bible`
- `item` -> `World Bible`
- `faction` -> `World Bible`
- `creature` -> `World Bible`
- `concept` or `rule` -> `World Bible`
- no compendium record by default

### LitRPG mode

The same primary ownership still applies:

- `character` -> `Characters`
- `location` -> `World Bible`
- `item` -> `World Bible`
- `creature` -> `World Bible`

Optional system attachments may then apply:

- `character` may have sheet stats, resources, inventory, statuses, progression hooks
- `item` may have compendium or crafting metadata
- `creature` may have bestiary, loot, hunt, or discovery metadata
- `location` may have discovery, zone affinity, or mastery metadata

Not every LitRPG record gets a compendium entry.

## Intake rules

When the workspace flags a detected reference, the accept action should route it once:

### Character

- create or link a `Character`
- offer immediate optional creation of a linked `CharacterSheet`
- if LitRPG mode is enabled, surface a shortcut to add stats/resources now or later
- do not create a compendium entry by default

### Item

- create or link a `WorldEntity` in an item category
- if LitRPG mode is enabled and the item is craftable, collectible, unlockable, or tracked for progression, offer `Add mechanics`
- `Add mechanics` creates or links a compendium attachment

### Location

- create or link a `WorldEntity` in a location category
- if LitRPG mode is enabled and discovery/mastery matters, offer `Add mechanics`

### Creature

- create or link a `WorldEntity` in a creature category
- if LitRPG mode is enabled and the creature is discoverable, huntable, lootable, or progress-worthy, offer `Add mechanics`

### Existing record match

- alias-linking should continue to work against both `WorldEntity` and `Character`
- the UI should say `Connect to existing` rather than expose storage-language distinctions

## Data model direction

This should be handled as ownership cleanup, not a big-bang schema rewrite.

### Keep

- `WorldEntity` for world canon records
- `Character` and `CharacterSheet` for actor identity plus sheet/runtime state
- `CompendiumEntry` for progression metadata

### Change

- stop auto-creating `CompendiumEntry` from generic workspace intake
- add explicit attachment metadata so compendium records are clearly secondary
- formalize an intake classification type instead of inferring everything from ad hoc category slugs

### Recommended additions

- Add `EntityKind` or similar app-level classification:
  - `character`
  - `location`
  - `item`
  - `creature`
  - `faction`
  - `concept`
- Add optional `sourceRecordType` and `sourceRecordId` to mechanics attachments if needed beyond `sourceEntityId`
- Add a small character-intake helper that can create:
  - `Character` only
  - `Character` plus empty `CharacterSheet`

### Deferred decision

Do not merge `Character` and `CharacterSheet` in this pass.

They are currently separate and useful:

- `Character` is roster/canon identity
- `CharacterSheet` is rules/system state

What must change is the intake path between them.

## UI changes

### Workspace review popover

Current:

- `Add to World`
- creates world entity
- also creates compendium entry

Target:

- `Add Character`
- `Add Location`
- `Add Item`
- `Add Creature`
- `Connect to existing`
- optional secondary action in LitRPG mode: `Add mechanics`

The workspace should not ask authors to think about `World Bible` versus `Compendium` during first acceptance.

### Character creation flow

After adding a character from workspace:

- land on a lightweight completion state
- show `Create sheet` or `Open sheet`
- in LitRPG mode, show `Add stats and resources`

The author should not have to discover `Character Sheets` via navigation after intake.

### World Bible review treatment

Dogfood suggests the review model should be lighter for at least some canon types:

- location records should generally rely on inline badges/state instead of a heavyweight review-card queue
- queue-like review should be reserved for cases where an author actually needs a focused cleanup workflow, not for every fresh lore record
- alias follow-up may still matter, but it should not force location canon into the same review experience as higher-touch character cleanup

### World Bible entity actions

Keep `Add mechanics`, but rename/reframe the current compendium action:

- from `Add to Compendium`
- to `Add mechanics`

The button should explain what it does in plain language:

- discovery actions
- crafting hooks
- drops
- zone mastery
- progression tracking

### Character sheet route

Make this the obvious home for:

- base stats
- dynamic resources like mana
- inventory
- equipment
- statuses
- scene-derived state mutation history

If the project mode is `general`, this surface can stay hidden or reduced unless the user explicitly enables game systems.

### Canonical rename and alias promotion

The app needs a first-class cleanup path for authoring reality:

- if a character first appears as `Harlow` or `Moreland` and later the author settles on `Detective Harlow Moreland`, the canonical record should be able to adopt the fuller name
- the prior shorter form should automatically remain as an alias
- scene/lore matching should refresh so both names continue to resolve without duplicate-record cleanup

This is not just alias editing. It is a canonical rename flow with alias preservation.

### Lore handling rethink

The current World Bible is carrying too many jobs at once:

- canon authoring
- review cleanup
- alias administration
- duplicate resolution
- scene-derived follow-up

The next UX rethink should evaluate whether lore handling should separate:

- stable canon records
- scene review inbox / cleanup tasks
- name resolution and alias management
- contextual scene presence warnings

That separation may matter more than additional queue controls.

## Implementation plan

## Slice 1: Stop duplicate intake

Goal:

Accepting a workspace-detected entity creates one primary record only.

Changes:

- Update `resolveUnknownEntity(...)` in [apps/web/src/hooks/useWorkspaceConsistency.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/hooks/useWorkspaceConsistency.ts)
- remove automatic `upsertCompendiumEntryFromEntity(...)` from generic intake
- route character acceptance to character creation instead of world-only entity creation

Files likely touched:

- [apps/web/src/hooks/useWorkspaceConsistency.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/hooks/useWorkspaceConsistency.ts)
- [apps/web/src/routes/WorkspaceRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/WorkspaceRoute.tsx)
- [apps/web/src/entityTypes.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/entityTypes.ts)

Acceptance criteria:

- accepting an item or location no longer creates a compendium record
- accepting a character creates a character record, not just a world record
- linking to an existing record still works

## Slice 2: Add explicit intake classification

Goal:

The app chooses the correct home for a detected reference based on intent, not category slug guesswork.

Changes:

- introduce a lightweight intake classification model
- map review candidates to one of:
  - `character`
  - `location`
  - `item`
  - `creature`
  - `unknown`
- add project-mode-aware defaults:
  - `general`
  - `litrpg`

Files likely touched:

- [apps/web/src/entityTypes.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/entityTypes.ts)
- [apps/web/src/hooks/useWorkspaceConsistency.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/hooks/useWorkspaceConsistency.ts)
- [apps/web/src/services/worldEngine/types.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/services/worldEngine/types.ts)
- [apps/web/src/services/worldEngine/DeterministicWorldEngine.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/services/worldEngine/DeterministicWorldEngine.ts)

Acceptance criteria:

- intake no longer depends on broad `characters/locations/items` fallback only
- UI copy reflects entity type directly

## Slice 3: Character-first intake completion

Goal:

Authors can go from flagged character to usable stats/inventory surface without hunting through the app.

Changes:

- add a helper/service for creating a `Character`
- optionally create a blank `CharacterSheet` at intake time
- provide `Open sheet` and `Create sheet` follow-up actions after character acceptance
- prefill the selected character inside `CharacterSheetsRoute`

Files likely touched:

- [apps/web/src/characterStorage.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/characterStorage.ts)
- [apps/web/src/services/characters/characterSheetService.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/services/characters/characterSheetService.ts)
- [apps/web/src/routes/CharacterSheetsRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/CharacterSheetsRoute.tsx)
- [apps/web/src/routes/CharactersHubRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/CharactersHubRoute.tsx)
- [apps/web/src/routes/WorkspaceRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/WorkspaceRoute.tsx)

Acceptance criteria:

- a newly accepted character can reach sheet editing in one click
- mana/resources are visible where expected for LitRPG projects

## Slice 4: Reframe compendium as mechanics attachment

Goal:

Compendium becomes optional and deliberate instead of feeling mandatory.

Changes:

- rename UI affordances from `Add to Compendium` to `Add mechanics`
- keep compendium creation on World Bible and Compendium routes
- only surface the action in LitRPG or game-system-enabled projects
- preserve `sourceEntityId` linkage for world records

Files likely touched:

- [apps/web/src/routes/WorldBibleRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/WorldBibleRoute.tsx)
- [apps/web/src/routes/CompendiumRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/CompendiumRoute.tsx)
- [apps/web/src/components/Workspace/WorkspaceContextDrawer.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/components/Workspace/WorkspaceContextDrawer.tsx)
- [apps/web/src/components/Navigation.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/components/Navigation.tsx)

Acceptance criteria:

- compendium is clearly optional in UI language
- authors do not encounter compendium unless systems are enabled or relevant

## Slice 5: Character sheet discoverability and stat editing

Goal:

LitRPG authors can obviously find and edit base stats and dynamic stats.

Changes:

- add stronger empty-state copy to character sheets
- show project-ruleset-derived stat and resource sections more prominently
- add `no ruleset/no stat definitions` guidance
- if appropriate, add a direct workspace shortcut: `Open stats`

Files likely touched:

- [apps/web/src/routes/CharacterSheetsRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/WorkspaceRoute.tsx)
- [apps/web/src/routes/WorkspaceRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/WorkspaceRoute.tsx)

Acceptance criteria:

- a LitRPG author can find mana/resource editing without prior repo knowledge
- a general-fiction author is not burdened with the same UI

## Migration and compatibility

This refactor should preserve current data where possible.

### Existing world entities

- remain valid
- still optionally support compendium linking through `sourceEntityId`

### Existing compendium records

- remain valid
- continue to resolve against linked world entities

### Existing character sheets

- remain valid
- may continue to exist without a linked `Character`, but new intake should prefer linking

### Optional cleanup migration

Later, add a one-time repair tool to detect:

- compendium entries with no clear source entity
- character-like world entities with no linked character record
- character sheets with missing character links

This should be a secondary cleanup task, not part of the first UX fix.

## Risk assessment

### Low risk

- removing automatic compendium creation from workspace intake
- renaming compendium actions in UI
- better character-sheet entry points

### Medium risk

- changing review acceptance to create `Character` records
- introducing new intake classification logic

### Higher risk

- any attempt to merge `Character`, `CharacterSheet`, and `WorldEntity`
- any migration that rewrites existing records in place

Avoid the higher-risk path in this pass.

## Recommended execution order

1. Slice 1: stop duplicate intake
2. Slice 3: character-first intake completion
3. Slice 4: compendium as mechanics attachment
4. Slice 5: stat/resource discoverability
5. Slice 2: stronger intake classification
6. World Bible follow-up:
   canonical rename with alias preservation, lighter location review treatment, and a broader lore-handling rethink

This order intentionally fixes the lived user pain first before improving classification sophistication.

## Success definition

The refactor is successful if these flows feel obvious:

### General fiction

- a flagged person becomes a character
- a flagged place becomes a world record
- no one sees compendium unless they explicitly opt into systems

### LitRPG

- a flagged person becomes a character and can get a sheet immediately
- mana, inventory, and status editing are easy to find
- a flagged creature or item can optionally gain mechanics metadata
- the author never has to manually create the same thing in two places just to make the system usable

## Immediate next coding task

Implement Slice 1 first.

The first code change should be:

- remove automatic `upsertCompendiumEntryFromEntity(...)` from workspace review acceptance
- replace it with primary-destination routing based on intended entity type

That is the smallest change that directly addresses the dogfooded failure.
