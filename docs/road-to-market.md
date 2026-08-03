# Road to Market — Master Work Plan

**Created:** 2026-08-01 · **Reconciled:** 2026-08-03 · **Baseline:** `main` at
`4b33eed` (clean, in sync with origin) · fitness grade A− per
`docs/archive/code-fitness-report-2026-08-01.md`

This is the single active roadmap and slice plan. It absorbs the former
`next-steps.md`, `ui-design-work-slices.md`, `fitness-a-work-slices.md`, and
the open items from `product-health-audit.md` (all preserved in
`docs/archive/`, including full self-contained agent prompts for imported
slices — referenced below as _[prompt: archive doc § slice]_).

## v1 Definition

**v1 is a paid desktop app: one-time purchase with a free trial, sold through
a merchant-of-record (Paddle or Lemon Squeezy) plus a simple landing page,
preceded by a 4–8 week free beta with a small author cohort.**

Rationale: the app is local-first with BYOK AI providers (author-supplied API
keys or local Ollama), so there are near-zero server costs — the
Scrivener/Obsidian one-time-purchase model fits better than SaaS. A
merchant-of-record handles VAT/sales tax and license keys, keeping payments
work to two slices. The beta comes first because the top product risk —
whether the canon/trust path holds up on realistic multi-document projects —
is exactly what beta authors will exercise.

v1 must include: trustworthy lore→canon→assistant pipeline, the calm
writing-first shell, accessible dialogs/nav, packaged + signed installers for
macOS and Windows, auto-update, storage schema versioning, first-run
onboarding with a sample project, trial/license gate, and a help/docs baseline.

Explicitly **post-v1**: AI item-authoring slices beyond the manual
description-first path, ruleset-domain adapters, app-wide search expansion,
Scratchpad organization, Corkboard expansion, executable ruleset generation,
carry weight/encumbrance, nonfiction product work, persona/game-engine
ecosystems, Zod 4 migration.

## Working Rules

- Prefer narrow slices that complete an author workflow; keep AI
  author-invoked, proposal-oriented, review-gated (see `docs/domain-model.md`).
- Behavior-preserving refactors stay behavior-preserving; run the full
  verification battery before commit (see battery below).
- Update `PROJECT_STATUS.md` when application truth changes; update this file
  when priority or remaining work changes; archive completed phases.
- Trust dogfooding is required before beta but is deferred while current
  capacity is focused elsewhere. It does not block unrelated Phase 2–5 work.

Verification battery:

```bash
pnpm --filter web lint          # 0 errors (3 exhaustive-deps warnings baseline)
pnpm --filter web test:unit     # 232+ tests
pnpm --filter @litrpg-tool/rules-engine test
pnpm --filter @litrpg-tool/rules-ui test
pnpm --filter web build
pnpm --filter desktop build
pnpm --filter web e2e:run       # for slices touching routed UI
```

## Executing a Slice (instructions for agents)

1. **Claim it.** Set the slice to `WIP` on the status board below before
   starting. Respect phase ordering and the noted dependencies (2.2 after
   2.1; 2.7 after 2.5; 3.5–3.8 sequentially; Phase 6 strictly ordered).
