# Dual LLM Review Architecture

_Created: 2026-04-18_

## Position

Use a dual LLM system:

- A managed local "World Engine" for private, structured, background review work.
- A bring-your-own-key creative LLM for explicit prose, story, and brainstorming work.

This split matches the product's jobs. Lore listening and state tracking need privacy, low interruption, predictable structure, and deterministic validation. Prose critique and generation need taste, range, larger context windows, and user choice.

The local model should not be framed as a general chat assistant. It is a narrow system component that extracts observations and drafts review proposals. The outside model remains the author-facing collaborator for creative work.

## Responsibilities

### Local World Engine

The local engine handles bounded, structured tasks:

- Entity and alias candidates.
- State-delta candidates such as equipment, movement, resource changes, stat changes, status effects, and level-ups.
- Ambiguous reference classification.
- Review item confidence and evidence spans.
- Short neutral review-card summaries.
- Optional contradiction hints that are still verified by deterministic code.

The local engine outputs proposals, never canon. It should return JSON that is schema-validated before storage or display.

### External Creative LLM

The outside provider handles explicit author requests:

- Character generation.
- Story arc and plot discussion.
- Prose generation and rewriting.
- Voice, style, and pacing critique.
- Scene expansion, summarization, and brainstorms.

This path can use Anthropic, OpenAI, Gemini, Ollama, or other configured providers. Hosted providers should only receive manuscript text when the author invokes the feature or explicitly opts in.

## Privacy Boundary

The always-on or background listener should default local. The app should not silently send draft text to hosted providers for review.

Recommended policy:

- Deterministic review runs without any LLM.
- Local World Engine review runs when enabled and available.
- Hosted creative LLM calls require explicit author action.
- Any hosted background review mode, if ever added, must be opt-in and clearly labeled.

## Runtime Shape

Do not bundle a multi-GB model inside the Electron installer.

Ship the app shell first. On first launch, or when the author enables local review, offer to download the World Engine as a managed local asset:

- Keep the installer small.
- Show clear download progress.
- Store models in a stable application support path rather than inside the app bundle.
- Reuse the downloaded model across app upgrades.
- Allow removal from settings.

The app should tolerate three states:

- `notInstalled`: deterministic review only, with a prompt to install the World Engine.
- `installedUnavailable`: model exists but runtime is unavailable or failed health check.
- `available`: local structured review can run.

## Llama.cpp Direction

Llama.cpp is the likely runtime target because it supports GGUF models, quantized inference, local process hosting, and an HTTP API shape that can be wrapped like another provider.

The desktop main process should own:

- Model download and checksum validation.
- Model path discovery.
- Runtime process lifecycle.
- Port selection and health checks.
- Idle shutdown and restart.
- Error reporting for missing model, incompatible hardware, and failed startup.

The renderer should not need to know whether the local engine is llama.cpp, Ollama, or another backend. It should call a small World Engine API.

## Model Selection

Do not hard-code a single long-term model choice into the architecture. Local model quality, licensing, and runtime behavior will keep changing.

Near-term candidates to evaluate:

- Qwen small dense models for default/lite extraction quality and permissive licensing.
- Phi mini-class models for fast structured reasoning.
- Gemma 4B-class models for stronger prose-context understanding if licensing and runtime packaging fit the product.

The product can expose tiers rather than model brands:

- `World Engine Lite`: smaller download, lower RAM, lower latency, good for entity/state proposals.
- `World Engine Plus`: larger optional download, better classification, higher RAM and disk cost.

The first implementation should choose one managed default only after an evaluation harness compares real project examples.

## Author Flow

Authors do not want review to break drafting flow. Review should be visible but passive.

Use a small review-needed indicator instead of interrupting the editor:

- A subtle icon in the workspace chrome or review drawer tab.
- Badge count only when useful; avoid large alarming banners during normal typing.
- Tooltip or drawer summary for "review ready" state.
- No modal and no forced context switch while typing.
- Inline underlines should remain light-touch and actionable, not constant warnings.

The icon should communicate state:

- No pending review.
- Review running.
- Review ready.
- Review needs attention before a deliberate commit/publish/canonize action.
- Review engine unavailable.

Blocking language should be reserved for explicit actions such as strict save, canon commit, export validation, or publish checks. Ordinary drafting should keep moving.

## Review Cadence While Typing

Writing-time review should be debounced and chunked. It should not run on every keystroke.

Recommended trigger policy:

- Track words changed since the last review pass.
- Track idle time since the last edit.
- Run review only when both a minimum word delta and an idle pause threshold are met.
- Also run when the author explicitly clicks "Run review".
- Avoid re-reviewing unchanged spans.

Initial defaults to test:

- `minChangedWords`: 120-200 words.
- `idleDelay`: 8-15 seconds after typing stops.
- `maxPassWords`: 300-800 words around the changed region.
- `minInterval`: 30-60 seconds between automatic local LLM passes.

Deterministic known-entity highlighting can remain more responsive. Local LLM extraction should be slower and quieter.

For imported documents, review should run after persistence and queue results passively. Import should not fail just because review has not completed.

## Shadow State Contract

This document extends the Shadow State architecture:

1. Draft text enters a listener.
2. Deterministic rules and optional local LLM extraction create observation proposals.
3. Proposals are schema-validated.
4. A deterministic auditor compares proposals to canon and project rules.
5. The UI shows passive review items.
6. Accepted items become typed mutation commands.
7. Mutation commands update canon or state and write audit events.

The lore database and character state must never receive direct writes from LLM output.

## Suggested API Boundary

```ts
interface WorldEngine {
  getStatus(): Promise<WorldEngineStatus>;
  extractObservations(input: ListenerInput): Promise<ObservationProposal[]>;
  classifyReviewItem(input: ReviewClassificationInput): Promise<ReviewClassification>;
}

type WorldEngineStatus =
  | {state: 'notInstalled'}
  | {state: 'installedUnavailable'; reason: string}
  | {state: 'available'; modelLabel: string};
```

Implementations can evolve:

- `DeterministicWorldEngine`
- `LocalLlamaWorldEngine`
- `OllamaWorldEngine`

Avoid adding a hosted background implementation unless there is a strong opt-in privacy story.

## Near-Term Implementation Steps

1. Keep the current deterministic consistency engine as the baseline.
2. Add tests for false positives and state-delta examples before adding local model calls.
3. Add proposal schemas with confidence and evidence fields.
4. Add a review-needed icon state model independent of drawer visibility. Initial deterministic indicator is implemented.
5. Add typing cadence logic based on changed-word count plus idle pause.
6. Add a `WorldEngine` abstraction with a deterministic implementation first. Initial deterministic boundary is implemented.
7. Add a llama.cpp or Ollama-backed implementation behind a feature flag. Initial Ollama-backed annotation path is implemented; it currently enriches deterministic issues with local annotations and uses issue-local excerpt windows.
8. Persist accepted future state-delta reviews into a mutation ledger with scene/revision provenance before attempting replay or downstream invalidation.
9. Build an evaluation harness before choosing the managed default model.

## Success Criteria

- Authors can draft for long stretches without modal interruptions.
- Review readiness is visible with a small passive indicator.
- Background review does not send text to hosted providers by default.
- Local LLM output is always proposal-only and schema-validated.
- Deterministic review still works when the local model is missing.
- Model download, storage, and removal are understandable from settings.
- The outside creative LLM remains user-invoked and provider-configurable.
