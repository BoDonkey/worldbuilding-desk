# Phase 1: Character Canon Unification

Last updated: 2026-05-29

## Current Status

Implementation slices A, B, D, C, and E are complete in the current working tree.

What is now true:

- app navigation and command/context labels no longer present `Characters` as a peer canon destination
- `World Bible > Characters` is framed as the home for canonical names, aliases, duplicate cleanup, review-created character records, and story-facing lore
- World Bible character records expose optional handoff actions for Character Tools, sheets, and state tracking
- `Characters` is reframed as `Character Tools`, with route copy focused on tool profiles, sheets, exports, and state rather than canonical identity
- workspace unknown-character intake creates World Bible character canon instead of also creating a Character Tools profile
- workspace alias linking stays in the workspace, clears the immediate prompt, and avoids duplicate Character Tools / World Bible options when a pair exists

Next work:

- Do a focused redesign of workspace text annotation before continuing smoke. The current split between known-lore highlights and unknown-review highlights is too fragile for natural fiction prose.
- Re-run the focused manual smoke checklist in [character-canon-unification-smoke-test.md](/Volumes/T7/Development/worldbuilding-desk/docs/character-canon-unification-smoke-test.md).
- Use any remaining smoke findings to decide whether Slice E needs small follow-up fixes before starting Phase 2 (`Lore` -> `Lore Documents`).

## Purpose

Implement Phase 1 from [navigation-simplification-roadmap.md](/Volumes/T7/Development/worldbuilding-desk/docs/navigation-simplification-roadmap.md):

- collapse character canon into `World Bible`
- stop making `Characters` a competing canonical home
- preserve advanced character-sheet/state tooling as secondary functionality

This document is intentionally implementation-oriented. It should be enough to drive the next coding slice without having to reopen multiple planning docs.

## What This Phase Checks Off

This phase directly advances existing roadmap goals:

- stronger World Bible review and alias workflow
- reduced top-level UX complexity
- route emphasis aligned with writing-first direction
- fewer exposed internal storage boundaries for authors

It should be treated as progress on current roadmap priorities, not a side initiative.

## End State For Phase 1

After this phase:

- authors create, rename, alias, merge, and review character canon in `World Bible`
- the `Characters` route no longer presents itself as the primary place to define who a character is
- any remaining `Characters` functionality is explicitly sheet/state/tooling-oriented
- the nav no longer suggests that `Characters` and `World Bible` are equal canon destinations
- workspace alias linking is low-intrusion: linking an alias should finish in place, not force navigation or immediate review

This phase does **not** need to remove all character tooling outside World Bible. It needs to remove the ambiguous ownership model.

## Current File Map

Primary files:

- [apps/web/src/routes/WorldBibleRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/WorldBibleRoute.tsx)
- [apps/web/src/hooks/useWorldBibleEntityActions.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/hooks/useWorldBibleEntityActions.ts)
- [apps/web/src/hooks/useWorldBibleReview.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/hooks/useWorldBibleReview.ts)
- [apps/web/src/routes/CharactersRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/CharactersRoute.tsx)
- [apps/web/src/routes/CharactersHubRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/CharactersHubRoute.tsx)
- [apps/web/src/routes/CharacterSheetsRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/CharacterSheetsRoute.tsx)
- [apps/web/src/components/Navigation.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/components/Navigation.tsx)
- [apps/web/src/commands/commandRegistry.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/commands/commandRegistry.ts)

Supporting logic:

- [apps/web/src/services/worldBible/worldBibleEntityHelpers.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/services/worldBible/worldBibleEntityHelpers.ts)
- [apps/web/src/services/worldBible/worldBibleReviewHelpers.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/services/worldBible/worldBibleReviewHelpers.ts)
- [apps/web/src/services/characters/characterMergeHelpers.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/services/characters/characterMergeHelpers.ts)
- [apps/web/src/hooks/useWorkspaceConsistency.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/hooks/useWorkspaceConsistency.ts)

## Main Product Decision For This Phase

Character canon belongs to `World Bible > Characters`.

That means:

- canonical character name
- aliases
- descriptive notes
- duplicate/canonical merge decisions
- review-created character cleanup

should all be authorable there first.

World Bible should be the canonical home, not an interruption surface. Workspace intake can create or link canon records, but ordinary alias linking should not snap the author into World Bible or open the review queue. Queue/review work should remain available through badges and explicit review-mode entry points.

What can remain outside World Bible for now:

- character sheets
- state timelines
- resources / progression
- other advanced operational actor tooling

## Implementation Slices

### Slice A: Navigation And Label Reframing

Goal:

- stop the app shell from presenting `Characters` as a peer canon destination

Tasks:

1. Update [Navigation.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/components/Navigation.tsx):
   - remove or demote `Characters` from primary navigation
   - if it must remain temporarily, rename it to sheet/state-oriented wording
2. Update mobile navigation in the same file.
3. Update command-palette navigation entries in [commandRegistry.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/commands/commandRegistry.ts).
4. Update empty-state and helper copy so World Bible is the obvious canonical home.

