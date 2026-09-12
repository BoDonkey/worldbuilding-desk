# Corkboard ↔ scenes — work-slice plan

Status: **accepted 2026-09-12; scheduled as roadmap slices 4.35–4.37
(CB-1–CB-3), pre-beta, after 4.30–4.31.** Dated 2026-09-12. Produced from
the planning prompt in `docs/corkboard-improvement.md` after inspecting the
Corkboard route, the Workspace quick modal, the shared hook, storage, the
Story Dashboard derivation, Workspace scene creation/selection/focus
handling, backup snapshots, and the existing tests. The author accepted the
recommended defaults in § 3. The status board in `docs/road-to-market.md`
is authoritative for execution; this document holds the full prompts.

## 1. Current-state finding

Verified against code:

| Behavior | Where | State |
|---|---|---|
| A Chapter Card links scenes by stable id | `ChapterCard.sceneIds?: string[]` (`entityTypes.ts`), `updateCorkboardCard` in `hooks/useWorkspaceCorkboard.ts` | works; explicit checkboxes over all saved scenes in `routes/CorkboardRoute.tsx` ("Draft scenes" panel, `handleToggleSceneLink`) |
| Links drive deterministic rollups | `services/dashboard/storyDashboard.ts` (`chapters`: word counts, dialogue ratio, accepted changes; `missingSceneIds` for links to deleted scenes) | works; a card with only missing links produces no chapter row |
| Dashboard source actions open the scene | `SourceScenes` in `components/Corkboard/StoryDashboard.tsx` → `navigate('/workspace', {state: {focusDocumentId}})` → `hooks/useWorkspaceDrawerFocus.ts` selects the scene and clears the state | works |
| Quick modal edits the same cards | `components/Workspace/WorkspaceCorkboardModal.tsx` (title, status, summary, plot points) | works, but exposes no scene links at all |
| Workspace shows card context for the open scene | — | absent |
| Create a scene from a card / link the open scene in one action | — | absent; `handleNewDocument` in `hooks/useWorkspaceDocuments.ts` creates scenes but returns nothing, so callers cannot chain a link |
| Scene deletion vs. cards | `handleDelete` in `useWorkspaceDocuments.ts` deletes the document only | cards keep the stale id; only the dashboard notices (`missingSceneIds`); neither UI shows it |
| Card deletion vs. scenes | `deleteCorkboardCard` | never touches documents (correct) |
| One scene, many cards | no invariant anywhere; the checklist allows it | **valid today; preserve** |
| Persistence | `corkboard_chapter_cards` store, in snapshots since schema 4 | `sceneIds` already round-trips; **no schema change needed** |

Two structural notes for the executor:

- `useWorkspaceCorkboard` is instantiated independently by the Corkboard
  route and by Workspace. They are separate routes, never mounted together,
  and each loads from IndexedDB on mount, so there is no live-drift problem;
  but any new orchestration must go through that hook's `updateCorkboardCard`
  rather than a second write path.
- Scene ↔ card link UI exists once (dedicated route) and is duplicated
  nowhere yet. Extracting it before adding the modal version is what keeps
  the two from drifting.

## 2. Recommended author journey

1. **While writing**, the author opens the quick Corkboard (header
   button). Each card shows a compact chip row of its linked scenes. The
   card for the chapter they are drafting has a **Link current scene**
   button; one click links the open scene, the chip appears, the status line
   announces it. A card can also **Create linked scene**: a new scene is
   created through the normal scene owner, linked, the modal closes, and the
   new scene is open in the editor with its title focused.
2. **Under the Workspace header**, a single line reads "Chapter card:
   *The Salt Door*" (or "2 chapter cards") for the open scene. It opens the
   quick modal scrolled to that card; a secondary link opens the dedicated
   Corkboard.
3. **On the dedicated Corkboard**, each linked scene in the "Draft scenes"
   panel gains **Open scene** (already possible from the dashboard, now
   possible from the card), and **Create linked scene** navigates to
   Workspace with the new scene focused.
4. **When a linked scene is deleted**, the card keeps the id, shows a "scene
   no longer exists" chip with **Remove link**, and the dashboard behaves as
   today. Nothing is pruned silently.

