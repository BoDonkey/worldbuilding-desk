> **Archived 2026-10-03.** Slices 3.10 (R1) and 3.11 (R2) have landed. Durable
> contracts now live in `docs/domain-model.md` § 3 and the Rules engine section
> of `docs/architecture-review.md`; R3–R5 remain in the roadmap backlog and
> this plan is their design reference.

# Rules Engine Consolidation — Exploration Plan

**Status:** Accepted 2026-09-26. R1 and R2 are scheduled as roadmap Slices
3.10 and 3.11; R3–R5 are in the roadmap backlog until after 1.1 trust
dogfooding. Archive this plan once all scheduled slices land and their durable
contracts are folded into `docs/domain-model.md` and
`docs/architecture-review.md`.
**Origin:** Finding F3 in `docs/archive/architecture-review-2026-09-26.md`
(author chose option 2: move the live model into the package and use the
engine more).
**Contracts that constrain this plan:** `docs/domain-model.md` § 3
(Manuscript-Time State Model) and § Prose-proximate item and state handoff;
the trust boundary in `docs/architecture-review.md`.

## Where things stand

There are three overlapping mechanics models today:

| Model | Location | Time axis | Persisted? | Used? |
| --- | --- | --- | --- | --- |
| Manuscript-time ledger + replay (`StateMutationCommand`, `CharacterReplayState`, `applyStateMutationCommand`, `replayCharacterState`, `validate*`) | `apps/web/src/services/state/` | scene order | yes (accepted events) | **yes — the live model** |
| Engine simulation (`RulesEngine`, `ConditionEvaluator`, `EffectApplicator`, `FormulaParser`, `StateManager`, engine `CharacterState`) | `packages/rules-engine/src/{engine,state}` | wall-clock seconds / timestamps | no (in-memory) | no callers |
| Compendium runtime effects (settlement effects, party synergies, crafting checks, zone exposure, `deriveCharacterRuntimeModifiers`, `getEffectiveStatValue`) | `apps/web/src/services/compendium/compendiumService.ts` | action log | yes | yes, Compendium only |

Other facts that shape the design:

- Authored `WorldRuleset.rules` (`GameRule[]`) are never executed. They are
  counted in the UI and serialized as prompt text. The schema field is still
  `z.array(z.any())`. There is **no authoring UI** for rules: `useRuleset`'s
  `addRule`/`updateRule` have no callers.
- `consumableEffects.buildConsumableCommands` hand-builds what
  `EffectApplicator` was designed to do.
- Replay clamps resources to `[0, max]` but never checks stat `min`/`max`
  from `StatDefinition`.
- `FormulaParser` uses `mathjs` `create(all)` unrestricted. Its comment says
  "restricted", but `import`, `createUnit`, `evaluate`, `parse` and friends
  remain callable from expressions. It must be locked down before evaluating
  any author- or model-supplied formula.
- The engine models wall-clock time (regeneration per interval, status
  `expiresAt`, exposure seconds, durations). The product has no in-story clock;
  ordering is `sceneOrder → sceneSequence → sourceRevision → createdAt`.

## Design principles

1. **The ledger stays the source of truth.** Accepted `StateMutationEvent`s
   remain immutable and are the only persisted state changes. Replay parity
   (byte-identical output per scene) is the acceptance test for every
   refactor step.
