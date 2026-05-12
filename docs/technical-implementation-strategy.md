# Technical Implementation Strategy: Narrative Engine UX Refactor

This document outlines the technical approach, effort estimation, and architectural decisions for implementing the "Writing-First" UX patterns defined in `docs/ux-refactor.md`.

---

## 1. Code Burden Assessment

**Overall Effort:** Large (High ROI)
The refactor focuses on the **orchestration layer** rather than rebuilding core services.

| Work Package | Effort | Risk | Key Tech |
|--------------|--------|------|----------|
| **Zustand Migration** | Medium | Low | Zustand Slices, Persistence Middleware |
| **Gutter Ghost** | Medium | Low | TipTap Decoration API, React Portals |
| **Omni-Rail** | Heavy | Medium | Zustand, RAG/Shodh Services, Focus Debouncing |
| **Lore Document** | Medium | Low | Modular TipTap, Fullscreen Portals |
| **Seedling** | Low | Low | TipTap Selection Popover API |

---

## 2. Implementation Details

### A. The Gutter Ghost (Ambient Context)
*   **Logic:** Implement a custom TipTap extension that calculates line-relative positions for "lore hits" and "linter warnings."
*   **UI:** Use React Portals to render faint icons in the vertical gutter. This keeps the icon layer separate from the text layer for better performance.
*   **Orchestration:** Sync icon visibility with the editor's `update` event. Icons should be "anchored" to specific node IDs (like Scene IDs) to ensure they stay in place during deletions/insertions.

### B. The Omni-Rail (Context Coordination)
*   **Logic:** A centralized Zustand slice (`useContextStore`) will act as the "Context Broker."
*   **Interaction Flow:** 
    1. The editor reports the current cursor position/text-under-cursor to the store.
    2. The store triggers async RAG/Shodh lookups.
    3. Results are cached in the store.
    4. The Omni-Rail subscribes to this store and renders the appropriate card (Character, Rule, Lore).
*   **Performance:** Use a "Focus Pause" (e.g., cursor must be idle for 300ms) before triggering heavy RAG lookups to prevent lag during rapid drafting.

### C. The Lore Document (Modular TipTap)
*   **Refactor:** Extract the core logic from `TipTapEditor.tsx` into a reusable `BaseEditor` component.
*   **Application:** 
    * The Manuscript uses `BaseEditor` as its primary view.
    * The World Bible Entry uses `BaseEditor` in its detail view.
    * Use an `isFullscreen` prop to toggle the "Lore Document" mode, which swaps the layout to a distraction-free, full-width surface.

### D. State Management Foundation (Zustand)
*   **Priority:** Consolidate `activeProject` and `projectSettings` into Zustand *before* implementing the Omni-Rail.
*   **Persistence:** Use Zustand's `persist` middleware to handle `localStorage` syncing for shell state (rail collapse, active tab) and IndexedDB for project-specific settings.

---

## 3. Risk Mitigation

*   **TipTap Bloat:** Keep the Gutter Ghost extension lightweight. Avoid expensive DOM traversals on every keystroke.
*   **RAG Latency:** Ensure Shodh lookups are non-blocking and use stale-while-revalidate (SWR) patterns so the UI never "waits" for the database.
*   **Mechanical Access:** Always provide a "Deep Link" button on Omni-Rail cards to jump to the full World Bible/Rules route, ensuring power users never feel "locked out" of the system.
