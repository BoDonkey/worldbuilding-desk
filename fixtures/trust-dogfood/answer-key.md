# Answer Key — Trust Dogfood Fixture

Every planted issue in the fixture, with expected behavior. IDs are referenced
by the runbook (`README.md`). Anything not listed here is intended to be
internally consistent; if the app flags a contradiction not in this key,
record it — it is either a fixture bug or an app false positive, and both are
findings.

## Canon reference (what should exist after full intake)

Characters: Sera Kestrel (aliases: Ash, the Ledgerbound), Brannic Halloway
(aliases: Bran, Warden Halloway), Odessa Vane-Kir (alias: Dess), Tam, Corvo
Lash, Maren Kestrel (minor). Factions: the Cinder Compact (alias: the
Compact; historical name Compact of Cinders), the Hollow Court (alias: the
Court), Terrace Council, Surveyors' Guild. Locations: Grayharbor, the
Undervault (alias: the Vault), the Salt Door, Grand Weighing House (alias:
Weighing House), Netmaker's Row, Cooper's Walk. Items: Emberglass Key,
Wardlight Lantern, Pale Draught, Sorrowsteel knife. Concepts: the Ledger,
Ledger-marks, Vaultburn, husks, aether.

## A — Unknown-entity detection (workspace review after chapter import)

| ID | Plant | Expected |
|---|---|---|
| A1 | **Corvo Lash** — never in lore docs; appears ch 2 (3 mentions), ch 3, ch 4, ch 5 | Surfaces as reviewable unknown character after ch 2 import. Repeated-mention signal should make this a confident candidate. |
| A2 | **the Salt Door** — in place-notes lore, but if chapters are imported *before* lore acceptance, it is unknown | Ch 1 import (lore not yet accepted): reviewable unknown place. After place-notes facts are accepted: resolves as known lore, no re-flag. |
| A3 | **Pellin's Rest** — single weak mention, only in the brainstorm notes' name list, never in a chapter | Should NOT surface from chapter review (it never appears in chapters). Informational check only. |
| A4 | **Maren Kestrel**, **the Gannet** — ch 2 mentions "Ma"; dossier names her | "Ma"/"your mother" must not fragment into review noise; Maren Kestrel from the dossier is an extraction candidate, not a workspace unknown. |

Natural-prose hazards planted (must NOT produce stray review highlights):
sentence-start "Don't rush…", "Some of them…", "Look at any delver's…",
"Reach for it…"; possessives "Ash's" (runbook step), "Vane-Kir's"; titled
"Warden Halloway"; hyphenated "Vane-Kir"; system lines in brackets
(`[Health: 62/100.]` etc.) should not become entity candidates.

## B — Alias chains (after canon creation/linking)

| ID | Chain | Expected after linking |
|---|---|---|
| B1 | Sera Kestrel ← Sera, Ash, the Ledgerbound | All forms + possessives ("Ash's") highlight as known canon; none reappear as unknowns. |
| B2 | Odessa Vane-Kir ← Dess, Vane-Kir | Hyphenated surname alone resolves; "Vane-Kir family" in lore doesn't create a duplicate entity. |
| B3 | Brannic Halloway ← Bran, Warden Halloway | Titled mention resolves without splitting "Warden" off as a candidate. |
| B4 | the Undervault ← the Vault | Short form resolves; bare "Vault" inside "Weighing House deep vault" (ch 3/5) must NOT link to the Undervault — different referent. This is the hardest alias plant; record actual behavior. |
| B5 | Cinder Compact ← the Compact | Short form resolves in all chapters. |

## C — Lore contradictions and canon decisions

| ID | Plant | Where | Expected |
|---|---|---|---|
| C1 | **Eye color**: dossier says "her eyes are gray, like her father's"; ch 2 Tam says "Her same green" | dossier vs ch 2 | If the gray-eyes fact is accepted as canon, contradiction review comparing ch 2 should flag the conflict (or at minimum, the character health panel shows the accepted gray fact so the author can see the clash). Author resolution is free choice; the app must not silently prefer either. |
| C2 | **Brannic's service length**: faction notes say "served the Compact for twenty years"; brainstorm notes say "a decade" | faction-notes vs working-notes | If both docs are extracted, a fact-conflict cluster should form in Canon Decisions (same target, same fact type, different values). Accepting "twenty years" must mark the other proposal rejected/superseded, and the rejected value must never surface in assistant answers (see D3). Note: ch 1 prose ("a decade after the Vault took his knee") is consistent with twenty years' service — it should NOT be flagged once twenty years is canon. |
| C3 | **Faction naming**: "the Compact of Cinders" (founding name, faction notes) vs "Cinder Compact" | within faction-notes | Entity-identity/alias cluster: extraction should not create two separate factions. Correct resolution: alias (historical name) on the Cinder Compact record. |
| C4 | **Tam / Hollow Court speculation** — explicitly marked "DO NOT seed this until decided" | working-notes | Must remain a pending/rejected proposal or unextracted note. It must NEVER appear as canon, in the character health panel as an accepted fact, or in assistant answers as fact (see D3). This is the single most important trust check in the fixture. |
| C5 | **Smuggler backstory** — "probably abandoned" earlier draft, contradicts dossier cartographer history | working-notes vs dossier | Same class as C4: source-note claim that must not outrank or contaminate the accepted cartographer fact. |

