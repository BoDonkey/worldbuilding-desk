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

**A-3. Character sheet baseline.** After A-6 creates Sera's canon record,
open that World Bible character and choose **Add sheet**; do not create an
independent character first and do not enter Sera's name again.
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

Log results in a dated section appended to this file (or a copy in
`docs/archive/` when done — the archive holds run logs, this file keeps the
procedure). Per check: `ID — Pass/Fail/Partial — note`. Also log:

- **False positives** — anything flagged that isn't in the answer key.
- **Fixture bugs** — real inconsistencies I planted by accident. Fix the
  fixture, note it, and continue.
- **Trust failures** — anything from C4/C5/D2/D3 leaking into canon or
  assistant answers. These convert directly into slice 1.2 fix work and
  block Phase 6 (beta) until resolved.
- **Character identity failures** — any failed G1–G6 invariant, especially a
  pre-resolution Tam underline/grounding leak, rename-broken link, silent
  merge, duplicate sheet, missing round-trip link, or mode-gating leak. These
  also become slice 1.2 work and block beta.

Exit condition for slice 1.1: every A–F check has a recorded result, and
findings are triaged into road-to-market 1.2 slices (or a note that no
fixes are needed).

## Results log

_(append dated runs below)_

Identity addendum template (not yet run):

```text
G1 — Not run — general-fiction intake / one canon editing home
G2 — Not run — mode gating, Add sheet, rename stability
G3 — Not run — conserving legacy classification and resolution
G4 — Not run — dialogue-style attachment/removal isolation
G5 — Not run — rich v2 backup + v1 package round-trip
G6 — Not run — Tam containment + link/create branches
```
A-1: Pass
A-2: Partial. Import worked correctly, but the screen navigated away immediately, which feels like a UX issue.
A-3: Partial: Created the character sheet in the world bible, but "class" and "ledger-marked" are numerical and test called for strings. Overall, the character sheet in the tools and the world bible seem too separate.
A-4: Partial. The scene is uncluttered by review markup, but the review panel surfaces odd things like "back like something", "Warm", "Wrap", and "Draught".
A-5: Partial. With each import, "Greyharbor" is automatically highlighted and there is a toolbar to add it to the lore. Note that there is a regression. When switching away from the workspace to another tab and back, it always goes to the first chapter and doesn't keep the scroll position. Right now there is no highlighting at all, only review notifications in the side bar. Tam is not in the review context, yet a lot of common words are. The "Cinder Compact" was never selected for review.
A-6: Fail. Almost no facts are extracted for acceptance into cannon. One extracted fact for Sera was accepted, but does not show up in the cannon review route.

Random findings:
- If the window is too small, you can't get to the last items in the more menu, like settings.
- If you ask the AI a question, then navigate away from the workspace, the conversation disappears.
