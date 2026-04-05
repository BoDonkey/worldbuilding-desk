# Character Import Review Flow Spec

Date: 2026-04-04
Related:

- `docs/character-import-recommendation.md`
- `docs/dogfooding-remediation-plan-2026-04-04.md`

## Purpose

Define the first implementation slice for long-form character import.

This flow should:

- let users import a long-form character doc from `.docx`, `.rtf`, or pasted text
- preserve trust by showing what was extracted
- keep AI optional
- make review mandatory before saving

This is an onboarding bridge, not a full knowledge-extraction system.

## Product Principles

### 1. Deterministic by default

The app should parse what it can without AI first.

### 2. AI is explicit and optional

Users can ask for help with mapping and summarization, but the app should not silently use AI during import.

### 3. Review before save

Nothing should be auto-created from a long-form character doc without a review step.

### 4. Preserve source structure

Even when the current character schema is small, the import flow should preserve sections visibly until the user decides what to keep.

## Scope

### In scope for v1

- import a single long-form character document
- deterministic extraction of labeled fields and sections
- review UI before save
- optional AI suggestions button
- save into current Character model

### Out of scope for v1

- direct Google Docs integration
- automatic bulk import of many character docs at once
- deep schema redesign
- automatic splitting across Characters + World Bible + Compendium in one pass
- silent AI extraction

## Input Sources

Support in this slice:

- `.docx`
- `.rtf`
- pasted plain text

Optional later:

- `.txt`
- `.md`
- `.html`

## Proposed Flow

## Step 1: Start Import

Entry point:

- add `Import Character Doc` action to [CharactersHubRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/CharactersHubRoute.tsx) or [CharactersRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/CharactersRoute.tsx)

User options:

- choose file
- or paste text directly

## Step 2: Deterministic Parse

Parse the input into:

- `name`
- `age`
- `role`
- `occupation`
- `summaryCandidate`
- `sections[]`
- `unmatchedText`
- `warnings[]`

### Labeled field extraction

Recognize common variants such as:

- `Name`
- `Age`
- `Role`
- `Occupation`
- `Background`
- `Description`
- `Notes`

For the sample input, deterministic extraction should identify at least:

- `Name: Leo Müller-Sarkisian`
- `Age: Mid-30s`
- `Occupation: Early career detective...`

Then:

- map `Occupation` into a proposed `role` field
- keep the full raw value available for review

### Section detection

Detect heading-style sections such as:

- `Basic Information`
- `Physical Description`
- `Personality`
- `Background`
- `Skills`
- `Special Traits`
- `Social Dynamics`
- `Goals and Motivations`
- `Academic Background`

Each section should preserve:

- title
- raw text
- parsed bullet list or paragraph body if possible

### Warning detection

Flag likely out-of-band content, for example:

- reference/research appendix
- brainstorming residue
- assistant-generated filler

For the sample:

- the final “Leos from history/literature” section should likely be flagged as:
  - `Possibly reference material rather than core character canon`

## Step 3: Review UI

Add an import review panel/modal.

### Required editable fields

- Name
- Age
- Role
- Short description
- Notes

### Section review area

Show each detected section as a review card:

- section title
- extracted text
- action selector

Recommended action choices:

- `Include in notes`
- `Use for description`
- `Ignore`
- `Flag for later`

For v1, these actions can be lightweight UI choices that collapse into final `description` + `notes`.

### Unmatched text area

Show any unmatched remainder separately:

- editable
- default action: include in notes

### Warning area

Show warnings above save:

- “Some content looks like reference material or brainstorming rather than core character facts.”

## Step 4: Optional AI Assist

Add a button:

- `Use AI to suggest mappings`

This should only run when the user clicks it.

### AI tasks

AI may suggest:

- a tighter short description
- a cleaner role summary
- likely grouping of sections into:
  - description
  - notes
  - ignore
- warnings for likely non-canon sections

### AI constraints

The prompt should explicitly instruct:

- do not invent facts
- do not discard source material silently
- mark uncertain mappings clearly
- keep source phrasing close enough to be reviewable

### UI treatment

AI output should appear as suggestions, not replacements:

- “Suggested description”
- “Suggested role”
- “Suggested ignore/keep decisions”

User can:

- accept
- edit
- discard

## Step 5: Save

On save, create one `Character` record in the current schema:

- `name`
- `description`
- `fields.age`
- `fields.role`
- `fields.notes`

### v1 mapping recommendation

- `description`: short curated summary from the first/top sections
- `fields.notes`: merged remaining reviewed section content

This is not ideal long-term, but it is acceptable for v1 if the review flow is strong.

## Data Model

## Option A: Ephemeral review state only

Recommended for the first slice.

Implementation:

- keep import parse/review state entirely in route component state
- no schema migration required

Benefits:

- fastest to ship
- no DB migration risk

Tradeoff:

- user loses draft if the import review modal is closed or page reloads

## Option B: Draft store

Possible follow-up if the review flow proves valuable.

Would store:

- source text
- parsed sections
- AI suggestions
- review decisions

Not necessary for first validation.

## Reuse Opportunities

### Existing utilities

- `.docx` parsing and `.rtf` parsing utilities already exist or now exist
- AI service plumbing already exists via [LLMService.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/services/llm/LLMService.ts)
- review-draft precedent exists in [WorldBibleRoute.tsx](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/routes/WorldBibleRoute.tsx)

### Suggested new utility

Create a parser module, for example:

- `apps/web/src/services/characterImportService.ts`

Responsibilities:

- read source text
- detect labeled fields
- detect sections
- generate warnings
- optionally build AI prompt payload

## Parser Heuristics

### Deterministic heuristics for v1

- detect heading lines ending in `:`
- detect bullet-style `Label: Value` lines
- group indented bullet lists under nearest section heading
- prefer the earliest clean `Name:` field as canonical
- prefer `Occupation` as fallback for `role`
- build description candidate from:
  - Background
  - Personality
  - opening summary paragraphs

### Explicit fallback behavior

If parsing confidence is low:

- keep almost everything in section cards
- avoid pretending a high-confidence structured import happened

## UI Placement Recommendation

Put the action in the Characters surface, not Settings.

Recommended location:

- near `New Character`
- button label: `Import Character Doc`

Why:

- the user’s mental model is character creation, not import settings

## Dogfooding Questions

After implementation, validate:

1. Does deterministic import alone feel competent enough for cautious users?
2. Does AI help without feeling magical or unsafe?
3. Do users understand what was extracted vs inferred?
4. Does the review flow preserve enough of the source material to build trust?
5. Does `description + notes` feel sufficient, or does the schema need section-level fields next?

## Acceptance Criteria

This slice is done when:

1. A user can import or paste a long-form character document from the Characters surface.
2. The app shows extracted fields and preserved sections before save.
3. The user can save without using AI.
4. The user can optionally request AI mapping/summarization suggestions.
5. AI suggestions are reviewable, editable, and discardable.
6. The final saved character is materially better than the current “everything falls into description” behavior.

## Recommended Build Order

1. Add deterministic parser service.
2. Add import entry point in Characters UI.
3. Add import review modal/panel.
4. Save reviewed import into current Character schema.
5. Add optional AI suggestion button.
6. Dogfood with real character docs before any schema expansion.
