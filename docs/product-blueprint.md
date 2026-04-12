# Product Blueprint: Worldbuilding-Desk

## Core Thesis

Worldbuilding-Desk should feel like a calm writing workspace that quietly understands the story around the draft.

The editor is the primary product surface. World data, rules, AI tooling, and consistency logic are supporting systems that should stay mostly invisible until the author needs them.

---

## Product Promise

### What the author should feel
- I can start writing immediately.
- The app notices important story context without interrupting me.
- I can inspect or correct structure when I want to, not when the app demands it.
- AI helps me refine and reason, but does not take over authorship.

### What the product should do
- Preserve flow.
- Surface context progressively.
- Track entities and canon passively.
- Offer soft consistency feedback.
- Keep advanced systems available for power users without making them mandatory.

---

## Positioning

### Compared with general AI writing tools
General AI writing products optimize for generation speed and prompt-driven output. Worldbuilding-Desk should differentiate on:

- context continuity
- story-aware assistance
- passive lore/canon capture
- consistency support inside the writing flow

### Compared with wiki-style lore tools
Static lore databases require manual upkeep. Worldbuilding-Desk should instead:

- grow structure from the manuscript
- connect writing to world context
- make references and consistency useful in the moment of drafting

---

## UX Principles

### 1. Writing Comes First
- No onboarding wall before drafting.
- No required schema setup before the first scene.
- The default route should privilege the manuscript editor.

### 2. Structure Is Progressive
- Characters, lore, rules, and systems should appear when relevant.
- Advanced surfaces should be collapsed or hidden by default.
- Authors should be able to ignore structure and keep writing.

### 3. Feedback Is Soft
- Consistency review should flag, not block.
- Suggestions should be dismissible.
- Review should feel closer to a linter than a compiler.

### 4. AI Is Assistive
- AI should refine, explain, summarize, and suggest.
- AI should not generate large unsolicited chunks.
- The app should preserve the author’s voice and control.

### 5. Systems Support Narrative
- Rules, stats, compendium state, and progression can be powerful differentiators.
- They should enrich narrative continuity, not dominate the primary interface.

---

## Product Layers

### Layer 1: Writing Workspace
The manuscript editor, scene navigation, import/export, selection tools, and lightweight inline feedback.

This is the daily-use layer and should absorb most interaction time.

### Layer 2: Context and Canon
World Bible, character records, aliases, memories, lore inspection, and parent/child canon inheritance.

This layer supports recall and continuity, but should remain secondary to drafting.

### Layer 3: Assistance
AI tools, prompt management, contextual retrieval, and consistency review.

This layer should help the author think and revise, not replace authorship.

### Layer 4: Advanced Systems
Rulesets, stats, resources, compendium mechanics, settlement progression, and LitRPG-specific runtime logic.

This layer is valuable and differentiating, but optional. It should be discoverable without being foregrounded.

---

## Target User Experience

### First-use experience
The author opens the app and lands in a draft-ready workspace. They can create or open a project and begin writing without being forced through setup.

### During writing
The app quietly tracks likely entities, relevant lore, and possible inconsistencies. It uses inline cues, highlights, and optional drawers instead of modal interruptions.

### When the author wants structure
They can open side panels, review world records, inspect lore, run review, or deepen rules support. Structured systems should feel like tools they opt into, not chores they must complete.

### When the author wants help
They can invoke AI on selected text or current context for refinement, brainstorming, consistency checks, or small transformations.

---

## Differentiators Worth Preserving

These are still strong assets and should remain in the product:

- integrated lore and manuscript context
- inline consistency review
- parent/child canon inheritance
- local/project memory support
- optional rules/stat infrastructure for system-heavy fiction
- import/export and backup flows suitable for real writing projects

The key change is emphasis: these should strengthen the writing workflow, not crowd it.

---

## Near-Term Product Direction

### Focus now
- tighten the writing-first workspace UX
- reduce default UI complexity
- soften review and entity interactions
- keep import/review flows resilient and low-friction

### Avoid for now
- pushing users into system configuration too early
- foregrounding rules/stat complexity on first load
- making the product pitch sound like a mechanics IDE before it sounds like a writing tool

---

## Working One-Sentence Summary

Worldbuilding-Desk is a writing-first narrative workspace that helps authors draft with live story context, soft consistency support, and optional deep world/rules systems when they need them.
