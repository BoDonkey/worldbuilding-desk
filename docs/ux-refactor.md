# Narrative Engine UX Refactor — Actionable Implementation Guide

## Purpose

This document provides **concrete, code-level refactor instructions** to reduce UX complexity in the existing Narrative Engine codebase.

It is intended for:

* coding agents (Codex, etc.)
* developers refactoring existing features

---

# Refactor Strategy

## Core Directive

Refactor the application to:

> Open directly into writing, with all advanced systems hidden by default.

---

# GLOBAL RULES (Apply Everywhere)

## RULE 1 — Remove Forced Onboarding

### Action

* DELETE or BYPASS any onboarding flow that:

  * requires user input before writing
  * introduces Codex, rules, stats, or systems upfront

### Replace with

* Direct navigation to editor on first load

---

## RULE 2 — Editor Is the Default Route

### Action

* Ensure `/` or initial route loads:

  * manuscript editor ONLY

### Remove from default view:

* Codex panels
* rule editors
* stat editors
* AI configuration panels

---

## RULE 3 — Hide Advanced UI by Default

### Action

* Set all side panels to:

  * collapsed = true
  * visible = false on initial load

### Applies to:

* Codex sidebar
* World rules panel
* Stats panel
* Debug/system panels

---

## RULE 4 — No Required Structure Creation

### Action

* REMOVE any code that:

  * blocks writing until a character/world is created
  * requires schema completion before saving

### Replace with:

* Lazy / auto creation

---

# AMBIENT UI PATTERNS (NEW)

## PATTERN 1 — The "Gutter Ghost" (Ambient Context)

### Concept:
Move all passive feedback (lore hits, linter warnings, system suggestions) out of the main text area and into the editor gutter.

### Implementation:
* **Remove:** Wavy underlines (red/blue) in the main text area.
* **Add:** Faint, low-contrast icons in the vertical gutter to the left of the line numbers.
* **Interaction:** 
  * Icons remain "faint" unless the line is active or hovered.
  * Hovering an icon reveals a **Context Bubble** with a summary (e.g., "Lore: Elara has blue eyes").
  * Clicking an icon opens the **Omni-Rail** to the relevant entry.

---

## PATTERN 2 — The "Seedling" (Zero-UI Lore Capture)

### Concept:
Allow authors to capture new lore or entities without leaving the drafting flow or filling out forms.

### Implementation:
* **Action:** When text is selected, show a single **[Seed]** button in the selection popover.
* **Behind the Scenes:** 
  * Clicking [Seed] creates a "Draft Entity" in the background.
  * The system uses RAG/Shodh to auto-populate a summary from the surrounding context.
* **No Blocking:** Never open a full form or navigate away from the editor during a "Seed" action.

---

## PATTERN 3 — The "Omni-Rail" (Tab Consolidation)

### Concept:
Replace multiple static tabs (Lore, Rules, World Bible) with a single, dynamic sidebar that responds to cursor focus.

### Implementation:
* **Context Awareness:** The Omni-Rail updates its content based on the current cursor position or active line.
* **Dynamic Content:**
  * Near Character → Show **Character Mini-Sheet** (Stats, Status).
  * Near Game Mechanic → Show **Rule Trigger** (Dice, Formulas).
  * Near Location → Show **Atmospheric Anchors** (Shodh memories).
* **Deep Access:** Provide an "Edit Source" button for each card that opens the full World Bible/Rules view in a modal or separate route.

---

## PATTERN 4 — The "Lore Document" (Rich-Text Lore)

### Concept:
Treat lore entry as a writing task, not a data entry task. Replace basic form text areas with a robust, TipTap-based rich text editor.

### Status note (2026-05-11):
This is now partially implemented in the shipped app.

Implemented:
* World Bible longform `textarea` fields now use a TipTap-backed rich-text surface.
* Longform fields support **Expand to document** full-width editing.
* Import flows now preserve richer Markdown/HTML structure for longform lore fields and support document preview before apply.
* World Bible browse/review cards now show better lore summaries, including structure-aware excerpts and inline expansion.

