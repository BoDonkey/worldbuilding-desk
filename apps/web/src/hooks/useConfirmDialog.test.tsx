import {act, fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {useConfirmDialog} from './useConfirmDialog';

function TestHarness({onConfirm, onCancel}: {onConfirm: () => void; onCancel?: () => void}) {
  const {requestConfirm, confirmDialog} = useConfirmDialog();
  return (
    <div>
      <button
        type='button'
        onClick={() =>
          requestConfirm({
            title: 'Delete this scene?',
            message: 'This cannot be undone.',
            onConfirm,
            onCancel
          })
        }
      >
        Delete
      </button>
      {confirmDialog}
    </div>
  );
}

describe('useConfirmDialog', () => {
  it('does not render a dialog until requestConfirm is called', () => {
    render(<TestHarness onConfirm={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the dialog with the requested title/message and calls onConfirm on confirm', () => {
    const onConfirm = vi.fn();
    render(<TestHarness onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', {name: 'Delete'}));
    expect(screen.getByRole('dialog', {name: /delete this scene/i})).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: 'Confirm'}));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls the request-specific onCancel and closes without confirming', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<TestHarness onConfirm={onConfirm} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', {name: 'Delete'}));
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('supports requesting a new confirmation after the previous one resolves', async () => {
    const onConfirm = vi.fn();
    render(<TestHarness onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', {name: 'Delete'}));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', {name: 'Confirm'}));
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', {name: 'Delete'}));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
