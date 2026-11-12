# Road to Market — Master Work Plan

**Created:** 2026-08-01 · **Slimmed:** 2026-10-31 to open work; the full
earlier plan, board notes, and finished-slice detail are preserved verbatim in
[`archive/road-to-market-snapshot-2026-10-31.md`](archive/road-to-market-snapshot-2026-10-31.md).

This is the single active roadmap and slice plan. Older plans it absorbed
(`next-steps.md`, `ui-design-work-slices.md`, `fitness-a-work-slices.md`,
`product-health-audit.md`) are in `docs/archive/`.

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
packaged installers for macOS and Windows (signed for macOS at paid
launch; Windows signing may follow, see 5.2), auto-update, storage
schema versioning, first-run onboarding with a sample project, trial/license
gate, a help/docs baseline, and — added 2026-08-29 — the derived story
dashboard and the writing coach described below, and — added 2026-09-26 —
the character lab, and — added 2026-10-03 — optional password-protected
project vaults, and — added 2026-11-07 — separate per-project switches for
AI coaching and AI prose, both off by default, and author-editable AI
actions in the selection menu (5.18, 5.19).

**Privacy promise.** Project data and manuscripts are stored locally.
SagaSpine does not send diagnostic telemetry and does not use author
writing to train AI. Text leaves the computer only when the author explicitly
invokes a hosted provider they configured; Ollama remains on-device only when
the endpoint is loopback and the selected model is verified local rather than
an Ollama cloud model. Hosted-provider setup and every author-facing AI
surface must explain that boundary accurately rather than claiming that every
Ollama or configured workflow is fully offline.

Explicitly **post-v1**: AI item-authoring slices beyond the manual
description-first path, ruleset-domain adapters, app-wide search expansion,
Scratchpad organization, *authored* Corkboard expansion (the *derived*
dashboard panels of 4.19 are v1), executable ruleset generation, carry
weight/encumbrance, nonfiction product work, persona/game-engine ecosystems
beyond the character lab,
Zod 4 migration, and the craft library beyond tranche 1 (which continues as a
parallel content track rather than a release gate).

The v1 scope changes (2026-08-29 writing coach and story dashboard,
2026-09-26 character lab and encrypted backups, 2026-10-03 project vaults)
and the writing-coach direction are recorded in the archived snapshot; all of
that work has landed.

## Working Rules

- Prefer narrow slices that complete an author workflow; keep AI
  author-invoked, proposal-oriented, review-gated (see `docs/domain-model.md`).
- Behavior-preserving refactors stay behavior-preserving; run the applicable
  verification tier before commit (see policy below).
- Update `PROJECT_STATUS.md` when application truth changes; update this file
  when priority or remaining work changes. Keep finished-slice detail out of
  this file: the board row keeps the commit, and longer notes go to
  `docs/archive/`.
- Trust dogfooding (1.1) is the checkpoint before beta. Phase 5 slices run
  only as author-approved exceptions to that gate, recorded on the board
  (5.1, 5.2, 5.3, 5.8, 5.18, 5.19, and the Phase 3 refactor 3.32 so far).
  The A–F trust run resumes on one fresh stable build before 6.1;
  release-blocking trust or data-loss findings come first.

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
   starting. Respect the open dependencies: 1.1's
   fresh-build trust run before 6.1; 5.2's macOS signing and 5.7 before the
   paid launch (6.4); 5.9 before 6.4; 5.18 then 5.19 before 6.1; 3.32
   after 5.19; Phase 6 strictly ordered. Finished
   slices' ordering is in the archived snapshot.
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
and required revisit point, `WIP`, `Done <commit>`. A finished slice keeps
only its commit here; its verification counts, findings, and plan are in the
[archived snapshot](archive/road-to-market-snapshot-2026-10-31.md) (or, for slices finished later, in their commit
messages).

