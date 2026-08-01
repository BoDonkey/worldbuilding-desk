> **Archived 2026-08-01.** Superseded by the rewritten `docs/README.md` after the 2026-08-01 consolidation.

# Documentation Map

Last updated: 2026-07-26

## Source Of Truth

Read these first:

- `PROJECT_STATUS.md` — what is true in the current application
- `docs/next-steps.md` — active priorities and execution order
- `docs/architecture-review.md` — durable architecture boundaries and current
  structural risks
- `docs/product-blueprint.md` — product promise and writing-first principles
- `docs/style-bible.md` — required UI and visual direction

If documents disagree, prefer this list in the order appropriate to the
question: current implementation comes from `PROJECT_STATUS.md`; future work
comes from `docs/next-steps.md`; durable product, architecture, and design
decisions come from their named authority document.

## Active Product And Domain References

- `docs/navigation-ia-decision.md` — canon ownership, navigation hierarchy, and
  optional-systems placement
- `docs/freeform-lore-ingestion-architecture.md` — Lore Documents, extracted
  proposals, and accepted canonical facts
- `docs/canon-decision-workflow.md` — duplicate, alias, conflict, and canon
  decision behavior
- `docs/customizable-state-model-spec.md` — manuscript-time state, mutation
  events, and replay
- `docs/ai-assisted-item-authoring.md` — description-first, review-gated item
  creation and the later ruleset-authoring adapter direction
- `docs/product-health-audit.md` — current lore/RAG/Shodh and character-detail
  trust audit
- `docs/multi-mode-directives.md` — fiction-first boundary and parked
  nonfiction direction

These documents contain active constraints or proposals. A proposal does not
enter the roadmap automatically; `docs/next-steps.md` determines priority.

## Active Work Plans

- `docs/ui-design-work-slices.md`

This contains detailed, independently executable engineering slices. Its
status table is authoritative for those slices, but it does not override the
product ordering in `docs/next-steps.md`.

## Focused Audits And Guardrails

- `docs/ui-language-i18n-a11y-audit.md`

Keep these while their findings remain open. When the work is complete, retain
any durable rules in the style bible or architecture reference and archive the
execution checklist.

## Smoke Procedures

- `docs/project-backup-smoke-test.md`
- `docs/review-completion-smoke-test.md`
- `docs/character-canon-unification-smoke-test.md`

Smoke documents should contain reusable procedures and current expected
behavior. Historical run logs should be archived rather than accumulated in
the procedure.

## Archive

`docs/archive/` contains:

- completed implementation plans
- superseded strategy and UX plans
- branch-specific handoffs and recovery notes
- dated audits
- prior roadmap snapshots
- historical research

Archived documents preserve rationale but are not instructions for work from
the current tree. Each newly archived document should carry a short archive
banner explaining what replaced it.

Notable July 26 archive changes:

- the former 1,279-line roadmap is preserved as
  `docs/archive/next-steps-through-2026-07-26.md`
- the May architecture/action review is preserved as
  `docs/archive/architecture-review-2026-05-10.md`
- completed character-canon, import, entity-ownership, navigation, and UX plans
  moved out of the active top level
- dated code-fitness reports and the stale April release checklist moved into
  the archive

The completed 18-slice fitness plan was archived on July 31 as
`docs/archive/fitness-100-work-slices.md`; its close-out result is
`docs/archive/code-fitness-report-2026-07-31.md`.

## Maintenance Rules

- Keep `docs/next-steps.md` short and limited to open work.
- Move completed status into `PROJECT_STATUS.md`; do not keep completion diaries
  in the roadmap.
- Record durable decisions in the relevant authority document.
- Give new plans a status and date.
- Archive completed or superseded plans instead of leaving them active-looking.
- Update this map when authority or document placement changes.
- Repair internal links whenever a document moves.
