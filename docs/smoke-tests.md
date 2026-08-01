# Manual Smoke Procedures

Last updated: 2026-08-01

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
   passes integrity checks.
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
