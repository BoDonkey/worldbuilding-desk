import {describe, expect, it} from 'vitest';
import {getWorkspaceReviewCopy} from './workspaceReviewCopy';

describe('getWorkspaceReviewCopy', () => {
  it('uses world wording for general fiction', () => {
    const copy = getWorkspaceReviewCopy({isGeneralFiction: true, hasBlockingIssues: true});
    expect(copy.bannerTitle).toBe('This scene has names or places to review before strict save.');
    expect(copy.createLabel).toBe('Add to World');
    expect(copy.dismissAllLabel).toBe('Ignore all for now');
    expect(copy.linkLabel).toBe('Connect to existing');
  });

  it('uses record wording otherwise, and softer dismiss wording when nothing blocks', () => {
    const blocking = getWorkspaceReviewCopy({isGeneralFiction: false, hasBlockingIssues: true});
    expect(blocking.bannerTitle).toBe('This scene has detected references to review before strict save.');
    expect(blocking.createAllLabel).toBe('Create all as new records');
    expect(blocking.dismissAllLabel).toBe('Dismiss all for now');
    const warnings = getWorkspaceReviewCopy({isGeneralFiction: false, hasBlockingIssues: false});
    expect(warnings.bannerTitle).toBe('Project review found detected references in this scene.');
    expect(warnings.dismissAllLabel).toBe('Hide all warnings for now');
    expect(warnings.popoverMessage).toBe('Choose how to handle this detected reference.');
  });
});
