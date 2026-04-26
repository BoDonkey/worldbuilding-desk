import type {
  ExtractProposalInput,
  ExtractedProposal,
  GuardrailIssue,
  ValidationResult
} from '../consistency';
import type {ProjectAISettings} from '../../entityTypes';
import {OllamaProvider} from '../llm/providers/ollama';
import {PROVIDER_DEFAULT_BASE_URLS} from '../llm/providerConfig';
import {
  ReviewIssueAnnotationSchema,
  ReviewClassificationSchema,
  WorldEngineStatusSchema
} from './types';
import type {
  ObservationProposal,
  ReviewClassification,
  ReviewClassificationInput,
  WorldEngine,
  WorldEngineReviewResult,
  WorldEngineStatus
} from './types';

const OLLAMA_FALLBACK_BASE_URL = PROVIDER_DEFAULT_BASE_URLS.ollama ?? 'http://localhost:11434';
const LOCAL_AI_REVIEW_TIMEOUT_MS = 12000;
const ISSUE_CONTEXT_RADIUS_CHARS = 220;
const ISSUE_CONTEXT_FALLBACK_WINDOW_CHARS = 420;

type LocalAiIssueResponse = {
  issueCode: ReviewClassification['issueCode'];
  confidence?: number;
  summary?: string;
  evidenceStart?: number | null;
  evidenceEnd?: number | null;
};

const clampConfidence = (value: number | undefined, fallback: number): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, value));
};

interface IssueContextWindow {
  excerptStart: number;
  excerptEnd: number;
  focusStart: number;
  focusEnd: number;
  excerptText: string;
}

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> => {
  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (typeof timeoutId === 'number') {
      window.clearTimeout(timeoutId);
    }
  }
};

const extractJsonArray = (raw: string): unknown[] | null => {
  const trimmed = raw.trim();
  const candidates = [
    trimmed,
    trimmed.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  ];
  for (const candidate of candidates) {
    const start = candidate.indexOf('[');
    const end = candidate.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) {
      continue;
    }
    try {
      const parsed = JSON.parse(candidate.slice(start, end + 1)) as unknown;
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Fall through to the next parsing strategy.
    }
  }
  return null;
};

const safeSnippet = (sourceText: string, issue: GuardrailIssue): string => {
  if (!issue.span) {
    return '';
  }
  return sourceText.slice(issue.span.start, issue.span.end);
};

const buildIssueContextWindow = (
  issue: GuardrailIssue,
  sourceText: string
): IssueContextWindow => {
  const length = sourceText.length;
  if (issue.span) {
    const excerptStart = Math.max(0, issue.span.start - ISSUE_CONTEXT_RADIUS_CHARS);
    const excerptEnd = Math.min(length, issue.span.end + ISSUE_CONTEXT_RADIUS_CHARS);
    return {
      excerptStart,
      excerptEnd,
      focusStart: issue.span.start - excerptStart,
      focusEnd: issue.span.end - excerptStart,
      excerptText: sourceText.slice(excerptStart, excerptEnd)
    };
  }

  const normalizedSurface = issue.surface?.trim().toLowerCase();
  if (normalizedSurface) {
    const matchIndex = sourceText.toLowerCase().indexOf(normalizedSurface);
    if (matchIndex >= 0) {
      const focusStart = matchIndex;
      const focusEnd = matchIndex + normalizedSurface.length;
      const excerptStart = Math.max(0, focusStart - ISSUE_CONTEXT_RADIUS_CHARS);
      const excerptEnd = Math.min(length, focusEnd + ISSUE_CONTEXT_RADIUS_CHARS);
      return {
        excerptStart,
        excerptEnd,
        focusStart: focusStart - excerptStart,
        focusEnd: focusEnd - excerptStart,
        excerptText: sourceText.slice(excerptStart, excerptEnd)
      };
    }
  }

  const excerptEnd = Math.min(length, ISSUE_CONTEXT_FALLBACK_WINDOW_CHARS);
  return {
    excerptStart: 0,
    excerptEnd,
    focusStart: 0,
    focusEnd: 0,
    excerptText: sourceText.slice(0, excerptEnd)
  };
};

