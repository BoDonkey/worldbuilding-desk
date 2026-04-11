# Author Tool Customization Plan

## Goal

Keep the writing surface primary while letting each author tailor the tools around it.

This should not become a generic "build your own editor" system. The default experience
 should stay opinionated and writing-first, with customization focused on reducing
 friction rather than adding more chrome.

## Why This Matters

Current workspace cleanup has exposed a useful product direction:

- Different authors want different editor controls visible.
- Some tools are useful but should stay secondary to the manuscript.
- Workspace rails and toolbar controls should adapt to the author's workflow instead of
  forcing one fixed arrangement.

## Proposed Scope

### 1. Toolbar Customization

Allow authors to choose which editor controls are visible in the main toolbar.

Likely candidates:

- basic formatting
- paragraph and heading controls
- list controls
- undo/redo
- project-specific character styles
- status block actions

Potential settings:

- hide advanced controls
- pin frequently used actions
- collapse low-frequency actions into dropdowns
- choose compact vs expanded toolbar density

### 2. Rail Tool Customization

Allow authors to control which right-rail tools are available and which are emphasized.

Likely rail tools:

- AI Assistant
- Review
- Lore
- System
- World Bible summary
- Ruleset summary

Potential settings:

- hide unused tools
- reorder tabs
- choose default open tab
- choose whether tools auto-open from editor actions or stay manual

### 3. Workspace Chrome Preferences

Allow authors to reduce non-writing chrome without disabling important features.

Potential settings:

- show or hide scene rail by default
- show or hide context rail by default
- keep utility toggles in footer vs edge controls
- compact status row vs expanded status row

## Product Rules

- The manuscript stays central and should not be displaced by optional tools.
- AI should live in the rail, not take over the central writing column.
- Review should behave like an on-demand tool, not a persistent interruption.
- Defaults should remain simple for new users.
- Customization should be reversible with one "restore defaults" action.

## Suggested Implementation Order

1. Persist toolbar density and visible control groups in project or user settings.
2. Persist rail visibility, default tab, and tab order.
3. Add a lightweight "Writing Workspace Preferences" panel in Settings.
4. Only after that, consider deeper per-author tool layout customization.

## Notes For Later

- Current code already supports some dynamic toolbar behavior via generated
  `toolbarButtons`, but this is not yet a full user-facing customization system.
- The workspace writing-first cleanup should land before adding many new customization
  controls.
- Customization should simplify the workspace, not create another configuration burden.
- Settings should separate two concerns more clearly:
  UI readability/accessibility for app chrome, and manuscript readability/accessibility
  for the editor surface itself.
- Font size, editor font, width, surface, and line-height should be reviewed together as
  one coherent writing comfort model instead of feeling partly global and partly editor-only.
