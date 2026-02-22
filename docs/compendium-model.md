# Compendium Progression Model

_Drafted: February 22, 2026_

## Why this is not beast-only

A beast-only bestiary works at first, but progression systems usually expand to:

- flora/herbs
- ores/minerals
- artifacts/relics
- future custom domains (factions, fish, spirits, etc.)

To avoid painting ourselves into a corner, this model uses a generic **compendium** with domain tags.

## Core concept

- `World Bible` holds lore/canon entities.
- `Compendium` holds progression mechanics:
  - action points (`discover`, `kill`, `skin`, `harvest`, etc.)
  - milestone unlocks
  - permanent reward effects
  - recipe unlocks

## Implemented data model

### App types (`apps/web/src/entityTypes.ts`)

- `CompendiumEntry`
- `CompendiumActionDefinition`
- `CompendiumMilestone`
- `CompendiumRewardEffect`
- `UnlockableRecipe`
- `CompendiumProgress`
- `CompendiumActionLog`

### IndexedDB stores (`apps/web/src/db.ts`)

- `compendium_entries`
- `compendium_milestones`
- `compendium_recipes`
- `compendium_progress`
- `compendium_action_logs`

## Service layer

`apps/web/src/services/compendiumService.ts` includes:

- CRUD for entries, milestones, recipes
- progress loading/creation (global or per character-sheet scope)
- action logging with points awarding
- non-repeatable action guard
- milestone unlock evaluation
- recipe unlock propagation from milestones

## Rules engine integration

`packages/rules-engine/src/types/WorldRuleset.ts` now includes optional `compendium` config:

- enabled flag
- supported entry domains
- milestone definitions

This makes compendium progression an explicit part of world/rules design.

## Suggested next UI step

1. Add a **Compendium route** with:
   - Entries tab
   - Milestones tab
   - Recipes tab
   - Progress panel (total points + unlocked items)
2. Add a quick action drawer to World Bible entities for logging actions.
3. Surface unlocked permanent effects on character sheets.

## Crafting Tiers + Ailments (Architecture)

- Recipes now support requirements:
  - `minCharacterLevel`
  - `requiredMilestoneIds`
  - optional material requirements
- `canCraftRecipe(...)` is available in `compendiumService` for craft gating checks.
- Rules engine `StateManager` now supports:
  - `advanceTime(...)` with `seconds` or abstract `ticks`
  - exposure tracking (`recordExposure`, `clearExposure`)
  - threshold-based ailment application (`applyExposureAilments`)
- Example cave-lung preset:
  - `packages/rules-engine/examples/cave-lung-preset.ts`

## Sector Mastery (Zone Affinity)

Implemented as a biome-specific progression layer:

- `ZoneAffinityProfile`: biome definition, max points, and milestone thresholds.
- `ZoneAffinityProgress`: accumulated exposure/points per biome.
- Exposure recording and unlock evaluation:
  - `recordZoneExposure(...)`
  - `getZoneAffinityPercent(...)`
- Persistence stores:
  - `zone_affinity_profiles`
  - `zone_affinity_progress`
- Initial UI in Compendium route supports:
  - creating zone profiles
  - recording exposure time
  - viewing affinity % and unlocked 25/50/100 milestones
