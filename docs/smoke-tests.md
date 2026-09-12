# Manual Smoke Procedures

Last updated: 2026-08-16

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

Automated lower layer: the continuity review regression corpus at
`apps/web/src/fixtures/continuityCorpus.ts` (harness
`services/consistency/continuityCorpus.ts`, test
`continuityCorpus.test.tsx`) runs the real deterministic extraction,
validation, and contradiction code over short excerpts of the trust-dogfood
chapters and the sample project, with the answer-key plants (A1, A2, A4,
hazards, B1–B5, C1) as expected findings and the fixed false-positive shapes
as expected absences. When a manual smoke finds a new false positive or
miss, add it there as a case (or a `knownGap`) so it stays fixed.

Reload safety now includes the project review itself: after **Run project
review**, reload and reopen the Review drawer; the items and "Last run" time
must be restored, and editing a reviewed scene must mark its items "Scene
changed since review" until the next run.

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
   legacy capability + World Bible pairs shown once.
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
legacy capability/World Bible pairs, reload resurrecting completed or ignored
work.

## 3. Character Canon Unification

Goal: verify character canon and the coherent character detail experience live
in `World Bible > Characters`, with no separate character destination.

Procedure:

1. **Intake**: mention a new short name (e.g. `Garcia`) in a scene, run
   review, choose the `Characters` category — create action reads
   `Add to World Bible Characters`; prompt clears without forced navigation.
2. **Canonical rename**: in World Bible, rename `Garcia` →
   `Garcia de Terra`; `Garcia` is preserved as an alias; after marking
   reviewed and returning, `Garcia` highlights as known canon and the scene
   selection is preserved.
3. **Alias linking**: existing-record selector uses category labels, shows
   one option for linked legacy capability/World Bible pairs, links in place
   without navigation.
4. **Sectioned detail**: a new character shows only `Canon` until it is saved.
   A saved character exposes `Canon`, `Notes`, `Continuity`, and `Writing
   aids`; mechanics-enabled projects also expose `Mechanics`, while general
   fiction never does. Switching sections preserves unsaved form values and
   remains keyboard-operable at desktop and narrow breakpoints.
5. **Capability handoff**: World Bible character detail owns name, alias, lore,
   dialogue-style assignment, and single-character export. `Mechanics`
   exposes `Add sheet` or the attached `/sheets` state handoff only when
   project mode enables mechanics. Batch package transfer is a utility under
   `More`; `/characters` is compatibility-only and redirects to World Bible.
6. **Regression checks**: short-name/full-name pairs produce overlap
   suggestions with simple resolution (alias / keep separate / open
   existing); unlinked legacy capability records don't suppress unknown-name
   review; natural prose around known canon (`It's Garcia deTerra`,
   `Detective Garcia deTerra`, sentence-start words) does not fragment into
   stray review highlights — treat new false positives as annotation-policy
   work, not regex patching.

Focused automated coverage: `lore-review-matching.cy.ts`,
`post-merge-smoke.cy.ts`, `project-mode-guardrails.cy.ts`, plus unit suites for
`WorldBibleCharacterSections`, `reviewQueue`, `textMatcher`, and
`worldBibleCanonicalization`.

### Character identity journey suite (J1–J6)

All corresponding Character identity slices have landed. Run these journeys
as part of the active trust dogfood checkpoint; failures now describe current
regressions or trust findings and belong in the A–G run log.

1. **J1 — General fiction, new character.** In a general-fiction project,
   type a new character name in a scene, capture it from review, and accept it
   into a character-kind World Bible category. Confirm one World Bible
   character exists; no sheet, secondary character form, stat, or resource surface
   interrupts intake; the known-lore underline opens that record in one
   interaction; and its description is editable in exactly one place.
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
6. **J6 — Trust fixture (`Tam`).** Import
   `fixtures/trust-dogfood/character-identity/legacy-tam-tools-only.v1.json`
   with no World Bible Tam identity. Confirm `Tam` is not underlined as known
   lore, its unconfirmed Hollow Court note is absent from assistant grounding,
   and it appears in the identity resolution queue.
   Resolve it once by linking to existing canon and once, in a fresh fixture,
   by explicitly creating canon; after either author action, confirm all
   surfaces resolve the same entity ID and no duplicate identity remains.