## 3. Product decisions (recommended defaults, alternatives noted)

| Question | Recommendation | Alternative |
|---|---|---|
| Initial title of a created scene | the card title if non-empty, else "Untitled scene"; if the card already has linked scenes, append " — Scene N" (N = linked count + 1). Never copy the summary into prose. | always "Untitled scene" (simpler, less useful) |
| Open the created scene immediately? | **Yes.** Writing-first: create → link → close modal → scene open, title input focused, toast "Scene created and linked to *Card*". From the dedicated route, navigate to Workspace via `focusDocumentId`. | secondary "Open" action; leaves the author on the card, which is the planning-first choice |
| Several linked scenes in the quick modal | chip row of up to three titles + "+N more"; **Manage links** disclosure reveals the shared checklist | always show the full checklist (crowds the modal) |
| Workspace display of linked cards | one line under the page header (not in the editor); one card → its title; several → "N chapter cards" expanding to chips | a context-drawer view (heavier, hidden by default) |
| "Open scene" on the dedicated route | **Yes**, beside each linked scene | rely on the dashboard only |
| Linked scene deleted | keep the id; show a stale chip with **Remove link**; `missingSceneIds` continues to feed the dashboard | prune on delete (a silent card write triggered by a scene action; rejected) |
| Card status | **wholly manual.** The linked count chip is the only signal; no suggestions | non-mutating "consider Draft" hint (adds inference-like behavior; rejected) |
| Shared link UI | **Yes**: one `ChapterCardSceneLinks` component used by both surfaces | keep two implementations (guaranteed drift) |
| One scene in many cards | **preserve** (valid data exists in principle; dashboard counts each card independently) | enforce one card per scene — a separate author decision; if chosen later, it needs a migration report and a review surface, not a silent invariant |
| Atomicity of create + link | no rollback. Creation uses the existing owner and returns the document; the link is a second, idempotent write. If the link fails, the scene stays (never destroy manuscript text as compensation), the toast says "Scene created but not linked" with a **Link now** action. | transactional wrapper (not available across the document and card stores without a new persistence path; rejected) |

## 4. Slice index

Roadmap IDs: CB-1 = 4.35, CB-2 = 4.36, CB-3 = 4.37.

| ID | Slice | Size | Depends on |
|---|---|---|---|
| CB-1 | Shared scene-link UI, quick-modal link management, "Link current scene", stale links, docs reconciliation | S | — |
| CB-2 | "Create linked scene" from both surfaces | S | CB-1 |
| CB-3 | Chapter-card context line in Workspace with open-card navigation | S | CB-1 |

Sequencing: CB-1 → CB-2 and CB-3 in either order. No schema change in any
slice. Each is one PR that leaves the app fully usable.

## 5. Slice prompts

Every prompt is self-contained. Each executor must: claim the slice on the
`docs/road-to-market.md` status board; follow that file's **Executing a
Slice** procedure; consult the Design System section of
`docs/product-blueprint.md` before UI changes and use only `theme.css`
tokens and shared components; keep orchestration in hooks/services, not
route components; run the full verification battery (lint, web unit,
engine, UI, web build, desktop build, Cypress) plus the manual smoke named
in the slice; update `PROJECT_STATUS.md` when application truth changes;
and close the slice only with its commit hash and verified counts.

### CB-1 — Shared scene-link UI, quick-modal links, "Link current scene", stale links (S)

**Build.**

1. `services/workspace/chapterCardSceneLinks.ts` (pure, unit-tested):
   `toggleSceneLink(card, sceneId)`, `addSceneLink(card, sceneId)`
   (idempotent, preserves order), `removeSceneLink(card, sceneId)`,
   `resolveSceneLinks(card, documents)` → `{linked: WritingDocument[];
   missingSceneIds: string[]}` using the same rule as
   `storyDashboard.ts` (`unique`, then filter by existing ids). Never
   infers anything from titles or order.