2. **Get the full prompt.** Slices marked _[prompt: archive/... § Slice N]_
   have complete, self-contained agent prompts in the archived plan. Use
   them, but apply these remaps — the archived docs predate the 2026-08-01
   consolidation:
   - Any instruction to update a status/execution table **in the archived
     plan itself** (including ui-design Slice 11's "append a status table"
     and fitness Slice 9's "update the execution-status table in this file")
     applies to **this file's status board instead**. Do not edit archived
     documents except to add an archive banner.
   - References to `docs/next-steps.md` → this file.
   - References to `docs/style-bible.md` or `docs/navigation-ia-decision.md`
     → `docs/product-blueprint.md`.
   - References to the lore/canon/state/item specs → `docs/domain-model.md`.
   - References to `docs/code-fitness-report-2026-08-01.md` →
     `docs/archive/code-fitness-report-2026-08-01.md`. New dated reports
     (fitness Slice 9 / 3.9) are written directly to `docs/archive/` and
     linked from the status board.
3. **Verify.** Run the battery above (plus local Cypress for routed-UI
   slices); report counts in the commit message.
4. **Close out.** Mark the slice `Done <commit>` on the board. Update
   `PROJECT_STATUS.md` if application truth changed. Never round a partial
   result up to done — record the honest state in the board's note column.

## Status Board

Update as slices land. Statuses: `—` not started, `Deferred` with the reason
and required revisit point, `WIP`, `Done <commit>`.

| # | Slice | Phase | Size | Status |
|---|---|---|---|---|
| 0.1 | Branch/worktree cleanup | 0 | XS | Done `51d1586` |
| 1.1 | Realistic-project trust dogfood | 1 | M | Deferred — required before beta; not a current blocker |
| 1.2 | Fix trust-path failures found in 1.1 | 1 | ? | — (if needed after 1.1) |
| 1.3 | Calm-shell navigation validation | 1 | S | — |
| 1.4 | Proposal-review assistant route (conditional on product need) | 1 | M | — |
| 2.1 | ConfirmDialog + InlineAlert components | 2 | S | Done `38db7df` |
| 2.2 | Migrate confirm/alert call sites | 2 | M | Done `9c278a3` + test fix `ab14f63` — Cypress re-run 2026-08-03: 42/42 passing |
| 2.3 | Inline field-level validation | 2 | S | Done `45a163f` — lint; 252 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 42/42; manual browser checks |
| 2.4 | Theme CharacterStyle editor family | 2 | S | Done `6e0454a` — lint; 255 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 42/42; light/dark browser checks |
| 2.5 | CompendiumRoute off inline styles | 2 | M | Done `83374f2` — zero inline styles; lint; 255 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 42/42; three-tab before/after browser comparison |
| 2.6 | CharacterSheetsRoute off inline styles | 2 | M | Done `effb82e` — zero inline styles; lint; 255 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 42/42; build/history before/after browser comparison |
| 2.7 | Compendium sub-list search/filter | 2 | S | Done `b43aa19` — 4 name filters; lint; 258 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 42/42; manual entry/recipe filter-clear checks |
| 2.8 | Primary nav / "More" badge visibility | 2 | S | — |
| 2.9 | UI close-out audit | 2 | XS | — |
| 3.1 | WorkspaceRoute drawer/context extraction | 3 | M | — |
| 3.2 | WorkspaceRoute to <2,000 lines | 3 | M | — |
| 3.3 | WorldBibleRoute to <2,000 lines | 3 | M | — |
| 3.4 | CharacterSheetsRoute to <2,000 lines | 3 | S | — |
| 3.5 | ESLint 10 group upgrade | 3 | M | — |
| 3.6 | Vite 8 + plugin-react 6 | 3 | S | — |
| 3.7 | Cypress 15 | 3 | S | — |
| 3.8 | TypeScript 7 | 3 | M | — |
| 3.9 | Dev-audit sweep + fitness close-out | 3 | S | — |
| 4.1 | Description-first manual item creation | 4 | S | — |
| 4.2 | Storage schema versioning + migrations | 4 | M | — |
| 4.3 | Package rename off `@litrpg-tool/*` | 4 | S | — |
| 5.1 | Auto-update decision + implementation | 5 | M | — |
| 5.2 | Code signing + notarization, both platforms | 5 | M | — |
| 5.3 | Packaged-app validation + Electron E2E | 5 | M | — |
| 5.4 | First-run onboarding + sample project | 5 | M | — |
| 5.5 | AI provider setup UX hardening | 5 | S | — |
| 5.6 | Opt-in error reporting | 5 | S | — |
| 5.7 | Trial + license key gate | 5 | M | — |
| 5.8 | Help/docs baseline | 5 | S | — |
| 5.9 | Landing page + demo assets | 5 | M | — |
| 6.1 | Beta build + cohort recruitment | 6 | M | — |
| 6.2 | Beta feedback triage + fix slices | 6 | ? | — |
| 6.3 | Release-readiness checklist + RC | 6 | M | — |
| 6.4 | Launch | 6 | S | — |

Phases 2 and 3 can interleave; within Phase 3, slices 3.5–3.8 run
sequentially. Phase 1 addresses the top product risk, but its dogfood run is
currently deferred for capacity and does not block unrelated Phase 2–5 work;
it must be completed, and release-relevant findings resolved, before the beta
build in 6.1. Phase 5 slices mostly parallelize. Phase 6 is strictly ordered.

---

## Phase 0 — Hygiene

**0.1 Branch and worktree cleanup.** Delete the 57 merged `codex/*` local
branches, prune 8 stale worktrees (keep the locked `.worktrees/ui-fixes`),
delete merged remote branches. No source changes.
_[prompt: archive/fitness-a-work-slices.md § Slice 0]_

## Phase 1 — Trust Validation (dogfood required before beta; currently deferred)

Goal: demonstrate that the app preserves the distinction between source
material, proposals, accepted canon, and manuscript state across a realistic
multi-document project. Guardrails: AI may explain, compare, and propose;
only accepted records/facts are canon; context rebuilds stay explicit and
recoverable. References: `docs/domain-model.md`,
`docs/archive/product-health-audit.md`.

**1.1 Realistic-project trust dogfood.** A complete scripted fixture exists
at `fixtures/trust-dogfood/`: five-chapter LitRPG manuscript, four lore
documents with planted contradictions, importable ruleset, state-event
script, an answer key enumerating every planted issue (unknown detection,
alias chains, fact conflicts, speculation containment, trust-tier ranking,
replay, health panels), and a session-by-session runbook with pass/fail
recording. Run the runbook (`fixtures/trust-dogfood/README.md`); it covers
the full pipeline: import → extract → accept/link → canon decisions →
assistant trust checks → state replay → health/rebuild. Record results in
the runbook's log. False positives (flags not in the answer key) are
first-class findings.

**1.2 Fix trust-path failures.** Turn every source-ranking, stale-summary, or
provenance failure from 1.1 into its own bounded fix slice. Release-relevant
findings must be resolved before beta; completion of 1.1 is not a prerequisite
for unrelated current assistant, UI, or release-engineering work. Size unknown
until 1.1 lands.

**1.3 Calm-shell navigation validation.** Manually verify primary navigation
and `More` grouping at desktop and narrow breakpoints across projects with no
mechanics, light mechanics, and heavy system tracking; verify the Lore
Documents list with the realistic project before adding grouping/filters;
confirm optional-system badges stay discoverable without promoting mechanics
routes. Resolve any changes through `docs/product-blueprint.md` navigation
rules.

**1.4 Proposal-review assistant route (conditional).** If product use and the
trust model justify it, add an explicit assistant route that can discuss
pending proposals without presenting them as canon. Dogfood findings may
inform this slice, but do not gate deciding or designing it.

## Phase 2 — UI, Dialogs, and Accessibility

Imported from the UI/UX plan (slices 1–2 already landed:
modal Escape/focus-trap `6d2f6c5`, nav `aria-hidden` `76d384c`). Full
self-contained agent prompts:
_[prompts: archive/ui-design-work-slices.md § Slices 3–11]_.

- **2.1** Build shared `ConfirmDialog` + `InlineAlert` in
  `src/components/common/`, themed, wired to the a11y hooks, with unit tests.
- **2.2** Migrate all 17+ `window.confirm`/`alert` call sites; add the two
  missing delete confirmations (CharacterStyleEditor, Corkboard). Blocked by
  2.1.
- **2.3** Inline field-level validation replacing alert-based validation.
- **2.4** Theme the CharacterStyle editor family off hardcoded hex (delete
  `StyleManager.tsx` if dead code).
- **2.5 / 2.6** Migrate CompendiumRoute (257 inline styles) and
  CharacterSheetsRoute (135) to CSS modules, visually identical.
- **2.7** Client-side search/filter for Compendium sub-lists (after 2.5).
- **2.8** Rework primary nav / `More` so pending-count badges (Sheets,
  Mechanics) are visible without opening the popover — reconcile with the
  Phase 1.3 findings before executing.
- **2.9** Close-out audit verifying 2.1–2.8 actuals; append results here.

## Phase 3 — Architecture and Toolchain

Imported from the Grade-A fitness plan. Architecture slices follow the proven
hook-extraction pattern (behavior-preserving, hooks <600 lines, pure logic
into tested services, full battery green). Toolchain majors run one at a
time, in order. Full prompts:
_[prompts: archive/fitness-a-work-slices.md § Slices 1–9]_.

- **3.1** WorkspaceRoute (3,424): extract drawer/context orchestration →
  ~2,600–2,800.
- **3.2** WorkspaceRoute final pass → <2,000.
- **3.3** WorldBibleRoute (3,011) → <2,000 (do not grow `useWorldBibleImports`).
- **3.4** CharacterSheetsRoute (2,374) → <2,000.
- **3.5** ESLint 10 group (+ plugins; resolve or explicitly defer the 14
  react-hooks compiler-rule violations).
- **3.6** Vite 8 + `@vitejs/plugin-react` 6 (keep `@types/node` at 24.x).
- **3.7** Cypress 15 (all 42 tests green locally and in CI).
- **3.8** TypeScript 7 last (fall back to TS 6.x if a hard dependency blocks).
- **3.9** Dev-audit sweep (33 findings baseline), re-verify grade-A criteria,
  write the new dated fitness report, archive the old one.

Zod 4 stays deferred as its own future migration.

## Phase 4 — Product Completeness for v1

- **4.1 Description-first manual item creation.** Slice 1 of the item
  authoring proposal only: generous description field ahead of the detailed
  form, save with no AI, full editor via progressive disclosure. The AI
  extraction slices (2–6) are post-v1.
  _[spec: docs/domain-model.md § 4; archive/ai-assisted-item-authoring.md]_
- **4.2 Storage schema versioning + migrations.** Explicit schema-version and
  migration contract for IndexedDB stores and project snapshots before any
  further persisted-shape changes and before beta (beta users' projects must
  survive updates). Includes a migration test harness and a
  backup-import version check.
- **4.3 Package rename.** Rename `@litrpg-tool/*` internal packages to match
  the product identity; cheapest while the monorepo is small, and required
  before public builds leak the old name.

## Phase 5 — Release Engineering

- **5.1 Auto-update.** Decide Squirrel / electron-updater / manual (this
  affects main-process structure and signing), implement, and test
  update-from-previous-version.
- **5.2 Code signing + notarization.** Apple Developer ID + notarization for
  macOS; OV/EV or Azure Trusted Signing for Windows. Wire into CI packaging.
- **5.3 Packaged-app validation.** Playwright Electron E2E covering the LLM
  streaming IPC path (highest-payoff single test); packaged checks for file
  operations, external-link policy, provider diagnostics; both platforms.
- **5.4 First-run onboarding + sample project.** Land the new author in a
  draft-ready workspace with an optional pre-seeded sample project that
  demonstrates canon capture, review, and assistant context without setup.
  Must honor the no-onboarding-wall principle.
- **5.5 AI provider setup UX hardening.** BYOK is a v1 differentiator and a
  support risk: clear provider setup, key validation, Ollama detection,
  actionable failure states, and a graceful zero-AI experience (the app must
  be fully usable with AI disabled).
- **5.6 Opt-in error reporting.** Crash/error capture (e.g. Sentry) with
  explicit opt-in, no manuscript content in payloads.
- **5.7 Trial + license key gate.** Merchant-of-record checkout, license key
  issuance/validation (offline-tolerant), trial period behavior, and a
  restore-purchase path. Keep it thin; no accounts service.
- **5.8 Help/docs baseline.** In-app or web help covering projects/backup,
  import, review workflow, World Bible/Lore model, AI setup, and the trust
  model in author language.
- **5.9 Landing page + demo assets.** Build the simple landing page and a
  60–90 second demo of the implemented core loop; include privacy/data-flow
  copy, analytics and download/checkout paths, and a plan for collecting
  permissioned beta proof. Claims must stay within verified product behavior;
  quantified performance claims wait for dogfood or beta evidence.

## Phase 6 — Beta, RC, Launch

- **6.1 Beta.** Signed, auto-updating build to a 10–30 author cohort
  (fiction + LitRPG mix). Define what feedback is collected and where; beta
  exit criteria: no data-loss reports, trust-path holds on real projects,
  authors return to write more than once.
- **6.2 Feedback triage.** Convert beta findings into bounded slices; data
  loss and trust failures block launch, polish items get scheduled honestly.
- **6.3 Release-readiness checklist + RC.** Create a fresh checklist from
  `main` (per the archived April lesson: checklists go stale — build it at RC
  time): backup/restore and manuscript export verified, reload/autosave
  safety, full battery + browser smoke + packaged desktop validation on both
  platforms, only release-blocking gaps recorded.
- **6.4 Launch.** Landing page live, checkout tested end-to-end, launch
  builds published, announcement per the marketing plan.

## Backlog (valid, not scheduled)

App-wide search beyond current entry points; AI-to-Scratchpad capture and
Scratchpad organization; Corkboard graduation to a route; item authoring AI
slices 2–6 and ruleset-domain adapters; advanced executable rule generation;
carry weight/encumbrance; nonfiction product; persona/game-engine tool
ecosystems; Zod 4.
