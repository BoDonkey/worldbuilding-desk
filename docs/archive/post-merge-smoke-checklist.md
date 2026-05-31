# Post-Merge Smoke Checklist

Last updated: 2026-02-24

## Goal
Quickly verify the two most recent merged features:

- Scene export to Markdown and DOCX.
- Prompt tool defaults by project mode (`litrpg`, `game`, `general`).

## Preconditions

1. App builds and lints:
- `pnpm --filter web lint`
- `pnpm --filter web build`

2. Use a project with at least 3 scenes and at least 3 prompt tools.

## A) Scene Export Smoke Test

1. Go to `Writing Workspace`.
2. Confirm `Export MD` and `Export DOCX` buttons are visible.
3. Click `Export MD`.
4. In export modal:
- Uncheck one scene.
- Reorder remaining scenes with `Up/Down`.
- Click `Export`.

Expected:
- Markdown file downloads.
- File includes only selected scenes in chosen order.
- Scene headings and content are readable.

5. Repeat with `Export DOCX`.

Expected:
- DOCX file downloads and opens in Word/Pages/Google Docs.
- Only selected scenes appear, in chosen order.
- No obvious corruption or missing text.

## B) Prompt Tool Mode Defaults Smoke Test

1. Go to `Settings` → `AI Settings` → `Prompt Tools`.
2. In “Configure Default Active tools for mode”, choose `LitRPG`.
3. Mark a specific tool as `Default Active (LitRPG)`.
4. Switch mode selector to `Game` and set a different default tool.
5. Switch mode selector to `General` and set a third default tool.

Expected:
- Each mode retains its own default-tool selection.

6. Go to `Project Mode` section and set project mode to `LitRPG`.
7. Open AI assistant in `Writing Workspace`.

Expected:
- Prompt tools preselected in AI assistant match LitRPG defaults.

8. Repeat for `Game` and `General` project modes.

Expected:
- Preselected tools change to match each mode’s defaults.

## C) Tool Pack Import/Export Smoke Test

1. In `Prompt Tools`, click `Export Tool Pack`.
2. Re-import that same pack.
3. Choose `Replace` once, then test again with `Append`.

Expected:
- Tools import successfully in both flows.
- Mode defaults are preserved on replace.
- No duplicate-ID issues or broken defaults after append.

## Failure Signals

1. Exported MD/DOCX ignores scene ordering or selection.
2. DOCX opens as corrupted/blank.
3. AI assistant tool preselection does not follow current project mode.
4. Importing a tool pack drops or cross-wires mode defaults.
