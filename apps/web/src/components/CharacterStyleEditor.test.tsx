import {fireEvent, render, screen, within} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {CharacterStyle} from '../entityTypes';
import {CharacterStyleEditor} from './CharacterStyleEditor';

const characterStyle: CharacterStyle = {
  id: 'style-1',
  name: 'System Message',
  markName: 'systemMessage',
  styles: {
    color: 'var(--color-text-primary)',
    backgroundColor: 'var(--surface-panel-elevated)',
    fontStyle: 'normal',
    fontWeight: 'normal'
  }
};

describe('CharacterStyleEditor', () => {
  it('uses the configured theme-token values in the preview', () => {
    render(
      <CharacterStyleEditor
        style={characterStyle}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        expanded
      />
    );

    expect(screen.getByText('Sample text in this style')).toHaveStyle({
      color: 'var(--color-text-primary)',
      backgroundColor: 'var(--surface-panel-elevated)'
    });
  });

  it('reports control changes without changing the stored style contract', () => {
    const onUpdate = vi.fn();
    render(
      <CharacterStyleEditor
        style={characterStyle}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
        expanded
      />
    );

    fireEvent.change(screen.getByLabelText('Font Family'), {
      target: {value: 'Georgia, serif'}
    });

    expect(onUpdate).toHaveBeenCalledWith('style-1', {
      fontFamily: 'Georgia, serif'
    });
  });

  it('keeps delete behind the shared confirmation dialog', () => {
    const onDelete = vi.fn();
    render(
      <CharacterStyleEditor
        style={characterStyle}
        onUpdate={vi.fn()}
        onDelete={onDelete}
      />
    );

    fireEvent.click(screen.getByRole('button', {name: 'Delete'}));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', {name: 'Delete'}));
    expect(onDelete).toHaveBeenCalledWith('style-1');
  });
});
