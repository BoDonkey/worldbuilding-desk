# Review Completion Smoke Test

Last updated: 2026-04-15

## Goal

Verify the writing-first review flow from imported manuscript text through World Bible completion.

This smoke test is meant to catch regressions in:

- workspace import
- deferred review hydration
- unknown-entity resolution
- World Bible review queue behavior
- review completion state and counts

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

## B) Deferred Review Appears

1. Confirm the workspace review banner appears above the editor.
2. Confirm the unknown surface appears in the review chips or underline targets.
3. Click one underlined unknown reference in the editor.

Expected:

- The review banner reflects the imported unknown reference count.
- Clicking the underline opens the review popover.
- The popover offers:
  - create record
  - ignore for now
  - `Always ignore`
  - link to existing record when relevant

## C) Create A World Record From Review

1. In the review popover, choose a world category if needed.
2. Create a new record from the unknown reference.
3. If the resolver notice appears, click `View in World Bible`.

Expected:

- A new World Bible record is created.
- The new record is marked for later completion.
- The resolver notice can deep-link into World Bible.

## D) Finish The Record In World Bible

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

## E) Resolve Alias Follow-Up

1. Stay in `Review Queue`.
2. Confirm the same record remains in queue only if alias follow-up is still pending.
3. Use either:
- `Mark reviewed`
- or save while reviewing the entry in queue mode

Expected:

- Alias follow-up and `Needs completion` clear intentionally from the same review action.
- The record leaves the queue when no other review reasons remain.
- The world navigation badge decreases accordingly.

## F) Reload Safety Check

1. Reload the app while the same project is active.
2. Return to `World Bible` and `Writing Workspace`.

Expected:

- The completed record does not reappear as `Needs completion`.
- Alias review state is preserved.
- Project-wide ignored review surfaces remain ignored after reload.

## G) Optional Ignore-State Check

1. In the workspace review popover, use `Always ignore` on a test surface.
2. Reload the app.
3. Reopen the same scene or rerun review on it.

Expected:

- The ignored surface does not immediately return as a new unresolved unknown.
- Ignore behavior is project-scoped, not just session-scoped.

## Failure Signals

1. Imported scenes do not produce the expected deferred review banner.
2. The same unknown surface shows duplicate/conflicting signals between workspace and World Bible.
3. A World Bible queue item clears in one surface but not another.
4. Alias follow-up cannot be completed intentionally.
5. World navigation badge count does not match the visible World Bible queue.
6. Reload restores previously completed or ignored review work incorrectly.

## Current Smoke Pass Notes

Status as of 2026-04-15:

- Web lint and build pass with warnings only.
- Confirmed and fixed self-alias creation for same-name review records.
- Confirmed and fixed repeated/sentence-start single-word name detection.
- Confirmed and fixed alias link selection/default behavior.
- Confirmed and fixed duplicate alias display/count behavior.
- Confirmed and fixed alias lore highlighting and possessive alias normalization.
- Confirmed manually that `Zippy` is now flagged and `Kaelor` / `Kaelor's` resolve after alias linking.

Resume point:

- Continue from reload safety and ignored-surface checks.
- Recheck that `Mark reviewed` and saving from review mode keep the World Bible queue and navigation badge in sync after reload.
