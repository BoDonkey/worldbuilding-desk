import {afterEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import {CharacterCardExportButton} from './CharacterCardExportButton';

const lab = {isLoaded: true, buildCardExport: vi.fn()};
const download = vi.fn();

vi.mock('../../hooks/useCharacterLabData', () => ({useCharacterLabData: () => lab}));
vi.mock('../../utils/downloadJson', () => ({triggerJsonDownload: (...args: unknown[]) => download(...args)}));

afterEach(() => {
  vi.clearAllMocks();
  lab.isLoaded = true;
});

describe('CharacterCardExportButton', () => {
  it('downloads the card under a file name made from the character', () => {
    const card = {spec: 'chara_card_v2', data: {name: 'Mira Voss'}};
    lab.buildCardExport.mockReturnValue(card);
    render(<CharacterCardExportButton projectId='p1' entityId='mira' />);

    fireEvent.click(screen.getByRole('button', {name: 'Export character card'}));
    expect(lab.buildCardExport).toHaveBeenCalledWith('mira');
    expect(download).toHaveBeenCalledWith('Mira_Voss.card.json', card);
    expect(screen.getByRole('status')).toHaveTextContent('Saved Mira_Voss.card.json.');
  });

  it('says why nothing was saved', () => {
    lab.buildCardExport.mockImplementation(() => {
      throw new Error('This World Bible record is not a character.');
    });
    render(<CharacterCardExportButton projectId='p1' entityId='ship' />);

    fireEvent.click(screen.getByRole('button', {name: 'Export character card'}));
    expect(download).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('This World Bible record is not a character.');
  });

  it('waits for the project to load', () => {
    lab.isLoaded = false;
    render(<CharacterCardExportButton projectId='p1' entityId='mira' />);
    expect(screen.getByRole('button', {name: 'Export character card'})).toBeDisabled();
  });
});
