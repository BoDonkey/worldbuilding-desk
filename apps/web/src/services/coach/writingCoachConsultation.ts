import type {CraftCitation, CraftSearchResult} from '../craft/types';
import type {LLMContextChunk} from '../llm/types';
import type {StoryDashboard} from '../dashboard/storyDashboard';

/**
 * The writing coach has exactly two entry points, and they must stay
 * distinct: `selection`/`scene` are the inline, prose-scoped ask ("is this
 * passage doing the thing"); `manuscript` is the dashboard's structural ask
 * ("does this book have the shape"), built only from deterministic
 * measurements, never raw scene prose. Mixing them lets the inline path
 * drift toward slow, vague whole-manuscript analysis.
 */
export type WritingCoachScope = 'selection' | 'scene' | 'manuscript';

const SCOPE_DESCRIPTIONS: Record<WritingCoachScope, string> = {
  selection: 'the selected passage below',
  scene: 'the current scene below',
  manuscript: 'aggregate, deterministic measurements of the whole manuscript below (not the full prose)'
};

export const WRITING_COACH_TRUST_INSTRUCTIONS =
  'Writing coach rules:\n' +
  '- The craft reference material provided as context is instructional background: never the ' +
  "author's canon, and never proof the manuscript contains or lacks anything beyond what the " +
  'evidence below actually shows.\n' +
  '- Only discuss what is present in the evidence given below. Never claim to have read or ' +
  'checked any other part of the manuscript.\n' +
  '- Pair every craft point with a specific, quoted or clearly identified piece of that evidence.\n' +
  '- If a retrieved craft pattern does not genuinely apply at this scope, skip it rather than ' +
  'forcing a fit.\n' +
  '- This is advice, not an instruction. Never say the manuscript must change; the author decides.';

/** Query text for craft library retrieval. Capped well below prompt limits — this is a search
 * query, not the evidence itself, which is passed through in full separately. */
export function buildCraftLibrarySearchQuery(evidenceText: string): string {
  return evidenceText.trim().slice(0, 600);
}

export function buildWritingCoachPrompt(params: {
  scope: WritingCoachScope;
  evidenceLabel: string;
  evidenceText: string;
}): {systemPrompt: string; userPrompt: string} {
  const {scope, evidenceLabel, evidenceText} = params;

  const systemPrompt =
    'You are a writing coach for fiction authors, grounded only in the craft reference material ' +
    'given as context and the evidence provided below. Your job is to teach craft patterns the ' +
    "author may not already know, and show concretely where their own draft does or doesn't show " +
    'the pattern. You are not deciding anything about their story - the author decides. Be ' +
    'concrete and concise.\n\n' +
    WRITING_COACH_TRUST_INSTRUCTIONS;

  const userPrompt =
    `Scope: ${SCOPE_DESCRIPTIONS[scope]}\n\n` +
    `${evidenceLabel}:\n${evidenceText}\n\n` +
    'Task:\n' +
    'Using the craft reference material as instruction and the evidence above as the only ' +
    'manuscript evidence you have, identify one to three specific craft observations. For each: ' +
    'name the pattern, point to where the evidence does or does not show it, and suggest one ' +
    'concrete revision experiment the author could try. If the evidence is too short or unclear ' +
    'to say anything specific, say so rather than guessing.';

  return {systemPrompt, userPrompt};
}

export function buildCraftContextChunks(results: CraftSearchResult[]): LLMContextChunk[] {
  return results.map((result) => ({
    content: `${result.chunk.title} (${result.chunk.section}):\n${result.chunk.content}`,
    source: `Craft reference material, not your canon - ${result.chunk.title}`,
    relevance: result.score
  }));
}

export function dedupeCraftCitations(results: CraftSearchResult[]): CraftCitation[] {
  const byId = new Map<string, CraftCitation>();
  for (const result of results) {
    for (const citation of result.chunk.metadata.citations) {
      if (!byId.has(citation.id)) byId.set(citation.id, citation);
    }
  }
  return [...byId.values()];
}

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

/**
 * Deterministic-only summary of the dashboard's own measurements, used as
 * the manuscript-scope coach's evidence. Never includes raw scene prose.
 */
export function summarizeStoryDashboardForCoach(dashboard: StoryDashboard): string {
  const lines: string[] = [];
  lines.push(
    `Manuscript: ${dashboard.scenes.length} scene(s), ${dashboard.totalWords} words, ` +
      `${formatPercent(dashboard.dialogueRatio)} dialogue, ${dashboard.acceptedEventCount} accepted ` +
      `continuity event(s) totaling ${dashboard.acceptedCommandCount} recorded change(s).`
  );

  if (dashboard.chapters.length > 0) {
    lines.push('Chapters (explicit links only):');
    for (const chapter of dashboard.chapters) {
      lines.push(
        `- "${chapter.title}" (${chapter.status}): ${chapter.wordCount} words, ` +
          `${formatPercent(chapter.dialogueRatio)} dialogue, ${chapter.acceptedChangeCount} accepted change(s).`
      );
    }
  }

  if (dashboard.stateDistribution.length > 0) {
    lines.push('Continuity change distribution:');
    for (const metric of dashboard.stateDistribution) {
      lines.push(
        `- ${metric.category}: ${metric.commandCount} change(s) across ${metric.eventCount} accepted event(s).`
      );
    }
  }

  if (dashboard.mechanics) {
    const mechanics = dashboard.mechanics;
    lines.push(
      `Mechanics: ${mechanics.axes.length} tracked axis/axes changed, ` +
        `${mechanics.advancementChangeCount} advancement change(s), rate ` +
        `${mechanics.advancementChangesPerTenThousandWords === null ? 'unavailable' : `${mechanics.advancementChangesPerTenThousandWords.toFixed(1)} / 10k words`}.`
    );
    if (mechanics.coMovements.length > 0) {
      lines.push(`${mechanics.coMovements.length} scene(s) change two or more tracked axes together.`);
    }
  }

  return lines.join('\n');
}
