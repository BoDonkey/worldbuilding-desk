# Table-Stakes Release Checklist

Last updated: 2026-04-10

## Goal

Define the minimum feature and reliability bar for a credible local-first authoring release.

This checklist is stricter than a roadmap. It is meant to answer:

- What already exists and can be treated as baseline
- What is only partially implemented
- What is still missing and blocks a serious release

Status labels:

- `Shipped`: implemented and surfaced in the app
- `Partial`: code exists, but validation, UX, or finish work is still needed
- `Missing`: not implemented enough to count

## 1. Project Safety and Portability

### 1.1 Full project backup export/import

Status: `Shipped`

Evidence:

- Backup export exists in `Projects` route and storage services.
- Backup import exists with `new` and `merge` modes.
- Snapshot count validation utilities exist.

References:

- [ProjectsRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/ProjectsRoute.tsx)
- [projectBackupExport.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/services/storage/projectBackupExport.ts)
- [projectBackupImport.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/services/storage/projectBackupImport.ts)
- [projectSnapshotService.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/services/storage/projectSnapshotService.ts)
- [project-backup-smoke-test.md](/Volumes/T7/Development/worldbuilding-desk/docs/project-backup-smoke-test.md)

Release gate:

- Export `.zip` from a populated project
- Validate the exported backup successfully
- Import into a new project with count parity
- Merge into an existing project with clear conflict summary and explicit mismatch messaging when counts differ

Remaining work:

- Confirm all expected stores are included, especially newer review/alias-related data
- Tighten user-facing validation/result messaging if any mismatch path is unclear

### 1.2 No obvious data-loss path on reload

Status: `Partial`

Evidence:

- Lint/build pass
- Storage is local-first and most flows persist to IndexedDB
- Architecture review still flags fragmented state sources

References:

- [PROJECT_STATUS.md](/Volumes/T7/Development/worldbuilding-desk/PROJECT_STATUS.md)
- [architecture-review.md](/Volumes/T7/Development/worldbuilding-desk/docs/architecture-review.md)

Release gate:

- Create/edit/save/import flows survive reload without state desync
- Active project, settings, and route-level persisted UI state restore predictably

Remaining work:

- Run end-to-end smoke coverage around project switching, workspace reload, and import/save flows
- Decide whether store consolidation is required before release or acceptable as post-release debt

## 2. Manuscript Export and Publishing Path

### 2.1 Scene/manuscript export to Markdown

Status: `Shipped`

Evidence:

- Workspace exposes `Export MD`
- Markdown export builder exists

References:

- [WorkspaceRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/WorkspaceRoute.tsx)
- [sceneExport.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/utils/sceneExport.ts)

### 2.2 Scene/manuscript export to DOCX

Status: `Shipped`

Evidence:

- Workspace exposes `Export DOCX`
- DOCX builder exists

References:

- [WorkspaceRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/WorkspaceRoute.tsx)
- [sceneExport.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/utils/sceneExport.ts)

### 2.3 EPUB export

Status: `Partial`

Evidence:

- Workspace exposes `Export EPUB`
- Command wiring and EPUB builder paths exist

References:

- [WorkspaceRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/WorkspaceRoute.tsx)
- [sceneExport.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/utils/sceneExport.ts)
- [workspaceCommands.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/commands/workspaceCommands.ts)

Release gate:

- EPUB downloads and opens in a standard reader
- Scene order is preserved
- Basic metadata and chapter structure are valid

Remaining work:

- Fix any packaging/reader compatibility issues found in Apple Books, Calibre, or Kindle Previewer

### 2.4 Compile manuscript workflow

Status: `Partial`

Evidence:

- Export modal and scene ordering controls exist
- The docs still treat manuscript compile as an explicit release-level workflow

References:

- [WorkspaceRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/WorkspaceRoute.tsx)
- [mvp-cut-list.md](/Volumes/T7/Development/worldbuilding-desk/docs/mvp-cut-list.md)

Release gate:

- User can choose included scenes, order them, and export a coherent manuscript artifact

Remaining work:

- Confirm the current modal is sufficient as the “compile manuscript” flow
- If not, add front matter/back matter support and clearer export intent wording

## 3. Import Confidence

### 3.1 Writing workspace imports

Status: `Shipped`

Evidence:

- `.txt`, `.md`, `.html`, `.docx`, and best-effort `.pages` import paths exist
- Import modes and post-import summary exist

References:

- [WorkspaceRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/WorkspaceRoute.tsx)
- [workspaceImport.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/utils/workspaceImport.ts)
- [import-pipeline-v2.md](/Volumes/T7/Development/worldbuilding-desk/docs/import-pipeline-v2.md)

### 3.2 World Bible structured import with conflict review

Status: `Shipped`

Evidence:

- JSON import and field mapping exist in World Bible
- Duplicate-name conflicts now require explicit skip, update, or create-duplicate resolution before commit

References:

- [WorldBibleRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/WorldBibleRoute.tsx)
- [mvp-cut-list.md](/Volumes/T7/Development/worldbuilding-desk/docs/mvp-cut-list.md)

Release gate:

- Duplicate name/category collisions are surfaced before commit
- User can choose create, skip, or merge/update behavior intentionally

Remaining work:

- Add broader import examples if category/schema mismatch handling proves confusing in practice

## 4. Canon and Review Safety

### 4.1 Unknown-entity and review completion workflow

Status: `Partial`

Evidence:

