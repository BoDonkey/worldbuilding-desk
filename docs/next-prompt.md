Please do roadmap slice 5.17 (writing-flow stability + assistant
continuity). Follow AGENTS.md: read docs/README.md, PROJECT_STATUS.md, and
docs/road-to-market.md. 5.17 is already claimed (WIP) on the status board on
branch `claude/writing-flow-stability`. The roadmap's 5.17 entry is the
authority for requirements and acceptance; this file is recon only.

State on 2026-10-31:
- 5.15c and 5.16 are Done and merged to main (PRs #83, #84). 5.17 is the last
  slice before 6.1 beta.
- Post-5.16 code review findings (fix these in 5.17 or ask first):
  1. Dark theme: 5.16 changed `--color-on-accent` from `#ffffff` to
     `#08111f`. Eight dark surfaces use it as a tint in `color-mix(...
     var(--color-bg-secondary) 80–92%, var(--color-on-accent))` — the nav
     search launcher, Projects help panel, Lore, Canon Decisions empty
     panels, Workspace, and the World Bible rich-text field. They used to be
     lifted ~10–20% toward white and are now darkened instead. Give those
     surfaces a proper tint (an existing raised-surface token, or one new
     shared token) instead of the on-accent text color, and check them in
     dark mode.
  2. World Bible import: if an author types a **New field name** that
     matches an existing field (case/punctuation-insensitive), the select
     has no matching option and falls back to showing "Keep in
     Description", the description still says "Adds a new field named …",
     and at apply time `reconcileImportSectionDestinations` silently fills
     the existing field. 5.16 required duplicate handling to stay explicit:
     show "fills existing field X" (or switch the destination visibly). In
     the same spot, `getPlannedNewFieldLabels` in
     `WorldBibleImportWorkspace.tsx` does not filter invalid (empty) labels
     the way `ImportSectionPanel` now does, so another draft can show a
     blank "New field:" option.

Suspected root causes (verify each with a failing test first):
- **Scroll-to-top / jitter.** In
  `apps/web/src/components/Editor/EditorWithAI.tsx` (~line 466), the
  scroll-restore effect lists `content` in its dependencies, so every
  keystroke and deletion re-runs it. If the saved scroll position is 0 it
  sets `scrollTop = 0` at once; otherwise it forces the stale saved
  position on every frame for 2.5 s, clamped by the shrinking
  `scrollHeight` during deletion. Restoring should run on document open,
  editor ready, or an explicit reset, not on content edits. Also check
  `TipTapEditor.tsx`'s "keep external content in sync" effect: its
  `isInternalUpdate` guard clears on `setTimeout(0)`, so any later
  `content` prop that differs from the editor HTML calls `setContent`,
  which resets selection and scroll. Autosave in
  `hooks/useWorkspaceDocuments.ts` should never feed content back into the
  editor.
- **Assistant continuity.** `components/AIAssistant/AIAssistant.tsx` sends
  `messages: [requestUserMessage]` (~lines 531 and 554), so the model never
  sees the earlier question or the options it offered. `getPreviousTurn`
  (`services/assistant/followUpSubject.ts`) only shapes retrieval. Send
  bounded prior turns (shown reply version only, never discarded
  alternatives) through `fitContextChunks`/the context budget so local
  models stay within limits, and include them in `buildPromptBreakdown`.
- **Expanded reply view.** The reading view opened by **Expand** (~line
  927) has no composer; continuing the conversation needs one there.
- **Save as Source Note.** `handleCaptureSourceNote` (~line 656) saves only
  the last assistant message. Offer the author's question plus the shown
  reply version as an editable, author-reviewed transcript.
- **Coach → Source Note and context cards.** Coach replies come from
  `handleAskCoach` (~line 698). Context sources are plain strings from
  `getContextSourceSummaries` (~line 129), so they cannot link anywhere
  yet; carry the source record id/type through `LLMContextChunk` so cards
  link only when the record resolves, and are dismissible either way.
  The Workspace drawer's own `contextCard` is in
  `components/Workspace/WorkspaceContextDrawer.tsx` (~line 1259).

Constraints:
- File-size gate: `AIAssistant.tsx` is 996 lines (limit 1000);
  `EditorWithAI.tsx` (1306) and `WorkspaceContextDrawer.tsx` (1328) are
  frozen at their baseline in `scripts/file-size-baseline.json`. Move logic
  into hooks/services (e.g. a conversation-transcript service and a
  `useAssistantConversation` extension) rather than growing these files.
- AI trust boundary: saving to Source Notes stays author-reviewed; nothing
  the model writes goes to canon or state directly.
- This touches shared hooks and routes, so the full verification tier
  applies, plus a timed browser check for jitter as the acceptance asks.
- Known CI flakes also seen on main: `ai-scene-revision.cy.ts` "AI" tab and
  a seed `cy.then()` timeout. Check against those before debugging.
