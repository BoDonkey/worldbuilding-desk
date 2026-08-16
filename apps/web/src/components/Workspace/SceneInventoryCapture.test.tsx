import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {SceneInventoryCapture} from './SceneInventoryCapture';

const baseProps = {
  itemName: 'health potion',
  evidenceText: 'Bill found a health potion.',
  characters: [
    {sheetId: 'sheet-mira', name: 'Mira'},
    {sheetId: 'sheet-bill', name: 'Bill'}
  ],
  suggestedSheetId: 'sheet-bill',
  exactReusableItem: null,
  reusableItemMatches: [],
  canCreateReusableItem: true,
  isSaving: false,
  onCancel: vi.fn(),
  onSave: vi.fn()
};

describe('SceneInventoryCapture', () => {
  it('prefills the prose actor and keeps reusable canon opt-in', () => {
    const onSave = vi.fn();
    render(<SceneInventoryCapture {...baseProps} onSave={onSave} />);

    expect(screen.getByText('“Bill found a health potion.”')).toBeInTheDocument();
    expect(screen.getByLabelText('Character')).toHaveValue('sheet-bill');
    expect(screen.getByLabelText('Item')).toHaveValue('health potion');
    expect(screen.getByLabelText('Save as a reusable world item')).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', {name: 'Add at selection'}));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      sheetId: 'sheet-bill', itemName: 'health potion', quantity: 1,
      saveReusable: false
    }));
  });

  it('discloses editable canonical creation without navigating away', () => {
    render(<SceneInventoryCapture {...baseProps} />);
    fireEvent.click(screen.getByLabelText('Save as a reusable world item'));
    expect(screen.getByLabelText('Canonical name')).toHaveValue('health potion');
    fireEvent.change(screen.getByLabelText('Canonical name'), {
      target: {value: 'Health Potion'}
    });
    expect(screen.getByLabelText('Canonical name')).toHaveValue('Health Potion');
  });

  it('shows an exact reusable match without a creation control', () => {
    render(<SceneInventoryCapture
      {...baseProps}
      exactReusableItem={{id: 'potion', name: 'Health Potion'}}
    />);
    expect(screen.getByText('Reusable item found')).toBeInTheDocument();
    expect(screen.queryByLabelText('Save as a reusable world item')).not.toBeInTheDocument();
  });
});
