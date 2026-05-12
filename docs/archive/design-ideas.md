# Design Action Plan (Concrete)

## Goals
- Reduce UI clutter in the writing experience.
- Replace tab-heavy navigation with a workspace-first interaction model.
- Strengthen LitRPG product identity with dedicated "System" UX.
- Keep implementation incremental and reversible.

## Current State (as of March 14, 2026)
- Top fixed navigation with route links is in `apps/web/src/components/Navigation.tsx`.
- Writing editor plus optional AI side panel is in `apps/web/src/components/Editor/EditorWithAI.tsx`.
- Workspace orchestration is in `apps/web/src/routes/WorkspaceRoute.tsx`.
- Existing architecture (React + Vite + TipTap) is suitable for phased UI changes without a rewrite.
- Workspace now supports deferred consistency review with inline text highlights and an action popover for unknown entities.
- RAG indexing is non-blocking on import/save and falls back locally when transformer model loading fails.

## Guiding Product Decision
- Do not adopt a full canned visual system right now.
- Do introduce a small internal design system:
  - Shared spacing/type scales.
  - Shared panel/drawer primitives.
  - Shared interaction rules (keyboard behavior, open/close patterns, focus management).
- Keep custom information architecture and LitRPG-specific interactions as the differentiator.

## Rollout Phases

### Phase 1: Command Palette (Highest Impact, Lowest Risk)
**What to build**
- Global command palette triggered by `Cmd/Ctrl+K`.
- Supports route navigation, scene actions, AI actions, and stat-block actions.
- Optional slash commands inside editor (`/system`, `/character`, `/lore`).

**Why now**
- Fastest way to reduce visible chrome and improve speed.

**Primary integration points**
- New command registry module in `apps/web/src`.
- Keyboard handler at app shell level (`App.tsx`).
- Workspace action bindings in `WorkspaceRoute.tsx`.

**Success criteria**
- Common actions reachable in <= 2 keystrokes after opening palette.
- No regression in existing route navigation.

### Phase 2: Left Rail + Collapsible Drawers (Replace Top-Tab Feel)
**What to build**
- Convert top navigation into a slim left rail with icon-first sections.
- Introduce collapsible drawers for World Bible, Ruleset, Characters, and Compendium context.
- Preserve routes, but reduce dependence on persistent top-level tabs.

**Why now**
- Directly addresses "legacy enterprise tab bar" feel.

**Primary integration points**
- Replace/augment `Navigation.tsx`.
- Add layout shell that supports left rail + center editor + optional right panel.
- Persist drawer open/closed state in project settings or local storage.

**Success criteria**
- Writing viewport gains vertical space.
- Primary nav remains discoverable on desktop and mobile.

### Phase 3: Dedicated "System History" Panel (LitRPG Signature)
**What to build**
- Separate panel/toggle for System events (level-ups, quest updates, resource changes, consistency alerts).
- Distinct from generic AI assistant chat.
- Allow insertion of selected system events into scene text.

**Why now**
- Creates strong genre-specific product identity.

**Primary integration points**
- Extend right-side panel in `EditorWithAI.tsx` or add panel switcher.
- Source events from existing services where possible; fall back to lightweight event log model.

**Success criteria**
- Users can review and insert recent system events without opening general AI chat.
- Panel is optional and does not force a three-pane cluttered default.

### Phase 4: Contextual Selection Bubble (Precision Tooling)
**What to build**
- Selection-aware bubble when highlighting text.
- Actions based on entity type:
  - Character highlight: quick stat snapshot / insert stat block.
  - Location/item highlight: lore peek and insert snippet.
- Hook into existing AI selection flow (`ai-expand-request`) where useful.

**Why now**
- High polish and high utility, but more UX edge cases.

**Primary integration points**
- TipTap extension layer and editor selection utilities.
- Entity lookup + RAG hooks in workspace services.

**Success criteria**
- Bubble appears reliably without disrupting typing.
- Suggestions are contextually relevant and dismissible.

### Phase 5: Lore Tooltip + Review Convergence
**What to build**
- Expand the current consistency action popover into a richer lore tooltip system.
- Reuse the same popover shell for:
  - Unknown-entity review
  - Compendium import review
  - Lore peeks for known characters, items, places, and rules
