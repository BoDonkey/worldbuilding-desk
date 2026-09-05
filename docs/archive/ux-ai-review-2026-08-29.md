# UX + AI Surface Review — 2026-08-29

**Type:** dated audit (archive convention, same as the fitness reports).
**Audited:** `main` at `7dbb8d6` ("Close state replay dogfood slice").
**Scope:** author-facing experience and the user-facing AI surface. No code
changed. Findings are evidence-linked; each carries a recommendation sized for
the `road-to-market.md` status board.

**Status:** Part C was applied to the `road-to-market.md` status board on
2026-08-29 as slices 1.5, 5.10–5.12, plus the re-scope of 1.4, the S→M re-size
of 5.5, and the promotion of 5.4. §B4.2 carries a correction — see the note
there before acting on it.

**Context for this review:** phases 1–4 are complete through 4.16c. The
remaining board is Phase 5 (release engineering) and Phase 6 (beta/launch).
Nearly everything below lands inside existing unstarted Phase 5 slices —
5.4 onboarding, 5.5 provider setup, 5.8 help baseline — which are currently
sized S/L on the assumption that they are small additions. They are not.
The main argument of this review is that **Phase 5's experience slices are
the real pre-beta risk, and three of them are undersized.**

---

## Summary

The trust machinery is in good shape — that is what the last six months of
dogfooding bought. What is missing is everything that surrounds it: the
app has no first-run path, no way to verify an API key, no help surface, and
leaks internal vocabulary and raw exception text into author-facing UI. A
beta author who cannot get past the API key screen never reaches the canon
pipeline you spent Phase 1 hardening.

On AI: the capability set is not as thin as it looks from the call-site count,
but it is **shallow in one specific way** — of five AI surfaces, only one
(the World Bible record helper) lets model output become a reviewable,
confirmable change. The other four terminate in prose the author must read and
re-type. The trust boundary is doing its job; the gap is that "propose" was
built once and not generalized.

Top five, in priority order:

1. **No first-run experience at all** (§A1) — blocks beta
2. **BYOK setup is developer-grade and unverifiable** (§A2) — blocks beta
3. **Only one AI surface produces a reviewable proposal** (§B3) — biggest
   product-value gap
4. **Internal codenames in author-facing UI** (§A3) — cheap, embarrassing
5. **Raw exception text as the error UX** (§A4) — cheap, erodes trust

---

## Part A — UX findings

### A1. There is no first-run experience — blocking

**Evidence.** `HomeRoute` (`App.tsx:35-38`) redirects to `/workspace` if a
project is active, otherwise `/projects`. A new install therefore lands on
`ProjectsRoute`, whose entire empty state is one sentence
(`ProjectsRoute.tsx:724`): *"No projects yet. Create one to get started."* A
repo-wide search for onboarding, first-run, welcome, tour, or getting-started
markers returns exactly one file — and that hit is an unrelated identifier in
`WorldBibleCategoryRail.tsx`. There is no sample project, no guided path, no
explanation of what the app is for.

**Why it matters.** Every differentiator — canon decisions, review queues,
progressive mechanics, prose-proximate item authoring — is discovered only by
clicking into it. A beta author's first ten minutes are: create project, land
in an empty editor, and guess. Slice 5.4 covers this and is correctly marked
`L`, but it is also gated behind 4.13 and 4.15 (both now done), so nothing
blocks it.

**Recommendation.** Promote 5.4 ahead of the rest of Phase 5. It is the
single highest-leverage unstarted slice on the board and it is a prerequisite
for 6.1 being worth running — beta feedback from authors who never found the
features is not signal. Minimum viable version: a bundled read-only sample
project that already contains lore with a planted contradiction, so the canon
review queue has something in it on first open. You already have this content —
`fixtures/trust-dogfood/` is a five-chapter LitRPG manuscript with planted
issues and an answer key. Ship a trimmed derivative of it as the sample.

### A2. BYOK provider setup is developer-grade and cannot be verified — blocking

