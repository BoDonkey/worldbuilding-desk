# Worldbuilding-Desk Project Status

**Last Updated:** January 11, 2026

## Project Overview

A comprehensive desktop application for LitRPG/GameLit authors that bridges narrative writing with integrated RPG mechanics. Built as an Electron app using React, TypeScript, and IndexedDB.

---

## Current Features ✅

### Core Systems
- **Rules Engine Package** (`packages/rules-engine/`)
  - Stat definitions with formulas (derived stats)
  - Resource definitions with regeneration
  - Dice roller with standard notation (2d6+3, etc.)
  - State manager for character progression
  - Modifier system (add/multiply/override)
  - Active effects and status tracking
  - Time-based mechanics and triggers

- **Project Management**
  - Create/delete projects
  - IndexedDB storage
  - Per-project rulesets
  - Settings storage with character styles

- **Character Sheets**
  - Linked to project rulesets
  - Dynamic stat/resource fields
  - Visual stat/resource editors
  - CRUD operations with persistence

- **World Bible System**
  - Dynamic categories (Characters, Locations, Items, etc.)
  - Custom field schemas per category
  - Rich text descriptions
  - Tagging and relationships

- **Item Editor**
  - Combined lore and mechanical properties
  - Damage formulas
  - Armor/resistance values
  - Weapon types and item categories

- **TipTap Rich Text Editor**
  - Custom character styles (stored marks)
  - Dynamic style toolbar
  - Settings UI for managing styles
  - Color picker and font styling

- **AI Integration**
  - Anthropic API integration via local proxy
  - Prompt management system
  - Context-aware assistance
  - Text insertion at cursor/selection
  - AIExpandMenu (right-click selected text)
  - RAG system for document indexing

### UI Components
- Ruleset creation wizard
- Character style editor
- Project selector
- Navigation system
- Split editor/AI panel layout

---

## How to Run the Project

### Prerequisites
```bash
# Node.js 18+ and pnpm
npm install -g pnpm
```

### Development Setup

**1. Install dependencies:**
```bash
pnpm install
```

**2. Start the proxy server (for AI features):**
```bash
# In one terminal
cd apps/web
npx tsx proxy-server.ts
# Runs on http://localhost:3001
```

**3. Start the web app:**
```bash
# In another terminal
pnpm dev
# Opens on http://localhost:5173
```

### Project Structure
```
worldbuilding-desk/
├── apps/
│   └── web/                    # Main Electron app
│       ├── src/
│       │   ├── routes/         # Main UI routes
│       │   ├── components/     # React components
│       │   ├── services/       # Business logic
│       │   └── entityTypes.ts  # TypeScript types
│       └── proxy-server.ts     # AI API proxy
│
├── packages/
│   └── rules-engine/          # Standalone rules package
│       ├── src/
│       │   ├── core/          # Engine, evaluator
│       │   ├── state/         # Character state
│       │   ├── utils/         # Dice roller
│       │   └── types.ts       # Type definitions
│       └── examples/          # Usage examples
│
└── pnpm-workspace.yaml        # Monorepo config
```

### Testing Examples
```bash
# Run rules engine examples
cd packages/rules-engine
pnpm build
npx tsx examples/basic-usage.ts
```

---

## Recent Changes & Fixes

### UI Foundation & Theming (January 11, 2026)
**Implemented:** Complete theming and accessibility foundation
- **Theme System:** Light/dark mode with CSS variables and ThemeContext
- **Navigation:** Fixed top navigation bar with active route highlighting
- **Accessibility:** Font size controls (small/medium/large) with system-wide scaling
- **Settings Page:** Reorganized layout with proper sections and styling
- **Design Tokens:** Established consistent color palette and spacing system

**Technical Details:**
- Created ThemeProvider and AccessibilityProvider contexts
- Implemented CSS custom properties for theme variables
- Added keyboard navigation focus indicators (WCAG compliant)
- Fixed navigation positioning (sticky → fixed)
- Consolidated settings UI into clean sectioned layout

### AI Integration (Latest)
**Problem:** Direct Anthropic API calls from browser failed due to CORS
**Solution:** Created Express proxy server at `apps/web/proxy-server.ts`
- Handles streaming responses
- Manages API key securely
- Routes `/api/anthropic/stream` to Anthropic API

### Editor State Management
**Problem:** TipTap editor losing reference during AI text insertion
**Solution:** Refactored `EditorWithAI` component
- Removed `onMount` callback approach
- Used `useRef` for stable editor reference
- Added proper `textToInsert` prop handling in TipTapEditor
- Fixed stale closure issues with `insertContext`

### Character Styles
**Problem:** Needed dynamic mark support for character dialogue
**Solution:** Implemented stored marks system
- Character styles saved in project settings
- Dynamic mark registration in TipTap
- Visual style editor with color picker
- Toolbar generation from settings

