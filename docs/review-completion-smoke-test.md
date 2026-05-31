# Review Completion Smoke Test

Last updated: 2026-05-14

## Goal

Verify the writing-first review flow from imported manuscript text through World Bible completion.

This smoke test is meant to catch regressions in:

- workspace import
- deferred review hydration
- unknown-entity resolution
- World Bible review queue behavior
- review completion state and counts
- smoke-critical lore/review matching regressions
- adjacent workspace state such as scratchpad reload safety
- low-intrusion alias linking from the writing workspace

## Preconditions

1. Run:
- `pnpm --filter web lint`
- `pnpm --filter web build`

2. Use a project with no important existing ignored-review state.

3. Prepare a short `.txt` or `.md` file with at least:
- one likely unknown proper noun
- one second mention of the same noun in the same file
- one place or item name if you want to exercise multiple queue items

Suggested sample text:

```text
Kaelor crossed the Glass Harbor before dawn.

At the edge of Glass Harbor, Kaelor found the Ember Archive.
```

Additional regression text used during the current smoke pass:

```text
Kael fought against the mad rabbit for his life.

Zippy could feel depression coming on. It was because of the chaos in the Ember Archive. It was Kaelor's fault.
```

Expected for the regression text:

- `Kael` can be added as a World Bible record without creating `Kael` as its own alternative name.
- `Kaelor` can be linked as an alias of `Kael`.
- Once `Kaelor` is linked, both `Kaelor` and `Kaelor's` should resolve through the alias and should not appear as unresolved unknowns.
- `Zippy` should surface as a reviewable unknown name after autosave or `Save now`.
- Existing records remain available in the link/select control even when there is no close text match.
- Linking `Kaelor` as an alias should stay in the workspace; it should not auto-open World Bible or force review queue mode.

Additional alias/full-name regression text:

```text
Mira Voss slipped into the Iron Warrens before dusk.

Later, Lantern-Mira doubled back through the Warrens gate alone.
```

Expected for the alias/full-name regression text:

- `Mira Voss` should resolve as a known character once saved.
- If `Mira` is kept as an alias, it should stop surfacing as its own unknown after canon refreshes.
- `Lantern-Mira` should resolve as a known character alias, not leave `Mira` behind as a stale unknown.
- `Iron Warrens` should resolve as a known location.
- If `Warrens` is saved as an alias, it should resolve as known lore too.
- The alias linker should label existing records by their actual category, for example `Mira Voss · Character` and `Iron Warrens · Location`.
- If a Character Tools record and a World Bible character record represent the same character, the alias linker should show one option, not duplicate `Character` and `World` rows.

## A) Import Into Workspace

1. Open `Writing Workspace`.
2. Click `Import`.
3. Choose the sample `.txt` or `.md` file.
4. Leave import mode at `balanced` unless you are explicitly testing another mode.
5. Wait for the scene to appear and autosave/import feedback to settle.

Expected:

- A new imported scene is created.
- The imported scene title is derived from the file name.
- The scene content is readable in the editor.
- The scene remains saved even when deferred review finds unresolved unknowns.

## B) Deferred Review Appears

1. Confirm the header review badge changes after passive idle review or manual review.
2. Confirm the unknown surface appears in the review chips or underline targets.
3. Click one underlined unknown reference in the editor.

Expected:

- The header badge reflects the current unresolved count.
- Passive idle review should not show the large top review panel during normal drafting.
- Clicking the underline opens the review popover.
- The popover offers:
  - create record
  - ignore for now
  - `Always ignore`
  - link to existing record when relevant
- Existing-record options use category labels such as `Character`, `Location`, and `Item`.
- Linked Character Tools + World Bible character pairs appear once.

## C) Link An Alias From Review

1. In the review popover, choose `Link to existing...`.
2. Select the intended existing record.
3. Click the link action.

Expected:

- The alias is connected to the selected canonical record.
- The author remains in the workspace.
- The popover/inline prompt clears or returns to lightweight success feedback.
- The app does not auto-open World Bible.
- The large World Bible review queue does not appear as part of this alias-linking action.
- After save/autosave refresh, the alias resolves as known lore.

## D) Create A World Record From Review

1. In the review popover, choose a world category if needed.
2. Create a new record from the unknown reference.
3. If the resolver notice appears, click `View in World Bible` only when you want to edit the record immediately.

Expected:

- A new World Bible record is created.
- The new record is marked for later completion.
- The resolver notice can deep-link into World Bible, but ordinary alias linking should not force that path.

## E) Finish The Record In World Bible

1. In `World Bible`, open `Review Queue`.
2. Confirm the new record appears in the queue.
3. Open the queue item.
4. Add or adjust:
- the record name if needed
- `Alternative names`
- one or two key canon fields
5. Save the record.

Expected:

- The record opens directly from the queue into the World Bible editor.
- The record shows `Needs completion` before save.
- After save, `Needs completion` is cleared.
- The large review queue panel appears only while `Review Queue` mode is selected.
- Returning to a normal category tab hides the large review queue panel while preserving badge/count visibility.

