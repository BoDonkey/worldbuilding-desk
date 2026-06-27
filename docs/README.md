# Documentation Map

Last updated: 2026-06-27

This folder contains current planning docs, smoke checklists, architecture notes, and older research. Use this map to avoid treating every file as equal source of truth.

## Read First

- `PROJECT_STATUS.md` at the repo root is the current product and engineering status snapshot.
- `docs/next-steps.md` is the active roadmap and branch-sequencing source of truth.
- `docs/product-health-audit.md` is the current audit of Lore Documents, RAG, Shodh memory, character detail consistency, and documentation health.
- `docs/style-bible.md` is the required design direction before UI, CSS, layout, or component styling changes.

## Active Reference Docs

- `docs/navigation-simplification-roadmap.md` explains the writing-first navigation direction.
- `docs/navigation-ia-decision.md` records the accepted information architecture.
- `docs/freeform-lore-ingestion-architecture.md` explains Lore Documents, extraction candidates, accepted canon facts, and canon-decision flow.
- `docs/canon-decision-workflow.md` explains duplicate/conflict review behavior.
- `docs/character-canon-unification-smoke-test.md` is the focused character-canon checklist.
- `docs/review-completion-smoke-test.md` is the focused review completion checklist.
- `docs/project-backup-smoke-test.md` is the focused backup/import checklist.

## Historical Or Specialist Docs

The remaining top-level docs are useful when working on their specific area, but they should not override `PROJECT_STATUS.md`, `docs/next-steps.md`, or this map. Files under `docs/archive/` are historical unless a current task explicitly revives them.

## Maintenance Rule

When a branch changes product direction or the next-session stop point, update `PROJECT_STATUS.md` and `docs/next-steps.md`. When it changes which docs are canonical, update this map.
