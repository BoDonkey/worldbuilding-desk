import {z} from 'zod';
import type {
  ExtractProposalInput,
  ExtractedProposal,
  GuardrailIssue,
  ValidationResult
} from '../consistency';

export const WorldEngineStatusSchema = z.discriminatedUnion('state', [
  z.object({state: z.literal('notInstalled')}),
  z.object({
    state: z.literal('installedUnavailable'),
    reason: z.string().min(1)
  }),
  z.object({
    state: z.literal('available'),
    modelLabel: z.string().min(1)
  })
]);

export type WorldEngineStatus = z.infer<typeof WorldEngineStatusSchema>;

const EvidenceSpanSchema = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  text: z.string()
});

export const EntityObservationProposalSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  type: z.literal('entity_candidate'),
  surface: z.string().min(1),
  normalized: z.string().min(1),
  resolvedEntity: z
    .object({
      id: z.string().min(1),
      type: z.enum(['character', 'entity'])
    })
    .optional(),
  candidateEntities: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        type: z.enum(['character', 'entity'])
      })
    )
    .optional(),
  confidence: z.number().min(0).max(1),
  evidence: EvidenceSpanSchema,
  createdAt: z.number().int().nonnegative()
});

export const StateDeltaObservationProposalSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  type: z.literal('state_delta_candidate'),
  operation: z.enum([
    'inventory_add',
    'inventory_remove',
    'inventory_consume',
    'inventory_equip',
    'inventory_unequip',
    'location_set',
    'status_apply',
    'status_remove',
    'stat_change',
    'stat_set',
    'resource_change',
    'resource_set'
  ]),
  actor: z.string().min(1).optional(),
  target: z.string().min(1).optional(),
  stat: z.string().min(1).optional(),
  amount: z.number().optional(),
  confidence: z.number().min(0).max(1),
  evidence: EvidenceSpanSchema,
  createdAt: z.number().int().nonnegative()
});

export const ObservationProposalSchema = z.discriminatedUnion('type', [
  EntityObservationProposalSchema,
  StateDeltaObservationProposalSchema
]);

export type ObservationProposal = z.infer<typeof ObservationProposalSchema>;

export const ReviewClassificationSchema = z.object({
  issueCode: z.enum([
    'UNKNOWN_ENTITY',
    'AMBIGUOUS_REFERENCE',
    'STATE_CONFLICT',
    'INVALID_MUTATION'
  ]),
  confidence: z.number().min(0).max(1),
  summary: z.string().min(1),
  evidence: EvidenceSpanSchema.optional()
});

export type ReviewClassification = z.infer<typeof ReviewClassificationSchema>;

export interface ReviewClassificationInput {
  issue: GuardrailIssue;
  sourceText: string;
}

export const ReviewIssueAnnotationSchema = z.object({
  issueCode: z.enum([
    'UNKNOWN_ENTITY',
    'AMBIGUOUS_REFERENCE',
    'STATE_CONFLICT',
    'INVALID_MUTATION'
  ]),
  source: z.enum(['deterministic', 'local-ai']),
  engineLabel: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  summary: z.string().min(1).optional(),
  evidence: EvidenceSpanSchema.optional()
});

export type ReviewIssueAnnotation = z.infer<typeof ReviewIssueAnnotationSchema>;

export interface WorldEngineReviewResult {
  proposal: ExtractedProposal;
  validation: ValidationResult;
  observations: ObservationProposal[];
  issueAnnotations: ReviewIssueAnnotation[];
}

export interface WorldEngine {
  getStatus(): Promise<WorldEngineStatus>;
  extractObservations(input: ExtractProposalInput): Promise<ObservationProposal[]>;
  reviewText(input: ExtractProposalInput): Promise<WorldEngineReviewResult>;
  classifyReviewItem(input: ReviewClassificationInput): Promise<ReviewClassification>;
  applyAcceptedProposal(
    proposal: ExtractedProposal,
    validation: ValidationResult
  ): Promise<void>;
}
