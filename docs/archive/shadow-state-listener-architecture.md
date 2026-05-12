# Shadow State Listener Architecture

_Created: 2026-04-18_

## Position

The import/review detector should not rely on an ever-growing dictionary of common words as its main defense against false positives. A dictionary is useful as a cheap suppression layer, but it is too fragile as the primary classifier: sentence-start words such as "Three" and ordinary verbs or participles such as "Reflecting" will keep slipping through because capitalization alone is not evidence of a world entity.

The product should prefer fewer prompts over noisy prompts. Missing a weak candidate during import is usually less harmful than making authors clear a long review queue full of ordinary prose.

## Design Principle

Use a Shadow State pattern:

- Draft text and imported scenes produce staged observations.
- Staged observations are reviewed, merged, or ignored by the author.
- The lore database and character state are mutated only by deterministic command handlers after validation.
- LLMs may extract candidate deltas, but they do not write final lore records or final numeric state.

This keeps the writing surface unobtrusive while still allowing the system to notice meaningful changes during drafting.

## Pipeline

### 1. Listener

A small local extraction pass watches bounded recent context, such as the last 300-500 words around the current edit or the imported scene chunk under review.

The listener should output structured deltas, not rewritten lore:

```json
{
  "entity": "John",
  "action": "equip",
  "item": "Rusty Iron Spada",
  "confidence": 0.92,
  "span": {
    "start": 18,
    "end": 40
  }
}
```

Listener outputs are proposals. They are not canon.

### 2. Extraction Strategy

Use a hybrid stack instead of a single dictionary:

- Known-entity matcher: exact and alias lookup against existing characters, locations, items, abilities, factions, and custom lore records.
- Lightweight NLP/NER pass: identifies plausible people, places, organizations, artifacts, and game nouns in context.
- Local LLM delta extractor: runs on unresolved or high-value spans to classify actions and state changes.
- Suppression heuristics: cheap filters for sentence starts, common prose words, headings, numerals, weekdays, months, and generic nouns.

The important ordering is that heuristics should suppress after context-aware extraction, not serve as the primary source of truth.

### 3. Auditor

The auditor compares proposals against canonical state and emits review items:

- Unknown entity: "Rusty Iron Spada" is not in the item index.
- Ambiguous reference: "John" matches multiple characters.
- Logical contradiction: John equipped Rusty Iron Spada while already holding Holy Avenger.
- Invalid mutation: proposed stat, resource, or inventory update violates rules.

The auditor should be deterministic TypeScript where possible. LLM calls can explain or classify ambiguous prose, but the database comparison and mutation rules must be deterministic.

### 4. Review Queue

Authors should not be interrupted inline unless the issue blocks a deliberate commit/publish action.

Use a passive review loop:

- Sidebar pulse when new meaningful proposals arrive.
- Review cards for accepted-confidence deltas.
- Bulk ignore/dismiss actions for import sessions.
- Per-project "always ignore" memory for repeated false positives.
- Explicit approval before any lore or state mutation is applied.

Examples:

- "I noticed John equipped Rusty Iron Spada. Add it to his equipped items?"
- "I noticed John leveled up to 14. Update HP from 240 to 260?"
- "You mentioned John grew stronger. Is this a narrative beat or a +STR change?"

Ambiguous prose should ask a question rather than guess. "He felt his marrow burn with newfound strength" may indicate a narrative beat, a status effect, a level-up, or a stat increase. The system should stage a low-confidence candidate instead of mutating strength automatically.

## Import Behavior

Import should default toward low interruption:

- Persist successfully parsed scene text first.
- Run extraction after persistence.
- Queue high-confidence known-entity links and likely deltas.
- Suppress low-confidence unknown single-word candidates unless they repeat, appear with a strong cue, or match a project-specific pattern.
- Prefer false negatives over false positives for unknown-entity review.

The import path can still offer strict mode, but balanced/default import should feel like "your text is in the app; review is optional."

## Writing-Time State Progression

Writing-time progression should use the same Shadow State path as import:

1. Recent text enters the listener.
2. Listener emits candidate deltas.
3. Auditor checks canonical state and rules.
4. UI adds non-blocking review cards.
5. Accepted cards become typed mutation commands.
6. Mutation commands update state and write an audit event.

Supported early delta types:

- `equip_item`
- `unequip_item`
- `consume_item`
- `move_entity`
- `apply_status`
- `remove_status`
- `increment_stat`
- `decrement_stat`
- `level_up`
- `resource_change`

The listener should include confidence and evidence text. The auditor should include before/after previews only after it can resolve the relevant entity and rule.

## Schema Boundary

Use schema enforcement before persistence:

- Define proposal schemas with Zod.
- Validate LLM JSON before it reaches storage.
- Reject unsupported stat/resource names unless the project ruleset defines them.
- Convert valid proposals into typed commands.
- Let command handlers calculate final numeric state.

Example boundary:

```ts
// LLM may propose:
{ type: 'increment_stat', actor: 'John', stat: 'STR', amount: 1 }

// Deterministic code must decide:
// - Which John?
// - Does STR exist in this project?
// - Is this mutation allowed now?
// - What is the resulting value?
// - Which audit event records the change?
```

## Local-First Runtime Notes

The app is already Electron/React with local provider support, so the listener should run locally when possible.

See also: [Dual LLM Review Architecture](./dual-llm-review-architecture.md), which captures the split between a managed local World Engine for background review and bring-your-own-key creative providers for author-invoked prose work.

Practical target:

- Use the existing provider abstraction for local model calls.
- Prefer Ollama or llama.cpp sidecar integration for background extraction.
- Keep listener context small and debounced.
- Use JSON-schema or Zod validation for every model response.
- Treat model names as configurable. Do not hard-code a single recommended model into the architecture; local model quality and availability will keep changing.

WebLLM may become viable for some machines, but it should not be the baseline for a background listener until memory and startup behavior are acceptable for ordinary desktop use.

## Near-Term Implementation Guidance

1. Stop expanding the common-word dictionary as the main solution.
2. Add tests around current false positives:
   - "Three candles burned on the altar."
   - "Reflecting on the battle, John closed the door."
   - "He felt his marrow burn with newfound strength."
3. Change unknown-entity extraction to require stronger evidence for single-word unknowns:
   - repeated mention,
   - known cue phrase,
   - existing alias/category hint,
   - NER/entity classifier confidence,
   - or LLM proposal confidence above threshold.
4. Add proposal confidence and evidence fields to review queue items.
5. Split proposal extraction from state mutation in code and UI language.
6. Add a `STATE_DELTA_CANDIDATE` review item type before adding automatic stat progression.

## Success Criteria

- Importing prose with ordinary capitalized sentence starts does not flood the review queue.
- Known entities and aliases still highlight reliably.
- Unknown single-word candidates are rare in balanced/default mode.
- Ambiguous stat progression becomes a review card, not an automatic update.
- Every accepted state change has a typed mutation command and audit event.
- The lore database never receives direct writes from an LLM response.
