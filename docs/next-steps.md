# Next Steps

Last updated: 2026-04-04

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
- Workspace context loop pass shipped:
  - collapsible `Scene Actions`, `In This Scene`, and `Canon Memories` cards
  - scene badges, compact scorecards, temporary pinning, and related-memory jumps
  - canon-memory grouping into `Local canon`, `Parent canon`, `Scene recall`, and `Recent changes`
  - entity-aware memory extraction, entity badges, and click-to-filter behavior
- Writing shortcuts + slash-command v1 shipped:
  - `Cmd/Ctrl+/` writing-shortcuts modal and command-palette entry
  - `/character`, `/item`, `/memory`, `/system`, `/stat-block`
  - command-style slash parsing using `/command query`
  - context-aware ranking from active/pinned scene entities and related memory tags
- Workspace inline-authoring follow-up shipped:
  - exact-match slash auto-advance and visible `/event` labeling
  - richer slash previews, section headers, empty states, and in-editor hinting
  - lore popovers/Lore Inspector now show related records, alternative names, and compendium status
  - direct compendium seed/open actions from inline lore surfaces
  - review queue + review popovers now show inspectable candidate context before linking
  - focused navigation into matching Character Sheets and Compendium entries
- Workspace paper-cut fixes shipped:
  - dismissed review highlights persist correctly when later review data changes
  - scratchpad popover now scrolls correctly
  - writing-shortcuts shortcut no longer depends on resolving review-state friction first

Active dogfooding planning references:

- `docs/table-stakes-scaffolding-plan.md`
- `docs/dogfooding-remediation-plan-2026-04-04.md`
- `docs/first-use-model-clarification-spec.md`
- `docs/character-import-recommendation.md`
- `docs/character-import-review-flow-spec.md`
- `docs/world-first-positioning-note.md`

## Recommended Priority Order

1. Character editing + AI coaching dogfooding follow-up
2. Import trust follow-up for long-form character work
3. Corkboard dogfooding + UI polish
4. Data portability follow-up
5. Table-stakes planning pass for broader fiction market
6. Editor customization follow-up
7. Additional corkboard AI/canon-context follow-up
8. Generic-fiction scaffolding follow-up, if prioritized after wedge work

## Two-Week Execution Plan

### Week 1: Corkboard Dogfooding + Product Friction Log

Primary outcome:

- use the existing corkboard in real outlining sessions until the remaining friction is obvious rather than hypothetical

Execution focus:

- run at least a few real planning passes that cover:
  - chapter creation/reordering
  - beat editing
  - brainstorm drafting
  - AI-assisted chapter/beat ideation
  - promotion of AI output into structured cards
- log friction as concrete issues, not broad impressions:
  - what the author was trying to do
  - where the flow slowed down
  - whether the problem was clarity, layout, state, or missing capability
- prioritize only issues that make corkboard feel structurally awkward or prototype-like

Expected deliverables:

- a ranked friction list for corkboard
- a small polish slice chosen from real usage rather than speculation
- explicit decision on the next corkboard sub-slice:
  - visual hierarchy
  - AI result management/history
  - richer canon/progression context

### Week 2: Targeted Corkboard Polish + Portability Decisions

Primary outcome:

- close the highest-value corkboard seams and define what local-first portability must guarantee

Execution focus:

- implement the narrowest corkboard polish pass that removes the top real-use friction from Week 1
- document export/import expectations for newer project surfaces:
  - scratchpad
  - corkboard
  - canon memories
  - any project-level planning/context state worth preserving
- define versioning behavior before adding more planning or parity features

Expected deliverables:

- corkboard polish pass informed by actual use
- explicit portability scope for project backup/export
- a versioning/rules note for future import/export changes

## Scope Guardrails For This Slice

- Do not start broad generic-fiction parity implementation during this two-week window.
- Do not treat marketing-generation, broad AI suite work, or “NovelCrafter feature matching” as active build scope.
- Keep table-stakes work at planning/roadmap level until corkboard and portability are less fragile.
- Prefer wedge-strengthening improvements over breadth:
  - planning coherence
  - canon continuity
  - trustworthy local project round-tripping

## Decision Gate After This Slice

At the end of the two-week window, make one explicit decision:

1. Continue deeper on corkboard/planning because real use still exposes structural friction.
2. Move to portability/versioning implementation because trust is the bigger blocker.
3. Start the smallest table-stakes package definition because the wedge is clear enough and the planning surface is stable enough.

## Status Board

### Closed

- Slash-command UX polish + inline authoring flow
- Lore / compendium tooltip convergence follow-up
- Workspace AI follow-up verification
- First-use model clarification
- Character import trust pass for `.rtf` and long-form review-first import

### Active

