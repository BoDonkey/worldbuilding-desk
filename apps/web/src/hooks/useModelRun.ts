import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {LLMService} from '../services/llm/LLMService';
import type {LLMRequest} from '../services/llm/types';
import {splitModelOutput, type ModelRunPhase, type SplitModelOutput} from '../services/llm/modelRun';

export type ModelRunStatus = 'idle' | ModelRunPhase | 'done' | 'stopped' | 'error';

export interface ModelRunResult extends SplitModelOutput {
  /** True when the author pressed Stop; the answer is whatever arrived before that. */
  stopped: boolean;
}

export interface UseModelRun {
  status: ModelRunStatus;
  thinking: string;
  elapsedMs: number;
  isRunning: boolean;
  /**
   * Streams one request, reporting thinking and answer separately as they arrive. Resolves with
   * the final split (and `stopped` if the author stopped it); rejects on a real failure.
   */
  run: (
    service: Pick<LLMService, 'stream'>,
    request: Omit<LLMRequest, 'signal'>,
    onUpdate?: (output: SplitModelOutput) => void
  ) => Promise<ModelRunResult>;
  stop: () => void;
  /** Clears the last run's thinking and status, e.g. before an unrelated request. */
  reset: () => void;
}

const ELAPSED_TICK_MS = 1000;

/**
 * One author-watched model run at a time. Gives the author what they need to tell a slow model
 * from a hung one: the phase, elapsed time, and the thinking as it streams, plus Stop.
 */
export function useModelRun(): UseModelRun {
  const [status, setStatus] = useState<ModelRunStatus>('idle');
  const [thinking, setThinking] = useState('');
  const [elapsedMs, setElapsedMs] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef(0);
  const isRunning = status === 'waiting' || status === 'thinking' || status === 'answering';

  useEffect(() => {
    if (!isRunning) return;
    const intervalId = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, ELAPSED_TICK_MS);
    return () => window.clearInterval(intervalId);
  }, [isRunning]);

  // Leaving the surface mid-run stops the request rather than letting it run unseen.
  useEffect(() => () => controllerRef.current?.abort(), []);

  const run = useCallback<UseModelRun['run']>(async (service, request, onUpdate) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    setThinking('');
    setStatus('waiting');

    let raw = '';
    let output = splitModelOutput('');
    try {
      for await (const chunk of service.stream({...request, signal: controller.signal})) {
        if (controller.signal.aborted) break;
        raw += chunk;
        output = splitModelOutput(raw);
        setThinking(output.thinking);
        setStatus(output.phase);
        onUpdate?.(output);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setStatus('error');
        setElapsedMs(Date.now() - startedAtRef.current);
        throw error;
      }
    }

    const stopped = controller.signal.aborted;
    if (controllerRef.current === controller) controllerRef.current = null;
    setElapsedMs(Date.now() - startedAtRef.current);
    setStatus(stopped ? 'stopped' : 'done');
    return {...output, stopped};
  }, []);

  const stop = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setStatus('idle');
    setThinking('');
    setElapsedMs(0);
  }, []);

  return useMemo(
    () => ({status, thinking, elapsedMs, isRunning, run, stop, reset}),
    [status, thinking, elapsedMs, isRunning, run, stop, reset]
  );
}
