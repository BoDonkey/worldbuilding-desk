# Corkboard ↔ scenes — planning prompt

Status: **input prompt, non-authoritative.** Received 2026-09-12 from an
external LLM. The resulting plan is `docs/corkboard-scenes-plan.md`
(proposal, not scheduled). Archive both together once the plan is accepted
or rejected.

---

You are working in the worldbuilding-desk repository. Create a roadmap-ready work-slice plan that strengthens the connection between Corkboard Chapter Cards and manuscript scenes.

This is a planning task only. Do not implement code, claim slices, commit changes, or silently change roadmap scope.

Inspect the current implementations of:

- apps/web/src/routes/CorkboardRoute.tsx
- apps/web/src/components/Workspace/WorkspaceCorkboardModal.tsx
- apps/web/src/hooks/useWorkspaceCorkboard.ts
- Corkboard storage and ChapterCard types
- Story Dashboard derivation and source-scene navigation
- Workspace scene creation, selection, persistence, and navigation-state handling
- Workspace context drawer/rails
- Project backup, snapshot migrations, and Corkboard tests
- Existing Corkboard and Workspace Cypress coverage

Current behavior to verify
--------------------------

The dedicated Corkboard currently allows a Chapter Card to explicitly link one or more saved scenes through stable scene IDs. Those links power deterministic chapter dashboard rollups. Dashboard source actions can navigate back to the relevant Workspace scene.

The Workspace quick Corkboard modal edits the same cards but does not expose scene links.

Chapter Cards do not currently:

- create a linked manuscript scene
- link the currently open scene with one action
- show their relationship prominently from the Workspace scene
- synchronize their summaries or beats with manuscript content

The explicit stable-ID relationship is correct. The author journey around it is incomplete.

Desired improvements
--------------------

Plan the smallest coherent set of slices that provides:

1. “Link current scene” from a Chapter Card when Corkboard is opened inside Workspace.
2. “Create linked scene” from a Chapter Card.
3. Scene-link management in the Workspace quick Corkboard modal.
4. Visible Chapter Card context while editing a linked scene in Workspace.
5. Direct navigation between a card and its linked scenes where useful.

Preserve these principles:

- Links remain explicit and stable-ID based.
- Do not infer relationships from card titles, scene titles, chapter numbers, or relative order.
- Do not automatically copy or synchronize card summaries, beats, or statuses with manuscript prose.
- A card may link multiple scenes.
- Inspect whether a scene may currently link to multiple cards. Preserve existing valid data unless there is strong evidence for a different invariant; if the product should enforce one-card-per-scene, identify that as a separate author decision rather than silently imposing it.
- Card deletion must not delete manuscript scenes.
- Scene deletion must not corrupt cards; define the expected handling of stale links using existing normalization patterns.
- Creating a linked scene should use the existing scene/document creation owner rather than adding a new persistence path.
- Determine whether scene creation plus card linking needs atomic orchestration or compensating rollback.
- Preserve editor autosave, selected-scene restoration, scroll restoration, review state, and navigation behavior.
- Keep the quick modal lightweight and useful during writing.
- Use existing theme tokens and shared components.
- Follow the application’s accessibility conventions for dialogs, focus, keyboard use, status announcements, and confirmation.
- No AI capability is needed for these improvements.

Specific product decisions to resolve
-------------------------------------

Recommend behavior for:

- The initial title of a scene created from a card.
- Whether “Create linked scene” opens the new scene immediately or offers an explicit secondary action.
- How a card with several linked scenes presents them compactly in the quick modal.
- How Workspace displays one or several linked cards without crowding the editor.
- Whether the dedicated Corkboard planning view should also offer “Open scene” beside each linked scene.
- What happens when a linked scene is deleted.
- Whether card status stays wholly manual or gets non-mutating suggestions based on linked-scene existence.
- Whether shared scene-link UI should be extracted so the dedicated route and quick modal cannot drift again.

Documentation inconsistency
---------------------------

The current application contains a dedicated /corkboard route, while parts of PROJECT_STATUS.md and docs/road-to-market.md still refer to “Corkboard graduation to a route” as undecided or backlog work.

Treat current implementation as truth. Identify the exact documentation corrections needed, but do not edit or archive documents during this planning task.

Required output
---------------

Produce:

- A concise current-state finding.
- The recommended author journey between a card and scenes.
- A slice index with placeholder IDs, titles, sizes, dependencies, and sequencing.
- PR-sized slices that each complete a meaningful, testable workflow.
- A full, self-contained implementation prompt for each slice.
- Acceptance criteria for each slice.
- Likely files and owning services, based on current code rather than guessed paths.
- Unit/integration coverage for link mutation and scene creation.
- Cypress coverage for:
  - linking the current scene
  - creating a linked scene
  - reopening/navigating to a linked scene
  - multiple linked scenes
  - card deletion without scene deletion
  - scene deletion/stale-link behavior
  - backup round-trip if persisted shape changes
- Accessibility and narrow-layout verification.
- Relevant manual-smoke additions or updates.
- Explicit anti-goals.
- A recommendation about whether these improvements belong in v1, post-v1, or beta follow-up, respecting the roadmap’s existing scope constraints.
- The documentation reconciliation required for the already-existing dedicated route.

Prefer no persisted-schema change if the current ChapterCard.sceneIds contract is sufficient. If a schema change is proposed, justify why existing stable links cannot support the workflow and include migration, backup, and rollback requirements.

Each future implementation prompt must remind the executor to:

- Claim the approved slice on the authoritative status board.
- Follow “Executing a Slice” in docs/road-to-market.md.
- Consult the design system before UI changes.
- Keep domain/persistence orchestration outside route components.
- Run the full verification battery and relevant manual smoke.
- Update PROJECT_STATUS.md when application truth changes.
- Close the slice only with its commit hash and verified results.

Do not implement broad Corkboard expansion, beat-to-prose synchronization, AI plotting, or a new planning data model as part of this plan.