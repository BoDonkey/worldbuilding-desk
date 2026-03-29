# Feature Spec: Scratchpad & Story Corkboard
_Worldbuilding Desk — integration draft_

This version adapts the original idea to the way the current app is built today:

- Rich text is stored as HTML across the app, not TipTap JSON
- Project utilities that should be reachable from anywhere belong at the app shell layer
- New top-level planning surfaces should be normal routes with command-palette and navigation support

## Feature 1: Scratchpad

### Overview
A freeform, unstructured writing space per project for capturing ideas without leaving the current screen.

In this app, the scratchpad should be a shell-mounted popover, not a route and not a normal tab. The author should be able to open it from any project screen, jot something down, and close it without losing navigation state.

### Goals
- Zero-friction capture of thoughts, snippets, and temporary notes
- Accessible from any project route without changing pages
- No pressure to formalize content into world bible, scenes, or characters
- Project-scoped persistence with autosave

### Non-Goals
- Not indexed for RAG in v1
- Not reviewed by the consistency engine in v1
- Not part of project backup/export in v1
- No history/versioning in v1

### UX
- Global launcher in the app shell
- Opens as a large popover anchored above the shell UI
- Also reachable from the command palette
- Plain rich-text editor with basic formatting only:
  bold, italic, headings, bullet lists, numbered lists
- Autosaves on change with debounce
- Per-project content
- Closing the popover preserves the user’s place in the current route

### Suggested Interaction Details
- Desktop: floating launcher at the lower-right edge of the shell
- Mobile: launcher stays above the bottom nav
- Shortcut: optional global shortcut for fast capture
- Empty state when no active project is selected

### Data Model
```typescript
interface ScratchpadDocument {
  id: string;          // projectId
  projectId: string;
  content: string;     // stored as HTML to match current editor storage
  createdAt: number;
  updatedAt: number;
}
```

### Storage
- Single IndexedDB record per project
- Dedicated store separate from writing documents
- Explicitly excluded from project snapshot/export in v1

### Integration Notes
- Scratchpad should be mounted in `AppShell`, not inside `WorkspaceRoute`
- It should not appear in normal route navigation as its own page
- Later “Promote to World Bible” or “Promote to Scene” actions can be added from a text selection flow, but are out of scope for v1

## Feature 2: Story Corkboard

### Overview
A planning surface for story structure, chapter arcs, and AI-assisted brainstorming.

Unlike the scratchpad, the corkboard should be a first-class route because it is a destination workflow, not a quick-capture utility.

### Route Placement
- New top-level navigation item: `Corkboard`
- Normal route such as `/corkboard`
- Included in command palette navigation commands

### Goals
- Bird’s-eye view of narrative arc
- LitRPG progression milestones visible alongside story beats
- Collaborative AI brainstorming at story, chapter, and card scope
- Promotion of selected brainstorm text into structured cards
- Useful for both plotters and pantsers

### Non-Goals
- Not a Kanban board
- No drag-and-drop reordering in v1
- No direct scene/document linkage in v1
- No auto-generated cards from manuscript text in v1
- No token usage telemetry in v1

## Recommended v1 Layout

```text
┌──────────────────────────────────────────────────────────────┐
│ CORKBOARD                                     Scope: Story ▼ │
├────────────────────────────────┬─────────────────────────────┤
│ Brainstorm Document            │ Chapter Outline             │
│                                │                             │
│ Freeform writing canvas        │ [Ch 1] Planned             │
│ with collapsible AI notes      │   - Plot point             │
│ below the author text          │   - Plot point             │
│                                │                             │
│ [Ask AI] [Compress History]    │ [Ch 2] Draft               │
│                                │ [Add Chapter]              │
└────────────────────────────────┴─────────────────────────────┘
```

### UX
- Left side is the dominant brainstorming document
- Right side is the structured chapter card column
- AI appears as collapsible annotations, not equal-weight chat bubbles
- “Brainstorm this chapter” sets scope in the shared workspace instead of opening a separate mini-thread

### Scope Model

| Scope | Context Sent |
|-------|---------------|
| Card | Selected chapter card plus adjacent cards |
| Chapter | Active chapter plus summaries of the rest |
| Story | Summaries of all chapters and plot points |

### Data Model
```typescript
interface PlotPoint {
  id: string;
  title: string;
  notes?: string;
  order: number;
}

interface ProgressionSnapshot {
  characterId?: string;
  level?: number;
  xp?: number;
  notable?: string[];
}

interface ChapterCard {
  id: string;
  projectId: string;
  title: string;
  summary?: string;
  status: 'planned' | 'draft' | 'written';
  order: number;
  progressionSnapshot?: ProgressionSnapshot;
  plotPoints: PlotPoint[];
  createdAt: number;
  updatedAt: number;
}

interface BrainstormMessage {
  id: string;
  projectId: string;
  role: 'user' | 'assistant';
  content: string;
  scope: 'card' | 'chapter' | 'story';
  scopeTargetId?: string;
  createdAt: number;
  isDigest?: boolean;
}
```

### Storage
- IndexedDB stores for chapter cards and brainstorm history
- Kept separate from writing documents in v1
- Can be added to backup/export later once the schema stabilizes

## Implementation Order

1. Scratchpad popover in `AppShell`
2. Scratchpad command-palette entry and shortcut
3. Corkboard route scaffold with navigation entry
4. Chapter card CRUD and IndexedDB storage
5. Brainstorm workspace and AI context controls
6. Promotion flows from brainstorm text to chapter and plot-point cards

## v2 Considerations
- Drag-and-drop chapter ordering
- Card linkage to scene/documents
- Progression snapshot auto-fill from character sheets
- Timeline or arc view
- AI-generated card extraction from existing manuscript content
- Promotion from scratchpad into corkboard/world bible