- Character editing + AI coaching dogfooding follow-up
- Import trust follow-up for long-form character work
- Corkboard dogfooding + UI polish
- Data portability follow-up
- Table-stakes planning pass for broader fiction market

### Optional

- Editor customization follow-up
- Additional corkboard AI / canon context follow-up

### Deferred Until After Wedge/Polish Work

- Generic-fiction scaffolding implementation
- broader-market parity work beyond the smallest table-stakes package
- marketing-generation and similar author-business tooling unless demand pulls it forward

## Tomorrow Start Here

Primary focus:

- dogfood the new character editing and `Character Coach` flow in real use

Check specifically:

- whether `Character Coach` helps make characters more complete instead of just more verbose
- whether AI suggestions need lightweight apply/promote actions or should stay discussion-only
- whether imported sections should remain structured detail blocks or become first-class character fields
- whether the saved-character presentation makes summary vs details vs source residue clear

Secondary focus:

- resume deeper corkboard testing only after the character flow feels stable enough not to distort broader dogfooding

If the character flow holds up:

- next implementation slice should be character-coach refinement plus clearer save/apply workflows
- plan a future project-level prompt override system for character tools so authors can tune `Character Creation`, `Character Coach`, and similar AI flows without editing app code
- define a companion `Demote to World Bible` workflow so active cast members can be moved back to extra-character status without losing canon facts or making later re-promotion difficult

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

## 1) Slash-Command UX Polish + Inline Authoring Flow

Goal: make the new slash layer feel native to the editor instead of like a thin chooser over insert actions.

Status: completed on 2026-04-03.

Completed:

- exact-match slash auto-advance
- clearer menu previews/headers/empty states
- visible `/event` labeling while keeping `system` alias support
- lightweight in-editor discoverability hint

Outcome:

- slash insertion now behaves like a native editor tool instead of a thin chooser.

## 2) Lore / Compendium Tooltip Convergence Follow-up

Goal: extend the first popover convergence pass into richer inline canon workflows.

Status: completed on 2026-04-03.

Completed:

- richer compendium actions from inline lore/review surfaces
- related-record context and alternative-name visibility in lore surfaces
- review-queue and review-popover convergence around inspect-before-link flows
- focused route-to-record navigation for Character Sheets and Compendium

Outcome:

- authors can inspect and resolve lightweight canon issues with far fewer blind route hops.

## 3) Corkboard Dogfooding + UI Polish

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

## 4) Data Portability Follow-up

Goal: keep the portability flows solid now that more workspace-specific state exists around memory, context, and planning.

Targets:

- Round-trip schema/versioning rules for JSON exports/imports.
- Decide explicitly what belongs in project backup/export flows:
  - scratchpad
  - corkboard
  - canon memories
  - workspace preferences or pinned context state
- Optional bundle-style exports/imports beyond raw JSON.
- Optional richer Word import handling (tables/headers/formatting).

Exit criteria:

- Author can round-trip project content safely, with clear expectations when versions diverge.

## 5) Table-Stakes Planning Pass

Goal: explicitly decide which broader-fiction market features should be treated as parity/table stakes versus deferred in favor of the LitRPG/GameLit wedge.

Reference:

- `docs/table-stakes-scaffolding-plan.md`

Context:

- Competitor research shows the broader fiction market increasingly expects:
  - genre/project presets
  - trope libraries and structure templates
  - AI character/world setup help
  - series continuity support
  - AI editing/refinement
  - marketing generation
- Worldbuilding Desk already has stronger world-state/canon foundations than many AI-first tools, but several of these items will increasingly read as missing baseline expectations outside the niche wedge.

Targets:

- Classify broader-market feature asks into:
  - must-have parity
  - useful but secondary
  - should not dilute positioning
- Identify the smallest credible table-stakes package, likely including:
  - project/genre setup presets
  - story-structure/trope scaffolds
  - lighter AI setup helpers for character/world generation
- Keep marketing-generation and other generic-author tooling explicitly secondary to core consistency/state differentiation unless user demand proves otherwise.

Exit criteria:

- The roadmap clearly distinguishes parity work from moat-building work, so future planning does not drift into generic AI-writer cloning.
- The first implementation slice is concrete enough to estimate without inventing a second planning system.

## 6) Editor Customization Follow-up

Goal: revisit editor controls only if the current presets prove too limiting in real use.

Targets:

- Add richer font options, potentially including dyslexia-friendly choices.
- Consider custom highlight palettes and more granular surface settings.
- Revisit toolbar edge cases only if they recur after more writing time after the sticky-toolbar fix.

Exit criteria:

- The editor remains comfortable over long sessions without becoming a settings swamp.

## 7) Additional Corkboard AI / Canon Context Follow-up

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
- `codex/table-stakes-planning`
- `codex/editor-customization-followup`
