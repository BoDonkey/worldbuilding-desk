export type ProposalSource = 'workspace-save' | 'workspace-autosave' | 'import';

export type CandidateDetectionReason =
  | 'known_entity'
  | 'titled_name'
  | 'repeated_unknown'
  | 'leading_entity_cue'
  | 'character_context_candidate'
  | 'multiword_proper_candidate'
  | 'action_object_candidate';

export interface ProposalEntityRef {
  surface: string;
  normalized: string;
  entityId?: string;
  entityType?: 'character' | 'entity';
  entityName?: string;
  candidateEntities?: Array<{
    id: string;
    name: string;
    type: 'character' | 'entity';
  }>;
  confidence: number;
  span: {
    start: number;
    end: number;
  };
  detectionReason: CandidateDetectionReason;
}

export interface ExtractedProposal {
  id: string;
  projectId: string;
  source: ProposalSource;
  text: string;
  entities: ProposalEntityRef[];
  intents: Array<Record<string, never>>;
  unresolvedSpans: Array<{
    start: number;
    end: number;
  }>;
  createdAt: number;
}

export type GuardrailIssueCode =
  | 'UNKNOWN_ENTITY'
  | 'AMBIGUOUS_REFERENCE'
  | 'UNEXPECTED_SCENE_PRESENCE'
  | 'STATE_CONFLICT'
  | 'INVALID_MUTATION';

export interface GuardrailIssue {
  code: GuardrailIssueCode;
  severity: 'blocking' | 'warning';
  message: string;
  span?: {
    start: number;
    end: number;
  };
  surface?: string;
  detectionReason?: CandidateDetectionReason;
  confidence?: number;
  relatedEntities?: Array<{
    id: string;
    name: string;
    type: 'character' | 'entity';
  }>;
}

export interface ValidationResult {
  allowCommit: boolean;
  issues: GuardrailIssue[];
  proposedMutations: Array<Record<string, never>>;
}

export interface KnownEntityRef {
  id: string;
  name: string;
  type: 'character' | 'entity';
}

export interface ExtractProposalInput {
  projectId: string;
  text: string;
  source: ProposalSource;
  knownEntities: KnownEntityRef[];
  actionCues?: string[];
}
