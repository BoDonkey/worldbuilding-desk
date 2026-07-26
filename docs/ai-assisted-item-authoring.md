# AI-Assisted Item Authoring

_Status: Product proposal_

_Drafted: 2026-07-26_

## Decision Summary

Worldbuilding Desk should support creating and updating items from an author's
natural-language description.

The author should not have to page through a large form to discover which
fields matter. They should be able to describe the item as they understand it,
then review a compact proposal produced from that description.

The AI is not an autonomous item designer and must not write directly to canon,
mechanics, or character state. Its role is narrower:

1. extract claims that are explicit in the description
2. match those claims to definitions already present in the project
3. identify missing or ambiguous mechanics
4. propose a reversible create/update diff
5. leave acceptance, correction, and rejection to the author

This is an item-authoring workflow, not a general prose-to-JSON feature and not
a replacement for the existing item, Compendium, ruleset, or state models.

Items are the first domain, not the intended limit of the interaction pattern.
The underlying proposal, evidence, validation, diff, and approval infrastructure
should be reusable by later ruleset-authoring adapters. Each adapter must map
into an existing domain model and apply domain-specific validation; the product
should not introduce one universal freeform ruleset schema.

## User Problem

The current pain point is not merely the number of item fields. It is that the
author has to navigate those fields before they know:

- which fields apply to this item
- which details are canon versus mechanics
- how project stats and resources should be referenced
- where inventory ownership or equipment state belongs
- which advanced settings can safely be ignored

That changes an authoring task into a form-navigation task.

The desired experience is:

> Describe the item first. Let the application find the relevant structure.
> Review only the proposed details, with deeper controls available when needed.

## Product and Architecture Alignment

This proposal follows the existing product principles:

- Writing and natural-language authoring come first.
- Structure is progressive rather than required up front.
- AI proposes; deterministic TypeScript validates; authors approve.
- A model response never becomes canon merely because it is well-formed.
- Advanced LitRPG mechanics remain available without dominating the default
  experience.

It also preserves the existing ownership model:

| Concern | Existing owner |
| --- | --- |
| The item as a canonical thing in the world | `WorldEntity` / World Bible |
| Longform history, provenance, or exploratory notes | linked `LoreDocument` |
| Optional progression or system behavior | linked `CompendiumEntry` and ruleset data |
| A character possessing or equipping an item | character state plus a state mutation event |

The author should not need to understand these storage boundaries. The
application should route each accepted part of the proposal to the correct
owner.

## Why the Model Can Be Useful Without Being Fully “Smart Enough”

The workflow must not depend on an LLM correctly designing an entire game
system. That would be an unreliable product boundary, especially across local
models, provider changes, and unusual author-defined systems.

The task can be made tractable by constraining it:

- Extraction is easier to verify than invention.
- Existing project definitions reduce the model's vocabulary and choices.
- Evidence lets the author see why a value was proposed.
- Unknown values are safe when the product permits partial items.
- Ambiguity can be surfaced instead of guessed away.
- Deterministic validation catches invalid references, types, and ranges.
- A small diff is easier to review than a completed multipage form.

For example, given:

> An iron ring that grants +8 Strength and drains 2 HP each second while
> equipped. It requires level 5.

the system can safely identify the explicit values. It should not invent a
rarity, price, damage type, slot, or crafting recipe. If the active ruleset has
no `Strength`, `HP`, or level definition, those details should be shown as
unresolved rather than silently mapped to arbitrary fields.

## Proposed Author Experience

### Create

1. The author chooses `New item`.
2. The primary surface is a generous description field, with an example that
   demonstrates useful specificity without implying required syntax.
3. The author can save the description alone or choose `Structure item`.
4. The application produces a compact proposal organized into:
   - identity and summary
   - explicit properties and requirements
   - effects or behavior
   - unresolved details and questions
5. The author accepts, edits, or removes individual proposals.
6. Advanced item and mechanics editors remain available through progressive
   disclosure.

Saving the source description must not depend on AI success.

### Update

1. The author opens an existing item and describes a change or supplies revised
   source prose.
2. The system shows a diff against the selected item.
3. Existing values, proposed replacements, additions, and removals are visually
   distinct.
4. No target match, merge, rename, or destructive replacement occurs
   automatically.
5. The accepted diff updates only the fields shown in the review.

### From the Writing Workspace

Selected manuscript text may offer `Create or update item`.

The resulting proposal should distinguish between:

- defining or updating the item itself
- recording that a character acquired, lost, equipped, unequipped, or consumed
  the item

These may occur together in prose but must remain separate accepted operations.

## Proposal Contract

The exact TypeScript schema should be designed when implementation begins, but
the common conceptual proposal envelope must carry:

