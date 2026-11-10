/**
 * The words the Workspace uses for project review: the banner above the
 * editor, the review popover, and the Review tab's actions. General fiction
 * talks about "your world" and plain actions; other projects talk about
 * detected references and records.
 */
export interface WorkspaceReviewCopy {
  bannerTitle: string;
  bannerBody: string;
  createLabel: string;
  createAllLabel: string;
  dismissAllLabel: string;
  linkLabel: string;
  popoverMessage: string;
}

export function getWorkspaceReviewCopy({
  isGeneralFiction,
  hasBlockingIssues
}: {
  isGeneralFiction: boolean;
  /** Unknown names that strict save would stop on. */
  hasBlockingIssues: boolean;
}): WorkspaceReviewCopy {
  return {
    bannerTitle: hasBlockingIssues
      ? isGeneralFiction
        ? 'This scene has names or places to review before strict save.'
        : 'This scene has detected references to review before strict save.'
      : isGeneralFiction
        ? 'Project review found names or places in this scene.'
        : 'Project review found detected references in this scene.',
    bannerBody: isGeneralFiction
      ? 'Click an underline in the editor to add it to your world, connect it to something existing, or ignore it for now.'
      : 'Click an underline in the editor to add it to the world, connect it to an existing record, or ignore it for now.',
    createLabel: isGeneralFiction ? 'Add to World' : 'Create record',
    createAllLabel: isGeneralFiction ? 'Add all to World' : 'Create all as new records',
    dismissAllLabel: isGeneralFiction
      ? 'Ignore all for now'
      : hasBlockingIssues
        ? 'Dismiss all for now'
        : 'Hide all warnings for now',
    linkLabel: isGeneralFiction ? 'Connect to existing' : 'Link alias',
    popoverMessage: isGeneralFiction
      ? 'Add this to your world, connect it to something you already track, or ignore it for now.'
      : 'Choose how to handle this detected reference.'
  };
}
