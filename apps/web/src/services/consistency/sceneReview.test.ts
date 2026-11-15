// @vitest-environment jsdom

import {describe, expect, it} from 'vitest';
import type {CanonicalFact, Character, WritingDocument} from '../../entityTypes';
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
});
