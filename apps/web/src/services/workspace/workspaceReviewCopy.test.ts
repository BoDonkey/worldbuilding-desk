import {describe, expect, it} from 'vitest';
import {getWorkspaceReviewCopy, summarizeReviewSurfaces} from './workspaceReviewCopy';

describe('getWorkspaceReviewCopy', () => {
  it('uses world wording for general fiction', () => {
    const copy = getWorkspaceReviewCopy({usesPlainReviewLanguage: true, hasBlockingIssues: true});
    expect(copy.bannerTitle).toBe('This scene has names or places to review before strict save.');
    expect(copy.createLabel).toBe('Add to World');
    expect(copy.dismissAllLabel).toBe('Ignore all for now');
    expect(copy.linkLabel).toBe('Connect to existing');
  });

  it('uses record wording otherwise, and softer dismiss wording when nothing blocks', () => {
    const blocking = getWorkspaceReviewCopy({usesPlainReviewLanguage: false, hasBlockingIssues: true});
    expect(blocking.bannerTitle).toBe('This scene has detected references to review before strict save.');
    expect(blocking.createAllLabel).toBe('Create all as new records');
    expect(blocking.dismissAllLabel).toBe('Dismiss all for now');
    const warnings = getWorkspaceReviewCopy({usesPlainReviewLanguage: false, hasBlockingIssues: false});
    expect(warnings.bannerTitle).toBe('Project review found detected references in this scene.');
    expect(warnings.dismissAllLabel).toBe('Hide all warnings for now');
    expect(warnings.popoverMessage).toBe('Choose how to handle this detected reference.');
  });
});

describe('summarizeReviewSurfaces', () => {
  it('lists the first names and counts the rest, including ones without a name', () => {
    const issues = [
      {surface: ' Vel '}, {surface: ''}, {surface: 'Orrin'}, {}, {surface: 'Kest'}
    ];
    expect(summarizeReviewSurfaces(issues, 2)).toEqual({
      visible: ['Vel', 'Orrin'],
      hiddenCount: 3
    });
  });
});
