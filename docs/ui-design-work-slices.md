# UI/UX Design Fixes — Work Slices

**Date:** 2026-07-25 · **Baseline:** static code review of `apps/web/src` (app not running), findings below.
**Scope:** `apps/web` only. Independent of `docs/fitness-100-work-slices.md` except where noted — two slices there (9, 10, 15) extract tabs/sections out of `CompendiumRoute.tsx` and `CharacterSheetsRoute.tsx`, the same files two slices below rewrite styling in. See "Notes for the human running these" at the bottom before running both plans together.

Each slice is a discrete, PR-sized unit with a self-contained prompt for an LLM agent (Claude Code / Codex with repo access).

## Verification commands (referenced by every prompt)

```bash
pnpm --filter web lint
pnpm --filter web test:unit
pnpm --filter web build
pnpm --filter web e2e:run     # only for slices touching routed UI with existing Cypress specs
```

## Slice index

| # | Slice | Phase | Est. size |
|---|---|---|---|
| 1 | Modal keyboard accessibility: Escape + focus trap | 0 — Quick a11y wins | M |
| 2 | Fix nav icon abbreviations for screen readers | 0 | XS |
| 3 | Build shared ConfirmDialog + InlineAlert components | 1 — Shared dialog system | S |
| 4 | Migrate `window.confirm`/`alert` call sites to shared components | 1 | M |
| 5 | Inline field-level validation (replace alert-based validation) | 1 | S |
| 6 | Theme the CharacterStyle editor family | 2 — Visual consistency | S |
| 7 | Migrate CompendiumRoute off inline styles | 2 | M |
| 8 | Migrate CharacterSheetsRoute off inline styles | 2 | M |
| 9 | Add search/filter to Compendium sub-lists | 3 — UX gaps | S |
| 10 | Rework primary nav / "More" popover contents | 4 — Navigation IA | S |
| 11 | Close-out audit: verify fixes | 5 — Close-out | XS |

## Execution status

Updated 2026-07-25. Slices not listed here have not started.

| Slice | Status | Evidence / coordination note |
|---|---|---|
| 1 | Complete | Accessibility hooks and dialog integrations landed in `6d2f6c5` |

---

## Phase 0 — Quick a11y wins

### Slice 1: Modal keyboard accessibility — Escape + focus trap

**Prompt:**

> In worldbuilding-desk's `apps/web/src`, most modal/drawer UIs are custom (no dialog library). Two modals already do this right — the Scratchpad and Corkboard modals in `routes/WorkspaceRoute.tsx` register a `keydown` listener that closes on Escape. The following do NOT and need the same treatment: the StatBlock modal (~line 3992), Export modal (~4598), and Memory modal (~4682) in `WorkspaceRoute.tsx`; the two inline `role="dialog"` composers at ~3945 and ~3973 in the same file; and the import-preview dialog in `routes/WorldBibleRoute.tsx` (~line 2749). Steps: (1) extract the existing Escape-close logic from the Scratchpad/Corkboard modals into a small reusable hook, `src/hooks/useEscapeToClose.ts`, taking an `onClose` callback and an `isOpen` boolean, and use it in all modals listed above (retrofit the two existing ones too, so there's one implementation); (2) add a focus trap to every `role="dialog"` element in these two files (roughly a dozen instances) — write a small `src/hooks/useFocusTrap.ts` that, while open, constrains Tab/Shift+Tab to the dialog's focusable children and restores focus to the triggering element on close; apply it alongside `useEscapeToClose` wherever `role="dialog"` appears. Behavior-preserving otherwise — do not change what any dialog contains or does when closed/confirmed. Verify: `pnpm --filter web lint`, `pnpm --filter web test:unit`, `pnpm --filter web build`, `pnpm --filter web e2e:run` (Workspace and World Bible specs exist). Manually confirm Tab cycles within an open dialog and Escape closes it, for at least 3 of the dialogs touched.

### Slice 2: Fix nav icon abbreviations for screen readers

**Prompt:**