const formatIssuePrompt = (
  issue: GuardrailIssue,
  sourceText: string
): Record<string, unknown> => {
  const contextWindow = buildIssueContextWindow(issue, sourceText);
  return {
    issueCode: issue.code,
    severity: issue.severity,
    message: issue.message,
    surface: issue.surface ?? null,
    detectionReason: issue.detectionReason ?? null,
    relatedEntities: issue.relatedEntities ?? [],
    sceneSpan: issue.span
      ? {
          start: issue.span.start,
          end: issue.span.end,
          text: safeSnippet(sourceText, issue)
        }
      : null,
    contextWindow: {
      excerptStart: contextWindow.excerptStart,
      excerptEnd: contextWindow.excerptEnd,
      focusStart: contextWindow.focusStart,
      focusEnd: contextWindow.focusEnd,
      excerptText: contextWindow.excerptText
    }
  };
};

interface ResolvedLocalModel {
  baseUrl: string;
  model: string;
}

export class LocalAiReviewWorldEngine implements WorldEngine {
  private readonly baseEngine: WorldEngine;
  private readonly baseUrl: string;
  private readonly configuredModel?: string;

  constructor(baseEngine: WorldEngine, settings?: ProjectAISettings | null) {
    this.baseEngine = baseEngine;
    this.baseUrl = settings?.configs?.ollama?.baseUrl?.trim() || OLLAMA_FALLBACK_BASE_URL;
    this.configuredModel = settings?.configs?.ollama?.model?.trim() || undefined;
  }

  async getStatus(): Promise<WorldEngineStatus> {
    const resolved = await this.resolveModel().catch((error) =>
      this.mapStatusError(error)
    );
    if ('state' in resolved) {
      return resolved;
    }
    return WorldEngineStatusSchema.parse({
      state: 'available',
      modelLabel: `Local AI review (${resolved.model})`
    });
  }

  async extractObservations(input: ExtractProposalInput): Promise<ObservationProposal[]> {
    return this.baseEngine.extractObservations(input);
  }

  async reviewText(input: ExtractProposalInput): Promise<WorldEngineReviewResult> {
    const baseResult = await this.baseEngine.reviewText(input);
    const generatedAnnotations = await this.generateIssueAnnotations(
      baseResult.validation.issues,
      baseResult.proposal.text
    );
    if (!generatedAnnotations) {
      return baseResult;
    }

    return {
      ...baseResult,
      issueAnnotations: generatedAnnotations
    };
  }

  async classifyReviewItem(
    input: ReviewClassificationInput
  ): Promise<ReviewClassification> {
    const baseClassification = await this.baseEngine.classifyReviewItem(input);
    const generatedAnnotations = await this.generateIssueAnnotations(
      [input.issue],
      input.sourceText
    );
    const annotation = generatedAnnotations?.[0];
    if (!annotation) {
      return baseClassification;
    }
    return ReviewClassificationSchema.parse({
      issueCode: annotation.issueCode,
      confidence: annotation.confidence ?? baseClassification.confidence,
      summary: annotation.summary ?? baseClassification.summary,
      evidence: annotation.evidence ?? baseClassification.evidence
    });
  }

  async applyAcceptedProposal(
    proposal: ExtractedProposal,
    validation: ValidationResult
  ): Promise<void> {
    await this.baseEngine.applyAcceptedProposal(proposal, validation);
  }

