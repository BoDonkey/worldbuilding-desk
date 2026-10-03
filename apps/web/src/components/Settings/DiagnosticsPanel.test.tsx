import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {DiagnosticsPanel} from './DiagnosticsPanel';
import {clearDiagnostics, recordDiagnostic, resetDiagnosticsForTests} from '../../services/errors';

describe('DiagnosticsPanel', () => {
  beforeEach(() => {
    resetDiagnosticsForTests();
    clearDiagnostics();
  });

  it('shows the empty state and local-only explanation', () => {
    render(<DiagnosticsPanel />);
    expect(screen.getByText('No errors recorded on this computer.')).toBeInTheDocument();
    expect(screen.getByText(/Nothing is sent anywhere unless you copy it/)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Clear log'})).toBeDisabled();
  });

  it('lists recorded errors, copies a redacted report, and clears the log', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
    Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText}});
    recordDiagnostic(new Error('OpenAI API error: Unauthorized sk-proj-abcdefghijklmnopqrstuvwxyz0123'), {
      context: 'assistant reply',
      failureClass: 'auth'
    });
    render(<DiagnosticsPanel secrets={['my-secret-key']} />);

    expect(screen.getByRole('list', {name: 'Recent errors'})).toHaveTextContent('Provider key');
    expect(screen.getByRole('list', {name: 'Recent errors'})).toHaveTextContent('assistant reply');
    expect(screen.queryByText(/sk-proj-/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: 'Copy diagnostic report'}));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const copied = String(writeText.mock.calls[0]?.[0] ?? '');
    expect(copied).toContain('SagaSpine diagnostic report');
    expect(copied).toContain('OpenAI API error: Unauthorized');
    expect(copied).not.toContain('sk-proj-');
    expect(await screen.findByText(/Diagnostic report copied/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: 'Show report'}));
    expect(screen.getByLabelText('Diagnostic report')).toHaveTextContent('assistant reply');
    fireEvent.click(screen.getByRole('button', {name: 'Hide report'}));
    expect(screen.queryByLabelText('Diagnostic report')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: 'Clear log'}));
    expect(screen.getByText('No errors recorded on this computer.')).toBeInTheDocument();
    expect(screen.getByText('Diagnostic log cleared.')).toBeInTheDocument();
  });
});
