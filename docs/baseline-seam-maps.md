# Seam Maps for the Four Baseline Files

**Slice:** 3.50 (review finding S1, `docs/archive/architecture-review-2026-11-13.md`)
**Written:** 2026-11-19, against `main` at `9776327`
**Status:** Plan only. Each map below is its own slice on the
`docs/road-to-market.md` status board (3.57–3.60). The board is
authoritative for open work. Archive this file once those slices are done.

These four files are over the 1,000-line limit and recorded in
`scripts/file-size-baseline.json`, so they may shrink but not grow. The next
feature that touches one of them hits the size gate. These maps name the
seams up front so that feature does not have to make a small extraction just
to fit the line count.

Each seam passes the `AGENTS.md` test: one feature or concern a reader would
search for, with its own state or logic, in the same folder as the file it
comes from. Line numbers are as of `9776327`, so re-check them before moving
code. As in 3.32, size targets are aims, not hard limits.

All four slices preserve behavior. They run the full-coverage tier with no
test changes beyond import paths, and update the size baseline with
`--update` as files shrink. A file under 1,000 lines is dropped from the
baseline.

---

## 3.57 `services/consistency/ConsistencyEngineService.ts` (1,250 lines)

The file holds the deterministic name detector behind scene review. It finds
capitalised names in scene text, matches them to known records, and decides
which unmatched names are worth flagging. The class at the end
(`:1154-1250`) only saves the proposal and turns it into issues. Everything
above it is pure functions, in five clear bands.

| Seam | Lines now | Moves to | What it owns |
|---|---|---|---|
| Name cue words | `:24-435` (~410) | `nameCueWords.ts` | The word lists: words that are never names, sentence starters, numbers, action and context cues, pronoun starters, generic unknown terms, and `MIN_UNKNOWN_CONFIDENCE`. It is data with no logic, beside the existing `commonEnglishWords.ts`. |
| Mention extraction | `:437-742` (~305) | `mentionExtraction.ts` | `CandidateMention`, the name-token regex patterns, `extractCandidateMentions`, `extractTitledNameMentions`, `extractActionObjectMentionsWithCues`, and the cue checks (`hasLeadingCueWord`, `hasCharacterContextCue`, `hasDirectAddressCue`, …). It also owns the small token helpers (`tokenizeNormalized`, `countEntityNameParts`, `isNonEntityToken`, `hasEntityLikeToken`), which are exported to the bands below. |
| Scene presence check | `:743-824`, plus constants `:24-40` (~100) | `scenePresenceCheck.ts` | `findUnexpectedScenePresenceIssues`, `hasSceneEntryCue`, `countSceneSentencesBefore`, `SCENE_ENTRY_CUE_WORDS`, and the two `SCENE_PROGRESS_*` thresholds. It is a separate check with its own issue code (`UNEXPECTED_SCENE_PRESENCE`). |
| Unknown-name rules | `:825-964` (~140) | `unknownMentionRules.ts` | `shouldSuppressUnknownMention`, `isEligibleSingleWordUnknown`, `getUnknownDetectionReason`, and their helpers. This band decides when an unmatched name is flagged. |
| Stays | `:965-1250` (~300) | `ConsistencyEngineService.ts` | Known-entity matching (`buildKnownEntityMap`, `getKnownMatchesForMention`), which is used only by `buildExtractedProposal`, plus `buildExtractedProposal` and the class. |

- **Expected result.** The engine drops to about 300 lines, and no new file
  passes 450. `index.ts` re-exports `ConsistencyEngineService` with
  `export *`. The new modules stay internal, so `index.ts` must not export
  them.
- **Tests.** `ConsistencyEngineService.test.ts` (501 lines) tests
  `buildExtractedProposal` and the class through their public API, so it
  needs no changes. Leave any new per-module tests to a later slice.
- **Watch.** Several word lists are read by two bands. For example,
  `NON_ENTITY_SINGLE_WORDS` is read by mention extraction (`:533`) and
  through `NON_ENTITY_BOUNDARY_TOKENS` (`:272`), and `GENERIC_UNKNOWN_TERMS`
  is read by both extraction (`:481`) and the unknown-name rules
  (`:859`, `:899`). That is why the lists get one module and are not split
  between their users.

