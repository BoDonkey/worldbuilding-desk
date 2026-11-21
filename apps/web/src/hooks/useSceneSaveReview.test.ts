// @vitest-environment jsdom
import {act, renderHook} from '@testing-library/react';
import {useState} from 'react';
import {describe, expect, it, vi} from 'vitest';
import type {CanonicalFact, Character, WritingDocument} from '../entityTypes';
import type {ConsistencyReviewItem} from '../services/consistency/reviewReadiness';
import type {SceneContinuityContext} from '../services/consistency/sceneReview';
import type {WorldEngine} from '../services/worldEngine';
import {buildPlaceNameIndex} from '../services/worldBible/placePositions';
import {useSceneSaveReview} from './useSceneSaveReview';

vi.mock('../services/storage', () => ({
  saveWritingDocument: vi.fn().mockResolvedValue(undefined),
  sortWritingDocuments: (docs: WritingDocument[]) => docs
}));

const sera: Character = {
  id: 'sera', projectId: 'project-1', name: 'Sera Kestrel', fields: {}, createdAt: 1, updatedAt: 1
};
const grayEyes: CanonicalFact = {
  id: 'fact-gray-eyes', projectId: 'project-1', targetType: 'character', targetId: sera.id,
  targetName: sera.name, factType: 'appearance', value: 'gray eyes', acceptedAt: 1, updatedAt: 1
};
const scene = (consistencyReviewMode?: 'deferred'): WritingDocument => ({
  id: 'scene-1', projectId: 'project-1', title: 'The Ledgerbound',
  content: '<p>Sera Kestrel met Harrison. Her green eyes caught the light.</p>',
  createdAt: 1, updatedAt: 1, consistencyReviewMode
});
const context: SceneContinuityContext = {
  entities: [], characters: [sera], canonicalFacts: [grayEyes],
  knownEntities: [{id: sera.id, name: sera.name, type: 'character'}],
  stateSubjects: [], actorResolutions: [], ruleset: null, stateMutationEvents: [],
  places: buildPlaceNameIndex({categories: [], entities: [], aliases: []})
};

const engine = (allowCommit: boolean) => ({
  reviewText: vi.fn().mockResolvedValue({
    proposal: {},
    observations: [],
    issueAnnotations: [],
    validation: {
      allowCommit,
      issues: allowCommit ? [] : [{
        code: 'UNKNOWN_ENTITY', severity: 'blocking',
        message: "Entity 'Harrison' not found.", surface: 'Harrison'
      }]
    }
  })
}) as unknown as WorldEngine;

const renderSave = (worldEngine: WorldEngine, doc: WritingDocument) =>
  renderHook(() => {
    const [items, setItems] = useState<ConsistencyReviewItem[]>([]);
    const persistDoc = useSceneSaveReview({
      // Not in the scene order, so the save derives no state changes.
      documents: [], setDocuments: vi.fn(), stateSubjects: [], actorResolutions: [],
      ruleset: null, stateMutationEvents: [], resolvedActionCues: [], worldEngine,
      ragService: null, shodhService: null, refreshMemories: vi.fn(),
      setSelectedCreatedAt: vi.fn(), setSaveStatus: vi.fn(), setLastSavedAt: vi.fn(),
      lastAutosaveErrorRef: {current: null}, knownConsistencyEntities: context.knownEntities,
      filterDismissedUnknownIssues: (_id, issues) => issues, setGuardrailIssues: vi.fn(),
      setConsistencyReviewItems: setItems, continuityContext: context,
      dismissedContinuityItemIdsRef: {current: new Set()}
    });
    return {items, save: () => persistDoc(doc, {
      source: 'workspace-save',
      consistencyMode: doc.consistencyReviewMode === 'deferred' ? 'balanced' : 'strict'
    })};
  });

describe('useSceneSaveReview', () => {
  it('keeps the canon contradiction beside the name items on a balanced save', async () => {
    const {result} = renderSave(engine(false), scene('deferred'));
    await act(async () => {
      await result.current.save();
    });
    const codes = result.current.items.map((item) => item.issue.code);
    expect(codes).toContain('UNKNOWN_ENTITY');
    expect(result.current.items.some((item) => item.issue.message.includes('gray eyes'))).toBe(true);
  });

  it('clears name items but keeps the contradiction after a clean strict save', async () => {
    const {result} = renderSave(engine(true), scene());
    await act(async () => {
      await result.current.save();
    });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]?.issue.message).toContain('gray eyes');
  });
});
