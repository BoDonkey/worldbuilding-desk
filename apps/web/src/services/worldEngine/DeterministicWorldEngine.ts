import type {
  ConsistencyEngineService,
  ExtractProposalInput,
  ExtractedProposal,
  GuardrailIssue,
  ValidationResult
} from '../consistency';
import {
  ObservationProposalSchema,
  ReviewIssueAnnotationSchema,
  ReviewClassificationSchema,
  WorldEngineStatusSchema
} from './types';
import type {
  ObservationProposal,
  ReviewIssueAnnotation,
  ReviewClassification,
  ReviewClassificationInput,
  WorldEngine,
  WorldEngineReviewResult,
  WorldEngineStatus
} from './types';

const makeObservationId = (
  proposal: ExtractedProposal,
  index: number,
  start: number,
  end: number
): string => `${proposal.id}:entity:${index}:${start}:${end}`;

function mapProposalToObservations(proposal: ExtractedProposal): ObservationProposal[] {
  return proposal.entities.map((entity, index) => {
    const observation = {
      id: makeObservationId(proposal, index, entity.span.start, entity.span.end),
      projectId: proposal.projectId,
      type: 'entity_candidate' as const,
      surface: entity.surface,
      normalized: entity.normalized,
      resolvedEntity: entity.entityId && entity.entityType
        ? {
            id: entity.entityId,
            type: entity.entityType
          }
        : undefined,
      candidateEntities: entity.candidateEntities,
      confidence: entity.confidence,
      evidence: {
        start: entity.span.start,
        end: entity.span.end,
        text: proposal.text.slice(entity.span.start, entity.span.end)
      },
      createdAt: proposal.createdAt
    };
    return ObservationProposalSchema.parse(observation);
  });
}

function classifyIssue(issue: GuardrailIssue, sourceText: string): ReviewClassification {
  const evidence = issue.span
    ? {
        start: issue.span.start,
        end: issue.span.end,
        text: sourceText.slice(issue.span.start, issue.span.end)
      }
    : undefined;
  const classification = {
    issueCode: issue.code,
    confidence: issue.code === 'UNKNOWN_ENTITY' ? 0.86 : 0.78,
    summary: issue.message,
    evidence
  };
  return ReviewClassificationSchema.parse(classification);
}

function annotateIssue(
  issue: GuardrailIssue,
  sourceText: string
): ReviewIssueAnnotation {
  const classification = classifyIssue(issue, sourceText);
  return ReviewIssueAnnotationSchema.parse({
    issueCode: classification.issueCode,
    source: 'deterministic',
    engineLabel: 'Deterministic review',
    confidence: classification.confidence,
    summary: classification.summary,
    evidence: classification.evidence
  });
}

export class DeterministicWorldEngine implements WorldEngine {
  private readonly consistencyEngine: ConsistencyEngineService;

  constructor(consistencyEngine: ConsistencyEngineService) {
    this.consistencyEngine = consistencyEngine;
  }

  async getStatus(): Promise<WorldEngineStatus> {
    return WorldEngineStatusSchema.parse({
      state: 'available',
      modelLabel: 'Deterministic review'
    });
  }

  async extractObservations(input: ExtractProposalInput): Promise<ObservationProposal[]> {
    const proposal = await this.consistencyEngine.extractProposal(input);
    return mapProposalToObservations(proposal);
  }

  async reviewText(input: ExtractProposalInput): Promise<WorldEngineReviewResult> {
    const proposal = await this.consistencyEngine.extractProposal(input);
    const validation = await this.consistencyEngine.validateProposal(proposal);
    const observations = mapProposalToObservations(proposal);
    const issueAnnotations = validation.issues.map((issue) =>
      annotateIssue(issue, proposal.text)
    );
    return {
      proposal,
      validation,
      observations,
      issueAnnotations
    };
  }

  async classifyReviewItem(
    input: ReviewClassificationInput
  ): Promise<ReviewClassification> {
    return classifyIssue(input.issue, input.sourceText);
  }

  async applyAcceptedProposal(
    proposal: ExtractedProposal,
    validation: ValidationResult
  ): Promise<void> {
    await this.consistencyEngine.applyProposal(proposal, validation);
  }
}