> In worldbuilding-desk's `apps/web/src/components/Navigation.tsx`, each nav item renders a two-letter text abbreviation ("PR", "WS", "WB", "MO", "RL", "SH", "MX", "ST", "CR", "CB" — ~lines 77–113 for the definitions, ~172–312 for the render) next to a full text label, with the abbreviation not hidden from assistive tech. This causes screen readers to announce both back-to-back for every nav item. Fix: add `aria-hidden="true"` to the abbreviation span so only the full label is announced. If time allows, consider replacing the abbreviations with real icons (check if `lucide-react` or similar is already a dependency) — but the `aria-hidden` fix alone is the required minimum for this slice; treat an icon swap as optional/stretch. Verify: `pnpm --filter web lint`, `pnpm --filter web build`. Manually check the nav in a screen-reader (VoiceOver) or the browser accessibility tree inspector to confirm only labels are announced.

---

## Phase 1 — Shared dialog system

### Slice 3: Build shared ConfirmDialog + InlineAlert components

**Prompt:**

> worldbuilding-desk's `apps/web/src` uses native `window.confirm(...)` and `window.alert(...)` in 17+ places (destructive-action confirmations and validation errors) — these ignore the app's theme (`styles/theme.css` defines a light/dark token set most components already consume correctly). Build two small, reusable, theme-consistent components in `src/components/common/`: (1) `ConfirmDialog.tsx` — a modal taking `title`, `message`, `confirmLabel`, `cancelLabel`, `onConfirm`, `onCancel`, `isOpen`; style it using the existing CSS-module/theme-variable conventions (check an existing well-styled modal, e.g. the Corkboard modal in `WorkspaceRoute.tsx`, for the pattern to match) and wire it to the `useEscapeToClose`/`useFocusTrap` hooks from Slice 1 (if Slice 1 hasn't landed yet, add minimal inline equivalents and note in the PR that they should be deduplicated once Slice 1 lands); (2) `InlineAlert.tsx` — a small themed banner/toast for one-off error or success messages, non-modal, auto-dismissing or manually dismissible, taking `variant: 'error' | 'success' | 'info'` and `message`. Neither component should be wired into the app yet in this slice — just build them, export from `src/components/common/index.ts`, and add a couple of basic render/interaction unit tests (`ConfirmDialog` opens/closes/calls callbacks; `InlineAlert` renders each variant). Verify: `pnpm --filter web lint`, `pnpm --filter web test:unit`, `pnpm --filter web build`.

### Slice 4: Migrate `window.confirm`/`alert` call sites to shared components

**Prompt:**

> Continuation of worldbuilding-desk's dialog-system work — `ConfirmDialog` and `InlineAlert` now exist in `src/components/common/` (Slice 3). Migrate every native dialog call site to use them: confirmation calls in `routes/ProjectsRoute.tsx:189`, `routes/LoreRoute.tsx:558` and `:895`, `routes/WorldBibleRoute.tsx:4398`, `routes/CharacterSheetsRoute.tsx:707`, `routes/CharactersRoute.tsx:634`, `routes/WorkspaceRoute.tsx:1588`; and alert calls in `components/CategoryEditor.tsx:58,64`, `components/Settings/AISettings.tsx:125,482,542,610`, `components/StyleManager.tsx:40,285` (first confirm `StyleManager.tsx` is actually reachable/used — if it's dead code, delete it instead of migrating it and note that in the PR). Also fix two missing-confirmation gaps found in review: `components/CharacterStyleEditor.tsx` (~lines 52–57) deletes a style with no confirmation at all — add one; `routes/CorkboardRoute.tsx` deletes a chapter card (~line 259) and a plot-point/beat (~line 370) with no confirmation — add one to each. Each migrated call site keeps its exact current condition/behavior on confirm — this is a UI-layer swap, not a logic change. Verify: `pnpm --filter web lint`, `pnpm --filter web test:unit`, `pnpm --filter web build`, `pnpm --filter web e2e:run`. Manually exercise at least 3 migrated confirmations and the 2 newly-added ones.

### Slice 5: Inline field-level validation

**Prompt:**