| # | Slice | Phase | Size | Status |
|---|---|---|---|---|
| 0.1 | Branch/worktree cleanup | 0 | XS | Done `51d1586` |
| 1.1 | Realistic-project trust dogfood | 1 | M | Deferred — author resumed on 2026-08-22–23, completed setup through A-4 and partial lore/canon/assistant review, then stopped on systemic fact-target corruption and an unsafe D4 custody answer; preserve the project/evidence and resume on a fresh post-fix build after the blocking 1.2 follow-ups; a dev-only **Load trust-dogfood fixture** action (Projects) and a one-page run sheet in the runbook now cut setup to review-first, ~3–4 hours |
| 1.2 | Fix trust-path failures found in 1.1 | 1 | M | Done `f8d3d2e` + `545655c` + `1f1d2d7` + `813fb9c` + `aba657a` + `d6a22ea` |
| 1.2a | Fact-target integrity + reversible acceptance | 1 | M | Done `ce427b9` |
| 1.2b | Temporal custody + conflicting-location grounding | 1 | M | Done `a92baa2` |
| 1.2c | Workspace scene continuity + Find | 1 | S | Done `8d299e3` |
| 1.2d | Lore intake/review clarity + matcher precision | 1 | M | Done `f86bd83` |
| 1.2e | State/replay dogfood journey | 1 | S | Done `d9cb7e3` |
| 1.3 | Calm-shell navigation validation | 1 | S | Done `530b59f` |
| 1.4 | Grounded project Q&A destination (was: conditional assistant route) | 1 | M | Done `a4c47ab` |
| 1.4a | Ask pending-proposal readiness | 1 | S | Done `a46e67a` |
| 1.4b | Assistant follow-up subjects + evidence-gate coverage | 1 | M | Done `cff28f4` |
| 1.5 | Shared AI proposal surface | 1 | M | Done `b1d0a2a` |
| 1.6 | Context and memory baseline + benchmark | 1 | M | Done `44a1dcc` |
| 2.1 | ConfirmDialog + InlineAlert components | 2 | S | Done `38db7df` |
| 2.2 | Migrate confirm/alert call sites | 2 | M | Done `9c278a3` + `ab14f63` |
| 2.3 | Inline field-level validation | 2 | S | Done `45a163f` |
| 2.4 | Theme CharacterStyle editor family | 2 | S | Done `6e0454a` |
| 2.5 | CompendiumRoute off inline styles | 2 | M | Done `83374f2` |
| 2.6 | CharacterSheetsRoute off inline styles | 2 | M | Done `effb82e` |
| 2.7 | Compendium sub-list search/filter | 2 | S | Done `b43aa19` |
| 2.8 | Primary nav / "More" badge visibility | 2 | S | Done `4cb43b9` |
| 2.9 | UI close-out audit | 2 | XS | Done `6c32b22` |
| 3.1 | WorkspaceRoute drawer/context extraction | 3 | M | Done `01eb811` |
| 3.2 | WorkspaceRoute to <2,000 lines | 3 | M | Done `ef14984` |
| 3.3 | WorldBibleRoute to <2,000 lines | 3 | M | Done `b041561` |
| 3.4 | CharacterSheetsRoute to <2,000 lines | 3 | S | Done `5f0560d` |
| 3.5 | ESLint 10 group upgrade | 3 | M | Done `70cdf21` |
| 3.6 | Vite 8 + plugin-react 6 | 3 | S | Done `df38e97` |
| 3.7 | Cypress 15 | 3 | S | Done `8867c2b` |
| 3.8 | TypeScript 7 | 3 | M | Done `8611539` |
| 3.9 | Dev-audit sweep + fitness close-out | 3 | S | Done `c8d7c78` |
| 3.10 | Move live state core into `rules-engine` (R1) | 3 | M | Done `90b64dd` |
| 3.11 | Rules-engine hygiene + typed rules (R2) | 3 | S | Done `3c93743` |
| 3.12a | Provider credential + endpoint hardening | 3 | M | Done `8e1df38` |
| 3.12b | Private-local AI classification | 3 | M | Done `29ec407` |
| 3.13 | Atomic canon acceptance | 3 | M | Done `0d7a54d` |
| 3.14 | Hotspot freeze + editor/workspace extraction | 3 | M | Done `9756578` |
| 3.15 | Dependency advisory sweep + CI audit gate | 3 | S | Done `b636915` |
| 3.16 | Split `useWorkspaceConsistency` by responsibility | 3 | M | Done `2a9aa0e` |
| 3.17 | Centralize assistant request policy | 3 | M | Done `aa500ea` |
| 3.17a | Project deletion integrity + retrieval upgrade repair | 3 | S | Done `ef332ac` |
| 3.18 | Lower the size freeze to 1,000 lines | 3 | XS | Done `e1a7964` |
| 3.18a | Change-aware CI + verification policy | 3 | S | Done `2ab0cb6` |
| 3.19 | Undefined theme token + hardcoded editor colors | 3 | XS | Done `dbbd86e` |
| 3.20 | Compendium form extraction | 3 | M | Done `972dd00` |
| 3.21 | Scene-roster mutation services | 3 | M | Done `7a8010c` |
| 3.21a | zod 4 advisory upgrade + debug-log cleanup | 3 | S | Done `04145d9` |
| 3.21b | Electron runtime + dev advisory sweep | 3 | S | Done `24fc435` |
| 3.22 | Characterization tests for untested domain modules | 3 | M | Done `4e8fec9` |
| 3.23a | One storage layer + import guard | 3 | M | Done `1ff729b` |
| 3.23b | Project-scoped IndexedDB indexes | 3 | M | Done `5c70ff9` |
| 3.23c | Browser-storage preferences + mechanics draft | 3 | S | Done `60ef863` |
| 3.24a | Backup import collision guard | 3 | S | Done `76cb95a` |
| 3.24b | Backup import id remapping | 3 | L | Done `8a73bf9` |
| 4.1 | Description-first manual item creation | 4 | S | Done `70fb72f` |
| 4.2 | Storage schema versioning + migrations | 4 | M | Done `965af19` |
| 4.3 | Internal package namespace rename | 4 | S | Done `1917611` |
| 4.4 | Character contract adoption (CX-1) | 4 | S | Done `c406b48` |
| 4.5 | Character identity links + classifier + resolver (CX-2) | 4 | M | Done `48e634a` |
| 4.6 | Backup + character-package completeness (CX-3) | 4 | M | Done `b7c4776` |
| 4.7 | Character intake convergence (CX-4) | 4 | M | Done `ede3504` |
| 4.8 | Character identity resolution queue (CX-5) | 4 | M | Done `74bee91` |
| 4.9 | Sheet + state identity rebinding (CX-6) | 4 | M | Done `e6f2596` |
| 4.10 | Character capability routing (CX-7) | 4 | S | Done `e3ac404` |
| 4.11 | Character identity dogfood addendum (CX-8) | 4 | M | Done `1fa4624` |
| 4.12 | Sectioned World Bible character experience (CX-9) | 4 | L | Done `569b88b` |
| 4.13 | Retire the separate Character Tools destination (CX-10a) | 4 | M | Done `0354b09` |
| 4.14 | Mechanics first-use journey and complexity audit | 4 | S | Done `5c09713` |
| 4.15 | Progressive mechanics experience | 4 | L | Done `f378a14` |
| 4.16 | Prose-proximate item and state authoring | 4 | L | Done `bf45420` |
| 4.16a | Stable item references + atomic orchestration | 4 | M | Done `70c9b6b` |
| 4.16b | In-workspace acquisition proposal | 4 | M | Done `6663bea` |
| 4.16c | Consumption effect authoring + prose integration | 4 | L | Done `bf45420` |
| 4.17 | Craft library retrieval infrastructure | 4 | M | Done `6296e42` |
| 4.18 | Craft library content — tranche 1 | 4 | M | Done `eeac6da` |
| 4.18a | Craft library content — tranche 2 (full corpus) | 4 | S | Done `658cb86` |
| 4.19 | Derived story dashboard | 4 | L | Done `e936852` |
| 4.20 | Writing coach experience | 4 | L | Done `4e1515c` |
| 4.21 | System negative-space records | 4 | S | Done `603c61f` |
| 4.22 | Progression continuity candidates | 4 | M | Done `1adaff0` |
| 4.23 | Continuity review regression corpus | 4 | S | Done `1763153` |
| 4.24 | Fact-anchored canon contradiction detection | 4 | M | Done `ffcd1bd` |
| 4.25 | Persisted, incremental project review | 4 | M | Done `d6e5ddd` |
| 4.26 | State-backed continuity checks | 4 | M | Done `bd255cd` |
| 4.27a | Sheet-free state: subjects in derivation, replay, and review | 4 | M | Done `925da03` — also fixed prose state suggestions for World Bible characters in every mode |
| 4.27b | Sheet-free state: Workspace capture, scene drawer, Continuity overview | 4 | M | Done `82f51db` — also fixed timeline lookup by World Bible id; dialog-under-drawer overlap split out as 4.84 |
| 4.28 | Manuscript-order validity for canon facts | 4 | M | Done `42c86de` |
| 4.29 | Portable Markdown/CSV export + Markdown-folder import | 4 | M | Done `7cd6895` |
| 4.30 | World Canvas — record, view mode, premise, lenses, questions (WC-1) | 4 | M | Done `f9f3e54` |
| 4.31 | World Canvas — bridges to Source Notes and World Bible (WC-2) | 4 | S | Done `53d7803` |
| 4.32 | World Canvas — derived return experience (WC-3) | 4 | S | Done `eb305e7` |
| 4.33 | World Canvas — author-invoked brainstorming (WC-4) | 4 | M | Done `6fd31ae` |
| 4.34 | World Canvas — purpose, Planning IA, guided focus, lens collapse (WC-5) | 4 | M | Done `47559cd` |
| 4.34a | World Canvas — repeatable lens sketches, Open Threads, and Core Idea bridges (WC-6) | 4 | L | Done `548469d` |
| 4.34b | World Canvas — Reference Palette foundation (WC-7) | 4 | M | Done `8428925` |
| 4.34c | World Canvas — craft-guided coaching (WC-8) | 4 | M | Done `7e486f2` |
| 4.35 | Corkboard scene links — shared link UI, quick-modal links, "Link current scene", stale links (CB-1) | 4 | S | Done `1087766` |
| 4.36 | Corkboard scene links — "Create linked scene" from both surfaces (CB-2) | 4 | S | Done `d4c5e78` |
| 4.37 | Corkboard scene links — chapter-card context line in Workspace (CB-3) | 4 | S | Done `35d99a4` |
| 4.38 | Model-assisted canon check (author-triggered, via 1.5) | 4 | M | Done `da6b584` |
| 4.39 | AI consultation budget model + point-of-use explanation | 4 | M | Done `ac84793` |
| 4.40 | Local model runs: no response cap, visible thinking, elapsed time, Stop | 4 | L | Done `1749c8f` |
| 4.41 | Hosted response limits as a cost ceiling (plan, then build) | 4 | M | Done `910b7a0` |
| 4.42 | Character voice contract (CL-1) | 4 | S | Done `b69a76f` |
| 4.43 | Talk to a character + reaction test (CL-2) | 4 | M | Done `1e9c79a` |
| 4.44 | Character scenes, 2–3 characters (CL-3) | 4 | M | Done `9b5e7b6` |
| 4.45 | Character from a rough description (CL-4) | 4 | M | Done `3a542cf` |
| 4.46 | Character snapshot service + shared stat card (SP-1) | 4 | S | Done `e9a7017` |
| 4.47 | Stat peek from the editor and command palette (SP-2) | 4 | M | Done `c94356f` |
| 4.48 | Pinned stat panel across writing and brainstorming (SP-3) | 4 | M | Done `f1b4831` |
| 4.49 | Local Ollama runs receive project and craft context | 4 | S | Done `003a2dc` |
| 4.50 | AI text provenance mark (AD-1) | 4 | M | Done `a6197d6` |
| 4.51 | AI text report (AD-2) | 4 | S | Done `1f80e78` |
| 4.52 | Opt-in AI scene drafts (AD-3) | 4 | M | Done `bf8eecb` |
| 4.53 | Model-assisted review items in the shared review model | 4 | M | Done `b7ae00c` |
| 4.54 | Document import structure fidelity | 4 | M | Done `e7bef24` |
| 4.55 | Import heading destinations | 4 | M | Done `0c6a6f9` |
| 4.56 | Multi-document import flow + category manager dialog | 4 | M | Done `8489786` |
| 4.57 | Source Note import fidelity + formatted display | 4 | M | Done `8da6811` |
| 4.58 | Source Note visual editor (Markdown-backed) | 4 | M | Done `d52065e` |
| 4.59 | Remembered Markdown source view for Source Notes | 4 | S | Done `51cf694` |
| 4.60 | Collapsible Source Notes intake panel | 4 | S | Done `3092929` |
| 4.61 | Multi-file Source Note import | 4 | M | Done `f3bfab5` |
| 4.62 | Character custom fields on Canon | 4 | S | Done `52a36ab` |
| 4.63 | Uncramped World Bible editing (Portable data → More, hide create panel while editing) | 4 | S | Done `7a4e486` |
| 4.64 | Singular/plural World Bible highlighting | 4 | S | Done `36300bb` |
| 4.65 | Assistant reply reading view | 4 | S | Done `0d206a7` |
| 4.66 | Visible assistant selection handoff | 4 | S | Done `54ccf24` |
| 4.67 | Local OpenAI-compatible provider | 4 | M | Done `564e52b` |
| 4.68 | Constrained local output for proposals | 4 | S | Done `1ec212f` |
| 4.69 | Character card import | 4 | M | Done `d889809` |
| 4.70 | Character card export | 4 | S | Done `b28ac17` |
| 4.71 | Context budget + linked-record pull-in | 4 | M | Done `fc55377` |
| 4.72 | Prompt breakdown with token counts | 4 | S | Done `0e3b8db` |
| 4.73 | Alternative replies | 4 | M | Done `82dacc8` |
| 4.74 | Rolling Character Lab summaries | 4 | M | Done `545a7d3` |
| 4.75 | Local reply length from server context | 4 | S | Done `4bf1e2a` |
| 4.82 | Ordinary assistant rolling summaries | 4 | M | — post-beta candidate; after the relevant 3.32 assistant/context seam |
| 4.83 | Source-linked scene digest pilot | 4 | M | — experimental candidate from 1.6; no production memory change |
| 4.84 | Workspace dialogs open above the context drawer | 4 | S | — (independent; found in 4.27b) |
| 4.76 | Places: containment and connections | 4 | M | Done `f6ae85d` |
| 4.77 | Places: positions refer to place records | 4 | M | Done `8e74bc3` |
| 4.78 | Places: where-is-everyone view + movement checks | 4 | M | WIP |
| 4.79 | Maps and placements (data, distance) | 4 | L | — (after 4.76) |
| 4.80 | Map surface: image import, pins, scene view, export | 4 | L | — (after 4.78, 4.79) |
| 4.81 | Grid and hex maps | 4 | M | — (after 4.80) |
| 5.1 | Auto-update decision + implementation | 5 | M | Done `c1c4f33` + `7357671` + `4efa1d1` + `a56e5dd` |
| 5.2 | Code signing + notarization, both platforms | 5 | M | In progress (author-approved exception to the Phase 5 gate, 2026-10-31) — data folder moved to `SagaSpine` with a one-time migration and packaged test; builds stay unsigned through the beta by author decision; signing (macOS first) before paid launch |
| 5.3 | Packaged-app validation + Electron E2E | 5 | M | Done `9d748f4` + `613a8e3` + `88eb908` + `5ad6a77` |
| 5.4 | Progressive first-run onboarding + sample project | 5 | L | Done `a5644b1` |
| 5.5 | AI provider setup UX hardening | 5 | M | Done `1c15774` |
| 5.6 | Local-only error handling | 5 | S | Done `8709ec1` |
| 5.7 | Trial + license key gate | 5 | M | — |
| 5.8 | Help/docs baseline | 5 | S | Done `64cf02c` |
| 5.9 | Landing page + demo assets | 5 | M | — |
| 5.10 | Author-facing vocabulary sweep | 5 | XS | Done `69e6559` |
| 5.12 | App-shell toast viewport + status live region | 5 | S | Done `7f303f7` |
| 5.14 | Optional encrypted backups | 5 | S | Done `7669198` |
| 5.15a | Project vaults: vault core | 5 | M | Done `f4bd848` |
| 5.15b | Project vaults: UX + derived data | 5 | L | Done `84b70bb` |
| 5.15c | Project vaults: verification + copy | 5 | M | Done `a1b9621` |
| 5.16 | First-release dogfood polish | 5 | M | Done `9b242c1` |
| 5.17 | Writing-flow stability + assistant continuity | 5 | L | Done `dc0460c` |
| 5.18 | Per-project AI switches (coaching, prose) | 5 | M | Done `bee5089` |
| 5.19 | Custom AI actions in the selection menu | 5 | M | Done `da9ed97` |
| 3.32 | Break up the oversized route files along feature seams | 3 | L | Done `0145d97` — World Bible 2,145 → 596; Lore 1,766 → 194; Workspace 1,841 → 991 (drawer 1,284 → 567); Character Sheets 2,042 → 249; CSS as 3.32a. Workspace misses the 600 target; author accepted it (2026-11-12): line targets are aims, not hard limits |
| 3.32a | Split the World Bible CSS module along component seams | 3 | M | Done `25d0b92` — 19 modules, largest 466 lines; 52 before/after screenshots pixel-identical |
| 3.33 | Code tour for maintainers | 3 | M | — (author request, 2026-11-07; stable half now, route sections after 3.32) |
| 3.34 | One module per state-change kind, one change vocabulary (mechanics registry) | 3 | L | Done `fb53c2a` — CI flake to fix: Windows Desktop E2E `app-updates.e2e.ts` ("checks at startup once allowed…") timed out waiting for the update card once on PR #102, passed on rerun; unrelated to 3.34 |
| 3.34a | XP and levels through the scene ledger (first new kind on 3.34) | 3 | M | Done `8b6af1e` — inserted stat blocks replay level and XP only; their stats and resources still come from the sheet |
| 3.35 | Route every project-mode decision through project capabilities | 3 | S | Done `00647c0` — 5 named mode capabilities in `projectMode.ts`; `isGeneralFiction` removed |
| 3.36 | Game Simulation brief (design only) | 3 | S | Done `20cd067` |
| 3.37 | Places and maps brief (design only) | 3 | S | Done `05f1ed6` |
| 6.1 | Beta build + cohort recruitment | 6 | M | — |
| 6.2 | Beta feedback triage + fix slices | 6 | ? | — |
| 6.3 | Release-readiness checklist + RC | 6 | M | — |
| 6.4 | Launch | 6 | S | — |

