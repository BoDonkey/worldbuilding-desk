# Manual Smoke Procedures

Last updated: 2026-08-09

Reusable manual smoke procedures targeting trust and data-loss boundaries.
Consolidates the former `project-backup-smoke-test.md`,
`review-completion-smoke-test.md`, and
`character-canon-unification-smoke-test.md` (full step-by-step originals in
`docs/archive/`; historical run logs are archived separately). Run the full
relevant procedure after changes to the covered workflow; for ordinary
implementation changes prefer the focused automated coverage and manually
test only the affected path.

Common preconditions: `pnpm --filter web lint` and `pnpm --filter web build`
pass. Expected standing warnings: Vite `onnxruntime-web` eval and large-chunk
warnings.

## 1. Project Backup Round-Trip

Goal: export produces a valid `.zip`, validation passes, import works in both
`new` and `merge` modes, count checks match, and Scratchpad + Corkboard
planning data survive the round-trip.

Procedure:

1. Seed a project with mixed data (scenes, World Bible entries, characters
   and sheets, compendium/settlement data), a non-trivial Scratchpad note, and
   two Corkboard cards with plot points.
2. `Projects` → `Export Backup (.zip)` → confirm
   `<project>-backup-YYYY-MM-DD.zip` downloads → `Validate Backup (.zip)`
   passes integrity and supported-version checks. A fixture whose
   `schemaVersion` is newer than the app supports must fail before preview or
   import with an instruction to update the app.
3. Import as `Create New Project`: new project created and selected, feedback
   includes `Count check passed.`
4. Import again as `Merge Into Existing Project`: review conflict summary,
   apply, confirm merge feedback and count check (or explicit mismatch
   details).
5. Spot-check after import: World Bible categories/entries, scenes open,
   Scratchpad content and formatting present, Corkboard card count/order and
   per-card title/summary/status/plot-points intact, characters and sheets
   editable, compendium data persists, autosave still works after a small
   post-import edit.

Failure signals: validation failure, unexpectedly empty sections, count
mismatch on an unchanged new-project import, runtime errors, truncated
Scratchpad, Corkboard cards missing plot points or order.

## 2. Review Completion (Import → Workspace Review → World Bible Queue)

Goal: verify the writing-first review flow from imported manuscript text
through World Bible completion — import, deferred review hydration,
unknown-entity resolution, alias linking, queue behavior, completion counts,
and reload safety.

Fixture texts and expected matching behavior (Kaelor/Glass Harbor/Ember
Archive; Kael/Kaelor alias chain; Mira Voss/Lantern-Mira/Iron Warrens
full-name/hyphenated-alias cases) are preserved in
`docs/archive/review-completion-smoke-test.md`; `smoke-review-sample.md` at
the repo root holds a ready-made regression fixture.

Procedure:

1. **Import** a short `.txt`/`.md` with repeated unknown proper nouns into
   Workspace (`balanced` mode). Scene is created, titled from the file name,
   readable, and stays saved even with unresolved unknowns.
2. **Deferred review**: header badge reflects unresolved count; passive idle
   review does not open the large review panel; clicking an underline opens a
   popover offering create / ignore / `Always ignore` / link-to-existing, with
   options labeled by category (`Character`, `Location`, `Item`) and linked
   Character Tools + World Bible pairs shown once.
3. **Alias linking** stays in the workspace: alias connects to the canonical
   record, no auto-navigation to World Bible, no forced review-queue mode;
   after refresh the alias (including possessives) resolves as known lore.
4. **Create a record** from review: record is created, marked for later
   completion; resolver notice can deep-link into World Bible but doesn't
   force it.
5. **Finish in World Bible Review Queue**: queue item opens into the editor,
   `Needs completion` clears on save, alias follow-up clears intentionally
   (`Mark reviewed` or save in queue mode), record leaves the queue, nav badge
   decreases, and the large queue panel appears only in Review Queue mode.
6. **Reload safety**: completed records don't reappear as `Needs completion`;
   alias and project-scoped `Always ignore` state persist across reload.
7. **Workspace return**: open a later scene → visit World Bible → return;
   the same scene stays selected.

Failure signals: duplicate/conflicting signals between surfaces, queue items
clearing in one surface but not another, badge/queue count mismatch, alias
linking forcing navigation, generic `World` labels, duplicate rows for linked
Character Tools/World Bible pairs, reload resurrecting completed or ignored
work.