## F) Resolve Alias Follow-Up

1. Stay in `Review Queue`.
2. Confirm the same record remains in queue only if alias follow-up is still pending.
3. Use either:
- `Mark reviewed`
- or save while reviewing the entry in queue mode

Expected:

- Alias follow-up and `Needs completion` clear intentionally from the same review action.
- The record leaves the queue when no other review reasons remain.
- The world navigation badge decreases accordingly.
- Alias follow-up is available when the author chooses review mode; it should not demand immediate action from the workspace.

## G) Reload Safety Check

1. Reload the app while the same project is active.
2. Return to `World Bible` and `Writing Workspace`.

Expected:

- The completed record does not reappear as `Needs completion`.
- Alias review state is preserved.
- Project-wide ignored review surfaces remain ignored after reload.

## H) Optional Ignore-State Check

1. In the workspace review popover, use `Always ignore` on a test surface.
2. Reload the app.
3. Reopen the same scene or rerun review on it.

Expected:

- The ignored surface does not immediately return as a new unresolved unknown.
- Ignore behavior is project-scoped, not just session-scoped.

## I) Workspace Return Regression Check

1. Open a later scene, not the first one in the project.
2. Switch to `World Bible`.
3. Return to `Writing Workspace`.

Expected:

- The previously selected scene is still active.
- The workspace does not reset to scene one unless the prior scene was deleted.

## Failure Signals

1. Imported scenes do not produce the expected deferred review banner.
2. The same unknown surface shows duplicate/conflicting signals between workspace and World Bible.
3. A World Bible queue item clears in one surface but not another.
4. Alias follow-up cannot be completed intentionally.
5. World navigation badge count does not match the visible World Bible queue.
6. Reload restores previously completed or ignored review work incorrectly.
7. Linking an alias from the workspace automatically navigates to World Bible.
8. The alias linker shows generic `World` labels instead of specific category names.
9. The alias linker shows duplicate rows for the same linked Character Tools and World Bible character.
10. The large World Bible review queue appears when browsing normal category tabs.

## Current Smoke Pass Notes

Status as of 2026-04-15:

- Web lint and build pass with warnings only.
- Confirmed and fixed self-alias creation for same-name review records.
- Confirmed and fixed repeated/sentence-start single-word name detection.
- Confirmed and fixed alias link selection/default behavior.
- Confirmed and fixed duplicate alias display/count behavior.
- Confirmed and fixed alias lore highlighting and possessive alias normalization.
- Confirmed manually that `Zippy` is now flagged and `Kaelor` / `Kaelor's` resolve after alias linking.

Automated check on 2026-04-18:

- `pnpm --filter web lint` passes cleanly.
- `pnpm build:web` passes. Vite still reports the known large-chunk warning, with `@xenova/transformers` emitted as a separate async chunk.
- Review false-positive blocker found during manual setup: common sentence-start/generic words such as `Each`, `With`, `Though`, `Office`, and `Towers` were entering the unknown-entity queue. The consistency engine now requires stronger evidence for single-word unknowns: repetition or a nearby entity cue. Multi-word proper-name candidates are still eligible.
- Follow-up import-noise regression coverage now suppresses examples such as `that Johnson`, `Reflecting`, `Perhaps`, and `Nonetheless`, while preserving titled names such as `Dr. Harrison`.
- Deferred imported documents now continue using import-source extraction during review rehydration and sidebar review, suppressing examples such as `Typical Loa` and `Despite Harlow`.
- Review readiness counts now dedupe the same issue across inline and sidebar review sources, the context drawer scrolls independently, and import regressions cover `Three` plus sentence-start `Reflecting`.
- Unicode titled names such as `Dr. Müller-Sarkisian` are now extracted as one candidate rather than only highlighting the ASCII suffix.
- Common sentence-start words such as `Look`, `Some`, and `Don't` are now suppressed so they do not cause every lowercase instance to highlight.
- Manual smoke found that the import extractor had moved too far toward false negatives: one-off character names such as `Kael`, `Zippy`, and possessive `Kaelor's` were not highlighted. A `character_context_candidate` path now keeps likely character subjects and possessives while preserving the sentence-start false-positive tests.
- Manual smoke found that typing after review could make the editor lose focus and report an in-progress known location prefix such as `Ember Archiv` as unknown. Autosave now avoids strict review, highlight updates no longer remount the editor, and in-progress prefixes of known multiword canon names are suppressed.
- Lore/review matching now has a shared matcher contract for canon normalization, possessives, longer-overlap priority, and in-progress known-name prefix suppression. Entity extraction, review highlights, lore highlights, and unknown-surface canonicalization use that shared path for the smoke-critical cases.
- Cypress coverage now verifies the same known-lore/prefix behavior in the workspace: `Ember Archive` highlights as known lore and `Ember Archiv` does not become a review underline. The Cypress seed now restores the active project through the Zustand `wbd-app-shell` key.
- Scratchpad returned as an autosaved workspace context drawer tab. Cypress coverage verifies scratchpad autosave and reload restoration.
- Follow-up UX note: Scratchpad should be easier to open from any workspace tab or route surface, ideally as a quick popover/modal rather than only a context drawer tab.

