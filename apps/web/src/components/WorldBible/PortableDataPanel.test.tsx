import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {EntityCategory, Project} from '../../entityTypes';
import {PortableDataPanel} from './PortableDataPanel';

const project: Project = {id: 'project-1', name: 'Portable Project', createdAt: 1, updatedAt: 1};

const locations: EntityCategory = {
  id: 'locations',
  projectId: project.id,
  kind: 'general',
  name: 'Locations',
  slug: 'locations',
  fieldSchema: [],
  createdAt: 1
};

const renderPanel = (props: {categories: EntityCategory[]; categoriesLoaded: boolean}) => (
  <PortableDataPanel
    project={project}
    categories={props.categories}
    categoriesLoaded={props.categoriesLoaded}
    entities={[]}
    aliases={[]}
    canonicalFacts={[]}
    loreDocuments={[]}
    loreDocumentLinks={[]}
    ragService={null}
    shodhService={null}
    onFeedback={vi.fn()}
  />
);

describe('PortableDataPanel', () => {
  it('holds a World Bible import until the project categories have loaded', async () => {
    const view = render(renderPanel({categories: [], categoriesLoaded: false}));

    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [
          new File(
            ['---\ntype: "world-bible-record"\ntitle: "Vault City"\ncategory: "Locations"\n---\n# Vault City\n\nA city built beneath glass.'],
            'vault-city.md',
            {type: 'text/markdown'}
          )
        ]
      }
    });

    const importButton = await screen.findByRole('button', {name: 'Import Selected'});
    expect(importButton).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Loading World Bible categories');

    view.rerender(renderPanel({categories: [locations], categoriesLoaded: true}));

    expect(screen.getByRole('button', {name: 'Import Selected'})).toBeEnabled();
    expect(screen.queryByText(/Loading World Bible categories/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Category')).toHaveValue('locations');
  });
});
