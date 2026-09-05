import {useRef, useState} from 'react';

/** Presentation lifecycle only. The caller owns validation and persistence. */
export function useAIProposalConfirmation(onConfirm: () => void | Promise<void>) {
  const inFlight = useRef(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setIsConfirming(true);
    setError(null);
    try {
      await onConfirm();
    } catch {
      setError('The action could not be completed. Review the destination before trying again.');
    } finally {
      inFlight.current = false;
      setIsConfirming(false);
    }
  };

  return {confirm, isConfirming, error};
}
