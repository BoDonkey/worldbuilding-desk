# MVP Cut List

Last updated: 2026-02-24

## Goal

Ship a stable, local-first authoring product that supports:

- Writing workflow
- World bible management
- Practical AI assistance
- Reliable import/export for long-term publishing

## Must

1. Project safety and portability
- Full project backup export/import (`.zip`) covering scenes, world bible, settings, and rules.
- Round-trip validation (export -> import -> key counts match).

2. Scene export for real workflows
- Export scenes/manuscript as Markdown (`.md`) and DOCX.
- Preserve scene order and titles.

3. Kindle-ready publishing path
- Add EPUB export profile for ebook publishing.
- Keep DOCX export available for KDP upload workflows.

4. World bible import confidence
- Structured JSON import with mapping and validation (implemented baseline).
- Conflict review for duplicate name/category rows before commit.

5. AI reliability and control
- Provider selection with working providers and key management.
- Prompt Tools (style/tone/persona/instruction) with defaults and per-chat selection.
- One-click prompt tool presets (e.g., Critic, Beta Reader, Line Editor).
- Tool lifecycle management: add, edit, delete, enable/disable, set defaults, and import/export tool packs.
- Provider test action and clear failure diagnostics.

6. Canon consistency baseline
- Contradiction check for key entities across world bible + scenes.
- Review list with direct links to conflicting records.

## Should

1. PDF export for review
- Export manuscript PDF for proofreading/ARC distribution.
- Not the primary Kindle source format.

2. Compile manuscript wizard
- Select scenes, ordering, front/back matter, and output format.

3. App-wide search
- Search scenes + world bible entries from one place.

4. First-run onboarding
- Guided setup by project mode (LitRPG / Game / General).

## Later

1. Advanced EPUB controls (TOC depth, section breaks, themes)
2. Print-ready PDF profiles (trim/margins/header/footer presets)
3. Shared prompt tool packs/templates
4. Cloud sync and collaboration

## MVP Exit Criteria

1. Reliability
- `pnpm lint` and `pnpm build:web` pass.
- No data-loss path in create/edit/save/import flows after reload.

2. Portability
- User can export and re-import a project without losing core content.

3. Publishability
- User can produce Markdown + DOCX + EPUB output from scenes.

4. Usability
- New user can complete first project setup and first import via guided UI help.

## Recommended Release Order

1. Import/export hardening and manuscript compile
2. Publishing formats (DOCX + EPUB, then PDF)
3. Canon contradiction checks
4. AI diagnostics and prompt preset polish

## Current Branch Merge Plan

Branch: `codex/planning-ux-and-workflow`

1. PR A: UX + workflow
- Mode/toggle UX and nav visibility
- World bible import wizard + templates + onboarding guidance
- Compendium/Settings/Projects onboarding help updates

2. PR B: AI enhancements
- Prompt Tools in settings and assistant
- Gemini provider integration

Merge sequence:
1. Merge PR A to `main`
2. Run smoke checks
3. Merge PR B to `main`
