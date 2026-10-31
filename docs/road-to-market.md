# Road to Market — Master Work Plan

**Created:** 2026-08-01 · **Reconciled:** 2026-08-16 · **Baseline:** `main` at
`4b33eed` (clean, in sync with origin) · fitness grade A− per
`docs/archive/code-fitness-report-2026-08-01.md`

This is the single active roadmap and slice plan. It absorbs the former
`next-steps.md`, `ui-design-work-slices.md`, `fitness-a-work-slices.md`, and
the open items from `product-health-audit.md` (all preserved in
`docs/archive/`, including full self-contained agent prompts for imported
slices — referenced below as _[prompt: archive doc § slice]_).

## v1 Definition

**v1 is a paid desktop app: one-time purchase with a free trial, sold through
a merchant-of-record (Paddle or Creem, decision pending) plus a simple landing
page, preceded by a 4–8 week free beta with a small author cohort.**

Rationale: the app is local-first with BYOK AI providers (author-supplied API
keys or local Ollama), so there are near-zero server costs — the
Scrivener/Obsidian one-time-purchase model fits better than SaaS. A
merchant-of-record handles VAT/sales tax and license keys, keeping payments
work to two slices. The beta comes first because the top product risk —
whether the canon/trust path holds up on realistic multi-document projects —
is exactly what beta authors will exercise.

v1 must include: trustworthy lore→canon→assistant pipeline, the calm
writing-first shell, one coherent character experience centered in World
Bible, progressively disclosed optional mechanics, accessible dialogs/nav,
packaged + signed installers for macOS and Windows, auto-update, storage
schema versioning, first-run onboarding with a sample project, trial/license
gate, a help/docs baseline, and — added 2026-08-29 — the derived story
dashboard and the writing coach described below, and — added 2026-09-26 —
the character lab, and — added 2026-10-03 — optional password-protected
project vaults.

**Privacy promise.** Project data and manuscripts are stored locally.
SagaSpine does not send diagnostic telemetry and does not use author
writing to train AI. Text leaves the computer only when the author explicitly
invokes a hosted provider they configured; Ollama remains on-device only when
the endpoint is loopback and the selected model is verified local rather than
an Ollama cloud model. Hosted-provider setup and every author-facing AI
surface must explain that boundary accurately rather than claiming that every
Ollama or configured workflow is fully offline.

**v1 scope change, 2026-08-29.** The author judged the product materially more
useful with coaching than without, and accepted a later release to get it.
This moves the writing coach (4.17–4.20) and the derived story dashboard from
post-v1 into v1, and moves library-content authoring earlier. Recorded here so
the size of v1 stays visible: v1 now includes a curated content asset and a new
analysis surface, not only the trust pipeline and the release-engineering work.
The trade was made deliberately, not by drift.

**v1 scope change, 2026-09-26.** The author brought in a working standalone
prototype for talking to characters, testing their reactions, and running
short multi-character scenes, and chose to schedule it rather than defer it.
The character lab (4.42–4.45) and optional encrypted backups (5.14) move into
v1; persona tool ecosystems beyond the lab and game-engine narration stay
post-v1. Plan: `docs/character-lab-plan.md`.

**v1 scope change, 2026-10-03.** The author chose to make password protection
and encryption of working project data part of the product's privacy promise,
not only encryption of exported backups. Optional project vaults (5.15) move
into v1 before beta. This is a separate, larger slice from backup-file
encryption because it crosses autosave, every project-owned persistence path,
derived indexes, locking, migration, and recovery UX.

Explicitly **post-v1**: AI item-authoring slices beyond the manual
description-first path, ruleset-domain adapters, app-wide search expansion,
Scratchpad organization, *authored* Corkboard expansion (the *derived*
dashboard panels of 4.19 are v1), executable ruleset generation, carry
weight/encumbrance, nonfiction product work, persona/game-engine ecosystems
beyond the character lab,
Zod 4 migration, and the craft library beyond tranche 1 (which continues as a
parallel content track rather than a release gate).

**The writing-coach direction (v1 as of 2026-08-29).** Accepted in principle
on 2026-08-29: a coach that teaches craft patterns a new author does not know,
anchored to their own manuscript — "here is the pattern, here is where your
draft does it, here is where it does not, in chapters 3 and 7." Three parts at
different stages, deliberately separated:

- **Infrastructure — 4.17.** Retrieval plumbing only. Well defined,
  content-independent, verifiable on its own. (Moved from 5.13 on 2026-08-29:
  Phase 5 is release engineering, and this is now v1 product completeness.)