> In worldbuilding-desk, `components/CategoryEditor.tsx` (~lines 58, 64), `components/Settings/AISettings.tsx` (~line 125), and `components/StyleManager.tsx` (~line 40) currently show form-validation errors via `window.alert(...)`, which doesn't point at the offending field. Using `InlineAlert` from `src/components/common/` (Slice 3) or a small field-level variant of it, replace these with inline messaging rendered next to the relevant input, and add basic red/error styling to the input itself (border-color via the existing theme error token, or add one to `styles/theme.css` if none exists). Keep validation logic itself unchanged — this only changes how the error is surfaced. Verify: `pnpm --filter web lint`, `pnpm --filter web test:unit`, `pnpm --filter web build`. Manually trigger each validation error and confirm it now appears inline instead of as a browser alert.

---

## Phase 2 — Visual consistency

### Slice 6: Theme the CharacterStyle editor family

**Prompt:**

> In worldbuilding-desk, `components/CharacterStyleEditor.tsx` (~lines 32, 41, 62, 104, 117, 156), `components/CharacterStyleList.tsx` (~line 24), and `components/StyleManager.tsx` (~lines 29, 50, 74, 152, 223, 237, 247, 301) hardcode hex colors (`#444`, `#888`, `#ffffff`, `#000000`, `#1a1a1a`, etc.) instead of the CSS variables defined in `styles/theme.css`. Because `CharacterStyleEditor`/`CharacterStyleList` render inside `routes/CharactersRoute.tsx` and `routes/SettingsRoute.tsx`, this panel currently ignores the app's dark/light theme toggle (`components/ThemeToggle.tsx`). Fix: replace every hardcoded color with the matching `var(--color-*)` token from `styles/theme.css` (add a token if a truly new color is needed, but prefer reusing existing ones). First confirm whether `StyleManager.tsx` is actually imported/used anywhere (`grep -r StyleManager apps/web/src`) — if it's dead code, delete it instead of theming it and note that in the PR. Verify: `pnpm --filter web lint`, `pnpm --filter web build`. Manually toggle light/dark theme with this panel open and confirm colors now follow the toggle.

### Slice 7: Migrate CompendiumRoute off inline styles

**Prompt:**

> `apps/web/src/routes/CompendiumRoute.tsx` in worldbuilding-desk has 257 inline `style={{...}}` blocks, unlike the rest of the app (`SettingsRoute.tsx`, `ProjectsRoute.tsx`, `LoreRoute.tsx`, `CanonDecisionsRoute.tsx` all use CSS modules with zero inline styles). This means Compendium's UI misses hover/focus/transition rules the `.module.css` files provide elsewhere, and looks visually inconsistent with the rest of the app. Migrate: for each inline style block, add the equivalent rule(s) to `CompendiumRoute.module.css` (create it if it doesn't exist, following the naming/structure convention of an existing route's module CSS file) and replace the inline style with a `className`. Preserve exact visual output — same colors, spacing, sizing — this is a mechanical extraction, not a redesign. Do this in the same pass as, or before, any tab-extraction refactor from `docs/fitness-100-work-slices.md` (Slices 9–10) if that plan is also in flight, to avoid both touching the same 3,000+ lines concurrently — check with whoever is running that plan first. Verify: `pnpm --filter web lint`, `pnpm --filter web test:unit`, `pnpm --filter web build`, `pnpm --filter web e2e:run` if Compendium has Cypress specs. Spot-check the rendered page visually (or via a snapshot) before/after for at least the 3 busiest tabs.

### Slice 8: Migrate CharacterSheetsRoute off inline styles

**Prompt:**

> Same inline-style migration as Slice 7, applied to `apps/web/src/routes/CharacterSheetsRoute.tsx` (135 inline `style={{...}}` blocks) in worldbuilding-desk. Move each to `CharacterSheetsRoute.module.css` (create if absent) and swap in `className`s, preserving exact visual output. Check with whoever is running `docs/fitness-100-work-slices.md` before starting — that plan's Slice 15 also touches this file (extracting the mutation composer and other sections) and the two should not run concurrently on the same file. Verify: `pnpm --filter web lint`, `pnpm --filter web test:unit`, `pnpm --filter web build`, `pnpm --filter web e2e:run` if specs exist for this route.

---

## Phase 3 — UX gaps

### Slice 9: Add search/filter to Compendium sub-lists

