# Brand Positioning: Consistency Engine

_Last updated: February 25, 2026_

## Positioning Statement
This product is a **Consistency Engine for worldbuilders**, not an AI ghostwriter.

Core promise:
- You create the story.
- The engine enforces continuity, state, and rules.

Tagline:
- **"You write the prose. We enforce the world."**

## Prime Directive
**We do not write the story. We keep the story straight.**

All product copy, UI language, and demos must reinforce this.

## Category Definition
We are building in the category:
- `Consistency Engine`

Not in the category:
- `AI Writing Assistant`
- `AI Co-author`
- `Book Generator`

## Messaging Pillars

### 1) Deterministic Continuity
Narrative text is validated before commit against authoritative state.

Proof points:
- Unknown entities block commit.
- Ambiguous references block until clarified.
- State conflicts are flagged and resolved before commit.

### 2) Human Authority
The author remains final decision-maker.

Proof points:
- New entities require explicit approval.
- Overrides require explicit reason.
- No silent auto-persistence of generated content.

### 3) Auditable World Logic
State changes are explainable and traceable.

Proof points:
- Typed backend mutation commands.
- Before/after state hashes.
- Event log for accepted/rejected/overridden changes.

### 4) Local-First Ownership
Your world data remains yours.

Proof points:
- Local-first architecture.
- No model training on private world data.
- Lore/state under user-controlled storage.

## Anti-Slop Stance
Position:
- AI handles bookkeeping and consistency checks.
- Humans handle voice, intent, and final prose.

Short form:
- **"Replace spreadsheets, not authors."**

## Terminology Guardrails

### Forbidden Terms
- Writing assistant
- AI co-author
- Generates your novel
- Creative partner
- Ghostwriter
- One-click book

### Preferred Terms
- Consistency engine
- Deterministic logic layer
- State enforcement
- Rules validation
- Campaign manager
- Lore keeper

## Feature Framing Rules
If a feature uses generation, frame it as draft support, not final creation.

Correct:
- "Generate a draft stat block, then approve and edit."
- "Prototype flavor text and keep canonical state consistent."

Incorrect:
- "Let AI invent your world for you."
- "Auto-write scenes and chapters for you."

## Objection Handling (External)

### "This is just AI slop tooling."
Response:
- "It is a consistency engine with pre-commit validation and deterministic state mutation. The model cannot silently rewrite canon state."

### "AI will steal my worldbuilding data."
Response:
- "The product is local-first. Your world data remains on your machine and is not used to train external models."

### "It removes author creativity."
Response:
- "It removes continuity bookkeeping. Authors keep full control of prose and final decisions."

## UI Copy Guidelines

### Buttons / Labels
Use:
- `Validate Consistency`
- `Resolve Unknown Entity`
- `Approve Entity`
- `Apply State Changes`
- `Override with Reason`

Avoid:
- `Generate Story`
- `Auto-Fix Plot`
- `Write For Me`

### Notifications
Use:
- "Commit blocked: unknown entity detected."
- "Consistency conflict detected: resolve or override with reason."

Avoid:
- "AI improved your story."

## Demo Narrative (Critical)
Every demo should include:
1. Unknown entity hard block.
2. Manual approve/create entity flow.
3. Deterministic state update through typed command.
4. Visible audit entry for mutation/override.

This proves the product is enforcement infrastructure, not unconstrained generation.

## Alignment with Implementation Plan
Messaging must map to shipped behavior in [`docs/consistency-engine-implementation-plan.md`](/Volumes/T7/Development/worldbuilding-desk/docs/consistency-engine-implementation-plan.md):
- Pillar 1 -> Epics A, C, D.
- Pillar 2 -> Epics C, D.
- Pillar 3 -> Epics B, F.
- Pillar 4 -> platform/local-first architecture + privacy policy.

## Phase 1 Copy Checklist (Pre-Ticket Start)
Before building Phase 1 tickets, verify:
- Homepage and docs use "Consistency Engine" as primary category term.
- No "AI writer/co-author" language in product UI.
- Guardrail messages use enforcement language (block, validate, resolve).
- One short anti-slop explainer is present in onboarding/landing copy.

## One-Sentence Positioning
**A local-first consistency engine for LitRPG/TTRPG worldbuilders that enforces canon state before text is committed.**