- the untouched source text
- proposal domain, such as item, resource, status, recipe, or game rule
- proposal contract version
- intended operation: create, update, or unresolved
- proposed target and any possible existing matches
- proposed values
- the project definition each mechanical value resolves to, when applicable
- evidence spans for extracted claims
- origin classification:
  - `explicit`: stated in the source
  - `derived`: normalized without adding meaning, such as `Level 5` to `5`
  - `suggested`: an optional model inference not stated by the author
- confidence
- deterministic validation results
- unresolved terms and missing information
- the destination of each accepted change

Suggested values must be off by default or visually separated from extracted
values. They must never be mixed into the proposal as though the author stated
them.

Durable records should use immutable IDs. A human-readable slug may be derived
for display or export, but renaming an item must not change its identity.

Domain adapters should extend this common envelope with the typed proposal
content and validation results required by that part of the ruleset. They
should not weaken the evidence, uncertainty, diff, or approval requirements.

## Broader Ruleset Authoring Direction

The same description-first interaction can reduce form-navigation burden in
other parts of the ruleset, but reliability and ambiguity differ by domain.

| Domain | Recommended order | Primary concerns |
| --- | --- | --- |
| Items and consumables | First pilot | Separating item definition from character possession and state |
| Stats and resources | Early follow-up | Missing defaults, ranges, units, regeneration rate, and regeneration conditions |
| Status templates | Early follow-up | Duration, stacking, refresh, removal, immunity, and scope |
| Recipes and requirements | After item mapping | Resolving ingredients, quantities, substitutions, and unlock conditions |
| Compendium milestones and rewards | Later | Progress scope, reward references, thresholds, and balance assumptions |
| Typed game rules and formulas | Last | Trigger timing, precedence, coefficients, caps, interactions, and edge cases |

Items remain the correct pilot because item descriptions commonly contain
enough explicit information to create a useful partial record. A successful
item slice should prove the shared proposal workflow before other domains are
added.

### Stats and resources

The system may propose existing `StatDefinition` and `ResourceDefinition`
fields from explicit prose. It must surface missing details rather than assume
genre conventions.

For example:

> Characters have Resolve from 0 to 100. It begins at 50 and recovers by 5
> after a full night's sleep.

This contains a name, range, default, recovery amount, and recovery condition.
By contrast, “Resolve recovers while resting” is incomplete: the rate, interval,
and definition of resting remain unresolved.

### Statuses, recipes, and milestones

These domains should use the same proposal review but require their own
project-aware resolvers:

- statuses resolve affected stats/resources and expose missing duration or
  stacking behavior
- recipes resolve ingredient items, quantities, substitutions, and unlock
  requirements
- milestones resolve progress scope, thresholds, and typed reward targets

The AI may organize what the author stated. It should not silently balance
values or create missing dependencies.

### Typed rules and formulas

Complete executable rules are the highest-risk domain. Natural-language rule
descriptions frequently omit information that a runtime engine requires.

The first responsibility of a rule adapter should be to identify missing
decisions, such as:

- exact trigger timing
- effect target and scope
- stacking or precedence
- coefficients, units, intervals, and caps
- conflict behavior
- expiration and removal conditions

The review experience may ask focused follow-up questions before proposing an
executable rule. Once enough information exists, deterministic code should
validate the trigger, conditions, effects, formula references, and
dependencies. A later implementation may simulate representative examples so
the author can inspect behavior before acceptance.

A human-readable or prose-only rule remains a valid result when executable
detail is incomplete.

## Mechanics Interpretation

Freeform key/value objects and arrays of effect strings are not sufficient as
the authoritative mechanics model.

Mechanical proposals should resolve against the active project:

- stat and resource definitions
- item templates
- equipment slots
- trigger types
- conditions
- typed effects and operations
- existing rules

An unmatched term may be:

- mapped by the author to an existing definition
- kept as descriptive prose
- used to propose a new project definition through a separate explicit action
- left unresolved

Rules and formulas require a higher standard than descriptive item fields. For
example, “regeneration scales with Intelligence” is incomplete unless the rate,
coefficient, timing, and relevant limits are known. The proposal should call
that out rather than manufacture an executable formula.

## Reliability and Failure Behavior

The feature must expect these normal failure modes:

### The model misses a detail

The source description remains visible and editable. The author can add the
detail manually or rerun extraction after revising the prose.

### The model invents a detail

Evidence and origin classification make unsupported values apparent.
Deterministic code rejects invalid references, but factual/canon approval still
belongs to the author.

### The model chooses the wrong project field

The proposal shows the resolved definition by author-facing name. The author
can remap it or leave it as prose.

### The description is ambiguous

The proposal presents a question or unresolved detail. It does not guess in
order to make the card look complete.

### The provider is unavailable, times out, or cannot follow the output contract

The item description can still be saved and edited. The application retains a
manual path and offers a retry. A malformed response is not silently repaired
and committed.