## Open Slices

### Phase 1 — Trust validation

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

**1.6 Context and memory baseline + benchmark.** Author-requested
investigation (2026-11-11), prompted by a broad external brief that did not
have the current code. Establish whether SagaSpine needs generated scene
digests, rolling assistant summaries, or a dedicated small local model before
adding implementation scope.

- **Current-state audit.** Trace the actual save-to-prompt paths for primary
  manuscript and canon data, deterministic state, indexed context, project
  memory, and conversation history. Name the owning files and distinguish
  authoritative records from rebuildable derived data. Correct the source
  brief's assumptions, including that the internal `ShodhMemoryService` is
  not the Shodh associative-memory library and that a local embedding model
  already ships with the app.
- **Baseline benchmark.** Add a deterministic, repeatable harness over the
  real retrieval and context-selection services for representative distant
  recall, end-of-scene details, revised history, changing relationships,
  project isolation, and conversation-history pressure. Compare at least
  indexed context alone with indexed context plus today's 500-character
  project-memory extracts. Do not use a model's self-reported confidence as
  evidence. Record retrieval accuracy, selected sources, context size, and
  latency separately from generation quality.
- **Prototype boundary.** If useful to answer the decision, prototype
  source-linked scene digests with an already installed local model outside
  production behavior. A digest is derived, non-canon, tied to a source
  revision/hash, and invalidated by an edit. Any proposed structured fields
  and evidence spans are deterministically parsed and validated; no model
  output writes to canon, mechanics, or state. Do not bundle or download a
  generative model in this slice.
