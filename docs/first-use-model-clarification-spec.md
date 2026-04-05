# First-Use Model Clarification Spec

Date: 2026-04-04

## Purpose

Define the first implementation slice for fixing the highest-friction onboarding/model issues found during dogfooding.

This slice is intentionally narrow:

- project creation should establish project intent
- General Fiction should stop inheriting LitRPG-first assumptions by default
- the difference between `World Bible` and `Characters` should become understandable

This is not a full redesign.

## Current Problems

### 1. Project creation is too thin

Current flow:

- project creation only captures `name`
- `Project Mode` is hidden in Settings
- default settings creation falls back to `litrpg`

Current code:

- [ProjectsRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/ProjectsRoute.tsx)
- [settingsStorage.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/settingsStorage.ts)

Consequence:

- new projects start with the wrong conceptual posture
- users see ruleset/system-heavy assumptions before choosing them

### 2. General Fiction is not a real first-use path yet

Current behavior:

- `Project Mode` exists in settings
- feature toggles do change by mode
- but the user is not guided into that mode at creation time

Current code:

- [projectMode.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/projectMode.ts)
- [SettingsRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/SettingsRoute.tsx)

Consequence:

- General Fiction feels like a hidden option rather than a supported path

### 3. Surface boundaries are unclear

Observed confusion:

- what is the difference between World Bible character records and the Characters route?

Consequence:

- users do not know where to put information
- the data model feels duplicated instead of intentional

## Product Decisions

These are the decisions this slice should codify.

### Project Modes

- `General Fiction`: writing, planning, world lore, cast management, AI assistance without system-heavy assumptions
- `LitRPG Author`: writing plus rules, progression, compendium, stat-block, and system-centric workflows
- `Game Simulation`: system-heavy mode for mechanics-first projects

### Surface Boundary

- `World Bible`: canon/lore records for the world, including people as world entities
- `Characters`: cast and author-facing character workspace
- `Character Sheets`: mechanics/gameplay profile surface, only primary in system-heavy modes

Practical meaning:

- in `General Fiction`, `Characters` should feel like cast profiles, not gameplay sheets
- in `LitRPG`/`Game Systems`, `Characters` can remain dual-purpose with roster + sheets

## Implementation Slice

## A. Move Project Mode Into Project Creation

### Goal

- let the user choose the project’s intended mode before any other route shapes their expectations

### UI changes

In [ProjectsRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/ProjectsRoute.tsx):

- add `Project Mode` selection to the `Create New Project` form
- show a short one-paragraph description for the selected mode
- replace current “Step 1 of 3: create a project shell” copy with mode-aware onboarding text

Recommended field order:

1. Project name
2. Project mode
3. Optional short “What this mode emphasizes” helper copy

### Default behavior changes

When a project is created:

- create the `Project`
- immediately create `ProjectSettings` with the selected mode
- set `featureToggles` from that selected mode

Implementation note:

- do not rely on `getOrCreateSettings()` to assign the correct mode later
- creation should be explicit and deterministic

### Required code changes

- [ProjectsRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/ProjectsRoute.tsx)
- [settingsStorage.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/settingsStorage.ts)

Recommended storage change:

- extend `createDefaultSettings(projectId)` to accept an optional mode parameter, e.g.
  - `createDefaultSettings(projectId, mode?)`

Then:

- call it from project creation with the selected mode
- keep fallback behavior for legacy projects

## B. Stop Defaulting New Projects To LitRPG Implicitly

### Goal

- prevent first-use confusion caused by hidden default mode assumptions

### Recommended change

In [settingsStorage.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/settingsStorage.ts):

- keep a fallback default for legacy safety
- but stop treating that fallback as the intended new-project path

Recommended fallback:

- keep `litrpg` only as a compatibility fallback if you do not want a migration now
- but all new project creation should set the mode explicitly

Optional follow-up:

- consider changing the storage fallback to `general` later if broader onboarding becomes the priority

