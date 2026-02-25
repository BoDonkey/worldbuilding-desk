# Compendium Overhaul Plan

_Last updated: February 25, 2026_

## Goal
Make the Compendium understandable in under 5 minutes for first-time users while preserving system depth for advanced projects.

## Why This Overhaul
Current Compendium UX mixes multiple systems in one long route:
- Progression entries and action logs
- Recipes and milestones
- Zone affinity
- Settlement systems
- Party synergy runtime hints

The features are strong, but discoverability and task flow are weak.

## Scope for Tomorrow (Phase 0 + Phase 1 Start)
- Clarify IA and user flow first.
- Ship a non-destructive UI restructure before changing core data logic.
- Keep existing stores/services operational; no migration risk in first pass.

## Current UX Map (As Implemented)
Primary route: [`apps/web/src/routes/CompendiumRoute.tsx`](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/CompendiumRoute.tsx)

Current concerns in one surface:
- Entry creation/import from World Bible
- Action logging and quantity controls
- Milestone management
- Recipe requirements and preview logic
- Zone affinity profile + progress tracking
- Settlement modules, fortress/base stats, runtime modifiers

Result:
- High cognitive load.
- Hard to learn where to start.
- "What do I do next" is unclear for new users.

## Design Principles
1. Task-first navigation over system-first dumping.
2. Progressive disclosure: basic actions first, advanced systems behind explicit sections.
3. Preserve deterministic mechanics and existing data model.
4. Keep cross-links to World Bible visible and intentional.

## Target Information Architecture

### Top-level sections (tabs)
1. `Overview`
- Project progression snapshot
- Quick stats: total points, unlocked milestones, unlocked recipes
- Recent log activity
- "What to do next" checklist

2. `Entries`
- Create/edit entries
- Import from World Bible
- Action definitions and quick log actions

3. `Progression`
- Milestones
- Recipes
- Unlock preview / craftability checks

4. `World Systems` (advanced)
- Zone affinity
- Settlement modules + fortress + base stats
- Runtime effects summary

### Within each section
- Left: list/table
- Right: focused details/editor panel
- Avoid stacking all forms on one vertical page

## UX Problems to Solve Explicitly
1. No clear onboarding sequence.
2. Too many controls visible at once.
3. Logging actions and checking resulting unlock state feels disconnected.
4. World systems compete with core compendium progression for attention.

## Proposed UX Copy / Wayfinding
- Add section subtitle in each tab: one sentence explaining purpose.
- Add empty-state CTAs:
  - Entries: "Import your first World Bible entity"
  - Progression: "Create a milestone threshold"
  - World Systems: "Enable this only when you need simulation depth"
- Add mini status badges for mode/toggles (Game Systems on/off, Runtime Modifiers on/off).

## Implementation Plan

### Phase 1A (tomorrow morning): IA shell + read-only structure
- Introduce tab state in CompendiumRoute.
- Move existing rendered blocks into section components (no behavior change).
- Confirm all current actions still work.

Deliverables:
- New section wrappers/components:
  - `CompendiumOverviewSection`
  - `CompendiumEntriesSection`
  - `CompendiumProgressionSection`
  - `CompendiumWorldSystemsSection`

### Phase 1B (tomorrow afternoon): interaction polish
- Add contextual helper text and empty-state actions.
- Add lightweight "Next steps" checklist in Overview.
- Improve grouping and headings in each section.

### Phase 1C (if time): compendium action flow coherence
- Ensure logging an action visibly updates progress/milestones in current view.
- Add concise success/error toasts tied to affected section.

## Out of Scope for First Overhaul Pass
- Data model rewrites.
- New progression formulas.
- Rule engine behavioral changes.
- Multi-project compendium federation.

## Technical Notes
- Reuse existing service layer in [`apps/web/src/services/compendiumService.ts`](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/services/compendiumService.ts).
- Keep IndexedDB stores unchanged in first pass.
- Preserve existing feature toggle gating from `ProjectSettings`.

## Acceptance Criteria (Overhaul Pass 1)
- A new user can answer "where do I start" immediately from Overview.
- Core entry workflow (create/import/log action) is reachable without scrolling through unrelated systems.
- Milestones/recipes are grouped together and understandable as a single progression flow.
- Zone/settlement tools are visible but clearly advanced/optional.
- No regression in existing save/update behaviors.

## QA Checklist
1. Create entry manually.
2. Import entity from World Bible into Compendium.
3. Log actions and confirm points/progress update.
4. Create milestone and validate unlock behavior.
5. Create recipe and validate craftability preview.
6. Update zone affinity and confirm progress writes.
7. Update settlement module/fortress/base stats and confirm runtime summaries.
8. Verify feature toggles hide/show relevant sections appropriately.

## Tomorrow Kickoff Checklist
1. Create branch: `codex/compendium-overhaul-phase1`.
2. Extract current route into section components without logic change.
3. Add tab navigation + Overview section.
4. Run `pnpm --filter web build` and `pnpm --filter web lint`.
5. Smoke test the QA checklist above.

## If UI Is Still Confusing After Phase 1
- Add guided mode switch:
  - `Basic` (Overview, Entries, Progression)
  - `Advanced` (adds World Systems)
- Add in-app "Compendium tour" panel anchored to first-time usage.