Journey failure signals: any name-based link that changes after rename;
automatic canon creation; an ambiguous silent merge; more than one sheet for
one project/entity; accepted ledger events rewritten during migration;
unresolved records treated as lore or grounding; missing aliases or links
after backup; or pre/post-migration replay differences.

### Trust-dogfood fixture mapping

Start from the run sheet at the top of `fixtures/trust-dogfood/README.md`;
in a dev build, Projects → **Dogfood tools (dev only) → Load trust-dogfood
fixture** seeds the chapters, Source Notes, and ruleset with no canon so the
run begins at review. Then execute the concrete five-pass script in that
file under **Character identity addendum — J1–J6**, and record its G1–G6 checks against
`fixtures/trust-dogfood/answer-key.md`. J3 uses
`character-identity/legacy-identity-matrix.v1.json`; J6 uses
`character-identity/legacy-tam-tools-only.v1.json` twice so both explicit
resolution branches are exercised.

Automation supplies the repeatable lower layer: `lore-review-matching` and
`project-mode-guardrails` cover J1 review and mode gating;
`post-merge-smoke` covers J2/J4 capability routing;
`characterIdentityDogfoodFixtures.test.ts`, identity-resolution tests, and
`projectSchemaMigrations.test.ts` cover J3/J6 classification, conservation,
and backup invariants; snapshot/package services plus the backup Cypress flow
cover J5. Automation does not replace recording the manual G1–G6 outcomes.

## 4. Mechanics First-Use Journey

Goal: verify that a LitRPG or rules-enabled author can go from one saved World
Bible character and no ruleset to one useful tracked value, one linked sheet,
and one scene-scoped change without learning the advanced system model. This
is the manual acceptance authority for roadmap 4.15; run it at desktop and at
the narrow/mobile breakpoint.

1. **Mode boundary.** Open a general-fiction project and a LitRPG project
   without ruleset data. General fiction shows no mechanics prompt, missing
   setup warning, or completion badge. The LitRPG character's Mechanics
   section explains that tracking is optional and offers one clear `Add
   mechanics` action. Standalone Rules, Sheets, and Mechanics destinations do
   not compete inside this first decision.
2. **One-value setup.** Choose `Add mechanics`. The basic flow remains in the
   character context and explains `Stat` versus `Resource` in author language.
   Create either one stat or one resource with a name and useful default. The
   flow does not require another world/project name, the unused definition
   kind, a template, min/max, regeneration, formula, effect, runtime,
   progression, compendium, settlement, import, or export choice.
3. **Atomic attach and return.** Confirm once. A minimal ruleset and exactly
   one sheet are persisted through the existing deterministic services; the
   sheet uses the World Bible entity ID and canonical name. The UI returns to
   that character's Mechanics section, displays the value, and reports
   success. It never opens Character Tools, asks for the name again, or shows
   an `already has a sheet` warning after successful creation. Reload and a
   canonical rename preserve the attachment.
4. **Scene-scoped change.** Create or open a manuscript scene and choose
   `Record a scene change` from the active scene context or the character.
   Character, sheet, and scene are preselected. Choose the tracked value, use
   plain-language `Change by` or `Set to`, and verify the before/after preview.
   No event is written before explicit confirmation; cancel leaves replay
   unchanged.
5. **Continuity result.** Confirm the change. The existing event ledger
   records a stable actor ID, scene ID/order/revision evidence, and accepted
   command; deterministic validation and replay still pass. Author-facing
   confirmation avoids `mutation`, `ledger`, internal definition IDs,
   timestamps, hashes, and `invalidate`. The new value appears in the
   character's Continuity and Mechanics sections and can return to its source
   scene.
6. **Advanced disclosure.** Explicitly open advanced rules, sheet/state, and
   mechanics controls. Existing definition types and limits, templates,
   level/XP, runtime effects, inventory/equipment/statuses, history repair,
   compendium, progression, recipes, milestones, zones, settlement,
   import/export, and parent-memory tools remain available and editable. They
   are absent from the untouched basic path and do not make the project appear
   incomplete.
