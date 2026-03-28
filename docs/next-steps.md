# Next Steps

Last updated: 2026-03-28

## Current Baseline

Implemented recently:

- Compendium core progression (entries, milestones, recipes, action logs).
- Craftability preview.
- Zone affinity (sector mastery).
- Durability/legacy crafting primitives.
- Settlement aura system generalized beyond trophies.
- Community/logistics party synergy engine.
- Settlement base stats + fortress progression effects.
- Runtime integration into craft checks.
- Runtime-adjusted previews in Character Sheets.
- Writing Workspace import for `.txt`, `.md`, `.html`, `.docx` (with `.doc` fallback messaging).
- Writing Workspace import modes with deferred review and best-effort `.pages` preview extraction.
- Inline consistency highlights and quick action popovers.
- Inline lore highlights and quick lore popovers for known entities/characters.
- Persistent review queue with category selection, alias linking, and highlight-to-review for missed mentions.
- Alias visibility in World Bible.
- World Bible `needs completion` draft state with draft visibility in Workspace and Compendium.
- First-class `Alternative names` editing with alias sync.
- Optional compendium seeding from review-created World Bible entities.
- Editor appearance controls for font presentation, reading width, editor surface, and line spacing.
- Theme-aware editor surface variants for dark mode.
- Stabilized sticky editor toolbar for long-document editing.
- First AI persona workflow shipped with explicit critique actions and active persona visibility.
- Second persona preset: `Line Editor`.
- Shared lore/review popover shell with better behavior, direct record jumps, and draft warnings.
- Persona/settings UX pass completed for defaults, personas vs supporting tools, and sectioned AI settings.
- Scene JSON export/import preview and compendium JSON export/import preview completed.
- UI sweep started across Workspace, Settings, and Compendium shell/body surfaces.
- Workspace writer-first cleanup pass:
  - reduced route-level chrome above the editor
  - moved scene title / scene actions into the left rail
  - moved review details into on-demand modals
  - switched feedback to toast-style overlays
  - independent desktop scrolling for left rail, center editor, and right rail
- Ollama follow-up fixes:
  - desktop provider `baseUrl` now forwards correctly
  - Workspace now syncs canonical app settings instead of holding stale AI config
  - added a wider AI-pane mode and internal assistant scrolling improvements

## Recommended Priority Order

1. Final Cross-Route UI Polish
2. Lore / compendium tooltip convergence follow-up
3. Editor customization follow-up
4. Data portability follow-up

## Workspace AI Follow-up Verification

Status: completed on 2026-03-28.

Verified:

- Project AI provider selection persists cleanly across full app restart.
- Ollama stays selected and does not fall back unexpectedly.
- AI pane input remains visible without scrolling the editor column.
- AI message scrolling stays internal to the pane.
- Left-rail scene meta card is acceptable for now; any further simplification can wait for later polish.

Conclusion:

- Writing + AI is stable enough to stop treating workspace follow-up as the active blocker.

## 1) Finish Compendium UI Sweep

Goal: complete the visual cleanup of the remaining Compendium sections so the route feels consistent end to end.

Status:

- Done:
  - compendium route shell
  - JSON import preview modal
  - help / tabs / next-step panels
  - overview, entries, and progression sections
  - zone affinity section
  - party synergy/community section
  - settlement progression section
  - remaining empty/list/detail states inside `world-systems`
  - follow-up notes from manual review, if any

Result:

- `world-systems` received the intended UI sweep and now follows the newer card/grouping treatment. Treat any remaining tweaks as polish, not a blocked unfinished section.

Exit criteria:

- The full Compendium route reads as one coherent UI system instead of mixed generations of styling.

## 2) Final Cross-Route UI Polish

Goal: do one end-to-end polish pass after compendium is finished so the recently expanded flows feel equally refined.

Targets:

- Workspace import/export and consistency surfaces
- Compendium portability and body sections
- Settings / AI settings cards and action rows
- Any remaining stark legacy surfaces, badges, or empty states

Exit criteria:

- No obvious “old UI vs new UI” seams remain in the main authoring flows.

## 3) Lore / Compendium Tooltip Convergence Follow-up

Goal: extend the first popover convergence pass into richer inline canon workflows.

Status:

- Done:
  - shared popover shell
  - shared behavior polish
  - direct lore-to-record navigation
  - draft-state warnings in lore surfaces
- Remaining:
  - richer compendium-related actions from inline lore/review surfaces
  - more connected related-record context
  - any remaining duplication between review-queue and lore-peek flows

Exit criteria:

- Authors can inspect and resolve lightweight canon issues without leaving the scene unnecessarily.

## 4) Editor Customization Follow-up

Goal: revisit editor controls only if the current presets prove too limiting in real use.

Targets:

- Add richer font options, potentially including dyslexia-friendly choices.
- Consider custom highlight palettes and more granular surface settings.
- Revisit toolbar edge cases only if they recur after more writing time after the sticky-toolbar fix.

Exit criteria:

- The editor remains comfortable over long sessions without becoming a settings swamp.

## 5) Data Portability Follow-up

Goal: keep the new portability flows solid, but treat them as a follow-on rather than the immediate bottleneck.

Targets:

- Round-trip schema/versioning rules for JSON exports/imports.
- Optional bundle-style exports/imports beyond raw JSON.
- Optional richer Word import handling (tables/headers/formatting).

Exit criteria:

- Author can round-trip project content safely, with clear expectations when versions diverge.

## Branch and Commit Workflow (Keep)

- Create a feature branch for each slice using `codex/<topic>`.
- Keep commits small and scoped.
- Validate each slice with lint/build before commit.
- Avoid batching unrelated changes in one commit.

Suggested branch names:

- `codex/workspace-ai-followup`
- `codex/compendium-world-systems-sweep`
- `codex/final-ui-polish`
- `codex/lore-tooltip-convergence`
- `codex/editor-customization-followup`
