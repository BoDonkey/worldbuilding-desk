import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {InlineAlert} from './InlineAlert';

describe('InlineAlert', () => {
  it('renders the message with an alert role for the error variant', () => {
    render(<InlineAlert variant='error' message='Something went wrong.' />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong.');
  });

  it('renders the message with a status role for the success variant', () => {
    render(<InlineAlert variant='success' message='Saved.' />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Saved.');
  });

  it('renders the message with a status role for the info variant', () => {
    render(<InlineAlert variant='info' message='Heads up.' />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Heads up.');
  });

  it('does not render a dismiss button without an onDismiss handler', () => {
    render(<InlineAlert variant='info' message='Heads up.' />);

    expect(screen.queryByRole('button', {name: /dismiss/i})).not.toBeInTheDocument();
  });

  it('renders a dismiss button and calls onDismiss when clicked', () => {
    const onDismiss = vi.fn();
    render(<InlineAlert variant='error' message='Failed.' onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('button', {name: /dismiss/i}));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('auto-dismisses after autoDismissMs when onDismiss is provided', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <InlineAlert variant='success' message='Saved.' onDismiss={onDismiss} autoDismissMs={2000} />
    );

    expect(onDismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2000);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
