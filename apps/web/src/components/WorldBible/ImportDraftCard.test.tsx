import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {EntityCategory} from '../../entityTypes';
import type {WorldBibleImportDraft} from '../../hooks/useWorldBibleImports';
import {ImportDraftCard} from './ImportDraftCard';

const locations: EntityCategory = {
  id: 'locations',
  projectId: 'project',
  kind: 'general',
  name: 'Locations',
  slug: 'locations',
  createdAt: 1,
  fieldSchema: [{key: 'description', label: 'Description', type: 'textarea'}]
};

const draft: WorldBibleImportDraft = {
  id: 'draft',
  fileName: 'harbor.md',
  name: 'Harbor',
  text: 'A harbor town.',
  preview: 'A harbor town.',
  categoryId: 'locations',
  mode: 'create',
  include: true
};

const renderCard = (overrides: Partial<WorldBibleImportDraft>) => {
  const handlers = {
    onImportAndOpen: vi.fn(),
    onOpenImported: vi.fn()
  };
  render(
    <ul>
      <ImportDraftCard
        draft={{...draft, ...overrides}}
        category={locations}
        categories={[locations]}
        isApplyingImports={false}
        onUpdateDraft={vi.fn()}
        onUpdateSectionDestination={vi.fn()}
        onPreviewSource={vi.fn()}
        {...handlers}
      />
    </ul>
  );
  return handlers;
};

describe('ImportDraftCard', () => {
  it('marks a waiting draft as not saved yet', () => {
    renderCard({});

    expect(screen.getByText('Not saved yet')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Import and open'})).toBeInTheDocument();
  });

  it('collapses an imported draft to the saved record with an Open action', () => {
    const {onOpenImported} = renderCard({
      status: 'imported',
      importedEntityId: 'entity-1',
      importedEntityName: 'Harbor'
    });

    expect(screen.getByText('Imported')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Import and open'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Open Harbor'}));
    expect(onOpenImported).toHaveBeenCalledWith('entity-1');
  });

  it('shows why a draft failed and keeps it importable', () => {
    renderCard({status: 'failed', importError: 'Storage is full.'});

    expect(screen.getByText('Not imported')).toBeInTheDocument();
    expect(screen.getByText('Import failed: Storage is full.')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Import and open'})).toBeEnabled();
  });
});