**Evidence.**

- `AISettings.tsx` is 1,177 lines presenting roughly two dozen flat controls
  with engineer-facing labels: *Max context chars per request* (`:821`),
  *Max response tokens* (`:839`), *Low-cost model override (optional)*
  (`:857`), *Project review engine* (`:733`), *Canon decision AI provider
  policy* (`:760`), *Ollama Base URL* (`:878`).
- **There is no way to test a key.** A repo-wide search for a test-connection,
  key-validation, or model-listing call returns nothing. The author pastes a
  key and discovers whether it works only when a later request fails.
- The only "not configured" message in the app is a bare string with no action
  attached (`AIAssistant.tsx:123`): *"AI provider is not configured. Add an
  API key in Settings."* It does not link to Settings.

**Why it matters.** This is the first wall between a novelist and every AI
feature you have. BYOK already asks a non-technical author to go get an API
key from a third party; asking them to also reason about context-char budgets
and base URLs, with no confirmation that any of it worked, is where the beta
cohort silently churns.

**Recommendation.** Slice 5.5 is sized `S`. That sizing assumes polish; the
work is a redesign. Re-size to `M` and scope it as:

- A **Test connection** action per provider that makes one cheap real call and
  reports success, auth failure, or reachability failure in plain language.
  This is the highest-value single control in the whole settings surface.
- A two-tier split: a short **Setup** section (provider, key, test, model) and
  a collapsed **Advanced** section holding the budget/override/base-URL
  controls. This is the same progressive-disclosure pattern 4.15 established
  for mechanics — reuse it rather than inventing a second one.
- Make the not-configured message actionable: link to Settings, and state
  which provider is missing.
- Author-facing relabels: *Max context chars per request* → how much story
  context to send; *Low-cost model override* → cheaper model for routine
  checks; *Project review engine* → who checks your draft.

### A3. Internal codenames and acronyms in author-facing UI

**Evidence.** All of these render to the author:

| String | Location |
|---|---|
| `Shodh memories` | `LoreRoute.tsx:1688` |
| `No Shodh memory found yet. Save the ruleset (Ruleset tab) to generate one.` | `CharacterSheetsRoute.tsx:1315` |
| `Shodh summaries are refreshed for…` | `LoreRoute.tsx:1740` |
| `RAG documents` | `LoreRoute.tsx:1683` |
| `Refresh RAG from saved scenes…` | `LoreRoute.tsx:1739` |
| `Inherit RAG data` | `ProjectsRoute.tsx:792` |
| `Rubber-Duck AI` | `CanonDecisionsRoute.tsx:757` |

Note the inconsistency in `ProjectsRoute` specifically: the two adjacent
inheritance toggles read *"Inherit RAG data"* and *"Inherit memories"* — the
same concept, one named after the implementation and one after the author's
mental model.

**Why it matters.** "Shodh" is an internal service name. "RAG" is an
ML-engineering term. Your positioning is a calm writing-first tool for
novelists; this vocabulary contradicts it on sight, and it appears on the two
routes (Source Notes, Projects) an author visits early.

**Recommendation.** A rename-only sweep, `XS`, behavior-preserving. Proposed
mapping: `Shodh memories` → **Project memory**; `RAG documents` → **Indexed
context** (or **Searchable context**); `Inherit RAG data` → **Inherit indexed
context**; `Rubber-Duck AI` → **Think it through**. Keep the internal service
and type names as they are — this is a string-layer change only. Worth adding
a lint rule or a unit test asserting these tokens do not appear in rendered
strings, so they cannot come back.

### A4. Raw exception text is the error UX

**Evidence.** 79 call sites across `routes/`, `components/`, and `hooks/`
follow the pattern `error instanceof Error ? error.message : '<fallback>'` and
render the result directly. `CanonDecisionsRoute.tsx` alone has six in a
90-line span (`:367, :401, :479, :500, :532, :547`). Separately, 24
`console.error`/`console.warn` calls in non-test code swallow failures with no
user-visible signal at all — including the assistant's project-context
initialization (`AIAssistant.tsx:166`), which only sets an opaque
`contextStatus: 'error'`.

