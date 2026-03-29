# Next Steps

Last updated: 2026-03-29

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
- Scratchpad v1 started:
  - project-scoped scratchpad popover mounted at the app shell
  - nav/menu access, command-palette entry, and shortcut
  - dedicated IndexedDB storage with autosave
  - integration spec updated to separate scratchpad utility behavior from the future corkboard route
- Story Corkboard v1 shipped:
  - dedicated corkboard route with nav + command-palette entry
  - per-project brainstorm document with autosave
  - chapter-card CRUD plus beat CRUD
  - progression snapshot fields with mode-aware hiding in `General Fiction`
  - real `Story` / `Chapter` / beat-level `Card` scope behavior
  - first corkboard AI panel with scoped prompting and selection-based promotion flows
  - lightweight Characters + World Bible context included in corkboard AI prompts
  - shared sticky scope header, split-pane independent scrolling, dismissible feedback banner, and markdown-rendered AI results
  - markdown-aware paste into the brainstorm editor

## Recommended Priority Order

1. Corkboard Dogfooding + UI Polish
2. Canon memory / right-rail relevance follow-up
3. Lore / compendium tooltip convergence follow-up
4. Editor customization follow-up
5. Data portability follow-up
6. Additional corkboard AI/canon-context follow-up

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

## 1) Corkboard Dogfooding + UI Polish

Goal: use the newly-shipped corkboard in real authoring sessions and tighten the UI based on friction observed during actual outlining.

Current state:

- Scratchpad v1 is in place as the cross-route quick-capture tool.
- Corkboard route, storage, and first AI workflow are now implemented.
- Characters + World Bible context already feed the corkboard AI in lightweight form.
- Major pain points already addressed:
  - pane scrolling
  - duplicated scope controls
  - non-dismissible feedback
  - AI result insertion clutter
  - markdown rendering/paste gaps

Targets:

- Continue real-use testing of chapter planning and AI-assisted beat work.
- Tighten any remaining corkboard friction around:
  - chapter vs beat clarity
  - AI result review/history management
  - sticky/editor behavior edge cases
  - selection promotion ergonomics
- Decide whether the next corkboard slice should be:
  - richer canon/progression context
  - more explicit AI result history/threading
  - stronger chapter/beat visual hierarchy
- Reassess whether brainstorm and structure layout proportions need another pass after longer use.

Exit criteria:

- Authors can use corkboard for real planning sessions without obvious structural friction or “first-pass prototype” seams.

## 2) Canon Memory / Right-Rail Relevance Follow-up

Goal: make the Workspace canon-memory rail feel like useful canon support instead of a shallow document excerpt list.

Current state:

- Canon memories are present in the right rail and can be filtered, refreshed, deleted, and promoted.
- The current auto-memory behavior is too shallow for real canon lookup.
- The rail often reads like the opening paragraph of the scene instead of extracted canon facts or beats.

Targets:

- Replace naive first-excerpt auto-memory capture with more meaningful canon summaries or extracted facts.
- Support multiple useful memories per scene when warranted instead of a single replacement summary.
- Preserve manual memories instead of treating them like disposable auto-generated entries.
- Improve ordering/grouping so the rail surfaces the most relevant canon first.
- Reassess whether canon memories should show stronger source context or jump-back affordances.
- Define a two-layer context model for future AI work:
  - stable canon context from Characters / World Bible / Compendium that should remain broadly available across chapters
  - narrative memory context from chapter/scene recall systems such as SHODH, which is better suited to local arc recall than persistent canon truth

Exit criteria:

- Authors can use the right rail to recover meaningful canon context without rereading the start of the scene.

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
- Decide explicitly whether scratchpad or future corkboard data belongs in backup/export flows.

Exit criteria:

- Author can round-trip project content safely, with clear expectations when versions diverge.

## 6) Additional Corkboard AI / Canon Context Follow-up

Goal: deepen corkboard intelligence after more dogfooding clarifies what actually matters in planning sessions.

Targets:

- Decide whether corkboard AI needs richer result history instead of only the latest result panel.
- Consider system/project-mode-aware progression suggestions from Compendium or rules data when appropriate.
- Explore stronger entity/character linking from beats or chapter cards, if repeated author demand shows up during use.
- Reassess whether AI output should support more structured promotion targets than chapter summary / beat creation.

Exit criteria:

- Any added corkboard AI complexity is driven by real planning behavior, not speculative feature creep.

## Branch and Commit Workflow (Keep)

- Create a feature branch for each slice using `codex/<topic>`.
- Keep commits small and scoped.
- Validate each slice with lint/build before commit.
- Avoid batching unrelated changes in one commit.

Suggested branch names:

- `codex/corkboard-ui-polish`
- `codex/workspace-ai-followup`
- `codex/compendium-world-systems-sweep`
- `codex/final-ui-polish`
- `codex/lore-tooltip-convergence`
- `codex/editor-customization-followup`
