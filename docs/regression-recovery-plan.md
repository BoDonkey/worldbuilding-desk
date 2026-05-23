# Regression Recovery Plan

## Branch Map

- `main`: last shared trunk before the current reconciliation work.
- `temp-update`: functional base for recovery. It forks from `main` at `7153ab0 Update workspace review` and includes the newer Zustand store work.
- `codex/review-completion-state`: richer UI/reference branch. Use it for selective product-shape recovery only, not as the base branch.
- `codex/reconcile-temp-update-ui`: active recovery branch, based on `temp-update`.

## Recovery Approach

1. Keep `temp-update` as the functional base.
2. Bring over narrow, reviewable slices only.
3. Commit each slice before starting the next one.
4. Add a guardrail test or written UI contract for every regression class before broad UI work.
5. Treat `codex/review-completion-state` as reference material for selected UI restoration, especially character and review surfaces.

## Guardrail Contracts

General fiction projects:

- Do not show ruleset navigation, ruleset command-palette entries, character sheets, compendium navigation, or game-system workspace context.
- Direct ruleset access must redirect away from `/ruleset`.
- Character management must remain story-facing: one character area, long-form description support, alias resolution, and no duplicate form-first character surfaces.

LitRPG/game projects:

- May expose rulesets, character sheets, compendium, runtime modifiers, and settlement/zone systems only when project feature toggles explicitly allow them.
- Feature checks should go through `getProjectCapabilities` rather than inline toggle reads.

World Bible and review surfaces:

- Keep review affordances subtle and low-density.
- Avoid returning to large review cards with repeated action buttons unless there is a specific workflow reason.
- Preserve focused review queues and minimal notification surfaces from `temp-update` where they are functionally stronger.

Storage and deletion:

- Project deletion must remove project-scoped IndexedDB records, per-project localStorage preferences, and per-project RAG/Shodh databases.
- Browser refresh may update IndexedDB display counts, but deleted projects must not leave usable project data behind.

## Next Slices

1. Add automated coverage for project-mode capabilities.
2. Reconcile character UI against the intended shape:
   - one character place,
   - long-form description editor,
   - alias resolution,
   - no duplicate textarea-only forms.
3. Reconcile review UI density from the reference branch without taking degraded functionality.
4. Add smoke tests for character and review shape once the UI is restored.