**Prompt:**

> worldbuilding-desk's `apps/web/src/routes/CompendiumRoute.tsx` has several long sub-lists (recipes, milestones, zone profiles, mechanics entries) with no way to search or filter — every text input currently found in the file is part of a creation form, not a list filter. Add a simple client-side filter: a search input above each list-type tab panel that filters the rendered list by name/label as the user types (case-insensitive substring match against whatever field is currently shown as the item's title). Keep it local component state, no new dependencies, no changes to underlying data or store. If Slice 7 (inline-style migration) has already landed, style the new input via the CSS module; if not, match the existing inline-style conventions already in the file rather than mixing approaches. Verify: `pnpm --filter web lint`, `pnpm --filter web test:unit`, `pnpm --filter web build`. Manually confirm filtering works on at least 2 of the sub-lists and clearing the input restores the full list.

---

## Phase 4 — Navigation IA

### Slice 10: Rework primary nav / "More" popover contents

**Prompt:**

> In worldbuilding-desk's `components/Navigation.tsx` (~lines 85–119 for structure, ~199–248 for render), only Projects, Workspace, World Bible, and Source Notes sit on the primary nav rail; Rules, Sheets, Mechanics, Canon Review, Corkboard, and Settings are all tucked into a "More" popover — despite Sheets and Mechanics displaying pending-count badges that are currently hidden until a user opens "More". Rework the split: promote Sheets and Mechanics to the primary rail (swap two of the current primary items to "More" if the rail has a fixed slot count, or make the rail horizontally scrollable/wrap if it doesn't) so items with pending-count badges are visible without an extra click. Keep Settings in "More" (or move to a distinct settings-gear affordance if one already exists elsewhere in the header — check `PageHeader.tsx` first). This is a layout/IA change — no route or data logic changes. Verify: `pnpm --filter web lint`, `pnpm --filter web build`, `pnpm --filter web e2e:run` (nav-dependent specs, if any, should still pass — check for selectors keyed to nav item position). Manually confirm badges are now visible without opening "More".

---

## Phase 5 — Close-out

### Slice 11: Close-out audit — verify fixes

**Prompt:**

> Run a close-out audit of worldbuilding-desk's `apps/web` against `docs/ui-design-work-slices.md`. For each slice 1–10, verify and record actuals: modal Escape/focus-trap behavior on all dialogs listed in Slice 1; nav abbreviations `aria-hidden` (Slice 2); `ConfirmDialog`/`InlineAlert` exist and all 17+ call sites plus the 2 previously-missing confirmations use them (Slices 3–4); validation errors render inline, not via `alert()` (Slice 5); `grep -rn '#[0-9a-fA-F]\{3,6\}'` in `CharacterStyleEditor.tsx`/`CharacterStyleList.tsx`/`StyleManager.tsx` (or confirm the last is deleted) returns nothing outside `theme.css` (Slice 6); inline `style={{` count in `CompendiumRoute.tsx` and `CharacterSheetsRoute.tsx` is at or near 0 (Slices 7–8); Compendium sub-lists have working search/filter (Slice 9); Sheets/Mechanics are on the primary nav rail (Slice 10). Note any slice not fully landed as an open item rather than rounding up. Write the result as a short status table appended to the bottom of `docs/ui-design-work-slices.md`.

---

## Notes for the human running these

Phases 0 and 1 (Slices 1–5) touch only shared components/hooks and are safe to run before or alongside anything else. Slice 3 must land before Slice 4 (Slice 4 imports what Slice 3 builds); Slice 5 can reuse Slice 3's `InlineAlert` but isn't strictly blocked by Slice 4. Slices 7 and 8 (inline-style migration) **conflict at the file level** with Slices 9, 10, and 15 of `docs/fitness-100-work-slices.md`, which extract sections out of the same two route files — do not run a fitness-plan extraction slice and its corresponding design slice at the same time; land one, then rebase the other. Slice 9 (search/filter) touches `CompendiumRoute.tsx` again, so sequence it after Slice 7 if both are in scope, to avoid re-merging inline-style changes into a file being actively restyled. Slice 10 (nav rework) is independent of everything else and can run anytime.
