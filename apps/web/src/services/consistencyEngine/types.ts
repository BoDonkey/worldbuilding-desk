export type ProposalSource = 'workspace-save' | 'workspace-autosave' | 'import';

export interface ProposalEntityRef {
  surface: string;
  normalized: string;
  entityId?: string;
  entityType?: 'character' | 'entity';
  confidence: number;
  span: {
    start: number;
    end: number;
  };
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
