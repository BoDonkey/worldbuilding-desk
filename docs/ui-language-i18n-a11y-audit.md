# UI Language, i18n Readiness, and A11y Baseline

This checklist is a future-facing guardrail for the fresh UI pass. It should be used when rounding surfaces, simplifying system language, or extracting shared UI patterns.

## Current State

- Most product strings are hardcoded in React route and component files.
- There is no current i18n framework, translation dictionary, `useTranslation`, or `t()` convention.
- `apps/web/index.html` sets `lang="en"`, and generated EPUB/XHTML exports also assume English.
- Accessibility support exists, but it is partial and not covered by automated accessibility tests.
- The app has an `AccessibilityProvider` for font size, editor font, editor width, editor surface, and editor line height.
- Global focus-visible styles exist, and several major navigation/dialog/status surfaces use semantic labels.

## UI Language Pass

- Replace implementation-flavored words with author-facing language.
- Keep World Bible, Cast, Workspace, Corkboard, Scratchpad, and Review Queue copy consistent.
- Avoid exposing storage terms such as `entity`, `schema`, `field key`, `upsert`, or `record` in primary author workflows unless the workflow is explicitly technical.
- Prefer direct verbs for actions: `Create character`, `Import profile`, `Save changes`, `Review aliases`.
- Keep AI language author-controlled: draft, suggest, expand, review. Avoid implying autonomous writing or background mutation.
- Preserve the general-fiction guardrail: copy should not imply rulesets, sheets, stats, compendium, or game mechanics are part of the default fiction workflow.

## i18n Readiness

- Start with a typed app-copy module before introducing a full translation framework.
- Extract high-churn system copy first:
  - navigation labels
  - command palette labels
  - route headings and empty states
  - common button labels
  - review queue labels
  - import/export status messages
- Keep user-authored project content out of translation dictionaries:
  - project names
  - character names
  - aliases
  - custom section labels such as `Education`, `Traumas`, or `Addictions`
  - World Bible category and field labels created by the author
- Use stable copy keys grouped by feature, not by component filename.
- Add interpolation support only where needed for counts, project names, and entity labels.
- Consider ICU/FormatJS/Lingui only after pluralization, date formatting, or multi-locale extraction becomes a near-term requirement.

## A11y Baseline

- Add automated accessibility checks for smoke-critical routes with `axe` or equivalent.
- Validate keyboard-only navigation for:
  - primary navigation
  - command palette
  - Cast authoring
  - World Bible review queue
  - Workspace scene drawer and context drawer
  - import review dialogs
- Ensure every form control has a programmatic label, not only nearby visual text.
- Replace native `alert()` / `confirm()` flows over time with accessible app dialogs that manage focus.
- Ensure every modal, drawer, and overlay traps focus where appropriate and restores focus on close.
- Check TipTap-backed rich fields for accessible names, focus behavior, and screen-reader orientation.
- Verify visible focus states in light and dark themes.
- Audit contrast for soft badges, warning panels, disabled buttons, and muted helper text.
- Respect reduced-motion preferences for hover lift, transitions, overlays, and animated editor affordances.
- Use `aria-live` or `role="status"` for save/import/review feedback that appears after an action.

## Suggested Implementation Order

1. Add a small typed copy dictionary for route-level and nav copy.
2. During the rounded UI pass, extract touched strings into that dictionary instead of doing a wholesale copy migration.
3. Add Cypress accessibility smoke checks for Projects, World Bible/Cast, Workspace, and Settings.
4. Replace the most common native alert/confirm flows with shared accessible dialogs.
5. Audit and fix labels/focus for custom controls and TipTap-rich fields.
6. Revisit whether a full i18n library is warranted once the copy dictionary has real coverage.

## Recovery Guardrail

Do not let this pass interrupt regression recovery by becoming a broad rewrite. Treat it as a companion checklist for surfaces already being touched, especially Cast, World Bible review, navigation, and Settings.
