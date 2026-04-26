# Project Backup Smoke Test

Last updated: 2026-04-25

## Goal

Verify project backup export/import round-trip safety:

- Export produces a valid `.zip` backup.
- Validation check passes on exported backup.
- Import succeeds in both `new` and `merge` modes.
- Count comparison matches exported snapshot data.
- Scratchpad and Corkboard planning data survive export/import round-trip.

## Preconditions

1. App builds and lints:
- `pnpm lint`
- `pnpm build:web`

2. Have at least one project with mixed data:
- scenes
- world bible entries/categories
- characters and character sheets
- compendium and/or settlement data

3. Before exporting, seed planning data in the same project:
- add a non-trivial Scratchpad note
- add at least two Corkboard cards
- add at least one plot point to each Corkboard card

Suggested seed:
- Scratchpad:
  - one paragraph of loose planning notes
  - one short checklist or question list
- Corkboard:
  - Card 1 with title, summary, status, and two plot points
  - Card 2 with title, summary, status, and one plot point

## Scenario A: Export + Validate

1. Go to `Projects`.
2. On a project card, click `Export Backup (.zip)`.
3. Confirm a file is downloaded named `<project>-backup-YYYY-MM-DD.zip`.
4. Click `Validate Backup (.zip)` and select that file.

Expected:
- Feedback shows backup passed integrity checks.

## Scenario B: Import as New Project

1. Click `Import Backup (.zip)` and select the exported file.
2. In preview panel:
- Set mode to `Create New Project`.
- Click `Apply Import`.

Expected:
- New project is created and selected.
- Feedback confirms import.
- Feedback includes `Count check passed.`

## Scenario C: Merge into Existing Project

1. Click `Import Backup (.zip)` with same file.
2. Set mode to `Merge Into Existing Project`.
3. Choose a target project.
4. Review conflict summary.
5. Click `Apply Import`.

Expected:
- Merge completes.
- Feedback confirms merge.
- Feedback includes `Count check passed.` or explicit mismatch details.

## Manual Spot Checks After Import

1. `World Bible`:
- categories and entries appear.

2. `Writing Workspace`:
- scenes exist and open correctly.

3. `Scratchpad`:
- open the quick-access Scratchpad modal or context-drawer Scratchpad
- confirm the seeded note content is present
- confirm formatting/line breaks are preserved closely enough for normal note-taking use

4. `Corkboard`:
- open Corkboard from the workspace
- confirm card count matches the exported project
- confirm card order matches the exported project
- confirm each seeded card keeps:
  - title
  - summary
  - status
  - plot-point count
- confirm plot-point order and notes survive import

5. `Scratchpad` + `Corkboard` editing sanity:
- make a small edit after import
- confirm autosave still works normally after restored data loads

6. `Characters` and `Character Sheets`:
- records present and editable.

7. `Compendium`:
- entries/milestones/recipes/progress logs persist.

## New-Project Round-Trip Signals

Expected:
- Imported project shows `Count check passed.`
- Scratchpad content is present in the imported project.
- Corkboard cards and plot points are present in the imported project.

## Merge-Import Spot Checks

When merging into an existing project, confirm:
- incoming Scratchpad content behaves predictably for the chosen project model
- incoming Corkboard cards appear and remain editable
- no obvious silent loss occurs in planning data even if merge creates duplicate-looking manuscript/canon data elsewhere

Note:
- Scratchpad is project-scoped singleton note data, so the important check is "not silently lost."
- Corkboard cards should import as project-scoped planning records and remain reorderable/editable after merge.

## Failure Signals

1. Validation failure after export.
2. Import applies but key data sections are empty unexpectedly.
3. Count check mismatch for unchanged new-project import.
4. Runtime errors during import/export actions.
5. Scratchpad restores as empty or partially truncated after import.
6. Corkboard cards import without plot points, wrong ordering, or missing summaries/status values.
