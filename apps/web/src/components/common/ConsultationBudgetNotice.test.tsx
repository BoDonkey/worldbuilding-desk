import {fireEvent, render, renderHook, screen, act} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {ConsultationBudgetNotice} from './ConsultationBudgetNotice';
import {useConsultationBudget} from '../../hooks/useConsultationBudget';
import {getConsultationBudgetStatus, recordConsultation} from '../../services/editor';
import type {InspectorSettings} from '../../entityTypes';

const inspector = (limit: number): InspectorSettings => ({
  enableAIConsultation: true,
  maxConsultationsPerDay: limit,
  maxContextChars: 1800,
  maxResponseTokens: 500
});

const statusFor = (projectId: string, limit: number) =>
  getConsultationBudgetStatus(projectId, limit);

describe('ConsultationBudgetNotice', () => {
  it('states the cost and what is left before the request', () => {
    recordConsultation('p1', 'assistant', 'anthropic', 20);
    recordConsultation('p1', 'writing-coach', 'anthropic', 20);

    render(
      <ConsultationBudgetNotice
        status={statusFor('p1', 20)}
        isLocal={false}
        onGrantMore={vi.fn()}
      />
    );

    expect(screen.getByText(/Costs 1 of this project's 20 daily AI consultations/)).toBeVisible();
    expect(screen.getByText(/18 left/)).toBeVisible();
    expect(screen.getByText(/midnight tonight/)).toBeVisible();
  });

  it('blocks with an alert that names the reset and offers more for today', () => {
    for (let i = 0; i < 4; i += 1) recordConsultation('p2', 'assistant', 'anthropic', 4);
    const onGrantMore = vi.fn();

    render(
      <ConsultationBudgetNotice
        status={statusFor('p2', 4)}
        isLocal={false}
        onGrantMore={onGrantMore}
      />
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('You have used all 4 AI consultations for this project today');
    expect(alert).toHaveTextContent('midnight tonight');

    fireEvent.click(screen.getByRole('button', {name: /Add 10 more for today/}));
    expect(onGrantMore).toHaveBeenCalledTimes(1);
  });

  it('says a local request costs nothing rather than showing a budget', () => {
    for (let i = 0; i < 20; i += 1) recordConsultation('p3', 'assistant', 'anthropic', 20);

    render(
      <ConsultationBudgetNotice
        status={statusFor('p3', 20)}
        isLocal
        onGrantMore={vi.fn()}
      />
    );

    expect(screen.getByText(/Runs on your local model/)).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders nothing when hidden', () => {
    const {container} = render(
      <ConsultationBudgetNotice
        status={statusFor('p4', 20)}
        isLocal={false}
        onGrantMore={vi.fn()}
        hidden
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe('useConsultationBudget', () => {
  it('spends against the project budget and re-renders the new status', () => {
    const {result} = renderHook(() => useConsultationBudget('p5', inspector(3), 'anthropic'));

    expect(result.current.status.remaining).toBe(3);
    expect(result.current.blocked).toBe(false);

    act(() => result.current.spend('writing-coach'));
    expect(result.current.status.used).toBe(1);
    expect(result.current.status.byFeature).toEqual([
      {feature: 'writing-coach', label: 'Writing coach', count: 1}
    ]);

    act(() => {
      result.current.spend('writing-coach');
      result.current.spend('assistant');
    });
    expect(result.current.blocked).toBe(true);
    expect(result.current.blockedMessage).toMatch(/used all 3 AI consultations/);
  });

  it('unblocks in place when the author grants more for today', () => {
    const {result} = renderHook(() => useConsultationBudget('p6', inspector(1), 'anthropic'));

    act(() => result.current.spend('assistant'));
    expect(result.current.blocked).toBe(true);

    act(() => result.current.grantMore());
    expect(result.current.blocked).toBe(false);
    expect(result.current.status.limit).toBe(11);
    expect(result.current.status.configuredLimit).toBe(1);
  });

  it('does not spend the budget for a local provider', () => {
    const {result} = renderHook(() => useConsultationBudget('p7', inspector(2), 'ollama'));

    act(() => {
      result.current.spend('assistant');
      result.current.spend('assistant');
      result.current.spend('assistant');
    });

    expect(result.current.isLocal).toBe(true);
    expect(result.current.status.used).toBe(0);
    expect(result.current.status.localUsed).toBe(3);
    expect(result.current.blocked).toBe(false);
  });
});
