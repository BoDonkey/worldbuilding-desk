
# Narrative Engine UX Principles & Flow (MVP-Focused)

## Purpose

This document defines the **core UX philosophy and flows** for the Narrative Engine.

The goal is to:
- Reduce cognitive load
- Hide system complexity
- Preserve creative flow
- Introduce structure *without friction*

---

# Core UX Principles

## 1. Writing Comes First

**The editor is the product. Everything else is secondary.**

- No required setup before writing
- No forced schema creation
- No blocking interactions

> If the user cannot start writing within 5 seconds, the UX has failed.

---

## 2. Structure is Invisible by Default

All structured systems (Codex, stats, rules) must:

- Be **auto-generated**
- Be **optional to interact with**
- Never interrupt writing

Users should feel:

> “The system understands my story”  
NOT  
> “I need to configure my story”

---

## 3. AI is a Collaborator, Not an Author

AI must:
- Assist
- Suggest
- Refine

AI must NOT:
- Take over writing
- Generate large chunks unprompted
- Replace the user’s voice

---

## 4. Feedback is Soft, Not Blocking

The system should:
- Suggest issues
- Highlight inconsistencies
- Offer fixes

The system should NOT:
- Prevent writing
- Force corrections
- Behave like a compiler

---

## 5. Complexity is Progressive

Advanced features (rules, stats, systems) should:

- Appear only when relevant
- Be introduced gradually
- Never be required upfront

---

# Core UX Flow

---

## 1. Entry Point (No Onboarding Wall)

### User lands in the app

They see:
- A blank editor
- Optional placeholder text:
  > “Start writing your story…”

No:
- Forms
- Setup wizards
- Codex creation steps

---

## 2. Writing Begins

User types:

> “Kaelen raised his hand and cast a massive fireball…”

---

## 3. Entity Detection (Background System)

System detects:
- Characters (Kaelen)
- Actions (cast fireball)
- Concepts (magic)

### UI Behavior

- Subtle underline or highlight
- On hover:

```

Kaelen (new character detected)
[Add to Codex] [Ignore]

```

No modal. No interruption.

---

## 4. Codex Creation (Auto-Generated)

When user clicks or interacts:

### Sidebar opens with pre-filled data:

```

Name: Kaelen
Detected Traits: [inferred]
Recent Actions: cast fireball

```

User can:
- Edit
- Ignore
- Close

### Important:
Codex entries are created **automatically**, not manually.

---

## 5. Passive Codex Growth

As writing continues:

System updates:
- Character actions
- Relationships
- Emerging traits

Codex evolves without user effort.

---

## 6. Narrative Linter (Soft Feedback)

When inconsistency is detected:

Example:
- Mana = 5
- Action = “massive fireball”

### UI Behavior

- Subtle highlight in text
- Right-side panel shows:

```

⚠ Possible inconsistency:
Kaelen may not have enough mana.

[Ignore]
[Adjust mana]
[Ask AI for alternatives]

```

### Rules:
- No blocking
- No forced fixes
- Always ignorable

---

## 7. AI Interaction Model

User selects text → context menu appears:

Options:
- Improve clarity
- Adjust tone
- Expand slightly
- Check consistency

### Explicitly avoid:
- “Write next paragraph”
- Full auto-generation

---

## 8. World Rules (Optional Layer)

Accessible via tab or panel.

Example:

```

World Rule:
Fire magic requires mana ≥ 20

```

Rules:
- Feed into linter
- Influence AI suggestions

### Important:
- Not required
- Introduced only after user engagement

---

## 9. Progressive Disclosure

Do NOT show all features upfront.

### Suggested progression:

1. Writing only
2. Entity detection appears
3. Codex becomes visible
4. Linter activates
5. Rules become available

---

# Anti-Patterns (Avoid These)

## ❌ Heavy Onboarding
- Multi-step setup flows
- Required Codex creation
- Forced world-building

## ❌ JSON Exposure
- No raw schemas in UI
- No developer-style interfaces by default

## ❌ AI Takeover
- No auto-writing large sections
- No replacing user intent

## ❌ Hard Enforcement
- No “errors”
- No blocked actions

---

# MVP Feature Set

## Required

- Clean writing editor
- Entity detection (basic)
- Auto Codex creation
- Simple Codex sidebar
- One linter rule (e.g., stat mismatch)
- Basic AI assist (selection-based)

## Not Required (V2+)

- Full stat systems
- Complex world rules
- Game mode
- Advanced UI panels
- Deep automation

---

# Future Direction (Do Not Build Yet)

## Game Mode (Concept Only)

The system can later support:

- “Play Scene” mode
- AI acting as a directed dungeon master
- State-driven outcomes

This is built on the same engine but is NOT part of MVP.

---

# Final Guiding Principle

> The system should feel like it understands the story,  
> not like the user is managing a system.

---

# One-Line Product Definition

“A writing tool that quietly tracks everything and catches mistakes without getting in your way.”