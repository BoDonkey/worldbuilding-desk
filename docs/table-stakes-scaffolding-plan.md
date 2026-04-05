# Table-Stakes Scaffolding Plan

Last updated: 2026-04-04

## Purpose

Define what "table stakes" should mean for Worldbuilding Desk without letting it drift into a generic AI novelist clone.

This document answers three questions:

1. Which broader-fiction features are now basic expectations?
2. Which of those should Worldbuilding Desk cover?
3. What is the smallest concrete scaffolding plan that fits the current product?

## Working Definition

For this project, **table stakes** means:

- features that many fiction writers now expect to exist
- features whose absence can make the app feel incomplete before its wedge is understood
- features that improve setup and planning clarity
- features that do **not** become the product identity

Table stakes are **not**:

- the moat
- the headline differentiator
- an excuse to match every competitor workflow
- permission to build a large prompt-generation suite

## Product Constraint

Worldbuilding Desk already has a defensible direction:

- local-first project ownership
- canon/world-state management
- review-driven entity resolution
- progression/mechanics support
- future consistency enforcement

So the correct goal is:

- add just enough broader-fiction scaffolding that general authors can get started cleanly

not:

- rebuild NovelCrafter inside this repo

## Table-Stakes Decision Framework

Use this filter before approving any broader-fiction feature:

### Ship Soon

Ship it if it:

- removes startup blank-page friction
- improves planning clarity for first real use
- fits inside existing project setup, corkboard, or AI prompt flows
- works for general fiction without weakening LitRPG/GameLit positioning

### Plan Later

Plan it later if it:

- helps breadth more than depth
- requires substantial new UX surface area
- would be useful, but is not necessary for a credible first-use experience

### Avoid For Now

Avoid it for now if it:

- pushes the product toward generic AI authorship
- creates a maintenance treadmill of content packs or prompt packs
- duplicates mature competitor surfaces without leveraging the existing wedge

## Recommended Table-Stakes Package

The smallest credible package is:

1. Project setup presets
2. Story-structure scaffolds
3. Lightweight trope/convention guidance
4. AI-assisted setup helpers for character/world/story seed creation

Everything else should stay secondary until corkboard and portability are stronger.

## Concrete Scaffolding Plans

### 1. Project Setup Presets

Goal:

- make new-project setup feel intentional instead of blank

What this should include:

- a small set of project intents tied to existing project mode
- starter guidance for how the workspace should be used
- default corkboard prompts that reflect the chosen intent

Recommended first preset set:

- `General Novel`
- `Mystery / Thriller`
- `Romance`
- `Epic Fantasy`
- `LitRPG / Progression Fantasy`

Implementation shape:

- extend the existing project setup flow rather than creating a new planner
- keep `projectMode` as the systems toggle
- add a second field for `storyScaffoldPreset` or similar metadata
- use the preset to seed:
  - starter corkboard prompt text
  - suggested chapter-card placeholders
  - suggested AI planning prompts

Important constraint:

- presets should influence defaults and guidance, not lock structure

### 2. Story-Structure Scaffolds

Goal:

- give authors a useful starting shape for planning without forcing them into a rigid template

What this should include:

- optional story structures that can seed chapter cards and beat prompts
- visible labels that help authors orient themselves in the corkboard

Recommended first scaffold set:

- `Three Act`
- `Hero's Journey`
- `Save the Cat`
- `Romance Arc`
- `Blank`

Implementation shape:

- seed chapter cards with scaffold-aware placeholder titles and summaries
- optionally seed beat placeholders inside cards where the structure is especially standard
- show scaffold labels as editable guidance, not fixed schema

Good example:

- `Three Act` could create:
  - Act I Setup
  - First Threshold
  - Midpoint Shift
  - Crisis
  - Climax
  - Resolution

Bad example:

- building a heavyweight separate outline editor with template-only workflows

### 3. Trope / Convention Guidance

Goal:

- help authors reason about audience expectations without turning the app into a trope encyclopedia product

What this should include:

- a lightweight set of optional trope prompts
- warnings or reminders for common expectations in selected genres

Recommended first version:

- no standalone trope library route
- no giant database
- just a compact preset-backed guidance layer used in:
  - project setup
  - corkboard AI prompts
  - optional planning hints

Example guidance:

- Romance:
  - relationship turning points
  - emotional escalation
  - payoff expectation
- Mystery:
  - clue distribution
  - suspect pressure
  - reveal timing
- Progression fantasy:
  - power-step readability
  - escalation pacing
  - system payoff cadence

Implementation shape:

- store trope guidance as small local preset data
- expose it as prompt context and optional hints, not as a content-management feature

### 4. AI-Assisted Setup Helpers

Goal:

- help authors get from rough idea to usable project scaffolding quickly

What this should include:

- guided AI actions for:
  - project premise shaping
  - initial chapter arc suggestions
  - starter cast generation
  - starter world/setting prompts

What it should not include:

- full-book auto-generation
- chapter drafting as the main selling point
- endless prompt-mode combinatorics

Implementation shape:

- add narrow setup actions tied to the selected preset/scaffold
- keep outputs reviewable and manually applied
- let authors promote output into:
  - corkboard chapter cards
  - beats
  - world bible starter entries
  - character records

## Recommended Sequence

### Phase A: Metadata + Seeding

Build first:

- preset metadata on projects
- scaffold metadata on projects or corkboard
- seed chapter cards from a selected scaffold

Why:

- this is the cheapest path to visible table-stakes coverage
- it extends current surfaces rather than adding new ones

### Phase B: Prompt-Aware Guidance

Build next:

- preset-aware corkboard AI prompts
- optional trope/convention hints in planning flows

Why:

- this increases usefulness without multiplying UX complexity

### Phase C: Setup Helpers

Build after:

- one-click guided AI setup actions for premise, cast, and world starters

Why:

- this is only valuable once presets and scaffolds give the outputs somewhere coherent to land

## What To Explicitly Defer

- marketing copy generation
- large prompt marketplaces
- chat/workshop ecosystem expansion
- deep codex-template packs
- broad collaboration features
- any separate "AI novelist suite" surface

These may become useful later, but they are not required for the smallest credible table-stakes package.

## Fit With Existing Repo Surfaces

This plan intentionally builds on what already exists:

- `projectMode` already distinguishes `LitRPG`, `Game Systems`, and `General Fiction`
- corkboard already supports story/chapter/card scope
- chapter-card and beat CRUD already exist
- AI results already stay reviewable before promotion
- world bible and character records already exist as promotion targets

That means the first parity/scaffolding pass should feel like:

- better defaults and clearer starting structures

not:

- a brand-new subsystem

## Recommendation

If only one table-stakes slice gets funded soon, it should be:

- **project setup presets + optional story-structure scaffolds seeded into corkboard**

That gives the broadest first-use improvement for the least architectural risk.

If a second slice is added, it should be:

- **preset-aware AI setup helpers with manual promotion into chapter cards, beats, characters, and world bible**

That stays compatible with the product's current philosophy:

- assist
- review
- apply deliberately

## Exit Criteria For The Planning Pass

This planning pass is complete when:

- every proposed broader-fiction feature is classified as `ship soon`, `later`, or `avoid for now`
- the smallest credible scaffolding package is explicit
- the first implementation slice is clear enough to estimate
- the package strengthens first-use clarity without diluting the wedge
