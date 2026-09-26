# Character Lab — Plan

**Status:** Accepted 2026-09-26. Scheduled as roadmap Slices 4.42–4.45 (after
3.10 and 4.46) and 5.14. Archive this plan once the slices land and the durable
behavior is folded into `docs/product-blueprint.md` and `docs/domain-model.md`.
**Origin:** the author's standalone single-file Ollama story/persona prototype
(kept outside this repository). It proved the value of talking to characters,
testing their reactions, and running short multi-character scenes. This plan
keeps those workflows and replaces the prototype's free-text memory with the
app's canon, accepted facts, and manuscript-time state.
**Constraints:** the trust boundary in `docs/architecture-review.md`; the
Character Identity Contract (`docs/domain-model.md` § 4); the Manuscript-Time
State Model (§ 3); the consultation budget (4.39) and hosted response limits
(4.41).

## What the prototype does, and what carries over

| Prototype workflow | Carries over as | Change from the prototype |
| --- | --- | --- |
| Persona "Talk" mode — converse in first person | 4.43 Talk | Grounded in canon + accepted facts + replayed state instead of a pinned text blob |
| Persona "Scenario" mode — "how would this person react to…" | 4.43 Reaction test | Same grounding; answer states uncertainty when canon does not decide it |
| Character scene — 2–3 characters, directed or "surprise me" | 4.44 Character scenes | "Surprise me" draws on World Canvas open threads and linked chapter cards |
| Persona generator — rough description → profile, immutable facts vs. suggested details | 4.45 Character from a description | Output is a World Bible draft plus fact **proposals**; nothing becomes canon on generation |
| Anti-agreeableness / no-invented-biography prompt rules | 4.42 Character voice contract | One shared, tested prompt module used by 4.43–4.45 |
| Encrypted project/character files (PBKDF2 + AES-256-GCM, passphrase never stored) | 5.14 Optional encrypted backups | Applies to the existing project backup format |
| "Finish chapter" memory update, rolling summary | Not carried over | The app already has extraction → review → accepted canon |
| Loose chapter arc, chapter brief | Not carried over as slices | Overlaps Corkboard and the writing coach; the "keep unresolved" idea is noted for coach/Corkboard design |
| Characters imported as independent copies | Not carried over | Violates the identity contract; imports go through identity resolution with no silent merges |

Prototype defects to avoid repeating: a captured setting ("Story
instructions") was saved but never included in any prompt, and a confirmation
dialog referenced in code did not exist in the markup, so "Finish chapter"
threw. 4.42 therefore tests that every author-facing setting reaches the
assembled prompt.

## Principles

1. **Creative, not canonical.** Lab output is draft text. It never writes
   canon, facts, state events, or manuscript content by itself. Moving output
   anywhere is an explicit author action (Scratchpad capture, insert at the
   Workspace cursor, or sending a candidate to the existing review queue).
2. **Grounded in accepted truth only.** Context uses the canonical character
   record, accepted facts, the assigned dialogue style, and replayed state at
   a chosen scene position. Pending or rejected proposals are excluded.
3. **Honest about knowledge.** Replayed state says what is true at a scene
   position, not what a character *knows*; per-character knowledge
   attribution is deferred (road-to-market Backlog). Prompts must not claim
   otherwise, and the UI labels the context as "story state at this point".
4. **Author-invoked and budgeted.** Every run is explicit, shows provider and
   cost per 4.39/4.41, and uses the ordinary provider path; local Ollama stays
   first-class. No background runs.
5. **Characters stay themselves.** Characters may disagree, refuse, hesitate,
   misunderstand, or change the subject; they must not become agreeable to
   please the author or invent major biography; uncertainty is stated when
   canon does not decide an answer.

## Slices

### 4.42 — Character voice contract (S, after 3.10)

- A read-only context builder for one character at a scene position:
  canonical record (stable ID), accepted facts, assigned dialogue style, and
  replayed state via `buildCharacterSnapshot` (4.46, `docs/archive/stat-peek-plan.md`)
  over the `rules-engine` replay API that 3.10 introduces.
  Returns tagged sections with provenance, in line with the shared context
  extraction direction.
- A shared prompt module for in-character generation holding the principle-5
  rules, with one variant each for talk, reaction, scene, and generation.
- Tests: pending/rejected facts excluded; state matches replay at the chosen
  position; every author-supplied setting appears in the assembled prompt;
  the knowledge disclaimer is present.
- No UI.

### 4.43 — Talk to a character + reaction test (M, after 4.42)

- Entry points: the character's World Bible page and the Workspace context
  drawer (defaulting the scene position to the current scene).
- Modes: **Talk** (first-person conversation) and **Reaction test** (describe
  a situation; get likely behavior, reasoning, and dialogue).
- The transcript lives for the session; **Save to Scratchpad** keeps it. No
  canon or state writes.
- The character's `CharacterStatCard` (4.46) sits beside the conversation,
  from the same snapshot the model is given.
- Budget, provider disclosure, Stop, and cut-off handling reuse 4.39–4.41.
- Cypress: open from both entry points, run against a stubbed provider, save
  to Scratchpad, and verify no canon/state records changed.

### 4.44 — Character scenes (M, after 4.43)

- Choose 2–3 characters and a scene position; **Directed** (author supplies
  the setup) or **Surprise me** (drawn from World Canvas open threads and the
  current scene's linked chapter card, if any).
- Output is draft prose with speaker-attributed dialogue; actions are
  **Save to Scratchpad** and **Insert at cursor** in Workspace (an ordinary
  editor insert, undoable).
- Tests assert each selected character's context is included and no
  unselected character's context is.

### 4.45 — Character from a rough description (M, after 4.42)

- The author writes a few sentences; the model returns a profile split into
  **stable facts** and **suggested details**, with no invented names or major
  biography that the description does not imply.
- Accepting creates a World Bible character **draft** (an explicit author
  action); stable facts enter the existing fact-proposal review; suggested
  details stay as editable notes on the draft.
- Name collisions go through identity resolution; never a silent merge.

### 5.14 — Optional encrypted backups (S–M)

- An optional passphrase on project backup export: PBKDF2-SHA256 (600k
  iterations) → AES-256-GCM, with a versioned envelope recording KDF
  parameters, salt, and IV. The passphrase is never stored.
- Import detects the envelope and asks for the passphrase; a wrong passphrase
  fails closed with a plain-language error, and unencrypted backups keep
  working unchanged.
- Smoke: add encrypted round-trip steps to the backup procedure in
  `docs/smoke-tests.md`.

## Out of scope

Persistent character "memories" that update themselves, character-to-character
autonomy between runs, voice/audio, per-character knowledge attribution, and
game-engine narration remain post-v1.
