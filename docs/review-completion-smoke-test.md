# Review Completion Smoke Test

Last updated: 2026-04-26

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
- The scene remains saved even when deferred review finds unresolved unknowns.

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

- Pasting or typing new names into a normal scene does not currently trigger unknown-name review automatically. Known canon can highlight immediately because it is live text matching; unknown-name detection still requires strict save, import/deferred review, or manual Project Review until idle review cadence is implemented.
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

Current disposition:

- The current smoke pass is sufficient to validate the underlying review-completion behavior on the present UX.
- Do not keep iterating on the same end-to-end manual flow unless a specific regression appears.
- Rerun the full manual review-completion smoke after the next review/workspace UX slice changes the interaction model.

Deferred retest trigger:

- Next review/workspace UX change that affects how authors open, resolve, ignore, or revisit review items.

Remaining adjacent follow-up:

- Keep manual focus on review/workspace interaction changes rather than backup coverage, which now has automated scratchpad round-trip coverage in Cypress.