## 3. Character Canon Unification

Goal: verify character canon lives in `World Bible > Characters` while
Character Tools, sheets, and state stay secondary.

Procedure:

1. **Intake**: mention a new short name (e.g. `Garcia`) in a scene, run
   review, choose the `Characters` category — create action reads
   `Add to World Bible Characters`; prompt clears without forced navigation.
2. **Canonical rename**: in World Bible, rename `Garcia` →
   `Garcia de Terra`; `Garcia` is preserved as an alias; after marking
   reviewed and returning, `Garcia` highlights as known canon and the scene
   selection is preserved.
3. **Alias linking**: existing-record selector uses category labels, shows
   one option for linked Character Tools/World Bible pairs, links in place
   without navigation.
4. **Tools handoff**: World Bible character form directs name/alias/lore
   editing to World Bible; `Open optional tools` appears only with rule
   authoring enabled; `Create/open sheet + state` opens/creates the sheet;
   `/characters` presents itself as `Character Tools` routing canon work back
   to World Bible.
5. **Regression checks**: short-name/full-name pairs produce overlap
   suggestions with simple resolution (alias / keep separate / open
   existing); unlinked Character Tools profiles don't suppress unknown-name
   review; natural prose around known canon (`It's Garcia deTerra`,
   `Detective Garcia deTerra`, sentence-start words) does not fragment into
   stray review highlights — treat new false positives as annotation-policy
   work, not regex patching.

Focused automated coverage: `lore-review-matching.cy.ts`,
`project-mode-guardrails.cy.ts`, plus unit suites for `reviewQueue`,
`textMatcher`, and `worldBibleCanonicalization`.

### Character identity journey suite (J1–J6)

Run these acceptance journeys after the corresponding Character identity
slices land. Until then, failures describe open roadmap work rather than
current regressions.

1. **J1 — General fiction, new character.** In a general-fiction project,
   type a new character name in a scene, capture it from review, and accept it
   into a character-kind World Bible category. Confirm one World Bible
   character exists; no sheet, profile, stat, or resource surface interrupts
   intake; the known-lore underline opens that record in one interaction; and
   its description is editable in exactly one place.
2. **J2 — LitRPG, add mechanics.** In a rules-enabled project, choose `Add
   sheet` from World Bible character detail. Confirm no name entry is required,
   exactly one sheet is linked by the character entity ID, its displayed name
   comes from canon, scene mutations replay in continuity surfaces, and a
   canonical rename updates every surface without re-linking.
3. **J3 — Legacy project migration.** Open a pre-character-link fixture.
   Confirm an automatic backup precedes migration; the report classifies every
   tools, sheet, and World Bible record exactly once; totals reconcile with the
   stores; tools-only, sheet-only, and ambiguous records enter the World Bible
   resolution queue; available actions are link, create canon, and keep
   separate; unresolved records are never presented as canon; and no source
   records disappear.
4. **J4 — Dialogue style capability.** From World Bible character detail,
   assign and then remove a dialogue style. Confirm the operation creates no
   second identity, exposes no independent descriptive editor, and neither
   removing the style nor deleting an attached sheet alters the World Bible
   record, facts, aliases, or lore links.
5. **J5 — Backup round-trip.** Export a snapshot v2 project containing a
   renamed character, aliases, facts, an extension, a sheet, and accepted state
   events; wipe local project data; import it; and compare counts, explicit
   links, and replay at each scene. Then import snapshot v1 and character
   package v1 fixtures and confirm legacy content is preserved and classified,
   with unresolved identities routed to review rather than silently merged.
6. **J6 — Trust fixture (`Tam`).** Seed a tools-only `Tam` record with no World
   Bible identity. Confirm `Tam` is not underlined as known lore and is absent
   from assistant grounding, but appears in the identity resolution queue.
   Resolve it once by linking to existing canon and once, in a fresh fixture,
   by explicitly creating canon; after either author action, confirm all
   surfaces resolve the same entity ID and no duplicate identity remains.

Journey failure signals: any name-based link that changes after rename;
automatic canon creation; an ambiguous silent merge; more than one sheet for
one project/entity; accepted ledger events rewritten during migration;
unresolved records treated as lore or grounding; missing aliases or links
after backup; or pre/post-migration replay differences.
