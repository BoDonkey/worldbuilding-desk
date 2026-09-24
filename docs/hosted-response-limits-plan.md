# Hosted Response Limits — Slice 4.41 Plan

**Status:** Accepted for implementation, 2026-09-24  
**Scope:** Hosted Anthropic, OpenAI, and Google Gemini requests. Local Ollama
remains uncapped under Slice 4.40.

## Decision

The hosted response-token limit is a hard **maximum response charge**, not a
promise about the total request price. Input size varies by feature and model,
so the UI must label the estimate as response-only. It shows the selected
model, token ceiling, and worst-case response charge when that exact model is
in the maintained price table. Unknown/custom models keep the token ceiling
but show that the price is not listed; the app never guesses a price.

Keep one project-level response limit. Feature-specific caps are not needed:
the existing minimums for schema-heavy replies remain deterministic floors,
while the project setting remains the author's normal ceiling. Splitting the
setting by feature would add configuration without creating a stronger spend
boundary.

## Provider policy

| Provider | Request cap | Thinking policy | Cut-off signal |
|---|---|---|---|
| Anthropic | `max_tokens` | Do not opt into extended/adaptive thinking. It requires a separate allowance and competes with visible output inside `max_tokens`. | `stop_reason: "max_tokens"` |
| OpenAI | `max_completion_tokens` | Do not explicitly enable reasoning. For model families that reason by default, request low reasoning effort and omit temperature when required; hidden reasoning still counts inside the same ceiling. | `finish_reason: "length"` |
| Gemini 2.5 Flash / Flash-Lite | `maxOutputTokens` | Disable thinking (`thinkingBudget: 0`) so a short author-facing reply cannot spend its whole ceiling before producing text. | `finishReason: "MAX_TOKENS"` |
| Gemini 2.5 Pro | `maxOutputTokens` | Use the provider's minimum 128-token thinking allowance because thinking cannot be disabled. | `finishReason: "MAX_TOKENS"` |
| Gemini 3+ | `maxOutputTokens` | Request low thinking, which Google documents as the cost/latency-minimizing supported level. | `finishReason: "MAX_TOKENS"` |
| Other Gemini models | `maxOutputTokens` | Send no thinking control rather than risk an unsupported parameter; the hard response ceiling still applies. | `finishReason: "MAX_TOKENS"` |

Provider adapters detect the final stop reason for both streamed and ordinary
responses. A capped reply is incomplete and must not enter proposal parsing,
canon review, or saved assistant history. Reject it with: “The provider
stopped at this project's response limit, so no complete answer was used.
Raise Max response tokens in Settings and try again.” Partial text may have
streamed while the author watched, but it is discarded when the run ends.

## Price table

Keep a small exact-model table in source control with:

- provider and exact model id or stable alias;
- USD output price per million tokens;
- verification date and official pricing URL.

The first table covers the configured fallbacks and current common successor
models. Tests must make stale/unknown model behavior explicit. Updating prices
is a data edit, not provider logic.

The estimate is `ceiling tokens × output USD / 1,000,000`, rounded up to the
nearest cent below $1 and to two decimals otherwise so the UI never understates
the ceiling. Reasoning/thinking tokens are billed as output by these providers
and already fall inside the response ceiling.

## Sources checked 2026-09-24

- [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create) — `max_completion_tokens` includes visible and reasoning tokens; `max_tokens` is deprecated and incompatible with o-series models.
- [OpenAI pricing](https://developers.openai.com/api/docs/pricing) and [model catalog](https://developers.openai.com/api/docs/models/compare) — current output-token rates.
- [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing) — current per-model output-token rates.
- [Anthropic extended thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking) — thinking counts inside `max_tokens`; manual thinking has a 1,024-token minimum on supported legacy models.
- [Anthropic streaming](https://platform.claude.com/docs/en/build-with-claude/streaming) — final `message_delta` carries `stop_reason`.
- [Gemini thinking](https://ai.google.dev/gemini-api/docs/generate-content/thinking) — thinking shares `maxOutputTokens`; 2.5 Pro cannot disable it, 2.5 Flash can, and Gemini 3 supports low thinking.
- [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) and [GenerateContent response](https://ai.google.dev/api/generate-content) — thinking is billed as output and `MAX_TOKENS` identifies a cap stop.

## Verification

- Unit tests for exact/unknown price lookup, rounding, provider thinking
  policy, OpenAI parameter selection, and all three cut-off signals.
- Component coverage for the Settings explanation and unknown-price state.
- Full repository verification battery. Cypress is required because Settings
  is routed UI; add a focused assertion for the hosted cost ceiling.

