> **Archived 2026-08-01.** Consolidated into `docs/smoke-tests.md`; full step-by-step procedure and fixtures remain here.

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

## Retest Guidance

- Run this full procedure after a change to how authors open, resolve, ignore, or
  revisit review items.
- For ordinary implementation changes, prefer the focused automated coverage
  and test only the affected path manually.
- Historical smoke runs and regression-fix notes are preserved in
  `docs/archive/review-completion-smoke-log-through-2026-05-14.md`.