Acceptance:

- a user scanning the nav should not infer that character canon is defined equally in two places

### Slice B: World Bible Character Review Ownership

Goal:

- make World Bible the obvious place to clean up review-created characters

Tasks:

1. In [WorldBibleRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/WorldBibleRoute.tsx), strengthen the `Characters` category workflow:
   - ensure canonical rename language is clear
   - ensure alias follow-up language is clear
   - keep duplicate/alias resolution in this surface
2. In [useWorldBibleEntityActions.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/hooks/useWorldBibleEntityActions.ts):
   - keep canonical rename + alias-preservation path strong
   - add or clarify character-specific follow-up actions where needed
3. Ensure review queue copy implies “finish character canon here,” not “go elsewhere.”
4. Keep the review queue opt-in:
   - show counts as a small badge/tab affordance
   - render the large queue panel only when the author opens review mode
   - do not treat a newly linked alias as an immediate blocking task

Acceptance:

- a user can resolve `Garcia` -> `Garcia de Terra` style canon cleanup entirely in World Bible
- a user can also defer alias review without being pulled away from the manuscript

### Slice C: Characters Route Reduction

Goal:

- remove primary canon-editing responsibility from `Characters`

Tasks:

1. In [CharactersRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/CharactersRoute.tsx):
   - reduce generic character creation/edit framing
   - stop presenting it as the preferred place to set canonical identity
   - keep only sheet/state-adjacent actions if practical
2. If the route remains temporarily:
   - rename visible section copy toward `Character Sheets` / `Character State`
   - make World Bible the explicit home for identity/canon edits
3. Remove or soften:
   - `Create World Lore`
   - `Open World Lore`
   - duplicate canonical-home cues

Acceptance:

- the route no longer feels like the main canonical character database

### Slice D: World Bible To Sheet/State Handoff

Goal:

- preserve advanced character tooling without preserving route confusion

Tasks:

1. Add an explicit secondary action from World Bible character records:
   - `Open sheet`
   - `Create sheet`
   - or equivalent wording
2. Route that action into the existing sheet/state tooling instead of keeping duplicate identity editing elsewhere.
3. Keep sheet/state entry points contextual, not top-level mandatory.

Acceptance:

- a user can start from character canon and opt into advanced tracking only when needed

### Slice E: Workspace Intake Routing Cleanup

Goal:

- make unknown-character acceptance flow land in the right long-term home

Tasks:

1. Audit [useWorkspaceConsistency.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/hooks/useWorkspaceConsistency.ts) character creation paths.
2. Confirm that character-like intake language no longer suggests a separate primary `Characters` database.
3. Prefer deep-link destinations that reinforce World Bible ownership for canon cleanup.
4. Keep alias linking lightweight:
   - the workspace alias linker should show specific target labels such as `Character`, `Location`, and `Item`, not a generic `World`
   - linked Character Tools + World Bible character pairs should appear once, using the World Bible category label
   - linking an alias from a workspace highlight should stay in the workspace and clear the immediate prompt

Acceptance:

- workspace review/intake does not train the author into the wrong mental model
- resolving a normal alias does not create a forced review detour

## Recommended Coding Order

Implement in this order:

1. Slice A: Navigation and copy
2. Slice B: World Bible character review ownership
3. Slice D: World Bible to sheet/state handoff
4. Slice C: Characters route reduction
5. Slice E: Workspace intake routing cleanup

Reason:

- first fix the app’s visible promise
- then strengthen the true home
- then preserve secondary tooling
- finally reduce the old competing surface

## Verification Plan

Manual smoke is now tracked in [character-canon-unification-smoke-test.md](/Volumes/T7/Development/worldbuilding-desk/docs/character-canon-unification-smoke-test.md).

Smoke path summary:

1. Unknown character appears in workspace review
2. Accept/create in canon flow
3. Open in World Bible
4. Rename canonical full name
5. Preserve earlier short name as alias
6. Confirm known-lore highlighting updates in workspace
7. Open sheet/state tooling from the World Bible character record if needed
8. Link an alias from a workspace highlight and confirm the author stays in the workspace
9. Open World Bible normally and confirm the large review panel appears only after selecting `Needs Review`

Specific regression cases:

- `Garcia` -> `Garcia de Terra`
- short-name + full-name character pairs
- alias cleanup after review-created character records
- workspace return path after World Bible edits

Automated coverage targets:

- character canonical rename + alias preservation
- character merge suggestion coverage
- review queue follow-up clear after save/mark reviewed

## Out Of Scope For This Phase

Do not bundle these into Phase 1:

- full `Lore` -> `Lore Documents` rename pass
- linked lore document implementation
- ruleset IA changes
- compendium simplification

Those belong to later phases already captured in the roadmap.

## Recommended Deliverable Shape

Prefer landing this phase as 2-3 narrow PR-sized slices rather than one large refactor:

1. nav/copy + World Bible wording
2. World Bible character actions + handoff to sheets
3. Characters route reduction / rename / removal from primary nav

This keeps rollback easy and makes it obvious which roadmap box each slice is checking off.
