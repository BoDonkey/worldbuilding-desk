import {fireEvent, render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router';
import {describe, expect, it, vi} from 'vitest';
import type {EntityCategory} from '../../entityTypes';
import type {ConsistencyReviewItem} from '../../services/consistency/reviewReadiness';
import {WorkspaceReviewIssueItem, type WorkspaceReviewIssueItemProps} from './WorkspaceReviewIssueItem';

const category = (id: string, name: string, kind: EntityCategory['kind']): EntityCategory => ({
  id,
  projectId: 'project-1',
  kind,
  name,
  slug: name.toLowerCase().replace(/\s+/g, '-'),
  fieldSchema: [],
  createdAt: 1
});

// A character category named without any of the old hint words, and a general
// category whose name has one ("people").
const HEROES = category('heroes', 'Heroes', 'character');
const PEOPLES = category('peoples', 'Peoples of the North', 'general');

const item: ConsistencyReviewItem = {
  id: 'item-1',
  sceneId: 'scene-1',
  sceneTitle: 'Scene One',
  issue: {
    code: 'UNKNOWN_ENTITY',
    severity: 'warning',
    message: 'Unknown name: Sera Kestrel',
    surface: 'Sera Kestrel'
  } as ConsistencyReviewItem['issue']
};

const renderItem = (selectedCategoryId: string) => {
  const resolveUnknownEntity = vi.fn(async () => undefined);
  const consistency = {
    unknownCategorySelection: {'Sera Kestrel': selectedCategoryId},
    setUnknownCategorySelection: vi.fn(),
    getSuggestedUnknownCategoryId: () => '',
    unknownLinkSelection: {},
    setUnknownLinkSelection: vi.fn(),
    unknownLinkOptions: [],
    createWorldCategory: vi.fn(),
    resolveUnknownEntity,
    resolvingUnknown: null,
    dismissUnknownEntity: vi.fn(),
    ignoreUnknownSurfaceProjectWide: vi.fn(),
    linkUnknownEntity: vi.fn(),
    linkingUnknown: null,
    dismissConsistencyReviewItem: vi.fn()
  } as unknown as WorkspaceReviewIssueItemProps['consistency'];
  render(
    <MemoryRouter>
      <ul>
        <WorkspaceReviewIssueItem
          item={item}
          consistency={consistency}
          categories={[HEROES, PEOPLES]}
          isActive
          isExpanded
          activeItemRef={null}
          onShowContext={vi.fn()}
          createLabel='Create'
          linkLabel='Link'
          worldCaptureDrafts={{}}
          setWorldCaptureDrafts={vi.fn()}
          rejectedAliasSuggestions={{}}
          setRejectedAliasSuggestions={vi.fn()}
          openWorldRecord={vi.fn()}
        />
      </ul>
    </MemoryRouter>
  );
  return {resolveUnknownEntity};
};

describe('WorkspaceReviewIssueItem character capture', () => {
  it('offers and saves aliases for a character category, whatever it is called', () => {
    const {resolveUnknownEntity} = renderItem(HEROES.id);
    expect(screen.getByLabelText('Suggested aliases')).toHaveTextContent('Sera');
    fireEvent.click(screen.getByRole('button', {name: 'Create character'}));
    expect(resolveUnknownEntity).toHaveBeenCalledWith('Sera Kestrel', HEROES.id, 'Sera Kestrel', ['Sera']);
  });

  it('saves no aliases for a general category whose name contains "people"', () => {
    const {resolveUnknownEntity} = renderItem(PEOPLES.id);
    expect(screen.queryByLabelText('Suggested aliases')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Create'}));
    expect(resolveUnknownEntity).toHaveBeenCalledWith('Sera Kestrel', PEOPLES.id, 'Sera Kestrel', []);
  });
});
