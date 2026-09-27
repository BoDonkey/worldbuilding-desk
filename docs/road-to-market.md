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
the character lab.

**Privacy promise.** Project data and manuscripts are stored locally.
Worldbuilding Desk does not send diagnostic telemetry and does not use author
writing to train AI. Text leaves the computer only when the author explicitly
invokes a hosted provider they configured; local Ollama workflows remain on
device. Hosted-provider setup and every author-facing AI surface must explain
that boundary accurately rather than claiming that all configured workflows
are fully offline.

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
   3.10 → 3.11; 3.10 → 4.42 → 4.43 → 4.44; 4.45 after 4.42;
   4.46 → 4.47 → 4.48; 4.42 after 4.46;
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
| 1.1 | Realistic-project trust dogfood | 1 | M | Deferred — author resumed on 2026-08-22–23, completed setup through A-4 and partial lore/canon/assistant review, then stopped on systemic fact-target corruption and an unsafe D4 custody answer; preserve the project/evidence and resume on a fresh post-fix build after the blocking 1.2 follow-ups; a dev-only **Load trust-dogfood fixture** action (Projects) and a one-page run sheet in the runbook now cut setup to review-first, ~3–4 hours |
| 1.2 | Fix trust-path failures found in 1.1 | 1 | M | Done `f8d3d2e` + `545655c` + `1f1d2d7` + `813fb9c` + `aba657a` + `d6a22ea` — grounding/readiness, extraction/review precision, session continuity, deterministic supported answers, and a universal evidence gate that prevents all other factual questions from reaching creative generation; lint baseline; 306 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 45/45 |
| 1.2a | Fact-target integrity + reversible acceptance | 1 | M | Done `ce427b9` — editable World Bible entity targets; unresolved-subject fail-closed and sibling refresh; Sera/Brannic/Dess targeting and Brannic conflict coverage; conservative acceptance reversal without new hidden Notes copies; lint baseline; 387 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 55/55 |
| 1.2b | Temporal custody + conflicting-location grounding | 1 | M | Done `a92baa2` — storage questions inspect ordered primary saved scenes; designated storage, sign-out, pocket possession, and later use remain distinct; D4 reports current-custody uncertainty with chapters 3–5 cited and no provider call; accepted canon is fallback-only; lint baseline; 390 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 56/56 |
| 1.2c | Workspace scene continuity + Find | 1 | S | Done `8d299e3` — persisted scene selection now survives Workspace route remounts; editor/window/element scroll state is isolated by project and scene with no fallback; current-scene Find has toolbar and Cmd/Ctrl+F entry, wrapped keyboard navigation, Escape focus return, match highlighting, and route-remount coverage; lint with 2 baseline warnings; 398 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 57/57 |
| 1.2d | Lore intake/review clarity + matcher precision | 1 | M | Done `f86bd83` — article-equivalent entity identity prevents Salt Door duplicates; shared boundary/longest-match arbitration covers Bran/Brannic; review creates and selects World Bible types in place; Source Notes have consolidated intake/extraction actions, saved document-context language, one primary subject, and save-before-extract enforcement; lint with 2 baseline warnings; 406 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 57/57 |
| 1.2e | State/replay dogfood journey | 1 | S | Done `d9cb7e3` — simple Character continuity now hands directly to detailed inventory/equipment/status/location changes while keeping the selected character and scene; the detailed form uses author-facing actions with explicit preview, recording, scene scope, and replay; Session C maps every E event to exact current UI labels and adds the required Pale Draught baseline; lint with 2 baseline warnings; 407 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 57/57 |
| 1.3 | Calm-shell navigation validation | 1 | S | Done `530b59f` — desktop/narrow project-mode checks pass; 2.8 must expose the aggregate pending badge on narrow `More` without promoting optional systems |
| 1.4 | Grounded project Q&A destination (was: conditional assistant route) | 1 | M | — — product need established by the [2026-08-29 UX/AI review](archive/ux-ai-review-2026-08-29.md) §B4.3; runs after 1.5 |
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
| 3.11 | Rules-engine hygiene + typed rules (R2) | 3 | S | — |
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
| 4.38 | Model-assisted canon check (author-triggered, via 1.5) | 4 | M | — after 4.24 and 4.39; proposes contradictions with validated evidence spans into the review queue; never applies |
| 4.39 | AI consultation budget model + point-of-use explanation | 4 | M | Done `ac84793` — (a) guards runaway loops and surprise spend, never rations deliberate work; (b) one per-project budget with a per-feature record; (c) **author signed off: local Ollama is exempt**, with a separate 200/day runaway guard; (d) every spending action states cost and remainder beside its own button, and an over-budget author adds units for today in place rather than going to Settings. Day boundary moved from UTC to the author's local midnight. Storage moved from per-project-per-day `localStorage` keys (never cleaned up) to one `inspectorBudget:<projectId>` ledger, migrating today's legacy count and sweeping the stale keys. Settings gains the reset time and today's per-feature breakdown. Lint with 1 baseline warning; 611 web (+26) + 6 engine + 12 UI tests; web/desktop builds. Cypress run locally: `cypress/e2e/consultation-budget.cy.ts` (4 specs: point-of-use display, over-budget + in-place grant, local exemption, Settings breakdown) passes after a spec fix to open the collapsed AI Settings section and advanced settings; full suite otherwise green |
| 4.40 | Local model runs: no response cap, visible thinking, elapsed time, Stop | 4 | L | Done `1749c8f` — one shared run (`useModelRun` + `ModelRunProgress` + `splitModelOutput`) behind the assistant, both coaches, progression continuity, canon decisions, and brainstorming: phase, elapsed time, live collapsible thinking, Stop, and "Show thinking" for the latest reply (never saved or sent back); answers never contain `<think>` text. Local runs send no cap and no longer force thinking off; hosted keep the cap (4.41). Stop cancels the provider request in desktop through a new `llm:stream:cancel` IPC. Real-model check with no cap: qwen3.8 10 ideas in 5:05 (thinking visible from 16 s), writer 10 in 6:34. Lint with 1 baseline warning; 655 web (+12) + 6 engine + 12 UI tests; web/desktop builds; Cypress 93/93 |
| 4.41 | Hosted response limits as a cost ceiling (plan, then build) | 4 | M | Done `910b7a0` — dated maintained exact-model price table and Settings response-only ceiling (including the 1,500-token structured-reply floor); unknown models never get guessed prices; Anthropic thinking stays off, OpenAI reasoning uses low effort plus `max_completion_tokens`, Gemini applies model-family allowances; all hosted adapters detect cap stops and discard incomplete streamed or ordinary replies with an actionable limit message; Gemini fallback updated to 2.5 Flash-Lite. Lint with 1 baseline warning; 696 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 104/104. [Plan](archive/hosted-response-limits-plan-2026-09-24.md). |
| 4.42 | Character voice contract (CL-1) | 4 | S | Done `b69a76f` — read-only `buildCharacterVoiceContext` (link resolver; canon record + aliases, accepted facts valid at the position with non-accepted source proposals excluded, dialogue style, `buildCharacterSnapshot` state labelled as not-knowledge) and shared `buildCharacterVoicePrompt` (talk, reaction, scene, generation; context embedded in the system prompt because Ollama ignores `LLMRequest.context`); no UI; lint with 1 baseline warning; 742 web + 14 engine + 12 UI tests; web/desktop builds |
| 4.43 | Talk to a character + reaction test (CL-2) | 4 | M | — after 4.42 |
| 4.44 | Character scenes, 2–3 characters (CL-3) | 4 | M | — after 4.43 |
| 4.45 | Character from a rough description (CL-4) | 4 | M | — after 4.42 |
| 4.46 | Character snapshot service + shared stat card (SP-1) | 4 | S | Done `e9a7017` — pure `characterSnapshot` service (scene opening/cursor/ending or latest, ordered change diff, compact summary) and shared `CharacterStatCard`; scene roster and editor hover card adopted with byte-identical output and markup; lint with 1 baseline warning; 710 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 104/104 |
| 4.47 | Stat peek from the editor and command palette (SP-2) | 4 | M | Done `c94356f` — Cmd/Ctrl+Alt+S and right-click Show stats on a name or alias in Workspace (shared names ask); hover card uses the same card; palette Show stats for… on every route (Workspace peeks at the cursor, elsewhere latest); cards follow stat-block style and scope; all gated on game systems; lint 1 baseline warning; 725 web + 6 engine + 12 UI tests; builds; Cypress 107/107 (commit message says 111 from a double-counted stalled run) |
| 4.48 | Pinned stat panel across writing and brainstorming (SP-3) | 4 | M | Done `f1b4831` — up to three pins from peek, palette, roster, or World Bible in a collapsible app-shell panel on Workspace, World Canvas, Corkboard, World Bible (above Scratchpad); follows the cursor in Workspace, latest or end of a chosen scene elsewhere; changes since previous chapter via Corkboard links; Open sheet; per-project UI pins, not in backups; mobile bottom sheet; lint 1 baseline warning; 735 web + 6 engine + 12 UI tests; builds; Cypress 108/108 |
| 5.1 | Auto-update decision + implementation | 5 | M | — |
| 5.2 | Code signing + notarization, both platforms | 5 | M | — |
| 5.3 | Packaged-app validation + Electron E2E | 5 | M | — |
| 5.4 | Progressive first-run onboarding + sample project | 5 | L | Done `a5644b1` — one-time blank-project auto-create lands a fresh install in Workspace immediately, no provider/ruleset setup first; dismissible getting-started guide shown only on first-run/sample projects; bundled sample project trimmed from `fixtures/trust-dogfood/` to one self-contained factual conflict the author resolves via the real extraction/canon-decision pipeline, reachable from the guide or Projects; lint with 1 baseline warning; 485 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 66/67 (one confirmed-unrelated pre-existing flake) |
| 5.5 | AI provider setup UX hardening | 5 | M | Done `1c15774` — real per-provider Test connection (single-token completion for hosted providers, reachability/model check for Ollama) with plain-language results; two-tier Setup/Advanced split (per-provider key field, budget/policy/base-URL controls behind an explicit toggle, not a nested `<details>`); 3 author-facing relabels; on-device/hosted data-flow disclosure; actionable not-configured link; lint with 1 baseline warning; 496 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 73/73 ([review](archive/ux-ai-review-2026-08-29.md) §A2) |
| 5.6 | Local-only error handling | 5 | S | Done `8709ec1` — one `describeError` helper behind all 107 rendered error sites keeps app-authored validation text, maps network/key/quota/outage/storage-full/newer-version/cancelled failures to plain language, and falls back on technical noise; redacted 50-entry local diagnostics log with window-level capture and a Settings → Diagnostics copy/show/clear panel; tests prove reports exclude API keys, file paths, provider payloads, and manuscript text; no telemetry or automatic transmission; lint with 1 baseline warning; 518 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 73/75 (new spec 2/2; both failures unrelated timing cases that pass in isolation, one intermittent) |
| 5.7 | Trial + license key gate | 5 | M | — |
| 5.8 | Help/docs baseline | 5 | S | — |
| 5.9 | Landing page + demo assets | 5 | M | — |
| 5.10 | Author-facing vocabulary sweep | 5 | XS | Done `69e6559` — string-layer only, behavior-preserving; retires `Shodh`/`RAG`/`Rubber-Duck` from rendered UI including the review's named "Inherit RAG data"/"Inherit memories" inconsistency; source-scanning test guards against regression; lint with 1 baseline warning; 500 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 72/73 ([review](archive/ux-ai-review-2026-08-29.md) §A3) |
| 5.12 | App-shell toast viewport + status live region | 5 | S | Done `7f303f7` — one app-shell toast viewport (polite, auto-dismiss, repeats replaced) fed by a `RouteFeedback` bridge in all nine routes plus Workspace (errors-as-toast, resolver notice as an action toast); errors elsewhere stay inline as `InlineAlert`; one shared status live region via `useStatusAnnouncement` wired to autosave, review, extraction, migration, and AI streaming; `aria-invalid` on three more validated fields; split recorded in the blueprint; lint with 1 baseline warning; 529 web + 6 engine + 12 UI tests; web/desktop builds; Cypress 75/77 full run (one assertion updated to `role="alert"`, one pre-existing hydration race in `post-merge-smoke`), 18/18 + 2/2 in isolation ([review](archive/ux-ai-review-2026-08-29.md) §A5, §A6) |
| 5.14 | Optional encrypted backups | 5 | S | — |
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

