import {describe, expect, it} from 'vitest';
import type {WritingDocument} from '../entityTypes';
import {
  buildWorkspaceEditorDocument,
  getWorkspaceAutosaveConsistencyMode,
  getWorkspaceManualSaveConsistencyMode,
  hasWorkspaceDocumentChanges,
  resolveWorkspaceDocumentInitialization
} from './useWorkspaceDocuments';

const makeDocument = (id: string): WritingDocument => ({
  id,
  projectId: 'project-a',
  title: `Scene ${id}`,
  content: `<p>${id}</p>`,
  createdAt: 1,
  updatedAt: 1
});

describe('resolveWorkspaceDocumentInitialization', () => {
  const first = makeDocument('first');
  const second = makeDocument('second');
  const documents = [first, second];

  it('clears editor state when no project is active', () => {
    expect(
      resolveWorkspaceDocumentInitialization({
        hasActiveProject: false,
        documents,
        selectedId: 'first',
        initializedSelectedId: 'first'
      })
    ).toEqual({type: 'clear'});
  });

  it('resets editor state when the active project has no documents', () => {
    expect(
      resolveWorkspaceDocumentInitialization({
        hasActiveProject: true,
        documents: [],
        selectedId: 'missing',
        initializedSelectedId: 'missing'
      })
    ).toEqual({type: 'reset-empty'});
  });

  it('keeps the editor unchanged when the selected document is already initialized', () => {
    expect(
      resolveWorkspaceDocumentInitialization({
        hasActiveProject: true,
        documents,
        selectedId: 'second',
        initializedSelectedId: 'second'
      })
    ).toEqual({type: 'none'});
  });

  it('initializes the persisted selected document when it exists', () => {
    expect(
      resolveWorkspaceDocumentInitialization({
        hasActiveProject: true,
        documents,
        selectedId: 'second',
        initializedSelectedId: null
      })
    ).toEqual({type: 'initialize', document: second});
  });

  it('falls back to the first document when the selected id is stale', () => {
    expect(
      resolveWorkspaceDocumentInitialization({
        hasActiveProject: true,
        documents,
        selectedId: 'missing',
        initializedSelectedId: 'first'
      })
    ).toEqual({type: 'initialize', document: first});
  });
});

describe('buildWorkspaceEditorDocument', () => {
  it('trims titles and falls back to Untitled scene', () => {
    expect(
      buildWorkspaceEditorDocument({
        projectId: 'project-a',
        selectedId: 'scene-a',
        selectedCreatedAt: null,
        title: '   ',
        content: '<p>Draft</p>',
        existingDocument: null,
        now: 20
      })
    ).toMatchObject({
      id: 'scene-a',
      projectId: 'project-a',
      title: 'Untitled scene',
      content: '<p>Draft</p>'
    });

    expect(
      buildWorkspaceEditorDocument({
        projectId: 'project-a',
        selectedId: 'scene-a',
        selectedCreatedAt: null,
        title: '  Chapter One  ',
        content: '<p>Draft</p>',
        existingDocument: null,
        now: 20
      }).title
    ).toBe('Chapter One');
  });

  it('preserves selected creation time and existing consistency mode', () => {
    const existingDocument: WritingDocument = {
      ...makeDocument('scene-a'),
      consistencyReviewMode: 'deferred',
      createdAt: 5
    };

    expect(
      buildWorkspaceEditorDocument({
        projectId: 'project-a',
        selectedId: 'scene-a',
        selectedCreatedAt: 5,
        title: 'Scene A revised',
        content: '<p>Revision</p>',
        existingDocument,
        now: 20
      })
    ).toEqual({
      id: 'scene-a',
      projectId: 'project-a',
      title: 'Scene A revised',
      content: '<p>Revision</p>',
      consistencyReviewMode: 'deferred',
      createdAt: 5,
      updatedAt: 20
    });
  });

  it('defaults creation time and consistency mode for new editor documents', () => {
    expect(
      buildWorkspaceEditorDocument({
        projectId: 'project-a',
        selectedId: 'scene-a',
        selectedCreatedAt: null,
        title: 'Scene A',
        content: '<p>Draft</p>',
        existingDocument: null,
        now: 20
      })
    ).toEqual({
      id: 'scene-a',
      projectId: 'project-a',
      title: 'Scene A',
      content: '<p>Draft</p>',
      consistencyReviewMode: 'default',
      createdAt: 20,
      updatedAt: 20
    });
  });
});

describe('hasWorkspaceDocumentChanges', () => {
  const existingDocument: WritingDocument = {
    ...makeDocument('scene-a'),
    title: 'Scene A',
    content: '<p>Draft</p>'
  };

  it('treats missing existing documents as changed', () => {
    expect(hasWorkspaceDocumentChanges(null, existingDocument)).toBe(true);
  });

  it('returns false when title and content match', () => {
    expect(hasWorkspaceDocumentChanges(existingDocument, existingDocument)).toBe(
      false
    );
  });

  it('detects title changes', () => {
    expect(
      hasWorkspaceDocumentChanges(existingDocument, {
        ...existingDocument,
        title: 'Scene A revised'
      })
    ).toBe(true);
  });

  it('detects content changes', () => {
    expect(
      hasWorkspaceDocumentChanges(existingDocument, {
        ...existingDocument,
        content: '<p>Revision</p>'
      })
    ).toBe(true);
  });
});

describe('workspace save consistency modes', () => {
  it('uses balanced mode for deferred manual saves', () => {
    expect(
      getWorkspaceManualSaveConsistencyMode({consistencyReviewMode: 'deferred'})
    ).toBe('balanced');
  });

  it('uses strict mode for default manual saves', () => {
    expect(
      getWorkspaceManualSaveConsistencyMode({consistencyReviewMode: 'default'})
    ).toBe('strict');
  });

  it('uses balanced mode for deferred autosaves', () => {
    expect(
      getWorkspaceAutosaveConsistencyMode({consistencyReviewMode: 'deferred'})
    ).toBe('balanced');
  });

  it('uses lenient mode for default autosaves', () => {
    expect(
      getWorkspaceAutosaveConsistencyMode({consistencyReviewMode: 'default'})
    ).toBe('lenient');
  });
});
