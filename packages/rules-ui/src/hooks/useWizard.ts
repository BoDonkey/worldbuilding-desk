import {useState, useCallback} from 'react';

export interface WizardStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<any>;
  isComplete?: (data: any) => boolean;
  onNext?: (data: any) => void | Promise<void>;
}

export interface UseWizardOptions {
  steps: WizardStep[];
  onComplete?: (data: any) => void | Promise<void>;
  initialData?: any;
}

export function useWizard({
  steps,
  onComplete,
  initialData = {}
}: UseWizardOptions) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [wizardData, setWizardData] = useState(initialData);
  const [isProcessing, setIsProcessing] = useState(false);

  const currentStep = steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  const updateData = useCallback((updates: any) => {
    setWizardData((prev: any) => ({...prev, ...updates}));
  }, []);

  const goToStep = useCallback(
    (index: number) => {
      if (index >= 0 && index < steps.length) {
        setCurrentStepIndex(index);
      }
    },
    [steps.length]
  );

  const goNext = useCallback(async () => {
    if (isLastStep) {
      setIsProcessing(true);
      try {
        await onComplete?.(wizardData);
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // Run step's onNext callback if it exists
    if (currentStep.onNext) {
      setIsProcessing(true);
      try {
        await currentStep.onNext(wizardData);
      } finally {
        setIsProcessing(false);
      }
    }

    setCurrentStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  }, [currentStep, isLastStep, onComplete, wizardData, steps.length]);

  const goBack = useCallback(() => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const canGoNext = useCallback(() => {
    if (currentStep.isComplete) {
      return currentStep.isComplete(wizardData);
    }
    return true;
  }, [currentStep, wizardData]);

  return {
    currentStep,
    currentStepIndex,
    totalSteps: steps.length,
    isFirstStep,
    isLastStep,
    isProcessing,
    wizardData,
    updateData,
    goToStep,
    goNext,
    goBack,
    canGoNext: canGoNext()
  };
}