Still open:
* Category editor fields are not fully converted to rich text.
* The larger "Omni-Rail" consolidation remains a future shell/navigation decision, not part of the current implementation.

### Implementation:
* **Replace:** Standard `<textarea>` elements in the World Bible and Category editors with a scoped instance of the **TipTap Editor**.
* **Unified Experience:** Authors should have the same formatting tools, keyboard shortcuts, and "feel" in the World Bible as they do in the manuscript.
* **Fullscreen Expansion:** 
  * For long-form backstories or detailed histories, provide an **"Expand to Document"** button.
  * This opens the lore entry in a distraction-free, full-width editor view.
* **Benefits:** 
  * Encourages deeper worldbuilding directly within the app.
  * Better indexing for Shodh (richer structure).
  * No need for authors to "write elsewhere and import."

---

# EDITOR FLOW REFACTOR

## GOAL

User can type immediately with zero setup.

---

## Step 1 — Simplify Editor Layout

### Action

Ensure layout is:

[ optional left nav ]  [ EDITOR (dominant) ]  [ Omni-Rail (right) ]

### Constraints:

* Editor must occupy ≥ 70% width
* Omni-Rail must be collapsible and default to closed.

---

## Step 2 — Disable Non-Essential UI

### Action

Temporarily DISABLE or HIDE:

* multi-panel dashboards
* split views
* timeline views
* relationship graphs
* stat visualizations

---

## Step 3 — Remove Interruptions

### Action

Search for:

* modal triggers on typing
* auto-open panels
* forced confirmations

### Replace with:

* Gutter Ghost indicators

---

# ENTITY DETECTION (KEEP, BUT SOFTEN)

## GOAL

Preserve existing detection logic, but reduce UX friction.

---

## Step 1 — Convert Detection to Passive

### Status note (2026-05-11):
The current mitigation path is no longer "replace everything with gutter-only markers first."

Implemented:
* Inline feedback now has project-level visibility modes: `Visible`, `Subtle`, and `Hidden while typing`.
* This preserves the existing highlight/review pipeline while letting authors suppress visual noise during active drafting.

Still open:
* A true gutter-only redesign remains optional future work if visibility controls still feel too intrusive after real usage.

### If current behavior is:

* modal popup
* forced confirmation
* blocking input

### Change to:

* Gutter Ghost marker only

---

## Step 2 — Add Lightweight Interaction

### On hover or click (via Gutter Ghost):

Show:

[Entity Name]
[Add to Codex] [Ignore]

### DO NOT:

* open full forms
* navigate away from editor

---

## Step 3 — Auto-Create Draft Entities

### Action

When entity detected:

* create internal record with:

  * name
  * type (if known)
  * first occurrence

### Mark as:

* status = "draft"

No user input required.

---

# CODEX & MECHANICS REFACTOR

## GOAL

The World Bible/Codex is a deep reference library, not a mandatory chore.

---

## Step 1 — Preserve Deep Customization (CRITICAL)

### Action:
Ensure that while the primary UI is "clean," the underlying **LitRPG Mechanics** (stats, progression, formulas) remain fully editable for power users.

### Guidelines:
* **Stats & Progression:** Do not "gate out" customization. Authors must be able to define custom stat sheets and progression logic in the World Bible/Rules views.
* **The "Deep Link":** Every card in the Omni-Rail should have a clear path to its "Full Editor" in the World Bible.
* **Complexity Nesting:** Use "Advanced" toggles to hide complexity *within* forms, but do not remove the capabilities themselves.

---

## Step 2 — Remove Mandatory Fields

### Action

Find schema validation requiring:

* backstory
* stats
* relationships
* attributes

### Change:

* all fields optional
* allow partial entries

---

## Step 3 — Simplify Codex UI

### Replace complex form with:

Name
Short description (optional)
Recent mentions (auto)
Notes (free text)

