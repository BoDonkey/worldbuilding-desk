# Archived 5.15c handoff prompt

> **Archived 2026-10-26.** Slice 5.15c is complete. See `PROJECT_STATUS.md`
> for current application truth and `docs/road-to-market.md` for active work.

Please finish roadmap slice 5.15 (password-protected project vaults) by doing
5.15c (verification and copy). Follow AGENTS.md: read docs/README.md,
PROJECT_STATUS.md, and docs/road-to-market.md, then claim 5.15c on the status
board. Use docs/project-vault-plan.md for the design and the 5.15c list, and
the roadmap's 5.15 entry for acceptance.

State on 2026-10-25:
- 5.15a (vault core) and 5.15b (UX and derived data) are Done on the board
  with green Web CI. Their PRs are still open and stacked:
  #80 (`claude/project-vaults`, base main) and #81
  (`claude/project-vaults-ux`, base `claude/project-vaults`). Merge #80
  first, then #81 (retarget it to main if GitHub does not). If they are not
  merged yet, branch 5.15c from `claude/project-vaults-ux`.
- Already covered, so 5.15c extends rather than repeats them: the
  planted-phrase scan in `services/storage/vault/projectVaultDerived.test.ts`
  (every IndexedDB database plus local and session storage, in jsdom) and
  the Cypress journeys in `apps/web/cypress/e2e/project-vault.cy.ts`.
- Still to do: the on-disk scan of the packaged desktop profile (including
  plaintext left in old IndexedDB pages after enabling protection), the
  Electron packaged smoke on macOS and Windows, a `docs/smoke-tests.md`
  procedure, and privacy/help copy written only after those checks pass.
  The Windows packaged check and the final privacy wording need me: ask
  before treating either as done.
- Known CI flakes, also seen on main: the `ai-scene-revision.cy.ts` "AI" tab
  test and a seed `cy.then()` timeout. If one fails, check it against those
  before debugging; rerun failed jobs once.

Context: 5.3, 5.14, and 5.15 run under an author-approved exception to the
Phase 5 gate. 5.1 and every other Phase 5 slice stay gated until the 1.1
trust dogfood is recorded and triaged. I may be running that dogfood on a
pinned build in parallel, so work on a branch/worktree rather than main,
and don't change the fixtures/trust-dogfood runbook without asking. When
5.15 is done, tell me which slice should be next.
