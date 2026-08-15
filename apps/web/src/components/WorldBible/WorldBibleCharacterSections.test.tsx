import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {WorldBibleCharacterSections} from './WorldBibleCharacterSections';

const baseProps = {
  activeSection: 'canon' as const,
  onSectionChange: vi.fn(),
  isSaved: true,
  characterName: 'Mira Voss',
  canUseMechanics: true,
  characterExtension: null,
  characterSheet: null,
  linkedNoteCount: 0,
  sceneMentionCount: 0,
  stateEventCount: 0,
  isExporting: false,
  onExport: vi.fn(),
  dialogueStyleContent: <p>Dialogue style control</p>,
  canonContent: <p>Canon content</p>,
  notesContent: <p>Notes content</p>,
  continuityContent: <p>Continuity content</p>,
  mechanicsContent: <p>Mechanics content</p>
};

describe('WorldBibleCharacterSections', () => {
  it('keeps a new character focused on canon until it is saved', () => {
    render(<WorldBibleCharacterSections {...baseProps} isSaved={false} />);

    expect(screen.getByRole('tab', {name: 'Canon'})).toBeInTheDocument();
    expect(screen.queryByRole('tab', {name: 'Notes'})).not.toBeInTheDocument();
    expect(screen.getByText(/Save the canonical character first/)).toBeInTheDocument();
  });

  it('hides mechanics for projects that do not enable mechanics', () => {
    render(<WorldBibleCharacterSections {...baseProps} canUseMechanics={false} />);

    expect(screen.getByRole('tab', {name: 'Writing aids'})).toBeInTheDocument();
    expect(screen.queryByRole('tab', {name: 'Mechanics'})).not.toBeInTheDocument();
  });

  it('renders the contextual mechanics experience in the mechanics section', () => {
    render(
      <WorldBibleCharacterSections
        {...baseProps}
        activeSection='mechanics'
        mechanicsContent={<button type='button'>Record a scene change</button>}
      />
    );

    expect(screen.getByRole('button', {name: 'Record a scene change'})).toBeInTheDocument();
  });
});
