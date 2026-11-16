// @vitest-environment jsdom

import {describe, expect, it} from 'vitest';
import type {
  CanonicalFact,
  Character,
  CharacterSheet,
  StateMutationEvent,
  StoredRuleset,
  WritingDocument
} from '../../entityTypes';
import {buildStateSubjects} from '../state/stateSubjects';
import type {ReviewIssueAnnotation} from '../worldEngine';
import {buildPlaceNameIndex} from '../worldBible/placePositions';
import {reviewScene, type SceneContinuityContext} from './sceneReview';
import type {GuardrailIssue} from './types';

const sera: Character = {
  id: 'sera',
  projectId: 'project-1',
  name: 'Sera Kestrel',
  fields: {},
  createdAt: 1,
  updatedAt: 1
};

const grayEyes: CanonicalFact = {
  id: 'fact-gray-eyes',
  projectId: 'project-1',
  targetType: 'character',
  targetId: sera.id,
  targetName: sera.name,
  factType: 'appearance',
  value: 'gray eyes',
  acceptedAt: 1,
  updatedAt: 1
};

const scene: WritingDocument = {
  id: 'scene-1',
  projectId: 'project-1',
  title: 'The Ledgerbound',
  content: '<p>Sera Kestrel met Harrison. Her green eyes caught the light.</p>',
  createdAt: 1,
  updatedAt: 1
};

const context: SceneContinuityContext = {
  entities: [],
  characters: [sera],
  canonicalFacts: [grayEyes],
  knownEntities: [{id: sera.id, name: sera.name, type: 'character'}],
  stateSubjects: [],
  actorResolutions: [],
  ruleset: null,
  stateMutationEvents: [],
  places: buildPlaceNameIndex({categories: [], entities: [], aliases: []})
};

const harrison: GuardrailIssue = {
  code: 'UNKNOWN_ENTITY',
  severity: 'blocking',
  message: "Entity 'Harrison' not found. Create it before saving.",
  surface: 'Harrison'
};

const annotation: ReviewIssueAnnotation = {
  issueCode: 'UNKNOWN_ENTITY',
  summary: 'Entity Harrison not found.',
  confidence: 0.9,
  evidence: {text: 'Harrison', start: 0, end: 8},
  source: 'deterministic',
  engineLabel: 'Deterministic review'
};

describe('reviewScene', () => {
  it('returns the name items and the canon contradiction for one scene', () => {
    const downgraded: GuardrailIssue = {...harrison, severity: 'warning'};
    const review = reviewScene({
      scene,
      sceneOrderDocuments: [scene],
      issues: [harrison],
      issueAnnotations: [annotation],
      presentedIssues: [downgraded],
      context
    });

    expect(review.issueItems).toEqual([
      {
        id: 'scene-1:UNKNOWN_ENTITY:harrison',
        sceneId: 'scene-1',
        sceneTitle: 'The Ledgerbound',
        issue: downgraded,
        reviewAnnotation: annotation
      }
    ]);
    expect(review.continuityItems).toHaveLength(1);
    expect(review.continuityItems[0]?.sceneId).toBe('scene-1');
    expect(review.continuityItems[0]?.issue.message).toContain('gray eyes');
  });

  it('leaves out continuity items the author dismissed', () => {
    const first = reviewScene({
      scene,
      sceneOrderDocuments: [scene],
      issues: [],
      issueAnnotations: [],
      presentedIssues: [],
      context
    });
    const dismissedId = first.continuityItems[0]?.id;
    expect(dismissedId).toBeDefined();

    const review = reviewScene({
      scene,
      sceneOrderDocuments: [scene],
      issues: [],
      issueAnnotations: [],
      presentedIssues: [],
      context,
      isDismissed: (id) => id === dismissedId
    });
    expect(review.issueItems).toEqual([]);
    expect(review.continuityItems).toEqual([]);
  });

  describe('state continuity reads the draft (3.56)', () => {
    const ruleset: StoredRuleset = {
      id: 'rules',
      projectId: 'project-1',
      name: 'Rules',
      version: '1',
      statDefinitions: [],
      resourceDefinitions: [],
      rules: [],
      itemTemplates: [],
      statusTemplates: [],
      createdAt: 1,
      updatedAt: 1
    };
    const sheet: CharacterSheet = {
      id: 'sheet-sera',
      projectId: 'project-1',
      characterEntityId: 'sera',
      name: 'Sera',
      level: 1,
      experience: 0,
      stats: [],
      resources: [],
      inventory: [],
      inventoryEntries: [{id: 'draught', mode: 'quick', name: 'Pale Draught', quantity: 1}],
      createdAt: 1,
      updatedAt: 1
    };
    const sceneAt = (order: number, title: string, content: string): WritingDocument => ({
      id: `scene-${order}`,
      projectId: 'project-1',
      title,
      content,
      order,
      createdAt: order,
      updatedAt: order
    });
    const drankEarlier: StateMutationEvent = {
      id: 'event-1',
      projectId: 'project-1',
      sceneId: 'scene-1',
      sceneTitle: 'The Salt Door',
      sceneOrder: 1,
      scenePosition: 10,
      sourceRevision: 1,
      sourceHash: 'hash-1',
      status: 'accepted',
      commands: [{type: 'inventory_consume', actorId: 'sera', itemName: 'Pale Draught'}],
      createdAt: 1
    };
    const stateContext: SceneContinuityContext = {
      entities: [],
      characters: [],
      canonicalFacts: [],
      knownEntities: [{id: 'sera', name: 'Sera', type: 'character'}],
      stateSubjects: buildStateSubjects({characterSheets: [sheet], characterEntities: []}),
      actorResolutions: [],
      ruleset,
      stateMutationEvents: [drankEarlier],
      places: buildPlaceNameIndex({categories: [], entities: [], aliases: []})
    };
    const first = sceneAt(1, 'The Salt Door', 'Sera drank the Pale Draught.');
    const savedSecond = sceneAt(2, 'The Second Draught', 'Sera waited by the door.');
    const drinksAgain = 'Sera drank the Pale Draught.';
    const review = (draft: WritingDocument, sceneOrderDocuments: WritingDocument[]) =>
      reviewScene({
        scene: draft,
        sceneOrderDocuments,
        issues: [],
        issueAnnotations: [],
        presentedIssues: [],
        context: stateContext
      }).continuityItems;

    it('flags a state problem in the edited draft, not the saved text', () => {
      const items = review({...savedSecond, content: drinksAgain}, [first, savedSecond]);
      expect(items).toHaveLength(1);
      expect(items[0]?.sceneId).toBe('scene-2');
      expect(items[0]?.issue).toMatchObject({code: 'INVALID_MUTATION'});
      expect(items[0]?.issue.message).toContain('The Salt Door');
    });

    it('clears a state problem the draft removed', () => {
      const savedWithProblem = {...savedSecond, content: drinksAgain};
      expect(review(savedSecond, [first, savedWithProblem])).toEqual([]);
    });

    it('reviews a scene that was never saved', () => {
      const items = review({...savedSecond, content: drinksAgain}, [first]);
      expect(items).toHaveLength(1);
      expect(items[0]?.sceneId).toBe('scene-2');
      expect(items[0]?.issue).toMatchObject({code: 'INVALID_MUTATION'});
    });
  });
});