2. `components/Corkboard/ChapterCardSceneLinks.tsx`: props `card`,
   `documents`, `currentDocumentId?`, `onToggle(sceneId)`,
   `onRemoveMissing(sceneId)`, `onOpenScene?(sceneId)`, `compact?`. Renders
   the chip row (up to three + "+N more"), a **Link current scene** /
   **Unlink current scene** button when `currentDocumentId` is set, a
   **Manage links** `<details>` with the full checklist (the existing
   "Draft scenes" markup, moved here), and a stale chip per
   `missingSceneIds` with **Remove link**. Chips reuse the badge/pill
   pattern; no new colors.
3. `routes/CorkboardRoute.tsx`: replace the inline "Draft scenes" checklist
   with the component (`compact={false}`, `onOpenScene={handleOpenScene}`
   so each linked scene gets **Open scene**).
4. `components/Workspace/WorkspaceCorkboardModal.tsx`: add the component
   per card (`compact`, `currentDocumentId` = the Workspace's selected
   scene, passed in from `WorkspaceRoute` alongside `documents`). Keep the
   modal light: chips and the two buttons are visible; the checklist is
   behind the disclosure.
5. Announce link changes through `useStatusAnnouncement` ("Linked *Scene*
   to *Card*.") and post a shell toast for the current-scene action.
6. Docs reconciliation (application truth, do it here): in
   `PROJECT_STATUS.md` replace "Lightweight Corkboard is back as a workspace
   planning modal…" with a sentence stating the dedicated `/corkboard` route
   (chapter cards, beats, scene links, Story Dashboard) plus the quick modal;
   delete the Immediate-Priorities line "Decide whether Corkboard graduates
   from a quick-access modal into a dedicated planning tab/route" (it is
   decided and shipped); in `docs/road-to-market.md` remove "Corkboard
   graduation to a route" from the Backlog paragraph. Do not edit archived
   documents.

**Acceptance.**

- Quick modal: with a scene open, **Link current scene** on a card links
  it in one click, the chip shows the scene title, reload keeps it, and the
  dedicated route shows the same link.
- A card with four linked scenes shows three chips and "+1 more"; **Manage
  links** lists all scenes with correct checked state.
- Deleting a linked scene in Workspace leaves the card intact; both
  surfaces show a stale chip; **Remove link** clears it; the dashboard's
  chapter row updates. Deleting a card never deletes a scene.
- No title/order inference anywhere; no card field other than `sceneIds`
  changes from these actions.
- Keyboard: chips are not focus traps; buttons have accessible names that
  include the scene or card title; the disclosure is a native `<details>`.
- Narrow layout (≤900px): chip row wraps, modal remains scrollable.

**Tests.** Unit: the four helpers, including duplicate ids and missing
scenes. Component: `ChapterCardSceneLinks` compact vs. full, stale chip and
remove. Cypress (extend `corkboard-route.cy.ts` and add
`workspace-corkboard-links.cy.ts`): link current scene from the modal;
multiple linked scenes chip/"+N"; delete card → scene still listed; delete
scene → stale chip → remove link; backup export/import keeps `sceneIds`
(the existing round-trip spec, one assertion added). Manual: smoke § 1
backup round-trip with a linked card; desktop and narrow check of the
modal.

### CB-2 — "Create linked scene" from both surfaces (S)

**Build.**

1. `hooks/useWorkspaceDocuments.ts`: make `handleNewDocument` accept an
   optional `{title?: string; select?: boolean}` and return the created
   `WritingDocument | null`. Default behavior unchanged.
2. `services/workspace/chapterCardSceneLinks.ts`:
   `deriveLinkedSceneTitle(card, linkedCount)` per § 3.
3. `hooks/useChapterCardSceneActions.ts`: `createLinkedScene(card)` =
   `handleNewDocument({title})` → on success `updateCorkboardCard(card.id,
   {sceneIds: addSceneLink(...)})` → returns the document. On link failure
   the scene remains; the hook reports `{document, linked: false}` and the
   caller shows the toast with a **Link now** action that retries only the
   link. No rollback that deletes manuscript text, ever.
4. Quick modal: **Create linked scene** per card; on success close the
   modal, the new scene is selected (existing selection persistence), title
   input focused, toast "Scene created and linked to *Card*".
