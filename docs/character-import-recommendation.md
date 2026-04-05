# Character Import Recommendation

Date: 2026-04-04
Example source: `/Volumes/T7/Echoes working chapters/Character Sheet_ Leo Müller-Sarkisian.docx`

## Short Answer

This is not just a "you" thing.

Many writers do keep character material in long-form docs before they trust a dedicated app enough to author directly inside it. The sample file is a realistic import shape:

- partly structured character sheet
- partly prose biography
- partly timeline/reference material
- partly brainstorming residue

So yes, users will often want to bring in character docs from Word, Google Docs exports, Pages exports, or copied text.

## What The Sample Shows

This file contains at least three kinds of information:

### 1. Clean extractable facts

These are good candidates for deterministic parsing:

- `Name: Leo Müller-Sarkisian`
- `Age: Mid-30s`
- `Occupation: Early career detective...`
- `Height: 5'9"`
- `Build: average to slightly lean`
- `Hair: Dark, wavy, usually messy`

### 2. Rich narrative character material

This should usually stay as narrative text unless the user explicitly wants structured extraction:

- personality paragraphs
- family history
- social dynamics
- motivations
- special-trait explanations

### 3. Ambiguous or secondary material

This is where AI can help, but should not silently decide:

- educational timeline
- institutional history
- inferred trait summaries
- imported reference material that may not belong in the main profile
- the final “Leos in literature/history” section, which looks like brainstorming or assistant residue rather than character canon

## Why The Current Model Fails

The current character model is too small for long-form import:

- `name`
- `description`
- `fields.age`
- `fields.role`
- `fields.notes`

That means almost any serious source doc will collapse into:

- one or two extracted basics
- everything else dumped into `description`

That behavior is understandable from the current schema, but it does not match user expectations for “import character sheet.”

## Recommendation

Do not treat character import as a plain text-ingestion feature.

Treat it as a **reviewed extraction workflow** with three layers:

1. deterministic parsing first
2. optional AI assistance second
3. explicit human review before saving

## What Should Be Deterministic

Without AI, the app should reliably extract:

- name
- age
- role or occupation
- a short summary/description
- section headings and labeled key/value pairs

For the sample doc, deterministic extraction should probably yield:

- `name`: Leo Müller-Sarkisian
- `age`: Mid-30s
- `role`: Early career detective / academic consultant
- `description`: a compressed high-level paragraph from the opening sections
- `notes`: the remaining narrative text grouped by section

The app should also preserve section structure, for example:

- Physical Description
- Personality
- Background
- Skills
- Special Traits
- Social Dynamics
- Goals and Motivations
- Academic Background

Even if the current character schema cannot store all of these as first-class fields, the import workflow should still preserve them visibly during review.

## What AI Should Help With

AI should be used for:

- suggesting a compact description from a long source doc
- proposing field mappings when labels are fuzzy
- identifying likely “role” from `Occupation`
- flagging content that looks out of scope or non-canonical
- summarizing long sections into editable notes
- suggesting whether some sections belong in:
  - character profile
  - world bible
  - scratchpad
  - discard/ignore

AI should **not**:

- silently rewrite the source
- invent structured facts that were not stated
- decide canon vs brainstorming without review
- overwrite the full imported text without preserving it somewhere reviewable

## Product Stance On AI

The right amount of AI here is:

- **assistive and reviewable**

not:

- **automatic and opaque**

A good import should feel like:

- “Here is what we extracted.”
- “Here is what we were unsure about.”
- “Approve, edit, or discard each part.”

not:

- “We turned your document into a character for you.”

## Recommended Import UX

## Step 1: Ingest

Support:

- `.docx`
- `.rtf`
- pasted text
- eventually Google Docs export or direct paste, but not required for v1

## Step 2: Parse

Split the input into:

- detected labeled fields
- detected sections
- unmatched remainder

## Step 3: Review Panel

Show:

- extracted `Name`
- extracted `Age`
- proposed `Role`
- proposed short `Description`
- section buckets with editable content
- “possible non-canon / reference residue” warnings

For this example, the final “Leo in literature/history” block should likely be flagged as:

- `Possibly reference material, not core character canon`

## Step 4: Save Targets

Allow the user to choose:

- `Create Character`
- `Create Character + keep full source notes`
- `Send some sections to World Bible`
- `Discard flagged sections`

## Schema Recommendation

If long-form character import becomes important, the current character schema should grow.

Minimum useful additions:

- `appearance`
- `personality`
- `background`
- `skills`
- `relationships`
- `motivations`
- `sourceNotes`

If you do not want a schema expansion yet, then at minimum store reviewed import sections inside a structured notes object rather than flattening everything into `description`.

## What To Build First

The first slice should not be “AI import from Google Docs.”

It should be:

1. deterministic section/labeled-field extraction from pasted text / `.docx` / `.rtf`
2. import review UI
3. optional AI suggestions for summary and field mapping

Why:

- most value comes from preserving structure and giving the user control
- AI becomes much safer once the raw parse is already visible

## Google Docs Question

Should users often write in Google Docs first?

Yes, probably often enough to matter.

But the near-term product need is not a direct Google Docs integration. The near-term need is:

- importing exported `.docx`
- importing pasted text
- making the import review workflow good enough that external drafting is not punished

Direct integration can wait. Good import review cannot.

## Recommendation

Treat long-form character import as an onboarding bridge.

It helps users migrate their existing process into the app.

So the system should optimize for:

- preserving trust
- preserving structure
- showing uncertainty
- offering AI as a second-pass assistant

not for:

- “one-click smart import” magic

## Next Step

Implementation spec:

- `docs/character-import-review-flow-spec.md`
