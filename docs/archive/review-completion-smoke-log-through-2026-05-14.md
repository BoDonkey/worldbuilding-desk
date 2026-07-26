# Review Completion Smoke Log Through 2026-05-14

> Archived 2026-07-26. This is the historical execution log removed from the
> reusable `docs/review-completion-smoke-test.md` procedure.

## 2026-04-15

- Web lint and build passed with warnings only.
- Fixed self-alias creation for same-name review records.
- Fixed repeated and sentence-start single-word name detection.
- Fixed alias link selection/default behavior.
- Fixed duplicate alias display/count behavior.
- Fixed alias lore highlighting and possessive alias normalization.
- Confirmed manually that `Zippy` was flagged and `Kaelor` / `Kaelor's`
  resolved after alias linking.

## 2026-04-18 Automated And Manual Follow-Up

- Web lint and build passed; Vite retained the known large-chunk warning.
- Tightened single-word unknown evidence while preserving multiword proper-name
  candidates.
- Added import-noise and deferred-import regression coverage.
- Deduplicated review readiness counts across inline and sidebar sources.
- Added Unicode titled-name handling.
- Restored one-off likely-character and possessive candidates after the
  false-positive pass became too aggressive.
- Prevented editor remount/focus loss during highlight updates.
- Added shared lore/review matching for canon normalization, possessives,
  overlap priority, and in-progress known-name prefixes.
- Added Cypress coverage for known lore and partial-name behavior.
- Added Scratchpad autosave/reload coverage.

## 2026-04-23 Through 2026-04-26

- Clarified whole-project review versus selected-scene save review.
- Replaced raw issue/reason labels with author-facing review language.
- Fixed Project Review results failing to underline the active editor scene.
- Kept sidebar and editor review state synchronized after resolve, link,
  dismiss, or ignore actions.
- Refreshed active-scene review after canon and alias changes.
- Added Cypress coverage for active-scene underlines and preserving remaining
  unresolved items.
- Lint, unit tests, build, and the then-current Cypress suite passed.
- Verified that `Always ignore` clears only the selected surface.

## 2026-05-09 Idle Review

- Added passive idle review for changed normal scenes.
- Updated expectations so unknown underlines and the review badge may update
  after a typing pause without opening the large blocking review panel.
- Preserved workspace scene selection across World Bible navigation.
- Refreshed active-scene review after canon changes for normal and deferred
  scenes.
- Recorded a canonicalization retest involving `Kael`, `Kaelor`, and `Blatnor`.

## 2026-05-14 Low-Intrusion Alias Workflow

- Kept alias linking in the Workspace rather than navigating automatically.
- Preserved useful World Bible category labels in the alias linker.
- Deduplicated linked Character Tools and World Bible character choices.
- Limited the large World Bible review queue to explicit review mode.
- Web build passed with the known Vite/ONNX warnings.

## Disposition

The smoke pass was sufficient for the interaction model at that checkpoint.
Rerun the reusable procedure only when review/workspace interactions change or
a specific regression appears.