5. Dedicated route: the same button; on success navigate to `/workspace`
   with `{focusDocumentId}` (existing handoff).
6. Autosave, selected-scene restoration, per-scene scroll restoration, and
   review state must behave exactly as for a scene created with **New
   scene**; the action calls the same owner, so verify rather than
   re-implement.

**Acceptance.**

- From the modal, one click creates a scene titled per § 3, links it, and
  opens it; the scene list, card chips, and dashboard chapter row all show
  it after reload.
- From the dedicated route, the same action lands in Workspace on the new
  scene.
- Simulated link failure leaves the scene, shows the error toast with
  **Link now**, and the retry links without creating a second scene.
- The created scene is a normal `WritingDocument` with no card-derived
  content beyond the title.

**Tests.** Unit: title derivation; the orchestration hook with a mocked
creator (success, link failure, retry). Cypress: create linked scene from
the modal and from the route; reopen the linked scene from the card
afterward. Manual: smoke § 1 with a created-and-linked scene; verify
autosave and scroll restoration on the new scene.

### CB-3 — Chapter-card context line in Workspace (S)

**Build.**

1. `services/workspace/chapterCardSceneLinks.ts`:
   `findCardsForScene(cards, sceneId)` (explicit ids only).
2. `components/Workspace/WorkspaceChapterCardContext.tsx`: renders under
   `PageHeader` when the selected scene is linked: "Chapter card: *Title*"
   with **Open card** (opens the quick modal with `focusCardId`, which
   scrolls that card into view and focuses its title) and **Corkboard**
   (navigates to the dedicated route with `{focusCardId}`, which the route
   uses to select the card). Several cards → "N chapter cards" toggling a
   chip row. Nothing when unlinked; no prompt to link (the modal already
   offers that).
3. `WorkspaceCorkboardModal` and `CorkboardRoute` accept `focusCardId` and
   honor it once (same clear-after-use pattern as `focusDocumentId`).
4. The line must not shift the editor when it appears; reserve no space
   when absent (it sits in the header meta region, not the editor column).

**Acceptance.**

- Opening a linked scene shows the line with the right card(s); an
  unlinked scene shows nothing.
- **Open card** scrolls the modal to the card; **Corkboard** selects the
  card on the route; both work by keyboard; the line is announced as part
  of the header, not as a live region.
- Narrow layout: the line wraps below the title; the editor width is
  unaffected.

**Tests.** Unit: `findCardsForScene`. Component: single vs. multiple cards.
Cypress: navigate scene → card → scene round trip. Manual: desktop and
narrow header check in both themes.

## 6. Anti-goals

- No inference of links from titles, chapter numbers, or order.
- No copying or syncing of summaries, beats, or statuses with prose.
- No status suggestions, automatic pruning of stale links, or one-card-per-
  scene enforcement.
- No new persistence path, store, or schema version.
- No AI, no beat-to-prose generation, no new planning data model, no broad
  Corkboard redesign.

## 7. Documentation reconciliation (regardless of scheduling)

The dedicated `/corkboard` route already exists (`CorkboardRoute.tsx`,
`corkboard-route.cy.ts`, Story Dashboard per 4.19), yet:

- `PROJECT_STATUS.md` line "Lightweight Corkboard is back as a workspace
  planning modal…" understates truth; and the Immediate-Priorities line
  "Decide whether Corkboard graduates from a quick-access modal into a
  dedicated planning tab/route…" is stale.
- `docs/road-to-market.md` Backlog lists "Corkboard graduation to a route".

CB-1 carries these corrections. If CB-1 is not scheduled, make them as a
standalone docs commit; they are truth fixes, not scope.

## 8. Scheduling recommendation

These are three S slices with no schema change, no AI, and no trust-boundary
impact, and they close a visible gap in the write → plan loop that the demo
narrative already shows. Given the author's stated priority of a complete
working app before beta, **schedule all three pre-beta**, after 4.30–4.31
(World Canvas core) so the two planning surfaces land with consistent chip
and link conventions, and before 6.1. If beta time gets tight, CB-3 is the
one to defer: CB-1 and CB-2 deliver the two one-click actions the prompt
asked for.
