# Review AI Seam Plan

Last updated: 2026-04-26

## Goal

Prepare the existing deterministic review workflow so AI review can plug into it as an augmentation layer, not as a second competing system.

The immediate objective is not to ship model-backed review yet. It is to make the integration boundary explicit and keep the current deterministic review path as the control path.

## Current Boundary

The seam already exists at the `WorldEngine` interface:

- [apps/web/src/services/worldEngine/types.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/services/worldEngine/types.ts)
- [apps/web/src/services/worldEngine/DeterministicWorldEngine.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/services/worldEngine/DeterministicWorldEngine.ts)
- [apps/web/src/services/worldEngine/getWorldEngine.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/services/worldEngine/getWorldEngine.ts)

`WorkspaceRoute` does not call the consistency engine directly. It delegates review work through `useWorkspaceConsistency`, which already depends on `WorldEngine` rather than a concrete implementation:

- [apps/web/src/hooks/useWorkspaceConsistency.ts](/Volumes/T7/Development/worldbuilding-desk/apps/web/src/hooks/useWorkspaceConsistency.ts)

That means the right place to add AI review is behind `WorldEngine`, not by adding a separate review path directly into `WorkspaceRoute` or the review drawer UI.

## What The UI Uses Today

Current workspace review behavior is driven almost entirely by:

- `validation.issues`
- `consistencyReviewItems`
- `reviewReadiness`

The review drawer and inline editor highlights currently care about issue presence, issue surface, and detection reasons. They do not yet have a first-class concept of:

- engine provenance
- AI confidence
- AI-generated summary text
- "deterministic vs AI-assisted" review state

## Seam Added In This Slice

`WorldEngineReviewResult` now carries `issueAnnotations`, with one annotation per validation issue. Deterministic review populates them with:

- `source: deterministic`
- `engineLabel: Deterministic review`
- confidence
- summary
- evidence span

`useWorkspaceConsistency` now threads that annotation onto each `consistencyReviewItem`.

This does not change current UI behavior. It creates a stable place for future AI review metadata to enter the system without changing the underlying guardrail flow.

## Recommended AI Review Contract

Near-term, AI review should not replace deterministic validation. It should enrich it.

Recommended layering:

1. Deterministic extraction and validation still run first.
2. AI review optionally annotates or expands the resulting issues.
3. The UI continues to display one review list, but items can show provenance and confidence when available.
4. Canon writes still go through deterministic acceptance flows.

The minimal future contract should look like:

```ts
interface WorldEngineReviewResult {
  proposal: ExtractedProposal;
  validation: ValidationResult;
  observations: ObservationProposal[];
  issueAnnotations: ReviewIssueAnnotation[];
}

interface ReviewIssueAnnotation {
  issueCode: GuardrailIssueCode;
  source: 'deterministic' | 'local-ai';
  engineLabel: string;
  confidence?: number;
  summary?: string;
  evidence?: {
    start: number;
    end: number;
    text: string;
  };
}
```

## Recommended First AI Slice

The first model-backed review slice should stay narrow:

- implement a second `WorldEngine` behind a feature flag
- keep deterministic `validation.issues` as the source of truth
- let AI provide only `issueAnnotations` and optional `observations`
- do not let AI directly create new issue codes or mutate canon/state

That gives the project one low-risk question to answer first:

"Does local/model-backed review make existing issues clearer or more useful to authors?"

## UI Entry Point Recommendation

Do not introduce a separate "AI Review" tab first.

The better first UI is:

- keep the existing `Project Review` surface
- optionally show annotation provenance on a review item:
  - `Deterministic review`
  - `Local AI review`
- optionally show a short AI summary when available

That keeps author mental load low and prevents the app from looking like it has two unrelated review systems.

## Current State

The first feature-flagged alternate `WorldEngine` implementation now exists.

Current behavior:

1. deterministic validation still produces the authoritative issue list
2. local review annotations can run through the `WorldEngine` boundary using Ollama
3. annotation provenance is surfaced in the review drawer
4. acceptance, linking, ignore, and world-record creation are unchanged
5. annotation requests now use issue-local excerpt windows instead of full-scene prompts
6. annotation requests fall back to deterministic output on timeout or unusable JSON

This proves the seam without turning review into a second competing workflow.

## Next Implementation Step

The next code slice should not deepen prompt complexity first. It should connect accepted future state-delta reviews to the new mutation ledger so the background review architecture starts producing durable, replayable project-state artifacts.
