import {act, fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {AIProposalPreview} from './AIProposalPreview';

describe('AIProposalPreview', () => {
  it('keeps proposed text inert until confirmation and permits dismissal', () => {
    const confirm = vi.fn();
    const dismiss = vi.fn();
    render(<AIProposalPreview title='Set name' text='<b>Proposed name</b>' onConfirm={confirm} onDismiss={dismiss} />);
    expect(screen.getByText('<b>Proposed name</b>')).toBeTruthy();
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Dismiss'));
    expect(dismiss).toHaveBeenCalledOnce();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('prevents repeated confirmation while the validated action is pending', async () => {
    let finish!: () => void;
    const confirm = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<AIProposalPreview title='Set name' text='Name' onConfirm={confirm} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByText('Confirm action'));
    fireEvent.click(screen.getByText('Applying…'));
    expect(confirm).toHaveBeenCalledOnce();
    expect((screen.getByText('Dismiss') as HTMLButtonElement).disabled).toBe(true);
    await act(async () => finish());
    expect((screen.getByText('Confirm action') as HTMLButtonElement).disabled).toBe(false);
  });

  it('preserves the preview on failure and allows an explicit retry', async () => {
    const confirm = vi.fn().mockRejectedValueOnce(new Error('Storage unavailable')).mockResolvedValueOnce(undefined);
    render(<AIProposalPreview title='Set name' text='Name' onConfirm={confirm} onDismiss={vi.fn()} />);
    await act(async () => fireEvent.click(screen.getByText('Confirm action')));
    expect(screen.getByRole('alert').textContent).toContain('could not be completed');
    expect(screen.getByText('Name')).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByText('Confirm action')));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