---

## 3.58 `components/Editor/EditorWithAI.tsx` (1,134 lines)

The Workspace manuscript editor. It wraps `TipTapEditor` and already hands
three concerns to hooks (`useEditorSelectionMenu`, `useEditorStatPeek`,
`useAITextControls`). Five more live inline.

| Seam | Lines now | Moves to | What it owns |
|---|---|---|---|
| Find in scene | state `:175-183`; handlers `:225-255`; effects `:571-666`; bar JSX `:832-895` | `hooks/useCurrentSceneFind.ts` and `components/Editor/CurrentSceneFindBar.tsx` | Open/close, query, matches, active index, the Ctrl/Cmd+F and Escape shortcut, resetting when the document changes, match decorations, and revealing the active match. The hook returns the toolbar action that the editor adds to `effectiveToolbarActions`. |
| Scroll memory | effects `:349-518` (~170) | `hooks/useEditorScrollMemory.ts` | Saving the scroll position per scene, restoring it once the text loads, the reset token, and the `wbd:capture-workspace-scroll` listener. The `data-wbd-*` restore attributes move unchanged, and so does the saved-position store that `workspace-continuity-find.cy.ts` reads (`__wbdEditorScrollPositions`). |
| Review focus | effect `:711-792` (~80) | `hooks/useEditorReviewFocus.ts` | Jumping to a review finding (`focusQuery`/`focusToken`): selecting it, the flash decoration, the fallback flash, and clearing the flash. |
| Selection menu | JSX `:923-1031` and `insertSelectionSnippet` `:795-803` | `components/Editor/EditorSelectionMenu.tsx` | The menu body: AI entries, quick snippets, and record actions. It owns the snippet insert. `useEditorSelectionMenu` keeps the menu's position and open state. |
| Context popovers | state `:165-173`; handlers `:668-699`; close-on-scroll effect `:520-538`; JSX `:1032-1125` | `hooks/useEditorContextPopovers.ts` and `components/Editor/EditorContextPopovers.tsx` | The lore record and stat-block popovers: opening one from a highlight click, closing on scroll or resize, and their markup. `closeOtherPopovers` (`:208`) comes from this hook. |
| Stays | about 400 lines | `EditorWithAI.tsx` | Props, the editor instance and ready token, the merged extension config, highlight refs, cursor context (`handleSelectionChange`), the hide-while-typing timer, and layout. |

- **Duplicated code.** Find in scene (`:642-657`) and review focus
  (`:745-753`) both scroll a position to `REVIEW_FOCUS_TOP_OFFSET` below the
  top of the editor and save the new scroll top. Move this into one
  `revealEditorPosition(editor, scrollElement, pos, scrollKey)` beside the
  scroll-memory hook, and have both hooks call it.
- **Stylesheet.** `assets/components/AISettings.module.css` (374 lines) is
  the editor's stylesheet, not the settings screen's. Only five Editor
  components import it (`EditorWithAI`, `EditorStatPeekLayer`,
  `LoreInspectorPanel`, `SystemHistoryPanel`, `SelectionMenuAIEntries`). The
  Settings screen uses `Settings/AISettingsForm.module.css`. Rename it to
  `assets/components/Editor.module.css` in this slice, with no rule changes.
- **Watch.** The hooks share `editorRef`, `editorScrollRef`, and
  `editorReadyToken`, so pass them in and do not duplicate them. Keep the
  order of effects that dispatch transactions: find decorations, review
  flash, and the AI context passage all dispatch on `editorReadyToken`.
  Cover the find bar, scroll restore (5.17), and review focus with the
  existing `workspace-continuity-find`, `workspace-writing-stability`, and
  `stat-peek` specs.

---

## 3.59 `components/Settings/AISettings.tsx` (1,080 lines)

The AI section of Settings. It already delegates two sections
(`AISwitchesFields`, `AIActionsSection`). That pattern is the model here:
each `<h3>` section becomes a component, with a hook where it keeps state.
Every new file lives in `components/Settings/` and imports
`AISettingsForm.module.css`.