7. **Desktop and narrow behavior.** At both breakpoints the setup order,
   labels, defaults, success state, and persisted result are equivalent.
   Keyboard focus follows the active step, validation is announced inline,
   primary/cancel actions remain visible, controls do not overflow or hide
   behind mobile navigation, and an interrupted flow resumes at the same
   character and incomplete step. Back/Escape never commits an unconfirmed
   operation.

Failure signals: a mandatory second world name; both stat and resource being
required; any route through Character Tools in the basic path; duplicate
sheet warnings after success; manual re-selection of known character/sheet/
scene context; advanced terminology or controls before disclosure; direct
writes without author confirmation; general-fiction mechanics pressure;
desktop/narrow behavior or persistence diverging.

## 5. Prose-Proximate Item and State Authoring

Goal: verify that acquisition and consumption prose can create an editable,
author-confirmed item/state proposal without leaving Workspace or collapsing
World Bible canon, reusable mechanics, and manuscript-time state into one
record. This is the manual acceptance authority for roadmap 4.16; run it at
desktop and at the narrow/mobile breakpoint.

1. **First acquisition, state only.** In a rules-enabled project with a
   canon-linked Bill sheet, write `Bill found a health potion.` Select or
   invoke the contextual action on that prose. Confirm Bill, the active scene,
   evidence span, cursor position, item name, quantity `1`, and inventory-add
   outcome are prefilled. Accept with reusable World Bible item creation off.
   Replay shows one Health Potion in inventory; no World Bible or Compendium
   record was created and Workspace never navigated away.
2. **First acquisition, reusable item.** Repeat in a fresh scene/project and
   enable `Save as a reusable world item`. Edit the proposed canonical name
   before confirmation. Confirm once; exactly one World Bible item and one
   accepted acquisition event are written with a stable reusable-item link.
   A later canonical rename updates the resolved inventory label, preserves
   the relationship, and creates no duplicate.
3. **First consumption and remembered effect.** With Health as a tracked
   resource and one Health Potion in inventory, write `Bill drank a health
   potion.` Open the prose action. With no approved consumable definition,
   choose Health, `Change by`, `+25`, and `Remember this effect`. Verify the
   combined preview shows inventory `1 → 0` and the clamped/validated Health
   before/after value. Confirm once; exactly one reusable effect definition
   and one accepted scene event containing the consumption and Health change
   are written.
4. **Repeated consumption.** Add another Health Potion through an accepted
   event, then write a later consumption. Confirm the exact linked approved
   effect is prefilled but editable. Cancel once and verify no destination
   changes; reopen and confirm, then verify the event replays once and the
   reusable definition is neither duplicated nor silently rewritten.
5. **Missing inventory.** With zero Health Potions in replayed inventory,
   invoke the consumption proposal. Verify the app offers `Add one and
   consume it`, `Consume without inventory tracking`, and cancel. Exercise
   each author branch in a fresh baseline. No branch invents a prior hidden
   acquisition; cancel writes nothing.
6. **Ambiguity and generic-item containment.** Seed two possible reusable
   Potion matches and verify the proposal requires an explicit choice or a
   new/separate item; it never name-merges. Then write `Bill found a rope.`
   Confirm state-only inventory tracking is the default and no World Bible or
   Compendium clutter is created unless explicitly requested.
7. **Trust and stale-source behavior.** Edit the source sentence after a
   proposal is prepared and verify it becomes stale or refreshes before
   confirmation. Edit it after acceptance and verify the existing ledger
   invalidation/review path preserves audit history. Detection alone, review
   refresh, Escape/Back, and dismissal never write canon, mechanics, or
   state. General-fiction projects receive no mechanics pressure.
8. **Desktop, narrow, and keyboard behavior.** At both breakpoints the
   proposal stays visibly anchored to the writing task, preserves the same
   defaults and results, traps/restores focus, announces validation and
   success, keeps confirm/cancel visible, and does not overflow behind mobile
   navigation. The complete basic path is keyboard operable.

Failure signals: navigation away from Workspace for the basic path; automatic
World Bible or Compendium creation; inferred genre-standard effect values;
silent ambiguous matching; display-name-only links that break after rename;
partial writes after validation failure; consumption of absent inventory with
no explicit author choice; duplicate definitions/events; cancellation or
stale prose writing data; or different desktop/narrow results.
