# Multi-Mode Product Directives

Last updated: 2026-02-26

## Intent

Preserve the Fiction product as the current shipping priority while designing for a future Nonfiction product as a separate revenue stream.

## Product Positioning Rules

1. Fiction and Nonfiction are distinct products, not a single blended UX.
2. Shared infrastructure is allowed; domain workflows, copy, and packaging should remain product-specific.
3. Nonfiction work remains exploratory until market validation is complete.

## Delivery Priority Rules

1. Fiction MVP must-haves stay first in execution order.
2. Nonfiction work is limited to isolated spike/planning branches until explicit approval.
3. No nonfiction-driven timeline risk is accepted for fiction release readiness.

## Architecture Rules

1. Use shared core + domain adapters:
- Shared core: storage, editor shell, import/export primitives, LLM connectors, RAG plumbing.
- Domain adapters: fiction-domain logic vs nonfiction-domain logic.
2. Do not place mode-specific business rules inside shared services.
3. Mode visibility is controlled by capability flags at route/component boundaries.

## Data Model Rules

1. Keep core entities generic and stable.
2. Put mode-specific fields in namespaced payloads (example: `fiction.*`, `nonfiction.*`).
3. Any schema change must document:
- migration impact
- cross-mode compatibility
- rollback plan

## Branching and Merge Rules

1. Fiction delivery branch(es) continue independently.
2. Nonfiction experimentation remains on dedicated branches (for example, `codex/nonfiction-*`).
3. No nonfiction refactor merges to `main` before post-MVP go decision.
4. Cross-cutting changes must prove zero fiction regression via build/lint/smoke checks.

## Release Strategy Rules

1. Treat Fiction and Nonfiction as separate SKUs/products, even if code is shared.
2. Keep separate product messaging, onboarding, and pricing hypotheses.
3. Delay irreversible repo/package split until evidence supports continued nonfiction investment.

## Go / No-Go Decision Gate (Nonfiction)

Proceed beyond spike only if all are true:

1. Market signal confirms demand (interviews/tests with target users).
2. A thin prototype demonstrates reliable grounding/citation behavior.
3. Estimated implementation does not threaten fiction roadmap commitments.

If any fail, nonfiction remains parked and fiction roadmap continues.

## Current Status

1. Fiction MVP: active priority.
2. Nonfiction: parked spike track pending market research.
