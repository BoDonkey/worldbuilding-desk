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

# EDITOR FLOW REFACTOR

## GOAL

User can type immediately with zero setup.

---

## Step 1 — Simplify Editor Layout

### Action

Ensure layout is:

[ optional left nav ]  [ EDITOR (dominant) ]  [ optional right panel ]

### Constraints:

* Editor must occupy ≥ 70% width
* Sidebars must be collapsible

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

* inline indicators (underline, icon, tooltip)

---

# ENTITY DETECTION (KEEP, BUT SOFTEN)

## GOAL

Preserve existing detection logic, but reduce UX friction.

---

## Step 1 — Convert Detection to Passive

### If current behavior is:

* modal popup
* forced confirmation
* blocking input

### Change to:

* inline highlight only

---

## Step 2 — Add Lightweight Interaction

### On hover or click:

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

# CODEX REFACTOR

## GOAL

Codex is read-only first, editable second

---

## Step 1 — Remove Mandatory Fields

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

## Step 2 — Simplify Codex UI

### Replace complex form with:

Name
Short description (optional)
Recent mentions (auto)
Notes (free text)

---

## Step 3 — Collapse Advanced Fields

### Move to:

* accordion sections
* "Advanced" toggle

Examples:

* stats
* relationships
* rule bindings

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

## Step 4 — Move Linter to Side Panel

### DO NOT:

* interrupt typing

### DO:

* show summary in side panel
* highlight inline text

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
Codex
Review

---

## Step 2 — Nest Everything Else

Move under:

* Codex
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
   * highlights softly
5. User optionally:

   * views codex
   * sees suggestions
6. No interruptions occur

---

# VALIDATION CHECKLIST

After refactor, confirm:

* Can user start writing in <5 seconds?
* Is the editor visually dominant?
* Are there ZERO required setup steps?
* Can all system feedback be ignored?
* Does AI only act when asked?
* Is Codex optional?

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

If they say:

“I wasn’t sure what to do first”

The refactor failed.