- **Decision report.** Write a dated, non-authoritative report under `docs/`
  covering observed architecture, benchmark results, performance, risks, and
  a recommendation. Decide independently whether to schedule (a) ordinary
  assistant rolling summaries based on the author-visible Character Lab
  pattern, (b) source-linked scene digests, (c) a named local
  memory-extraction model route, or (d) a bundled generative model. Do not add
  those implementation slices without evidence from this work. Link the
  report from `docs/README.md` while it remains active input; archive it after
  accepted decisions are folded into the authority docs and roadmap.
- **Order.** The audit and benchmark may run alongside 3.32 because they do
  not change application behavior. Any follow-up that changes the Workspace
  assistant waits for the relevant 3.32 route/context-drawer split. Complete
  this investigation before resuming the fresh 1.1 trust run if its accepted
  outcome will change retrieval or prompt assembly.
- **Verify.** Documentation/tooling tier for the audit and report. If the
  benchmark adds test or harness code, run the CI-policy tests, file-size
  gate, fast battery, and the coverage tier selected by
  `CI_BASE_SHA=origin/main node scripts/ci/detect.mjs`. Report measured
  benchmark inputs and outputs so another run can reproduce the comparison.

### Phase 3 — Code fitness

- **3.32 Break up the oversized route files along feature seams.**
  Pre-beta (author decision, 2026-11-07; after 5.19). Raised when 5.18
  showed the size gate pushing small, hard-to-find extractions.
  Behavior-preserving refactor. Instead of shaving a few lines off a
  hotspot in each feature slice, split each file once, on purpose, along
  the seams a reader would look for:
  - **Files.** `WorldBibleRoute.tsx` (2,145 lines, 29 `useState`),
    `CharacterSheetsRoute.tsx` (2,105, 37), `WorkspaceRoute.tsx` (1,829,
    13 effects), `LoreRoute.tsx` (1,766, 38), and
    `WorkspaceContextDrawer.tsx` (1,284). Their CSS modules
    (`WorldBibleRoute.module.css`, `WorkspaceRoute.module.css`) split with
    the components that use them. `EditorWithAI.tsx`, `AISettings.tsx`,
    and `ConsistencyEngineService.ts` are out of scope unless a seam falls
    out naturally.
  - **Method.** Per file, write the seam map first, in the PR description:
    each section of the screen or concern, the state and handlers it owns,
    and the file it moves to (a section component plus a hook for its
    state, in a folder named after the route, such as
    `components/WorldBible/record/`). The route keeps routing, data
    loading, and layout. Fold back any size-only fragments made earlier
    (for example `WorldBibleRecordAiHelperToggle`) into the section they
    belong to.
  - **Targets.** Each route file under 600 lines; no new file over 600; no
    component that is only markup passed through from its parent.
  - **Order.** One PR per route, World Bible first (largest and most
    fragmented). After 5.19, which adds to the Workspace selection menu and
    assistant, so the two do not collide; a 5.19 seam such as a
    selection-menu component counts toward this slice.
  - **Verify.** Full-coverage tier per PR, with no test changes beyond
    import paths; `--update` the size baseline as files shrink, and drop
    each file from it once under 1,000 lines.

- **3.32a Split the World Bible CSS module along component seams.**
  Split out of 3.32 (2026-11-07) so visual changes can be reviewed apart from
  the component split. Behavior-preserving: no visual change at any width or
  theme.
  - **Scope.** `apps/web/src/assets/components/WorldBibleRoute.module.css`
    (2,487 lines, ~173 classes, imported by 28 components after the 3.32
    route split). Move each component's rules into a module beside it, for
    example `components/WorldBible/record/RecordNamesSection.module.css`,
    following the `components/WorldBible/` and `record/` folders that 3.32
    created. Group related components when they share most of their classes
    (the import-draft family: `ImportDraftCard`, `ImportSectionPanel`,
    `WorldBibleImportWorkspace`, `ImportDocumentPreviewDialog`).
  - **Shared classes.** 41 classes are used by more than one file (most:
    `reviewHint` ×7, `primaryButton` ×6, `reviewToolbarActions` ×5,
    `formGroup` ×3, `castTask` ×3). Keep genuinely shared primitives in one
    small `WorldBible/worldBibleShared.module.css` rather than copying them;
    if one already exists in `styles/` or as a theme-level class, use that
    instead. Do not duplicate a rule into two modules.
  - **Cascade risks.** Five `@media` blocks (max-width 900px ×3, 620px ×2)
    override earlier rules; each override must move with the rule it
    overrides. Watch selectors that combine classes from different sections
    (descendant or compound selectors) and the `:global(.tiptap-editor)` /
    `:global(.ProseMirror)` rules under `.itemDescriptionField`. Splitting
    changes stylesheet load order, so check any two rules of equal
    specificity that target the same element.
  - **Dead rules.** About 11 classes have no `styles.x` reference
    (`castHeaderActions`, `categoryManager`, `characterImportReviewCard`,
    `characterImportReviewList`, `fieldActionRow`, `helpPanel`,
    `reviewFocusPanel`, `reviewFormNotice`, `reviewSummaryLabel`,
    `reviewSummaryMeta`, `reviewSummaryPreview`). Confirm each is unused
    (search for string class names and bracket access too) before deleting.
  - **Rules.** Follow the Design System section of
    `docs/product-blueprint.md`; keep existing theme tokens and values as
    they are. Do not restyle while moving.
  - **Targets.** The old module is deleted; no new CSS file over 600 lines;
    the baseline entry for `WorldBibleRoute.module.css` is dropped.
  - **Verify.** Full-coverage tier with no test changes. Before/after
    screenshots of World Bible (category list, character record each tab,
    general record, item description-first draft, import preview, review
    queue, category manager) at desktop width and at ≤620px, in light and
    dark themes, attached to the PR.

