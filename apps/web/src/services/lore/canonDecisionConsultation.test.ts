import {describe, expect, it} from 'vitest';
import type {CanonDecisionCluster, LoreDocument, LoreEntityProposal} from '../../entityTypes';
import {buildCanonDecisionConsultationPrompt} from './canonDecisionConsultation';

const cluster: CanonDecisionCluster = {
  id: 'cluster-1',
  projectId: 'project-1',
  kind: 'entity_identity',
  title: 'Is the Tallow Guild new?',
  summary: 'One candidate, no match.',
  memberRefs: [],
  status: 'open',
  reasonCodes: ['no_match'],
  createdAt: 1,
  updatedAt: 1
};

const entityProposal: LoreEntityProposal = {
  id: 'proposal-1',
  projectId: 'project-1',
  loreDocumentId: 'note-1',
  name: 'Tallow Guild',
  entityKind: 'faction',
  confidence: 0.7,
  evidence: {start: 0, end: 12, text: 'Tallow Guild'},
  status: 'proposed',
  createdAt: 1,
  updatedAt: 1
};

const note = (source: LoreDocument['source']): LoreDocument => ({
  id: 'note-1',
  projectId: 'project-1',
  title: 'Guild ideas',
  kind: 'faction_notes',
  format: 'plain_text',
  content: 'Tallow Guild',
  source,
  status: 'active',
  createdAt: 1,
  updatedAt: 1
});

describe('buildCanonDecisionConsultationPrompt', () => {
  it('tells the model when the evidence comes from a note saved from an AI session', () => {
    const {userPrompt} = buildCanonDecisionConsultationPrompt({
      cluster,
      entityProposal,
      sourceDocument: note({type: 'ai-session', sessionId: 's'})
    });
    expect(userPrompt).toContain(
      '- Source lore document: Guild ideas (saved from an AI session, may be model-written)\n'
    );
  });

  it('names a note the author typed by its title alone', () => {
    const {userPrompt} = buildCanonDecisionConsultationPrompt({
      cluster,
      entityProposal,
      sourceDocument: note({type: 'manual'})
    });
    expect(userPrompt).toContain('- Source lore document: Guild ideas\n');
    expect(buildCanonDecisionConsultationPrompt({cluster, entityProposal}).userPrompt).toContain(
      '- Source lore document: Unknown\n'
    );
  });
});
