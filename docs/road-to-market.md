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
project vaults.

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
  (5.1, 5.2, 5.3, 5.8 so far). The A–F trust run resumes on one fresh stable
  build before 6.1; release-blocking trust or data-loss findings come first.

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
   paid launch (6.4); 5.9 before 6.4; Phase 6 strictly ordered. Finished
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
| 4.27 | Sheet-free descriptive state for general fiction | 4 | L | — post-beta candidate because it expands state ownership and persistence beyond sheets/rulesets; descriptive location/custody for canonical characters, not required by mechanics-only 4.26 |
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

### Phase 4 — Post-beta candidate

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
