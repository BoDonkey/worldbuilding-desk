# Feature Spec: Scratch Pad & Story Corkboard
_Worldbuilding Desk — Draft Spec_

---

## Feature 1: Scratch Pad

### Overview
A freeform, unstructured writing space per project. No schema, no validation, no world bible integration. A place to dump ideas without commitment.

### Goals
- Zero friction capture of thoughts, ideas, dialogue snippets, notes
- No pressure to formalize content into world bible or scenes
- Accessible quickly from any view

### Non-Goals
- Not indexed for RAG — ephemeral by design
- Not validated against consistency engine
- Not version controlled

### UX
- Single persistent tab/panel per project
- Plain TipTap instance — basic formatting only (bold, italic, bullet lists, headings)
- No save button — auto-saves on change (debounced)
- Optional: "Promote to World Bible" action to formalize a selected passage

### Data Model
```typescript
interface ScratchPad {
  projectId: string;
  content: JSONContent; // TipTap JSON
  updatedAt: Date;
}
```

### Storage
- Single IndexedDB record per project
- No history/versioning needed in v1

---

## Feature 2: Story Corkboard

### Overview
A visual chapter/arc planning board combined with a collaborative AI brainstorming workspace. Authors lay out chapters as cards, add plot point sub-cards, and work with an AI collaborator to develop the story. The AI contributes actively — not just answering questions, but flagging issues, asking questions, and helping firm up ideas. Authors can promote any text (their own or AI-generated) into cards.

Top-level navigation item in the app.

### Goals
- Bird's-eye view of narrative arc
- LitRPG-specific: progression milestones visible alongside story beats
- Collaborative AI brainstorming at card, chapter, and story scope
- Promote text selections directly into plot point sub-cards or chapter cards
- Works for pre-planning (plotters) OR post-hoc mapping (pantsers)

### Non-Goals
- Not a Kanban board
- No drag-and-drop reordering in v1
- Not linked to the scene/chapter editor in v1
- No auto-population from written content in v1
- No token usage indicators in v1

---

## UI Layout

```
┌─────────────────────────────────────────────────────────┐
│  STORY CORKBOARD                    [Story Brainstorm ▼] │
├─────────────────────────────┬───────────────────────────┤
│  BRAINSTORM WORKSPACE       │   CHAPTER CARDS           │
│                             │                           │
│  ┌─────────────────────┐    │  ┌─────────────────────┐  │
│  │                     │    │  │ Ch 1: The Beginning  │  │
│  │  Author writes      │    │  │ Status: Written      │  │
│  │  freely here...     │    │  │ ▸ Progression        │  │
│  │  (large, dominant)  │    │  │ ▸ Plot Points        │  │
│  │                     │    │  └─────────────────────┘  │
│  └─────────────────────┘    │                           │
│  [Ask AI]  Scope: [Story ▼] │  ┌─────────────────────┐  │
│                             │  │ Ch 2: The Journey    │  │
│  ▾ AI — Story scope         │  │ Status: Planned      │  │
│  ┌─────────────────────┐    │  │ ▸ Progression        │  │
│  │ AI annotation/      │    │  │ ▸ Plot Points        │  │
│  │ response appears    │    │  └─────────────────────┘  │
│  │ here, collapsible   │    │                           │
│  └─────────────────────┘    │  [+ Add Chapter]          │
└─────────────────────────────┴───────────────────────────┘
```

**Text selection → promote:**
- Select any text in the brainstorm workspace (author or AI side)
- Context menu appears: "Make Plot Point" | "Make Chapter Card"
- Card created pre-populated with selected text
- No distinction between author text and AI text — author decides what's worth keeping

---

## Brainstorm Workspace

### Interaction Model
- Author-first canvas — the writing area is dominant, AI is present but not intrusive
- Visually resembles a document, not a chat interface — no equal-weight chat bubbles
- Author writes freely in a large freeform area; AI responses appear as clearly marked annotation blocks below the author's text, collapsible, non-dominant
- AI can initiate — flag inconsistencies, ask clarifying questions, suggest directions — but as annotations, not interruptions
- Author explicitly invokes AI ("Ask AI" action) or AI responds when author pauses/submits
- Single persistent document-style thread per project
- Older history periodically compressed into a digest to manage context size

### Brainstorm Scope
Controls what context is sent to the AI:

| Scope | Context Sent |
|-------|-------------|
| **Card** | Selected card + adjacent chapter cards (prev/next) |
| **Chapter** | Full chapter card + plot points + compressed summaries of other chapters |
| **Story** | Compressed summaries of all chapters and plot points |

Scope selector lives in the input area. Card/Chapter scope activates automatically when brainstorming from within a specific card.

### AI Behavior
- At story scope: actively looks for pacing issues, motivation gaps, unresolved plot threads, progression curve problems
- At chapter scope: missing beats, weak transitions, setup/payoff opportunities
- At card scope: specificity, plausibility within world rules, mechanical implications
- AI is conversational but actionable — always moves the story forward, doesn't just summarize

### Context Management
- Conversation history persists in IndexedDB per project
- When history exceeds threshold, oldest messages are summarized into a rolling digest prepended to context
- Recent N messages always sent verbatim
- User can manually trigger "Compress History"

---

## Chapter Cards

### Structure
```
Chapter Card
  ├── Title
  ├── Summary (1-3 sentences)
  ├── Status: [ Planned | Draft | Written ]
  ├── Progression Snapshot (optional, collapsed by default)
  │     ├── Character Level
  │     ├── XP
  │     └── Notable: skills/loot/boss (free text tags)
  └── Plot Point Sub-cards (ordered list)
        ├── Title
        └── Notes (optional)
```

### UX
- Vertical list of Chapter Cards
- Each card is collapsible
- Plot Points are an ordered sub-list — add/remove/reorder inline
- Status badge: color coded Planned / Draft / Written
- Progression snapshot optional, collapsed by default
- Each card has a "Brainstorm this chapter" button that scopes the workspace to that card

---

## Data Model

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
  notable?: string[];         // "Learned Fireball", "Got cursed sword"
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
  createdAt: Date;
  updatedAt: Date;
}

interface BrainstormMessage {
  id: string;
  projectId: string;
  role: 'user' | 'assistant';
  content: string;
  scope: 'card' | 'chapter' | 'story';
  scopeTargetId?: string;     // chapterCard id if scope is card or chapter
  createdAt: Date;
  isDigest?: boolean;         // true if this is a compressed history summary
}

interface ScratchPad {
  projectId: string;
  content: JSONContent;
  updatedAt: Date;
}
```

---

## v2 Considerations
- Drag-and-drop chapter reordering
- Link Chapter Card to a scene/document in the editor
- Auto-populate progression snapshot from linked character sheet
- Timeline / horizontal arc view
- Pantser mode: auto-generate cards from written chapters via AI summary
- Token/context usage indicator
- Grid view option for cards

---

## Resolved Design Decisions
1. **Brainstorm workspace layout** — author-first document canvas, not a chat interface. AI responses appear as collapsible annotation blocks below author text, not equal-weight chat bubbles. Author invokes AI explicitly via "Ask AI" action.
2. **Card-level brainstorm** — clicking "Brainstorm this chapter" switches focus to the main brainstorm workspace, pre-scoped to that chapter automatically. No inline expansion inside the card.
