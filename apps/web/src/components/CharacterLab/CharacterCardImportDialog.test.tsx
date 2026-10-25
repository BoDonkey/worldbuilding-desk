import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router';
import type {CharacterNameCollision} from '../../services/characterLab/characterFromDescription';
import type {CharacterCardImportRecords} from '../../services/characterCards/characterCardImport';
import {CharacterCardImportDialog} from './CharacterCardImportDialog';

const lab = {
  isLoaded: true,
  findNameCollisions: vi.fn((): CharacterNameCollision[] => []),
  saveCardImport: vi.fn(async (records: CharacterCardImportRecords, slug?: string) => {
    void records;
    void slug;
  })
};

vi.mock('../../hooks/useCharacterLabData', () => ({useCharacterLabData: () => lab}));

const cardJson = {
  spec: 'chara_card_v2',
  data: {
    name: 'Mira',
    description: 'A smith in Glass Harbor.',
    personality: 'Blunt with {{user}}.',
    first_mes: 'Hello.',
    system_prompt: 'Stay in character.',
    creator: 'someone',
    character_book: {
      entries: [
        {keys: ['harbor'], content: 'The harbor freezes.', comment: 'Glass Harbor'},
        {keys: ['secret'], content: 'Hidden lore.', enabled: false}
      ]
    }
  }
};

const fileOf = (value: unknown, name = 'mira.json') =>
  new File([typeof value === 'string' ? value : JSON.stringify(value)], name, {type: 'application/json'});

function renderDialog() {
  const onOpenCharacter = vi.fn();
  const onClose = vi.fn();
  render(
    <MemoryRouter>
      <CharacterCardImportDialog
        projectId='p1'
        category={{id: 'characters', slug: 'characters'}}
        onOpenCharacter={onOpenCharacter}
        onClose={onClose}
      />
    </MemoryRouter>
  );
  return {onOpenCharacter, onClose};
}

const choose = (file: File) =>
  fireEvent.change(screen.getByLabelText('Character card file (PNG or JSON)'), {target: {files: [file]}});

beforeEach(() => {
  lab.findNameCollisions.mockReturnValue([]);
  lab.saveCardImport.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('CharacterCardImportDialog', () => {
  it('previews where each part goes, then imports only on confirm', async () => {
    const {onOpenCharacter} = renderDialog();
    expect(screen.queryByRole('button', {name: 'Create draft character'})).not.toBeInTheDocument();

    choose(fileOf(cardJson));
    expect(await screen.findByDisplayValue('Mira')).toBeInTheDocument();
    expect(screen.getByText(/A smith in Glass Harbor\./)).toBeInTheDocument();
    expect(screen.getByText(/Personality, First message/)).toBeInTheDocument();
    expect(screen.getByText(/Not imported: the card’s chat instructions/)).toBeInTheDocument();
    expect(screen.getByText(/also uses \{\{user\}\}/)).toBeInTheDocument();
    expect(screen.getByText('(switched off in the card)')).toBeInTheDocument();
    expect(lab.saveCardImport).not.toHaveBeenCalled();

    // The switched-off entry starts unticked; tick it, untick the first.
    const [harbor, secret] = screen.getAllByRole('checkbox');
    expect(harbor).toBeChecked();
    expect(secret).not.toBeChecked();
    fireEvent.click(harbor as HTMLElement);
    fireEvent.click(secret as HTMLElement);

    fireEvent.click(screen.getByRole('button', {name: 'Create draft character'}));
    await screen.findByText(/Created a draft character, Mira\. It is marked Needs completion\./);
    const [[records, slug]] = lab.saveCardImport.mock.calls as unknown as Array<[CharacterCardImportRecords, string]>;
    expect(slug).toBe('characters');
    expect(records.entity?.name).toBe('Mira');
    expect(records.lorebookNotes.map((note) => note.title)).toEqual(['Mira lorebook: secret']);
    expect(screen.getByText(/The card and 1 lorebook entry are saved as Source Notes\./)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: 'Open Mira'}));
    expect(onOpenCharacter).toHaveBeenCalledWith(records.entity?.id);
  });

  it('asks before using a name another character has, and can add to that character instead', async () => {
    lab.findNameCollisions.mockReturnValue([{entityId: 'mira-1', name: 'Mira Voss', via: 'alias', matchedText: 'Mira'}]);
    renderDialog();
    choose(fileOf(cardJson));
    await screen.findByDisplayValue('Mira');

    expect(screen.getByText('A character already uses this name')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Create draft character'})).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Add the card to Mira Voss \(alias “Mira”\)/));
    fireEvent.click(screen.getByRole('button', {name: 'Add to Mira Voss'}));

    await screen.findByText(/Added the card to Mira Voss as a Source Note; the character itself is unchanged\./);
    const [[records]] = lab.saveCardImport.mock.calls as unknown as Array<[CharacterCardImportRecords]>;
    expect(records.entity).toBeNull();
    expect(records.links[0]?.targetId).toBe('mira-1');
  });

  it('shows why a file was refused and writes nothing', async () => {
    renderDialog();
    choose(fileOf('{"spec": "chara_card_v2", "data": {"name": ""}}'));
    expect(await screen.findByRole('alert')).toHaveTextContent('This character card has no name.');
    choose(fileOf('not a card', 'notes.txt'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Choose a character card saved as PNG or JSON.'));
    expect(screen.queryByRole('button', {name: 'Create draft character'})).not.toBeInTheDocument();
    expect(lab.saveCardImport).not.toHaveBeenCalled();
  });
});