- **Experience — 4.20, shape decided 2026-08-29.** Three author decisions:
  (1) the coach is reachable **anywhere the author already interacts with the
  AI**, invoked by explicitly asking for its opinion — not a separate
  destination; (2) it also has **its own section in the story dashboard**;
  (3) coaching is **author-triggered, never passive** — the author decides when
  to run the more expensive reviews, so there is no background provider cost
  and no unsolicited interruption of drafting.

  Two consequences to design deliberately. Decision (1) makes **1.5
  load-bearing rather than optional**: if the coach can be asked anywhere the
  assistant lives, the shared propose → preview → confirm surface must exist
  everywhere first. And the two entry points carry **different scopes** — an
  inline ask is scoped to a selection or scene ("is this passage doing the
  thing"), while the dashboard section is scoped to the whole manuscript
  ("does this book have the shape"). Distinguish them explicitly; if they are
  not, the inline path will drift toward whole-manuscript analysis and become
  slow and vague.

- **Library content — 4.18 (tranche 1) plus a parallel track.** 30–50 vetted
  craft patterns are weeks of authoring, not engineering, and content cannot be
  parallelized across slices the way code can. So it is split: **tranche 1 is
  6–8 patterns, mixed general-craft and LitRPG/RPG-specific** (author decision,
  2026-08-29) — enough to build and verify 4.20 against and enough to test with
  outside readers. The remaining patterns continue as a **parallel content
  track that no engineering slice blocks on**, and are explicitly not a release
  gate. The model matches patterns to the draft and phrases the note; the
  curated library is the authority. Model recall is explicitly not the
  authority — a wrong craft claim is worse than a wrong continuity note because
  a new author cannot check it.

  **Validation note.** The coach is the first feature the author cannot
  dogfood alone: its audience is writers who do not already know these
  patterns, and the author does. Get outside reactions to tranche 1 before
  committing writing time to the rest — the 6.1 cohort is the cheapest source.
  Testing both content kinds in tranche 1 is the point of the mixed split.

Also v1 as of 2026-08-29 (4.19): a **derived story dashboard** inside
Corkboard —
read-only panels computed from explicit manuscript, accepted-state, ruleset,
and stable planning inputs, with every observation citing the scenes or records
it came from. Semantic POV, agency, and setup/payoff interpretation belongs to
author-triggered coaching rather than the deterministic foundation. The
governing rule is that authored cards and derived observations must never look
alike, and nothing on a derived panel is editable. This deliberately overrides
the earlier MVP recommendation
against deep Corkboard expansion in `docs/archive/deep-research-report.md`;
the author accepted the added scope and later release on 2026-08-29. Scope
discipline still keeps the dashboard close to continuity and structural
observation rather than broad line-level prose editing.

## Working Rules

- Prefer narrow slices that complete an author workflow; keep AI
  author-invoked, proposal-oriented, review-gated (see `docs/domain-model.md`).
- Behavior-preserving refactors stay behavior-preserving; run the applicable
  verification tier before commit (see policy below).
- Update `PROJECT_STATUS.md` when application truth changes; update this file
  when priority or remaining work changes; archive completed phases.
- Trust dogfooding is the active checkpoint after Phase 4. Keep Phase 5
  unclaimed until the 1.1 run is recorded and its findings are triaged; only
  release-blocking trust or data-loss findings must be fixed before 5.1.

### Verification policy

Every update runs the CI-policy regression tests and the file-size gate:

```bash
node --test scripts/ci/*.test.mjs
pnpm check:file-sizes
```

Application and CI-policy changes also run the fast battery before commit:

```bash
pnpm lint                      # 0 errors; existing ConsumableEffectEditor dependency warning
pnpm test                      # all web, rules-engine, rules-ui, and desktop unit tests
pnpm --filter web build
pnpm --filter desktop build
```

Browser coverage is selected by `scripts/ci/detect.mjs` and its tested policy
in `scripts/ci/plan.mjs`. Preview the local plan, including uncommitted files,
with `CI_BASE_SHA=origin/main node scripts/ci/detect.mjs`:

- **Documentation and known tooling:** root README, PROJECT_STATUS, AGENTS,
  Markdown under `docs/`, and the size-check script/baseline need only the
  tooling checks. They do not require application tests on their own.
- **Unit-only changes:** run the fast battery; no browser tests are required.
- **Focused UI:** the explicit Settings, Source Notes, Corkboard, and Projects
  styling mappings select their downstream browser specs. Run those specs
  locally when changing a covered application workflow, using
  `pnpm --filter web e2e:run --config retries=0 --spec '<selected specs>'`.
- **Full coverage:** persistence, canon/state, IPC, shared services, hooks,
  routes, dependencies, packages, shared/global styling, CI policy, broad
  refactors, and unmapped paths select every browser spec. Run the full local
  browser suite for application changes in this tier with
  `pnpm --filter web e2e:run --config retries=0`. A CI-only change needs policy
  tests and the fast battery locally, then a full remote run to exercise the
  workflow itself; no duplicate local UI run is required.
- **Release validation:** request full fresh coverage with Web CI's manual
  dispatch, or the `ci:full` PR label. Both bypass reuse. Keep packaged desktop
  validation and the relevant manual smoke procedures in `docs/smoke-tests.md`.
- **Packaged desktop app:** every application change also runs the `Desktop
  E2E` job, the Playwright Electron suite in `apps/desktop/e2e` against the
  unsigned `electron-builder --dir` app on macOS and Windows. Run it locally
  with `pnpm package:desktop:dir` then `E2E_APP=packaged pnpm --filter
  desktop e2e` when changing the main process, preload, IPC, packaging, or
  routing.

Web CI always publishes check results rather than skipping the entire
workflow by path. Full/focused browser selections run in up to three disjoint
parallel groups, without automatic retries. The existing `cypress-smoke`
check is an aggregate gate: failed planning, tooling, dependency audit, fast
checks, or any selected browser group makes it fail; an unexpectedly skipped
selected job cannot pass the gate.

PR coverage uses the cumulative diff against its target, not only the latest
commit. Documentation follow-ups to a code PR may reuse successful tests only
for an identical checked-out application/test/dependency/CI tree and coverage
selection. That fingerprint includes base-branch changes and file modes. The
proof's workflow and the most recent preceding run for the same head
repository/branch must both have succeeded. Missing, expired, corrupt,
failed, cancelled, pending, or unavailable evidence causes fresh verification.
Production dependency advisories are audited again even when tests are reused.

Superseded runs are cancelled on the same PR. Main-branch runs are serialized
and select full integration coverage unless an identical verified tree and
coverage can be reused. Documentation-only close-out does not require waiting
for unrelated browser work: successful reuse or an intentional policy skip is
valid, but a missing/failed selected check is not. Do not claim a full browser
run when a result was reused or coverage was focused.

## Executing a Slice (instructions for agents)

1. **Claim it.** Set the slice to `WIP` on the status board below before
   starting. Respect phase ordering and the noted dependencies (2.2 after
   2.1; 2.7 after 2.5; 3.5–3.8 sequentially; 4.5–4.11 after 4.2 with the
   internal ordering noted in Phase 4; 4.12 → 4.13 and 4.14 → 4.15;
   3.10 → 3.11; 3.10 → 4.42 → 4.43 → 4.44; 4.45 after 4.42;
   4.46 → 4.47 → 4.48; 4.42 after 4.46; 4.50 → 4.51; 4.50 → 4.52;
   3.15 first among 3.12–3.15; 3.12a → 3.12b; both before 5.3 and 6.1;
   3.16 → 4.53; 3.17 → 1.4a; 3.17 → 1.4b; 4.54 → 4.55 → 4.56;
   4.57 → 4.58 → 4.59;
   3.18 after 4.66; 3.22 → 3.23a → 3.23b; 3.23a → 3.23c;
   3.23a–3.23c before 5.15; 3.24a → 3.24b, both high priority; 4.67 → 4.68; 4.69 → 4.70;
   5.14 before 5.15; 5.15a → 5.15b → 5.15c; 5.15c → 5.16 → 5.17 → 6.1;
   Phase 6 strictly ordered).
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
3. **Verify.** Run the applicable tier above and relevant manual smokes;
   report the tier, coverage, and counts in the commit message.
4. **Close out.** Mark the slice `Done <commit>` on the board. Update
   `PROJECT_STATUS.md` if application truth changed. Never round a partial
   result up to done — record the honest state in the board's note column.
   After pushing, check the selected `Web CI` tier, including the aggregate
   `cypress-smoke` result. If it is red, fix it before claiming the next slice,
   or record the failure in the note column. Local-only green is not done.
   CI disables automatic browser retries. A test that passes only after a
   manual retry is still a flake to fix, not a pass to ignore.

## Status Board

Update as slices land. Statuses: `—` not started, `Deferred` with the reason
and required revisit point, `WIP`, `Done <commit>`.

| # | Slice | Phase | Size | Status |
|---|---|---|---|---|
| 0.1 | Branch/worktree cleanup | 0 | XS | Done `51d1586` |
| 1.1 | Realistic-project trust dogfood | 1 | M | Deferred — author resumed on 2026-08-22–23, completed setup through A-4 and partial lore/canon/assistant review, then stopped on systemic fact-target corruption and an unsafe D4 custody answer; preserve the project/evidence and resume on a fresh post-fix build after the blocking 1.2 follow-ups; a dev-only **Load trust-dogfood fixture** action (Projects) and a one-page run sheet in the runbook now cut setup to review-first, ~3–4 hours |
| 1.2 | Fix trust-path failures found in 1.1 | 1 | M | Done `f8d3d2e` + `545655c` + `1f1d2d7` + `813fb9c` + `aba657a` + `d6a22ea` — grounding/readiness, extraction/review precision, session continuity, deterministic supported answers, and a universal evidence gate that prevents all other factual questions from reaching creative generation; lint baseline; 306 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 45/45 |
| 1.2a | Fact-target integrity + reversible acceptance | 1 | M | Done `ce427b9` — editable World Bible entity targets; unresolved-subject fail-closed and sibling refresh; Sera/Brannic/Dess targeting and Brannic conflict coverage; conservative acceptance reversal without new hidden Notes copies; lint baseline; 387 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 55/55 |
| 1.2b | Temporal custody + conflicting-location grounding | 1 | M | Done `a92baa2` — storage questions inspect ordered primary saved scenes; designated storage, sign-out, pocket possession, and later use remain distinct; D4 reports current-custody uncertainty with chapters 3–5 cited and no provider call; accepted canon is fallback-only; lint baseline; 390 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 56/56 |
| 1.2c | Workspace scene continuity + Find | 1 | S | Done `8d299e3` — persisted scene selection now survives Workspace route remounts; editor/window/element scroll state is isolated by project and scene with no fallback; current-scene Find has toolbar and Cmd/Ctrl+F entry, wrapped keyboard navigation, Escape focus return, match highlighting, and route-remount coverage; lint with 2 baseline warnings; 398 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 57/57 |
| 1.2d | Lore intake/review clarity + matcher precision | 1 | M | Done `f86bd83` — article-equivalent entity identity prevents Salt Door duplicates; shared boundary/longest-match arbitration covers Bran/Brannic; review creates and selects World Bible types in place; Source Notes have consolidated intake/extraction actions, saved document-context language, one primary subject, and save-before-extract enforcement; lint with 2 baseline warnings; 406 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 57/57 |
| 1.2e | State/replay dogfood journey | 1 | S | Done `d9cb7e3` — simple Character continuity now hands directly to detailed inventory/equipment/status/location changes while keeping the selected character and scene; the detailed form uses author-facing actions with explicit preview, recording, scene scope, and replay; Session C maps every E event to exact current UI labels and adds the required Pale Draught baseline; lint with 2 baseline warnings; 407 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 57/57 |
| 1.3 | Calm-shell navigation validation | 1 | S | Done `530b59f` — desktop/narrow project-mode checks pass; 2.8 must expose the aggregate pending badge on narrow `More` without promoting optional systems |
| 1.4 | Grounded project Q&A destination (was: conditional assistant route) | 1 | M | Done `a4c47ab` — **Ask your project** (`/ask`, More → Utilities, palette) with its own conversation; factual questions through the existing evidence gate and saved-fact answers (no model call); opt-in **Include pending proposals** labels them "Pending proposal, not canon" for discussion and lists matches separately under deterministic answers; replies leave only via the shared Source Note preview; lint baseline; 856 web + 47 engine + 12 UI + 24 desktop tests; web/desktop builds; Cypress 130/130 |
| 1.4a | Ask pending-proposal readiness | 1 | S | Done `a46e67a` — lint, 928 web + 47 engine + 12 UI + 24 desktop tests, builds, file-size gate, and ask-project 5/5; `cypress-smoke` green (Web CI run 38041082525); the full local Cypress run left incomplete at the time (lore-review-matching page-load timeouts under machine load) was completed 149/149 without retries on 2026-10-24 on a tree containing 1.4a |
| 1.4b | Assistant follow-up subjects + evidence-gate coverage | 1 | M | Done `cff28f4` — reproduced on `/ask` 2026-10-24 before the fix: "What about her brother?" after a Sera question returned the generic unverified reply with no subject; "And her brother?", "Tell me how long Brannic served", "Remind me where the ledger is kept", "And his rank?", and "How about Dess?" all reached the provider. Fix: table-driven classifier (polite, continuation, report-verb, and invented-material rows; ambiguous gates) and deterministic one-turn subject carry-over through the shared text matcher, with the assumed name shown and zero/several candidates asking which record; carry-over applies only when a gated message refers back (pronoun or continuation) and a previous author question exists; no prior turns are sent to providers (reproduction showed no need for a Backlog item); report-style lookups such as "Tell me how long Brannic served" are gated but not yet answered by the narrow saved-fact resolvers; runbook D6–D10 and answer key added; `PROJECT_STATUS.md` gate statement corrected; lint 1 baseline warning; 1,053 web + 47 engine + 12 UI + 24 desktop tests; web/desktop builds; local Cypress 152/152 without retries; `cypress-smoke` green (run 40087727111, PR #61) |
| 1.5 | Shared AI proposal surface | 1 | M | Done `b1d0a2a` — the propose→preview→confirm surface extracted from the World Bible record helper (`AIProposalPreview` + `useAIProposalConfirmation`) is now adopted at all four surfaces named in the review: reviewed scene revisions, assistant-to-Source-Note capture, and canon rubber-duck decision prefill (a deterministic, position-anchored `Suggested Action:` tag, never free-prose matching); lint with 1 baseline warning; 445 web + 6 engine + 12 UI tests; web/desktop builds; Cypress ai-scene-revision 4/4 and canon-decisions 3/3, plus a clean 61/62 full run whose lone failure is a confirmed-unrelated pre-existing flake |
| 2.1 | ConfirmDialog + InlineAlert components | 2 | S | Done `38db7df` |
| 2.2 | Migrate confirm/alert call sites | 2 | M | Done `9c278a3` + test fix `ab14f63` — Cypress re-run 2026-08-03: 42/42 passing |
| 2.3 | Inline field-level validation | 2 | S | Done `45a163f` — lint; 252 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 42/42; manual browser checks |
| 2.4 | Theme CharacterStyle editor family | 2 | S | Done `6e0454a` — lint; 255 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 42/42; light/dark browser checks |
| 2.5 | CompendiumRoute off inline styles | 2 | M | Done `83374f2` — zero inline styles; lint; 255 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 42/42; three-tab before/after browser comparison |
| 2.6 | CharacterSheetsRoute off inline styles | 2 | M | Done `effb82e` — zero inline styles; lint; 255 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 42/42; build/history before/after browser comparison |
| 2.7 | Compendium sub-list search/filter | 2 | S | Done `b43aa19` — 4 name filters; lint; 258 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 42/42; manual entry/recipe filter-clear checks |
| 2.8 | Primary nav / "More" badge visibility | 2 | S | Done `4cb43b9` — narrow `More` now exposes the aggregate Mechanics completion count without promoting optional systems; lint; 259 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 43/43; desktop/narrow browser checks |
| 2.9 | UI close-out audit | 2 | XS | Done `6c32b22` — Slices 2.1–2.8 verified with no open gaps; lint; 259 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 43/43; dialog/theme/filter/nav browser checks |
| 3.1 | WorkspaceRoute drawer/context extraction | 3 | M | Done `01eb811` — `WorkspaceRoute` 3,430→2,800; responsive drawer state/layout, focus restoration, context actions, system history, and UI selectors extracted; lint; 267 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 43/43 |
| 3.2 | WorkspaceRoute to <2,000 lines | 3 | M | Done `ef14984` — `WorkspaceRoute` 2,800→1,976; review refresh plus corkboard, scratchpad, export, memory, and status-block modal presentation extracted; lint; 267 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 43/43 |
| 3.3 | WorldBibleRoute to <2,000 lines | 3 | M | Done `b041561` — `WorldBibleRoute` 3,016→1,957; category rail, import workspace, record AI helper, character health, and entity list extracted; `useWorldBibleImports` unchanged at 1,631; lint; 267 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 43/43 |
| 3.4 | CharacterSheetsRoute to <2,000 lines | 3 | S | Done `5f0560d` — `CharacterSheetsRoute` 2,294→1,956; mutation form state, preview/replay derivation, and history orchestration extracted to a 273-line hook; pure command construction moved to the tested character service; lint; 271 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 43/43 |
| 3.5 | ESLint 10 group upgrade | 3 | M | Done `70cdf21` — ESLint 10.8 group landed across web, engine, and UI with quoted recursive globs; new core/enabled compiler findings resolved; 3 existing `exhaustive-deps` warnings unchanged; 77 findings across 3 compiler rules explicitly deferred for behavior-aware refactors; 271 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 43/43 |
| 3.6 | Vite 8 + plugin-react 6 | 3 | S | Done `df38e97` — Vite 8.2.1 + plugin-react 6.0.5; `@types/node` held at 24.10.11; native-loader-safe config; dev audit 36→30; lint; 271 web + 6 engine + 12 UI tests; web/desktop builds; dev server + Electron production shell; Cypress 43/43 |
| 3.7 | Cypress 15 | 3 | S | Done `8867c2b` — Cypress 15.20.0; binary verified; legacy `Cypress.env()` browser access disabled; CI cache/install flow retained; dev audit 30→29; lint; 271 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 43/43 across 9 specs |
| 3.8 | TypeScript 7 | 3 | M | Done `8611539` — TypeScript 7.0.2 builds in all four workspaces; TypeScript 6 compatibility API retained for `typescript-eslint`; legacy node resolution migrated; TypeScript 6 stable-ordering parity; lint with 3 baseline warnings; 271 web + 6 engine + 12 UI tests; web/desktop builds; unpacked desktop package; Cypress 43/43 |
| 3.9 | Dev-audit sweep + fitness close-out | 3 | S | Done `c8d7c78` — grade A; development audit 29→0 and production audit remains 0 via targeted overrides; all 5 architecture targets below 2,000 lines; lint with 3 baseline warnings; 271 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 43/43; [2026-08-07 report](archive/code-fitness-report-2026-08-07.md) |
| 3.10 | Move live state core into `rules-engine` (R1) | 3 | M | Done `90b64dd` — command/event types, schemas, ordering, application, replay baseline, replay, and ruleset validation in `packages/rules-engine/src/manuscript/`; web re-exports, persistence stays in web; replay parity digest (harness `b71a976`) reproduced exactly; web Vitest resolves the package from src (`extends: true` fix, proven by a planted-bug check); lint 1 baseline warning; 730 web + 14 engine + 12 UI tests; builds; Cypress 108/108 (one intermittent stat-peek failure under load, passed on rerun) |
| 3.11 | Rules-engine hygiene + typed rules (R2) | 3 | S | Done `3c93743` — restricted mathjs (9 functions disabled in formulas); `rules` typed by `GameRuleSchema` with invalid rules quarantined on save, project schema 7, and snapshot schema 9, noted on the Ruleset route; `StateManager` + wall-clock state in non-exported `experimental/`; triggered rules stop at one level; engine tests 14→47; plan archived; lint; 765 web + 47 engine + 12 UI tests; web/desktop builds; Cypress 117/117 |
| 3.12a | Provider credential + endpoint hardening | 3 | M | Done `8e1df38` — keys in a main-process `safeStorage` vault (fails closed), IPC status/set/clear only, startup migration from `localStorage`; all providers incl. Gemini run in main, which rejects renderer keys and enforces the provider address policy; packaged CSP meta + dev CSP header; `will-navigate` guard; Settings never shows saved keys; desktop lint + 19 tests in CI; lint; 776 web + 47 engine + 12 UI + 19 desktop tests; builds; Cypress 116/117 full run (stat-peek palette case 2/2 in isolation under load); real-Electron CSP and main-process checks |
| 3.12b | Private-local AI classification | 3 | M | Done `29ec407` — one route classifier for disclosures and budget; private-local only for loopback Ollama with an installed, non-cloud model; cloud/remote/missing/unverified fail closed; main and browser Ollama verify the model before sending and auto-pick only local models; remote Ollama stays blocked (author decision); lint; 786 web + 47 engine + 12 UI + 24 desktop tests; builds; Cypress 118/118 |
| 3.13 | Atomic canon acceptance | 3 | M | Done `0d7a54d` — `runProjectWriteTransaction` + per-store InTransaction writers; entity acceptance (canon, links, alias, proposal) and fact accept/supersede/remove each commit together; pure side-effect planners; real-IndexedDB rollback tests (fail without abort); lint; 797 web + 47 engine + 12 UI + 24 desktop tests; builds; Cypress 118/118 |
| 3.14 | Hotspot freeze + editor/workspace extraction | 3 | M | Done `9756578` — `pnpm check:file-sizes` CI gate with recorded baseline (9 files over 1,500); EditorWithAI 1,636 → 1,285 (`useEditorStatPeek` + `EditorStatPeekLayer`); WorkspaceRoute 2,294 → 1,873 (review and Add to World popovers extracted); character lab and stat pin storage behind owning hooks; World Bible category load race merged instead of overwritten; lint baseline; 827 web + 47 engine + 12 UI + 24 desktop tests; web/desktop builds; Cypress 119/119 |
| 3.15 | Dependency advisory sweep + CI audit gate | 3 | S | Done `b636915` — production audit 12→0: TipTap 3.31.4 with ProseMirror pins raised to match; sharp 0.35.5, adm-zip 0.6.1, qs 6.16.0 overrides; express/cors dev-only; `web-verify` fails on high production advisories; lint; 763 web + 14 engine + 12 UI tests; web/desktop builds; Cypress 117/117 |
| 3.16 | Split `useWorkspaceConsistency` by responsibility | 3 | M | Done `2a9aa0e` — 2,234-line hook now a 450-line composer over seven responsibility hooks (none over 600) plus two tested pure services; same return shape, callers unchanged; baseline 8 files; lint baseline; 850 web + 47 engine + 12 UI + 24 desktop tests; web/desktop builds; Cypress 126/126 |
| 3.17 | Centralize assistant request policy | 3 | M | Done `aa500ea` — shared provider readiness, route disclosure, consultation guard/accounting, streaming/Stop, and error boundary for Workspace and Ask; deterministic factual answers spend zero; hosted runs record `assistant`, coach records `writing-coach`, and private-local retains its runaway guard; AIAssistant 858→827 lines; lint baseline; 858 web + 47 engine + 12 UI + 24 desktop tests; web/desktop builds; file-size gate; Cypress 132/132 |
| 3.17a | Project deletion integrity + retrieval upgrade repair | 3 | S | Done `ef332ac` |
| 3.18 | Lower the size freeze to 1,000 lines | 3 | XS | Done `e1a7964` |
| 3.18a | Change-aware CI + verification policy | 3 | S | Done `2ab0cb6` — full remote coverage 149/149 without retries in three groups |
| 3.19 | Undefined theme token + hardcoded editor colors | 3 | XS | Done `dbbd86e` — shared theme tokens and undefined-variable regression coverage; light/dark review; full Web CI including `cypress-smoke` green (run 39273413648, batch PR #59) |
| 3.20 | Compendium form extraction | 3 | M | Done `972dd00` — route 1,540→951 lines, focused form hooks and tested parsing helpers; full Web CI including `cypress-smoke` green (run 39273413648, batch PR #59) |
| 3.21 | Scene-roster mutation services | 3 | M | Done `7a8010c` — hook 1,417→786 lines, pure item/timeline planners, service-owned types, 19 new tests; 999 web + 47 engine + 12 UI + 24 desktop tests; full remote Cypress 149/149 without retries; `cypress-smoke` green (run 39273413648, batch PR #59) |
| 3.21a | zod 4 advisory upgrade + debug-log cleanup | 3 | S | Done `04145d9` — zod 3.25.76→4.6.7 in web, engine, and UI; production audit 1 high→0; single-arg `z.record` given string keys; stray `categoryStorage` debug log removed (engine logs are opt-in and kept); replay-parity digest re-recorded after a diff showed only zod error-message wording changed; quarantine-message test updated; lint 1 baseline warning; 999 web + 47 engine + 12 UI + 24 desktop tests; web/desktop builds; local Cypress 149/149 without retries; `cypress-smoke` green (run 40085789805, PR #60); dev-only audit has 89 existing advisories (not gated; follow-up) |
| 3.21b | Electron runtime + dev advisory sweep | 3 | S | Done `24fc435` — Electron 43.2.0→43.8.3 (12 advisories, 5 high, all fixed in-major); Vite 8.3.5 and Vitest 4.1.12 within range; override floors raised for xmldom, body-parser, brace-expansion 1/2/5, fast-uri, js-yaml and added for @humanfs/node, browserslist, source-map-js, undici 6/7/8; full audit 89→1 (`http-cache-semantics` via electron-builder download path, no patched release), production audit 0; lint 1 baseline warning; 1,053 web + 47 engine + 12 UI + 24 desktop tests; web/desktop builds; unpacked desktop package launches on Electron 43.8.3; local Cypress 152/152 without retries; `cypress-smoke` green (run 40091695222, PR #62) |
| 3.22 | Characterization tests for untested domain modules | 3 | M | Done `4e8fec9` — 31 compendium characterization tests (18 storage on fake IndexedDB, 13 mechanics), checked by five planted regressions; `compendiumService.ts` (1,232) split into `compendiumMechanics`, `compendiumStorage`, `compendiumWorldStorage` behind the unchanged index; `useWorkspaceStatBlocks` 1,074→546 over `statBlockResolution` (20 tests), `useStatBlockPreferencePersistence`, `useStatBlockRebind`; `useWorldBibleEntityActions` 1,125→429 over `worldBibleEntityPlans` (9 tests), `useWorldBibleMergeActions`, `useWorldBibleLinkActions`; no hook over 600; size baseline 13→10; lint 1 baseline warning; 1,113 web + 47 engine + 12 UI + 24 desktop tests; web/desktop builds; local Cypress 152/152 without retries; `cypress-smoke` green (run 40093325242, PR #63) |
| 3.23a | One storage layer + import guard | 3 | M | Done `1ff729b` — IndexedDB reached only through `services/storage/`: 11 root repositories, the service repositories, and `db.ts` moved under their own names (31 files incl. tests); one `idbRequest.ts` replaces 12 `requestToPromise` copies; character import, item-state authoring, identity resolution (pure planner inside a storage transaction), and the separate rulesets database now persist through storage; the index exports repositories and store names, not `openDb`; ESLint blocks deep storage imports and `indexedDB` outside the folder (tests excepted); no schema change or new stores; planted regressions in the extracted identity and item-state writes caught; bundle chunks unchanged; lint 1 baseline warning; 1,116 web + 47 engine + 12 UI + 24 desktop tests; web/desktop builds; local Cypress 152/152 without retries (backup round-trip in `post-merge-smoke`, canon in `canon-decisions` and the J-suite; manual smoke procedures not run by hand); `cypress-smoke` green (run 40095897501, PR #64) |
| 3.23b | Project-scoped IndexedDB indexes | 3 | M | Done `5c70ff9` — `DB_VERSION` 28→29 adds a non-unique `projectId` index to every project-scoped store plus migration backups (world canvases and review runs keep their unique index); the upgrade only adds indexes, records unchanged; one `getAllByProject`/`readProjectRecords` reader (a missing project id reads nothing, since `index.getAll(undefined)` returns everything); every `…ByProject` getter plus the backup, snapshot, and migration readers and the replace-by-project writes read through the index; same order (primary key) and contents; real-IndexedDB test opens a populated v28 database, upgrades it, and checks indexes, every record, and getter results, with two planted regressions caught; backup and snapshot formats, migration chain, and snapshot `schemaVersion` unchanged; lint 1 baseline warning; 1,120 web + 47 engine + 12 UI + 24 desktop tests; web/desktop builds; local Cypress 150/152 in the full run without retries, the two `ask-project` failures being its fault injection patching only `IDBObjectStore.getAll` — it now patches `IDBIndex.getAll` too and the spec passes 8/8; `cypress-smoke` green (run 40105610919, PR #65) |
| 3.23c | Browser-storage preferences + mechanics draft | 3 | S | Done `60ef863` — unfinished first-mechanics draft moved from `localStorage` into a project-scoped `mechanics_drafts` store (`DB_VERSION` 29→30, snapshot `schemaVersion` 9→10, older backups import with no drafts); survives reload, round-trips through backup under rewritten ids, removed on cancel, setup, or project delete; writes queued in call order so a late save cannot revive a cancelled draft; legacy `wbd:first-mechanics:*` keys migrate once and are removed; collapsed rails (Corkboard, World Bible, Lore), Source Note starter, and recent commands share `utils/browserPreferences.ts` and `useCollapsedPreference` with unchanged keys; remaining browser-storage keys inventoried for 5.15 in `docs/architecture-review.md`; two planted regressions caught; lint 1 baseline warning; 1,135 web + 47 engine + 12 UI + 24 desktop tests; web/desktop builds; local Cypress 152/152 without retries (backup smoke now carries a draft); manual smoke step 1.6 not run by hand; `cypress-smoke` green (run 40107560277, PR #66) |
| 3.24a | Backup import collision guard | 3 | S | Done `76cb95a` — before any write, import checks every id it keeps (23 collections, the settings record, and the ruleset in its separate database) and refuses with a plain explanation, writing nothing, when an id belongs to another project in this browser; new-project import and merge into a different project are blocked, restoring into the source project is allowed; the Projects preview shows the block and disables `Apply Import`; a typed table classifies every snapshot collection so a new one cannot skip the check; 6 tests on fake IndexedDB (new, merge-into-other, restore, another-computer import, ruleset, coverage), one planted regression caught; the backup smoke test now asserts the block, then clears the source as if on another computer before the round trip (it had passed only because import moved the source's records); snapshot format unchanged; lint 1 baseline warning; 1,141 web + 47 engine + 12 UI + 24 desktop tests; web/desktop builds; local Cypress 152/152 without retries; manual smoke step 1.3 not run by hand; `cypress-smoke` green (run 40109137734, PR #67) |
| 3.24b | Backup import id remapping | 3 | L | Done `8a73bf9` — a new-project import gives every kept id (23 collections, settings, ruleset) a new id through one map, then rewrites every string and object key in the backup through it, so references in any field follow; derived ids keep their shape (`settlement:<project>:global`, `ruleset:<project>`); only full UUIDs are replaced inside longer strings; ruleset definition ids untouched; merge remaps only ids that belong to another project, with ids derived from the target and old id so a repeat merge updates in place; restore changes no ids and no longer duplicates aliases (also actor resolutions and identity reports); the 3.24a refusal stays as a safety net, and the preview now says when an import makes a copy; `data-lore-id` turned out to be an editor decoration, not saved scene content; 7 tests (copy in the source browser, three independent projects, merge twice, restore, id-map rules, text and key rewriting, stable ids), including a scan that no kept source id survives anywhere in a copy; two planted regressions caught; backup smoke now copies within the same browser and follows references; snapshot format unchanged; lint 1 baseline warning; 1,148 web + 47 engine + 12 UI + 24 desktop tests; web/desktop builds; local Cypress 152/152 without retries; manual smoke step 1.3 not run by hand; `cypress-smoke` green (run 40110565536, PR #68) |
| 4.1 | Description-first manual item creation | 4 | S | Done `70fb72f` — focused manual item draft with progressive full-editor disclosure; lint with 3 baseline warnings; 275 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 44/44; desktop/narrow browser checks |
| 4.2 | Storage schema versioning + migrations | 4 | M | Done `965af19` — separate IndexedDB, project-data, and snapshot schema contracts; ordered project-load migration runner with restorable pre-migration backups including rulesets; newer schemas fail closed before writes; 327 web + 6 engine + 12 UI tests; lint baseline; web/desktop builds; Cypress 47/47 |
| 4.3 | Internal package namespace rename | 4 | S | Done `1917611` — rules packages renamed to `@worldbuilding-desk/*` across manifests, imports, workspace scripts, Vite resolution, CI, lockfile, and active docs; local workspace links and generated artifacts contain no old scope; web/package lint; root test plus 357 web + 6 engine + 12 UI tests; web/desktop builds; Cypress not required (no routed UI change) |
| 4.4 | Character contract adoption (CX-1) | 4 | S | Done `c406b48` — stable-ID Character contract and migration invariants adopted in the domain authority; J1–J6 added to smoke coverage; superseded brief archived; lint baseline; 315 web + 6 engine + 12 UI tests; web/desktop builds |
| 4.5 | Character identity links + classifier + resolver (CX-2) | 4 | M | Done `48e634a` — explicit character/general category kinds and author control; entity links on extensions/sheets; schema-2 exact-unique legacy classifier with conserving report and persisted actor map; shared resolver adopted across character-aware surfaces; lint baseline; 332 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 47/47 |
| 4.6 | Backup + character-package completeness (CX-3) | 4 | M | Done `b7c4776` — snapshot schema 2 now conserves aliases, character links, actor mappings, and classifier reports; character package schema 2 round-trips canonical identity, aliases, facts, extensions, and optional sheets while schema-1 imports classify conservatively; replay parity retained; lint baseline; 338 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 47/47 |
| 4.7 | Character intake convergence (CX-4) | 4 | M | Done `ede3504` — canonical-first intake service now establishes or exact-uniquely links World Bible character identity before modern Character Tools writes; review capture uses explicit category kind; lore acceptance targets entities; World Bible handoffs persist explicit links; v2 packages reject broken claimed links; new sheets require canon while legacy unresolved records remain conservable; lint baseline; 346 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 48/48 |
| 4.8 | Character identity resolution queue (CX-5) | 4 | M | Done `74bee91` — World Bible review now surfaces tools-only, sheet-only, and ambiguous legacy identities for explicit link, canon-draft creation, or persisted keep-separate decisions; family links and actor mappings resolve atomically; unresolved records remain non-canon with visible badges; lint baseline; 354 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 49/49 |
| 4.9 | Sheet + state identity rebinding (CX-6) | 4 | M | Done `e6f2596` — new mutations use canonical entity actor IDs; replay resolves immutable legacy IDs through the persisted actor map; deterministic derivation has no name matching; linked sheet names derive from canon; one-sheet collisions are blocked and surfaced; lint baseline; 351 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 48/48 |
| 4.10 | Character capability routing (CX-7) | 4 | S | Done `e3ac404` — World Bible character detail routes dialogue style, sheet creation, and single-character export; Character Tools is narrowed to attached capabilities and legacy cleanup with canon-derived names and no independent identity/descriptive authoring; character-profile language retired; sheet-route load race fixed; lint baseline; 355 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 49/49 |
| 4.11 | Character identity dogfood addendum (CX-8) | 4 | M | Done `1fa4624` — importable v1 Tam-containment and legacy identity-matrix packages; exact classifier conservation and four-item queue contract tests; active smoke and trust-dogfood runbooks now script G1–G6 including mode gating, rename stability, both author-resolution branches, and rich backup round-trip; manual G1–G6 execution remains explicitly scheduled for 1.1; lint baseline; 357 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 49/49 |
| 4.12 | Sectioned World Bible character experience (CX-9) | 4 | L | Done `569b88b` — World Bible character detail now sections Canon, Notes, Continuity, project-gated Mechanics, and Writing aids; unsaved characters stay canon-focused; stable-ID resolver composition replaces the detail name join; alias conversion review timestamps remain settled; lint baseline; 360 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 49/49; desktop/narrow browser checks |
| 4.13 | Retire the separate Character Tools destination (CX-10a) | 4 | M | Done `0354b09` — removed the Character Tools roster/hub UI; `/characters` is compatibility-only; dialogue style and single-character export live in World Bible; `/sheets` owns contextual sheet/state work; batch v1/v2 transfer lives under `More`; legacy resolution/adapters preserved; lint with 3 baseline warnings; 361 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 49/49; desktop/narrow browser checks |
| 4.14 | Mechanics first-use journey and complexity audit | 4 | S | Done `5c09713` — fresh LitRPG desktop/narrow walkthrough plus route/service trace inventoried prerequisites, overlapping entry points, jargon, context loss, duplicate-sheet success warning, and advanced controls; 4.15 basic-path contract and seven-case manual smoke authority defined; docs diff check clean |
| 4.15 | Progressive mechanics experience | 4 | L | Done `f378a14` — one-value World Bible setup creates a minimal ruleset plus canon-linked sheet as one confirmed rollback-safe operation; character and active-scene changes use plain language, replay preview, explicit confirm, current-value replay, and source-scene return; advanced Rules, Sheets/State, compendium/progression/settlement, transfer, and memory controls remain available behind deliberate reveals; general fiction unchanged; lint with 3 baseline warnings; 367 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 50/50; desktop/narrow browser checks |
| 4.16 | Prose-proximate item and state authoring | 4 | L | Done `bf45420` — acquisition and consumption prose now opens one author-confirmed Workspace proposal; state-only acquisition default; optional reusable canon/effect records; stable item links; exact/ambiguous resolution; missing-inventory branches; stale-source rejection; atomic proposal supersession; general-fiction containment; full verification and desktop/narrow smoke |
| 4.16a | Stable item references + atomic orchestration | 4 | M | Done `70c9b6b` — optional stable World Bible/Compendium inventory references; reference-aware replay and resolved labels; project/snapshot schema 3; exact/ambiguous resolver; validated atomic three-store writer; lint baseline; 370 web + 6 engine + 12 UI tests; web/desktop builds |
| 4.16b | In-workspace acquisition proposal | 4 | M | Done `6663bea` — selection prose derives acquisition/item/actor; Workspace modal defaults state-only and offers explicit exact link or new canonical item; atomic save; responsive themed disclosure; lint baseline; 376 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 50/50 |
| 4.16c | Consumption effect authoring + prose integration | 4 | L | Done `bf45420` — approved effects prefill without silent rewrites; first use supports explicit remembered effects; combined replay preview; absent-inventory choices; deterministic Review proposals reopen in the same editor flow and are atomically superseded; source-hash guard; lint with 3 baseline warnings; 381 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 53/53; desktop/narrow browser checks |
| 4.17 | Craft library retrieval infrastructure | 4 | M | Done `6296e42` — separate read-only provider and vetted-content package; `craft` metadata with labeled provenance; versioned content/embedding contracts and checked-in build asset; compatible hybrid retrieval with unavailable/incompatible-model lexical fallback; project RAG rejects craft input; lint with 1 baseline warning; 423 web + 6 engine + 12 UI tests; web/desktop builds |
| 4.18 | Craft library content — tranche 1 | 4 | M | Done `eeac6da` — eight Batch-1 records explicitly approved by the author on 2026-09-06; 97 embedded chunks in content version `1.0.0-tranche-1`; allowlisted promotion tooling prevents approval spillover; source/catalog and runtime-schema validation, bundled retrieval, labeled provenance, and safe citation rendering covered; lint with 1 baseline warning; 436 web + 6 engine + 12 UI tests; web/desktop builds |
| 4.18a | Craft library content — tranche 2 (full corpus) | 4 | S | Done `658cb86` — all 166 author-vetted working records published as content version `2.0.0-tranche-2` (2,136 chunks), superseding the tranche-1 subset; working `document_type`/`source_confidence` values mapped to the runtime contract; generated bundle moved to a `.json` data file with a stable loader after TypeScript's structural checker overflowed on the full-size inline literal (TS2590); lint with 1 baseline warning; 436 web + 6 engine + 12 UI tests; web/desktop builds |
| 4.19 | Derived story dashboard | 4 | L | Done `e936852` — read-only Corkboard dashboard for scene/chapter word and quoted-dialogue counts, accepted-change distribution, and mechanics-only axis co-movement plus explicit advancement rates/intervals; all observations cite source scenes; stable Chapter Card links use project/snapshot schema 4 with no inferred matches; general fiction hides mechanics; lint with 1 baseline warning; 429 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 61/61 |
| 4.20 | Writing coach experience | 4 | L | Done `4e1515c` — inline ask (selection or open scene) and a Story Dashboard section (manuscript-wide, deterministic measurements only, never raw prose) both implemented, pairing cited craft-library material with given evidence; author-triggered, shares the project's AI-consultation budget; save-as-Source-Note follow-up reuses 1.5; craft library now loads via dynamic import to keep it out of the main bundle; lint with 1 baseline warning; 452 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 62/63 (one confirmed-unrelated pre-existing flake) |
| 4.21 | System negative-space records | 4 | S | Done `603c61f` — mechanics-only built-in World Bible records with author-maintained status and stable scene links; deterministic counts and source navigation make no semantic prose claims; project/snapshot schema 5; general fiction unchanged; lint with 1 baseline warning; 432 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 62/62 |
| 4.22 | Progression continuity candidates | 4 | M | Done `1adaff0` — new Story Dashboard section shortlists unused-priority-ability and abandoned-advancement-method candidates deterministically; author-triggered, scene-cited, model-assisted verdict via a position-anchored tag; per-project localStorage dismissal (no new IndexedDB store); lint with 1 baseline warning; 472 web + 6 engine + 12 UI tests; web/desktop builds |
| 4.23 | Continuity review regression corpus | 4 | S | Done `1763153` — 13 verbatim fixture/sample cases through the real extraction, validation, and contradiction path; 7/7 planted findings matched, 0 noise, 0 mislinks; one `knownGap` (speaker-attributed second-person eye-color claim) recorded as 4.24's first target; harness reports MISSED/NOISE/MISLINK/FALSE CONFLICT/HEALED; no behavior change; lint with 1 baseline warning; 536 web + 6 engine + 12 UI tests; web/desktop builds |
| 4.24 | Fact-anchored canon contradiction detection | 4 | M | Done `ffcd1bd` — eye-color special case replaced by slot comparison anchored on accepted facts (noun + modifier, or number); only linguistic value classes (colors, numbers, negation) are built in, other classes are learned from the author's own canon; per-claim speaker-aware attribution healed the 4.23 `knownGap`; corpus 19 cases, 12/12 hits, 0 noise; lint with 1 baseline warning; 548 web + 6 engine + 12 UI tests; web/desktop builds |
| 4.25 | Persisted, incremental project review | 4 | M | Done `d6e5ddd` — new project-scoped `project_review_runs` store (DB 27, not in backups by design); per-scene content hashes plus an inputs hash reuse unchanged scenes and their local-AI annotations while contradictions always recompute (40-scene check: 383ms → 47ms); the drawer restores the last run on reload and marks items whose scene changed since; dismissals persist; Cypress seed now shares the app's `upgradeDatabase`, and conflict spans are sliced verbatim with a corpus anchor check; lint with 1 baseline warning; 553 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 79/79 |
| 4.26 | State-backed continuity checks | 4 | M | Done `bd255cd` — mechanics-only project review now emits warning-level, earlier-scene-cited custody, equipment, static-location, and invalid-mutation findings from accepted scene-ordered state; assistant and review share the custody walk; general fiction remains unchanged; lint with 1 baseline warning; 567 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 79/79 |
| 4.27 | Sheet-free descriptive state for general fiction | 4 | L | — post-beta candidate because it expands state ownership and persistence beyond sheets/rulesets; descriptive location/custody for canonical characters, not required by mechanics-only 4.26 |
| 4.28 | Manuscript-order validity for canon facts | 4 | M | Done `42c86de` — accepted facts carry optional stable from-inclusive/until-exclusive scene links resolved against live manuscript order; missing boundaries fail closed; Canon Decisions supersedes at an author-selected scene while preserving both facts; contradiction review, progression continuity, RAG, and local-memory grounding filter by scene and cited history states its window; project/snapshot schema 6 with lossless migration and character-package boundary stripping; lint with 1 baseline warning; 561 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 79/79 |
| 4.29 | Portable Markdown/CSV export + Markdown-folder import | 4 | M | Done `7cd6895` — versioned human-readable ZIP with World Bible Markdown/YAML, per-category CSV, Source Note Markdown, and included/open schema docs; reviewed Obsidian-style folder import stages Source Notes or incomplete World Bible drafts with opt-in wikilink actions and no accepted-fact writes; lint with 1 baseline warning; 570 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 80/80 |
| 4.30 | World Canvas — record, view mode, premise, lenses, questions (WC-1) | 4 | M | Done `f9f3e54` — optional non-canon premise, seven author-opened freeform lenses, and editable question/status list; debounced project persistence with DB 28; snapshot schema 7 migration and new-project backup parity; excluded from canon, extraction, and retrieval; lint with 1 baseline warning; 578 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 82/82 full pass, followed after final Canvas-only layout correction by 81/82 with the unrelated portable-data timing case passing 1/1 in isolation and World Canvas 2/2; desktop/780px browser checks |
| 4.31 | World Canvas — bridges to Source Notes and World Bible (WC-2) | 4 | S | Done `53d7803` — provenance-marked manual Source Notes with normal RAG indexing; link/unlink existing notes and World Bible records with current-name and missing-target chips; prefilled normal canon create form with post-save canvas backlink; question answer links/status; lint with 1 baseline warning; 581 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 83/83; manual review completion and 780px check |
| 4.32 | World Canvas — derived return experience (WC-3) | 4 | S | Done `eb305e7` — read-only per-lens record/Source Note summaries for opened and unopened lenses; unmapped custom categories under Other records; capped project-scoped dismiss/restore Worth a look rules for author-review records, missing Source Note links, questions open over 30 days, and review candidates with direct navigation; no scores or automatic resolution; mechanics-only records excluded for general fiction; lint with 1 baseline warning; 585 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 84/84; manual 780×900 check |
| 4.33 | World Canvas — author-invoked brainstorming (WC-4) | 4 | M | Done `6fd31ae` — **Ask for tensions and questions** on the premise and each opened lens; sends authored canvas text plus World Bible names/aliases only (never Source Note text) under an exploratory-not-canon framing; one `canvas-brainstorm` budget unit per click; zod-validated 1–12 items ≤280 chars, a bad reply is rejected whole; per-item Keep as Source Note (provenance-marked, lens-linked) / Add as question (non-question items only after an author rewrite; `origin: 'brainstorm'` badge) / Dismiss. Deviations: unreviewed ideas are kept in memory across in-app navigation, because `BrowserRouter` has no `useBlocker`; replace/discard asks first and reload/close prompts. Repeat requests list ideas already shown, which also avoids the `LLMService` cache. Lint with 1 baseline warning; 635 web (+24) + 6 engine + 12 UI tests; web/desktop builds; Cypress 91/91. **Manual disclosure-wording check in both themes still outstanding** |
| 4.34 | World Canvas — purpose, Planning IA, guided focus, lens collapse (WC-5) | 4 | M | Done `47559cd` — Canvas and Corkboard are sibling Planning tools; dedicated `/world-canvas` route; Core Idea wording over the compatible `premise` field; Inhabitants and societies lens; progressive non-AI guidance; lossless persisted collapse/reopen; flattened saved-material summaries removed while link/derivation services remain; onboarding and authority docs updated; original prompt/plan archived. Lint with 1 baseline warning; 659 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 93/93 plus final Canvas 9/9 and onboarding 3/3 reruns; manual narrow navigation/rail check |
| 4.34a | World Canvas — repeatable lens sketches, Open Threads, and Core Idea bridges (WC-6) | 4 | L | Done `548469d` — Canvas schema 2 and snapshot schema 8 migrate every legacy lens note/link/timestamp into a stable first sketch and reinterpret question statuses losslessly; autosaved composers now produce explicitly routed, reopenable sketch histories; Open Threads accept question/statement forms with Settled/Set aside history; Core Idea and sketches bridge to provenance-marked Source Notes and the normal author-selected World Bible form; Worth a Look and age/missing-link defect rules removed while owning review surfaces remain. Post-use checkpoint: ordinary concept/setting anchors are sufficient; no World Foundation owner before 4.34b. Lint with 1 baseline warning; 658 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 95/95; manual desktop/780px check. |
| 4.34b | World Canvas — Reference Palette foundation (WC-7) | 4 | M | Done `8428925` — separate pinned references from deterministic suggestions with stated category/note-kind/record-link rules; existing stable Canvas links supply pins, live rename and stale deletion states remain explicit, custom material stays in a separate browse area, general-fiction suggestions filter mechanics-only categories, and pin/unpin/open never changes canon or model context. Lint with 1 baseline warning; 665 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 95/96 full suite with the known portable-data timing case passing 1/1 in isolation, plus final Canvas 12/12; manual narrow light/dark blank and populated palette check. |
| 4.34c | World Canvas — craft-guided coaching (WC-8) | 4 | M | Done `7e486f2` — optional focus, deeper-question, central-tension, and clearer-wording actions retrieve applicable author-vetted craft chunks for only the focused Canvas text; author-selected Palette context discloses World Bible names/aliases or Source Note titles only and stays separate from craft citations; whole-response schema and expected-kind validation fail closed; the shared preview preserves current text until explicit confirmation, with a stale-text guard and no direct model write; shared streaming/Stop and `canvas-coach` budget accounting retain the local Ollama exemption. Lint with 1 baseline warning; 673 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 99/99, including World Canvas 15/15; manual 780px light/dark disclosure and layout check. |
| 4.35 | Corkboard scene links — shared link UI, quick-modal links, "Link current scene", stale links (CB-1) | 4 | S | Done `1087766` — shared explicit-id helpers and one shared scene-link component now serve the dedicated route and quick Workspace modal; compact chips cap at three plus overflow, current-scene link/unlink provides status and toast feedback, native Manage links exposes the full checklist, missing scenes stay visible and removable, and route links open their scenes without introducing title/order inference or direct persistence paths. Backup coverage now verifies exact scene-link ids through export/import, and obsolete Corkboard graduation docs were reconciled. Lint with 1 baseline warning; 679 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 101/101; manual desktop and 780px modal check. |
| 4.36 | Corkboard scene links — "Create linked scene" from both surfaces (CB-2) | 4 | S | Done `d4c5e78` — both the quick modal and dedicated route hand off to the existing Workspace scene owner, derive the accepted card-based title, select and focus the normal empty scene, then persist an explicit card link; route requests wait for card hydration, and a failed link never rolls back manuscript creation, instead exposing an idempotent Link now retry. Cypress creates from both surfaces, reloads, reopens from the card, verifies dashboard inclusion, and retains the existing autosave/selection/scroll continuity path. Lint with 1 baseline warning; 683 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 103/103. |
| 4.37 | Corkboard scene links — chapter-card context line in Workspace (CB-3) | 4 | S | Done `35d99a4` — linked scenes now show chapter-card context beneath the Workspace title; one card opens the quick modal scrolled to its focused title, several cards expand into compact chips, and the dedicated Corkboard handoff selects the requested card once after hydration. Lookup uses explicit scene ids only; no persistence or schema change. Lint with 1 baseline warning; 687 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 104/104; manual 780×900 light/dark header check. |
| 4.38 | Model-assisted canon check (author-triggered, via 1.5) | 4 | M | Done `da6b584` — **Check this scene against canon** in the review drawer sends one scene (≤12,000 chars) and accepted valid-at-scene facts for entities it names; strict parse; candidates must cite a sent fact and quote the scene verbatim, discards counted; previewed via the 1.5 surface and queued only on confirmation as dismissible model-assisted `STATE_CONFLICT` warnings (session-only, dropped when the quote leaves the scene); `canon-check` budget; 3 corpus `modelCheckTargets` measured separately; lint baseline; 843 web + 47 engine + 12 UI + 24 desktop tests; web/desktop builds; Cypress 126/126 |
| 4.39 | AI consultation budget model + point-of-use explanation | 4 | M | Done `ac84793` — (a) guards runaway loops and surprise spend, never rations deliberate work; (b) one per-project budget with a per-feature record; (c) **author signed off: local Ollama is exempt**, with a separate 200/day runaway guard; (d) every spending action states cost and remainder beside its own button, and an over-budget author adds units for today in place rather than going to Settings. Day boundary moved from UTC to the author's local midnight. Storage moved from per-project-per-day `localStorage` keys (never cleaned up) to one `inspectorBudget:<projectId>` ledger, migrating today's legacy count and sweeping the stale keys. Settings gains the reset time and today's per-feature breakdown. Lint with 1 baseline warning; 611 web (+26) + 6 engine + 12 UI tests; web/desktop builds. Cypress run locally: `cypress/e2e/consultation-budget.cy.ts` (4 specs: point-of-use display, over-budget + in-place grant, local exemption, Settings breakdown) passes after a spec fix to open the collapsed AI Settings section and advanced settings; full suite otherwise green |
| 4.40 | Local model runs: no response cap, visible thinking, elapsed time, Stop | 4 | L | Done `1749c8f` — one shared run (`useModelRun` + `ModelRunProgress` + `splitModelOutput`) behind the assistant, both coaches, progression continuity, canon decisions, and brainstorming: phase, elapsed time, live collapsible thinking, Stop, and "Show thinking" for the latest reply (never saved or sent back); answers never contain `<think>` text. Local runs send no cap and no longer force thinking off; hosted keep the cap (4.41). Stop cancels the provider request in desktop through a new `llm:stream:cancel` IPC. Real-model check with no cap: qwen3.8 10 ideas in 5:05 (thinking visible from 16 s), writer 10 in 6:34. Lint with 1 baseline warning; 655 web (+12) + 6 engine + 12 UI tests; web/desktop builds; Cypress 93/93 |
| 4.41 | Hosted response limits as a cost ceiling (plan, then build) | 4 | M | Done `910b7a0` — dated maintained exact-model price table and Settings response-only ceiling (including the 1,500-token structured-reply floor); unknown models never get guessed prices; Anthropic thinking stays off, OpenAI reasoning uses low effort plus `max_completion_tokens`, Gemini applies model-family allowances; all hosted adapters detect cap stops and discard incomplete streamed or ordinary replies with an actionable limit message; Gemini fallback updated to 2.5 Flash-Lite. Lint with 1 baseline warning; 696 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 104/104. [Plan](archive/hosted-response-limits-plan-2026-09-24.md). |
| 4.42 | Character voice contract (CL-1) | 4 | S | Done `b69a76f` — read-only `buildCharacterVoiceContext` (link resolver; canon record + aliases, accepted facts valid at the position with non-accepted source proposals excluded, dialogue style, `buildCharacterSnapshot` state labelled as not-knowledge) and shared `buildCharacterVoicePrompt` (talk, reaction, scene, generation; context embedded in the system prompt because Ollama ignores `LLMRequest.context`); no UI; lint with 1 baseline warning; 742 web + 14 engine + 12 UI tests; web/desktop builds |
| 4.43 | Talk to a character + reaction test (CL-2) | 4 | M | Done `1e9c79a` — `CharacterLabDialog` from the World Bible character page (latest) and the Workspace drawer Characters tab (cursor in current scene); Talk and Reaction test over the 4.42 contract with adjustable story point, stat card from the same snapshot, and a Grounded-in list; shared run/Stop, `character-lab` budget (Ollama exempt), provider disclosure, no cache; session transcripts; Save to Scratchpad via transactional `appendToScratchpad` that keeps open scratchpad editors in step; no canon/state/manuscript writes; lint with 1 baseline warning; 747 web + 14 engine + 12 UI tests; web/desktop builds; Cypress 111/111; manual 780px light/dark check |
| 4.44 | Character scenes, 2–3 characters (CL-3) | 4 | M | Done `9b5e7b6` — `CharacterSceneDialog` from the Workspace drawer Characters tab: 2–3 characters at a story point (default cursor), Directed setup or Surprise me from chapter cards linked to the chosen scene plus up to six newest open Canvas threads (listed before sending); only chosen characters' grounding sent; Save to Scratchpad (draft-marked, records setup/seeds) and Insert at cursor via the existing undoable pending-insert path; shared `StoryPointPicker` and provider helpers; lint with 1 baseline warning; 751 web + 14 engine + 12 UI tests; web/desktop builds; Cypress 112/113 full run (stat-peek timing case under load, 4/4 in isolation), character-lab 5/5 |
| 4.45 | Character from a rough description (CL-4) | 4 | M | Done `3a542cf` — **Start from a description** on World Bible Characters; strict JSON reply with whole-reply rejection, description-contained names only, and quote-verified stable facts as evidence spans; explicit accept creates a Needs-completion draft entity (empty fields), a linked Source Note with description + kept suggestions, and proposed facts in normal review (accept → canon verified); name/alias collisions require Add to existing (no merge) or Create separate; lab contract folded into domain model §5 and blueprint; lint with 1 baseline warning; 759 web + 14 engine + 12 UI tests; web/desktop builds; Cypress full run green after the guardrail assertion update (character-lab 8/8, guardrails 8/8) |
| 4.46 | Character snapshot service + shared stat card (SP-1) | 4 | S | Done `e9a7017` — pure `characterSnapshot` service (scene opening/cursor/ending or latest, ordered change diff, compact summary) and shared `CharacterStatCard`; scene roster and editor hover card adopted with byte-identical output and markup; lint with 1 baseline warning; 710 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 104/104 |
| 4.47 | Stat peek from the editor and command palette (SP-2) | 4 | M | Done `c94356f` — Cmd/Ctrl+Alt+S and right-click Show stats on a name or alias in Workspace (shared names ask); hover card uses the same card; palette Show stats for… on every route (Workspace peeks at the cursor, elsewhere latest); cards follow stat-block style and scope; all gated on game systems; lint 1 baseline warning; 725 web + 6 engine + 12 UI tests; builds; Cypress 107/107 (commit message says 111 from a double-counted stalled run) |
| 4.48 | Pinned stat panel across writing and brainstorming (SP-3) | 4 | M | Done `f1b4831` — up to three pins from peek, palette, roster, or World Bible in a collapsible app-shell panel on Workspace, World Canvas, Corkboard, World Bible (above Scratchpad); follows the cursor in Workspace, latest or end of a chosen scene elsewhere; changes since previous chapter via Corkboard links; Open sheet; per-project UI pins, not in backups; mobile bottom sheet; lint 1 baseline warning; 735 web + 6 engine + 12 UI tests; builds; Cypress 108/108 |
| 4.49 | Local Ollama runs receive project and craft context | 4 | S | Done `003a2dc` — widened on start: context also never reached any desktop-app provider except Gemini; one shared `[Source: label]` formatter for hosted adapters, the renderer Ollama adapter, and the Electron request builder (IPC surface and cache key unchanged); lint with 1 baseline warning; 763 web + 14 engine + 12 UI tests; web/desktop builds; Cypress 117/117 including a local-Ollama coach case that fails without the fix |
| 4.50 | AI text provenance mark (AD-1) | 4 | M | Done `a6197d6` — `aiText` mark with provenance on assistant revisions (model replies only) and character-scene inserts, applied in the insert transaction; Mark as my writing; Show/Hide AI text (on by default, changed from "off once seen"); exports plain text; invisible-character normalization; lint; 807 web + 47 engine + 12 UI + 24 desktop tests; build; Cypress 118/119 (stat-peek palette flake 2/2 in isolation); light/dark screenshots |
| 4.51 | AI text report (AD-2) | 4 | S | Done `1f80e78` — Workspace scene drawer **AI text report**: marked words and passages per scene and by feature and provider (with models), open scene read as edited, plain-text Copy report, platform-neutral notes; lint baseline; 824 web + 47 engine + 12 UI + 24 desktop tests; web/desktop builds; Cypress 119/119 |
| 4.52 | Opt-in AI scene drafts (AD-3) | 4 | M | Done `bf8eecb` — per-project **Allow AI scene drafts** (default off, not inherited, needs AI consultation); **Draft this scene** on scenes of ≤50 words in Workspace and from Corkboard linked scenes; visible editable inputs, character-lab grounding at scene start, disclosure, budget, Stop, 1,500-word cap in code; preview until marked undoable Insert or Save to Scratchpad; never writes canon, state, or records; lint baseline; 836 web + 47 engine + 12 UI + 24 desktop tests; web/desktop builds; Cypress 123/123 |
| 4.53 | Model-assisted review items in the shared review model | 4 | M | Done `b7ae00c` — canon check items in the shared review state: saved with the project review run (`modelCheckItems`), underlined, counted in the review indicator, kept through re-reviews and project runs while their quote remains, dismissal saved; session store removed; lint baseline; 851 web + 47 engine + 12 UI + 24 desktop tests; web/desktop builds; Cypress 124/127 full run (world-canvas renderer crash, 15/15 isolated) |
| 4.54 | Document import structure fidelity | 4 | M | Done `e7bef24` — Markdown `#` and DOCX heading styles (incl. Pages named styles/outline levels) detected; leading title heading kept as title; list/bold label rows mapped anywhere (Age; Occupation→Role); Markdown structure kept in rich fields; same-named sections append; all headings listed; Markdown list `</li>` fix; parsing extracted (hook 1,632→912 lines); checked on both real Echoes sheets (12/19 sections, Age, both Backgrounds kept); lint baseline; 869 web + 47 engine + 12 UI + 24 desktop tests; web/desktop builds; file-size gate; Cypress 132/132; `cypress-smoke` green (Web CI run 37793769544) |
| 4.55 | Import heading destinations | 4 | M | Done `0c6a6f9` — per-heading picker (Keep in Description, category fields by name, New field: <label> incl. fields planned by other headings/open drafts, Skip); destinations carry field key or planned label; open drafts reconcile when category fields change (batch carry-over) and apply reconciles too; stale field shows as Description; rename keeps choices; unsaved characters show custom fields; lint baseline; 881 web + 47 engine + 12 UI + 24 desktop tests; web/desktop builds; file-size gate; Cypress 134/134; `cypress-smoke` green (Web CI run 37793769544) |
| 4.56 | Multi-document import flow + category manager dialog | 4 | M | Done `8489786` — drafts keep waiting / imported (Open) / failed (reason, retry) status and are never imported twice; preview says nothing is saved until import and counts each state; Import selected (N); discarding unsaved drafts asks first; Import and open scrolls the record into view; Manage Categories is a modal (focus trap, Escape backs out of field editing then closes, closes on navigation, mobile bottom sheet above nav); WorldBibleRoute 2,229→2,202 lines; lint baseline; 890 web + 47 engine + 12 UI + 24 desktop tests; web/desktop builds; file-size gate; Cypress 137/137; `cypress-smoke` green (Web CI run 37793769544) |
| 4.57 | Source Note import fidelity + formatted display | 4 | M | Done `8da6811` — `.md` imports keep Markdown (legacy plain-text `.md` imports read as Markdown); DOCX → Markdown with heading styles, lists, bold/italic, and pipe tables (merged cells, multi-paragraph cells); formatted Content view by default with Edit Markdown, sanitized display HTML; renderer escaped-pipe/`<br>` cells and safe links; extraction reads Markdown label rows and headings; LoreRoute 1,829→1,814 lines; lint baseline; 905 web + 47 engine + 12 UI + 24 desktop tests; web/desktop builds; file-size gate; Cypress 138/138; `cypress-smoke` green (Web CI run 37965126082) |
| 4.58 | Source Note visual editor (Markdown-backed) | 4 | M | Done `d52065e` — dedicated TipTap editor (block style, bold, italic, tables) instead of the shared scene editor, whose toolbar offers code blocks/strike and emits HTML; loads through the display renderer and serializes to Markdown only on change (no-edit save byte-identical, undone edit restores original); plain-text notes convert to escaped Markdown on first edit; renderer backslash escapes and inline `<br>`; round-trip tests (canonical unchanged, other spellings normalize once); lint baseline; 917 web + 47 engine + 12 UI + 24 desktop tests; web/desktop builds; file-size gate; Cypress 139/139; `cypress-smoke` green (Web CI run 37965126082) |
| 4.59 | Remembered Markdown source view for Source Notes | 4 | S | Done `51cf694` — Settings → Reading & Editor "Source Notes open in" (Visual editor default / Markdown source), app-wide in localStorage with the other editor preferences; new, opened, and imported notes follow it; per-note switch stays per note, with "Always open notes this way" to remember it; lint baseline; 923 web + 47 engine + 12 UI + 24 desktop tests; web/desktop builds; file-size gate; Cypress 141/141; `cypress-smoke` green (Web CI run 37965126082) |
| 4.60 | Collapsible Source Notes intake panel | 4 | S | Done `3092929` — Hide intro / Show intro (`aria-expanded`) collapses to one row keeping Start Writing and Import File; remembered per browser (guarded localStorage); wraps on narrow screens; lint baseline; 918 web + 47 engine + 12 UI + 24 desktop tests; web/desktop builds; file-size gate; Cypress 139/139; `cypress-smoke` green (Web CI run 37965126082) |
| 4.61 | Multi-file Source Note import | 4 | M | Done `f3bfab5` — several files open a dialog that saves each as its own Source Note (one file keeps the form flow); duplicates by import file name skipped (saved or earlier in batch) with Open existing; optional primary-subject link for all; progress, then imported/skipped/failed per file; failures do not stop the batch; shared save/link/index path; no extraction or canon writes; LoreRoute 1,814→1,787 lines; lint baseline; 921 web + 47 engine + 12 UI + 24 desktop tests; web/desktop builds; file-size gate; Cypress 140/140; `cypress-smoke` green (Web CI run 37965126082) |
| 4.62 | Character custom fields on Canon | 4 | S | Done `52a36ab` — saved and unsaved characters show custom fields (incl. import-created) and Add character section on Canon; Notes keeps the Notes field and linked Source Note; tab copy updated; lint baseline; 928 web + 47 engine + 12 UI + 24 desktop tests; web/desktop builds; file-size gate; Cypress 143/143; `cypress-smoke` green (Web CI run 38049116825) |
| 4.63 | Uncramped World Bible editing (Portable data → More, hide create panel while editing) | 4 | S | Done `7a4e486` — Portable data is its own page (More → Utilities, `/portable-data`) with copy covering scope (World Bible + Source Notes, not manuscript), export-is-not-backup, and per-file import choices; World Bible create/import panel shows only on the record list (hidden while a record is open, all categories); WorldBibleRoute smaller; lint baseline; 929 web + 47 engine + 12 UI + 24 desktop tests; web/desktop builds; file-size gate; Cypress 144/144; `cypress-smoke` green (Web CI run 38049116825) |
| 4.64 | Singular/plural World Bible highlighting | 4 | S | Done `36300bb` — editor lore highlights match the other number of non-character names/aliases (-s, -es after sibilants, -ies/-y) on the last word; characters exact; exact names win; highlighting only (review/unknown detection unchanged); builder extracted to `services/consistency/knownLoreHighlights.ts`, WorkspaceRoute smaller; lint baseline; 939 web + 47 engine + 12 UI + 24 desktop tests; web/desktop builds; file-size gate; Cypress 145/145; `cypress-smoke` green (Web CI run 38127880556) |
| 4.65 | Assistant reply reading view | 4 | S | Done `0d206a7` — every assistant reply with content gets Expand: a wide modal reading view (bottom slide-up on narrow screens) with sanitized Markdown formatting, craft references, Copy/Close; display only; portaled above the narrow drawer, focus trapped/restored, Escape closes only the reading view; lint baseline; 944 web + 47 engine + 12 UI + 24 desktop tests; web/desktop builds; file-size gate; Cypress 146/146; `cypress-smoke` green (Web CI run 38133487790) |
| 4.66 | Visible assistant selection handoff | 4 | S | Done `54ccf24` — selection menu and right-click read **Ask AI about this**; the handed-over passage stays marked in the editor (display-only decoration that follows edits, never saved or in undo history) until the Selected text card's **Clear** returns the assistant to whole-scene scope; lint baseline; 949 web + 47 engine + 12 UI + 24 desktop tests; web/desktop builds; file-size gate; Cypress 147/147; `cypress-smoke` green (Web CI run 39058732227) |
| 4.67 | Local OpenAI-compatible provider | 4 | M | Done `564e52b` — **Local server (OpenAI-compatible)** provider (`local-openai`) for KoboldCPP (default `http://localhost:5001/v1`), LM Studio, and llama.cpp; no key, own code, never the hosted OpenAI provider or its disclosure; private-local at a loopback address (on-device disclosure, no consultation charge, no price ceiling), remote addresses blocked in the route, the provider, and the desktop main process; Settings address field, one-request connection test, listed-model buttons; configured model, else first listed, else the server's loaded model; no `response_format` (4.68), no default token cap, reasoning shown as thinking, length-capped replies refused; desktop main-process adapters; checked live against Ollama's `/v1`, KoboldCPP/LM Studio/llama.cpp not run (smoke §1b); 5 planted regressions caught; lint baseline; 1,166 web + 47 engine + 12 UI + 30 desktop tests; web/desktop builds; Cypress 153/154 locally, the one failure a stale expected sentence fixed in the amend; `cypress-smoke` green (run 40125505701, PR #69) |
| 4.68 | Constrained local output for proposals | 4 | S | Done `1ec212f` — Canvas brainstorm, Canvas coaching, and character from description pass their Zod schema (`defineResponseSchema`, `LLMRequest.responseSchema`); the local model server gets `response_format: json_schema`, hosted providers and Ollama unchanged; checked first on a running KoboldCPP 1.123.1 (`json_schema` and GBNF `grammar` enforced, `json_object` any shape), LM Studio/llama.cpp not available; real prompts and parsers, 6 runs each: character 4/6 → 6/6, brainstorm and coaching 6/6 → 6/6, replies 2–3× faster; a server that refuses the schema (400/422) is retried without it and skipped for the session; desktop IPC validates the schema and mirrors the retry; finding: with no `max_tokens` KoboldCPP stops at 2,048 tokens, reasoning included; 5 planted regressions caught; lint baseline; 1,172 web + 47 engine + 12 UI + 32 desktop tests; web/desktop builds; Cypress 154/154; `cypress-smoke` green (run 40132386938 attempt 2 after an unrelated Compendium unit-test flake, PR #70) |
| 4.69 | Character card import | 4 | M | Done `d889809` — World Bible → Characters → **Import a character card** reads Tavern Character Cards V1/V2/V3 from JSON or a PNG `ccv3`/`chara` chunk (tEXt, iTXt, compressed; V3 first); checked on SillyTavern's bundled default card in Node and the browser (no third-party card committed; HiWaifu not checked, no sample); preview before any write; description → Description, personality/scenario/first message/example dialogue/greetings/creator notes → labeled Notes, whole card → `Character card: <name>` Source Note, each kept lorebook entry → its own linked Source Note (switched-off entries start unticked); `{{char}}` → name, `{{user}}` kept and flagged; system prompt and post-history instructions not imported (Source Notes can reach the app's prompts), portrait not imported; name collisions use the existing explicit choice; draft marked Needs completion, one transaction, no fact accepted; malformed/oversized/card-less files refused with a reason; WorldBibleRoute 2,169 → 2,162; 7 planted regressions caught; lint baseline; 1,205 web + 47 engine + 12 UI + 37 desktop tests; web/desktop builds; file-size gate; Cypress 155/156 full run (the guardrails spec's expected button list, updated, 8/8 on rerun) plus the new spec 2/2; `cypress-smoke` green (run 40147836581, PR #72) |
| 4.70 | Character card export | 4 | S | Done `b28ac17` — a character's Writing aids tab has **Export character card**, downloading `<Name>.card.json` in the Tavern Character Card V2 format; description holds the Description field, other filled fields (labeled), "Also known as" aliases, and accepted facts; trait facts become the personality; Notes go in creator notes with the export date (the author's local day); only what the Character Lab grounds the character with at the latest point is written (fully accepted facts, the character's own aliases), never pending or half-accepted proposals, Source Notes, story state, or other records; chat fields left empty; rich text keeps paragraphs and list items; no PNG card (characters have no portraits); dialogue style not exported (a display format); reads back through the 4.69 importer, not loaded into a running SillyTavern (smoke §1d); WorldBibleRoute 2,162 → 2,154; 7 planted regressions caught (one only by the new Cypress spec); lint baseline; 1,214 web + 47 engine + 12 UI + 37 desktop tests; web/desktop builds; file-size gate; Cypress 157/157; `cypress-smoke` green (run 40149720791, PR #73) |
| 4.71 | Context budget + linked-record pull-in | 4 | M | Done `fc55377` — what the model is given now fits the configured model's context: size from Ollama `/api/ps` (loaded model; checked live on Ollama 0.40.10, 40,960), the local server's `/props` (4.75), the provider for hosted models, else 4,096 shown as assumed; project context gets what instructions, conversation, and reply (a quarter of the context, 768–2,048, or the reply cap) leave, capped at 24,000 tokens; each kind of context has a share, the lowest priority is left out first and leftover room goes to the rest; accepted facts weighed one at a time, identity/age/occupation/membership/relationship before history, looks, and traits, and the model told how many were left out; the assistant, Character Lab, character scenes, and scene drafts (point-of-view character first) list what was left out behind Show; **Include linked World Bible records** (project setting, off by default) adds records one step from a grounded character (its links, or records its accepted facts name exactly by name or alias), at most eight, lowest priority, and disclosed; found while testing: plan the fit before anything is typed, and rank facts (storage order kept duplicate traits and dropped the membership fact); AISettings 1,237 → 1,226; 11 planted regressions caught; lint baseline; 1,249 web + 47 engine + 12 UI + 37 desktop tests; web/desktop builds; file-size gate; Cypress 159/159; `cypress-smoke` green (run 40151604125 attempt 2, after an unrelated `ai-provider-setup` seeding timeout that passed 3/3 locally, PR #74) |
| 4.72 | Prompt breakdown with token counts | 4 | S | Done `0e3b8db` — each line under Grounded in (Character Lab, character scenes, scene drafts) and Sources used (assistant) shows its estimated tokens as sent, after the 4.71 budget, and "Prompt: about N tokens of the model’s M" totals instructions, conversation, and project context with the room left for the reply ("No room is left for the reply" when full; "(assumed)" when the size was not reported); the dialogs show it before anything is typed and the assistant keeps each reply's breakdown; checked against KoboldCPP 1.123.1's own prompt count: the estimate was 1.42× high on prompt rules, 1.60× on English prose, 1.18× on JSON, and even on accented/CJK text, so the cautious estimate stays; 7 planted regressions caught; lint baseline; 1,255 web + 47 engine + 12 UI + 37 desktop tests; web/desktop builds; file-size gate; Cypress 159/159; `cypress-smoke` green (run 40153603515, PR #75) |
| 4.73 | Alternative replies | 4 | M | Done `82dacc8` — the latest Character Lab reply (Talk and Reaction test) and the latest assistant reply have **Another version**, which repeats the same request (question, grounding, story point, model); ‹ › step between versions ("Version 2 of 3", at most five); each version is a full model run (provider checks, disclosure, consultation budget); only the version shown is used (Preview scene revision, Save as Source Note, Save to Scratchpad, the next message), and unkept versions are never saved (the assistant history keeps only the version shown); a failed version is dropped; found while testing: the repeat must ignore the abort signal, and a factual-looking follow-up was blocked until the prompt changed; 6 planted regressions caught, 2 not observable (documented); lint baseline; 1,263 web + 47 engine + 12 UI + 37 desktop tests; web/desktop builds; file-size gate; Cypress 160/160 after fixing an `ask-project` assertion; `cypress-smoke` green (run 40153619611, PR #76) |
| 4.74 | Rolling Character Lab summaries | 4 | M | Done `545a7d3` — when a Talk conversation takes about 35% of the model's context and there are complete turns older than the two most recent, the lab offers **Summarize earlier turns**; the summary request sends only those turns (no records or grounding), at most 200 words, as a full model run (provider checks, budget); the summary is an editable box labeled "not canon" ("edited" once changed), the covered turns stay on screen marked Summarized, and the model gets the summary under a not-canon heading in their place while the two latest turns go word for word; extend, edit, or remove it, and Clear conversation clears it; session only, never saved or written to the World Bible, and the prompt total counts it as conversation; 17 planted regressions caught (the spec summarizes two turns so covering too few is visible); lint baseline; 1,276 web + 47 engine + 12 UI + 37 desktop tests; web/desktop builds; file-size gate; Cypress 161/161; `cypress-smoke` green (run 40154739117, PR #77) |
| 4.75 | Local reply length from server context | 4 | S | Done `4bf1e2a` — the local model server gets `max_tokens` = the reported context (`/props`, else KoboldCPP `/api/extra/true_max_context_length`; checked live on KoboldCPP 1.123.1 at 16,384 and llama.cpp b11669 at 8,192 per slot) minus a high prompt estimate and a 256-token margin, so replies are no longer stopped at KoboldCPP's 2,048-token default; finding: KoboldCPP silently drops the start of a prompt when prompt plus cap exceed the context, so a request with under 512 tokens of room is refused before sending; servers reporting no size (LM Studio, not run) use Advanced → **Maximum reply length** (64–131,072); desktop main process mirrors the rules and validates the setting; also fixed the intermittent Compendium route unit test (a ProjectsRoute load finishing after unmount cleared the next test's active project); live checks through the web provider and desktop adapters on both servers; 12 planted regressions caught; lint baseline; 1,186 web + 47 engine + 12 UI + 37 desktop tests; web/desktop builds; file-size gate; Cypress 154/154; `cypress-smoke` green (run 40145816555, PR #71) |
| 5.1 | Auto-update decision + implementation | 5 | M | WIP — author-approved exception to the Phase 5 gate (2026-10-31): electron-updater from GitHub Releases, ask once before automatic checks; release-blocking 1.1 findings must still be fixed before the first update ships |
| 5.2 | Code signing + notarization, both platforms | 5 | M | — |
| 5.3 | Packaged-app validation + Electron E2E | 5 | M | Done `9d748f4` + `613a8e3` + `88eb908` + `5ad6a77` — author-approved exception to the Phase 5 gate (2026-10-25); 5.1 stays gated. Desktop routes live in the hash under `file://` (hash router, not an `app://` protocol, so the storage origin is unchanged); reload no longer blanks the window. `apps/desktop/e2e`: 13 Playwright Electron tests against the unsigned `--dir` app (CSP startup, reload/restart, bridge surface, local-server Test connection from the main process, chunked IPC streaming, Stop aborts the main-process request, failed reply, IPC refusal of renderer keys/remote addresses, link and navigation guards, backup zip to disk and back), offline. New `Desktop E2E` job on macOS + Windows, required by `cypress-smoke`. Found and fixed: Windows CRLF checkouts failed the web prebuild digest checks (`.gitattributes` LF). Lint baseline; 1276 web + 47 engine + 12 UI + 37 desktop tests; builds; Cypress 161/161; Web CI [run 40185198414](https://github.com/BoDonkey/worldbuilding-desk/actions/runs/40185198414) green including both Desktop E2E jobs |
| 5.4 | Progressive first-run onboarding + sample project | 5 | L | Done `a5644b1` — one-time blank-project auto-create lands a fresh install in Workspace immediately, no provider/ruleset setup first; dismissible getting-started guide shown only on first-run/sample projects; bundled sample project trimmed from `fixtures/trust-dogfood/` to one self-contained factual conflict the author resolves via the real extraction/canon-decision pipeline, reachable from the guide or Projects; lint with 1 baseline warning; 485 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 66/67 (one confirmed-unrelated pre-existing flake) |
| 5.5 | AI provider setup UX hardening | 5 | M | Done `1c15774` — real per-provider Test connection (single-token completion for hosted providers, reachability/model check for Ollama) with plain-language results; two-tier Setup/Advanced split (per-provider key field, budget/policy/base-URL controls behind an explicit toggle, not a nested `<details>`); 3 author-facing relabels; on-device/hosted data-flow disclosure; actionable not-configured link; lint with 1 baseline warning; 496 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 73/73 ([review](archive/ux-ai-review-2026-08-29.md) §A2) |
| 5.6 | Local-only error handling | 5 | S | Done `8709ec1` — one `describeError` helper behind all 107 rendered error sites keeps app-authored validation text, maps network/key/quota/outage/storage-full/newer-version/cancelled failures to plain language, and falls back on technical noise; redacted 50-entry local diagnostics log with window-level capture and a Settings → Diagnostics copy/show/clear panel; tests prove reports exclude API keys, file paths, provider payloads, and manuscript text; no telemetry or automatic transmission; lint with 1 baseline warning; 518 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 73/75 (new spec 2/2; both failures unrelated timing cases that pass in isolation, one intermittent) |
| 5.7 | Trial + license key gate | 5 | M | — |
| 5.8 | Help/docs baseline | 5 | S | — |
| 5.9 | Landing page + demo assets | 5 | M | — |
| 5.10 | Author-facing vocabulary sweep | 5 | XS | Done `69e6559` — string-layer only, behavior-preserving; retires `Shodh`/`RAG`/`Rubber-Duck` from rendered UI including the review's named "Inherit RAG data"/"Inherit memories" inconsistency; source-scanning test guards against regression; lint with 1 baseline warning; 500 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 72/73 ([review](archive/ux-ai-review-2026-08-29.md) §A3) |
| 5.12 | App-shell toast viewport + status live region | 5 | S | Done `7f303f7` — one app-shell toast viewport (polite, auto-dismiss, repeats replaced) fed by a `RouteFeedback` bridge in all nine routes plus Workspace (errors-as-toast, resolver notice as an action toast); errors elsewhere stay inline as `InlineAlert`; one shared status live region via `useStatusAnnouncement` wired to autosave, review, extraction, migration, and AI streaming; `aria-invalid` on three more validated fields; split recorded in the blueprint; lint with 1 baseline warning; 529 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 75/77 full run (one assertion updated to `role="alert"`, one pre-existing hydration race in `post-merge-smoke`), 18/18 + 2/2 in isolation ([review](archive/ux-ai-review-2026-08-29.md) §A5, §A6) |
| 5.14 | Optional encrypted backups | 5 | S | Done `7669198` — author-approved exception to the Phase 5 gate (2026-10-25), as for 5.3. Export Backup offers a plain `.zip` (default) or an encrypted `.sagabackup`: versioned JSON envelope around the backup zip, PBKDF2-SHA256 600k → AES-256-GCM with the header authenticated, NFC passphrase of 8+ characters typed twice, never stored. Import/Validate detect it by content and read nothing until the passphrase opens it; wrong passphrase keeps the dialog open; newer envelope asks for an update; plain backups unchanged. Smoke 1 step 7. Lint baseline; 1284 web + 47 engine + 12 UI + 37 desktop tests; builds; Cypress 164/164; Electron E2E 14/14 including an encrypted round trip on disk; Web CI [run 40186887061](https://github.com/BoDonkey/worldbuilding-desk/actions/runs/40186887061) green on macOS and Windows |
| 5.15a | Project vaults: vault core | 5 | M | Done `f4bd848` — author-approved exception to the Phase 5 gate (2026-10-25), extended from 5.3/5.14; 5.15 split into 5.15a–5.15c, archived plan `docs/archive/project-vault-plan.md`. `openDb()` and the rulesets database return a wrapped connection that seals protected projects' records on write and opens them on read (per-project 256-bit data key wrapped by PBKDF2-SHA256 600k; synchronous AES-256-GCM from `@noble/ciphers` 2.4.0 so sealing works inside transactions; bound to database, store, project, and id); cursors refused; locked projects read back sealed with a **Locked project** placeholder and refuse writes; every vault locks on reload. Enable/disable rewrite each database in one transaction verified before and after writing, with compensation for the rulesets database and no plaintext backup; passphrase change re-wraps only the key. Not reachable from the UI. Found: zone-affinity ids embed the zone-name slug (moved to 5.15b). 14 new tests; two planted regressions caught; lint baseline; 1298 web + 47 engine + 12 UI + 37 desktop tests; builds; Cypress 164/164; Web CI [run 40194139403](https://github.com/BoDonkey/worldbuilding-desk/actions/runs/40194139403) green including Desktop E2E on macOS and Windows |
| 5.15b | Project vaults: UX + derived data | 5 | L | Done `84b70bb` — same gate exception as 5.15a. Projects page protect (no-recovery acknowledgment) / unlock and open / lock / change passphrase / remove protection; palette **Lock Project**; a locked project shows only its label; locks on restart and when another project opens, never persisted as the open project; lock reloads the page. Retrieval and memory stores go through `openDerivedRecordStore` (memory only while protected, dropped on lock, rebuilt after unlock; old `rag-*`/`shodh-memory-*` databases deleted on enable); content browser-storage keys go through `projectBrowserStorage`; protected backups default to encrypted; zone-affinity records get random ids (project schema 8, also on import). Fixed a race where a Source Note saved before the RAG service loaded was not indexed. Second-tab broadcast gap accepted (one desktop window). 8 new unit tests incl. a planted-phrase scan of every database and both browser storages; new `project-vault.cy.ts` (3); two planted regressions caught; lint baseline; 1306 web + 47 engine + 12 UI + 37 desktop tests; builds; Cypress 167/167 local; Web CI [run 40196961910](https://github.com/BoDonkey/worldbuilding-desk/actions/runs/40196961910) green including Desktop E2E on macOS and Windows after rerunning two pre-existing flakes also seen on main (`ai-scene-revision` AI tab, seed `cy.then()` timeout) |
| 5.15c | Project vaults: verification + copy | 5 | M | Done `a1b9621` — migrated the legacy first-mechanics draft before sealing; packaged Electron profile test plants text across primary/derived IndexedDB and local/session storage, proves every live app-owned store clean after protection, then scans the closed profile and records the reclaimable LevelDB-fragment limit; privacy/help and smoke copy state that protection is not secure deletion. Lint baseline; 1310 web + 47 engine + 12 UI + 38 desktop tests; builds; file-size/CI-policy gates; project-vault Cypress 3/3; packaged macOS scan 1/1; full main Web CI [run 40317006961](https://github.com/BoDonkey/worldbuilding-desk/actions/runs/40317006961) green without retries, including all Cypress shards, `cypress-smoke`, and packaged macOS/Windows. PR #83's parallel group 1 lost its Electron renderer under memory pressure; main passed the same shard, and `2f62711` enables Cypress memory reclamation (focused smoke 18/18) rather than hiding the flake with retries. Plan archived at `docs/archive/project-vault-plan.md`. |
| 5.16 | First-release dogfood polish | 5 | M | Done `9b242c1` — WCAG A/AA scans cover Getting Started, Workspace/Settings, and destructive dialogs in both themes; dark soft-accent, toast, editor labels, and nav-transition contrast fixed with shared tokens. Every detected local model stays selectable in a scrollable list. New/ordinary projects offer General Fiction + LitRPG only, existing Game projects remain compatible, and mechanics toolbar actions follow game-system capability. First-run My First Project/Chapter One contract is covered. Character imports strip exact record names from proposed headings and expose validated editable new-field labels. Lint baseline; 1,316 web + 47 engine + 12 UI + 38 desktop tests; web/desktop builds; file-size/CI-policy gates; Cypress 176/176 without retries. Second dogfood findings promoted to 5.17. |
| 5.17 | Writing-flow stability + assistant continuity | 5 | L | Done `dc0460c` — Scroll restore no longer re-runs on each edit (two effects depended on content) and the editor ignores late echoes of its own text, so caret, scroll, and text stay put through typing, deletion, and autosave in a 120-paragraph scene (timed rAF browser check, ≤2px drift, no snap-back). Assistant requests send earlier turns as shown (shown version only, thinking stripped, budgeted to the model context). The reading view shows the question and has its own composer; Save as Source Note and Copy with question offer an editable question+reply transcript, which covers inline coach replies. Source cards are dismissible and open their Source Note/World Bible record only when it still exists. Review fixes: raised dark surfaces use a `--color-surface-lift` token; import names matching an existing field say they fill it, and invalid planned names are dropped. Lint baseline; 1,344 web + 47 engine + 12 UI + 38 desktop tests; web/desktop builds; file-size/CI-policy gates; full Cypress 177/179 without retries. The 2 failures passed 3/3 on focused reruns: a cold-load accessibility-scan transition race (fixed in the test) and a Corkboard save-timing race in untouched code. |
| 6.1 | Beta build + cohort recruitment | 6 | M | — |
| 6.2 | Beta feedback triage + fix slices | 6 | ? | — |
| 6.3 | Release-readiness checklist + RC | 6 | M | — |
| 6.4 | Launch | 6 | S | — |

Phases 2 and 3 can interleave; within Phase 3, slices 3.5–3.8 run
sequentially. Phase 4's original product-completeness scope through 4.11 is
complete; dogfood has promoted 4.12–4.15 as pre-beta experience work, and the
author accepted prose-proximate item/state authoring as 4.16. The author
paused 1.1 on 2026-08-15 and explicitly advanced 4.12, then resumed the run
on 2026-08-22–23 after 4.12–4.16 landed. The resumed run found
release-blocking fact-target corruption and temporally stale custody answers.
Preserve that evidence; 1.2a–1.2e are fixed, and the A–F trust run now resumes
on one fresh stable build before 6.1. Slices 4.12 and 4.14 may
run in parallel; 4.13 follows 4.12 and 4.15 follows 4.14. Release-engineering
work may run in parallel, but 4.16 follows 4.1 and 4.15, 5.4 waits for 4.13
and 4.15, and 4.12–4.16 must land before 6.1. Release-blocking trust or
data-loss findings remain first priority. Phase 6 is strictly ordered.

The 2026-10-08 start of real-world dogfooding (importing the author's
Echoes character and race sheets) adds 4.54–4.56, run in order. 4.54
carries a data-loss fix (same-named headings overwrite each other) and goes
first. They touch World Bible import only, so they may run in parallel with
1.4a/1.4b.

Dogfooding Source Notes on 2026-10-09 adds 4.57 → 4.58: imported Markdown
loses its formatting, DOCX tables flatten into one cell per paragraph, and
notes are edited as plain text. 4.57 fixes import and display; 4.58 replaces
the plain-text editor. 4.59 lets authors who prefer Markdown keep the source
view; 4.60 lets the intake panel collapse. 4.61 (multi-file import) runs
before 4.59: the author has ~25 documents to bring in.

The 2026-10-06 architecture review
([archive](archive/architecture-review-2026-10-06.md)) adds 3.17 and 1.4a.
Both are pre-beta corrections to the shared assistant: 3.17 first centralizes
the request policy and restores consultation-budget enforcement; 1.4a then
makes pending-proposal opt-in readiness fail closed on that boundary. Do not
run them in parallel because both touch the assistant contract.

A 2026-10-06 code reading of the assistant request path adds 1.4b, a third
pre-beta correction on the same contract: follow-up questions lose their
subject, and factual requests phrased as instructions skip the evidence gate.
It also runs after 3.17 and not in parallel with 1.4a.

The 2026-08-29 UX/AI review
([archive](archive/ux-ai-review-2026-08-29.md)) added 1.5, re-scoped 1.4,
re-sized 5.5 from S to M, promoted 5.4 to run first in Phase 5, and proposed
5.10–5.12 (a thirteenth, craft-library infrastructure, was added as 5.13 and
renumbered to 4.17 by the v1 scope change later the same day). The audit also
proposed opt-in telemetry in 5.6 and a separate 5.11 error helper. The author
rejected all telemetry on 2026-08-30; active work now combines author-facing
descriptions and redacted, copyable local diagnostics in 5.6, with no automatic
transmission, and removes 5.11. The Phase 1.1 gate remains authoritative: no
Phase 5 slice is claimed until that run is recorded and triaged. Once cleared,
5.4 runs first; 5.6 and 5.10 may then interleave, and 5.12 follows 5.4. Slice
1.5 precedes 1.4 and every new AI capability.

The 2026-08-29 v1 scope change added 4.17–4.22 (writing coach, derived story
dashboard, and two standalone items the genre research surfaced) and moved
craft-library infrastructure out of Phase 5. Research and content drafting for
4.18 may start with 4.17, but its validated package follows the schema contract
established by 4.17. Slice 4.19 is independent of the coach; 4.20 is last and
depends on 1.5, 4.17, 4.18, and 4.19. Slice 4.21 remains standalone. Slice
4.22 depends on 1.5 because semantic conclusions are model-assisted and
author-triggered. All of 4.17–4.20 must land before 6.1; 4.21 and 4.22 are v1
but may slip past beta without blocking it.

The 2026-09-12 continuity-engine review added 4.23–4.27 (see the Phase 4
subsection of that name for the findings). None blocks 6.1: they harden the
review pipeline's precision and coverage rather than change the trust
boundary. Order: 4.23 first, then 4.24 and 4.25 in either order, then 4.26;
4.27 is a post-beta candidate that 4.26 does not require. The same day's
review of `docs/tactical-actions.md` (external market research) added 4.28
and 4.29; 4.28 follows 4.24 and feeds 4.26, 4.29 is independent and pairs
with 5.8's export-schema documentation. Neither blocks 6.1.

On 2026-09-12 the author accepted the initial World Canvas proposal
([archived `world-canvas-plan.md`](archive/world-canvas-plan.md)) with every recommended
default (name, dedicated `world_canvases` record, the seven lenses, shared
consultation budget for now, guide entry on all guide-marked projects) and
chose to land it **before beta** rather than beta-driven. An author walkthrough
on 2026-09-20 found that the shipped surface obscures its brainstorming
purpose, mixes authored/model/derived material, places a non-canon tool inside
the canon navigation, and cannot collapse an opened lens. The author accepted
the follow-up direction recorded below: Corkboard and World Canvas are sibling
brainstorming tools under Planning; the Canvas develops a Core Idea through
directed lenses; reusable sketches capture successive answers without treating
a lens as complete; Open Threads retain promising questions, tensions,
possibilities, contradictions, and undecided ideas; saved project material
becomes an author-controlled Reference Palette; and optional craft-grounded
coaching can deepen or reword exploration.
Order: 4.30 → 4.31 → (4.32 ∥ 4.33) → 4.34 → 4.34a → 4.34b → 4.34c. The author's
stated priority is a complete working app for their own use first and a product second, so
4.23–4.34c all precede 6.1; release engineering (5.x) may interleave. The
project consultation budget model was settled by 4.39 (done), which unblocks
4.33 and 4.38; both spend against it and must use `useConsultationBudget` with
their own feature id (`canvas-brainstorm`, `canon-check`) rather than adding a
counter of their own.
The same day the author scheduled the Corkboard ↔ scenes proposal
([`corkboard-scenes-plan.md`](corkboard-scenes-plan.md)) as 4.35–4.37,
pre-beta, after 4.30–4.31 so both planning surfaces share chip and link
conventions; 4.35 → (4.36 ∥ 4.37); 4.37 is the one to defer if needed.

---

## Phase 0 — Hygiene

**0.1 Branch and worktree cleanup.** Delete the 57 merged `codex/*` local
branches, prune 8 stale worktrees (keep the locked `.worktrees/ui-fixes`),
delete merged remote branches. No source changes.
_[prompt: archive/fitness-a-work-slices.md § Slice 0]_

## Phase 1 — Trust Validation (active pre-Phase-5 checkpoint)

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

Current execution handoff: run this over several sittings using the checkpoint
and results templates in the fixture runbook. Do not fix ordinary findings
mid-run. Preserve evidence, finish A–H, then classify each finding as a
release blocker, workflow blocker, UX friction, false positive, or fixture
bug before changing the Phase 5 board.

**1.2 Fix trust-path failures.** Prior trust fixes are complete on the status
board. Turn every new source-ranking, stale-summary, provenance, identity, or
data-loss failure from the current 1.1 run into a new bounded follow-up slice.
Release-blocking findings must be resolved before 5.1; non-blocking findings
may be scheduled honestly and must still be resolved before beta when they
affect release trust. Size remains unknown until the current run lands.

**1.2a Fact-target integrity and reversible acceptance.** Treat inferred fact
targets as editable proposals, never as locked truth. New fact writes target
canonical World Bible entity IDs. Resolve an explicit grammatical subject when
it exists; if that subject has not been accepted from a sibling entity proposal
or the paragraph is ambiguous, leave the fact unresolved instead of falling
back to another linked record. Unresolved sibling subjects remain blocked
until the author accepts the relevant entity or chooses an existing target;
refresh fact candidates against the resulting authoritative records.
Retargeting must persist on acceptance and allow the Brannic
service-length proposals to form one conflict cluster. Removing or superseding
a fact must conservatively undo only the user-facing side effects owned by that
fact; accepting new background/appearance/trait/ability facts must not append
untracked text into hidden Notes. Lock the Sera occupation, Brannic service,
Dess alias, conflict-clustering, and removal paths with service and routed-UI
coverage. Preserve the author-approval boundary throughout.

**1.2b Temporal custody and conflicting-location grounding.** Storage/custody
answers must inspect ordered saved manuscript evidence rather than choosing the
most specific recognized container by retrieval score. Distinguish designated
storage from later sign-out, pocket possession, carrying, transfer, and use.
With chapters 1–5 present, D4 must report the temporal conflict/current custody
uncertainty (and cite the relevant scenes), never confidently answer only
Odessa's vault. Accepted replay may strengthen an answer when available but is
not required to notice explicit manuscript custody changes.

**1.2c Workspace scene continuity and Find.** Preserve the selected scene when
leaving and returning to Workspace. Key every editor/window/element scroll
snapshot by project and scene with no cross-scene fallback. Define and test a
current-scene Find interaction distinct from app-shell scene/World Bible
search, including keyboard behavior and route remounts.

**1.2d Lore intake/review clarity and matcher precision.** Normalize leading
articles for entity identity so `Salt Door` and `the Salt Door` do not create a
duplicate proposal; ensure short aliases never decorate inside longer words or
canonical names. Let review choose or create the appropriate World Bible
category (including Factions) without abandoning the candidate. Consolidate
duplicate Source Note import/extract calls to action and explain document links
in author language, including the single primary-subject rule, save-before-
extract behavior, and the fact that placement is neither accepted canon nor an
entity-to-entity relationship.

**1.2e State/replay dogfood journey.** Rewrite Session E with the exact current
author-facing route for each scripted stat/resource, inventory, equipment,
status, and location event. Add the smallest contextual handoff needed if the
current advanced route still strands the author. Keep accepted event entry
explicit, previewed, scene-scoped, and replay-backed.

**1.3 Calm-shell navigation validation.** Manually verify primary navigation
and `More` grouping at desktop and narrow breakpoints across projects with no
mechanics, light mechanics, and heavy system tracking; verify the Lore
Documents list with the realistic project before adding grouping/filters;
confirm optional-system badges stay discoverable without promoting mechanics
routes. Resolve any changes through `docs/product-blueprint.md` navigation
rules.

**1.4 Grounded project Q&A destination.** The conditional gate on this slice
is satisfied: the 2026-08-29 UX/AI review established the product need. Add a
destination where the author can ask questions of the project outside the
Workspace drawer — pending proposals discussed without being presented as
canon, factual questions answered through the existing evidence gate and
`getDirectSavedFactAnswer` path. Runs after 1.5 so answers and proposals share
one review affordance.

**1.4a Ask pending-proposal readiness.** Follow-up from the 2026-10-06
architecture review, after 3.17. Replace `usePendingProposals`'s ambiguous
`null`/empty result with an explicit disabled/loading/ready/error contract.
After the author enables **Include pending proposals**, do not allow a request
to claim or imply that proposal context is included until both pending facts
and their Source Note titles are ready. Show loading beside the control;
surface a plain-language inline error with retry rather than reporting zero
proposals; turning the option off must immediately restore the accepted-only
path. Guard event-triggered reloads with a request generation or equivalent so
an older read cannot replace a newer result. Keep factual answers accepted-
canon-only and keep every pending value visibly labeled as unaccepted.
Unit-test disabled/loading/ready/error, retry, overlapping reloads, and toggle
off. Cypress must cover checking the option and trying to send immediately,
load failure plus retry, and a successful labeled discussion. Run the full
verification battery and local Cypress; this routed trust-path change must be
green in `cypress-smoke` before close-out.

**1.4b Assistant follow-up subjects and evidence-gate coverage.** Found by
code reading on 2026-10-06, not yet reproduced in the running app; reproduce
first and record the observed replies. After 3.17; not in parallel with 1.4a.
Two defects on the shared assistant path (Workspace drawer and **Ask your
project**), both in the fact-checking questions authors are expected to ask:

- _Follow-ups lose their subject._ `handleSendPrompt` runs retrieval, the
  deterministic resolvers, and the provider request on the current message
  text alone (`messages: [requestUserMessage]`); earlier turns are displayed
  but never used. After "What is Sera's occupation?", "What about her
  brother?" is gated but has no resolvable subject, so it returns the generic
  unverified reply. "And her brother?" is not gated at all and reaches the
  provider with chunks retrieved for the fragment and no referent.
- _The gate keys on the opening word._ `isEvidenceGatedFactualQuestion`
  matches only messages that start with a question word or auxiliary. "Tell
  me how long Brannic served", "Remind me where the ledger is kept", "And his
  rank?", and "How about Dess?" reach the provider ungated, which contradicts
  the 1.2 guarantee that a provider never gets the opportunity to invent a
  project fact.

Required behavior:

- Carry the subject forward deterministically. When the current message names
  no World Bible entity or alias, resolve it against the entities named in the
  immediately preceding author question and its answer in the same
  conversation, using the existing entity/alias matcher. No model call
  performs this resolution. Exactly one candidate: run retrieval, the
  resolvers, and the gate on the resolved subject, and show the resolved name
  in the reply so the author can see what was assumed. Zero or several
  candidates: ask which record the author means, without a provider call.
  Carry-over is one turn deep and never crosses conversations or surfaces.
- Classify by what is asked, not by the first word. Gate report-style
  requests (tell me, remind me, give me, list, what's, leading "and"/"so"/"how
  about" continuations) when they ask for a project fact. Requests that ask
  for new text (write, draft, describe, brainstorm, suggest, rewrite, expand)
  stay on the creative path, as do the existing should/could/might/would
  forms. Keep the classifier deterministic and table-driven. When a request
  is ambiguous between reporting and generating, gate it.
- Do not send prior turns to the provider as conversation history in this
  slice. That is a separate decision with cost and trust consequences;
  record it in the Backlog if the reproduction shows authors need it.
- Selected-text and World Bible record context keep their current handling.

Unit-test a phrasing table that covers every example above in both gated and
creative directions, plus carry-over with one, zero, and several candidates,
an alias as the carried subject, and no carry-over across conversations.
Extend the assistant integration test and add Cypress coverage on `/ask` for
a two-turn fact check that resolves, one that asks for clarification, and an
instruction-phrased factual request that fails closed. Add the follow-up and
instruction phrasings to Session D of the trust-dogfood runbook and answer
key. At close-out, correct the `PROJECT_STATUS.md` statement that all factual
project questions cross the evidence gate so it describes the tested
boundary. Full verification battery and local Cypress; green in
`cypress-smoke` before close-out.

**1.5 Shared AI proposal surface.** Today exactly one AI surface — the World
Bible record helper — lets model output become a reviewable, confirmable
change; the assistant, the lore consultations, and the canon rubber-duck all
terminate in prose the author must re-enter by hand. Extract that helper's
propose → preview → confirm interaction into a shared component and hook, then
adopt it at the surfaces that currently dead-end: assistant output captured as
a draft Source Note (never canon, entering the existing extraction/review
pipeline), assistant-to-scene insertion as a reviewed action rather than a raw
paste, and canon rubber-duck output prefilling the alias/accept/reject choice
with its rationale visible and the author's click still required. The trust
boundary is unchanged — models propose, deterministic code validates, authors
approve. Prerequisite for 1.4 and for every AI capability proposed in the
review's §B4.
_[detail: archive/ux-ai-review-2026-08-29.md § B3]_

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
- **3.5** ESLint 10 group (+ plugins; resolve or explicitly defer the 77
  react-hooks compiler-rule violations: 65 `set-state-in-effect`, 6 `purity`,
  and 6 `preserve-manual-memoization`).
- **3.6** Vite 8 + `@vitejs/plugin-react` 6 (keep `@types/node` at 24.x).
- **3.7** Cypress 15 (all 43 tests green locally and in CI).
- **3.8** TypeScript 7 last (fall back to TS 6.x if a hard dependency blocks).
- **3.9** Dev-audit sweep (33 findings baseline), re-verify grade-A criteria,
  write the new dated fitness report, archive the old one.

Zod 4 stays deferred as its own future migration.

Rules-engine consolidation (from finding F3 of the 2026-09-26 architecture
review). Full scope and decisions: _[plan: archive/rules-engine-plan.md § R1, § R2]_.

- **3.10** (R1) Move the pure manuscript-time state core (command types and
  schemas, `CharacterReplayState`, command application, ordering, replay,
  ruleset validation) into `packages/rules-engine`; persistence stays in web.
  Behavior-preserving; replay parity across the continuity corpus; web
  Vitest resolves the package from `src`.
- **3.11** (R2, after 3.10) Lock down `mathjs` in `FormulaParser`, replace
  `rules: z.array(z.any())` with `GameRuleSchema` plus a quarantining storage
  migration, move `StateManager` and wall-clock state to a non-exported
  `experimental/` path, and add engine tests for formulas, effects, and rule
  evaluation.

Hardening from the 2026-10-03 architecture review
(_[evidence: archive/architecture-review-2026-10-03.md § F2, F4, F5, F6]_).
Run 3.15 first because it is cheap and unblocks the others' CI. 3.12a and
3.12b must land before 5.3 packaged validation and before 6.1 beta.

- **3.12a** (F2) Provider credential and endpoint hardening.
  - Move hosted-provider API keys out of renderer `localStorage` into a
    main-process store backed by Electron `safeStorage`, behind a narrow IPC
    surface (set, clear, has-key). The renderer never reads a key back. The
    main process attaches the key to provider requests.
  - Migrate existing `*_api_key` values on first run, then clear the
    plaintext copies.
  - `apiHandler.ts` enforces a scheme/host policy on `baseUrl`: HTTPS to the
    known host for each hosted provider, and loopback only for Ollama or an
    explicitly local endpoint.
  - Add a renderer Content-Security-Policy that works with the Vite dev
    server, and a `will-navigate` guard on the main window.
  - Give `apps/desktop` a lint script and Vitest tests for the IPC payload
    validator and the URL policy.
  - The browser-only dev build keeps keys behind one `providerKeyStore`
    module instead of ad hoc `localStorage` calls in `AISettings.tsx` and
    `LLMService.ts`.
  - Update the Privacy section of `docs/architecture-review.md`.
- **3.12b** (F2, after 3.12a) Private-local AI classification.
  - Introduce one provider-route classification used by disclosures, request
    policy, and consultation accounting. **Private local AI** requires a
    loopback endpoint and a model verified as locally installed; an Ollama
    cloud model, remote base URL, or indeterminate model fails closed to a
    hosted/remote disclosure and never receives the private-local badge or
    local-budget exemption. The default private mode rejects cloud models
    rather than silently forwarding manuscript context through Ollama.
  - Replace the current unconditional Ollama copy with the verified state and
    cover local model, cloud model, remote endpoint, and unverifiable-model
    cases in renderer and desktop tests.
- **3.13** (F5) Atomic canon acceptance.
  - Add one shared multi-store transaction helper under `services/storage/`.
  - Move `acceptLoreEntityProposal` (`services/lore/entityProposalActions.ts`)
    and the canonical-fact side effects (`canonicalFactActions.ts`) onto a
    single `readwrite` transaction across categories, characters, entities,
    aliases, and lore links. Derived RAG/Shodh indexing runs only after
    commit.
  - Tests with `fake-indexeddb` inject a mid-flow failure and assert that
    no partial canon is left behind.
  - Where a single transaction is impractical, use the documented
    failure-safe write order that `saveCharacterFromDescription` uses.
- **3.14** (F4) Hotspot freeze and extraction. Behavior-preserving, and it
  follows the 3.1–3.4 hook-extraction pattern.
  - Add a CI check that fails when any non-test file over 1,500 lines grows
    past its recorded baseline.
  - Extract the stat-peek and character-scene insertion paths from
    `components/Editor/EditorWithAI.tsx` into hooks, bringing it back under
    1,400 lines.
  - Bring `routes/WorkspaceRoute.tsx` back under 2,000.
  - Move the direct storage imports that 4.43–4.48 added
    (`CharacterLabDialog`, `CharacterSceneDialog`,
    `CharacterFromDescriptionDialog`, `StatPinPanel`) behind their owning
    hooks.
  - Splitting `useWorkspaceConsistency` by responsibility is scheduled as
    3.16 now that the freeze holds.
  - Fix the World Bible category load race found 2026-10-04: a category
    added before the initial category load finishes is overwritten by the
    stale loaded list (the post-merge smoke now waits for categories; the
    app should merge or ignore a load older than a local change).
- **3.15** (F6) Dependency advisory sweep and CI audit gate.
  - Clear the production advisories: `@tiptap/*` ≥ 3.30.5;
    `sharp` ≥ 0.35.4 and `adm-zip` ≥ 0.6.1 via the
    `@huggingface/transformers` chain (newer release or `pnpm.overrides`;
    raise the existing `adm-zip` override); `qs` ≥ 6.16.
  - Move `express` and `cors` to `devDependencies` if `proxy-server.ts` is
    their only consumer.
  - Add a `pnpm audit --prod --audit-level high` step to `web-verify` so the
    3.9 zero-advisory baseline cannot drift silently again.
  - Run the full battery plus Cypress. The editor upgrade touches every
    routed UI.
- **3.16** Split `useWorkspaceConsistency` by responsibility. Promoted from
  the 3.14 note on 2026-10-05; no pre-work (the 3.14 size freeze holds).
  Behavior-preserving, following the 3.1–3.4 hook-extraction pattern.
  - Split `hooks/useWorkspaceConsistency.ts` (2,234 lines, frozen at its
    baseline) into hooks by responsibility, for example unknown-name
    resolution and linking, scene review and project review runs (including
    persistence and dismissal), and state-mutation review. Pure logic moves
    into tested services; no new hook over 600 lines.
  - Keep the hook's public return shape so `WorkspaceRoute` and the drawers
    change only where they import from.
  - Record the smaller sizes with `pnpm check:file-sizes --update`.
  - Full battery plus local Cypress; the review, canon, and state specs must
    stay green unchanged.

Follow-up from the 2026-10-06 architecture review
(_[evidence: archive/architecture-review-2026-10-06.md § F1]_). This is the
prerequisite for 1.4a and must land before beta.

- **3.17 Centralize assistant request policy.** Extract the ordinary project
  assistant's model-run orchestration from `AIAssistant.tsx` into one shared
  hook/service boundary used by both the Workspace drawer and **Ask your
  project**. That boundary owns provider readiness, provider-route disclosure,
  consultation-budget blocking, feature accounting, request execution, Stop,
  and plain-language failure handling. Retrieval and the universal factual
  evidence gate may remain in tested assistant services, but there must be one
  obvious call site where a provider request is authorized and spent.
  Deterministic saved-fact, temporal-custody, and unverified factual answers do
  not call a model and must spend zero consultations. Immediately before every
  ordinary model request, enforce `budget.blocked`; hosted/remote calls spend
  exactly one `assistant` unit, verified private-local calls count only toward
  the local runaway guard through the existing budget service, and the author
  sees the shared point-of-use cost/remainder or local disclosure beside Send.
  The writing-coach action keeps its own guard and records
  `writing-coach`, not `assistant`. Do not add a second counter, provider-route
  classifier, or Ask-only exception. Preserve the current factual gate,
  context trust labels, pending-proposal labels, conversation scopes, response
  ceilings, streaming/Stop behavior, AI-text provenance, and Source Note
  preview boundary. Add focused unit/component coverage proving deterministic
  answers spend zero, ordinary hosted generation blocks and grants in place,
  one successful hosted run records one `assistant`, local accounting uses the
  runaway guard, and coach usage is attributed correctly. Extend Cypress for
  both Workspace and Ask point-of-use disclosure and exhausted-budget behavior.
  Keep `AIAssistant.tsx` below its starting line count, update
  `PROJECT_STATUS.md`, and run the full verification battery plus local
  Cypress; `cypress-smoke` must be green before close-out.

- **3.17a Project deletion integrity + retrieval upgrade repair.** Correctness
  fixes from the 2026-10-18 code review, before the behavior-preserving
  cleanup slices: delete the project manifest and its main-database records
  in one transaction; preserve the separate ruleset if deletion fails;
  close and evict cached retrieval/memory connections before deleting their
  databases, and surface blocked/error outcomes instead of reporting success.
  Upgrade populated version-1 retrieval databases without recreating their
  existing store. Cover rollback, project isolation, live cached connections,
  inherited providers, blocked deletion, retries, and legacy upgrade with
  IndexedDB regression tests. Run the full battery and local Cypress for
  the Projects deletion workflow. No broad storage refactor or schema bump.

Follow-up from the 2026-10-17 architecture review
(_[evidence: archive/architecture-review-2026-10-17.md § F1–F7]_). The audit
ran without Node.js, so each slice starts by confirming its finding against a
green battery. Every slice here is behavior-preserving except 3.19 (visible
text color) and 3.23b (an additive schema migration). 3.23a–3.23c must land
before 5.15, because the vault encrypts through the owning persistence
boundary and these slices create it.

- **3.18 Lower the size freeze to 1,000 lines.** Run after 4.66 closes.
  Change `LIMIT` in `scripts/check-file-sizes.mjs` from 1,500 to 1,000 and
  record the baseline with `pnpm check:file-sizes --update`. Files that are
  already over 1,000 lines may shrink but not grow. Update the 3.14
  references in `docs/architecture-review.md` risk 4 and the script's header
  comment. Ensure edits to the size-check script and baseline trigger Web CI.
  No application code changes.
- **3.18a Change-aware CI + verification policy.** Introduce conservative,
  tested path classification, focused UI browser mappings, fresh dependency
  audits, and three disjoint browser groups for full coverage. Keep required
  check names and fail closed on planner/job failures. Reuse tests only with
  a successful identical-code/coverage proof and successful prior run; cancel
  superseded PR runs without allowing a documentation update to bypass an
  unverified code change. Exercise the new full workflow once and confirm a
  documentation-only close-out reuses the verified result. Update this policy,
  AGENTS, the architecture reference, and PROJECT_STATUS. No application
  behavior changes.
- **3.19 Undefined theme token + hardcoded editor colors.**
  `--color-text-muted` is used in `ConsultationBudgetNotice.module.css` and
  `AISettingsForm.module.css` but is not defined. Replace it with the
  existing token that matches the intended muted text (most likely
  `--color-text-secondary`; confirm against `docs/product-blueprint.md`).
  Replace the 13 hardcoded colors in `assets/TipTapEditor.css` and 3 in
  `App.css` with existing theme tokens where an equivalent exists, adding a
  shared token deliberately only where none does. Check both themes. Add a
  small check (a unit test or script) that fails when a stylesheet uses a
  `var(--…)` name that no stylesheet defines.
- **3.20 Compendium form extraction.** `routes/CompendiumRoute.tsx` holds 59
  `useState` values, about 40 of them draft fields for separate forms
  (entry, import, recipe, milestone, preview, zone, settlement module, base
  stats). Move each form's draft state and submit handler into its own
  component or hook beside `EntriesTab`/`WorldSystemsTab`, so the route keeps
  only loaded data, the active tab, and feedback. Pure validation and
  parsing (for example recipe milestone IDs and preview materials text) move
  into tested helpers. Bring the route under 1,000 lines with no new file
  over 600, and record sizes with `pnpm check:file-sizes --update`. Full
  battery plus local Cypress.
- **3.21 Scene-roster mutation services.** Move the state-mutation command
  construction out of `hooks/useWorkspaceSceneRoster.ts` (1,417 lines) into
  pure, tested functions under `services/workspace/` or `services/state/`.
  This covers `saveSelectionInventoryCapture`,
  `saveSelectionConsumptionCapture`, the timeline expire, edit, invalidate,
  and re-anchor actions, and `savePositionedChange`. The hook keeps React
  state, persistence calls, and wiring; its return shape does not change.
  Move the `SceneRoster*` card types out of
  `components/Workspace/SceneRosterPanel` and `LoreInspectorRecord` out of
  `components/Editor/LoreInspectorPanel` into the services that produce
  them, so no service imports from `components/`. Target under 800 lines
  for the hook, with no new file over 600. Unit tests cover each command
  builder with continuity-corpus cases, and the scene-roster, stat-peek,
  and state Cypress specs stay green unchanged.
- **3.22 Characterization tests for untested domain modules.** Before any
  move, add tests that pin current behavior for
  `services/compendium/compendiumService.ts` (1,232 lines, no unit tests),
  using `fake-indexeddb` like the 3.13 transaction tests. Then extract the
  pure logic from `hooks/useWorldBibleEntityActions.ts` (1,125) and
  `hooks/useWorkspaceStatBlocks.ts` (1,074) into tested services, following
  the 3.16 pattern (same return shapes, no new hook over 600 lines). Split
  `compendiumService.ts` by responsibility only after its tests are green,
  for example persistence versus mechanics calculations. Must land before
  3.23a so the storage move has a safety net.
- **3.23a One storage layer + import guard.** Move the root-level
  repositories (`db.ts`, `projectStorage.ts`, `settingsStorage.ts`,
  `entityStorage.ts`, `characterStorage.ts`, `categoryStorage.ts`,
  `writingStorage.ts`, `loreStorage.ts`, `corkboardStorage.ts`,
  `scratchpadStorage.ts`, `worldCanvasStorage.ts`), and the services that
  open IndexedDB themselves (canon decisions, lore facts, entity proposals,
  state ledger, compendium, character transfer), under one storage folder in
  `services/storage/`. Replace the 12 copies of `requestToPromise` with one
  shared helper. Routes, hooks, and components import repositories only
  through that folder's public index. Add an ESLint `no-restricted-imports`
  rule (or an equivalent check) that blocks `openDb` and `indexedDB` use
  outside the storage folder. Keep function names and signatures so that
  callers change only their import path. Behavior-preserving: no schema
  change and no new stores. Full battery plus local Cypress, plus the backup
  and canon smoke tests in `docs/smoke-tests.md`.
- **3.23b Project-scoped IndexedDB indexes.** After 3.23a, add `projectId`
  indexes to every project-owned object store that lacks one, with one
  `DB_VERSION` step. Change the `…ByProject` getters to read through the
  index instead of loading every project's records and filtering. Cover the
  upgrade path from the current `DB_VERSION` (28) with a real-IndexedDB test
  that opens a populated v28 database. Backup export and import, the
  per-project migration chain, and snapshot `schemaVersion` stay unchanged.
  Record the change in `docs/domain-model.md` if it lists store indexes, and
  run the backup smoke test.
- **3.23c Browser-storage preferences + mechanics draft.** After 3.23a,
  replace the copied collapsed-rail `localStorage` code in the Corkboard,
  World Bible, and Lore routes, and the direct calls in `CommandPalette` and
  `SourceNoteStarterPanel`, with one preference helper or the existing
  Zustand preference store. Keep existing keys or migrate them so that no
  author loses a setting. Move the unfinished mechanic draft in
  `WorldBibleMechanicsPanel` (name and default value the author typed) out
  of plaintext `localStorage`, either into project storage through the 3.23a
  layer or into memory only. Ask the author which before starting, because
  memory-only drafts would no longer survive a reload. Decided 2026-10-24:
  project storage; the draft must survive a reload and round-trip through
  backup. After this slice, no author-typed content may be stored outside the storage layer. Record the
  remaining `localStorage` keys, which should be preferences only, as the
  inventory 5.15 must account for.
- **3.24a Backup import collision guard.** High priority: this is a
  data-loss bug. Found 2026-10-24 during 3.23c. `importProjectBackup` keeps
  each record's own id for most stores (`rewriteProjectScoped` changes only
  `projectId`). A backup imported into the same browser it came from, as a
  new project or merged into another project, therefore overwrites the
  source project's records and moves them into the copy. A fake-IndexedDB
  probe left the source project with 0 of its 1 entity. Scratchpad, World
  Canvas, aliases, actor resolutions, identity reports, and mechanics drafts
  already build their ids from the project id and are safe. Before any
  write, the preview and the import look up every incoming id in its store.
  If an id belongs to a project other than the target, they refuse the
  import with a plain explanation and leave the database untouched. A merge
  back into the same source project (a restore) stays allowed. Add tests for
  new, merge-into-other, and restore, and add a failure case to the
  backup smoke test. Snapshot format unchanged.
- **3.24b Backup import id remapping.** After 3.24a. Give every imported
  record a fresh id on a new-project import, and on a merge whenever an id
  collides. Rewrite every reference through one id map built before
  writing: `categoryId`, entity `links`, Corkboard `sceneIds` and
  `chapterCardId`, character and sheet ids (`characterId`,
  `characterEntityId`, `characterSheetId`), lore links and
  `loreDocumentId`, fact and proposal `sourceEntityId`/`targetId`/scene
  bounds, canon-decision targets, state events' `sceneId` and actor ids,
  compendium and settlement ids, Canvas `linkedEntityIds` and
  `linkedSourceNoteIds`, and ids inside scene HTML such as `data-lore-id`.
  Rule-definition ids (`definitionId`, ruleset stat/resource ids) belong to
  the ruleset and stay unchanged. Add a test that walks every
  `ProjectSnapshot.data` field and fails when a field holding an id is not
  remapped, so new stores cannot skip the map. Then lift the 3.24a refusal
  for cases the map now handles. Round-trip test: import a backup twice into
  the browser it came from, and all three projects stay complete and
  independent. Snapshot format unchanged.

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
- **4.3 Package rename.** Use the `@worldbuilding-desk/*` scope for internal
  packages so manifests, imports, scripts, CI, and build artifacts match the
  product identity before public distribution.

### Character experience unification (4.4–4.11)

Decisions, target domain contract, migration invariants, author journeys
(J1–J6), and acceptance criteria live in
`docs/character-experience-design-review.md`; the CX numbers below reference
its slice table. All eight are required before the 6.1 beta build so beta
projects never accumulate ambiguous character identity data. 4.2 must land
first; then 4.5 → (4.6, 4.7, 4.9 in any order) → 4.8 → 4.10 → 4.11. Storage
migration and UI change stay in separate slices; adapters added here are
removed by the backlog legacy-retirement item.

- **4.4 (CX-1) Contract adoption.** Fold the review's domain contract and
  migration invariants into `docs/domain-model.md`; add journeys J1–J6 to the
  smoke docs; archive the redesign brief.
- **4.5 (CX-2) Identity links + classifier + resolver.** `EntityCategory.kind`,
  `Character.entityId`, `CharacterSheet.characterEntityId`, persisted
  actor-resolution map, deterministic legacy classifier with report, and the
  shared character link-resolver service. Auto-link only on the exact-unique
  normalized-name rule; everything else queues for the author. No new UI
  beyond the report.
- **4.6 (CX-3) Backup + package completeness.** Snapshot v2 including
  consistency aliases (currently absent from backups — data loss) and the new
  link fields; v1 snapshots and v1 character packages import through the
  classifier; round-trip and replay-parity tests.
- **4.7 (CX-4) Intake convergence.** Manual creation, review capture, lore
  proposal acceptance, package import, and sheet creation all produce or link
  a canonical World Bible identity; no path creates a free-standing
  `Character`.
- **4.8 (CX-5) Resolution queue.** Tools-only, sheet-only, and ambiguous
  legacy records surface in the World Bible review queue with link / create
  canon / keep-separate actions; unresolved records are never presented as
  canon anywhere.
- **4.9 (CX-6) Sheet + state rebinding.** New mutations carry canonical
  entity actor IDs; replay resolves legacy IDs through the map; name-based
  actor matching removed; one-sheet-per-character invariant enforced with
  collisions surfaced; sheet names derived from canon.
- **4.10 (CX-7) Capability routing.** World Bible character detail routes Add
  sheet / Dialogue style / Export; Character Tools loses independent
  create/rename/descriptive editing; "profile" retired from author-facing
  copy.
- **4.11 (CX-8) Identity dogfood addendum.** Extend `fixtures/trust-dogfood/`
  and the character-canon smoke with the J1–J6 scenarios (Tam containment,
  rename stability, migration round-trip, mode gating); feeds Slice 1.1
  before 6.1.

### Dogfood-promoted experience work (4.12–4.15)

These slices are promoted from backlog or added from the active 1.1 dogfood
because correct data ownership is not enough when the author still perceives
multiple character-entry destinations or cannot discover a safe first step
through mechanics. They are product-comprehension work, not new mechanics
depth.

- **4.12 (CX-9) Sectioned character experience.** Make World Bible character
  detail the coherent home for Canon, Notes, Continuity, Mechanics, and
  Writing aids. Default to canon and the capabilities relevant to the project
  mode; disclose empty/advanced sections only after an explicit author action.
  Reuse the existing character composition/resolver services rather than
  duplicating reconciliation logic.
- **4.13 (CX-10a) Character destination retirement.** Remove Character Tools
  as a separate author-facing destination. Dialogue-style assignment,
  single-character package transfer, sheet creation, and character-scoped
  state open from the World Bible detail; any genuinely useful batch package
  action lives as a utility under `More`. Preserve v1 imports and unresolved
  legacy resolution. Retiring compatibility targets, name joins, and the
  extension store remains a separate internal cleanup after reader coverage
  proves removal safe.
- **4.14 Mechanics first-use journey and complexity audit.** Walk the current
  LitRPG journey from a project with no ruleset through one useful stat or
  resource, one attached character sheet, and one scene-scoped state change.
  Record every prerequisite, unexplained term, duplicate entry point, dead
  end, and advanced control encountered. Define the shortest basic path and
  author-verifiable desktop/narrow acceptance cases in this roadmap and the
  relevant smoke authority before implementation.

  **Audit result and 4.15 implementation contract (2026-08-15).** The audit
  used a fresh LitRPG project on the rendered desktop and narrow interfaces,
  then traced the owning routes and services. The current path succeeds
  deterministically, but requires the author to understand the product's
  storage hierarchy before receiving useful narrative continuity:

  1. A rules-enabled project mode is the first hidden prerequisite. `More`
     then exposes three overlapping entry points — `Rules`, `Sheets`, and
     `Mechanics` — while a World Bible character adds both list-level
     `Add sheet` / `Add Mechanics` actions and a detail-level `Mechanics`
     section. The difference between Rules, Mechanics, and sheet state is not
     explained at the decision point.
  2. `Rules` opens the complete World Ruleset editor. Before the first save it
     requires a second world name, at least one stat, and at least one
     resource. `Blank Slate` still leaves creation blocked, resources stay
     locked until a stat exists, and `Create World` implies a new world rather
     than enabling tracking in the current project. Templates expose D&D,
     LitRPG, cultivation, regeneration, numeric/boolean/text types,
     min/max/default values, duplicate/delete, import, and export before the
     author has recorded one useful value.
  3. Saving the first ruleset returns to Workspace instead of the initiating
     character. The author must rediscover World Bible, reopen the character,
     and select `Mechanics`. There is no resumable setup state or explicit
     next step.
  4. `Add sheet` correctly derives the canonical name and ruleset defaults,
     but the handoff enters the separate Character Tools destination. The
     automatic creation and route prefill race currently reports that the
     character “already has a sheet” immediately after the requested success.
     The resulting editor foregrounds Character Tools, package import/export,
     level, XP, Runtime Effects, ruleset memory, promotion, inventory,
     equipment, statuses, catalog links, and the full sheet list around the
     one requested value.
  5. Recording a scene change is a separate task view described as
     `Advanced`. It requires manual choices for sheet, source scene, change
     type, stat/resource, and delta/value. Primary copy exposes `state
     mutation`, `mutation ledger`, `runtime`, revision timestamps, hashes,
     internal definition IDs, `accepted`, and `invalidate`; the author must
     leave the manuscript to record the change and must navigate back to
     World Bible to see character continuity.
  6. The standalone `Mechanics` destination is a compendium/progression
     system, not the first character-stat journey. Its basic Overview still
     asks for linked entries, compendium records, actions, points, milestones,
     recipes, and zone profiles. Its existing `Show advanced setup` disclosure
     is a useful pattern, but `Rules`, `Sheets + State`, and the World Bible
     handoff do not yet share the same progressive model.

  The 4.15 **basic path** is therefore one contextual, resumable flow:

  1. From a saved World Bible character, choose `Add mechanics`. If the
     project has no tracking setup, explain that mechanics are optional and
     ask for one value to track: `Stat` (a relatively stable attribute) or
     `Resource` (a value that changes, such as Health). Name it and accept a
     useful default; project/ruleset identity and the unused definition kind
     must not be required.
  2. Create the minimal valid ruleset and the character's one linked sheet as
     one author-confirmed operation. Keep canonical name derivation and the
     one-sheet invariant. Return to the same character's Mechanics section
     with the new value visible; never route through a successful duplicate
     creation warning.
  3. Offer `Record a scene change` from that character and from the active
     scene's contextual review tools. Prefill character, sheet, and active
     scene; present the tracked value plus plain-language `Change by` / `Set
     to`, preview the before/after result, and require explicit author
     confirmation before writing the existing immutable event ledger.
  4. Show the confirmed change in the character's Continuity and Mechanics
     sections with a direct return to the source scene. Preserve the current
     deterministic validation, replay, stable actor IDs, and author-approval
     boundary.
  5. Put ruleset templates and definition types/limits under `Advanced
     rules`; level/XP, runtime effects, inventory/equipment/statuses and
     history repair under `Advanced sheet and state`; and compendium,
     progression, recipes, milestones, zones, settlement, import/export, and
     memory/promotion under their deliberate advanced or utility surfaces.
     Existing projects and advanced capabilities remain fully editable.

  Desktop and narrow author acceptance is defined in
  `docs/smoke-tests.md` § 4. 4.15 is not complete if it merely restyles the
  existing three-route sequence: it must remove repeated discovery and
  prerequisite entry from the basic path while retaining deterministic
  persistence and explicit author confirmation.
- **4.15 Progressive mechanics experience.** Implement the audited basic
  path without reducing underlying power: contextual calls to action,
  plain-language empty states, useful defaults, and a deliberate `Advanced`
  reveal for formula/effect/runtime controls. Keep Ruleset, Sheets/State,
  Mechanics, and Settlement optional and project-mode gated; do not imply
  that a fiction project is incomplete without them.

### Prose-proximate item and state authoring (4.16)

Execution order: **4.16a → 4.16b → 4.16c**. Each child slice receives its
focused automated coverage and commit; the umbrella closes only after the
full verification battery and desktop/narrow smoke authority pass.

- **4.16 Prose-proximate item and state authoring.** Let acquisition, use,
  equipment, and consumption prose open a compact Workspace proposal at the
  selection/cursor rather than requiring navigation to World Bible, Sheets,
  or Compendium. For a first mention such as `Bill found a health potion`,
  default to the scene-scoped inventory event and offer explicit reusable
  World Bible item creation/linking. For a first use such as `Bill drank a
  health potion`, offer an editable tracked-attribute effect and an explicit
  `remember this effect` choice; later exact linked uses may prefill the
  approved effect. Show the combined before/after preview and commit all
  requested definitions/links plus the accepted state event through one
  deterministic rollback-safe confirmation. Handle ambiguous matches,
  absent inventory, cancellation, stale prose, and general-fiction mode
  without silent canon, mechanics, acquisition, or state writes. Preserve
  definition/event separation and stable-ID rename behavior from
  `docs/domain-model.md`; implement the desktop/narrow acceptance authority
  in `docs/smoke-tests.md` § 5. Determine whether persisted links require a
  schema migration before UI work. Persist stable reusable-item references
  through inventory commands/state, replay, snapshot, backup, and rename;
  include migration coverage for every changed persisted shape.
- **4.16a Stable item references + atomic orchestration.** Add optional stable
  World Bible/Compendium references to reusable inventory commands and replay
  state while retaining name-only quick entries. Version and migrate every
  persisted contract that requires it. Add exact/ambiguous resolution and a
  deterministic service that validates the full requested item/effect/event
  plan, applies it in dependency order, and restores prior state on failure.
- **4.16b In-workspace acquisition proposal.** Extend the existing positioned
  state-change composer so selected/cursor acquisition prose prefills actor,
  item, quantity, evidence, and before/after inventory result. Default to
  state-only; disclose reusable World Bible item creation/linking explicitly.
  Keep the interaction in Workspace and preserve focus, cancellation, stale
  evidence, desktop, and narrow behavior.
- **4.16c Consumption effect authoring + prose integration.** Resolve exact
  approved consumables, offer first-use attribute/effect authoring and
  `remember this effect`, combine inventory and effect preview, and handle
  missing inventory with the three explicit branches. Wire deterministic
  acquisition/consumption observations into the same editable proposal,
  never direct persistence. Close with duplicate/ambiguity/rename/rollback
  tests, routed UI coverage, full battery, and smoke § 5.

Slices 4.17–4.22 were added on 2026-08-29 by the v1 scope change recorded at
the top of this file. 4.17–4.20 are the writing coach and the surface it
reports into; 4.21 and 4.22 came out of the same research but are independent
product work that stands without the coach.

Ordering: 4.17, 4.19, and 4.21 may start independently. Research and prose
drafting for 4.18 may run alongside 4.17, but its validated package uses the
schema and indexing contract established by 4.17. Slice 4.20 is last and
depends on 1.5, 4.17, 4.18, and 4.19. Slice 4.22 depends on 1.5. Slice 4.21
is not a hard dependency of anything; 4.18 can teach its negative-space
pattern without claiming that the manuscript was checked for it.

- **4.17 Craft library retrieval infrastructure.** Structural groundwork for a
  curated writing-craft reference kept strictly separate from project data and
  canon. Add a coach-scoped, read-only provider and a distinct `craft` metadata
  type. Do not add the provider to the ordinary project `CompositeRAGService`:
  normal assistant search, factual evidence gates, canon decisions, context
  health, backup, and project deletion must never consume or own craft chunks.
  Embed the library at build time and ship the vectors, recording embedding
  model, version, dimensions, normalization, and content version. Query-time
  vectors must use a compatible contract; incompatible or unavailable models
  fall back to lexical search rather than comparing mismatched dimensions.
  Tests prove offline retrieval, provenance labels, route isolation, and safe
  behavior with an empty or token library. This slice carries no real-content
  dependency.
- **4.18 Craft library content — tranche 1.** Author 6–8 vetted craft
  patterns, mixed general-craft and LitRPG/RPG-specific, in the versioned form
  defined by 4.17. **Source material:** `docs/research-litrpg-genre.md`
  (subgenre taxonomy, platform conventions) and
  `docs/research-litrpg-craft-failures.md` (28 candidate patterns with source
  confidence and detectability marks, plus a suggested tranche-1 selection in
  its Part C). The parallel large-corpus production and QA brief is
  `docs/writing-coach-corpus-production-handoff.md`; it is a working handoff,
  not a second roadmap or a substitute for this slice's completion gates.
  Correct the research against your own reading before drafting — it is input,
  not settled content, and every claim carries a confidence mark for that
  reason. **Schema:** each pattern needs a stable ID and version,
  author-vetted status, citations and source-confidence, genre applicability
  and exclusions/modifiers, what it is, what it looks like when present, what
  its absence looks like, and what to do about it. It also needs a
  `detectability` field (`deterministic` / `model-assisted` / `practice`) and a
  scope (`selection` / `scene` / `chapter` / `manuscript` / `series` /
  `practice`). A deterministic label is permitted only for a metric or
  observation computed entirely from explicit stored data; semantic meaning
  remains model-assisted even when deterministic code supplies candidates. The
  detectability field is load-bearing: without it the coach can claim to have
  checked the draft for a pattern that is not present in prose at all, which is
  precisely the kind of unearned claim the trust boundary exists to prevent.
  Content drafting may run in parallel, but this remains a roadmap slice: claim
  it, validate every record against the schema, complete an author source and
  wording review, test retrieval/citation rendering, commit it, and close it on
  the status board. Tranche 1 unblocks 4.20 and is tested with outside readers;
  the remaining patterns continue as a parallel track and are not a release
  gate.
- **4.19 Derived story dashboard.** Read-only panels inside Corkboard,
  computed from explicit manuscript, state, ruleset, and planning data. The v1
  deterministic foundation includes scene/chapter word counts, dialogue ratio,
  accepted state-change distribution, and advancement intervals where the
  relevant value is explicitly tracked. Every metric names its inputs and
  links to its source scenes. POV, agency, setup/payoff significance, and other
  semantic interpretations belong to author-triggered coaching in 4.20, not to
  the deterministic foundation.

  Mechanics-enabled projects also receive descriptive multi-axis co-movement,
  tier-interval, and advancement-rate metrics. The dashboard may say that
  several tracked values moved together; it may not deterministically conclude
  that the supporting cast is redundant or that pacing is wrong. Plan-versus-
  draft comparison requires an explicit stable ChapterCard-to-scene link;
  title/order heuristics must not invent one. If that link requires a persisted
  shape change, version project storage and backup contracts before the panel
  ships. Mechanics panels stay invisible in general fiction.

  The research's 34% series-longevity figure is vendor-reported directional
  evidence, not a product-weighting rule. Outside-reader validation of tranche
  1 decides the relative emphasis between dashboard and inline coaching.

  Governing rules:
  every observation cites the scenes it came from; nothing on a derived panel
  is editable; authored cards and derived observations must never look alike.
  Deterministic passes need no provider and land first so the dashboard is
  useful before any key is configured. This dashboard is a deliberate override
  of the archived market report's narrower MVP cut; keep it close to continuity
  and structural observation rather than expanding into broad prose editing.
- **4.20 Writing coach experience.** The coach is reachable two ways, and the
  two carry deliberately different scopes. **Inline:** anywhere the author
  already interacts with the AI, invoked by explicitly asking for its opinion,
  scoped to the selection or scene — "is this passage doing the thing."
  **Dashboard:** its own section in 4.19, scoped to the whole manuscript —
  "does this book have the shape." Keep the two scopes separate in the
  implementation; if they are not, the inline path drifts toward
  whole-manuscript analysis and becomes slow and vague. Coaching is
  author-triggered only — never passive, no background provider cost, no
  unsolicited interruption of drafting. Every coaching note pairs library
  instruction with cited evidence from the author's own draft, and library text
  is never presented as the author's established canon. The coaching response
  itself is read-only advice. Only an explicit follow-up action such as saving a
  note or applying a selected revision uses the shared proposal surface from
  1.5, with preview and author confirmation.
- **4.21 System negative-space records.** A World Bible record type for
  **problems the system cannot solve** — the things a character cannot fix by
  getting stronger. The craft rationale: every capability gain that also
  shrinks a human problem moves a book toward competence porn, and the
  recommended authorial practice is to keep this list explicitly. A
  first-class record can deterministically summarize author-maintained status
  and explicit scene links. Whether prose meaningfully engages the problem, or
  whether a power has quietly solved it, remains model-assisted.

  Independent of the coach, the dashboard, and the craft library — it is a
  small domain addition that stands on its own and can land at any time. It
  can upgrade the structured-status portion of P4 from practice to
  deterministic; semantic manuscript assessment remains model-assisted.
  Update `docs/domain-model.md` when the contract lands. Gated to
  mechanics-enabled projects; general fiction unchanged.
- **4.22 Progression continuity candidates.** Two observations that overlap
  craft and canon consistency:
  **unused solutions** — a character possesses an ability that would plainly
  resolve the situation and the text never has them consider it (abilities to
  watch most carefully: movement, teleportation, and anything time-related);
  and **abandoned progression methods** — a rapid-advancement mechanic is
  established in canon and then never referenced again, with no in-world reason
  given. Deterministic code can shortlist abilities, items, methods, state, and
  scenes with no explicit linked or lexical reference. It cannot decide that an
  ability would resolve a narrative situation or that no adequate reason was
  given. Those conclusions are model-assisted, author-triggered, cited, and
  schema-validated through 1.5.

  Findings go to the existing review queue with scene citations, as deferred
  and dismissible like every other review surface — these are observations, not
  errors, and a false positive must cost the author one click. No provider call
  runs in the background. Source: `docs/research-litrpg-craft-failures.md` §B2.

### Continuity engine hardening (4.23–4.27)

Added 2026-09-12 from a code review of the continuity engine: the
deterministic review pipeline (`services/consistency`, `services/worldEngine`,
`hooks/useWorkspaceConsistency.ts`), the manuscript-time state ledger and
replay (`services/state`), and the assistant's temporal custody grounding
(`services/assistant/temporalCustody.ts`). The trust boundary holds throughout
(models propose, deterministic code validates, authors approve) and entity
matching has been dogfooded hard through 1.2a–1.2d. The gaps are in what the
engine can *say* once names resolve:

1. **Canon contradiction detection is narrow.** `contradictionReview.ts`
   flags only two shapes: an `X is/was (not) Y` assertion whose exact
   descriptor appears negated in canon, and one hard-coded attribute, eye
   color. Accepted `CanonicalFact`s carry `age`, `occupation`, `membership`,
   `heritage`, `appearance`, `relationship`, and more, but only `appearance`
   eye color is compared. "Sera is left-handed" versus "Sera is right-handed"
   is not a conflict today because the descriptors differ. Four unit tests
   cover the whole detector.
2. **Contradictions ignore manuscript order and state.** Canon facts have no
   time validity and the detector never consults the accepted mutation ledger
   or `replayCharacterState`, so a fact that legitimately changes across the
   book (healed, renamed, defected) reads as a conflict in every scene on the
   wrong side of it, and "uses the potion two chapters after drinking it" is
   not a review item at all. The custody logic that answers that question
   correctly for the assistant (1.2b) is not reused by review.
3. **General fiction has no state at all.** `stateMutationDerivation.ts`
   drops every observation whose actor has no `CharacterSheet`, and sheets
   require a ruleset. Location and custody observations are extracted for
   general-fiction projects and then discarded. The domain model already
   names descriptive state (location, allegiance, disguise) as a field family;
   nothing implements it without mechanics.
4. **Project review is neither persisted nor incremental.** Results live in
   React state, so a reload empties the review queue; every run re-reviews
   every scene (and, with the local-AI engine, re-annotates every issue),
   with only dismissals persisted in `localStorage` prefs.
5. **Placeholder contract fields.** `ExtractedProposal.intents` and
   `ValidationResult.proposedMutations` are typed `Array<Record<string,
   never>>` and always empty; `INVALID_MUTATION` is a declared issue code that
   no code path produces even though `validateStateMutationCommandAgainstState`
   exists.
6. **No regression corpus.** The trust-dogfood chapters and answer key are
   the only realistic text, and they are exercised by hand, not by tests, so
   precision changes to the matcher or detector are unmeasured.

Ordering: 4.23 first, so every later change reports precision against the
same corpus. 4.24 and 4.25 are independent of each other. 4.26 depends on 4.23
and should follow 4.24 (it reuses the rule registry's conflict contract). 4.27
depends on 4.26 and is a post-beta candidate. All are deterministic-first; any
model involvement is confined to the existing 1.5 proposal surface and is not
required by any slice below.

- **4.23 Continuity review regression corpus.** A checked-in, test-driven
  corpus for the review pipeline: scene texts plus canon (entities, aliases,
  accepted facts, and, for the mechanics cases, a ruleset, sheets, and ledger
  events) with an expected-findings list per case (issue code, entity, scene,
  focus text) and an explicit expected-*absence* list for the known
  false-positive shapes fixed in 1.2d and the smoke history (self-alias,
  sentence-start words, in-progress name prefixes, possessives, article-
  equivalent names, Bran/Brannic boundaries). Seed it from
  `fixtures/trust-dogfood/chapters` and `answer-key.md` and from the sample
  project, keeping the text short enough to read. One table test runs the
  deterministic engine and `findCanonContradictions` over every case and
  reports precision/recall counts in the assertion message so a regression
  names what it lost. No behavior change; the slice is done when every
  current finding is encoded and the suite is green. Record the corpus
  location in `docs/smoke-tests.md` so manual smokes reference the same
  cases.
- **4.24 Fact-anchored canon contradiction detection.** Rewritten
  2026-09-12 after the author rejected a rule registry: fiction has too many
  edge cases for hard-coded attribute rules, and a registry of lexicons (eye
  colors, hair colors, heights) is the same mistake generalized. The
  engine may know **linguistic** value classes that apply to anything in any
  story — colors, numbers and number words, negation, a handful of
  comparatives — but it must never carry **fictional** attribute lists.
  Which attributes matter comes only from the author's accepted facts.

  Replace the eye-color special case in `contradictionReview.ts` with a
  structural comparator anchored on each accepted `CanonicalFact`:
  1. From the fact's value derive a *slot*: head noun (last token, with a
     singular/plural stem) and modifiers (the rest), or a number for numeric
     values. "gray eyes" → noun *eyes*, modifier *gray*; "twenty-six" → 26;
     "black scales" → noun *scales*, modifier *black*. Single-token values
     ("cartographer") keep the existing subject-assertion path (`X is/was
     (not) Y`).
  2. Find scene blocks attributed to the fact's entity using the existing
     attribution logic, fixed for the corpus `knownGap`: in a quoted block
     with a speaker tag, the speaker is not a candidate for claims inside
     the quotes; second-person claims use the preceding narrative block's
     entity, as today.
  3. In those blocks, locate the slot noun and the modifier occupying it
     (up to three tokens before, or within the existing 48-character window
     after). A competing modifier is a conflict only when it is *explicitly
     comparable* to the accepted one: an explicit negation of the accepted
     value, a different number for numeric facts, or a member of the same
     value class — a class known linguistically (built-in colors, numbers)
     or learned from the author's own canon (every other accepted value of
     the same fact type with the same head noun). Adjectives outside any
     known class ("tired eyes", "wide eyes") never fire.
  4. Value normalization (grey/gray, colour/color, number words → digits) is
     a small data table, not code paths, and takes an optional per-project
     synonym list so an author-editable list can be added later without
     touching the comparator.
  Every conflict cites the fact, its Source Note or record, and the scene
  span exactly as today; the `STATE_CONFLICT` contract, highlights, and
  dismissal are unchanged. Free-text field scanning of records stays as
  the fallback it is today. No model calls. Measure against the 4.23
  corpus: C1 stays a hit, its agreeing and wrong-entity cases stay non-hits,
  the speaker-attribution `knownGap` must heal (remove it from the corpus),
  and add cases for a non-appearance slot (e.g. "black scales" vs "crimson
  scales"), a numeric age mismatch, a negation ("no longer a member"), and
  a transient adjective that must not fire. Update `docs/domain-model.md`
  §1 with the comparator contract and the linguistic-versus-fictional rule.
- **4.38 Model-assisted canon check (author-triggered, via 1.5).** The edge
  cases structural comparison cannot reach — paraphrase, implication,
  "the same green her mother had" — need reading, not matching. An explicit
  **Check this scene against canon** action sends one scene block and the
  accepted facts for the entities it mentions to the configured provider
  under the 1.5 proposal surface; the model returns candidate contradictions
  as `{factId, evidence: {start, end, text}, summary}`; deterministic code
  validates that each span exists verbatim in the scene and each fact id is
  real, then the survivors enter the review queue as dismissible items
  labeled model-assisted. Nothing is applied automatically, nothing runs in
  the background, and the action consumes a consultation. Scheduled after
  4.24 and 4.39 (the budget model this action spends against). Add
  corpus cases that document which structural non-hits this path is meant
  to catch, so the two detectors are measured separately.
- **4.39 AI consultation budget model + point-of-use explanation.** Promoted
  from the Backlog on 2026-09-12: the budget was accepted as-is when it had
  two consumers, but 4.33 (World Canvas brainstorming) and 4.38
  (model-assisted canon check) both spend against it, and the 1.1 dogfood
  already logged that its limit, consumers, and reset timing are invisible
  at the point of use. Today `services/editor/inspectorBudgetService.ts`
  keeps one per-project daily counter in `localStorage`, incremented by the
  assistant, the writing coach, progression continuity, workspace context
  actions, and canon-decision consultation, with no shared display.

  Settle and implement four decisions. **(a) What it protects.** Recommended:
  runaway loops and surprise provider spend, not rationing deliberate work;
  an author who wants more should be able to raise it. **(b) Scope.**
  Recommended: keep one per-project budget rather than per-feature counters,
  because an author thinks in "requests this project made today", but record
  which feature spent each unit so the explanation can break it down.
  **(c) Whether Ollama counts.** Recommended: no. A local request costs
  nothing and sends nothing, so counting it contradicts the privacy pillar's
  own framing; keep a separate, higher loop guard for local requests so a
  runaway still stops. This is the decision most worth the author's explicit
  sign-off. **(d) Where it is explained.** Every action that spends a unit
  states the cost before the request and what remains after, in plain
  language, beside the button rather than in Settings; Settings gains the
  limit, the reset time in the author's own timezone, and a per-feature
  breakdown of today's usage.

  Keep it local: no telemetry, no server-side accounting, no account. The
  budget remains a local convenience, so clearing site data resets it and
  that is acceptable. Extend the existing service rather than adding a
  second counter, and keep the over-budget message actionable (what to do
  now, when it resets, how to raise it). Update
  `docs/product-blueprint.md` with the model and the point-of-use rule, and
  `PROJECT_STATUS.md` when behavior changes. Unit tests for scope, reset
  boundaries, and the Ollama exemption; Cypress for the point-of-use display
  and the over-budget path; no new persistence beyond the existing
  `localStorage` key (document any key change and its migration).
- **4.40 Local model runs: no response cap, visible thinking, elapsed time,
  Stop.** Author-requested on 2026-09-19. Local (Ollama) models are slow on
  large models and many think before answering; the inspector's response cap
  (default 500 tokens, sent as `num_predict`) protects nothing locally and let
  thinking consume the whole reply, and nothing in the UI distinguishes a slow
  model from a hung one. For local providers only: send no response-token cap
  and leave thinking at the model's default instead of forcing it off. Every
  author-triggered model call (writing assistant and the context actions that
  route through it, writing coach, progression continuity, canon-decision
  consultation, World Canvas brainstorming) streams through one shared run
  helper that separates thinking from the answer, and one shared progress
  component that shows the phase (thinking / writing), elapsed time, the
  thinking text live in a collapsible area, and a **Stop** button that aborts
  the request. After a run the thinking stays available behind "Show
  thinking" for the latest reply only; it is never persisted, indexed, or
  sent back to the model. Answers never include thinking text (today coach,
  progression continuity, and canon decisions would show raw `<think>` tags).
  Hosted providers keep today's cap and behavior; that is 4.41. The Local AI
  review engine keeps its own timeout and bounded cap (it runs as part of
  review, not as a watched request). Unit tests for thinking/answer
  separation (per-chunk `<think>` wrappers, unclosed and leading-close forms)
  and the cap resolution; component tests for phase, elapsed time, Stop, and
  "Show thinking"; Cypress for a streamed local run with thinking and Stop.
- **4.41 Hosted response limits as a cost ceiling.** Plan first, then build.
  For hosted providers the response cap is the only per-request spend limit,
  and thinking tokens bill as output. Today no request enables provider
  thinking, the app never detects a reply cut off at the cap (Anthropic
  `stop_reason`, OpenAI/Gemini `finish_reason`), OpenAI reasoning models
  expect `max_completion_tokens` rather than `max_tokens`, and Gemini 2.5
  models think by default against `maxOutputTokens`. Produce a short planning
  note settling: the cap as a stated cost ceiling (worst-case cost per request
  for the chosen model, from a maintained price table), a per-provider
  thinking policy and allowance, cut-off detection with a plain-language
  message, and whether per-feature caps are needed. Then implement the
  accepted plan.
- **4.25 Persisted, incremental project review.** Persist the last project
  review per project through a service (no new direct persistence path; a
  project-scoped store following the `consistencyStorage.ts` pattern, or the
  existing guardrail-event store if its shape suffices) keyed by scene id and
  a content hash of the reviewed text, plus the canon inputs' hash. On the
  next run, scenes whose hash is unchanged reuse their stored findings and
  annotations instead of re-running extraction and, with the local-AI engine,
  re-requesting annotations; contradictions still recompute in full because
  canon may have changed. On reload the review queue restores the last run
  with its timestamp, and a scene edited since the run shows a stale marker
  on its items until re-reviewed. Include the stored review in project
  backups only if the snapshot schema already carries review state; otherwise
  leave it out and say so. Existing dismissal prefs are unchanged. Verify with
  a long-manuscript timing check in the commit message (scene count, first
  run, second run) and Cypress coverage for reload restore and the stale
  marker.
- **4.26 State-backed continuity checks.** Give review the ledger it already
  has. For projects with a ruleset and sheets, add deterministic `STATE_CONFLICT`
  warnings (never blocking) that compare a scene's observations against
  `replayCharacterState` as of the scene's order: an item used, equipped, or
  handed over after the ledger shows it consumed or removed with no later
  acquisition; an equip/attack with an item the ledger shows unequipped or
  absent; a location claim that contradicts the last accepted `location_set`
  with no movement cue in between. Reuse the ordered-scene custody walk from
  `services/assistant/temporalCustody.ts` rather than re-deriving it, and
  extract the shared part into `services/state` so the assistant and review
  answer identically. Wire `INVALID_MUTATION` to
  `validateStateMutationCommandAgainstState` for review-derived events that
  fail replay validation, and delete the empty `intents` /
  `proposedMutations` placeholders (or type them honestly if a consumer
  exists). Each finding cites the earlier scene it conflicts with. Extend the
  4.23 corpus with the Pale Draught / storage-question cases from the
  trust-dogfood answer key. General fiction is unchanged by this slice.
- **4.27 Sheet-free descriptive state for general fiction.** Post-beta
  candidate. Let canonical characters carry descriptive state (location,
  custody of named items, and later allegiance/disguise) without a ruleset or
  `CharacterSheet`: a minimal replay target keyed by World Bible entity id,
  the existing `location_set` / `inventory_*` commands only, and the same
  accepted-ledger, scene-ordered, invalidatable rules as mechanics state.
  Derivation stops discarding sheet-less observations; the Workspace
  acquisition proposal (4.16b) and Character continuity section gain the
  state-only path for general fiction; 4.26's checks then apply to every
  project mode. Project and snapshot schema bump with a migration and
  restorable backup per 4.2. Update `docs/domain-model.md` §3 (subject scope)
  and the smoke procedures. Do not add stats or resources to general
  fiction; this is descriptive state only.

### Research-promoted: temporal canon and portability (4.28–4.29)

Added 2026-09-12 after reviewing `docs/tactical-actions.md`. Of its five
actions, two map onto real product gaps that fit the writing-first,
local-first boundary; the rest are recorded in the Backlog or the marketing
plan with the reasons they were not scheduled.

- **4.28 Manuscript-order validity for canon facts.** Accepted facts are
  currently timeless, so a fact that legitimately changes across the
  manuscript (healed, renamed, defected, promoted) contradicts every scene on
  the wrong side of the change. Add optional `validFromSceneId` and
  `validUntilSceneId` to `CanonicalFact` (resolved to scene order at use
  time, never stored as ordinal positions, so reordering scenes does not
  corrupt validity), with project/snapshot schema bumps and migrations per
  4.2. Canon Decisions gains an "as of this scene" control on acceptance and a
  **supersede** outcome: accepting a later conflicting fact closes the
  earlier one at that scene instead of forcing a reject. The 4.24 rule
  registry, the 4.26 checks, and the assistant's canon grounding all filter
  facts by the scene being reviewed or asked about, and the assistant states
  the validity window when it cites a superseded fact. Deterministic
  throughout; the sample project's built-in conflict should become a
  supersede example. "Who knows what" (character knowledge attribution) is
  explicitly out of scope; see Backlog.
- **4.29 Portable Markdown/CSV export + Markdown-folder import.** Portability
  is a stated differentiator and a trust promise. Export: the World Bible
  (one Markdown file per record with YAML frontmatter for category, aliases,
  links, and accepted facts; one CSV per category) and Source Notes as a
  folder, plus a documented schema page that 5.8 links from Help. Import: a
  folder of Markdown files (an Obsidian vault is the reference case) with
  frontmatter mapping, `[[wikilinks]]` proposed as links or aliases, and each
  file offered as a Source Note or a World Bible draft; everything flows
  through the existing extraction and review pipeline, so nothing becomes
  canon without acceptance. Reuse `services/lore/loreImport.ts` and the World
  Bible document import; no new persistence path. The backup zip remains the
  full-fidelity format; this is the human-readable one. World Anvil import is
  not in scope until its export format is verified (Backlog).

### World Canvas (4.30–4.34c)

Accepted 2026-09-12 from archived `docs/archive/world-canvas-plan.md`, which holds the
initial product finding, the original IA (a third World Bible view mode beside
`category` and `review`), the data-ownership and trust flow, and the full
self-contained implementation prompt, acceptance criteria, and test
expectations for 4.30–4.33. Those slices are complete. The 2026-09-20 author
walkthrough in `docs/world-canvas-findings.md` is evidence for the accepted
follow-up direction, but this roadmap remains authoritative for 4.34–4.34c.

- **4.30 World Canvas record, view mode, premise, lenses, questions** —
  plan § WC-1. New `world_canvases` IndexedDB store (project-scoped),
  snapshot schema 6 → 7, backup round-trip. Freeform prose only; no
  completeness indicators of any kind.
- **4.31 Bridges to Source Notes and World Bible** — plan § WC-2. The only
  new arrow in the trust flow is "Keep as Source Note"; everything after it
  is the existing extraction and Canon Decisions pipeline. "Propose as
  canon" opens the normal World Bible create form prefilled.
- **4.32 Derived return experience** — plan § WC-3. Deterministic per-lens
  summaries and a "worth a look" list whose every item states its rule;
  never a percentage or score; general fiction never framed as incomplete.
- **4.33 Author-invoked brainstorming** — plan § WC-4. Through the 1.5
  proposal surface with a zod-validated, capped response; per-item Keep as
  Source Note / Add as question / Dismiss; nothing persists otherwise; shares
  the project consultation budget, whose model 4.39 settles first.
- **4.34 Purpose, Planning IA, guided focus, and lens collapse (WC-5, M).**
  Reframe Corkboard and World Canvas as sibling brainstorming tools: Corkboard
  develops what happens and in what order; World Canvas develops a core idea
  through directed questions that reveal pressures, possibilities, conflicts,
  and consequences. Move World Canvas from the World Bible category rail to a
  dedicated route in the existing `Planning` navigation group beside
  Corkboard. World Bible remains the only canon owner; retain a contextual
  path between Canvas and World Bible without presenting Canvas as a canon
  category. Rename author-facing `Premise` to **Core Idea** without renaming
  the persisted field. Use one coherent explanation: the Canvas is the
  developing picture and a lens brings one part into focus. Replace **Open
  lens** with **Bring into focus**; familiar controls such as **Collapse** stay
  literal rather than forcing metaphor onto every action.

  Add progressive, non-AI help to each lens: one strong directed question in
  the closed state, a concise "what this can uncover" explanation, and an
  optional small set of examples/question starters. These are prompts, never
  fields or a checklist. Teach both valid entry moments in onboarding and
  empty-state copy: start from a spark before drafting, or return with existing
  material to discover further implications. Do not claim that Canvas reads or
  analyzes chapter prose; today it does not. Onboarding must teach the coherent
  metaphor without turning every control into themed jargon: the **Canvas** is
  the developing exploratory picture, a **lens** brings one part into focus,
  and repeatable **sketches** are provisional studies that may later develop
  into Source Notes, Open Threads, or accepted canon. No lens is completed by
  answering its opening question once.

  An opened lens must be collapsible without deleting, unlinking, or hiding its
  authored work from backup. Separate "this lens has durable content" from
  "this card is expanded" with an additive, backward-compatible presentation
  state; old records default safely and no trim/removal of a persisted lens kind
  is allowed. Visually separate author writing, derived references, and model
  suggestions. Remove the current flattened **From saved material** block from
  inside lens cards, but preserve the stable link and derivation services for
  4.34b. Move `Other records` out of the lens list. Keep the existing one-note
  lens and Questions persistence unchanged in this slice; 4.34a performs their
  lossless transition after the new route, hierarchy, and guidance are stable.

  Acceptance: desktop and narrow navigation expose both brainstorming tools
  under Planning; onboarding reaches the dedicated Canvas route; World Bible
  no longer presents Canvas as a category; existing Canvas data loads without
  loss; a populated lens can collapse, survive reload/backup round-trip, reopen,
  and retain exact text and links; blank and mature projects receive accurate
  guidance; all controls are keyboard reachable and save/status announcements
  remain correct. Update `docs/product-blueprint.md`, `PROJECT_STATUS.md`, and
  the relevant smoke guidance; archive the original prompt/plan only after the
  replacement durable decisions have been folded into the authority docs.

- **4.34a Repeatable lens sketches, Open Threads, and Core Idea bridges
  (WC-6, L).** Replace the
  current one-per-lens `note` workflow with stable, discrete sketches. A lens's
  directed question is evergreen and reusable; it is not a field the author
  completes once. Each opened lens has one autosaved working composer plus a
  compact **Sketches from this lens** history. The author can start another
  sketch after deliberately routing the current one, while every earlier sketch
  remains visible with its destination and can be reopened. Never clear the
  composer merely because autosave ran. After a successful route, transition
  the sketch out of the composer only through an explicit **Add another sketch**
  / equivalent action, and never discard text on a cancelled or failed route.

  Add a versioned, lossless Canvas migration from each existing lens `note` to
  its first stable sketch, preserving timestamps and every linked Source Note
  and World Bible id. Define where legacy lens-level links live after migration
  before changing the type; backups, restore, project deletion, and older
  snapshots must remain safe. Each sketch needs stable identity, text,
  created/updated timestamps, and enough destination/provenance state to show
  that it became or linked to a Source Note, Open Thread, or World Bible record.
  Do not silently infer a destination from prose.

  Replace the current **Questions** list with author-facing **Open Threads**:
  promising questions, tensions, possibilities, contradictions, or undecided
  ideas the author intentionally wants to revisit. Keep a compact manual **Add
  an open thread** control; no required kind/category selector. A retained
  brainstorm alternative, tension, implication, or question can become a
  thread without being rewritten into question grammar. Author-facing statuses
  are **Open**, **Settled**, and **Set aside**; migrate or compatibly interpret
  existing `open` / `answered` / `dropped` values without data loss. Settled and
  set-aside threads collapse into history. Lens association is optional; a
  thread captured from a lens inherits that association. Remove the 30-day
  stale-question rule.

  Remove **Worth a Look** from Canvas rather than renaming it. `needsCompletion`
  belongs to World Bible review, unresolved candidates belong to Canon Review,
  absence of a linked Source Note is not a defect, and age does not make a
  creative thread stale. Preserve or strengthen the owning review surfaces if
  removal would make an actionable item unreachable. Refine sketch actions:
  **Keep as Open Thread** retains exploratory pressure; **Develop as Source
  Note** creates/links a normal provenance-marked note; **Propose canon anchor**
  is available only for material suited to a World Bible entity, not arbitrary
  assertion prose. Any future path for settling an assertion as a canonical
  fact must use the existing reviewed canon workflow and is not invented here.

  Give **Core Idea** the same explicit path out of Canvas instead of leaving it
  as an isolated `premise` string. **Keep as Source Note** creates a normal,
  provenance-marked Source Note (for example, `From World Canvas — Core Idea`),
  indexes it through the existing Source Note path, links it back to Core Idea,
  and never changes canon. The saved note is an author-chosen snapshot: later
  Core Idea edits do not silently rewrite it. Surface the linked note with the
  same open/unlink and missing-target behavior used elsewhere, and prevent an
  accidental repeated click from creating indistinguishable duplicate notes.
  Preserve the persisted `premise` field name for compatibility; add only the
  smallest backward-compatible link/provenance state needed for the bridge and
  include it in backup/restore.

  Also offer **Propose canon anchor** from Core Idea through the existing normal
  World Bible create form, with an author-selected category and a suggested
  concept/setting-style destination when one exists. Saving remains an explicit
  author action and links the resulting record back to Core Idea; do not write
  accepted facts directly, canonize the whole paragraph automatically, create
  a second canon owner, or treat theme, questions, and possibilities as factual
  assertions. This is the conservative overarching-canon placement for 4.34a.
  Add a product checkpoint after hands-on use and before 4.34b: decide whether
  a normal World Bible concept/setting anchor is sufficient or whether authors
  need a first-class, project-level **World Foundation** canon concept. Any such
  first-class owner is a separate domain decision and follow-up slice, not an
  assumption inside 4.34a.

  Acceptance: migrate an existing populated seven-lens Canvas and preserve
  exact text/links through reload and backup round-trip; create and route
  multiple non-conflicting sketches from the same lens; verify failed/cancelled
  routes retain the composer; keep statement-form and question-form Open
  Threads; settle and set aside without deleting; confirm no age-based warning
  appears; confirm every removed Worth a Look signal remains available at its
  legitimate owner where applicable. From Core Idea, create and open a
  provenance-marked Source Note, confirm later Core Idea edits do not silently
  mutate it, verify duplicate-click protection and stale-link handling, and
  complete a prefilled normal World Bible proposal whose saved record links
  back without any direct canon/fact write. Record the post-use decision on
  whether that anchor is sufficient before starting 4.34b. Add
  service/migration/component tests,
  routed Cypress coverage, keyboard/a11y checks, and desktop/narrow manual
  smoke.

- **4.34b Reference Palette foundation (WC-7, M).** Replace the ambiguous
  saved-material inventory with a separate, clearly attributed **Reference
  Palette** that supports the return-to-a-project journey without competing
  with the author's canvas writing. Preserve and reuse the existing stable
  `linkedEntityIds` and `linkedSourceNoteIds`. Refactor derived resolution to
  return structured reference objects with stable id, label, source type,
  lens association, existence state, and provenance instead of only flattened
  counts/names. Keep two explicit classes: **Pinned references**, deliberately
  chosen by the author, and **Suggested references**, associated by a stated
  deterministic rule. Never silently pin, unlink, or repair a reference.

  The palette supports browse, pin, unpin, open-source, and visibly stale
  references. World Bible material is labeled accepted canon; Source Notes are
  labeled source material. Conservative incomplete mapping is preferable to a
  false semantic match: mappings must be deterministic and tested, and
  unclassified project references belong in a separate browse area rather
  than a malformed extra lens. General-fiction projects remain free of
  mechanics-only suggestions. This slice changes no model prompt: Palette
  names, titles, summaries, and text are not newly sent to a provider. Unit
  tests cover suggested-versus-pinned resolution, dedupe, rename, deletion,
  custom categories, and project-mode filtering; Cypress covers pin/reload/
  unpin and navigation to both source types; manually verify blank and mature
  projects at desktop and narrow widths.

- **4.34c Craft-guided Canvas coaching (WC-8, M).** Add optional,
  author-triggered guidance grounded in the vetted craft library, using a new
  Canvas coaching contract rather than reusing the manuscript-revision coach
  prompt. The coach helps the author focus a Core Idea or opened lens through
  actions such as **Help me focus this**, **Ask a deeper question**, **Show the
  central tension**, and **Suggest clearer wording**. It teaches applicable
  craft patterns and proposes alternatives; it never judges unseen manuscript
  prose, establishes story truth, or writes into Canvas/canon/state directly.
  Suggested wording or questions use the shared proposal/preview/confirmation
  surface and leave the author's current text intact until an explicit choice.

  Retrieve only applicable author-vetted craft chunks and show their citations
  separately from project references. The request includes the explicitly
  focused Canvas text. Any Palette participation is author-selected and
  disclosed at point of use; default to record names/aliases only, and continue
  excluding Source Note text unless a later explicit product decision changes
  that boundary. Use `useConsultationBudget` with a distinct per-feature entry
  in the shared project ledger, the shared streaming/thinking/elapsed/Stop
  surface, hosted-provider disclosure, whole-response schema validation, and
  local Ollama exemption/runaway rules. Bad output fails closed. Add unit tests
  for retrieval query, trust prompt, selected-reference boundary, schema
  validation, and proposal behavior; Cypress covers no-provider, hosted
  disclosure, successful suggestion review, cancellation, and no direct write;
  manually check citations and disclosure in both themes.

Anti-goals hold across all eight: no scores, no questionnaire, no second canon
owner, no per-lens fields, no relationship graph, no RAG indexing of canvas
text, no model text written into the canvas.

### Corkboard ↔ scenes (4.35–4.37)

Accepted 2026-09-12 from `docs/corkboard-scenes-plan.md`, which holds the
verified current state, the recommended journey, the decision table with
defaults, and the full implementation prompt, acceptance criteria, and
test expectations for each slice. Read that document as the prompt; this
section only fixes IDs and boundaries. No slice changes a persisted schema
or adds AI.

- **4.35 Shared scene-link UI, quick-modal links, "Link current scene",
  stale links** — plan § CB-1. One `ChapterCardSceneLinks` component used by
  the dedicated route and the Workspace quick modal; stale-link chips with
  **Remove link**, never automatic pruning; **Open scene** beside each linked
  scene on the route. Also corrects the Corkboard wording in
  `PROJECT_STATUS.md` and removes "Corkboard graduation to a route" from the
  Backlog (the route exists).
- **4.36 "Create linked scene" from both surfaces** — plan § CB-2.
  `handleNewDocument` returns the created document; link is a second
  idempotent write; on link failure the scene stays and a **Link now** retry
  is offered. Title per the plan's decision table; the scene opens
  immediately.
- **4.37 Chapter-card context line in Workspace** — plan § CB-3. One line
  under the page header naming the linked card(s), opening the quick modal
  at that card or the dedicated route with the card selected.

Anti-goals across all three: no inference from titles or order, no
summary/beat/status syncing, no status suggestions, no one-card-per-scene
enforcement (a separate author decision if ever wanted), no new persistence.

### Character lab (4.42–4.45)

Accepted 2026-09-26 from `docs/character-lab-plan.md`, which holds the
principles, per-slice scope, and tests; read it as the prompt. Lab output is
creative draft text: it never writes canon, facts, state events, or
manuscript content without an explicit author action, and grounding is story
state at a scene position, not per-character knowledge.

- **4.42 Character voice contract** (after 3.10 and 4.46) — plan § 4.42. Read-only
  context builder (canon record, accepted facts, dialogue style, replayed
  state at a scene position) plus the shared in-character prompt module.
  No UI.
- **4.43 Talk to a character + reaction test** — plan § 4.43. World Bible
  character page and Workspace drawer; session transcript with Save to
  Scratchpad.
- **4.44 Character scenes** — plan § 4.44. 2–3 characters, Directed or
  Surprise me; Save to Scratchpad or Insert at cursor.
- **4.45 Character from a rough description** — plan § 4.45. World Bible
  draft plus fact proposals through existing review; identity resolution on
  collisions.

### Stat peek (4.46–4.48)

Accepted 2026-09-26 from `docs/archive/stat-peek-plan.md` (archived after 4.48), which holds the verified
current state, per-slice scope, and tests; read it as the prompt. Goal: any
character's stat block in a second or two while drafting or brainstorming,
without leaving the current surface. Read-only, and shown only when game
systems are enabled for the project.

- **4.46 Character snapshot service + shared stat card** — plan § 4.46.
  Extract snapshot assembly out of `useWorkspaceSceneRoster` into a pure
  service with a `changesSince` view, plus one shared card; the scene roster
  adopts both with no behavior change. 4.42 builds on the same service.
- **4.47 Peek from the editor and command palette** — plan § 4.47. Shortcut
  and context menu on a character name in Workspace; **Show stats for…** in
  the command palette on every route.
- **4.48 Pinned stat panel** — plan § 4.48. Up to three pinned characters in
  an app-shell panel on Workspace, World Canvas, Corkboard, Scratchpad, and
  World Bible; follows the cursor in Workspace, `latest` elsewhere.

### Local provider context parity (4.49)

Found 2026-09-27 during 4.42 and widened when 4.49 started. Only the
renderer's hosted adapters rendered `LLMRequest.context` (as `[Source: …]`
blocks in the system prompt). The renderer's Ollama adapter and every adapter
in the desktop main process (Anthropic, OpenAI, Ollama) sent only
`systemPrompt` and `messages`, so the assistant's canon/Source Note grounding
and the coaches' craft material never reached local Ollama in the browser or
any provider except Gemini in the desktop app. 4.49 renders context once, in
the renderer, with one shared formatter, before a request leaves for Ollama
or the Electron bridge; the IPC surface is unchanged.

### Opt-in AI scene drafting and text provenance (4.50–4.52)

Accepted 2026-10-03. Full design, decisions, and verification:
_[plan: archive/ai-scene-drafting-plan.md]_. Quiet, per-project, off by default;
platform-neutral, non-judgmental copy; no watermark removal.

- **4.50 (AD-1) AI text provenance.** An `aiText` TipTap mark applied only
  inside the app's insert transaction on every AI-to-manuscript path
  (assistant scene revision, character-scene Insert at cursor, and later
  scene drafts), non-inclusive at the edges, kept through edits inside;
  **Mark as my writing**; optional subtle highlight; exports strip the mark,
  backups keep it; invisible-character normalization on AI inserts.
- **4.51 (AD-2) AI text report.** Project-level count of marked words and
  passages per scene by origin and provider; platform-neutral, factual copy.
- **4.52 (AD-3) Opt-in AI scene drafts.** "Allow AI scene drafts" project
  setting (default off, advanced Settings, not inherited); **Draft this
  scene** on empty or near-empty scenes with editable, visible inputs,
  character-lab-style grounding, disclosure, budget, Stop, ~1,500-word cap;
  preview until Insert into scene (marked, undoable) or Save to Scratchpad;
  never writes canon, state, or records.

### Review model follow-up (4.53)

- **4.53 Model-assisted review items in the shared review model.** Promoted
  from the 4.38 limits on 2026-10-05; runs after 3.16, which makes room in
  the review hooks. Model-assisted canon-check items (4.38) currently live
  only in session UI state. Move them into the review model the deterministic
  items use: persist them and their dismissals with the project review run,
  underline their quoted text in the editor like other conflicts, and count
  them in the header review indicator, while keeping them labeled
  model-assisted, dismissible, never applied, and dropped when their quoted
  text leaves the scene. Cypress covers reload persistence, the underline,
  and the indicator.

### Dogfood document import (4.54–4.56)

Found on 2026-10-08 importing the author's real Echoes character and race
sheets (`Echoes consolidation/canonical/1 World Bible`): one Markdown sheet,
one Pages-exported DOCX, and several race sheets imported as a batch.

- **4.54 Document import structure fidelity.** Heading detection accepts only
  lines ending in a colon, so Markdown `##` headings and Word heading styles
  are invisible: Camila's sheet detects only `Open questions:`, and
  everything else lands in Description. `- **Age:** Mid-30s` is not read as
  a label row, and label rows are only mapped inside detected sections, so
  Age stays empty. The DOCX reader drops paragraph styles, so Leo's three
  Heading 3 paragraphs vanish and the second `Background:` swallows ~8,800
  characters. Two same-named headings mapped to one field overwrite each
  other, losing Leo's first Background. The heading list renders only the
  first eight rows. Required: detect Markdown ATX headings and DOCX heading
  styles (style id/name or outline level, including Pages exports); treat a
  leading title heading as the document title, not a section; read list and
  bold label rows; map label rows anywhere in the document; keep Markdown
  structure in Description instead of flattening it to plain text, with
  record-section titles rendered as headings; concatenate, never overwrite,
  sections that land in the same field; show every detected heading.
  Import still never writes canon facts. Unit-test fixtures that reproduce
  both sheets' structure (sections, name, Age, no lost Background content);
  the author's manuscript files stay out of the repo.
- **4.55 Import heading destinations.** After 4.54. Replace the
  Existing field / Record section / Reusable field / Ignore dropdown with a
  destination picker: each mappable field of the target category by label,
  **New field: <title>**, **Keep in Description**, and **Skip**. A heading
  whose title matches no field must never silently fall back to Description
  while labeled as a field. Re-derive open drafts' destinations whenever the
  category's fields change, so a field created by one import in a batch is
  offered to the drafts still open. Unsaved characters must show the
  category's custom fields (today they live only on the saved-only Notes
  tab). Unit and Cypress coverage for the picker and the batch carry-over.
- **4.56 Multi-document import flow + category manager dialog.** After 4.55.
  The import preview must say plainly that nothing is saved until a draft is
  imported, show per-draft status (waiting, imported with an Open link,
  failed with the reason), and keep remaining drafts reachable after
  **Import and open**. **Manage Categories** becomes a modal dialog on the
  shared dialog pattern (focus moves in, Escape and navigation close it)
  instead of an unfocused block in page flow that stays open across
  category switches and imports. Cypress covers a three-document batch and
  the dialog.

### Dogfood Source Notes (4.57–4.61)

Found on 2026-10-09 importing Echoes material into Source Notes. Source
Notes are stored, edited, and displayed as plain text end to end: a `.md`
import is detected as Markdown but saved as `plain_text`, so its markup shows
as literal characters; the Source Note DOCX reader (a duplicate of the
pre-4.54 one) strips all structure, so headings, lists, emphasis, and tables
are lost and every table cell becomes its own paragraph.

- **4.57 Source Note import fidelity + formatted display.** Note content
  stays text, now Markdown, so extraction evidence offsets, RAG indexing,
  the evidence gate, and portable export keep working on near-plain text.
  `.md` imports keep their content and are saved as `markdown`; notes saved
  as `plain_text` from a `.md` import before this fix are read as Markdown.
  DOCX imports go through the shared World Bible DOCX reader, extended to
  emit Markdown: heading styles, bullet/numbered lists (from
  `numbering.xml`), bold/italic, and tables as pipe tables (first row as
  header, merged cells padded, multi-paragraph cells joined with `<br>`).
  The old Source Note DOCX reader is removed. The Content field shows the
  formatted note by default for saved and imported notes, with an explicit
  switch to edit the Markdown; the rendered HTML is sanitized (allow-listed
  tags, safe link schemes only). Fact extraction tolerates Markdown label
  rows (`- **Age:** Mid-30s`) and treats `#` headings as sections. Import
  still never writes canon. Unit-test DOCX tables/lists/emphasis, the
  renderer's sanitization, legacy `.md` detection, and Markdown label
  extraction; Cypress covers importing a Markdown note and seeing it
  formatted.
- **4.58 Source Note visual editor (Markdown-backed).** After 4.57. Replace
  the Markdown textarea with the shared TipTap editor plus table support,
  serializing back to Markdown so stored content stays text. Round-trip
  tests must show that opening and saving a note without edits leaves its
  Markdown unchanged, so extraction evidence offsets do not move.

- **4.59 Remembered Markdown source view for Source Notes.** After 4.58.
  Authors who write Markdown must click **Edit Markdown** on every note,
  because each note opens in the visual editor. Add an app-wide preference
  (not per project), set from the Content field and listed in Settings
  beside the editor appearance controls, for which view Source Notes open
  in: visual editor (default) or Markdown source. Opening, creating, and
  importing a note honor it; switching views on one note does not change
  it unless the author chooses to remember the switch. Plain-text notes
  follow it too (their source view is **Edit text**). Unit-test the
  preference and each entry path; Cypress covers setting it once and opening
  a second note in Markdown source.
- **4.60 Collapsible Source Notes intake panel.** The **Start here** intake
  block takes a large share of the Source Notes page on every visit. Let
  the author collapse it to a single row that keeps **Start Writing** and
  **Import File** available (import has no other entry point), remember
  the choice per browser, and expose the toggle with `aria-expanded`.

- **4.61 Multi-file Source Note import.** Importing ~25 documents one at a
  time, each loaded into the form and saved by hand, made it hard to track
  what had been imported. Source Notes are never canon, so a batch needs no
  per-file review: choosing several files saves each as its own Source Note
  (same parsing as 4.57, same save, link, and index path as a manual save)
  from a modal dialog. Before starting, the dialog lists the files, marks
  any already imported (a note whose import file name matches,
  case-insensitively) as skipped, and offers one optional World Bible record
  to link every note to as its primary subject. While running it shows
  progress and cannot be dismissed; afterwards it lists imported (Open),
  skipped (Open the existing note), and failed (reason) files. A single
  file keeps today's load-into-the-form flow. No extraction runs
  automatically and nothing writes canon. Unit-test the batch service
  (duplicates against saved notes and within the batch, failures not
  stopping the batch, link and index calls); Cypress covers a three-file
  batch with one duplicate and opening an imported note.

### Dogfood assistant readability (4.65)

- **4.65 Assistant reply reading view.** Found on 2026-10-11 using **Ask the
  writing coach** for the first time: the advice was useful but hard to read
  in the 320px Workspace context drawer, which cannot be widened, and replies
  show Markdown markup as literal characters. Each assistant reply with
  content gets an **Expand** button that opens it in a wide modal reading
  view (bottom slide-up on narrow screens) with its Markdown formatted
  through the sanitized Source Note renderer, its craft references, and
  Copy/Close. Applies wherever the shared assistant appears. Display only:
  stored messages are unchanged and nothing is written. Escape closes only
  the reading view, not the narrow-viewport drawer behind it; focus is
  trapped and restored. A resizable context drawer stays a later option if
  dogfood shows the drawer is cramped beyond assistant replies.
- **4.66 Visible assistant selection handoff.** Found on 2026-10-11: the
  author highlighted a passage, clicked into the assistant, and the
  highlight vanished. Only the selection menu's **AI Expand** button or a
  right-click hands a passage to the assistant; otherwise the writing coach
  silently falls back to the whole scene. Rename the button **Ask AI about
  this**; while a passage is the assistant's context, keep it marked in the
  editor (a display-only decoration that follows edits and is never saved
  into scene content) and give the Selected text card a **Clear** action
  that returns the assistant to whole-scene scope and removes the mark.


Slices 4.67–4.74 come from a 2026-10-24 review of SillyTavern (AGPL-3.0:
borrow ideas and the public character-card format, never its code) and
KoboldCPP.

- **4.67 Local OpenAI-compatible provider.** Add one local provider for
  servers that speak the OpenAI chat-completions API: KoboldCPP (default
  `http://localhost:5001/v1`), LM Studio, and the llama.cpp server. It is
  labeled local, so it carries no hosted-data disclosure and is not counted
  as sending data off the machine. Base URL and model are configurable, with
  a connection test and model detection where the server lists models. Reuse
  the OpenAI request shape; do not route it through the hosted OpenAI
  provider, whose disclosure names OpenAI's servers. Desktop routing follows
  the existing Ollama path.
- **4.68 Constrained local output for proposals.** After 4.67, when the
  local server supports it, send a JSON schema or grammar with requests that
  expect structured proposals, so small local models return parseable JSON
  more often. First confirm what KoboldCPP and the other targets accept
  against running servers. This changes only how often parsing succeeds:
  every reply is still parsed strictly and validated by deterministic code,
  and nothing becomes canon without the author.
- **4.69 Character card import.** Import character cards in the public
  Tavern Character Card V2/V3 format (PNG with embedded JSON, or JSON),
  used by SillyTavern and many card libraries. Map name, description,
  personality, scenario, and example dialogue to a World Bible character
  draft (fields kept as Notes where no field fits), with a preview before
  anything is written. Embedded lorebook entries become Source Notes or
  review proposals, never accepted canon. Name collisions go through the
  existing explicit choice. Reject malformed or oversized cards with a
  clear reason. Other platforms' cards (for example HiWaifu) are in scope
  only if they export to this format; check a real sample first.
- **4.70 Character card export.** After 4.69, export a World Bible
  character (and its Character Lab voice fields) as a V2 card (JSON, and PNG
  when a portrait exists), so an author can use the character in
  SillyTavern. Export includes only that character's own fields, never
  pending proposals or other records.
- **4.71 Context budget + linked-record pull-in.** Give each context
  section (accepted facts, World Bible records, retrieved passages) a token
  budget scaled to the configured model's context, trimming lowest-priority
  items first and recording what was dropped. Optionally include records
  linked to the entities a scene mentions, one hop only and within budget.
  Idea from SillyTavern World Info; skip its sticky, cooldown, and delay
  timing rules, which suit chat roleplay rather than prose.
- **4.72 Prompt breakdown with token counts.** Extend the existing context
  provenance view with an estimated token count per section and the total
  against the model's context, so authors on small local models can see
  what fills the prompt.
- **4.73 Alternative replies.** Let the author ask for another version of a
  Character Lab reply or a scene revision and step between versions before
  keeping one. Unkept versions are discarded and never saved as canon;
  budgets and disclosures apply to each generation.
- **4.74 Rolling Character Lab summaries.** For long Character Lab
  sessions, summarize older turns so the conversation fits the model's
  context. The summary is shown and editable, is labeled as a summary, and
  is never treated as canon or saved to the World Bible.
- **4.75 Local reply length from server context.** Found during 4.68: with
  no `max_tokens`, KoboldCPP stops a reply at 2,048 tokens, reasoning
  included, so long thinking-model replies (chat, scene work) are cut off
  and refused. For the local model server, read the loaded model's context
  size where the server reports it (first confirm the endpoint against
  running KoboldCPP, LM Studio, and llama.cpp servers) and send a
  `max_tokens` that fits what remains after the prompt. Where no size is
  reported, use an Advanced setting for local maximum reply length. A reply
  that still hits the limit stays refused with the existing message. Hosted
  providers and Ollama are unchanged.

## Phase 5 — Release Engineering

- **5.1 Auto-update.** Decide Squirrel / electron-updater / manual (this
  affects main-process structure and signing), implement, and test
  update-from-previous-version.
- **5.2 Code signing + notarization.** Apple Developer ID + notarization for
  macOS; OV/EV or Azure Trusted Signing for Windows. Wire into CI packaging.
- **5.3 Packaged-app validation.** Playwright Electron E2E covering the LLM
  streaming IPC path (highest-payoff single test); packaged checks for file
  operations, external-link policy, provider diagnostics; both platforms.
  Include reload and deep-link behavior: the renderer uses `BrowserRouter`
  under `file://`, so routes rewrite the URL to paths like `file:///workspace`
  and a manual reload has no file to load (found during 3.12a; the
  `will-navigate` guard now blocks that reload instead of loading a blank
  page). Decide between a hash router and a custom app protocol.
- **5.4 Progressive first-run onboarding + sample project.** Land the new
  author in a draft-ready workspace immediately, then teach the write →
  capture canon → review loop through contextual, dismissible guidance and
  an optional pre-seeded sample project. Mechanics are introduced only after
  an explicit author choice, using the basic path established by 4.14–4.15;
  onboarding must not present Character Tools as a second identity home or
  require provider/ruleset setup before drafting. Guidance is resumable,
  resettable, and never blocks normal use.
- **5.5 AI provider setup UX hardening.** BYOK is a v1 differentiator and a
  support risk: clear provider setup, key validation, Ollama detection,
  actionable failure states, and a graceful zero-AI experience (the app must
  be fully usable with AI disabled). Setup states plainly that Ollama remains
  on-device while an author-invoked hosted request sends the necessary text to
  the configured third party under that provider's terms. No request runs only
  to discover whether configuration works except the explicit `Test
  connection` action.
- **5.6 Local-only error handling.** Route raw exception rendering through one
  `describeError(error, fallback)` helper that maps known failure classes
  (network, auth, quota, storage-full, schema-too-new) to author-facing text and
  returns the fallback otherwise. Keep technical detail on the computer in a
  redacted, copyable diagnostic view the author may choose to include in a
  support request. Do not add telemetry, crash reporting, background uploads,
  or automatic diagnostic transmission. Tests assert that common diagnostic
  output excludes manuscript text, API keys, provider payloads, and local file
  paths.
- **5.7 Trial + license key gate.** Merchant-of-record checkout, license key
  issuance/validation (offline-tolerant), trial period behavior, and a
  restore-purchase path. Keep it thin; no accounts service. Before
  implementation, compare Paddle and Creem (`creem.io`) for one-time desktop
  purchases, hosted checkout and customer portal support, tax handling,
  license issuance/validation and webhooks, refunds/chargebacks, pricing, and
  restore-purchase ergonomics. Record the provider decision and integration
  boundary in this slice; neither provider is selected yet. Preparatory
  research is recorded in
  [`research-payment-provider.md`](research-payment-provider.md): Creem is the
  conditional sandbox favorite, but production selection waits on its listed
  security, recovery, coverage, pricing, and operations gates.
- **5.8 Help/docs baseline.** Include the portable export schema from 4.29 if
  it has landed, and a plain statement that every project can be exported in
  full (backup zip) or as readable files. In-app or web help covering projects/backup,
  import, review workflow, World Bible/Lore model, AI setup, and the trust
  model in author language. Include a plain data-flow explanation: local
  storage, optional project locking, no telemetry or SagaSpine training,
  verified-local Ollama versus Ollama cloud models, and the exact
  author-triggered boundary for hosted providers.
- **5.9 Landing page + demo assets.** Portability ("your data leaves with
  you") is a homepage-level promise once 4.29 exists; before that, state only
  the backup-zip and manuscript export truth. Build the simple landing page and a
  60–90 second demo of the implemented core loop; include privacy/data-flow
  copy, download/checkout paths, and a plan for collecting
  permissioned beta proof. Claims must stay within verified product behavior;
  quantified performance claims wait for dogfood or beta evidence. Once 5.15
  is complete, distinguish **Stored locally**, **Locked with your passphrase**,
  and **Private local AI** rather than collapsing them into a single offline
  claim. Do not advertise encrypted working projects before the vault smoke
  and packaged-desktop checks pass.
- **5.10 Author-facing vocabulary sweep.** Retire internal codenames and
  ML jargon from rendered strings: `Shodh memories` → project memory,
  `RAG documents` → indexed context, `Inherit RAG data` → inherit indexed
  context, `Rubber-Duck AI` → a plain-language label. Internal service, type,
  and identifier names are unchanged — this is a string-layer slice and is
  strictly behavior-preserving. Add a test asserting the retired tokens do not
  appear in rendered output so they cannot return.
- **5.12 App-shell toast viewport + status live region.** Lift the
  Workspace-only toast viewport into the app shell so every route posts
  transient confirmations to one predictable place; keep `InlineAlert` for
  errors anchored to the control that caused them. Add one shared status live
  region and a `useStatusAnnouncement` hook wired to autosave, review refresh,
  extraction, migration, and AI streaming — the app currently has three
  `aria-live` regions against 67 loading/saving indicators. Extend the 2.3
  `aria-invalid` pattern to the remaining validated fields. Record the
  toast-versus-inline split in the `docs/product-blueprint.md` design system
  section.
- **5.14 Optional encrypted backups.** An optional passphrase on project
  backup export (PBKDF2-SHA256 → AES-256-GCM, versioned envelope, passphrase
  never stored); import detects the envelope, fails closed on a wrong
  passphrase, and plain backups keep working. Before 6.1 so beta authors can
  protect backups they move between machines. Plan:
  `docs/character-lab-plan.md` § 5.14.
- **5.15 Password-protected project vaults.** Add opt-in encryption at rest for
  working projects before 6.1. A protected project owns a random 256-bit data
  key; a versioned passphrase KDF derives a key-encryption key that wraps the
  data key, and project records use authenticated AES-256-GCM encryption. The
  passphrase is never stored or transmitted. Changing it re-wraps the data key
  rather than rewriting the project. Lock on app restart and project close,
  and provide an explicit **Lock project** action; no plaintext preview,
  search result, recent excerpt, or notification may render while locked.

  Treat the project as a vault, not a collection of encrypted scene fields.
  Manuscripts, Source Notes, World Bible/canon, scratchpad, Canvas and
  Corkboard material, rules/state, assistant conversations, review output,
  caches, search data, and local retrieval/memory derivatives must either be
  encrypted through the owning persistence boundary or rebuilt/in-memory only
  after unlock. The unencrypted manifest is limited to the stable project id,
  crypto/schema version, KDF parameters, salt, wrapped key, and an explicitly
  chosen display label; the safe default label is **Locked project**.

  Enabling protection on an existing project must use a recoverable,
  transaction-like migration: write and authenticate the complete encrypted
  copy, verify a round trip, then remove plaintext records. Do not create the
  usual plaintext pre-migration backup for this transition. Cancellation or
  failure leaves the original project readable and unchanged; success leaves
  no app-owned plaintext project record or derived index. Disabling protection
  requires the passphrase and the same verified migration discipline.

  State the threat boundary honestly: protection covers app-owned data at
  rest, not plaintext already visible while unlocked, operating-system swap,
  screen capture, malware, or files the author exported unencrypted. There is
  no server recovery or backdoor; losing the passphrase means losing access,
  with that consequence acknowledged before enablement. Acceptance requires
  wrong-passphrase and tamper failure, restart/manual-lock behavior, passphrase
  change, existing-project enable/disable rollback cases, cross-project key
  isolation, encrypted backup round trip, a scan proving planted manuscript
  phrases do not remain in app-owned persistence, and packaged macOS/Windows
  smoke coverage. Update the privacy/help copy only after these checks pass.
  Split on 2026-10-25 into 5.15a (vault core), 5.15b (UX and derived data),
  and 5.15c (verification and copy). Archived plan:
  `docs/archive/project-vault-plan.md`.
- **5.16 First-release dogfood polish.** Close the bounded usability and
  accessibility findings from the first packaged-app dogfood pass before the
  beta build; do not broaden this into a general redesign.
  - Add automated accessibility scanning for representative primary routes
    and dialogs in both themes, alongside the existing focus, keyboard and
    ARIA assertions. Fix the dark Getting Started panel so its text and links
    meet WCAG AA contrast against the soft-accent surface; prefer a shared
    theme-token correction when it is safe for every consumer.
  - Replace the connection result's six-model truncation with a keyboard-
    operable, searchable or scrollable choice containing every model reported
    by Ollama or a local OpenAI-compatible server. Keep manual model entry and
    never select a model silently.
  - For the first release, offer only **General Fiction** and **LitRPG** when
    creating a project or changing an ordinary project's mode. Preserve the
    `game` contract and all existing Game Simulation projects; an existing
    game project must remain openable and must show its current mode until the
    author explicitly changes it. Do not delete or migrate game data.
  - Hide **Insert Status Block** and **Refresh Placeholders** when project
    capabilities say game systems are off. If an author deliberately enables
    game systems through supported controls, the actions may appear even in a
    General Fiction project.
  - Keep the verified first-run contract: a fresh install with no projects
    creates **My First Project**, General Fiction, with an empty **Chapter
    One**; deleting all projects later does not recreate it.
  - Improve character import heading destinations deterministically. Strip an
    exact record name (including possessive/punctuation variants) from a
    suggested new-field label when that leaves a meaningful heading, so
    `Leo Muller-Sarkesian Academic Background` proposes `Academic Background`.
    When **New field** is chosen, expose an editable, validated label before
    import rather than forcing the detected heading verbatim. Preserve author
    choices through the existing reconciliation flow and keep duplicate-field
    handling explicit.

  Acceptance: targeted unit/component coverage for every rule above; an
  accessibility scan and keyboard checks on the affected UI; light/dark and
  narrow-width browser checks; General Fiction/LitRPG plus an existing-game
  compatibility case; all detected local models remain selectable; character
  import creates the edited field name and never the record-prefixed label;
  applicable full verification tier green before 6.1.
- **5.17 Writing-flow stability + assistant continuity.** Close the second
  packaged-app dogfood pass before beta, prioritizing interruptions to the
  author's writing flow over additive conveniences.
  - Reproduce and fix manuscript scroll-to-top and visible text jitter during
    deletion/autosave. Preserve the selection, editor scroll position, and
    rendered text geometry across persistence updates; verify sustained typing,
    backward deletion, and autosave in a long scene.
  - Keep assistant conversation history as one coherent session when the
    author answers a question or chooses among options. The expanded reply view
    must allow the author to continue that conversation without closing it.
  - Saving or copying assistant advice to Source Notes must offer the useful
    conversation context—not only the latest assistant message—including the
    author's question and the displayed reply/version, without silently saving
    other discarded alternatives.
  - Let writing-coach replies create a new Source Note directly through the
    same author-reviewed path. Scene context cards must either be dismissible
    or navigate to the exact Source Note or World Bible record they represent;
    never imply a link when the source cannot be resolved.

  Acceptance: regression coverage demonstrates stable cursor and scroll during
  repeated autosaves in a long scene; no layout jitter is visible in a timed
  browser check; follow-up answers retain the preceding options and question in
  the request; conversation can continue from the expanded reply; saved Source
  Notes contain the author-approved contextual transcript; each resolvable
  context card opens its source and every card can be dismissed; applicable
  full verification tier green before 6.1.
## Phase 6 — Beta, RC, Launch

- **6.1 Beta.** Signed, auto-updating build to a 10–30 author cohort
  (fiction + LitRPG mix). Define what feedback is collected and where —
  including two activation measures the research review asked for: time from
  first open to first accepted canon record, and time to the first review
  catch the author agrees with (self-reported, no telemetry); beta
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

Rules-engine R3–R5 (derived values at replay, rule-proposed follow-up commands, rules as continuity validators; revisit after 1.1 dogfooding, see `docs/archive/rules-engine-plan.md`); App-wide search beyond current entry points; AI-to-Scratchpad capture and
Scratchpad organization; item authoring AI
slices 2–6 and ruleset-domain adapters; advanced executable rule generation;
carry weight/encumbrance; nonfiction product; persona/game-engine tool
ecosystems; Zod 4; internal character compatibility retirement after 4.13 —
`'character'` fact/alias/link targets, remaining name joins, and the extension
store (CX-10b, after reader coverage proves removal safe; per
`docs/character-experience-design-review.md`).

From the 2026-09-12 review of `docs/tactical-actions.md`, deferred with
reasons: **character knowledge attribution** ("what does Elara know before
Chapter 12?") — a `known by` dimension on facts needs per-character witness
provenance that is semantic, not deterministic; revisit after 4.28 and beta
evidence that authors ask for it. **Spoiler-aware audience permissions** —
publishing/audience control has no surface in a local writing tool and is
out of scope. **World Anvil importer** — only after its export format is
verified as obtainable and stable; 4.29's Markdown-folder import is the
general path. **Relationship graph view** — entity `links` and `relationship`
facts already exist; a read-only derived view is cheap but unproven, so wait
for beta requests. The author raised it again on 2026-10-10 (Obsidian-style
graph) and agreed it is post-release. Shape when promoted: start with a
**per-record local graph** (one record's neighborhood: Source Note links by
relationship, scene mentions, accepted relationship facts, World Canvas
links), with click-through; a whole-project graph only later, framed around
finding unlinked records and notes. Derived and read-only under the
Corkboard dashboard rule: every edge cites its source, nothing on it is
editable, and it never infers links or writes canon. Promote earlier only if
1.1 dogfood shows navigating between related records is a real friction.
**Public sharing, remixable templates, recurring
challenges** — require hosted sharing and accounts, which contradict the
no-accounts, no-telemetry boundary; a downloadable starter project shared in
the niche communities is the marketing-plan substitute. **SEO micro-tools** —
marketing-site work recorded in `docs/marketing-plan.md` as a post-launch
experiment.

From the 2026-10-06 preparation of the author's own novel ("Echoes") for
real-world dogfooding: **Images** — no image support exists anywhere (records,
Source Notes, World Canvas, backups); the prepared corpus has 15 portraits
and scene images (~40 MB) that stay outside the app. Smallest useful slice is
one image per World Bible record (portrait/illustration), stored in the
project and carried by backup/restore; maps and game-mode handouts wait until
game-running needs are defined. Open questions: backup/portable-export size,
desktop vs browser storage, and whether AI surfaces ever see images (display-
only unless the provider supports vision). Revisit with dogfood/beta evidence.
**Chapter epigraphs** — the author plans in-world glossary snippets (from a
Codex Omnium Source Note, an annotated in-world document) at the top of each
chapter. Start with plain text at the chapter top, no new affordance; promote
only if dogfood shows project review or extraction treating epigraph text as
narration or contradictions (in-world sources may be deliberately wrong),
authors need to track which entry opens which chapter, or export needs
distinct formatting. Likely shape: an optional scene `epigraph` field with an
attribution and an optional link to its World Bible record or Source Note,
excluded from or labeled in review.

From 2026-10-10 dogfooding: **Import name cleanup** — imported World Bible
records keep document-title prefixes such as `Country Profile: Verdazia`, so
the record never matches the manuscript. Candidate fix: when a title has a
`Label: Name` shape, suggest the part after the colon as Entry Name on the
import card (author still confirms). **Plural matching in project review** —
4.64 widened singular/plural matching for editor highlighting only; extend to
unknown-name detection only if dogfood shows `Dhemon` being flagged as
unknown while `Dhemons` is a record.