2. **Rules compute; authors commit.** Rule output takes one of two forms:
   - **Derived views** — values recomputed at replay and never stored (e.g.
     effective stats after equipment modifiers, a formula-derived max). They
     are rebuildable, like RAG indexes.
   - **Proposed commands** — follow-up `StateMutationCommand`s (e.g. "drinking
     this potion restores 20 HP") shown in the existing confirmation surface
     for the author to edit, accept, or drop. Never written automatically.
3. **Manuscript time, not wall-clock time.** Engine concepts that need
   duration become scene-relative or are deferred until there is an in-story
   time axis.
4. **Framework-independent core.** The package holds pure types, schemas,
   command application, replay, validation, conditions, effects and formulas.
   IndexedDB, React, and project lookups stay in `apps/web`.
5. **One effect vocabulary.** Consumables, equipment, Compendium settlement
   effects and authored rules converge on one `Effect` shape rather than
   three.

## Proposed slices

Sizes follow the status-board scale. R1 and R2 are prerequisites for
everything else; R3–R5 are independently valuable and can be reordered.

### R1 — Move the live state core into `rules-engine` (M, behavior-preserving)

- Move the command types and Zod schemas, `CharacterReplayState`,
  `applyStateMutationCommand`, `compareStateMutationEvents`,
  `validateStateMutationCommandAgainstState`, and the pure parts of
  `replayCharacterState` / `validateStateMutationEventForRuleset` into
  `packages/rules-engine/src/manuscript/` (name TBD).
- Web modules re-export or import from the package; persistence
  (`getStateMutationEventsByProject`) and actor resolution stay in web,
  passed in as data.
- Move the existing replay/schema tests with the code; add a fixture-driven
  parity test (the continuity corpus) that replays every scene before and
  after the move.
- Make the web Vitest config resolve the package from `src` (alias) so tests
  do not depend on a built `dist/`.
- Verification: full battery; replay parity; no UI change.

### R2 — Engine hygiene and typed rules (S–M)

- Lock down `mathjs` in `FormulaParser` per the mathjs security guidance
  (disable `import`, `createUnit`, `evaluate`, `parse`, `simplify`,
  `derivative`, `resolve`, `reviver` inside expressions); add tests that the
  disabled functions throw.
- Replace `rules: z.array(z.any())` with `GameRuleSchema`, plus a storage
  migration that keeps valid rules and quarantines invalid ones visibly
  rather than dropping them.
- Move `StateManager` and the wall-clock parts of the engine
  `CharacterState` to a non-exported `experimental/` path (Decision 3).
- Bring engine test coverage up for `FormulaParser`, `EffectApplicator` and
  `RulesEngine` before anything consumes them.

### R3 — Derived values at replay (M)

- Replay returns `base` (ledger result, unchanged) and `effective` (after
  derived rules) values side by side.
- First derived rules: stat `min`/`max` range warnings (warn, do not clamp
  silently — clamping would change replay parity), equipment modifiers from
  linked item mechanics, and optional formula-derived resource max.
- Surfaces: character sheet and Workspace context drawer show effective
  values with a "why" breakdown; review uses `base` for continuity findings.

### R4 — Rule-proposed follow-up commands (M)

- On preparing an accepted event (consume, equip, status apply), evaluate
  rules whose trigger matches (`on_consume_item`, `on_equip_item`,
  `status_active`, …) against replayed state at that scene position and
  output **proposed** commands in the existing confirmation dialog.
- Re-implement `buildConsumableCommands` on `EffectApplicator` so consumables
  become the first rule-backed trigger with no behavior change.
- Author-edited results are what persists; the rule that suggested them is
  recorded as provenance on the event.

### R5 — Rules as continuity validators (S–M)

- Rule conditions (`requires_active`, `conflicts_with`, resource thresholds)
  evaluated against replay produce warning-level review findings, e.g. an
  ability used with insufficient mana, or two conflicting statuses active.
- Reuses the existing `INVALID_MUTATION` / `STATE_CONFLICT` finding types.

### Later (backlog candidates, not proposed yet)

- **Rule authoring UI.** Form-based rule builder (trigger → conditions →
  effects) in the Ruleset route; nothing is authorable today. Needed before
  R4/R5 are useful beyond consumables and presets.
- **Compendium convergence.** Map settlement effects, party synergies and
  crafting checks onto the shared `Effect`/`Condition` vocabulary.
- **In-story time.** Durations, regeneration and exposure need a scene-level
  time axis; depends on the temporal-canon work (4.28–4.29).
- **Model-proposed rules.** AI drafts rules only through schema → validation
  → editable review → explicit accept, per the trust boundary; aligns with
  the backlog item "advanced executable rule generation".

## Decisions (2026-09-26)

1. **Priority.** R1–R2 are Phase 3 architecture Slices 3.10–3.11 now; R3–R5
   stay in the backlog until after 1.1 trust dogfooding.
2. **Rule output.** Both forms from § Design principles are allowed: derived
   views for read-only effective values (recomputed at replay, never stored)
   and proposed commands for anything that changes state.
3. **`StateManager`.** Keep it, together with the wall-clock parts of the
   engine `CharacterState`, under a non-exported `experimental/` path as
   reference for durability, exposure, and crafting. Nothing in the app may
   import it until those concepts are rebuilt on manuscript time.
4. **Package name.** Keep `@worldbuilding-desk/rules-engine`.