---

## Step 4 — Prevent Codex Navigation Hijack

### Action

Ensure:

* opening codex does NOT replace editor
* codex opens as:

  * side panel OR modal overlay

---

# LINTER REFACTOR

## GOAL

Convert from system enforcement to soft suggestions

---

## Step 1 — Remove Blocking Logic

### Action

Find:

* validation that prevents saving or writing
* hard errors

### Replace with:

* non-blocking warnings

---

## Step 2 — Normalize Messaging

### Replace:

* Error
* Invalid
* Violation

### With:

* Possible issue
* You may want to review
* Potential inconsistency

---

## Step 3 — Add Ignore Path

Every linter issue must support:

* ignore
* dismiss permanently
* quick fix (optional)

---

## Step 4 — Move Linter to Gutter Ghost

### Status note (2026-05-11):
Not implemented as written. Current direction is to soften the existing inline system before attempting a full gutter rewrite.

### DO NOT:

* interrupt typing

### DO:

* show marker in gutter
* show summary in Omni-Rail when the line is active

---

# AI REFACTOR

## GOAL

AI is explicitly invoked only

---

## Step 1 — Remove Auto-Generation

### Action

Disable:

* auto-writing next paragraph
* background content generation
* unsolicited rewrites

---

## Step 2 — Restrict AI Entry Points

AI can ONLY be triggered by:

* text selection
* explicit button click

---

## Step 3 — Limit AI Scope

### Replace:

* Generate next scene

### With:

* Improve this text
* Rewrite with same tone
* Suggest alternative

---

# NAVIGATION REFACTOR

## GOAL

Reduce cognitive load

---

## Step 1 — Reduce Top-Level Routes

### Target:

Write
World Bible (formerly Codex)
Review

---

## Step 2 — Nest Everything Else

Move under:

* World Bible
* Settings
* Advanced

---

## Step 3 — Remove Redundant Views

### Identify:

* duplicate editors
* multiple ways to edit same data

### Keep only ONE primary path

---

# ONBOARDING REPLACEMENT

## GOAL

Zero-friction start

---

## Step 1 — Delete Wizard

Remove:

* step-by-step onboarding flows

---

## Step 2 — Add Inline Hint System

Example:

On first entity detection:

“We detected a character. You can track them if you want.”

Dismissible.

---

## Step 3 — Do Not Block Progress

User must be able to:

* ignore all hints
* continue writing uninterrupted

---

# FEATURE FLAG STRATEGY (CRITICAL)

## GOAL

Avoid breaking working features during refactor

---

## Step 1 — Introduce Flags

Example:

features = {
simplifiedUX: true,
disableAutoAI: true,
passiveCodex: true,
softLinter: true
}

---

## Step 2 — Gate Changes Behind Flags

Do NOT delete complex systems yet.

Instead:

* disable them via flags
* observe behavior

---

## Step 3 — Remove Later

After validation:

* remove dead code
* simplify architecture

---

# MINIMUM TARGET STATE (MVP UX)

## The app should behave as:

1. User opens app
2. Editor loads immediately
3. User writes
4. System:

   * detects entities
   * highlights softly in the gutter
5. User optionally:

   * clicks gutter icon to view context in Omni-Rail
   * seeds new lore from selection
   * jumps to World Bible for deep stat customization
6. No interruptions occur

---

# VALIDATION CHECKLIST

After refactor, confirm:

* Can user start writing in <5 seconds?
* Is the editor visually dominant?
* Are there ZERO required setup steps?
* Can all system feedback be ignored?
* Does AI only act when asked?
* Can power users still access deep stat/rule customization?

If any answer is NO → continue refactoring

---

# FINAL RULE

When uncertain, always choose:

* less UI
* fewer decisions
* more automation
* softer feedback

---

# PRODUCT TEST

If a new user says:

“I just started writing and it felt natural”

The refactor succeeded.

If a power user says:

"I can't find where to edit my character's Strength formula"

The refactor failed.