**1.4 Grounded project Q&A destination.** The conditional gate on this slice
is satisfied: the 2026-08-29 UX/AI review established the product need. Add a
destination where the author can ask questions of the project outside the
Workspace drawer — pending proposals discussed without being presented as
canon, factual questions answered through the existing evidence gate and
`getDirectSavedFactAnswer` path. Runs after 1.5 so answers and proposals share
one review affordance.

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
review). Full scope and decisions: _[plan: rules-engine-plan.md § R1, § R2]_.

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
  storage, no telemetry or Worldbuilding Desk training, local Ollama, and the
  exact author-triggered boundary for hosted providers.
- **5.9 Landing page + demo assets.** Portability ("your data leaves with
  you") is a homepage-level promise once 4.29 exists; before that, state only
  the backup-zip and manuscript export truth. Build the simple landing page and a
  60–90 second demo of the implemented core loop; include privacy/data-flow
  copy, download/checkout paths, and a plan for collecting
  permissioned beta proof. Claims must stay within verified product behavior;
  quantified performance claims wait for dogfood or beta evidence.
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

Rules-engine R3–R5 (derived values at replay, rule-proposed follow-up commands, rules as continuity validators; revisit after 1.1 dogfooding, see `docs/rules-engine-plan.md`); App-wide search beyond current entry points; AI-to-Scratchpad capture and
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
for beta requests. **Public sharing, remixable templates, recurring
challenges** — require hosted sharing and accounts, which contradict the
no-accounts, no-telemetry boundary; a downloadable starter project shared in
the niche communities is the marketing-plan substitute. **SEO micro-tools** —
marketing-site work recorded in `docs/marketing-plan.md` as a post-launch
experiment.
