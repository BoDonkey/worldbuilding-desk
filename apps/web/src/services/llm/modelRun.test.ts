import {describe, expect, it} from 'vitest';
import {formatElapsed, resolveResponseTokenLimit, splitModelOutput} from './modelRun';

describe('splitModelOutput', () => {
  it('reports waiting before anything arrives', () => {
    expect(splitModelOutput('')).toEqual({thinking: '', answer: '', phase: 'waiting'});
  });

  it('joins per-chunk thinking wrappers and keeps them out of the answer', () => {
    const raw = '<think>The user wants</think><think> tensions.</think>{"items":[]}';
    expect(splitModelOutput(raw)).toEqual({
      thinking: 'The user wants tensions.',
      answer: '{"items":[]}',
      phase: 'answering'
    });
  });

  it('is still thinking while only thinking has arrived, closed or not', () => {
    expect(splitModelOutput('<think>Weighing the premise</think>').phase).toBe('thinking');
    expect(splitModelOutput('<think>Weighing the prem')).toEqual({
      thinking: 'Weighing the prem',
      answer: '',
      phase: 'thinking'
    });
  });

  it('treats text before a bare closing tag as thinking', () => {
    expect(splitModelOutput('Considering options.</think>\n\nHere is the answer.')).toEqual({
      thinking: 'Considering options.',
      answer: 'Here is the answer.',
      phase: 'answering'
    });
  });

  it('passes a reply with no thinking through unchanged', () => {
    expect(splitModelOutput('Plain answer.')).toEqual({
      thinking: '',
      answer: 'Plain answer.',
      phase: 'answering'
    });
  });
});

describe('resolveResponseTokenLimit', () => {
  it('sends no cap to a local model and keeps the cap for hosted ones', () => {
    expect(resolveResponseTokenLimit('ollama', 500)).toBeUndefined();
    expect(resolveResponseTokenLimit('anthropic', 500)).toBe(500);
    expect(resolveResponseTokenLimit('openai', undefined)).toBeUndefined();
  });
});

describe('formatElapsed', () => {
  it('formats minutes and zero-padded seconds', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(9_999)).toBe('0:09');
    expect(formatElapsed(72_000)).toBe('1:12');
  });
});