## D — Assistant trust-tier checks (after canon acceptance)

| ID | Ask the assistant | Expected |
|---|---|---|
| D1 | "What did Sera do before she became a delver?" | Cartographer (accepted canon from dossier). The smuggler claim (C5) must not be asserted; acceptable for the assistant to note unconfirmed source material exists, unacceptable to state it as fact. Sources-used list shows accepted canon/World Bible labels ranked above general Source Notes. |
| D2 | "How long has Brannic served the Compact?" | Twenty years (the accepted value from C2 resolution). "A decade" must not appear as the answer. |
| D3 | "Is Tam working for the Hollow Court?" | The assistant must not present C4 as fact. Correct behavior: no canon on this / not established. It must not leak the rejected/pending proposal in normal context. |
| D4 | "Where is the Emberglass Key kept?" | Answer should reflect accepted canon and cite trust-labeled sources. (Note the manuscript itself becomes contradictory by ch 5 — see E3; before ch 5, the correct canon answer is Odessa's deep vault per ch 3.) |
| D5 | "What cures Vaultburn?" | Salt, cedar oil, whitethorn ash (place-notes + ch 3, consistent). Simple positive control — should be easy and well-cited. |

## E — State ledger and replay (using the fixture ruleset + event script)

Baseline sheet for Sera (set before entering events): Level 3, Might 14,
Finesse 16, Resonance 9, Class "Delver", Ledger-Marked true, Health 100/100,
Aether 30/50, Stamina 100/100.

Event script (enter manually per scene; deterministic review may propose
some — accept only matching ones):

| Scene | Events (in order) |
|---|---|
| Ch 1 | inventory_consume "Pale Draught"; resource_set health 62; inventory_add "Emberglass Key" |
| Ch 2 | resource_set aether 18; stat_set level 4; status_apply "Vaultburn" |
| Ch 3 | status_remove "Vaultburn"; resource_set health 100; inventory_remove "Emberglass Key" |
| Ch 4 | inventory_add "Sorrowsteel knife"; inventory_equip "Sorrowsteel knife"; location_set "the Undervault"; resource_set health 71 |
| Ch 5 | resource_set aether 6 |

| ID | Check | Expected |
|---|---|---|
| E1 | Replay at end of ch 2 | Health 62, Aether 18, Level 4, Vaultburn active, Emberglass Key in inventory. |
| E2 | Replay at end of ch 3 | Health 100, no Vaultburn, **no Emberglass Key**. |
| E3 | **Planted continuity error**: ch 5 prose has Sera produce and use the Emberglass Key ("carried since the antechamber"), contradicting ch 3 (given to Odessa) and ch 4 (signed out by Brannic, returned to his pocket) | Replay at ch 5 correctly shows the Key absent from Sera's inventory. The test: does any surface (state timeline, hover card, deterministic review, or the author's own read of the replay panel) make this catchable? Record honestly which surface caught it, or that none did — this is the marquee finding either way. |
| E4 | Stale-event detection: after accepting ch 2 events, edit ch 2 text (change one sentence) | Stale badge appears for ch 2 events; invalidation flow works; replay ignores invalidated events until re-accepted. |
| E5 | Hover card during drafting in ch 4 | Shows replayed state as of ch 4 (health 71, knife equipped), not baseline and not final state. |

## F — Retrieval and health panels

| ID | Check | Expected |
|---|---|---|
| F1 | Lore Documents health panel probe: "Emberglass Key" | Hits include canon_fact/World Bible chunks ranked at/above raw lore chunks; hits open their sources. |
| F2 | Edit a lore doc, then check the health panel | Stale/`May need rebuild` state appears when source counts exceed indexed counts; rebuild action recovers, and counts reconcile. |
| F3 | Character detail health panel for Sera | Shows aliases (B1), accepted facts (occupation, eyes per C1 resolution, brother Tam), linked dossier, scene mentions across all 5 chapters, state events from E script, RAG probe hits. |

## Fixture consistency notes (not plants)

Deliberately consistent details that must NOT be flagged: Brannic's knee
("the Vault took his knee" ch 1 = "Narrows collapse" faction notes — the
Narrows Vault is the older vault); twenty years' service with "the last
eight on light duty" (faction notes) and ch 1's vague "in the years since"
are compatible; Odessa's grandmother predating the Compact
(place-notes + ch 3 agree); Tam as lamplighter (dossier + ch 2/3/5 agree);
the Gannet (dossier + brainstorm agree). Cooper's Walk appears only in ch 5
and the brainstorm's "already used" note — a legitimate new place candidate,
not a contradiction.
