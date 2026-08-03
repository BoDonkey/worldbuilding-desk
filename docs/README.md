# Documentation Map

Last updated: 2026-08-03

The active documentation set was consolidated on 2026-08-01 down to seven
documents. Everything else lives in `docs/archive/` with a banner pointing at
its replacement.

## Active Documents

Read in this order:

1. `PROJECT_STATUS.md` (repo root) — what is true in the current application.
2. `docs/road-to-market.md` — the single active roadmap and slice plan, from
   trust validation through beta and launch. Its status board is authoritative
   for open work.
3. `docs/product-blueprint.md` — product thesis, positioning, UX principles,
   navigation/IA decisions, fiction-first boundary, UI language and a11y
   guardrails, and the design system (style bible).
4. `docs/architecture-review.md` — durable architecture boundaries and current
   structural risks.
5. `docs/domain-model.md` — the lore/canon model, canon decision workflow,
   manuscript-time state model, and the AI proposal boundary (including the
   item-authoring direction).
6. `docs/smoke-tests.md` — reusable manual smoke procedures for backup
   round-trip, review completion, and character canon unification.
7. `docs/marketing-plan.md` — positioning, audience, pricing, and launch
   channels; companion to road-to-market Phase 6.

If documents disagree: current implementation truth comes from
`PROJECT_STATUS.md`; open work and its order come from
`docs/road-to-market.md`; durable product/UX/design decisions from
`docs/product-blueprint.md`; durable architecture boundaries from
`docs/architecture-review.md`; domain contracts from `docs/domain-model.md`.

Other files:

- `AGENTS.md` (root) — instructions for coding agents; points here.
- `smoke-review-sample.md` (root) — regression fixture text used by the
  review-completion smoke.
- `apps/web/editor-config.md` — developer reference for TipTap editor/toolbar
  customization (moved from the repo root).

## Archive

`docs/archive/` contains completed implementation plans, superseded strategy
and UX documents, dated audits and fitness reports, historical research, and
the full-length originals behind the 2026-08-01 consolidation:

- `next-steps-through-2026-08-01.md` and the prior
  `next-steps-through-2026-07-26.md` — roadmap history.
- `ui-design-work-slices.md` and `fitness-a-work-slices.md` — full
  self-contained agent prompts for the slices imported into
  `docs/road-to-market.md` Phases 0, 2, and 3.
- `code-fitness-report-2026-08-01.md` — current fitness baseline (grade A−).
- `freeform-lore-ingestion-architecture.md`, `canon-decision-workflow.md`,
  `customizable-state-model-spec.md`, `ai-assisted-item-authoring.md` — full
  design rationale behind `docs/domain-model.md`.
- `product-blueprint-2026-07-26.md`, `navigation-ia-decision.md`,
  `style-bible.md`, `multi-mode-directives.md`,
  `ui-language-i18n-a11y-audit.md`, `readme-map-2026-07-26.md` — sources of
  `docs/product-blueprint.md` and the prior doc map.
- `product-health-audit.md` — source of the road-to-market Phase 1 trust
  slices.
- The three full smoke procedures behind `docs/smoke-tests.md`, plus
  historical smoke run logs.

Archived documents preserve rationale but are not instructions for work from
the current tree.

## Maintenance Rules

- Keep `docs/road-to-market.md` limited to open work; move completed status
  into `PROJECT_STATUS.md` and mark slices done on the status board rather
  than keeping completion diaries.
- Record durable decisions in the relevant authority document (blueprint,
  architecture, domain model).
- Archive completed or superseded documents with a short banner naming the
  replacement; repair internal links whenever a document moves.
- Do not create new parallel roadmaps, navigation plans, or spec forks; extend
  the six active files under `docs/` instead. If a new large proposal is
  genuinely needed, give it a status and date, and fold its durable outcome
  back into the authority docs when decided.
- Update this map when authority or placement changes.