- **3.33 Code tour for maintainers.** Author request (2026-11-07). The
  active docs record rules and boundaries (`architecture-review.md`,
  `domain-model.md`, `AGENTS.md`) but no map of where code lives and how it
  connects. Write `docs/code-tour.md`: a 15–20 minute read for the author
  first and for any coding agent second. It must not depend on a particular
  AI tool or vendor. Link it from `docs/README.md` and from the `AGENTS.md`
  read order.
  - **Contents.**
    1. Mental model: one diagram of route → hook → service → storage
       (IndexedDB), the Electron host's provider bridge, and where
       `packages/rules-engine` and `packages/rules-ui` sit.
    2. Folder map: one line per top-level `apps/web/src` folder and per
       `services/` folder (about 30), each marked core or peripheral.
    3. Traced features, start to finish, naming each file in order: saving
       a World Bible record; running a custom AI selection action
       (switch check, prompt, provider, proposal, author approval);
       replaying character state through the manuscript; backup and
       restore.
    4. Where data lives: IndexedDB stores, files on disk, which indexes
       (RAG, Shodh) can be rebuilt and how.
    5. Troubleshooting playbook: symptom → first place to look → the test
       or smoke procedure that covers it.
    6. Glossary of the app's own terms (canon, proposal, Shodh, RAG,
       state ledger, compendium, coaching/prose switches, and so on).
  - **Order.** Sections 1, 2 (outside the routes), 4, and 6 now. Route-level
    maps and traces that pass through a route still being split wait for
    that route's 3.32 PR, so the tour does not go stale on arrival.
  - **Upkeep.** Add a standing rule to `AGENTS.md`: a slice that moves a
    seam, renames a folder, or changes a traced path updates the tour in
    the same PR.
  - **Verify.** Documentation tier. Every file path and symbol named in the
    tour is checked against the code (a script or a listed manual check);
    each trace is followed once in the running app or the tests that cover
    it.

- **3.34 One module per state-change kind, one change vocabulary
  (mechanics registry).** Author request (2026-11-08). Part of
  future-proofing for Game Simulation (see 3.36 and the Ruleset and State
  rules in `docs/architecture-review.md`). Applies to projects with game systems on (LitRPG
  and the legacy Game Simulation mode); General Fiction is unaffected.
  Stats, resources, and compendium rules are already author data. The
  *kinds* of change a scene can record (`resource_change`/`_set`,
  `stat_change`/`_set`, `status_apply`/`_remove`, `inventory_*`,
  `location_set`) are not: each is handled by hand in 15–20 files.
  Behavior-preserving: move each kind into one place so adding a kind means
  one new module plus one registry line.
  - **Today's touch points** (verify with
    `grep -rln "'location_set'" apps packages`): the command types, Zod
    schemas, and replay in `packages/rules-engine/src/manuscript/`; label
    and before/after summary in `services/state/stateMutationPresentation.ts`;
    `stateMutationDerivation.ts`, `positionedStateChange.ts`,
    `consumableEffects.ts`, `stateContinuityReview.ts`;
    `services/characters/characterSheetRuleset.ts` and
    `characterSheetDefaults.ts`; the AI observation enum in
    `services/worldEngine/types.ts` and `stateDeltaObservations.ts`;
    `components/CharacterSheets/MutationForm.tsx`,
    `components/Workspace/PositionedStateChangeComposer.tsx`, the
    mutation-type switch in `routes/CharacterSheetsRoute.tsx`;
    `services/dashboard/storyDashboard.ts`; test fixtures.
  - **Shape.** Group kinds by family (resource, stat, status, inventory,
    location). Each family has an engine module in
    `packages/rules-engine/src/manuscript/kinds/` (schema, replay step,
    label, summary; no UI) and an app module in
    `apps/web/src/services/state/kinds/` (form fields, composer input,
    sheet-ruleset mapping, AI observation mapping, any continuity checks).
    Each registry is typed as a `Record` over the command `type` union, so
    `tsc` fails when a kind lacks a piece. Derive the AI observation enum,
    the form dropdown, and the discriminated-union schema from the
    registry instead of hand lists. Kind modules turn input into commands
    but never decide whether a command is proposed or applied (the caller
    does), and do not read scene fields (`sceneId`, `sceneOrder`,
    `scenePosition`), so Game Simulation sessions can reuse them
    (`docs/game-simulation-brief.md` § 8).
  - **One change vocabulary.** Three shapes describe "change a value"
    today: the ledger commands above; Compendium consumable effects
    (`CompendiumConsumableEffect` in `entityTypes.ts`, turned into commands
    by `buildConsumableCommands` / `buildConsumableExpirationCommands` in
    `services/state/consumableEffects.ts`) and milestone rewards
    (`CompendiumRewardEffect`); and the rules engine's field-path `Effect`
    (`packages/rules-engine/src/types/Effect.ts`). Per Decision 5 of
    `docs/archive/rules-engine-plan.md`, make the kind modules the only
    path from any of them to ledger commands: each family module exposes
    the translation from an effect to its commands. Move consumables onto
    it with no behavior change. Add the translation for engine `Effect`
    targets that map cleanly to a kind (for example a resource's current
    value), with unit tests, so rule-proposed commands (R4 in the plan) can
    use it later; a target that does not map returns "not translatable"
    rather than a guess. Stored effect shapes stay as they are; this is
    translation only.
  - **Rules.** No stored-data change and no schema bump: command `type`
    strings and shapes stay exactly as they are. The AI trust boundary is
    unchanged; models still only propose observations, and registry code
    validates them. Keep each module small; no pass-through wrappers.
    Document "adding a kind" (a short checklist) in
    `docs/domain-model.md` §3 and, once it exists, the 3.33 code tour.
  - **Order.** After 3.36 if possible, so the module shape is checked
    against the brief. Before the Character Sheets route split in 3.32, so
    the route's mutation switch moves once.
  - **Verify.** Full-coverage tier with no test changes beyond imports;
    replay and presentation unit tests must pass unchanged.

