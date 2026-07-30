import {act, renderHook} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {useWizard, type WizardStep} from './useWizard';

function EmptyStep() {
  return null;
}

describe('useWizard', () => {
  it('updates data and advances through valid steps', async () => {
    const onNext = vi.fn();
    const steps: WizardStep[] = [
      {
        id: 'basics',
        title: 'Basics',
        description: 'Name the world',
        component: EmptyStep,
        isComplete: (data) => Boolean(data.name),
        onNext
      },
      {
        id: 'review',
        title: 'Review',
        description: 'Review the world',
        component: EmptyStep
      }
    ];
    const {result} = renderHook(() =>
      useWizard({steps, initialData: {name: ''}})
    );

    expect(result.current.currentStep.id).toBe('basics');
    expect(result.current.currentStepIndex).toBe(0);
    expect(result.current.totalSteps).toBe(2);
    expect(result.current.isFirstStep).toBe(true);
    expect(result.current.isLastStep).toBe(false);
    expect(result.current.canGoNext).toBe(false);

    act(() => result.current.updateData({name: 'Asterfall'}));

    expect(result.current.wizardData).toEqual({name: 'Asterfall'});
    expect(result.current.canGoNext).toBe(true);

    await act(async () => result.current.goNext());

    expect(onNext).toHaveBeenCalledWith({name: 'Asterfall'});
    expect(result.current.currentStep.id).toBe('review');
    expect(result.current.isLastStep).toBe(true);

    act(() => result.current.goBack());
    expect(result.current.currentStepIndex).toBe(0);
  });

  it('completes on the last step and ignores out-of-range navigation', async () => {
    const onComplete = vi.fn();
    const steps: WizardStep[] = [
      {
        id: 'only',
        title: 'Only step',
        description: 'Finish',
        component: EmptyStep
      }
    ];
    const {result} = renderHook(() =>
      useWizard({steps, initialData: {ready: true}, onComplete})
    );

    act(() => result.current.goToStep(4));
    expect(result.current.currentStepIndex).toBe(0);

    await act(async () => result.current.goNext());

    expect(onComplete).toHaveBeenCalledWith({ready: true});
    expect(result.current.isProcessing).toBe(false);
  });
});
