import {act, fireEvent, render, screen, within} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {AppNotifications} from './AppNotifications';
import {announceStatus, pushAppToast, resetNotificationsForTests, useNotificationStore} from '../../store/notificationStore';

describe('AppNotifications', () => {
  beforeEach(() => {
    resetNotificationsForTests();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders toasts in one polite viewport and auto-dismisses confirmations', () => {
    render(<AppNotifications />);
    expect(screen.queryByTestId('app-toast-viewport')).not.toBeInTheDocument();

    act(() => {
      pushAppToast({message: 'Scene saved.'});
    });
    const viewport = screen.getByTestId('app-toast-viewport');
    expect(viewport).toHaveAttribute('aria-live', 'polite');
    expect(within(viewport).getByRole('status')).toHaveTextContent('Scene saved.');
    expect(screen.queryByRole('button', {name: 'Dismiss notification'})).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByText('Scene saved.')).not.toBeInTheDocument();
  });

  it('keeps error toasts until dismissed and runs toast actions', () => {
    const onSelect = vi.fn();
    const onDismiss = vi.fn();
    render(<AppNotifications />);
    act(() => {
      pushAppToast({tone: 'error', message: 'Unable to save scene.'});
      pushAppToast({
        tone: 'info',
        message: 'Review this character match.',
        durationMs: null,
        action: {label: 'Review Character Match', onSelect},
        onDismiss
      });
    });
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByText('Unable to save scene.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: 'Review Character Match'}));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Review this character match.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: 'Dismiss notification'}));
    expect(screen.queryByText('Unable to save scene.')).not.toBeInTheDocument();
    expect(useNotificationStore.getState().toasts).toEqual([]);
  });

  it('announces status text through the shared live region and re-announces repeats', () => {
    render(<AppNotifications />);
    const announcer = screen.getByTestId('app-status-announcer');
    expect(announcer).toHaveAttribute('aria-live', 'polite');
    expect(announcer).toHaveTextContent('');

    act(() => {
      announceStatus('Scene autosaved.');
    });
    const first = announcer.textContent;
    expect(first).toContain('Scene autosaved.');

    act(() => {
      announceStatus('Scene autosaved.');
    });
    expect(announcer.textContent).toContain('Scene autosaved.');
    expect(announcer.textContent).not.toBe(first);

    act(() => {
      announceStatus('Storage is full.', {assertive: true});
    });
    expect(screen.getAllByRole('alert').find((node) => node.textContent?.includes('Storage'))).toHaveTextContent('Storage is full.');
    expect(announcer).toHaveTextContent('');
  });
});