Manual smoke findings and fixes on 2026-04-23:

- At that point in the branch, pasting or typing new names into a normal scene did not trigger unknown-name review automatically. Known canon could highlight immediately because it was live text matching; unknown-name detection still required strict save, import/deferred review, or manual Project Review until idle review cadence was implemented.
- Manual `Run project review` is whole-project. Save-time strict review is selected-scene only for normal scenes. Imported/deferred scenes use a softer balanced path so import/save is not blocked by review cleanup.
- UI copy was updated to make that distinction clearer:
  - Review drawer is now `Project Review`.
  - Button is now `Run project review`.
  - Raw issue/reason labels such as `UNKNOWN_ENTITY`, `repeated_unknown`, and `leading_entity_cue` are now shown as author-facing labels such as `Unknown name`, `Repeated name`, and `Context clue`.
  - Strict save failure copy now says `Scene save needs review first` rather than `Commit blocked by consistency check`.
- Regression fixed: Project Review could show issues in the side rail without underlining the active editor scene. Active-scene project review items now feed editor review highlights.
- Regression fixed: resolving one reviewed surface could leave stale side-rail state or make remaining editor underlines disappear. Resolving, linking, dismissing, or ignoring a review surface now clears both the active editor item and the project-review rail item while preserving remaining unresolved highlights.
- Regression fixed: after accepting records in World Bible and returning to Workspace, accepted records could turn into blue lore highlights while unresolved review highlights disappeared until Project Review was rerun. Active-scene review now refreshes when canon, aliases, or characters change.
- Cypress coverage added for:
  - manual Project Review creating editor underlines for the active scene
  - creating one reviewed record while preserving remaining unresolved review underlines
- Verification completed:
  - `pnpm --filter web lint` passes.
  - `pnpm --filter web test:unit -- --runInBand` passes: 17 tests.
  - `pnpm --filter web build` passes with the existing Vite large-chunk and `onnxruntime-web` eval warnings.
- Automation follow-up completed on 2026-04-26:
  - `pnpm --filter web exec cypress run` passes: 18 tests across review matching, post-merge smoke, scratchpad, and workspace navigation lock.
  - The Cypress smoke suite was updated to the current writing-first UI, including `Scenes` / `Context` drawer controls, collapsed `Settings` sections, `/projects` backup entry, and stat-block rebind popover flow.
  - In the Codex desktop environment, Cypress may still need to be launched outside the GUI sandbox restriction; the app/test behavior itself is green once launched successfully.
- Additional manual verification completed:
  - `Always ignore` now clears only the targeted unknown surface instead of dropping all active-scene review underlines.
  - Project Review rail items and editor underlines now stay in sync for ignored terms.

Idle-review follow-up added on 2026-05-09:

- Normal workspace drafting now triggers a passive idle review after a short typing pause for changed scenes.
- Expected behavior changed:
  - new unknown-name underlines can now appear without clicking `Run project review`
  - the header review badge updates from idle review
  - the large review panel above the editor should stay hidden for passive idle-review results and only appear for blocking strict-save cases
- Additional regression fixed on 2026-05-09:
  - returning from `World Bible` no longer resets scene selection to the first scene
  - active-scene review refresh after canon changes now covers normal scenes as well as deferred-review scenes, preventing stale unknowns from masking known full names or aliases
- Canonicalization follow-up to retest:
  - create `Kael` in one scene
  - create `Kaelor` in another scene
  - merge `Kaelor` into `Kael` from `Characters`
  - return to the second scene
  - confirm `Kaelor` becomes a lore highlight, the review underline disappears, and unrelated unknowns such as `Blatnor` remain counted

Low-intrusion alias workflow update on 2026-05-14:

- Workspace alias linking should complete in place. The author should not be snapped to World Bible after linking an alias from a highlighted workspace term.
- The alias linker should continue showing useful category labels (`Character`, `Location`, `Item`, etc.) rather than collapsing World Bible targets to `World`.
- Linked Character Tools and World Bible character records should appear as one linker option, using the World Bible category label.
- World Bible review remains available, but the large review queue panel should render only in explicit `Review Queue` mode. Normal World Bible category browsing should rely on the badge/tab count.
- Current verification: `pnpm --filter web build` passes with the known Vite large-chunk and `onnxruntime-web` eval warnings.

Current disposition:

- The current smoke pass is sufficient to validate the underlying review-completion behavior on the present UX.
- Do not keep iterating on the same end-to-end manual flow unless a specific regression appears.
- Rerun the full manual review-completion smoke after the next review/workspace UX slice changes the interaction model.

Deferred retest trigger:

- Next review/workspace UX change that affects how authors open, resolve, ignore, or revisit review items.

Remaining adjacent follow-up:

- Keep manual focus on review/workspace interaction changes rather than backup coverage, which now has automated scratchpad round-trip coverage in Cypress.