  private async generateIssueAnnotations(
    issues: GuardrailIssue[],
    sourceText: string
  ) {
    if (issues.length === 0) {
      return [];
    }

    const resolved = await this.resolveModel().catch(() => null);
    if (!resolved) {
      return null;
    }

    const baseAnnotations = await Promise.all(
      issues.map((issue) => this.baseEngine.classifyReviewItem({issue, sourceText}))
    );
    const provider = new OllamaProvider({
      baseUrl: resolved.baseUrl,
      model: resolved.model
    });

    try {
      const promptIssues = issues.map((issue) => formatIssuePrompt(issue, sourceText));
      const response = await withTimeout(
        provider.generateCompletion({
          messages: [
            {
              role: 'system',
              content:
                'You annotate deterministic lore review issues from small excerpt windows. Return strict JSON only. ' +
                'Do not invent new issue codes. Keep summaries neutral and brief. ' +
                'Use only the provided excerpt window, not assumptions about the rest of the scene. ' +
                'If the issue already looks correct, explain why it probably needs review rather than dismissing it.'
            },
            {
              role: 'user',
              content:
                `Analyze these review issues against their excerpt windows.\n` +
                `Return a JSON array with one object per issue in the same order.\n` +
                `Each object must have: issueCode, confidence, summary, evidenceStart, evidenceEnd.\n` +
                `evidenceStart and evidenceEnd must be offsets within excerptText, not the full scene.\n` +
                `Use null for evidenceStart/evidenceEnd if there is no strong span.\n\n` +
                `Issues:\n${JSON.stringify(promptIssues)}`
            }
          ],
          model: resolved.model,
          baseUrl: resolved.baseUrl,
          temperature: 0.2,
          maxTokens: Math.min(700, Math.max(220, issues.length * 140))
        }),
        LOCAL_AI_REVIEW_TIMEOUT_MS,
        `Local AI review (${resolved.model})`
      );

      const parsedArray = extractJsonArray(response.content);
      if (!parsedArray) {
        return null;
      }

      return issues.map((issue, index) => {
        const fallback = baseAnnotations[index];
        const candidate = (parsedArray[index] ?? {}) as LocalAiIssueResponse;
        const contextWindow = buildIssueContextWindow(issue, sourceText);
        const evidenceStart =
          typeof candidate.evidenceStart === 'number' ? candidate.evidenceStart : null;
        const evidenceEnd =
          typeof candidate.evidenceEnd === 'number' ? candidate.evidenceEnd : null;
        const hasValidEvidence =
          evidenceStart !== null &&
          evidenceEnd !== null &&
          evidenceStart >= 0 &&
          evidenceEnd >= evidenceStart &&
          evidenceEnd <= contextWindow.excerptText.length;

        return ReviewIssueAnnotationSchema.parse({
          issueCode:
            candidate.issueCode === issue.code ? candidate.issueCode : fallback.issueCode,
          source: 'local-ai',
          engineLabel: `Local AI review (${resolved.model})`,
          confidence: clampConfidence(candidate.confidence, fallback.confidence),
          summary: candidate.summary?.trim() || fallback.summary,
          evidence: hasValidEvidence
            ? {
                start: contextWindow.excerptStart + evidenceStart,
                end: contextWindow.excerptStart + evidenceEnd,
                text: contextWindow.excerptText.slice(evidenceStart, evidenceEnd)
              }
            : fallback.evidence
        });
      });
    } catch (error) {
      console.warn(
        `Local AI review annotations fell back to deterministic output for ${resolved.model}.`,
        error
      );
      return null;
    }
  }

  private async resolveModel(): Promise<ResolvedLocalModel> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/api/tags`);
    if (!response.ok) {
      throw new Error(`Ollama responded with ${response.status} ${response.statusText}.`);
    }
    const data = await response.json();
    const detectedModels = Array.isArray(data.models)
      ? data.models
          .map((entry: {name?: unknown}) =>
            typeof entry?.name === 'string' ? entry.name.trim() : ''
          )
          .filter(Boolean)
      : [];

    if (detectedModels.length === 0) {
      throw new Error('No Ollama models are installed.');
    }

    if (this.configuredModel) {
      if (!detectedModels.includes(this.configuredModel)) {
        throw new Error(
          `Configured Ollama model "${this.configuredModel}" is not installed.`
        );
      }
      return {
        baseUrl: this.baseUrl,
        model: this.configuredModel
      };
    }

    return {
      baseUrl: this.baseUrl,
      model: detectedModels[0]
    };
  }

  private mapStatusError(error: unknown): WorldEngineStatus {
    const message = error instanceof Error ? error.message : 'Ollama is unavailable.';
    if (
      message.includes('Failed to fetch') ||
      message.includes('NetworkError') ||
      message.includes('Load failed')
    ) {
      return WorldEngineStatusSchema.parse({state: 'notInstalled'});
    }

    if (message === 'No Ollama models are installed.') {
      return WorldEngineStatusSchema.parse({state: 'notInstalled'});
    }

    return WorldEngineStatusSchema.parse({
      state: 'installedUnavailable',
      reason: message
    });
  }
}