- **3.34a XP and levels through the scene ledger.** The first kind added
  on 3.34, proving the structure. Today `CharacterSheet.level` and
  `experience` are hand-edited sheet fields; stat blocks read them directly
  (`services/workspace/statBlockResolution.ts`,
  `services/state/characterSnapshot.ts`), so a scene cannot record "gained
  250 XP" and earlier scenes cannot show the earlier level.
  - **Scope.** A new `xp_gain` command (actor, amount, optional reason)
    replayed in scene order; the sheet's stored `experience` and `level`
    become the starting values. An optional author-defined level table on
    the ruleset (thresholds, for example level 2 at 100 XP) derives the
    level at any scene; without a table, level stays as the author sets it.
    Stat blocks, the character snapshot, and the Character Sheets history
    show replayed XP and level. Form, composer, and AI observation support
    come from the 3.34 module, not separate edits.
  - **Rules.** The level table is ruleset data; adding it is a ruleset and
    snapshot schema change with a migration and a restorable backup per
    4.2. AI may propose `xp_gain` observations only; the author accepts
    them like any other state change. Level-ups never rewrite prose.
  - **Out of scope.** Level-up rewards (stat points, unlocks), multiple XP
    tracks, and XP for General Fiction.
  - **Verify.** Full-coverage tier. Unit tests for replay (gains across
    scenes, invalidated events, out-of-order scenes) and level derivation;
    a Cypress spec that records XP in a scene and sees the level change in
    a later scene's stat block.

- **3.35 Route every project-mode decision through project capabilities.**
  Author request (2026-11-08). `getProjectCapabilities` in
  `apps/web/src/projectMode.ts` already answers "what can this project
  do?", but 28 checks in 7 files compare the mode directly
  (`routes/WorkspaceRoute.tsx` ×10, `services/worldBible/worldCanvasDerived.ts`
  ×6, `components/WorldBible/WorldCanvasView.tsx` ×4,
  `services/workspace/statBlockResolution.ts` ×2, `routes/CorkboardRoute.tsx`,
  `routes/WorldCanvasRoute.tsx`, `services/onboarding/firstRun.ts`; verify
  with `grep -rnE "projectMode *[!=]==|isGeneralFiction" apps/web/src`).
  Behavior-preserving.
  - **Scope.** Give each distinct decision a named capability (for example
    "inserts live stat blocks" rather than `projectMode === 'litrpg'`), set
    per mode in `projectMode.ts`, and replace the direct checks. Turning a
    mode on or changing what it does then means editing one table.
  - **Rules.** No stored-data change. No new direct mode comparison outside
    `projectMode.ts` (standing rule in `docs/architecture-review.md`).
  - **Order.** With or right after the 3.32 Workspace split, so
    `WorkspaceRoute.tsx`'s checks move once.
  - **Verify.** Full-coverage tier; add unit tests for the capability table
    for each mode, including Game Simulation.

- **3.36 Game Simulation brief (design only).** Author request
  (2026-11-08). Game Simulation is hidden for the first release and has no
  written definition, so restructuring for it would be guesswork. Write
  `docs/game-simulation-brief.md` (1–3 pages) with the author: the agent
  drafts questions and options, and the author decides.
  - **Questions.** Who uses it (game master, players, solo play)? What is a
    session, and does play produce manuscript text or stand apart from it?
    What does time mean (scenes, sessions, turns, in-story days)? Who holds
    state (characters, party, settlement, world)? What happens automatically
    and what is only proposed (the trust boundary)? What carries over from
    LitRPG, and what is out of scope?
  - **Then.** Check 3.34, 3.35, and the Ruleset and State rules in
    `docs/architecture-review.md` against the brief and note any change
    needed. Link the brief from `docs/README.md`.
  - **Rules.** No code. Not a commitment to build Game Simulation.
  - **Verify.** Documentation tier; the author signs off on the brief.

- **3.37 Places and maps brief (design only).** Author request
  (2026-11-08). LitRPG and Game Simulation need to know where places are
  and where characters are, and a graphical map was raised as a later
  extension. Today `location_set` stores places as free text and locations
  have no hierarchy, connections, or coordinates. Write
  `docs/places-and-maps-brief.md` with the author.
  - **Questions.** How do positions refer to places? Containment and
    connections? Where do coordinates live, and how is distance measured?
    What story time do travel checks need? Which checks, and are they
    warnings? What is the map surface's input and output? Where does AI stop?
  - **Decided (2026-11-08).** Coordinates are needed; they are stored per
    map (placements), not globally; the map is an extension built last, from
    imported images with pins; all of it comes before the beta; no story
    time between scenes for now; one parent per place, nested to any depth;
    distance units per map.
  - **Then.** Slices 4.76–4.81 on the board. Link the brief from
    `docs/README.md`.
  - **Rules.** No code. Not a commitment to build.
  - **Verify.** Documentation tier; the author signs off on the brief.

### Phase 4 — Places, positions, and maps (before beta)

Design: `docs/places-and-maps-brief.md` (3.37). Each slice follows the
State rules in `docs/architecture-review.md` and the trust boundary in the
brief's § 9: AI only proposes positions, places, parents, and connections.
Movement checks are review findings, never blocks.

- **4.76 Places: containment and connections.** Brief § 3. A location record
  may name one parent location (nested to any depth; cycles refused). Places
  may be linked by connections (kind, optional authored distance in the
  author's words plus a number and unit, optional travel times by mode,
  two-way unless marked one-way). Edit both in the World Bible location
  record. Project schema bump with migration and restorable backup per 4.2;
  portable export (4.29) and backups carry the new data.
  - **Verify.** Full-coverage tier; unit tests for cycle refusal and
    containment lookups; e2e for editing a parent and a connection.

- **4.27 Sheet-free descriptive state for general fiction.** Moved before
  the beta (author decision, 2026-11-08) so place positions (4.77–4.80)
  reach characters without a sheet. Build after 4.76 and before 4.77. Let
  canonical characters carry descriptive state (location, custody of named
  items, and later allegiance/disguise) without a ruleset or
  `CharacterSheet`: a minimal replay target keyed by World Bible entity id,
  the existing `location_set` / `inventory_*` commands only (through the
  3.34 kind modules), and the same accepted-ledger, scene-ordered,
  invalidatable rules as mechanics state. Do not add stats or resources to
  general fiction; this is descriptive state only.
  - **Decisions (author, 2026-11-11).** No stored starting state: a
    sheet-less character starts with no location and nothing held, and the
    author records their opening place and items in their first scene. So no
    schema bump, migration, or backup change (this replaces the earlier plan
    for one). Split in two PRs.
  - **4.27a Subjects in derivation, replay, and review.** A state subject is
    a sheet or a World Bible character without one. Derivation stops
    discarding sheet-less observations; the review queue previews them; 4.26's
    checks run for every project mode. Update `docs/domain-model.md` §3.
    Verify: full-coverage tier; replay tests for a sheet-less character
    beside a sheeted one; e2e for a General Fiction suggestion, acceptance,
    and conflict finding.
  - **4.27b Workspace surfaces.** The Workspace acquisition proposal (4.16b)
    and scene drawer recording gain the state-only path for sheet-less
    characters (turning on `canCaptureSelectionAsInventory` for General
    Fiction); the World Bible Continuity overview shows each character's
    current location and items held. Update the smoke procedures. Verify:
    full-coverage tier; e2e for the General Fiction acquisition proposal and
    the Continuity overview.