- Promote aliases into a first-class `Alternative names` concept so shorthand references, titles, and translated names all resolve through one visible authoring model.
- Support click-to-open details with lightweight actions first, modal drill-down second.

**Why now**
- Current inline consistency highlighting proved the direction, but the interaction still feels tactical rather than integrated.
- A shared tooltip/popover system reduces UI duplication across consistency, compendium, and lore browsing.

**Primary integration points**
- `WorkspaceRoute.tsx` for issue state and compendium review entry points.
- `EditorWithAI.tsx` and TipTap extension layer for anchor positioning and highlight clicks.
- Shared popover/modal primitives so tooltips can escalate into richer review forms without custom one-off state.

**Success criteria**
- Hover/click lore interactions feel faster than opening a side panel for every lookup.
- Unknown-entity review and compendium review use the same interaction language.
- Popovers remain readable and keyboard dismissible.

### Phase 6: Editor Readability + Theming
**What to build**
- Replace the current hard-coded editor presentation with project/user-configurable typography and surface settings.
- Add controls for:
  - Font family
  - Font size
  - Line height
  - Editor width / comfortable reading mode
  - Light/dark/editor-surface presets
  - Highlight/accent palette for warnings, lore, and system cues
- Audit notification and highlight colors against both light and dark themes.

**Why now**
- The current black editor surface with small white text is not good enough for long-form writing.
- Tooltip/highlight work will keep feeling bolted on unless the editor itself becomes readable and customizable.

**Primary integration points**
- `TipTapEditor.css`
- theme tokens in `apps/web/src/styles/theme.css`
- settings surfaces in `SettingsRoute.tsx` and related settings storage
- editor config primitives so typography changes do not force bespoke CSS per feature

**Success criteria**
- Writers can reach a comfortable default reading/editing setup without CSS edits.
- Highlight colors remain legible across themes and font size changes.
- The editor looks intentional rather than like a raw developer default.

## Cross-Cutting Requirements
- Accessibility:
  - Full keyboard navigation for palette, drawers, and panels.
  - Focus trapping and escape behavior in overlays.
- Mobile behavior:
  - Left rail collapses to bottom bar or hamburger drawer.
  - Right panel behavior becomes full-screen overlay when needed.
- Performance:
  - Lazy-load heavy panels.
  - Avoid editor rerenders when toggling adjacent UI.
- Telemetry (lightweight):
  - Track command palette usage and panel open rates to validate adoption.

## Risks and Mitigations
- Risk: Three-pane layout feels too dense.
  - Mitigation: Default to clean center editor; side panels opt-in and collapsible.
- Risk: Navigation discoverability drops with icon-only rail.
  - Mitigation: Tooltips + command palette + first-run hints.
- Risk: UI inconsistency from incremental changes.
  - Mitigation: Define small internal design tokens/primitives before Phase 2.

## Delivery Plan

### Sprint 1
- Build Phase 1 command palette.
- Introduce shared overlay/focus primitives.
- Add keyboard shortcut documentation to settings/help.

### Sprint 2
- Implement left rail shell and collapsible drawers.
- Migrate top nav behavior with route parity.
- Validate desktop/mobile navigation flows.

### Sprint 3
- Ship System History panel MVP.
- Add insert-into-scene workflow for selected system entries.

### Sprint 4
- Ship contextual selection bubble MVP in workspace editor.
- Add targeted QA for selection, popover positioning, and keyboard escape paths.

### Sprint 5
- Converge consistency popovers, lore peeks, and compendium review into a shared tooltip/modal system.
- Add first-pass lore hover/click interactions for known entities.

### Sprint 6
- Ship editor readability controls and theme-aware highlight palettes.
- Validate long-session writing comfort and accessibility with larger text settings.

## Definition of Done (Overall)
- Workspace feels less cluttered than current top-tab model.
- Writers can access high-frequency actions faster than before.
- LitRPG-specific System interactions are visible and useful.
- No critical regressions in existing route, editor, or AI workflows.
