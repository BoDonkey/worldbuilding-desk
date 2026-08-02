import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {ConfirmDialog} from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    const {container} = render(
      <ConfirmDialog
        isOpen={false}
        title='Delete scene'
        message='This cannot be undone.'
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders title, message, and default button labels when open', () => {
    render(
      <ConfirmDialog
        isOpen
        title='Delete scene'
        message='This cannot be undone.'
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog', {name: /delete scene/i})).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Confirm'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
  });

  it('supports custom confirm/cancel labels', () => {
    render(
      <ConfirmDialog
        isOpen
        title='Delete scene'
        message='This cannot be undone.'
        confirmLabel='Delete'
        cancelLabel='Keep it'
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole('button', {name: 'Delete'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Keep it'})).toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        isOpen
        title='Delete scene'
        message='This cannot be undone.'
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', {name: 'Confirm'}));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        isOpen
        title='Delete scene'
        message='This cannot be undone.'
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when clicking the overlay', () => {
    const onCancel = vi.fn();
    const {container} = render(
      <ConfirmDialog
        isOpen
        title='Delete scene'
        message='This cannot be undone.'
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    const overlay = container.firstElementChild as HTMLElement;
    fireEvent.click(overlay);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Escape is pressed', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        isOpen
        title='Delete scene'
        message='This cannot be undone.'
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.keyDown(window, {key: 'Escape'});
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
