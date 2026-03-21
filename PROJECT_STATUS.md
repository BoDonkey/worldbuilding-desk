# Worldbuilding-Desk Project Status

**Last Updated:** March 15, 2026

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
  - Prompt-tool presets with first built-in writing critic persona

### UI Components
- Ruleset creation wizard + desktop import (planned).
- Character style editor.
- Project selector + parent-canon controls.
- Navigation system.
- Split editor/AI panel layout.
- Workspace command palette, drawer shell, system history, and lore inspector.
- Import modes (`strict`, `balanced`, `lenient`) with deferred review for imported scenes.
- Inline consistency review highlights + action popovers.
- Inline lore highlights + quick lore popovers for known entities/characters.
- Review queue for unresolved entities with create/link/dismiss actions, queue persistence, and highlight-to-review flow.
- Alias visibility in World Bible and alias-aware linking in workspace review.
- Editor appearance controls for reading width, editor surface, serif/sans/mono presentation, and line spacing.

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
pnpm dev:web
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

### Workspace Review, Canon UX, Editor Config, and First Persona (March 15, 2026)
- Extended smoke coverage for workspace/editor flows:
  - editor appearance persistence
  - drawer persistence
  - `.txt`, `.md`, `.html`, `.docx`, and `.pages` import paths
- Reworked unresolved-entity handling into a lightweight review queue instead of blind mass creation.
- Added per-item category selection, link-to-existing, dismiss, and batch create from the queue.
- Added `Add to Review` from editor text selection for missed mentions such as nicknames.
- Improved unknown-name normalization for possessives and honorifics (`Evelyn Harlow's`, `Dr.Harrison`, etc.).
- Persisted review queue state across route switches so authors can leave Workspace and resume review later.
- Fixed alias linking so aliases can target World Bible entries or characters, and surfaced aliases in World Bible cards.
- Reduced accidental canon creation risk by moving bulk create into the review queue.
- Cleaned up World Bible category management so category editing no longer overlaps the entry-create UI.
- Improved editor toolbar behavior for long documents and collapsed Canon Consistency Review into a compact summary by default.
- Expanded editor appearance settings:
  - serif / sans / mono text style
  - focused / wide reading width
  - paper / mist / contrast surface presets
  - tight / comfortable / airy line spacing
- Added theme-aware dark-mode variants for editor surfaces and tuned highlight readability.
- Added first built-in AI persona preset: `Writing Critic`, installable from Settings and usable through existing prompt-tool defaults.

**Immediate Next Slice**
- Improve AI persona usability in Workspace with explicit critique actions such as `Critique selected passage` and `Critique current scene`.
- Add draft / `needs completion` state for review-created World Bible records and surface that in navigation.
- Promote aliases into a first-class editable `Alternative names` field on World Bible entries.
- Revisit editor settings later for deeper customization only after the persona workflow feels right.

### Workspace Review + Editor UX (March 14, 2026)
- Added import modes and deferred review flow so non-strict imports remain writable without losing review context.
- Added best-effort `.pages` preview extraction with fallback guidance.
- Tightened unknown-entity extraction to suppress more connective/prose false positives.
- Moved unknown-entity handling into inline editor highlights with create/link/dismiss popovers.
- Added shared popover primitive and reused it for quick lore peeks on known entities and characters.
- Added editor readability controls:
  - serif/sans text style
  - focused/wide reading width
  - paper/mist/contrast editor surface presets
- Hardened import/save so RAG indexing and Shodh auto-memory failures do not block scene persistence.
- Added lightweight local embedding fallback when transformer model bootstrap fails in-browser.
- Improved settings copy for consistency detection keywords and import defaults.

**Follow-on**
- Persist `needs completion` state for review-created World Bible / Compendium records and surface that with badges in navigation.
- Promote alias handling into a first-class `Alternative names` field on World Bible entries and use it as the shared source of truth for review/lore matching.
- Continue editor appearance work later with richer font/color customization if needed.

### Systems Integration + Imports (February 22, 2026)
- Added settlement aura model and UI flow with generalized module sources (`trophy`, `structure`, `station`, `totem`, `custom`).
- Added community/logistics party synergy engine and surfaced active combo buffs + roster opportunities.
- Added settlement base stats and fortress progression tier effects, including explicit base-stat save/reset flow with validation/clamps.
- Integrated runtime modifiers into craftability checks (effective level + material multiplier from settlement/synergy state).
- Integrated runtime-adjusted previews into Character Sheets (effective level/stat/resource values shown alongside base values).
- Added Workspace multi-file import for `.txt`, `.md`, `.html`, and `.docx`; `.doc` now returns explicit convert-to-docx guidance.
- Added `docs/next-steps.md` with prioritized roadmap and phase exit criteria.

**Immediate Next Slice**
- Expand runtime integration beyond previews into persisted gameplay outcomes (rule/action resolution paths).

### Canon Management & Inheritance (February 8, 2026)
- Added parent/child project metadata (RAG + Shodh inheritance toggles, canon timestamps).
- Built composite Shodh/RAG providers so child projects read parent canon read-only while writing locally.
- Implemented promote workflows for scenes, world-bible entries, ruleset summaries, and individual memories.
- Added promote buttons + provenance labels (Local vs Parent) across Workspace, World Bible, Character Sheets, and AI Assistant context.
- Added parent-canon banners with sync controls in Projects, Workspace, and World Bible routes.

### AI Integration
- Multi-provider abstraction (Anthropic, OpenAI, Ollama) with caching.
- Indexed prompt management + Shodh memories feeding context.
- Context-aware assistance with selectable insertion and AIExpandMenu.
- Local RAG/Shodh layers now support inherited canon for AI grounding.


### Prompt & Tooling Controls (Planned)
- Expose per-project system prompt editing with tone/policy presets.
- Allow authors to define “ick” word lists and style rules that attach to documents/imports.
- Tie prompts/policies into import workflows so external documents inherit the right AI context.
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

### Storage / Canon
- IndexedDB per project, no remote sync yet
- Child projects inherit parent canon read-only; promotion requires approval
- Manual backup/export (multi-source import planned next)

### Workspace / Review UX
- Review-created World Bible entities do not yet automatically seed Compendium records.
- World Bible / Compendium `needs completion` badges are not implemented yet.
- `Alternative names` are not yet exposed as a first-class editable World Bible field.
- Alias candidate scoping in the review queue still falls back broadly and may need a more explicit category/all-record toggle.

### Editor Appearance
- Editor appearance controls are still intentionally coarse-grained; users cannot yet choose custom fonts, dyslexia-friendly fonts, or custom highlight palettes.
- The fixed toolbar behavior is much better, but may still need refinement if edge scrolling cases show up again.

### AI Authoring Tools
- Only the first persona preset exists so far.
- There are no dedicated one-click critique actions yet for selected passage vs full scene.

---

## Planned Next Steps

### Short Term (Next Phase)
1. **AI Persona Workflow**
   - Add explicit critique actions for selected passage and current scene.
   - Keep persona outputs structured and manual-apply.
   - Confirm the first persona feels useful before adding more.
2. **Review Completion Workflow**
   - Add draft / needs-completion state to review-created World Bible and Compendium records.
   - Surface completion badges in navigation and review flows.
   - Promote `Alternative names` into the World Bible editing model.
3. **Lore / Compendium Tooltip Convergence**
   - Expand shared popover into a full lore + compendium review shell.
   - Support cross-linking shorthand references and alias management from tooltip flows.
4. **Editor Customization Follow-up**
   - Add richer typography controls only if the current presets prove too limiting.
   - Consider dyslexia-friendly fonts and custom highlight palettes.

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
