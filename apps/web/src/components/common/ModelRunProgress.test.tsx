import {act, fireEvent, render, screen} from '@testing-library/react';
import {useState} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {useModelRun, type ModelRunResult} from '../../hooks/useModelRun';
import type {LLMRequest} from '../../services/llm/types';
import {ModelRunProgress} from './ModelRunProgress';

/** A stream the test feeds one chunk at a time; it ends on `finish` or rejects on abort. */
function createControlledStream() {
  const queue: string[] = [];
  let wake: (() => void) | null = null;
  let finished = false;
  const notify = () => {
    wake?.();
    wake = null;
  };
  const stream = vi.fn(async function* (request: LLMRequest) {
    request.signal?.addEventListener('abort', notify);
    while (true) {
      if (request.signal?.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError');
      }
      if (queue.length > 0) {
        yield queue.shift()!;
        continue;
      }
      if (finished) return;
      await new Promise<void>((resolve) => {
        wake = resolve;
      });
    }
  });
  return {
    stream,
    push: (chunk: string) => {
      queue.push(chunk);
      notify();
    },
    finish: () => {
      finished = true;
      notify();
    }
  };
}

function Harness({stream}: {stream: ReturnType<typeof createControlledStream>['stream']}) {
  const modelRun = useModelRun();
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<ModelRunResult | null>(null);
  return (
    <div>
      <button
        type='button'
        onClick={() => {
          void modelRun
            .run({stream}, {messages: [{role: 'user', content: 'go'}]}, (output) => setAnswer(output.answer))
            .then(setResult);
        }}
      >
        Start
      </button>
      <ModelRunProgress run={modelRun} />
      <p data-testid='answer'>{answer}</p>
      <p data-testid='result'>{result ? (result.stopped ? 'stopped' : 'done') : ''}</p>
    </div>
  );
}

const flush = () => act(async () => {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
});

describe('ModelRunProgress with useModelRun', () => {
  beforeEach(() => {
    vi.useFakeTimers({shouldAdvanceTime: true});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows waiting, then live thinking, then the answer, with elapsed time', async () => {
    const controlled = createControlledStream();
    render(<Harness stream={controlled.stream} />);

    fireEvent.click(screen.getByRole('button', {name: 'Start'}));
    await flush();
    expect(screen.getByRole('status')).toHaveTextContent('Waiting for the model…');
    expect(screen.getByRole('button', {name: 'Stop'})).toBeInTheDocument();

    controlled.push('<think>Weighing the premise</think>');
    await flush();
    expect(screen.getByRole('status')).toHaveTextContent('Thinking…');
    expect(screen.getByText('Weighing the premise')).toBeVisible();
    expect(screen.getByTestId('answer')).toHaveTextContent('');

    await act(async () => {
      vi.advanceTimersByTime(65_000);
    });
    expect(screen.getByLabelText(/^Elapsed 1:0\d$/)).toBeInTheDocument();

    controlled.push('The answer.');
    await flush();
    expect(screen.getByRole('status')).toHaveTextContent('Writing the answer…');
    expect(screen.getByTestId('answer')).toHaveTextContent('The answer.');

    controlled.finish();
    await flush();
    expect(screen.getByTestId('result')).toHaveTextContent('done');
    expect(screen.getByText(/^Finished in 1:0\d\.$/)).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Stop'})).not.toBeInTheDocument();
    expect(screen.getByText('Show thinking (3 words)')).toBeInTheDocument();
  });

  it('stops the request and keeps what arrived', async () => {
    const controlled = createControlledStream();
    render(<Harness stream={controlled.stream} />);

    fireEvent.click(screen.getByRole('button', {name: 'Start'}));
    controlled.push('<think>Still going</think>');
    await flush();

    fireEvent.click(screen.getByRole('button', {name: 'Stop'}));
    await flush();

    expect(controlled.stream.mock.calls[0][0].signal?.aborted).toBe(true);
    expect(screen.getByTestId('result')).toHaveTextContent('stopped');
    expect(screen.getByText(/^Stopped after 0:0\d\.$/)).toBeInTheDocument();
    expect(screen.getByText('Show thinking (2 words)')).toBeInTheDocument();
  });

  it('renders nothing before the first run', () => {
    const controlled = createControlledStream();
    render(<Harness stream={controlled.stream} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