### A smaller local model performs worse than a hosted model

The basic extraction contract should remain deliberately small. Advanced
mechanics interpretation can be unavailable or require additional review
without disabling basic item authoring.

## Validation Boundary

Model output is untrusted input.

Before a proposal reaches the review surface:

1. validate the response with a strict versioned schema
2. discard fields outside the contract
3. verify evidence spans against the source
4. resolve references against the active ruleset and project records
5. validate numbers, types, ranges, and enumerations
6. identify duplicate or ambiguous item matches
7. calculate the actual create/update diff deterministically

Schema-valid does not mean canon-correct. The author approval gate remains
required for persistence.

## Evaluation Before Product Commitment

The question “is the LLM smart enough?” should be answered with a fixture suite,
not model enthusiasm.

Build a representative set of author-written item descriptions covering:

- sparse mundane items
- equipment with explicit bonuses
- cursed items with tradeoffs
- consumables
- items using custom project stats or resources
- prose with incomplete mechanics
- renamed and revised existing items
- acquisition/equipment events embedded in scene prose
- contradictory or ambiguous descriptions
- descriptions containing information that must remain longform prose

Evaluate each supported provider/model on:

- recall of explicit details
- unsupported-value rate
- correct project-definition resolution
- correct separation of item definition and character state
- quality of ambiguity detection
- schema conformance
- author correction effort

The most important failure metric is unsupported confident invention. A useful
model may miss optional fields; it must not quietly create false canon.

Real dogfood should measure whether this is faster and calmer than the current
form, not merely whether the generated object looks impressive.

## Recommended Delivery Slices

### Slice 1: Description-first manual item creation

- Put the description-first path ahead of the full form.
- Allow immediate save with no AI.
- Keep the existing detailed editor available.

This improves the pain point even before model integration.

### Slice 2: Basic identity and explicit-value extraction

- Name, category candidate, short description, explicit numbers, and explicit
  requirements.
- Evidence-backed review.
- No automatic mechanics creation.

### Slice 3: Project-aware mechanics mapping

- Resolve stats, resources, slots, and known item templates.
- Surface unmatched terms.
- Allow per-field acceptance and correction.

### Slice 4: Existing-item update diff

- Explicit target selection.
- Field-level additions, replacements, and removals.
- No automatic merging.

### Slice 5: Workspace-to-item and state-event handoff

- Create/update an item from selected scene text.
- Separately propose acquisition, equipment, consumption, or loss events.

### Slice 6: Advanced conditional mechanics

- Typed triggers, conditions, effects, and formulas.
- Only after evaluation shows acceptable reliability.
- Preserve prose-only rules when executable detail is incomplete.

## Later Domain Rollout

After the item pilot demonstrates lower author effort and acceptable proposal
quality:

1. extract the shared proposal envelope, evidence handling, diff calculation,
   and approval lifecycle from the item implementation
2. add one domain adapter at a time
3. create a domain-specific fixture suite before exposing each adapter
4. retain manual authoring and partial-save behavior in every domain
5. require additional clarification or simulation for executable mechanics

Do not expose a project-wide “generate my ruleset” action until the individual
domain adapters are trustworthy. A future system-description intake may
produce a batch of independent proposals, but each proposal must still be
validated and accepted through its owning domain.

## Acceptance Criteria

- An author can create a useful partial item without opening the detailed form.
- Item descriptions save even when AI is disabled or fails.
- The model never writes directly to canon, Compendium data, rulesets, or
  character state.
- Explicit, derived, and suggested information are distinguishable.
- Unsupported values are not silently added.
- Mechanical references are validated against the active project.
- Item definition changes and character inventory events remain separate.
- Updating an item produces a deterministic, reviewable diff.
- The full editor remains available for precise manual control.
- The workflow is usable with keyboard navigation and on narrow layouts.
- Dogfood demonstrates less navigation and correction effort than the current
  form.
- The item implementation does not hard-code proposal infrastructure that
  prevents later domain adapters.
- Each later ruleset domain has its own schema, resolver, fixture suite, and
  acceptance gate.

## Non-Goals

- Automatically designing balanced items.
- Automatically designing or generating an entire ruleset.
- Filling every possible field.
- Inferring genre-standard rarity or mechanics as canon.
- Replacing the rules engine with an AI-generated schema.
- Treating JSON as an author-facing format.
- Requiring a hosted model for basic item creation.
- Automatically creating new stats, resources, rules, or equipment slots.
- Combining item canon, mechanics, and character possession into one record.

## Related Documents

- `docs/product-blueprint.md`
- `docs/navigation-ia-decision.md`
- `docs/freeform-lore-ingestion-architecture.md`
- `docs/customizable-state-model-spec.md`
- `docs/style-bible.md`
