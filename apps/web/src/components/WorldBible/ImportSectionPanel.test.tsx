import {fireEvent, render, screen, within} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {EntityCategory} from '../../entityTypes';
import type {WorldBibleImportDraft, WorldBibleImportSectionDraft} from '../../hooks/useWorldBibleImports';
import {ImportSectionPanel} from './ImportSectionPanel';

const characters: EntityCategory = {
  id: 'characters',
  projectId: 'project',
  kind: 'character',
  name: 'Characters',
  slug: 'characters',
  createdAt: 1,
  fieldSchema: [
    {key: 'description', label: 'Description', type: 'textarea'},
    {key: 'age', label: 'Age', type: 'text'},
    {key: 'faction', label: 'Faction', type: 'select', options: ['A']}
  ]
};

const buildDraft = (detectedSections: WorldBibleImportSectionDraft[]): WorldBibleImportDraft => ({
  id: 'draft',
  fileName: 'sheet.md',
  name: 'Sheet',
  text: '',
  preview: '',
  categoryId: 'characters',
  mode: 'create',
  include: true,
  detectedSections,
  useDetectedSections: true
});

const renderPanel = (
  detectedSections: WorldBibleImportSectionDraft[],
  plannedNewFieldLabels: string[] = []
) => {
  const onUpdateSectionDestination = vi.fn();
  render(
    <ImportSectionPanel
      draft={buildDraft(detectedSections)}
      category={characters}
      plannedNewFieldLabels={plannedNewFieldLabels}
      isApplyingImports={false}
      onUpdateDraft={vi.fn()}
      onUpdateSectionDestination={onUpdateSectionDestination}
    />
  );
  return {onUpdateSectionDestination};
};

describe('ImportSectionPanel', () => {
  it('lists every detected heading, not just the first eight', () => {
    renderPanel(
      Array.from({length: 11}, (_, index) => ({
        id: `section-${index}`,
        title: `Section ${index + 1}`,
        content: 'Body',
        action: 'record-section' as const
      }))
    );

    expect(screen.getAllByRole('combobox')).toHaveLength(11);
    expect(screen.getByText('Section 11')).toBeInTheDocument();
  });

  it('offers Description, each mappable field by name, new fields, and Skip', () => {
    renderPanel(
      [{id: 'schooling', title: 'Schooling', content: 'Home.', action: 'record-section'}],
      ['Education']
    );

    const picker = screen.getByRole('combobox', {name: 'Destination for Schooling'});
    expect(within(picker).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Keep in Description',
      'Description',
      'Age',
      'New field: Schooling',
      'New field: Education',
      'Skip'
    ]);
    expect(screen.getByText('Stays in Description under this heading.')).toBeInTheDocument();
  });

  it('reports the picked field or planned new field as a destination', () => {
    const {onUpdateSectionDestination} = renderPanel(
      [{id: 'schooling', title: 'Schooling', content: 'Home.', action: 'record-section'}],
      ['Education']
    );
    const picker = screen.getByRole('combobox', {name: 'Destination for Schooling'});

    fireEvent.change(picker, {target: {value: 'field:age'}});
    fireEvent.change(picker, {target: {value: 'new:Education'}});
    fireEvent.change(picker, {target: {value: 'skip'}});

    expect(onUpdateSectionDestination.mock.calls.map((call) => call[2])).toEqual([
      {action: 'existing-field', fieldKey: 'age'},
      {action: 'new-field', newFieldLabel: 'Education'},
      {action: 'ignore'}
    ]);
  });

  it('shows a heading whose field is gone as staying in Description, not as a field', () => {
    renderPanel([
      {id: 'age', title: 'Age', content: '41', action: 'existing-field', fieldKey: 'deleted'}
    ]);

    expect(screen.getByRole('combobox', {name: 'Destination for Age'})).toHaveValue('keep');
    expect(screen.getByText('Stays in Description under this heading.')).toBeInTheDocument();
  });

  it('describes a new field and omits a duplicate New field option when the title is already a field', () => {
    renderPanel([
      {id: 'traits', title: 'Traits', content: 'Calm.', action: 'new-field'},
      {id: 'age', title: 'Age', content: '41', action: 'existing-field', fieldKey: 'age'}
    ]);

    expect(
      screen.getByText(
        'Adds a Traits field to Characters and fills it here. Other records get the field empty.'
      )
    ).toBeInTheDocument();
    const agePicker = screen.getByRole('combobox', {name: 'Destination for Age'});
    expect(within(agePicker).queryByRole('option', {name: 'New field: Age'})).toBeNull();
    expect(within(agePicker).getByRole('option', {name: 'New field: Traits'})).toBeInTheDocument();
  });
});