| Seam | Lines now | Moves to | What it owns |
|---|---|---|---|
| Provider setup | state `:109-113`, `:120-121`, `:126-128`; effect `:134-149`; handlers `:150-319`; JSX `:538-716` | `hooks/useAIProviderSetup.ts` and `AIProviderSetupSection.tsx` | The key drafts and saved-key status, saving and removing keys, provider and model changes, connection test and diagnostics, `showAdvanced`, and `HOSTED_KEY_FIELDS`. `keyError` is shown only here. |
| AI guardrails | JSX `:717-895` (~180) | `AIGuardrailsSection.tsx` | The review-engine and inspector settings fields. It has no local state and takes `aiSettings` and `onSettingsChange`, like `AISwitchesFields`. |
| Prompt tools | state `:114-119`; effect `:130-132`; handlers `:320-330`, `:343-495`; JSX `:899-1053` | `hooks/usePromptTools.ts` and `PromptToolsSection.tsx` | The new-tool form, inline edit, enable and default toggles per project mode (`defaultsMode`), installing presets, `DEFAULT_PRESET_TOOLS`, and `PROJECT_MODE_LABELS`. |
| Tool packs | handlers `:496-522`; JSX `:1056-1073` | `ToolPackSection.tsx` | Export and import (replace or append through the confirm dialog). Packs hold prompt tools and AI actions, so this stays its own section and does not join Prompt Tools. |
| Stays | about 130 lines | `AISettings.tsx` | Props, the status alert, `useConfirmDialog`, the switches gate (`anyAISwitchOn`), and section order. |

- **Shared pieces.**
  - `withDefaultModes` (`:320-330`) is a pure merge of AI settings updates
    that keeps `defaultToolIdsByMode`, and both prompt tools and tool packs
    use it. Make it a pure function in `services/llm/` that takes the
    current settings, next to `toolPack.ts`.
  - Tool pack import needs the prompt-tools `defaultsMode`, so the parent
    passes it down from `usePromptTools`.
  - The status alert (`setStatusMessage`) is used only by preset install
    (`:477`) and tool pack import errors (`:518`). Pass an `onStatus`
    callback to those two sections.
- **Duplicated code.** `triggerJsonDownload` (`:331-341`) is a copy of
  `utils/downloadJson.ts`. Import it from there. The wider copy problem is
  slice 3.61.
- **Watch.** `AISettings.test.tsx` renders the whole component, so it should
  pass unchanged. Run the `ai-provider-setup`, `ai-switches`, and
  `ai-actions` specs.

---

## 3.60 `styles/WorkspaceRoute.module.css` (2,349 lines)

Follow 3.32a's method. Move each component's rules into a module beside it,
keep shared primitives in one place, and make no visual change at any width
or in either theme. Thirty components in three folders import this module.
`WorkspaceScratchpadModal.module.css` already took its own rules out, and its
header says the shared modal pieces stay here.

Classes grouped by the components that use them. Line counts are
approximate rule lines:

| Module (beside the component) | Classes | ~Lines | Users |
|---|---|---|---|
| `SceneRosterPanel.module.css` | 29 | 335 | `SceneRosterPanel` |
| `WorkspaceSceneDrawer.module.css` | 32 | 245 | `WorkspaceSceneDrawer` |
| `WorkspaceCorkboardModal.module.css` | 28 | 225 | `WorkspaceCorkboardModal`, plus its rules in both `@media` blocks |
| `WorkspaceReview.module.css` | ~25 | 260 | `WorkspaceReviewIssueItem`, `WorkspaceReviewSurfacePopover`, `WorkspaceManualWorldCapturePopover`, `WorkspaceReviewTab`, `WorkspaceStateChangeReview`, `CanonCheckPanel` (review list, surface popovers, capture name fields) |
| `SceneStateCapture.module.css` | ~13 | 145 | `PositionedStateChangeComposer`, `SceneInventoryCapture`, `SceneConsumptionCapture`, plus the composer rules in the 700px `@media` block |
| `WorkspaceStatBlockModal.module.css` | 20 | 95 | `WorkspaceStatBlockModal` |
| `UnknownEntityPanel.module.css` | 10 | 70 | `UnknownEntityPanel` |
| `WorkspaceHeader.module.css` | 4 | 60 | `WorkspaceHeader` (including the dynamic `reviewIndicator_${state}` classes) |
| `components/Onboarding/GettingStartedGuide.module.css` | 6 | 55 | `GettingStartedGuide`, the one user outside `Workspace/` |
| `WorkspaceDrawer.module.css` | ~16 | 120 | `WorkspaceContextDrawer`, `WorkspaceDrawerLayout`, `WorkspaceDrawerPanel`, `WorkspaceCharacterLabSection` |
| One module each | 3–10 each | 30–50 each | `WorkspaceExportModal`, `WorkspaceAITextReportModal`, `WorkspaceMemoryModal`, `WorkspaceChapterCardContext` (plus its `@media` rules), `CanonPanel`, `WorkspaceEditorFooter`, `WorkspaceEmptyState` |
| Stays in `WorkspaceRoute.module.css` | ~10 | ~150 | Route layout, plus the shared modal shell used by 7–9 dialogs (backdrop, panel, header, actions) |

- **Dead rules (about 130 lines).** No `.ts`/`.tsx` file or Cypress spec
  references `drawerToggleRow`, `consistencyPanel` (and its header),
  `unknownList`, `unknownItem`, `unknownSurface`, `unknownSelect`,
  `unknownNote`, `consistencyPopover` and its `Title`, `Message`, and
  `Close` parts, or `positionedChangeGrid`. Delete them in a separate
  commit inside the slice, so the move commit stays a pure move. (The
  `consistencyPopover` matches in `useUnknownEntityResolution.ts` are a
  variable, not the class.)
- **Cascade risks.**
  - Two `@media` blocks, at 700px (`:1849`) and 760px (`:2337`), both
    override `chapterCardContext`, `corkboardCardFields`, and
    `corkboardPlotActions`. Both must move with their rules, in the same
    order.
  - Nine compound or descendant selectors exist. These cross components:
    `consistencyPopoverActions .captureNameField` (`:1361`), shared by the
    two surface popovers, which belongs in the review module.
    `changeComposerDisclosure .changeComposerFields` (`:1797`) belongs in
    the capture module.
  - `scratchpadEditorShell` and its `:global(.tiptap-*)` and
    `:global(.ProseMirror)` rules (`:2313-2335`) are used by both
    `WorkspaceContextDrawer` (`:420`) and `WorkspaceScratchpadModal` (`:56`).
    Move them together into one module that both import, either the drawer
    module or the scratchpad's own module, and do not copy them.
- **Verify.** As 3.32a: full-coverage tier and before/after screenshots of
  every Workspace surface (drawer tabs, scene drawer, roster, each modal,
  review popovers, empty state, Getting Started) in both themes and at
  700px and 760px. They must be pixel-identical.
- **Size.** The largest new module is about 335 lines and the route module
  about 150. The route module leaves the baseline.

---

## Found while mapping (not in S1)

- **3.61 One download helper.** `utils/downloadJson.ts` already exports
  `triggerBlobDownload` and `triggerJsonDownload`, but five copies of the
  same link-click code remain: `AISettings.tsx:331`,
  `services/storage/jsonTransfer.ts:11` (`downloadJsonFile`),
  `services/storage/projectBackupExport.ts:15` and `utils/sceneExport.ts:15`
  (identical private `downloadBlob`), and
  `services/portability/portableData.ts:517`. Point them all at the util.
  Size XS; behavior-preserving. 3.59 takes the AISettings copy if it lands
  first.

## Suggested order

1. **3.58 Editor**, since writing features touch it most often (5.17,
   5.19).
2. **3.59 AI Settings**, next in line for provider and action work.
3. **3.57 Consistency engine.**
4. **3.60 CSS** at any time. It is independent of the others but needs the
   screenshot rig.
