import {fireEvent, render, screen, within} from '@testing-library/react';
import {beforeEach, describe, expect, it} from 'vitest';
import {AccessibilityProvider} from '../../contexts/AccessibilityContext';
import {EditorAppearanceControl} from './EditorAppearanceControl';

describe('EditorAppearanceControl paragraph hint (4.98)', () => {
  beforeEach(() => localStorage.clear());

  it('describes the selected paragraph style and points to the export choice', () => {
    render(
      <AccessibilityProvider>
        <EditorAppearanceControl />
      </AccessibilityProvider>
    );
    const group = screen.getByRole('group', {name: 'Paragraphs'});
    expect(screen.getByText(/A gap between paragraphs and no indent\./)).toBeTruthy();
    expect(screen.getByText(/Exports have their own Paragraphs choice\./)).toBeTruthy();

    fireEvent.click(within(group).getByRole('button', {name: 'Indented'}));
    expect(screen.getByText(/first-line indent and no gap, like a printed book\./)).toBeTruthy();
    expect(screen.queryByText(/A gap between paragraphs and no indent\./)).toBeNull();
  });
});
