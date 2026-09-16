# Documentation Map

Last updated: 2026-09-12

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
   manuscript-time state model, Character identity contract, and the AI
   proposal boundary (including the item-authoring direction).
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
- `fixtures/trust-dogfood/README.md` — the active multi-day execution runbook,
  resume checkpoint, and A–G results log for roadmap slice 1.1.
- `apps/web/editor-config.md` — developer reference for TipTap editor/toolbar
  customization (moved from the repo root).
- `docs/character-experience-design-review.md` — accepted decision record for
  unifying characters around one canonical World Bible identity; its durable
  contract and journey tests are folded into the authorities above, while the
  roadmap remains authoritative for execution status.
- `docs/research-litrpg-genre.md` and
  `docs/research-litrpg-craft-failures.md` — active working input for roadmap
  slice 4.18 (craft library content): subgenre taxonomy, platform conventions,
  and 28 candidate coaching patterns with source-confidence and detectability
  marks. **Not authorities.** They are cited research to be corrected by the
  author before drafting, not decisions. Archive both only after their vetted
  claims have moved into the versioned craft library and the parallel content
  track no longer uses them as active input.
- `docs/writing-coach-corpus-production-handoff.md` — active, non-authoritative
  production brief for creating and quality-checking the large draft coaching
  corpus in parallel with roadmap Slice 4.17. It defines working-file
  placement, provisional metadata, coverage targets, sourcing rules, and the
  resume protocol; the roadmap and domain/architecture documents remain
  authoritative.
- `docs/world-canvas.md` and `docs/world-canvas-plan.md` — dated (2026-09-12)
  planning prompt and the resulting World Canvas work-slice proposal (an
  optional World Bible view for premise, lenses, and questions). Accepted
  2026-09-12 and scheduled as roadmap slices 4.30–4.34 (pre-beta); the plan
  holds the full prompts, the roadmap holds status.
- `docs/corkboard-improvement.md` and `docs/corkboard-scenes-plan.md` — dated
  (2026-09-12) planning prompt and the resulting proposal for one-click
  Chapter Card ↔ scene linking (shared link UI, create linked scene,
  Workspace card context). Accepted 2026-09-12 and scheduled as roadmap
  slices 4.35–4.37 (pre-beta, after 4.30–4.31); no schema change; the plan
  holds the full prompts, the roadmap holds status.
- `docs/tactical-actions.md` — dated, non-authoritative external market
  research (2026-09-12) proposing five tactical actions. Its accepted outcomes
  are roadmap slices 4.28–4.29 plus small edits to 5.8/5.9/6.1 and the
  backlog; its citation tokens are broken and its figures are unverified.
- `docs/portable-data-schema.md` — public, versioned Markdown/CSV interchange
  contract for the human-readable project export and Markdown-folder import;
  full-fidelity restore remains the project backup ZIP.
- `docs/research-payment-provider.md` — dated, non-authoritative vendor and
  architecture research for roadmap Slice 5.7. It compares Paddle and Creem,
  records a conditional sandbox recommendation and decision gates, and does
  not claim the slice or select a production provider.

## Archive

`docs/archive/` contains completed implementation plans, superseded strategy
and UX documents, dated audits and fitness reports, historical research, and
the full-length originals behind the 2026-08-01 consolidation:

- `next-steps-through-2026-08-01.md` and the prior
  `next-steps-through-2026-07-26.md` — roadmap history.
- `ui-design-work-slices.md` and `fitness-a-work-slices.md` — full
  self-contained agent prompts for the slices imported into
  `docs/road-to-market.md` Phases 0, 2, and 3.
- `code-fitness-report-2026-08-07.md` — current fitness close-out (grade A);
  the superseded 2026-08-01 A− baseline remains beside it for comparison.
- `freeform-lore-ingestion-architecture.md`, `canon-decision-workflow.md`,
  `customizable-state-model-spec.md`, `ai-assisted-item-authoring.md` — full
  design rationale behind `docs/domain-model.md`.
- `product-blueprint-2026-07-26.md`, `navigation-ia-decision.md`,
  `style-bible.md`, `multi-mode-directives.md`,
  `ui-language-i18n-a11y-audit.md`, `readme-map-2026-07-26.md` — sources of
  `docs/product-blueprint.md` and the prior doc map.
- `product-health-audit.md` — source of the road-to-market Phase 1 trust
  slices.
- `character-experience-redesign-brief.md` — superseded Character identity
  problem brief; its accepted decisions remain in the design review and its
  durable contract and journeys live in the domain and smoke authorities.
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