---

## Known Issues & Limitations

### Current Architecture
- Running as web app, not full Electron yet
- Proxy server must be started separately
- No native desktop packaging currently

### AI Features
- Proxy server doesn't persist across restarts
- API key must be entered per session
- No streaming UI feedback yet (planned)

### Storage
- IndexedDB only (no cloud sync)
- Manual backup required
- No export/import functionality

---

## Planned Next Steps

### Short Term (Next Session)
1. **AI Chat Window**
   - Integrate AI assistant panel
   - Use existing theming/a11y foundation
   - Consider workspace secondary menu needs

2. **Full Electron Migration**
   - Remove proxy server dependency
   - Native API calls via main process
   - Proper window management

3. **AI Enhancements**
   - Streaming UI with progress indicators
   - Prompt library/templates
   - Context injection from World Bible

4. **User Experience**
   - Project export/import
   - Auto-save indicators
   - Better error handling

### Medium Term
1. **Memory System Integration**
   - Evaluate Shodh-memory for canon tracking
   - Per-project memory stores
   - Contradiction detection
   - World Bible long-form documents

2. **Advanced Worldbuilding**
   - Timeline/chronology tools
   - Relationship graphs
   - Map integration
   - Scene planner

3. **Rules Engine Extensions**
   - Combat simulator
   - Character progression curves
   - Balance analysis tools
   - Import existing rulesets (D&D, etc.)

### Long Term
- Multi-user collaboration
- Cloud sync option
- Mobile companion app
- Plugin/extension system
- Marketplace for rulesets/templates

---

## Technical Debt & Cleanup

### Code Quality
- [ ] Add comprehensive error boundaries
- [ ] Implement proper TypeScript strict mode
- [ ] Unit tests for rules engine
- [ ] Integration tests for storage layer

### Documentation
- [ ] API documentation for rules-engine package
- [ ] Component documentation
- [ ] User guide/tutorials
- [ ] Video walkthroughs

### Performance
- [ ] Optimize large document rendering
- [ ] Lazy loading for World Bible entries
- [ ] IndexedDB query optimization
- [ ] Editor debouncing improvements

---

## Development Notes

### Key Learnings
- TipTap stored marks require careful state management
- React component remounting can cause editor issues
- Monorepo requires workspace resolution attention
- CORS is real, proxy servers work

### Architecture Decisions
- **Monorepo:** Clear separation between engine and app
- **IndexedDB:** Local-first, offline-capable
- **TypeScript:** Strict typing prevents runtime errors
- **Modular Design:** Each system can evolve independently

### Dependencies Worth Noting
- `@tiptap/react` - Rich text editing
- `@anthropic-ai/sdk` - AI integration
- `immer` - Immutable state updates (rules engine)
- `mathjs` - Formula evaluation
- `express` + `cors` - Temporary proxy

---

## Session Workflow

### Starting a Session
1. Read this file for current state
2. Check "Recent Changes" for context
3. Review "Planned Next Steps" for priorities
4. Start proxy server if testing AI features
5. Run `pnpm dev` in main terminal

### Ending a Session
1. Update "Recent Changes" section
2. Move completed items from "Planned Next Steps"
3. Add new issues to "Known Issues"
4. Update "Last Updated" date
5. Commit PROJECT_STATUS.md

---

## Quick Reference

### Important Commands
```bash
# Full dev setup
pnpm install && pnpm dev

# Just the app
pnpm dev

# AI proxy (separate terminal)
cd apps/web && npx tsx proxy-server.ts

# Build rules engine
cd packages/rules-engine && pnpm build

# Run examples
cd packages/rules-engine && npx tsx examples/basic-usage.ts
```

### Key Files to Know
- `apps/web/src/routes/` - Main application views
- `apps/web/src/entityTypes.ts` - Core data models
- `packages/rules-engine/src/types.ts` - Rules system types
- `apps/web/src/components/TipTapEditor.tsx` - Editor implementation
- `apps/web/src/services/` - Storage and business logic

### Port Usage
- `5173` - Vite dev server (main app)
- `3001` - Express proxy server (AI)

---

## Contact & Resources

### Related Documentation
- See `packages/rules-engine/README.md` for engine details
- See `Comprehensive_RPG_Rules_System_Design_Guide.docx` for design philosophy
- See `shodh_memory_integration_vision (1).md` for memory system plans

### External Resources
- TipTap Docs: https://tiptap.dev/
- Anthropic API: https://docs.anthropic.com/
- Shodh Memory: https://github.com/shodh-ai/shodh-memory

---

**Remember:** This file should be updated at the end of each major work session to maintain accurate project state.