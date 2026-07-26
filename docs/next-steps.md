# Next Steps

Last updated: 2026-07-26

## Purpose

This is the active product and engineering roadmap. It intentionally contains
only open work and the order in which it should be considered.

Use:

- `PROJECT_STATUS.md` for what is true in the current application
- `docs/README.md` for document authority and navigation
- linked domain specifications for implementation detail
- `docs/archive/next-steps-through-2026-07-26.md` for prior roadmap history

Completed work should be removed from this file after it is reflected in
`PROJECT_STATUS.md`. Do not accumulate completion logs here.

## Current Priority Order

1. Validate lore, canon, retrieval, and assistant trust with realistic projects.
2. Finish the calm writing-first shell and optional-systems navigation.
3. Establish the reusable AI proposal/action boundary.
4. Pilot description-first, AI-assisted item authoring.
5. Continue narrow UI/accessibility and code-fitness slices.
6. Cut a fresh release-readiness checklist when preparing a release candidate.

## 1. Lore, Canon, and Assistant Trust

Goal: demonstrate that the application preserves the distinction between
source material, proposals, accepted canon, and manuscript state across a
realistic multi-document project.

Next work:

- Run the focused provenance/conflict smoke described in
  `docs/product-health-audit.md`.
- Verify that accepted World Bible records and canonical facts outrank
  conflicting Source Notes in normal assistant context.
- Verify that pending and rejected proposals remain outside ordinary assistant
  context.
- Fix source-ranking, stale-summary, or provenance failures before adding more
  assistant context features.
- If the trust path holds, add an explicit proposal-review assistant route that
  can discuss pending proposals without presenting them as canon.

Guardrails:

- AI may explain, compare, and propose.
- Only accepted records and accepted canonical facts are canon.
- Project-context rebuilds remain explicit, inspectable, and recoverable.

Primary references:

- `docs/product-health-audit.md`
- `docs/freeform-lore-ingestion-architecture.md`
- `docs/canon-decision-workflow.md`

## 2. Calm Shell and Optional Systems

Goal: keep Workspace, World Bible, and Lore Documents legible as the main
authoring model while preserving LitRPG systems as a discoverable optional
cluster.

Next work:

- Manually verify the current primary navigation and `More` grouping at desktop
  and narrow breakpoints.
- Keep badges for actionable optional-system state discoverable without making
  every mechanics route a primary destination.
- Validate the Lore Documents list with a realistic multi-document project
  before adding grouping or filters.
- Resolve remaining navigation changes through
  `docs/navigation-ia-decision.md`; do not create another parallel navigation
  roadmap.

Primary references:

- `docs/navigation-ia-decision.md`
- `docs/product-blueprint.md`
- `docs/style-bible.md`

## 3. Shared AI Proposal and Action Boundary

Goal: give author-invoked AI features one provider-neutral way to suggest
reversible application actions.

Next work:

- Define a versioned proposal envelope with source evidence, origin
  classification, confidence, validation results, unresolved questions, and a
  deterministic diff.
- Keep provider/model capabilities explicit; unsupported structured output must
  degrade to editable text or a retry, not partial mutation.
- Route all mutations through app-owned handlers and existing domain services.
- Require an editable preview and author confirmation for canon, schema,
  mechanics, and state changes.
- Reuse a shared read-only project-context extraction layer rather than
  rebuilding prompt context per feature.

This boundary should support the World Bible helper, item authoring, later
ruleset-domain adapters, and other explicit assistant actions. It must not
become an unbounded autonomous tool layer.

Primary references:

- `docs/architecture-review.md`
- `docs/ai-assisted-item-authoring.md`
- `docs/freeform-lore-ingestion-architecture.md`

## 4. Description-First Item Authoring Pilot

Goal: let authors create or update useful partial items without paging through
the full mechanics form.

Recommended sequence:

1. Put a description-first manual path ahead of the detailed form.
2. Allow the description to save without AI.
3. Extract basic identity and explicit values into an evidence-backed proposal.
4. Resolve mechanical terms against project stats, resources, templates, and
   slots.
5. Add deterministic update diffs for existing items.
6. From selected manuscript text, keep item definition changes separate from
   character acquisition, equipment, consumption, or loss events.
7. Add advanced conditional mechanics only after fixture evaluation shows
   acceptable reliability.

Before implementation, build a fixture set from realistic item descriptions.
Treat unsupported confident invention as the most important failure metric.

Primary reference:

- `docs/ai-assisted-item-authoring.md`

## 5. Active Engineering Work Plans

Two focused work plans remain active:

- `docs/ui-design-work-slices.md`
- `docs/fitness-100-work-slices.md`

Use their status tables for slice-level execution. They do not override the
product priority order above.

Near-term engineering concerns include:

- replacing browser-native confirm/alert interactions with shared accessible
  components
- completing narrow accessibility and visual-consistency work
- upgrading the Electron baseline
- migrating away from the older transformer dependency
- adding focused coverage around rules UI and high-risk application routes
- continuing incremental decomposition of large route components
- introducing storage schema versioning and migrations before risky persisted
  shape changes

Keep each change independently reviewable and verify it in proportion to its
risk.

## 6. Release Confidence

The April release checklist is archived because several status labels became
stale.

When preparing the next release candidate:

1. create a checklist from the current `main` branch
2. verify project backup/restore and manuscript export
3. verify reload/autosave safety
4. run lint, unit, rules-engine, web build, desktop build, and relevant browser
   smoke
5. validate packaged desktop behavior, external-link safety, and AI provider
   diagnostics
6. record only release-blocking gaps in the active checklist

Reusable smoke procedures:

- `docs/project-backup-smoke-test.md`
- `docs/review-completion-smoke-test.md`
- `docs/character-canon-unification-smoke-test.md`

## Backlog, Not Active Priority

- App-wide search beyond the existing entry points
- Scratchpad organization and AI-to-Scratchpad capture
- Further Corkboard expansion
- Advanced executable ruleset generation
- Carry weight and encumbrance
- Nonfiction product work
- Persona and game-engine tool ecosystems

These remain valid possibilities, but should not displace the current trust,
shell, proposal-boundary, and item-authoring work without an explicit product
decision.

## Working Rules

- Start from current dogfood evidence, not an archived implementation plan.
- Prefer a narrow slice that completes an author workflow.
- Keep AI author-invoked, proposal-oriented, and review-gated.
- Keep optional mechanics attached to writing and canon rather than foregrounded.
- Extend shared domain boundaries instead of adding route-local storage logic.
- Update `PROJECT_STATUS.md` when application truth changes.
- Update this file when priority or remaining work changes.
- Archive completed execution plans instead of leaving them at the top level.
