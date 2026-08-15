import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {Character, WorldEntity} from '../../entityTypes';
import {saveCharacter} from '../../characterStorage';
import {WorldBibleDialogueStyleControl} from './WorldBibleDialogueStyleControl';

vi.mock('../../characterStorage', () => ({
  saveCharacter: vi.fn(async () => undefined)
}));

const entity: WorldEntity = {
  id: 'entity-mira',
  projectId: 'project-1',
  categoryId: 'characters',
  name: 'Mira Voss',
  fields: {},
  links: [],
  createdAt: 1,
  updatedAt: 1
};

const extension: Character = {
  id: 'character-mira',
  projectId: 'project-1',
  entityId: 'entity-mira',
  name: 'Mira Voss',
  fields: {},
  createdAt: 1,
  updatedAt: 1
};

describe('WorldBibleDialogueStyleControl', () => {
  beforeEach(() => {
    vi.mocked(saveCharacter).mockClear();
  });

  it('assigns dialogue style without leaving the canonical character', async () => {
    const onSaved = vi.fn();
    render(
      <WorldBibleDialogueStyleControl
        entity={entity}
        characterExtension={extension}
        characterStyles={[
          {id: 'quiet', name: 'Quiet', markName: 'quietDialogue', styles: {}}
        ]}
        onSaved={onSaved}
        onManageStyles={vi.fn()}
      />
    );

    fireEvent.change(screen.getByRole('combobox', {name: 'Dialogue style'}), {
      target: {value: 'quiet'}
    });
    fireEvent.click(screen.getByRole('button', {name: 'Save dialogue style'}));

    await waitFor(() => expect(saveCharacter).toHaveBeenCalledOnce());
    expect(vi.mocked(saveCharacter).mock.calls[0][0]).toMatchObject({
      id: 'character-mira',
      entityId: 'entity-mira',
      name: 'Mira Voss',
      characterStyleId: 'quiet'
    });
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({characterStyleId: 'quiet'}),
      'Dialogue style assigned to "Mira Voss".'
    );
  });
});
