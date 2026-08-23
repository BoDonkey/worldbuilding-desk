# Trust Dogfood Fixture — Runbook for Slice 1.1

Fixture set for `docs/road-to-market.md` slice **1.1 (Realistic-project trust
dogfood)**. A five-chapter LitRPG manuscript ("The Ember Ledger"), four lore
documents, an importable ruleset, and a scripted state timeline — with every
contradiction, alias chain, and continuity trap planted deliberately and
enumerated in `answer-key.md`.

Your job while running this is executing and recording, not judging from
scratch: work the sessions below in order, and for each check ID record
**Pass / Fail / Partial** plus a one-line note in the results log at the
bottom. Anything the app flags that is *not* in the answer key is a false
positive — record those too; precision failures are first-class findings.

Contents:

```
ruleset.emberledger.json      importable ruleset (Ruleset route → Import)
chapters/01…05 *.md           manuscript, import in order via Workspace → Import
lore/dossier-sera-kestrel.md      character dossier (canon-rich)
lore/faction-cinder-compact.md    faction notes (plants C2, C3)
lore/places-grayharbor-undervault.md  place notes (canon-rich)
lore/working-notes-book2.md       brainstorm (plants C4, C5, C2-conflict)
character-identity/legacy-tam-tools-only.v1.json
                                  importable v1 package for J6 containment
character-identity/legacy-identity-matrix.v1.json
                                  importable v1 package for J3 classification
answer-key.md                 every planted issue + expected behavior
```

Time estimate: 5–7 hours across three to five sittings, including the
character-identity addendum. A comfortable split is: Session A; Session B;
Session C plus Identity Passes 1–2; Identity Passes 3–5; final triage.

## Current multi-day handoff — started 2026-08-11

This is the active roadmap slice. The partial run at the bottom is historical
and predates the completed Phase 4 character work; start with fresh projects
and record the new run separately.

Before the first sitting:

1. Keep one stable build for the whole run. Record `git rev-parse --short HEAD`
   in the current-run template. Do not pull, switch commits, or patch the app
   or fixture between sessions unless a stop condition below is hit.
2. Prefer the desktop shell. For a development run, use `pnpm dev:web` in one
   terminal and `pnpm start:desktop:dev` in another. If you use the browser
   instead, record that once and stay on that surface for the core A–F run.
3. Create fresh projects with the names suggested below. Do not reuse the
   historical partial-run project or any project carrying prior ignore/review
   state.
4. Record the AI provider/model and whether local RAG/Shodh initialization
   completed. Assistant results without this metadata are difficult to
   compare later.

At the end of every sitting:

- Wait for saves to settle, export a project backup when the active project
  contains meaningful work, and record its filename.
- Fill the resume checkpoint: last completed step, active project(s), next
  exact step, blockers, and evidence pointers. A screenshot filename plus a
  one-line observation is enough; do not turn the run into a bug-writing
  exercise.
- Record failures and continue on the same build. Do not fix ordinary bugs or
  fixture wording mid-run. That keeps later observations comparable.

Stop the run and preserve the project/backup before changing anything if you
observe data loss or corruption, an unresolved record being silently promoted
to canon, rejected/pending material entering normal assistant grounding, or
the J6 Hollow Court note being asserted before author resolution. Everything
else should be logged and allowed to accumulate until final triage.

Suggested resume points:

| Sitting | Work | Safe stopping point |
|---|---|---|
| 1 | Session A | After A-7, with extraction decisions saved |
| 2 | Session B | After D1–D5 and source lists are recorded |
| 3 | Session C + Identity Passes 1–2 | After the rich-project backup and Sera rename checks |
| 4 | Identity Passes 3–5 | After both Tam branches and imported-backup comparison |
| 5 | Triage | Every A–G result classified; roadmap follow-ups written |

---

## Session A — Setup and intake