**Why it matters.** The fallback strings are good ("Unable to alias
candidate."). The problem is that they are the *unlikely* branch — when a real
error occurs, the author sees the provider SDK's or IndexedDB's message
instead. In an app whose core promise is trustworthiness, an unexplained
`fetch failed` or `QuotaExceededError` mid-review is disproportionately
damaging.

**Recommendation.** `S`, and it pairs naturally with 5.6 (opt-in error
reporting) since both need a central error path. Introduce one
`describeError(error, fallback)` helper that maps known failure classes
(network, auth, quota, storage-full, schema-too-new) to author-facing text and
returns the fallback for everything else; route the 79 sites through it. The
raw message goes to the console and to the 5.6 report payload, not to the UI.

### A5. Notification surfaces are route-local, so feedback is inconsistent

**Evidence.** A toast viewport exists only in `WorkspaceRoute.tsx:1321`
(`workspaceToastViewport`, `aria-live='polite'`). `ProjectsRoute` has its own
separate notification handling. The other nine routes surface status through
ad-hoc inline elements. `InlineAlert` (from slice 2.1) is the shared primitive
but there is no shared *placement* convention above it.

**Why it matters.** Slices 2.1–2.9 unified the components; they did not unify
where feedback appears. The author learns one feedback location in Workspace
and a different one everywhere else.

**Recommendation.** `S`. Lift the Workspace toast viewport into the app shell
so every route can post transient confirmations to one predictable place;
keep `InlineAlert` for errors that must stay anchored to the control that
caused them. Document the split in the `product-blueprint.md` design system
section so it holds.

### A6. Live-region coverage is thin for how much async work happens

**Evidence.** Three `aria-live` regions app-wide
(`BasicCharacterStatePanel.tsx:77`, `EditorWithAI.tsx:990`,
`WorkspaceRoute.tsx:1321`) against 67 loading/saving state indicators. Three
`aria-invalid` attributes, despite slice 2.3 having delivered inline
field-level validation. Six `aria-describedby`, 70 `aria-label`, 54 `role=`.

**Why it matters.** Autosave, review refresh, extraction, migration, and AI
streaming all change state without announcing it. `v1 must include …
accessible dialogs/nav` is in your own v1 definition; the dialogs and nav are
handled, the async status layer is not.

**Recommendation.** `S`. One shared `useStatusAnnouncement` hook plus a single
app-shell live region, wired to the five async operations above. Extend the
2.3 validation pattern's `aria-invalid` to the remaining validated fields —
the pattern exists, it just was not applied broadly.

### A7. The command palette is navigation-heavy and Workspace-only

**Evidence.** `commandRegistry.ts` registers 25 commands. Eight are *Go to
X* route jumps; the remaining seventeen are all prefixed `Workspace:` and only
meaningful while in Workspace.

**Why it matters.** Nothing is wrong here — but a palette that is 30%
navigation and 70% one-route actions is not yet the calm-shell accelerator the
blueprint describes. Notably absent: anything that opens the canon review
queue, resolves an identity, or starts an AI consultation.

**Recommendation.** `XS`, opportunistic. Add commands for the review/canon
actions authors repeat most (open review queue, jump to next unresolved
identity, run a lore consultation on the selection). Low cost, and it makes
the trust workflow feel fast rather than administrative.

### A8. Component test coverage is concentrated away from the UI

**Evidence.** 86 test files total. Of 59 non-test components, 14 have
adjacent tests (~24%). Cypress covers 11 specs. Services and hooks are well
covered; presentational and interaction-heavy components largely are not.

**Why it matters.** This is a deliberate and mostly correct trade — the risk
that matters is in the trust logic, and that is where the tests are. Flagging
it only because Phase 5 will now change UI *shape* (onboarding, settings
redesign, shared toasts) rather than trust logic, and there is little
component-level safety net under that work.

**Recommendation.** No dedicated slice. Add component tests inside 5.4 and
5.5 for the surfaces those slices create, and let coverage rise as a
by-product.

---

## Part B — AI surface

### B1. Complete inventory

Five author-facing AI surfaces exist. Reaching the model happens through three
non-provider call sites (`AIAssistant.tsx`, `CanonDecisionsRoute.tsx`,
`LocalAiReviewWorldEngine.ts`).

| # | Surface | Entry | Output lands as |
|---|---|---|---|
| 1 | Assistant chat | Workspace context drawer (`WorkspaceContextDrawer.tsx:1027`) | Chat prose; optional raw insert at cursor (`AIAssistant.tsx:485-486`) |
| 2 | Lore Inspector consultations — 5 modes | Workspace lore drawer → queued prompt into #1 (`useWorkspaceContextActions.ts:82`) | Chat prose |
| 3 | Canon "Rubber-Duck" | Canon Review, per cluster (`CanonDecisionsRoute.tsx:757`) | Advisory prose beside the cluster; author still decides manually |
| 4 | World Bible record helper | World Bible record editor (`WorldBibleRecordAiHelper.tsx`) | **Preview → confirm → applied to a record field or new section** |
| 5 | Local AI review preview | Opt-in review engine (`LocalAiReviewWorldEngine.ts`, Ollama-only, 12s timeout) | Schema-validated issue annotations feeding the review queue |

Three prompt templates back all of this (`defaultPrompts.ts`): Writing
Assistant, Rules Assistant, World Bible Assistant. Authors can layer
`PromptTool`s (style/tone/persona/instruction) on top per project mode.
Guardrails are real and working: per-project daily consultation budget,
context-char cap, response-token cap, a factual-question evidence gate
(`factualQuestionBoundary.ts`), and deterministic temporal-custody answering
(`temporalCustody.ts`) that answers without calling the provider at all.

Defaults: `enableAIConsultation: true`, `reviewEngineMode: 'deterministic'`,
`canonDecisionProviderMode: 'project-provider'` (`settingsStorage.ts:25-27`).

### B2. What is genuinely good here

Worth stating plainly, because it is the part that would be easy to break
while expanding: the trust boundary is not a policy document, it is enforced
in code. Factual questions are gated on evidence before they can reach
generation. Custody questions are answered deterministically from ordered
saved scenes with citations and no provider call. The local review engine
validates model output against Zod schemas before anything enters the queue.
This is the hard part, and it is done. Any expansion below must inherit it.

### B3. The core gap — "propose" was built once and not generalized

Of the five surfaces, exactly one (#4, the World Bible record helper) closes
the loop: select model output → choose a target → preview → confirm → the
record changes. Surfaces #1, #2, and #3 all end in prose the author reads and
manually re-enters. Surface #5 is the other structured path, but it is
opt-in, Ollama-only, and framed as a preview.

That is why the AI feels limited despite the guardrail work: the constraint
is not what the model is *allowed* to do, it is that only one place lets its
output become a reviewable change. The `WorldBibleRecordAiHelper`
preview/confirm pattern is the asset — it already satisfies models
propose / code validates / authors approve. It just is not reused.

**Recommendation — the central one in this review.** Extract the
propose→preview→confirm interaction from `WorldBibleRecordAiHelper` into a
shared component and hook, then apply it to the surfaces that currently dead-end:

- **Assistant → Source Note.** Model output the author likes becomes a draft
  Source Note (never canon), entering the existing extraction/review pipeline
  where it is already handled correctly.
- **Assistant → scene text.** Replace the raw "insert last message"
  (`AIAssistant.tsx:485-486`) with the same preview/confirm affordance used
  everywhere else, so insertion is a reviewed action rather than a paste.
- **Canon rubber-duck → decision prefill.** The advisory prose already
  reasons about which decision is safest; let it *prefill* the alias/accept/
  reject choice with its rationale visible, still requiring the author's
  click. This is the highest-value single addition — it turns the canon queue
  from an administrative chore into assisted review, and it changes nothing
  about who decides.

Suggested board entry: **1.5 — Shared AI proposal surface**, `M`, Phase 1
(it is trust-path work, not release engineering). Prerequisite for the
capability additions below.

### B4. Capability gaps worth considering after B3

Ordered by author value against implementation cost. All assume the shared
proposal surface exists and inherit the trust boundary.

1. **Scene-scoped continuity check.** "Does this scene contradict what I have
   established?" The pieces all exist — `ConsistencyEngineService`, canon
   facts, temporal custody — but there is no author-invoked action that runs
   them together over the current scene and returns a readable answer. This
   is the most requested thing in this category of tool and you are closest
   to it. `M`.
2. **Character voice check.** ~~You already store per-character dialogue
   styles…~~ **Corrected 2026-08-29:** this recommendation was based on a
   misreading and its original sizing was wrong. `CharacterStyle`
   (`entityTypes.ts:222`) is *visual* formatting — `fontFamily`, `color`,
   `fontWeight` — assigned to a World Bible entity so that character's dialogue
   renders distinctly in the editor. It carries no diction, register, or voice
   data, and nothing else in the schema does either. An author-invoked "does
   this dialogue sound like her?" therefore requires building a voice model
   first, either author-authored or derived from that character's existing
   lines. `M` at minimum, and it depends on a modelling decision that has not
   been made. Deprioritised accordingly.
3. **Ask-my-world Q&A.** The evidence gate and RAG index already support
   grounded factual answers, and `getDirectSavedFactAnswer` handles the easy
   cases. What is missing is a *destination* — a place to ask questions of the
   project outside the Workspace drawer. Slice 1.4 ("Proposal-review assistant
   route, conditional on product need") is the natural home; this review is
   the product need. `M`.
4. **Prompt-tool presets.** `PromptTool` is powerful and entirely
   author-constructed from an empty list. Ship 4–6 presets (close third
   limited, dry wit, sensory-heavy, minimal exposition) so the feature is
   discoverable. `XS`.

Explicitly **not** recommended: anything that drafts prose unprompted,
anything that writes to canon without confirmation, and anything that makes AI
a prerequisite for a core workflow. The current containment is a positioning
asset — "your canon is never written by a model" is a stronger beta pitch than
any capability on this list.

---

## Part C — Recommended board changes

| Proposed | Slice | Size | Rationale |
|---|---|---|---|
| **New 1.5** | Shared AI proposal surface (§B3) | M | Trust-path work; unblocks all AI capability additions |
| **Re-scope 1.4** | Becomes the ask-my-world destination (§B4.3) | M | Product need now established |
| **Re-size 5.5** | `S` → `M`, redesign not polish (§A2) | M | Test-connection + two-tier disclosure + relabels |
| **Promote 5.4** | Run first in Phase 5 (§A1) | L | Beta feedback is not signal without it; reuse trust-dogfood fixture as the sample |
| **New 5.10** | Author-facing vocabulary sweep (§A3) | XS | String-layer only, behavior-preserving |
| **New 5.11** | Central error description helper (§A4) | S | Pairs with 5.6 |
| **New 5.12** | App-shell toast viewport + live region (§A5, §A6) | S | Completes the 2.x component unification |
| **Fold in** | Command palette additions (§A7) | XS | Opportunistic |

**Suggested order:** 5.10 and 5.11 first (cheap, immediately visible, no
dependencies) → 1.5 → 5.5 → 5.4 → 5.12 → the B4 capabilities as appetite
allows → then Phase 6.

**Not blocking beta:** §A7, §A8, and B4 items 2–4.

---

## Appendix — QA session script

Designed to be run against a **fresh install with no existing projects**, in
one 60–90 minute sitting. Record verdicts as `pass` / `fail` / `friction`,
where `friction` means it worked but cost more thought than it should have.
`friction` is the interesting column — this is a UX pass, not a bug hunt.

Before starting: back up or move existing app data so first-run is genuine.
Findings above predict failures at F1, F2, S1, S3, E2, and A2; the point of
running it is to find what this static review could not see.

### Session 1 — First contact (no API key configured yet)

| # | Step | Watch for |
|---|---|---|
| F1 | Launch fresh. Do not read docs. | Where do you land? Do you know what to do? Time to first typed word. |
| F2 | Create a project without touching Settings. | Is a mode choice forced? Is the choice explained in author terms? |
| F3 | Write two paragraphs naming a character and a place. | Does anything react? Is the reaction ignorable, per the north star? |
| F4 | Find the review/consistency surface without using the nav rail. | Discoverable from the editor, or only from nav? |
| F5 | Try to reach every nav destination and state what each is for, in one sentence, before opening it. | Which labels fail this test? |
| F6 | Look for help, docs, or an explanation of any feature. | Confirms the 5.8 gap; note *where* you looked first. |

### Session 2 — AI setup (the predicted wall)

| # | Step | Watch for |
|---|---|---|
| S1 | Open the assistant with no key configured. | Message actionable? Path to Settings? (§A2) |
| S2 | Configure a provider as a novelist would. | Which of the ~24 controls are unclear? Which did you skip? |
| S3 | Paste a deliberately wrong key, then use the assistant. | What does the failure look like? Can you tell it is a key problem? (§A2, §A4) |
| S4 | Fix the key. Ask a factual question about your world. | Evidence gate behavior; is the grounding visible to you? |
| S5 | Ask something the project cannot answer. | Does it refuse cleanly, or speculate? |
| S6 | Run all five Lore Inspector consultations. | Which produce usable output? What do you *do* with the output? (§B3) |

### Session 3 — Trust loop end to end

| # | Step | Watch for |
|---|---|---|
| T1 | Import a lore document with a deliberate contradiction. | Time until you know a contradiction was found. |
| T2 | Work the canon review queue to empty. | Count clicks per decision. Is the evidence enough to decide? |
| T3 | Use the rubber-duck on one ambiguous cluster. | Does the advice change your decision? Could it have prefilled it? (§B3) |
| T4 | Rename a character in canon. | Does everything downstream follow? |
| T5 | Record a state change, then replay it. | Is the preview understandable without knowing the data model? |
| T6 | Back up and restore the project. | Round-trip completeness; per `docs/smoke-tests.md`. |

### Session 4 — Error and edge behavior

| # | Step | Watch for |
|---|---|---|
| E1 | Disconnect the network mid-consultation. | What text appears? Is it author-readable? (§A4) |
| E2 | Kill Ollama (if configured) mid local-AI review. | 12s timeout behavior; is the wait explained? |
| E3 | Delete a scene referenced by a state event. | Is the consequence explained before it happens? |
| E4 | Resize to a narrow window and repeat T2. | Narrow-mode parity for the canon queue. |
| E5 | Navigate away mid-autosave, then return. | Data preserved? Selection preserved? |
| E6 | Traverse one full route by keyboard only. | Focus order, focus visibility, trapped focus. (§A6) |

### Session 5 — Accessibility and calm-shell claims

| # | Step | Watch for |
|---|---|---|
| A1 | Open every dialog by keyboard; close each with Escape. | Focus return, per slice 2.1. |
| A2 | With a screen reader on, perform an autosave and a review refresh. | Announced at all? (§A6 predicts silence.) |
| A3 | Toggle light/dark on every route. | Token coverage; any hardcoded color surviving 2.4–2.6. |
| A4 | Ask: is the editor still the primary surface on every route you visited? | The north-star check. |

### Recording

Log to `fixtures/` alongside the trust-dogfood runbook, or to a scratch file —
but keep the `friction` entries verbatim and in your own words. Aggregated
`friction` notes are what should generate the next round of slices; do not
pre-triage them into `pass` while running.