- Unknown entities can create draft records
- `needsCompletion` badges are implemented
- `Alternative names` now sync to alias storage
- Review state is still validation-derived, not a persisted queue

References:

- [useWorkspaceConsistency.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/hooks/useWorkspaceConsistency.ts)
- [Navigation.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/components/Navigation.tsx)
- [WorldBibleRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/WorldBibleRoute.tsx)
- [CompendiumRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/CompendiumRoute.tsx)
- [PROJECT_STATUS.md](/Volumes/T7/Development/worldbuilding-desk/PROJECT_STATUS.md)

Release gate:

- Review-created records are easy to find and finish later
- `Refresh review` and `Resume strict review` are clearly distinct
- Authors do not lose track of review work after reload or route changes

Remaining work:

- Clarify review actions in workspace UX
- Decide whether to persist a review queue

### 4.2 Canon contradiction review

Status: `Partial`

Evidence:

- Contradiction detection exists in workspace consistency review
- MVP docs still call for a review list with direct links to conflicting records

References:

- [useWorkspaceConsistency.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/hooks/useWorkspaceConsistency.ts)
- [contradictionReview.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/services/consistency/contradictionReview.ts)
- [mvp-cut-list.md](/Volumes/T7/Development/worldbuilding-desk/docs/mvp-cut-list.md)

Release gate:

- Contradictions surface with clear record-to-record navigation
- Authors can inspect both the scene claim and canon source without hunting manually

Remaining work:

- Audit the current review UI for direct-link usability
- Tighten navigation into the conflicting world/character records if needed

## 5. AI Reliability and Control

### 5.1 Provider configuration and prompt tools

Status: `Shipped`

Evidence:

- AI settings support provider keys
- Prompt tools can be created and defaulted by mode
- Tool pack import/export exists

References:

- [AISettings.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/components/Settings/AISettings.tsx)
- [AIAssistant.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/components/AIAssistant/AIAssistant.tsx)

### 5.2 Provider testing and diagnostics

Status: `Partial`

Evidence:

- Settings now expose a `Run Provider Diagnostics` action
- Ollama diagnostics query installed local models and allow applying a detected model directly
- Hosted-provider diagnostics currently validate local configuration but do not perform a live API probe

References:

- [mvp-cut-list.md](/Volumes/T7/Development/worldbuilding-desk/docs/mvp-cut-list.md)
- [AISettings.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/components/Settings/AISettings.tsx)
- [providerConfig.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/services/llm/providerConfig.ts)

Release gate:

- User can test configured provider connectivity before using it
- Failure messages identify likely cause: missing key, bad model, proxy unavailable, network/provider error

Remaining work:

- Decide whether hosted providers need a real connectivity probe or whether config validation is sufficient for MVP
- If live probes are required, add explicit network/proxy/model failure reporting for Anthropic, OpenAI, and Gemini

## 6. Discoverability and Basic Product UX

### 6.1 First-run onboarding

Status: `Missing`

Evidence:

- Docs still call for guided setup and onboarding help
- No dedicated first-run onboarding flow is visible in current route/component surface

References:

- [mvp-cut-list.md](/Volumes/T7/Development/worldbuilding-desk/docs/mvp-cut-list.md)

Release gate:

- New user can create first project, choose mode, import first content source, and understand the main navigation without outside help

### 6.2 App-wide search

Status: `Missing`

Evidence:

- MVP docs call for search across scenes and world bible
- Current surface shows route-local filters and AI retrieval, but not a unified app-wide search

References:

- [mvp-cut-list.md](/Volumes/T7/Development/worldbuilding-desk/docs/mvp-cut-list.md)

Release gate:

- One search entry point returns scene and World Bible matches with direct-open behavior

## 7. Product Packaging and Release Credibility

### 7.1 Desktop packaging

Status: `Missing`

Evidence:

- Project status still says the app is running as a web app, not a packaged desktop app
- Architecture review calls out packaging configuration as still missing

References:

- [PROJECT_STATUS.md](/Volumes/T7/Development/worldbuilding-desk/PROJECT_STATUS.md)
- [architecture-review.md](/Volumes/T7/Development/worldbuilding-desk/docs/architecture-review.md)

Release gate:

- A distributable desktop build exists for the intended target platform

### 7.2 Centralized app state/store migration

Status: `Partial`

Evidence:

- Architecture review still flags multiple overlapping state sources
- Current route refactors improved structure but did not finish state consolidation

References:

- [architecture-review.md](/Volumes/T7/Development/worldbuilding-desk/docs/architecture-review.md)
- [PROJECT_STATUS.md](/Volumes/T7/Development/worldbuilding-desk/PROJECT_STATUS.md)

Release gate:

- No recurring desync bugs across local state, IndexedDB, and persisted settings in common flows

Remaining work:

- Either ship a narrow store consolidation for project/app shell state
- Or explicitly defer with proven smoke coverage and known-risk acceptance

## Recommended Release Order

1. Review UX clarification and contradiction-navigation hardening
2. First-run onboarding
3. App-wide search
4. Provider diagnostics finish work
5. Desktop packaging and any must-fix state desync issues
6. External-reader EPUB verification

## Immediate Next Slice

If only one table-stakes slice should be tackled next, start here:

1. Add first-run onboarding for project creation, import modes, and route orientation
2. Keep the current smoke suite green while onboarding is added
3. Treat onboarding confusion or hidden core flows as release blockers before adding new persona features
