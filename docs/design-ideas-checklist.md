# Design Ideas Checklist

Last verified: 2026-04-03
Source roadmap: `docs/design-ideas.md`

Legend:
- `[x]` shipped in code
- `[~]` partially shipped or shipped with follow-up still open
- `[ ]` not found / still open

This checklist is a repo-verified status pass, not a full manual QA sign-off.

## Phase 1: Command Palette

- [x] Global command palette triggered by `Cmd/Ctrl+K`.
- [x] App-shell keyboard handler wired in `apps/web/src/App.tsx`.
- [x] Route navigation commands present.
- [x] Workspace action commands present.
- [x] Slash commands inside the editor now exist for `/character`, `/item`, `/memory`, `/system`, and `/stat-block`.
- [~] Success criteria still need manual UX confirmation:
  - common actions should be reachable quickly after opening the palette
  - slash flow should feel like command entry rather than only menu picking
  - no route-navigation regressions

## Phase 2: Left Rail + Collapsible Drawers

- [x] Top-level navigation is already a slim left rail on desktop.
- [x] Mobile navigation already collapses into a bottom bar plus a "More" menu.
- [x] Rail collapse state persists via local storage.
- [x] Workspace includes collapsible drawer flows.
- [x] Workspace context commands exist for:
  - World Bible
  - Ruleset
  - Characters
  - Compendium
- [~] The original plan described drawers as the broader interaction model replacing route-heavy navigation.
  - Current state appears strongest in Workspace.
  - Still worth checking whether any routes outside Workspace feel too tab-heavy or disconnected from the newer shell.
- [~] Success criteria still need visual/UX validation:
  - confirm writing viewport gain is good enough in real use
  - confirm discoverability feels solid on desktop and mobile

## Phase 3: Dedicated System History Panel

- [x] System History panel exists.
- [x] Panel is distinct from the generic AI assistant.
- [x] Entries can be inserted into the scene.
- [x] Panel is optional/toggleable instead of always-on.
- [~] The original plan called for strong LitRPG-signature polish.
  - MVP is present.
  - Further product-identity refinement may still be possible if desired.

## Phase 4: Contextual Selection Bubble

- [x] Dedicated contextual selection bubble exists for highlighted text.
- [~] Entity-type-specific quick actions now exist in partial form:
  - AI expand
  - critique selected passage
  - add to review
  - lore open when a known entity/character is selected
- [ ] No quick stat snapshot / insert-stat-block bubble found from selection.
- [~] Lightweight lore-peek behavior exists through current lore/review popover flows, but arbitrary selection-to-lore coverage is still incomplete.

## Phase 5: Lore Tooltip + Review Convergence

- [x] Shared convergence direction is already shipped in practice:
  - inline consistency highlights
  - inline lore highlights
  - quick popovers
  - review queue
  - alias-aware linking
  - `Alternative names`
  - `needs completion` draft warnings
- [x] Lightweight click/open flows exist before forcing deeper drill-down.
- [x] Draft-state warnings are surfaced in lore-related flows.
- [~] Remaining follow-up from the roadmap and `docs/next-steps.md`:
  - richer compendium-related actions from inline lore/review surfaces
  - stronger related-record context
  - any lingering duplication between review-queue and lore-peek flows
  - slash-command and inline authoring flow still need UX polish after the first implementation
- [~] Success criteria look partially met, but still worth validating during polish:
  - inline canon resolution should feel faster than leaving the scene
  - popovers should stay readable and keyboard-friendly across edge cases

## Phase 6: Editor Readability + Theming

- [x] Editor appearance controls exist for:
  - font presentation (`serif` / `sans` / `mono`)
  - reading width
  - editor surface presets
  - line spacing
- [x] Sticky toolbar work is already shipped.
- [x] Theme-aware editor surface work is already shipped.
- [~] The original roadmap asked for broader typography/surface controls.
  - richer font options do not appear to be present yet
  - dyslexia-friendly options do not appear to be present yet
  - custom highlight/accent palette controls do not appear to be present yet
- [~] Highlight legibility and long-session comfort still deserve manual QA rather than assuming they are complete.

## Cross-Cutting Requirements

- [x] Keyboard opening/closing behavior exists for major shells such as the command palette and mobile menu.
- [x] Mobile-specific navigation handling exists.
- [~] Overlay and drawer behavior appears improved, but full accessibility validation is still open.
- [~] Performance goals were part of the plan, but this checklist did not verify rerender behavior or lazy loading.
- [ ] Lightweight telemetry for palette usage / panel open rates was not found.

## Portability and Adjacent Follow-Ons

- [x] Scene JSON export/import preview exists.
- [x] Compendium JSON export/import preview exists.
- [~] `docs/next-steps.md` still lists portability follow-up work:
  - round-trip schema/versioning rules
  - optional bundle-style exports/imports
  - richer Word import handling

## Working Summary

Most of the roadmap is no longer hypothetical.

Shipped or substantially shipped:
- command palette
- left rail/mobile nav shell
- workspace drawer model
- system history
- lore/review convergence first pass
- editor readability/settings first pass
- JSON portability previews

Still visibly open:
- contextual selection bubble
- selection bubble deeper entity-specific actions
- slash-command UX polish
- richer lore/compendium inline actions and related-record context
- expanded editor customization beyond the current presets
- telemetry
- final manual UX/polish validation across the newer surfaces

## Recommended Use

Use this file as the working checklist.

Use `docs/next-steps.md` as the execution-order handoff:
1. Polish the slash-command and inline authoring flow.
2. Continue lore/compendium convergence work.
3. Dogfood corkboard before broadening planning scope further.
