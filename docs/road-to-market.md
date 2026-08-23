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
writing-first shell, one coherent character experience centered in World
Bible, progressively disclosed optional mechanics, accessible dialogs/nav,
packaged + signed installers for macOS and Windows, auto-update, storage
schema versioning, first-run onboarding with a sample project, trial/license
gate, and a help/docs baseline.

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
- Trust dogfooding is the active checkpoint after Phase 4. Keep Phase 5
  unclaimed until the 1.1 run is recorded and its findings are triaged; only
  release-blocking trust or data-loss findings must be fixed before 5.1.

Verification battery:

```bash
pnpm --filter web lint          # 0 errors (3 exhaustive-deps warnings baseline)
pnpm --filter web test:unit     # 232+ tests
pnpm --filter @worldbuilding-desk/rules-engine test
pnpm --filter @worldbuilding-desk/rules-ui test
pnpm --filter web build
pnpm --filter desktop build
pnpm --filter web e2e:run       # for slices touching routed UI
```

## Executing a Slice (instructions for agents)

1. **Claim it.** Set the slice to `WIP` on the status board below before
   starting. Respect phase ordering and the noted dependencies (2.2 after
   2.1; 2.7 after 2.5; 3.5–3.8 sequentially; 4.5–4.11 after 4.2 with the
   internal ordering noted in Phase 4; 4.12 → 4.13 and 4.14 → 4.15;
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
| 1.1 | Realistic-project trust dogfood | 1 | M | Deferred — author resumed on 2026-08-22–23, completed setup through A-4 and partial lore/canon/assistant review, then stopped on systemic fact-target corruption and an unsafe D4 custody answer; preserve the project/evidence and resume on a fresh post-fix build after the blocking 1.2 follow-ups |
| 1.2 | Fix trust-path failures found in 1.1 | 1 | M | Done `f8d3d2e` + `545655c` + `1f1d2d7` + `813fb9c` + `aba657a` + `d6a22ea` — grounding/readiness, extraction/review precision, session continuity, deterministic supported answers, and a universal evidence gate that prevents all other factual questions from reaching creative generation; lint baseline; 306 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 45/45 |
| 1.2a | Fact-target integrity + reversible acceptance | 1 | M | Done `ce427b9` — editable World Bible entity targets; unresolved-subject fail-closed and sibling refresh; Sera/Brannic/Dess targeting and Brannic conflict coverage; conservative acceptance reversal without new hidden Notes copies; lint baseline; 387 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 55/55 |
| 1.2b | Temporal custody + conflicting-location grounding | 1 | M | Done `a92baa2` — storage questions inspect ordered primary saved scenes; designated storage, sign-out, pocket possession, and later use remain distinct; D4 reports current-custody uncertainty with chapters 3–5 cited and no provider call; accepted canon is fallback-only; lint baseline; 390 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 56/56 |
| 1.2c | Workspace scene continuity + Find | 1 | S | Done `8d299e3` — persisted scene selection now survives Workspace route remounts; editor/window/element scroll state is isolated by project and scene with no fallback; current-scene Find has toolbar and Cmd/Ctrl+F entry, wrapped keyboard navigation, Escape focus return, match highlighting, and route-remount coverage; lint with 2 baseline warnings; 398 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 57/57 |
| 1.2d | Lore intake/review clarity + matcher precision | 1 | M | Done `f86bd83` — article-equivalent entity identity prevents Salt Door duplicates; shared boundary/longest-match arbitration covers Bran/Brannic; review creates and selects World Bible types in place; Source Notes have consolidated intake/extraction actions, saved document-context language, one primary subject, and save-before-extract enforcement; lint with 2 baseline warnings; 406 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 57/57 |
| 1.2e | State/replay dogfood journey | 1 | S | — Session E has no understandable author-facing route for the scripted inventory/status/location events; fix the runbook and any remaining contextual dead end before resuming E1–E5 |
| 1.3 | Calm-shell navigation validation | 1 | S | Done `530b59f` — desktop/narrow project-mode checks pass; 2.8 must expose the aggregate pending badge on narrow `More` without promoting optional systems |
| 1.4 | Proposal-review assistant route (conditional on product need) | 1 | M | — |
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
| 5.1 | Auto-update decision + implementation | 5 | M | — |
| 5.2 | Code signing + notarization, both platforms | 5 | M | — |
| 5.3 | Packaged-app validation + Electron E2E | 5 | M | — |
| 5.4 | Progressive first-run onboarding + sample project | 5 | L | — depends on 4.13 and 4.15 so onboarding teaches the settled character/mechanics experience; no onboarding wall |
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
sequentially. Phase 4's original product-completeness scope through 4.11 is
complete; dogfood has promoted 4.12–4.15 as pre-beta experience work, and the
author accepted prose-proximate item/state authoring as 4.16. The author
paused 1.1 on 2026-08-15 and explicitly advanced 4.12, then resumed the run
on 2026-08-22–23 after 4.12–4.16 landed. The resumed run found
release-blocking fact-target corruption and temporally stale custody answers.
Preserve that evidence; 1.2a–1.2d are fixed, 1.2e blocks E1–E5, and all 1.2
follow-ups land before 6.1. Slices 4.12 and 4.14 may
run in parallel; 4.13 follows 4.12 and 4.15 follows 4.14. Release-engineering
work may run in parallel, but 4.16 follows 4.1 and 4.15, 5.4 waits for 4.13
and 4.15, and 4.12–4.16 must land before 6.1. Release-blocking trust or
data-loss findings remain first priority. Phase 6 is strictly ordered.

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
mid-run. Preserve evidence, finish A–G, then classify each finding as a
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
- **3.5** ESLint 10 group (+ plugins; resolve or explicitly defer the 77
  react-hooks compiler-rule violations: 65 `set-state-in-effect`, 6 `purity`,
  and 6 `preserve-manual-memoization`).
- **3.6** Vite 8 + `@vitejs/plugin-react` 6 (keep `@types/node` at 24.x).
- **3.7** Cypress 15 (all 43 tests green locally and in CI).
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

## Phase 5 — Release Engineering

- **5.1 Auto-update.** Decide Squirrel / electron-updater / manual (this
  affects main-process structure and signing), implement, and test
  update-from-previous-version.
- **5.2 Code signing + notarization.** Apple Developer ID + notarization for
  macOS; OV/EV or Azure Trusted Signing for Windows. Wire into CI packaging.
- **5.3 Packaged-app validation.** Playwright Electron E2E covering the LLM
  streaming IPC path (highest-payoff single test); packaged checks for file
  operations, external-link policy, provider diagnostics; both platforms.
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
ecosystems; Zod 4; internal character compatibility retirement after 4.13 —
`'character'` fact/alias/link targets, remaining name joins, and the extension
store (CX-10b, after reader coverage proves removal safe; per
`docs/character-experience-design-review.md`).
