# Character Canon Unification Smoke Test

Last updated: 2026-05-29

Purpose: verify that character canon now lives in `World Bible > Characters`, while `Character Tools`, sheets, and state tracking stay secondary.

Status note: this checklist is not yet green. Character canon ownership and route framing are implemented, but workspace highlighting/review remains fragile for natural prose edge cases. Examples seen during smoke include titled or partial forms such as `Detective Garcia deTerra`, sentence fragments such as `open.`, and ordinary capitalized words such as `Traffic`. Pause further one-off regex patching and come back with a unified annotation pass that resolves known canon, aliases, titled forms, and unknown candidates together with longest-match priority.

## Preconditions

- Use a project with at least two scenes.
- Ensure the project has a `Characters` World Bible category.
- For sheet/state checks, use a project with a ruleset so Character Sheets are enabled.

## Primary Smoke Path

1. In Workspace, add a new scene mention for a short character name, for example `Garcia`.
2. Run Project Review or trigger the review flow that surfaces the unknown name.
3. From the underline/popover, choose the `Characters` category.
4. Confirm the create action reads `Add to World Bible Characters`, not Character Tools.
5. Create the record from the workspace prompt.
6. Confirm the workspace prompt clears without forcing navigation away from the manuscript.
7. Open the resolver notice or navigate to `World Bible > Characters`.
8. Rename the record from `Garcia` to a fuller canonical name such as `Garcia de Terra`.
9. Confirm `Garcia` is preserved as an alternative name / alias.
10. Mark the character reviewed.
11. Return to Workspace and confirm the scene selection is preserved.
12. Confirm `Garcia` now highlights as known canon rather than unresolved review.

## Alias Linking Path

1. Add a second mention that should be an alias of an existing World Bible character.
2. Open the review popover from the underline.
3. Use the existing-record selector.
4. Confirm options use category labels such as `Characters`, not generic `World` / `Entity`.
5. Confirm a linked Character Tools profile and its World Bible record do not appear as duplicate options.
6. Link the alias.
7. Confirm the popover closes and the review prompt clears in place.
8. Confirm the app does not force navigation to World Bible or Character Tools.

## Character Tools Handoff Path

1. Open a World Bible character record.
2. Confirm the character form states that name, aliases, and lore belong in World Bible.
3. In a general fiction project, confirm there is no `Open optional tools` button.
4. In a project with rule authoring enabled, use `Open optional tools`.
5. Confirm arrival in `Character Tools` does not imply this route owns canon.
6. Return to the World Bible character record.
7. In a project with an active ruleset, use `Create/open sheet + state`.
8. Confirm the sheet/state view opens and, if needed, creates a sheet for that character.
9. Confirm canonical-name editing is still directed back to World Bible.

## Characters Route Reduction Path

1. Open `/characters` directly.
2. Confirm the page title is `Character Tools`.
3. Confirm the primary copy says canonical names, aliases, and lore belong in World Bible.
4. Confirm the first task routes to World Bible character canon.
5. Confirm secondary actions use tool-profile / sheet-state language rather than character-database language.

## Regression Checks

- `Garcia` -> `Garcia de Terra` keeps `Garcia` as an alias.
- A short-name / full-name pair produces a World Bible overlap suggestion.
- Character overlap resolution offers the simple path: yes, make alias; no, keep separate; open the existing character.
- `Needs Review` remains opt-in and does not open as a forced detour after alias linking.
- Workspace -> World Bible -> Workspace preserves the selected scene.
- Unlinked Character Tools profiles do not suppress workspace unknown-name review as canon.
- Natural prose should not fragment known or unknown names into stray review highlights. Before marking this smoke path complete, verify cases like `It's Garcia deTerra`, `Detective Garcia deTerra`, and ordinary non-name sentence words.

## Automated Checks To Run

- `pnpm --filter web lint`
- `pnpm --filter web build`
- `pnpm --filter web test:unit -- --run src/services/consistency/reviewQueue.test.ts src/services/consistency/textMatcher.test.ts src/services/worldBible/worldBibleCanonicalization.test.ts`

Current expected warnings:

- Existing lint warning in `apps/web/src/hooks/useWorkspaceDocuments.ts` about `setImportSummary` and `setRetryImportFiles`.
- Existing Vite build warnings for `onnxruntime-web` eval and large chunks.
