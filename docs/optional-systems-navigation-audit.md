# Optional Systems Navigation Audit

Last updated: 2026-06-28

## Purpose

Decide how LitRPG, progression, ruleset, compendium, character-sheet, and settlement mechanics should be exposed without making the product feel like a mechanics IDE before it feels like a writing workspace.

This is an information-architecture audit, not a new mechanics feature spec.

## Product Decision

Worldbuilding-Desk should lean harder into LitRPG and system-heavy fiction as a differentiator, but those systems should remain attached to the writing workflow:

- `Workspace` stays the daily writing surface.
- `World Bible` stays the structured canon home.
- `Lore Docs` stays the longform/source-material surface.
- LitRPG systems are optional support for continuity, progression, and state, not the default shape of every project.

The right product model is:

1. Write the scene.
2. Capture or review canon.
3. Add mechanics only when the author wants tracked progression, rules, resources, crafting, discovery, settlement, or runtime state.

## Current Code State

Existing gates already provide the right foundation:

- [projectMode.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/projectMode.ts) defines `general`, `litrpg`, and `game` modes plus feature toggles for game systems, runtime modifiers, settlement/zone systems, and rule authoring.
- [Navigation.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/components/Navigation.tsx) keeps `Workspace`, `World Bible`, and `Lore Docs` in primary navigation, while `Ruleset` and `Compendium` appear only in the secondary menu when their capabilities are enabled.
- [App.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/App.tsx) redirects `/ruleset` back to `/workspace` when rule authoring is disabled.
- [CompendiumRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/CompendiumRoute.tsx) shows an in-route disabled message when game systems are off, but does not yet route-gate `/compendium`.
- [CharactersHubRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/CharactersHubRoute.tsx) exposes sheets/state only when rule authoring is enabled and a ruleset exists.
- [WorkspaceRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/WorkspaceRoute.tsx) already derives `showGameSystems` and `showRuleAuthoring` from project capabilities.

## IA Problems To Solve Next

1. `Ruleset` and `Compendium` still read like peer destinations when enabled, even though they are really one optional systems cluster.
2. `Compendium` is still a technical noun. It is accurate internally, but author-facing copy should emphasize `Mechanics` where the workflow is about attaching progression or tracked state to canon records.
3. Direct route behavior is inconsistent: `/ruleset` redirects when disabled, while `/compendium` renders an explanatory disabled page.
4. `Characters` remains a mixed surface: roster/tool profiles are secondary, while sheets/state belong to the optional systems layer.
5. The current UI gives LitRPG authors several powerful tools, but not a single clear path such as `Systems -> Rules, Mechanics, Sheets`.

## Implemented Slice

Branch: `codex/optional-systems-nav-audit`

Goal:

Make optional systems feel like one discoverable, mode-gated cluster while preserving the writing-first primary navigation.

Completed:

1. Added a shared optional-system route gate so disabled direct routes behave consistently.
2. Grouped enabled systems in navigation under a `Systems` section instead of presenting `Ruleset` and `Compendium` as unrelated peers.
3. Added `Sheets` to the systems navigation path for rule-authoring projects.
4. Renamed destination-level compendium entry points toward `Mechanics`, while leaving storage/service names alone.
5. Kept `Workspace`, `World Bible`, and `Lore Docs` untouched as primary destinations.
6. Kept the existing project-mode feature toggles as the source of truth.

Out of scope:

- new rules-engine capabilities
- new settlement mechanics
- compendium data-model changes
- broad restyling of the compendium route
- moving character canon out of World Bible

Recommended follow-up:

- Run a browser smoke pass with one general-fiction project and one LitRPG project to verify the actual menu contents, disabled-route redirects, and `Sheets` query navigation.
- Continue broader Mechanics route polish separately; this slice only renamed the destination-level surface and a few high-signal copy points.

## Acceptance Bar

- General-fiction projects do not expose rulesets, character sheets, compendium/mechanics, runtime modifiers, or settlement systems from normal navigation.
- Direct visits to disabled optional-system routes redirect back to the writing workspace.
- LitRPG/game projects can still find rules, mechanics, sheets/state, and world systems without repo knowledge.
- Navigation copy makes optional systems feel attached to writing and canon, not like a competing product mode.
- Build passes; browser smoke should still cover at least one general-fiction project and one LitRPG project before packaging.