- **4.77 Places: positions refer to place records.** Brief § 3. Add an
  optional place record id to `location_set` (through the 3.34 kind modules;
  the name stays as label and fallback). One-time matching of existing
  free-text positions by name and alias where unambiguous; everything else
  stays text and is offered for review. The "two places at once" check and
  the existing location continuity check (1.2b, 4.26) become
  containment-aware and compare ids when both sides have one.
  - **Verify.** Full-coverage tier; replay tests for old free-text entries
    and new id entries side by side; migration test for the matching.
  - **Done.** The "two places at once" check is the 1.2b/4.26 static
    location check, now containment-aware. Unlinked names go to a World Bible
    review queue (link, create, or keep as text); new moves auto-link only on
    an exact single match. `WorldBibleRoute.tsx` is 608 lines.

- **4.78 Places: where-is-everyone view + movement checks.** Brief § 7.
  Show each character's position at a chosen scene and a character's path
  over a range of scenes, derived from the ledger by replay. Add review
  findings for a move with no connection or route and no travel cue
  ("teleporting"), and for a position that matches no place record (offer to
  create or link). No story time; the "too fast" check is not in scope.
  - **Verify.** Full-coverage tier; e2e for the view and each new finding.

- **4.79 Maps and placements (data, distance).** Brief §§ 4–5. Map records
  (name, optional image reference, distance unit, scale, optional parent
  placement) and placements (place, map, x, y). Author-set unit conversions.
  Distance service: authored connection, then route, then straight line,
  always returning its source; figures in different units without a
  conversion are shown side by side, never compared. No map surface yet;
  placements can be entered as numbers in the location record. Schema bump,
  migration, backup, and portable export as in 4.76.
  - **Verify.** Full-coverage tier; unit tests for each distance source,
    cross-map distance through parent placements, and unit conversion.

- **4.80 Map surface: image import, pins, scene view, export.** Brief § 8.
  Import an image as a map background (size limit with a clear message;
  backups, vaults, and export carry it). Pin place records onto it to create
  placements, show who is where at a chosen scene, and export the pinned map
  as an image. No drawing tools. Follows the Design System in
  `docs/product-blueprint.md`; keyboard-usable pin placement.
  - **Verify.** Full-coverage tier; e2e for import, pin, scene switch, and
    export; screenshots at desktop and ≤620px, light and dark.

- **4.81 Grid and hex maps.** Brief § 4. Optional per-map grid or hex
  setting; distance on that map is counted in squares or hexes. For dungeon
  and tactical maps in LitRPG and later Game Simulation.
  - **Verify.** Full-coverage tier; unit tests for grid and hex distance.

### Phase 4 — Post-beta context candidates

- **4.82 Ordinary assistant rolling summaries.** Follow-up accepted from
  Slice 1.6's deterministic baseline: the ordinary assistant keeps only
  recent complete turns within a 512–6,000-token budget and drops older
  turns, while Character Lab already has an author-visible compression
  pattern. Generalize that pattern without changing the saved transcript.
  - **Behavior.** When earlier completed turns no longer fit, offer an
    author-invoked summary; keep at least the two newest complete turns
    verbatim. Show the bounded summary, the turns it covers, and an editor.
    It is working conversation context, never canon, never a Source Note,
    and never a manuscript edit. Removing it restores the original turns to
    prompt eligibility. Do not summarize discarded alternative replies.
  - **Safety.** The request sends only the covered conversation. Validate
    deterministic word/character limits, source turn ids, and a conversation
    revision before using the result; if the transcript changes during the
    run, keep the old state and ask the author to retry. A failed or stopped
    summary leaves the full history unchanged. Follow the AI coaching switch,
    route disclosure, Stop, and consultation accounting.
  - **Persistence decision.** Start session-local, matching Character Lab.
    Do not persist summaries across restart until beta evidence shows that
    long-lived assistant conversations are an author workflow rather than
    disposable help.
  - **Order.** After the relevant 3.32 assistant/context-drawer seam is
    stable. Promote before beta only if the resumed 1.1 run demonstrates
    material loss of conversation continuity.
  - **Verify.** Full-coverage tier. Unit tests for threshold, source coverage,
    extension, edit bounds, transcript races, failure/Stop, and prompt
    substitution; UI test that the author can inspect, edit, remove, and
    regenerate the summary while the visible transcript remains intact.

- **4.83 Source-linked scene digest pilot.** Experimental follow-up from
  Slice 1.6. Determine whether model-proposed scene digests improve evidence
  recall beyond indexed context before changing the production Project memory
  feature or bundling a generator.
  - **Corpus and comparison.** Extend the 1.6 harness with a representative,
    rights-safe fixture covering end-of-scene facts, distant recall, evolving
    relationships, character knowledge, revisions, and project isolation.
    Compare indexed context alone, today's 500-character extracts, and
    generated digests. Measure relevant-evidence recall, unsupported claims,
    selected context tokens, source coverage, local latency, and invalidation;
    keep generation quality separate from retrieval quality.
  - **Prototype.** Use an explicitly selected model already installed in
    verified private-local Ollama or a loopback OpenAI-compatible server. No
    download, bundled generator, hosted fallback, or permanent background
    model. Candidate fields are events/decisions, participants, state changes,
    knowledge gained, promises/open threads, and exact evidence spans.
  - **Trust boundary.** Digest records are derived, non-canon, and carry
    project id, scene id, source revision/hash, route/model provenance, and
    validation status. Deterministic code validates the response schema,
    evidence spans against source text, referenced entity ids, bounds, and
    source revision. An edit invalidates the digest. No output writes to
    canon, mechanics, state, or production memory in this slice.
  - **Decision gate.** Produce a go/no-go result for a production digest
    feature and a named `memory-extraction` route. Consider a bundled
    quantized generator only if the pilot shows material value and separately
    installed local models prove an unacceptable dependency. Do not schedule
    either merely because the prototype runs.
  - **Verify.** Tooling or unit-only tier while the prototype remains outside
    production behavior; use the full-coverage tier if shared runtime,
    persistence, provider, or prompt-assembly code changes. Record the exact
    fixture revision, model, quantization, context, hardware, settings, and
    measured outputs for reproducibility.

- **4.84 Workspace dialogs open above the context drawer.** Found while
  building 4.27b. Dialogs opened from the Workspace context drawer render
  underneath it: `.modalOverlay` uses `z-index: 1000` and the drawer's
  `.contextOverlay` uses `1250` (`WorkspaceRoute.module.css`). Below roughly
  1,200px wide, the open drawer covers part of the dialog. In the scene
  roster, `Record change here` hid the change dialog's Location field at
  1,000px. Affected: the positioned change dialog (`Record change here`,
  `Consume here`, timeline `Edit` and expiration) and the selection item
  capture dialogs when the drawer is open. Check every Workspace dialog that
  can open while the scene or context drawer is open. Fix the stacking order
  so a dialog always sits above both drawers and below nothing it should
  cover (the consistency popover is `1300`). Prefer one shared layer scale
  over another one-off number. Focus trap, Escape, and focus return to the
  drawer control must keep working.
  - **Verify.** Fast battery plus the Workspace Cypress specs; e2e at
    1,000px wide that opens `Record change here` from the scene roster with
    the drawer open and types into the dialog without forcing. Then remove
    the wide-viewport workaround in `general-fiction-state.cy.ts`.

### Phase 5 — Release engineering

