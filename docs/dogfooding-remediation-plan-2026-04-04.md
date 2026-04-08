# Dogfooding Remediation Plan

Date: 2026-04-04
Source notes: `/Volumes/T7/Worldbuilder Docs/Dogfooding.docx`

## Recommendation

Yes: plan and fix a small set of onboarding/model issues before doing much more dogfooding.

The current friction is concentrated in first-use paths:

- new project setup
- settings comprehension
- import expectations
- surface-model clarity

If those remain fuzzy, later testing will be noisy and hard to interpret because the author is fighting the product model before reaching core writing flow.

## Triage

### P0: Fix Before More Testing

#### 1. Characters route blank-screen crash

Status:

- fixed locally in `apps/web/src/routes/CharactersHubRoute.tsx`

Why it is P0:

- breaks a major route
- makes the app feel unstable immediately

#### 2. General Fiction project model is not clear enough

Status:

- first pass completed locally via project-creation, settings, characters, and World Bible copy/gating updates

Observed symptoms:

- ruleset language appears too early or too broadly
- compendium language/actions leak into General Fiction understanding
- user cannot tell what a `General Fiction` project is supposed to include or ignore

Why it is P0:

- this is foundational product-model confusion
- it affects how every other route is interpreted

Likely root causes:

- project creation is too thin and does not establish intent
- project mode lives in Settings instead of the creation flow
- copy still assumes the LitRPG/system-heavy mental model in multiple places

Planned change direction:

- move `projectMode` selection into project creation
- use that choice to set expectations immediately
- rewrite onboarding copy so `General Fiction` does not mention rulesets or compendium unless the user explicitly enables them later
- implementation spec: `docs/first-use-model-clarification-spec.md`

#### 3. World Bible vs Characters boundary is not understandable

Status:

- first clarification pass completed locally in UI copy
- still needs validation through continued dogfooding

Observed question:

- “What is the difference between the world bible characters and the characters tab?”

Why it is P0:

- this is an information-architecture failure, not a wording nit
- it blocks trust in the data model

Current likely boundary:

- World Bible character entries are canon/lore records
- Characters route is roster plus gameplay-ready/system-linked profiles and sheets

Problem:

- the product does not state that boundary clearly enough
- General Fiction makes the distinction feel even less justified

Planned change direction:

- define and document the distinction in UI copy
- likely rename or reframe one of the surfaces if needed
- in `General Fiction`, either simplify the Characters route or explicitly present it as the cast/roster workspace
- implementation spec: `docs/first-use-model-clarification-spec.md`

#### 4. Import story is not trustworthy enough for first use

Status:

- first pass completed locally
- `.rtf` support and fallback behavior improved through real-file dogfooding
- review-first long-form character import is now in place
- remaining issue is no longer raw import viability, but how much structure the saved character model should own

Observed symptoms:

- `.pages` import failed
- `rtf` import failed
- long-form character-sheet import dumped nearly everything into description

Why it is P0:

- authors commonly begin by importing existing material
- failed import plus weak fallback makes the app feel non-viable early

Important nuance:

- Google Docs integration is not the immediate answer
- first the app needs a clear supported-format story and better fallback behavior

Planned change direction:

- clarify supported import formats and fallback expectations in the UI
- inspect current `rtf` handling, because the note suggests the app is failing below user expectations
- improve character import mapping expectations so authors know whether import is structured extraction or plain ingestion

### P1: Fix Soon After P0

#### 5. Settings overload, especially AI prompt tools

Observed symptoms:

- AI settings feel overwhelming
- prompt tools are too exposed too early

Why it is P1:

- this creates first-use intimidation
- but it is less blocking than route breakage and product-model confusion

Planned change direction:

- collapse advanced/custom AI tooling by default
- present a simpler “guided/default vs custom” split
- keep prompt-tool management visible only when intentionally expanded

#### 6. Character dialogue styles are unclear and may be misplaced

Observed questions:

- what are character dialogue styles for?
- do they belong in Settings or Character Sheets?
- would “System” need to be added as a character?

Why it is P1:

- this suggests both terminology and placement are weak
- but it is not as blocking as project-model ambiguity

Planned change direction:

- decide whether these are:
  - editor presentation styles
  - narrative voice helpers
  - character-specific authoring aids
