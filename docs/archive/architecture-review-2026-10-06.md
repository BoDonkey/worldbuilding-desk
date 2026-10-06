# Code Health + Architecture Review — 2026-10-06

**Type:** dated audit (archive convention, same as the fitness reports).
**Audited:** local `main` at `1945f29` ("Mark roadmap slice 1.4 complete"),
in sync with `origin/main`, with a clean working tree at review start.
**Compared against:** `docs/archive/architecture-review-2026-10-03.md`.
The intervening work completed provider hardening, atomic canon writes,
dependency cleanup, hotspot extraction, AI-text provenance and reporting,
scene drafting, the consistency-hook split, persistent model-assisted review
items, and the grounded **Ask your project** destination.
**Scope:** cleanliness and architecture tidiness, with focused review of the
new project Q&A flow, the shared assistant, and the recent consistency split.
No application code changed during the audit. Durable conclusions are folded
into `docs/architecture-review.md`; implementation work is scheduled only in
`docs/road-to-market.md`.

## Verification baseline

| Check | Result |
| --- | --- |
| Working tree | clean on `main` |
| `pnpm check:file-sizes` | pass — 8 non-test files over 1,500 lines; none grew past its recorded baseline |
| `pnpm --filter web lint` | 0 errors; 1 carried `ConsumableEffectEditor.tsx:65` `exhaustive-deps` warning |
| `pnpm --filter web test:unit` | 168 files / 856 tests pass |

The Slice 3.16 split is a material improvement: `useWorkspaceConsistency`
is now a small composer over responsibility-specific hooks and tested pure
services. The file-size freeze also prevents new unchecked hotspot growth.
The remaining issue is less raw file size than policy ownership: the shared
assistant still owns provider setup, retrieval, factual gating, pending
proposal context, model execution, consultation accounting, coaching,
conversation persistence, and presentation in one component.

## Findings

### F1 — Ordinary assistant model calls bypass the project consultation budget (high)

`AIAssistant.handleSendPrompt` reaches `runModel` without checking
`budget.blocked` and without calling `budget.spend('assistant')`. On the new
`/ask` route, the only `ConsultationBudgetNotice` is hidden because there is no
scene/coach evidence. A hosted creative or analytical request therefore:

- can run after the project consultation limit is exhausted;
- is absent from the per-feature usage ledger; and
- has no point-of-use cost/remainder disclosure.

This contradicts the accepted product contract in
`docs/product-blueprint.md`: every author-made model request spends one
consultation unless its route is verified private-local, and every spending
action explains the cost before the request. Deterministic factual answers
must remain free because they do not call a model.

The adjacent writing-coach path does use the shared budget, but records the
feature as `assistant` even though `writing-coach` is an existing feature id.
That makes the Settings breakdown inaccurate.

**Evidence:**

- `apps/web/src/components/AIAssistant/AIAssistant.tsx:513`
- `apps/web/src/components/AIAssistant/AIAssistant.tsx:668`
- `apps/web/src/components/AIAssistant/AIAssistant.tsx:849`
- `docs/product-blueprint.md` § AI consultation budget

**Disposition:** roadmap Slice 3.17. The fix should centralize request policy,
not add another local conditional to the Ask route.

### F2 — Pending-proposal opt-in is not readiness-safe (medium)

`usePendingProposals` exposes `null` both when disabled and while enabled data
is still loading. `AskProjectRoute` passes that value directly to the shared
assistant while the Send action remains enabled by the independent RAG/Shodh
readiness state. Immediately after checking **Include pending proposals**, an
author can therefore send a request that silently omits them.

The hook also converts a storage error into an empty successful context. The
route then states that zero pending proposals can come up in discussion, even
though the requested context failed to load. Event-triggered reloads may
overlap without a request generation guard, so an older read can replace a
newer result.

**Evidence:**

- `apps/web/src/hooks/usePendingProposals.ts:16-47`
- `apps/web/src/routes/AskProjectRoute.tsx:23-24, 61-84, 97`

**Disposition:** roadmap Slice 1.4a, after 3.17 so it can use the clarified
assistant readiness boundary.

### F3 — The durable architecture risk list describes resolved code (low)

`docs/architecture-review.md` still says the desktop package has no lint or
tests and that the production dependency advisories remain open. Both were
resolved by Slices 3.12a and 3.15. It also describes
`useWorkspaceConsistency` as a growing hotspot after Slice 3.16 split it.
Because agents read this document as the durable architecture authority, the
stale risk list can send future work toward already-resolved problems.

**Evidence:**

- `docs/architecture-review.md` § Current Architecture Risks
- `apps/desktop/package.json` (`lint`, `test`)
- roadmap Slices 3.12a, 3.14–3.16

**Disposition:** corrected as audit close-out, not scheduled as an application
slice.

## Scheduled order

1. **3.17 — Centralize assistant request policy.** Fix the cost-control
   regression and make the shared model-call boundary explicit.
2. **1.4a — Fail-closed pending-proposal readiness.** Build the opt-in loading
   and error states on that boundary.

Both slices must land before beta. They are sequential because both touch the
shared assistant contract; 3.17 goes first so 1.4a does not add another
surface-specific request guard that the extraction immediately has to move.
