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
answer-key.md                 every planted issue + expected behavior
```

Time estimate: 3–4 hours across two or three sittings. Suggested split:
Session A (setup + intake), Session B (canon + assistant), Session C (state
+ health + teardown checks).

---

## Session A — Setup and intake

**A-1. Project setup.** Create a fresh project (suggest: "Ember Ledger
Dogfood"). Do not reuse a project with existing review/ignore state.

**A-2. Ruleset import.** Ruleset route → Import → `ruleset.emberledger.json`.
Confirm stats (Level, Might, Finesse, Resonance, Class, Ledger-Marked) and
resources (Health 100, Aether 50 max with regeneration, Stamina) appear.
If import rejects the file, that is a finding (the payload matches
`rulesetTransferService`'s schema v1).

**A-3. Character sheet baseline.** Create character sheet for Sera (after
A-6 creates her canon record, or now via Character Tools if the flow allows).
Set: Level 3, Might 14, Finesse 16, Resonance 9, Class "Delver",
Ledger-Marked true, Health 100/100, Aether 30/50, Stamina 100/100.

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

**C-1. State events.** Enter the event script from the answer key (§ E)
scene by scene via Character Sheets manual mutation entry. If deterministic
review proposed matching state suggestions during Session A, accept those
instead where they match the script exactly; reject non-matching ones and
note what they got wrong.

**C-2. Replay checks.** Record **E1, E2, E5** (replay values at ch 2 / ch 3
/ hover card in ch 4).

**C-3. The Key contradiction.** Read ch 5 with the state timeline open.
Record **E3**: which surface (if any) made the Emberglass Key possession
contradiction catchable. Be honest — "nothing caught it, I only knew from
the answer key" is the most valuable possible result.

**C-4. Stale events.** Edit one sentence in ch 2, record **E4** (stale
badges, invalidation, replay behavior).

**C-5. Health panels.** Record **F1–F3** (retrieval probe ranking, stale →
rebuild recovery, Sera's character detail panel completeness).

**C-6. Backup round-trip (bonus).** Export project backup, validate, import
as new project. Confirm canon, aliases, accepted facts, lore links, and
state events survive (this doubles as the `docs/smoke-tests.md` § 1
procedure on rich data).

---

## Recording results

Log results in a dated section appended to this file (or a copy in
`docs/archive/` when done — the archive holds run logs, this file keeps the
procedure). Per check: `ID — Pass/Fail/Partial — note`. Also log:

- **False positives** — anything flagged that isn't in the answer key.
- **Fixture bugs** — real inconsistencies I planted by accident. Fix the
  fixture, note it, and continue.
- **Trust failures** — anything from C4/C5/D2/D3 leaking into canon or
  assistant answers. These convert directly into slice 1.2 fix work and
  block Phase 6 (beta) until resolved.

Exit condition for slice 1.1: every A–F check has a recorded result, and
findings are triaged into road-to-market 1.2 slices (or a note that no
fixes are needed).

## Results log

_(append dated runs below)_
