import {useState} from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it} from 'vitest';
import {RouteFeedback, type RouteFeedbackValue} from './RouteFeedback';
import {AppNotifications} from './AppNotifications';
import {resetNotificationsForTests, useNotificationStore} from '../../store/notificationStore';

function Harness({initial, errorsAsToast}: {initial: RouteFeedbackValue; errorsAsToast?: boolean}) {
  const [feedback, setFeedback] = useState<RouteFeedbackValue | null>(initial);
  return (
    <>
      <span data-testid='local-feedback'>{feedback ? feedback.message : 'cleared'}</span>
      <RouteFeedback feedback={feedback} onClear={() => setFeedback(null)} errorsAsToast={errorsAsToast} />
      <AppNotifications />
    </>
  );
}

describe('RouteFeedback', () => {
  beforeEach(() => {
    resetNotificationsForTests();
  });

  it('posts success feedback to the shell toast and clears the route state', () => {
    render(<Harness initial={{tone: 'success', message: 'Source Note created.'}} />);
    expect(screen.getByTestId('app-toast-viewport')).toHaveTextContent('Source Note created.');
    expect(screen.getByTestId('local-feedback')).toHaveTextContent('cleared');
    expect(useNotificationStore.getState().toasts).toHaveLength(1);
  });

  it('keeps error feedback inline as a dismissible alert', () => {
    render(<Harness initial={{tone: 'error', message: 'Unable to save lore document.'}} />);
    expect(screen.queryByTestId('app-toast-viewport')).not.toBeInTheDocument();
    const alert = screen.getAllByRole('alert').find((node) => node.textContent?.includes('Unable to save lore document.'));
    expect(alert).toBeDefined();
    fireEvent.click(screen.getByRole('button', {name: 'Dismiss message'}));
    expect(screen.queryByRole('button', {name: 'Dismiss message'})).not.toBeInTheDocument();
    expect(screen.getByTestId('local-feedback')).toHaveTextContent('cleared');
  });

  it('routes errors to the toast when the route opts in', () => {
    render(<Harness initial={{tone: 'error', message: 'Unable to save scene.'}} errorsAsToast />);
    expect(screen.getByTestId('app-toast-viewport')).toHaveTextContent('Unable to save scene.');
    expect(screen.getByRole('button', {name: 'Dismiss notification'})).toBeInTheDocument();
  });
});