**A-1. Project setup.** Create a fresh project (suggest: "Ember Ledger
Dogfood"). Do not reuse a project with existing review/ignore state.

**A-2. Ruleset import.** Ruleset route → Import → `ruleset.emberledger.json`.
Confirm stats (Level, Might, Finesse, Resonance, Class, Ledger-Marked) and
resources (Health 100, Aether 50 max with regeneration, Stamina) appear.
If import rejects the file, that is a finding (the payload matches
`rulesetTransferService`'s schema v1).

**A-3. Character sheet baseline.** After A-6 creates Sera's canon record,
open that World Bible character, open **Mechanics**, and choose **Add mechanics
to this character**; do not create an independent character first and do not
enter Sera's name again. On Character Sheets, choose **Advanced sheet setup**.
Set: Level 3, Might 14, Finesse 16, Resonance 9, Class "Delver",
Ledger-Marked true, Health 100/100, Aether 30/50, Stamina 100/100. Expand
**Inventory, equipment & statuses**, add **Pale Draught** to inventory, and
save the sheet. The draught is required so ch 1's consume-item change can pass
deterministic validation.

**A-4. Chapter 1 import — pre-lore unknowns.** Workspace → Import →
`01-the-salt-door.md` (balanced mode). Let review settle.
Record: **A2** (Salt Door flagged as unknown place), hazard checks (no stray
highlights on "Don't rush…", "Some of them…", bracketed system lines).
Resolve nothing yet except: create **Sera Kestrel** (Characters), **Brannic
Halloway** (Characters), **Grayharbor** (Locations) from review; link "Bran"
as alias when offered.

**A-5. Remaining chapters.** Import `02`–`05` in order. After ch 2, record
**A1** (Corvo Lash surfaces as repeated unknown) and **A4** ("Ma" doesn't
fragment). Create Corvo Lash from review. After each import, spot-check the
review drawer's Current/Other document sections behave.

**A-6. Lore intake.** Lore Documents route → import all four `lore/*.md`
files as Source Notes. Link the dossier to Sera, faction notes to the Cinder
Compact record (create via extraction if not yet made), place notes to
Grayharbor/Undervault records as offered. Run **Extract facts** on each.

**A-7. Extraction review.** Accept the clean facts (occupation, brother Tam,
aliases Ash/Ledgerbound/Dess/the Vault, Vaultburn cure, founding history,
gray eyes — yes, accept gray eyes; C1 needs it accepted). Route the
conflicting/speculative ones per the answer key: C2 both values should reach
Canon Decisions; C4 and C5 must be left pending or rejected — do NOT accept.

## Session B — Canon decisions and assistant trust

**B-1. Canon Decisions.** Work the queue. Record: **C2** (service-length
conflict cluster forms; accept "twenty years"), **C3** (Compact of Cinders
resolves as alias, not a second faction). Record any expected cluster that
never formed.

**B-2. Alias verification pass.** Reopen each chapter; record **B1–B5**
(all alias forms highlight as known; possessives resolve; "deep vault" in
ch 3/5 does NOT link to the Undervault). Record **A2**'s second half (Salt
Door now known, no re-flag).

**B-3. Contradiction check.** With gray-eyes accepted, rerun review on ch 2.
Record **C1** (green-eyes conflict surfaces somewhere actionable).

**B-4. Assistant session.** Ask the five questions **D1–D5** exactly as
written in the answer key. For each: record the answer's correctness, whether
the rejected/pending material leaked (D2/D3 are the critical ones), and what
the `Sources used` list shows (trust labels present? canon above Source
Notes?).

## Session C — State, health, and teardown

**C-1. State events.** Start from World Bible → Characters → Sera Kestrel →
**Mechanics** → **Record a scene change**. Character Sheets opens with Sera
selected on the simple **Character continuity** form. Choose **Inventory,
equipment, status, or location** to open **Record scene changes**; Sera remains
selected.

Enter the answer-key script (§ E) one row at a time, in the listed order:

1. Select Sera and the chapter in **Scene**.
2. Select the author-facing action in **What changed?** and enter its value.
3. Read **Preview** and **Replayed state at end of selected scene**. If
   **Change needs attention** appears, correct the input rather than recording
   it.
4. Choose **Record State Change**. Confirm it appears under **Recorded scene
   changes** before entering the next row.

Each accepted row must remain an explicit, previewed change attached to one
scene. If deterministic review proposed a matching state suggestion during
Session A, accept it only when its action, value, character, and scene match
the script exactly; reject non-matching suggestions and note what they got
wrong.

**C-2. Replay checks.** Stay in **Record scene changes**. Select Sera and ch 2,
then ch 3, and record **E1** and **E2** from **Replayed state at end of selected
scene**. For **E5**, open Workspace → ch 4 → **Scene** → **Ending**, then hover
Sera's lore highlight and compare the card with the ch 4 replay. It must show
the state at ch 4, not the baseline or final state.

**C-3. The Key contradiction.** Open Workspace → ch 5 → **Scene** →
**Ending**. Compare Sera's hover card and the detailed Character Sheets replay
at ch 5 with the prose claiming she produces the Emberglass Key. Record
**E3**: which surface (if any) made the possession contradiction catchable.
Be honest — "nothing caught it, I only knew from the answer key" is the most
valuable possible result.

**C-4. Stale events.** Edit one sentence in ch 2 and save it. Return to
Character Sheets → **Record scene changes**, select Sera and ch 2, and record
**E4**: the ch 2 rows show stale status, invalidation works, replay excludes
invalidated rows, and the replacement change must be previewed and explicitly
recorded again.

**C-5. Health panels.** Record **F1–F3** (retrieval probe ranking, stale →
rebuild recovery, Sera's character detail panel completeness).

**C-6. Backup round-trip (required for G5).** Export project backup, validate, import
as new project. Confirm canon, aliases, accepted facts, lore links, and
state events survive (this doubles as the `docs/smoke-tests.md` § 1
procedure on rich data).

---

## Character identity addendum — J1–J6

Run these checks as isolated passes so their deliberately unresolved legacy
records do not contaminate the main A–F trust run. Record **G1–G6** in the
same results log. The two JSON files are real Character Tools import payloads;
their contract is also guarded by
`characterIdentityDogfoodFixtures.test.ts`.

### Identity Pass 1 — general-fiction intake and mode gating (J1)

1. Create a fresh **General Fiction** project named `Ember Identity — General`.
2. In a scene, write `Ilyra Fen checked the shutter twice.` Run review and
   accept Ilyra into a character-kind World Bible category.
3. Record **G1**: exactly one World Bible character exists; intake showed no
   sheet, stat, resource, or Character Tools form; the known-lore highlight
   opens Ilyra's World Bible record; name and description are editable only
   there.
4. Record the mode half of **G2**: direct navigation to `/characters` returns
   to World Bible, and Ilyra's character detail does not offer **Add sheet**.
   **Dialogue style** and **Export character** may remain available as explicit
   writing-aid actions from character detail.

### Identity Pass 2 — LitRPG capabilities and rename stability (J2, J4)

Use the main LitRPG dogfood project after A-6 and A-3.

1. Record the LitRPG half of **G2**: **Add sheet** starts from Sera's World
   Bible detail, requires no name entry, creates exactly one sheet linked by
   Sera's entity ID, and displays the canonical name.
2. Define a temporary dialogue style in Settings. From Sera's World Bible
   detail choose **Dialogue style**, assign it, then remove it.
3. Record **G4**: no second identity or descriptive editor appeared; entity,
   alias, fact, and lore-link counts did not change. Removing the style did
   not remove canon. Delete and recreate the sheet only if needed to verify
   that sheet deletion also leaves canon untouched.
4. After at least one accepted state event exists, rename `Sera Kestrel` to
   `Sera Kestrel-Vale`. Record **G2** again: the sheet, state timeline, hover
   card, and Character Tools capability row all show the new name without
   relinking; `Sera Kestrel` remains an alias and manuscript mentions still
   resolve. Rename back only if desired for the remaining A–F questions.

### Identity Pass 3 — conserving legacy classification (J3)

1. Create a fresh LitRPG project named `Ember Identity — Migration` and make
   one World Bible character named `Maren Kestrel`.
2. Character Tools → **Import Characters + Sheets** →
   `character-identity/legacy-identity-matrix.v1.json`.
3. Record **G3**: the migration report reconciles five source records — the
   existing World Bible Maren plus both imported `Maren Kestrel` tools records
   are ambiguous collisions, `Pell` is tools-only, and `Orin` is sheet-only.
   All four unresolved legacy records appear under **Needs canon link** with
   link / create canon / keep separate actions; the canonical Maren report
   record is not itself queued. Nothing was merged or deleted automatically;
   Orin's sheet remains mechanically visible with **Not linked to canon**.
4. Resolve one Maren by linking, keep the other separate, keep Pell separate,
   and explicitly create canon for Orin. Confirm every source record remains
   accounted for and actor mappings exist for linked records. The automatic
   pre-migration-backup invariant is automation-backed by
   `projectSchemaMigrations.test.ts`; record any failure there alongside G3.

### Identity Pass 4 — Tam containment, both resolutions (J6)

Run this pass twice in fresh projects: once for **link existing**, once for
**create canon**.

1. Before creating any Tam canon, Character Tools → **Import Character
   Package** → `character-identity/legacy-tam-tools-only.v1.json`.
2. Add `Tam trimmed the lamp wick.` to a scene and run review. Ask the
   assistant `Is Tam working for the Hollow Court?` before resolving identity.
3. Record **G6** containment: Tam is not a known-lore underline and does not
   enter assistant grounding; the answer does not assert the package's
   deliberately unconfirmed Hollow Court note; Tam appears under **Needs
   canon link** as Character Tools only.
4. Link-existing branch: create `Tam Kestrel` in World Bible, then explicitly
   link the queued Tam record to it. Create-canon branch: use the queue's
   **Create canon record** action.
5. Record **G6** resolution: the queue item clears, all character-aware
   surfaces resolve one entity ID, the legacy record is attached rather than
   duplicated as canon, and Tam becomes known lore only after the author
   action.

### Identity Pass 5 — rich backup round-trip (J5)

Treat C-6 as required for the identity addendum rather than bonus.

1. Before export, ensure the main project contains Sera's canonical rename
   alias, accepted facts, linked dossier, dialogue-style extension, one sheet,
   and accepted state events.
2. Export snapshot v2, validate it, import it as a new project, and record
   **G5**: counts match; every extension/sheet/alias/fact/lore-link points to
   the corresponding imported entity; accepted ledger events are unchanged;
   replay at each chapter matches byte-for-byte.
3. The v1-package half of G5 is covered by Passes 3–4: both legacy fixtures
   import without loss and route unresolved content to review. Record any
   silent merge, missing record, or changed replay as a release-blocking trust
   failure.

---

## Recording results

During the run, log results in the dated current-run section below. When the
run and triage are complete, move that dated log to `docs/archive/` and leave
only a link plus the next blank template here. Per check:
`ID — Pass/Fail/Partial — note — evidence`. Also log:

Use the answer key's unhyphenated IDs (`A1`, `C4`, `G6`) for verdicts. If a
setup step such as A-2 fails before its related check can run, add a finding
with that hyphenated step label and mark the dependent verdicts blocked.

- **False positives** — anything flagged that isn't in the answer key.
- **Fixture bugs** — real inconsistencies I planted by accident. Fix the
  fixture, note it, and continue.
- **Trust failures** — anything from C4/C5/D2/D3 leaking into canon or
  assistant answers. These become new bounded trust-fix slices and block
  release engineering when they violate a stop condition above.
- **Character identity failures** — any failed G1–G6 invariant, especially a
  pre-resolution Tam underline/grounding leak, rename-broken link, silent
  merge, duplicate sheet, missing round-trip link, or mode-gating leak. These
  also become new bounded trust-fix slices and block beta.

At final triage, classify each finding as one of:

- **Release blocker** — data loss/corruption, trust-boundary violation,
  silent canon promotion/merge, broken backup recovery, or unusable core flow.
- **Workflow blocker** — the scripted journey cannot be completed, but saved
  data remains intact and the trust boundary holds.
- **UX friction** — confusing, noisy, or slow behavior with a viable path.
- **False positive** — review/retrieval output not planted in the answer key.
- **Fixture bug** — the fixture or instructions, rather than the app, are
  inconsistent.

Exit condition for slice 1.1: every A–G check has a recorded result; every
finding is classified; release blockers have bounded follow-up slices (or a
note that none were found); and the roadmap records whether 5.1 may begin.
Do not mark 1.1 done merely because the planned sittings ended.

## Results log

### Current run — resumed 2026-08-22, stopped 2026-08-23

```text
Build commit: Not recorded (repo tip after the run: f6d3105)
Surface (desktop/browser):
OS:
AI provider/model:
RAG/Shodh ready:
Core project:
Identity projects:

Setup A-1–A-4 — Pass — author completed project/ruleset/sheet/chapter-1 setup

A1 — Not run —
A2 — Not run —
A3 — Not run —
A4 — Not run —
B1 — Not run —
B2 — Not run —
B3 — Not run —
B4 — Not run —
B5 — Not run —
C1 — Not run —
C2 — Not run —
C3 — Not run —
C4 — Not run —
C5 — Not run —
D1 — Fail — cartographer fact was attached to Cinder Compact, so the assistant could not verify Sera's prior occupation
D2 — Fail (safe refusal) — Brannic service facts had different/wrong targets, so no conflict resolved and the assistant could not verify twenty years
D3 — Pass — assistant said Tam's Hollow Court membership was not established in canon
D4 — Fail — with chapters 1–5 saved, assistant confidently reported Odessa's vault without surfacing later Brannic/Sera custody evidence
D5 — Pass — assistant correctly reported the Vaultburn treatment
E1 — Not run —
E2 — Not run —
E3 — Not run —
E4 — Not run —
E5 — Not run —
F1 — Not run —
F2 — Not run —
F3 — Not run —
G1 — Not run —
G2 — Not run —
G3 — Not run —
G4 — Not run —
G5 — Not run —
G6 — Not run —

Resume checkpoint
Date/time: 2026-08-23
Completed through: Lore intake and partial Canon/Assistant review; Session D stopped early
Active project(s): Not recorded
Last backup: Not recorded — preserve/export the stopped project if still available
Blockers: None from the stopped build remain unresolved; do not resume its contaminated partial A–F project as evidence
Next exact step: Start a fresh A–F run on implementation `d9cb7e3` or a later stable build, beginning at A-1 and using the corrected A-3/C-1 state journey
Evidence pointers: fixtures/trust-dogfood/Dogfood notes.md

Findings awaiting triage
- [classification pending] ID/surface — observation — evidence
- [resolved release blocker; 1.2a `ce427b9`] A-6/A-7/D1 — Sera occupation, Brannic service, and Dess alias facts bound to the wrong record; inferred targets could not be edited — author dogfood 2026-08-22–23
- [resolved release blocker; 1.2a `ce427b9`] Accepted-fact removal — deleting the canonical fact left fact-owned text materialized in a World Bible Notes field, where it may remain hidden and grounded as canon — author dogfood 2026-08-23
- [resolved release blocker; 1.2b `a92baa2`] D4/storage custody — all five chapters were saved, but the assistant confidently answered Odessa's vault without surfacing later Brannic-pocket and Sera-possession/use evidence — author dogfood 2026-08-23
- [resolved workflow blocker; 1.2c `8d299e3`] Workspace continuity — selected scenes and per-scene scroll now survive route changes, and current-scene Find is available — author dogfood 2026-08-22
- [resolved workflow blocker; 1.2d `f86bd83`] A-6/A-7 lore intake — article variants now share identity, category creation keeps review open, and Source Note actions/context-link language expose the safe saved-note path — author dogfood 2026-08-22–23
- [resolved workflow blocker; 1.2e `d9cb7e3`] Session E — Character continuity now hands directly to the author-facing detailed scene-change form, and the corrected runbook maps every scripted event to explicit previewed, scene-scoped, replay-backed entry — author dogfood 2026-08-23
- [UX friction; separate product decision] World Bible relationships — descriptive custom fields cannot provide stable-ID, reciprocal, rename-safe canon relationships — author dogfood 2026-08-22
- [UX friction; route to 5.5/5.8] AI consultation budget — shared daily limit, consumers, and reset timing are not explained at the point of use — author dogfood 2026-08-23
- [UX friction; promoted to 4.12–4.13] Cross-cutting/character experience — World Bible and Character Tools still read as split character-entry destinations despite canonical identity convergence — author dogfood 2026-08-15
- [UX friction; promoted to 5.4] Cross-cutting/onboarding — first-use guidance does not yet make the writing-first path or optional nature of advanced systems sufficiently clear — author dogfood 2026-08-15
- [UX friction; promoted to 4.14–4.15] Cross-cutting/optional mechanics — the mechanics system appears powerful but presents too much terminology, setup, and advanced capability before a clear first useful path — author dogfood 2026-08-15
```

### Prior partial run — historical, do not resume

This run predates completion of the current character-identity and trust-path
work. It is retained as evidence of earlier behavior, not as the verdict for
the active slice.

A-1: Pass
A-2: Partial. Import worked correctly, but the screen navigated away immediately, which feels like a UX issue.
A-3: Partial: Created the character sheet in the world bible, but "class" and "ledger-marked" are numerical and test called for strings. Overall, the character sheet in the tools and the world bible seem too separate.
A-4: Partial. The scene is uncluttered by review markup, but the review panel surfaces odd things like "back like something", "Warm", "Wrap", and "Draught".
A-5: Partial. With each import, "Greyharbor" is automatically highlighted and there is a toolbar to add it to the lore. Note that there is a regression. When switching away from the workspace to another tab and back, it always goes to the first chapter and doesn't keep the scroll position. Right now there is no highlighting at all, only review notifications in the side bar. Tam is not in the review context, yet a lot of common words are. The "Cinder Compact" was never selected for review.
A-6: Fail. Almost no facts are extracted for acceptance into cannon. One extracted fact for Sera was accepted, but does not show up in the cannon review route.

Random findings:
- If the window is too small, you can't get to the last items in the more menu, like settings.
- If you ask the AI a question, then navigate away from the workspace, the conversation disappears.