## C. Rewrite First-Use Copy Around Modes

### Goal

- make the app’s model legible before users hit secondary routes

### Projects screen copy changes

Current problematic copy:

- “Step 3: create or edit a ruleset, then continue to World Bible and Workspace.”
- “Configure inheritance here, then use the Ruleset tab to author game rules.”

These are too LitRPG-specific.

Replace with mode-aware guidance:

- `General Fiction`:
  - “Start with World Bible for lore and Characters for cast notes, then draft in Workspace or plan in Corkboard.”
- `LitRPG Author`:
  - “Start with Ruleset if you need stats/resources, then build canon in World Bible and draft in Workspace.”
- `Game Simulation`:
  - “Start with rules and system structure, then layer narrative and world state on top.”

### Settings copy changes

In [SettingsRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/SettingsRoute.tsx):

- reframe `Project Mode` as a high-level product posture, not just a toggle bucket
- add a sentence explaining that it controls defaults and visible emphasis
- avoid implying that every project should author a ruleset

## D. Clarify World Bible vs Characters

### Goal

- remove the strongest information-architecture confusion from first use

### UI copy plan

In the route intros/help for:

- [WorldBibleRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/WorldBibleRoute.tsx)
- [CharactersHubRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/CharactersHubRoute.tsx)

Add short surface definitions:

- `World Bible`: “Canon records for people, places, items, factions, and world details.”
- `Characters`: “Your cast workspace for character profiles, notes, and, in system-heavy projects, gameplay sheets.”

### General Fiction behavior

In `General Fiction`:

- keep the roster/profile surface primary
- de-emphasize `Character Sheets`
- if `sheets` remain visible, label them more clearly as optional advanced/system-linked records

Implementation options:

1. Lower-risk:
   - keep both tabs
   - rename the sheets tab copy in General Fiction
   - add explanatory intro text
2. Higher-impact:
   - hide the sheets tab entirely in General Fiction unless the user enables system features

Recommendation:

- start with option 1 in this slice
- avoid route-structure churn until the model is clearer

## E. General Fiction Gating Rules

### Goal

- reduce obvious mode mismatch without large refactors

### Immediate gating rules

In `General Fiction`:

- do not tell the user to create a ruleset from the Projects screen
- hide or soften compendium-seeding prompts where possible
- avoid presenting system-heavy language as the primary explanation of the app

This slice does not need to eliminate every advanced feature from General Fiction.

It does need to stop advertising them as the expected next step.

## File-Level Work Plan

### Must change in this slice

- [ProjectsRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/ProjectsRoute.tsx)
- [settingsStorage.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/settingsStorage.ts)
- [SettingsRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/SettingsRoute.tsx)
- [CharactersHubRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/CharactersHubRoute.tsx)
- [WorldBibleRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/WorldBibleRoute.tsx)

### May change if needed

- [projectMode.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/projectMode.ts)
- [WorkspaceRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/WorkspaceRoute.tsx)
- [LoreInspectorPanel.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/components/Editor/LoreInspectorPanel.tsx)

## Out Of Scope For This Slice

- full route restructuring
- new AI chat/workshop product surface
- large import-parser improvements
- full compendium redesign
- full character model redesign

## Acceptance Criteria

This slice is done when:

1. A user can choose `General Fiction`, `LitRPG Author`, or `Game Simulation` during project creation.
2. A newly created project gets matching default settings immediately.
3. The Projects and Settings screens no longer imply that rulesets are the universal next step.
4. The UI explains the difference between `World Bible` and `Characters`.
5. A General Fiction user no longer gets the immediate impression that the app is primarily a system-mechanics tool.

## Recommended Build Order

1. Add explicit mode selection to project creation.
2. Update default settings creation to honor that mode.
3. Rewrite project/settings helper copy.
4. Add route-level explanatory copy for World Bible and Characters.
5. Add low-risk General Fiction gating for sheets/compendium-forward language.
