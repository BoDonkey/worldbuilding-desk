# Project Backup Smoke Test

Last updated: 2026-02-24

## Goal

Verify project backup export/import round-trip safety:

- Export produces a valid `.zip` backup.
- Validation check passes on exported backup.
- Import succeeds in both `new` and `merge` modes.
- Count comparison matches exported snapshot data.

## Preconditions

1. App builds and lints:
- `pnpm lint`
- `pnpm build:web`

2. Have at least one project with mixed data:
- scenes
- world bible entries/categories
- characters and character sheets
- compendium and/or settlement data

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

3. `Characters` and `Character Sheets`:
- records present and editable.

4. `Compendium`:
- entries/milestones/recipes/progress logs persist.

## Failure Signals

1. Validation failure after export.
2. Import applies but key data sections are empty unexpectedly.
3. Count check mismatch for unchanged new-project import.
4. Runtime errors during import/export actions.