- **5.2 Code signing + notarization.** Author decision (2026-10-31): builds
  stay **unsigned through the beta (6.1)**, and each release page carries the
  "first launch" steps in `docs/release-process.md`. Signing lands before
  the paid launch, macOS first: Apple Developer ID + notarization, then let
  signed macOS builds install updates in place (5.1 leaves macOS on the
  release page). Windows signing may follow the paid launch; the likely
  route is Azure Artifact Signing (US/Canada individuals, no hardware token,
  works in CI), with an OV certificate on a cloud-held key as the fallback.
  When it lands, set the Windows `publisherName` so downloaded updates are
  signature-checked, and add signing settings only when the CI secrets are
  present (electron-builder's Azure setting forces signing when it is in the
  config). Unsigned costs: Windows shows "Unknown publisher" and SmartScreen
  "Run anyway", and every new version starts with no SmartScreen reputation;
  macOS blocks the first open (Privacy & Security → Open Anyway) and can
  report a downloaded app as damaged.
  Data folder (found in 5.1, done ahead of signing): the packaged app is
  named `desktop`, which was the author's data folder. The main process now
  uses a `SagaSpine` data folder and moves the old `desktop` folder there in
  one rename on first launch (`dataFolder.ts`, packaged test
  `data-folder.e2e.ts`). The Electron app name stays `desktop` so keys saved
  with the system keychain still decrypt; renaming it, and the Windows
  install folder, would need its own migration.
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
- **5.18 Per-project AI switches (coaching, prose).** Raised in 2026-11-07
  dogfooding: an author must be able to write without AI, and to accept AI
  feedback without accepting AI-written prose. Add two independent
  switches at the top of Settings → AI Settings, per project:
  - **AI coaching** — AI that reads and responds and never puts text into
    the manuscript: assistant chat and its prompt tools, writing coach
    (inline and dashboard), **Ask your project**, model-assisted canon
    check and review items, canon decision consultations, progression
    continuity, World Canvas coaching, Workspace context actions, and
    `note` AI actions (5.19). Also World Canvas brainstorming, **Talk to**
    a character, and **Character from a description**, which produce world
    material for review rather than manuscript prose (author decision,
    2026-11-07).
  - **AI prose** — every path that puts model-written text into the
    manuscript: **Preview scene revision** from the assistant, **Draft this
    scene**, **Character scene**, and `replace` AI actions (5.19).
  - **Defaults.** Every project starts with both switches off, including
    projects saved before this slice (there are no released users yet, so
    no migration keeps AI on). AI Settings says where the switches are.
  - **When a switch is off**, its surfaces are hidden, not disabled (with
    coaching off and prose on, the assistant drawer shows only what prose
    needs), and the shared LLM call path refuses requests tagged with that
    switch's features, so a surface the UI missed still cannot send. Every
    `ConsultationFeature` in `services/editor/inspectorBudgetService.ts`
    is assigned to exactly one switch, and a test fails when a new feature
    has none. Deterministic features (review, extraction rules, canon,
    replay, dashboard measurements) and on-device search do not depend on
    either switch.
  - With both off, the rest of AI Settings collapses to a short note; saved
    provider settings and keys are kept.
  - Replace the misleading **Enable AI consultation actions in Lore
    Inspector** checkbox (it gates several features, not the Lore
    Inspector, and the assistant ignores it); fold its stored value into
    the coaching switch without turning anything off for authors who had
    it on.
  - Help (**Setting up AI**, **Where your data goes**) explains both
    switches. Verify with unit tests on the call-path guard and feature
    assignment, a route test per surface family, and a Cypress smoke for
    each switch combination.
- **5.19 Custom AI actions in the selection menu.** Pre-beta (author
  decision, 2026-11-07; after 5.18), raised in 2026-11-07 dogfooding
  (custom tools are a main draw of competing writing apps). Today's prompt
  tools are standing instructions added to every assistant chat message;
  this adds one-shot *actions* the author runs on selected text from the
  right-click selection menu (moved to right-click in the same dogfooding
  session).
  - **Model.** A separate `selectionActions` list in the project AI
    settings: name, instructions, what it receives (the selection always;
    optionally the current scene and the World Bible records the selection
    names, through the 4.71 linked-record pull-in), an output kind
    (`replace`: a rewrite of the selection; `note`: a written reply with no
    edit), and an on/off switch. Prompt tools stay as they are and do not
    apply to actions. Tool pack export/import carries both lists, with a
    schema version bump that still reads version 1 packs.
  - **Presets, off by default.** Ship a few examples, all switched off
    until the author turns them on in Settings, for example **Tighten**,
    **Expand this beat**, **Add sensory detail**, **Vary sentence rhythm**
    (`replace`), and **Check against canon** (`note`: cites accepted facts
    the selection contradicts, changes nothing).
  - **Menu.** Switched-on actions appear in the selection menu after
    **Ask AI about this** (grouped under one entry if there are many). The
    character stat menu does not list them.
  - **Trust boundary.** Author-invoked only. A `replace` result opens the
    existing scene revision preview (`services/assistant/sceneRevision.ts`)
    and changes the scene only on **Confirm**, refusing if the scene changed
    since the request; a `note` result opens in the assistant reply reading
    view. Nothing writes canon or mechanics. Each run counts against the
    consultation budget as its own feature, and hosted runs show the same
    provider disclosure as other AI actions.
  - **Settings.** An **AI actions** section beside Prompt Tools where the
    author adds, edits, deletes, and switches actions on or off; presets are
    ordinary actions once installed, so they can be edited or deleted too.
    **Install presets** re-adds missing presets without touching edited
    ones.
  - **Explaining the two kinds to authors.** Settings shows one line under
    each section, and the **Setting up AI** help topic uses the examples
    below:
    - **Prompt Tools:** "Standing instructions for the AI chat, such as a
      voice or role. Tick them in the AI panel; they apply to every
      message."
    - **AI actions:** "One-click tasks for selected text. Right-click a
      selection to run one. Rewrites wait for your confirmation."
    - *Prompt tool example:* **Blunt Beta Reader**, "Respond as a beta
      reader who reads a lot of LitRPG. Be direct. Point out confusion and
      slow spots before praising anything." Ticked in the AI panel, it
      shapes every chat answer until unticked.
    - *`replace` action example:* **Tighten**, "Cut filler words and
      redundant phrases. Keep the meaning, voice and tense. Don't add
      anything new." Select, right-click, **Tighten**: a preview shows the
      tighter text, and the scene changes only on **Confirm**.
    - *`note` action example:* **Check against canon**, "List anything in
      this passage that contradicts accepted facts, citing each fact."
      Select, right-click, **Check against canon**: a short report, and the
      text is unchanged.
  - **AI switches.** `note` actions follow 5.18's coaching switch and
    `replace` actions its prose switch; an action whose switch is off is
    hidden from the menu and from Settings' on/off list.
  - **Verify.** Unit tests for prompt building and preset defaults;
    integration tests that only switched-on actions appear in the menu;
    Cypress: right-click → action → preview → Confirm writes, Dismiss leaves
    the text unchanged, a `note` action never edits. Update
    `PROJECT_STATUS.md`, `docs/status-writing-workspace.md`, the **Setting
    up AI** help topic, and add a smoke procedure.
  - **Out of scope.** Free-form template variables, actions outside the
    Workspace editor (Source Notes, World Bible fields), and sharing action
    packs beyond file export.

### Phase 6 — Beta, RC, Launch

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