- if they are character-specific, move or mirror them closer to character authoring
- if they are global editor tools, rename them to reduce confusion

#### 7. AI worldbuilding conversation route is missing or hidden

Status:

- partial progress completed locally for characters only via `Character Coach`
- broader worldbuilding/document-review route still unresolved

Observed questions:

- where can I talk with AI about world creation?
- where can AI review an uploaded document and give feedback?

Why it is P1:

- this is a strong expectation mismatch
- but it should be solved intentionally, not by bolting on a generic chatbot everywhere

Planned change direction:

- define whether the product should offer:
  - a dedicated worldbuilding conversation flow
  - a document-review action tied to imported content
  - or just narrower guided prompts inside corkboard/workspace

Decision needed:

- if the answer is “not yet,” the UI needs to make that limitation explicit instead of feeling like a missing route

#### 8. Compendium affordances need stricter mode gating

Observed symptom:

- after entry, the app allows adding to Compendium even in General Fiction where the user does not expect it

Why it is P1:

- this reinforces the wrong product model

Planned change direction:

- hide or rephrase compendium seeding/actions when `projectMode === 'general'`
- avoid suggesting system-heavy progression structures where they are not relevant

### P2: Important Polish, But Not Immediate Blockers

#### 9. Checkbox contrast issue in light mode

Observed symptom:

- black on blue checkboxes are hard to see

#### 10. Notification dismissal/behavior clarity

Observed symptom:

- notification should be dismissable

Note:

- some workspace toasts already appear dismissible in code
- verify which route/surface still has non-dismissible feedback and standardize

#### 11. Canon summary labels are unclear

Observed symptom:

- `scene snapshot`, `canon fact`, and `open loop` were not self-explanatory

Why it matters:

- the summaries may be useful, but the mental model is not obvious yet

## Proposed Immediate Work Order

### Slice A: First-Use Model Clarification

Status: completed first pass on 2026-04-04

Do next:

1. Move `Project Mode` into project creation.
2. Add lightweight setup guidance per mode.
3. Remove or rewrite ruleset/compendium-forward copy for `General Fiction`.
4. Clarify the distinction between `World Bible` and `Characters`.

Why first:

- this addresses the biggest conceptual blockers before more feature work

### Slice B: Import Trust Pass

Status: completed first pass on 2026-04-04

Do after Slice A, or in parallel if scoped tightly:

1. Audit `.pages` failure handling.
2. Audit `rtf` support expectations vs actual codepath.
3. Improve import fallback messaging.
4. Clarify structured-vs-unstructured character import behavior.

Why:

- import is one of the first things authors try with existing work

### Slice C: Settings Simplification

Do after the model is clearer:

1. Collapse advanced AI prompt-tool management by default.
2. Reframe dialogue styles or move them.
3. Simplify first-use settings language.

## Product Decisions Needed

These need explicit answers before implementation drifts:

## April 4 Follow-up

What dogfooding changed:

- first-use friction was significant enough to justify switching away from immediate corkboard-first work
- long-form character import is now materially better and no longer just a raw-ingest fallback
- the next real question is character-authoring depth, not whether import should exist

Recommended next slice:

1. Dogfood the new character editing + `Character Coach` flow in real use.
2. Decide whether AI suggestions should stay discussion-only or gain lightweight apply actions.
3. Decide whether the new field-level discussion modal also needs reply actions that can create one or more new character sections, not just replace/append the current field.
4. Decide whether imported sections remain structured details or become first-class character fields.
5. Resume deeper corkboard testing once the character flow is no longer distorting first-use impressions.

1. In a `General Fiction` project, what routes and concepts should be primary, secondary, or hidden?
2. Is `Characters` a cast-management surface, a gameplay-sheet surface, or both?
3. Is the Compendium ever user-facing in `General Fiction`, or only an internal optional bridge?
4. Should there be a dedicated AI worldbuilding conversation surface, or only guided actions in existing routes?
5. What formats are truly supported for import on day one, and how bluntly should the UI say so?

## Recommendation On Testing Pace

Do not stop dogfooding entirely, but do change the goal.

For the next round, focus on:

- startup friction
- setup comprehension
- import trust

Do not treat deeper writing-flow feedback as decisive until the P0 model issues are addressed. Otherwise the results will be polluted by early confusion.
