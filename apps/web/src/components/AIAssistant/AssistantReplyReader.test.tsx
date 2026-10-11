import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {AssistantReplyReader} from './AssistantReplyReader';

const mocks = vi.hoisted(() => ({
  copyText: vi.fn(async () => true),
  pushAppToast: vi.fn()
}));

vi.mock('../../utils/clipboard', () => ({copyText: mocks.copyText}));
vi.mock('../../store/notificationStore', () => ({pushAppToast: mocks.pushAppToast}));

const REPLY = [
  '## Pacing',
  '',
  'The scene **stalls** in the middle.',
  '',
  '- Cut the second recap',
  '- Move the reveal earlier',
  '',
  '<script>window.hacked = true</script><img src=x onerror="alert(1)">'
].join('\n');

describe('AssistantReplyReader', () => {
  afterEach(() => {
    mocks.copyText.mockClear();
    mocks.pushAppToast.mockClear();
  });

  it('shows the reply with its Markdown formatted and raw HTML kept inert', () => {
    render(<AssistantReplyReader content={REPLY} isStreaming={false} onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', {name: 'Assistant reply'});
    expect(dialog).toBeInTheDocument();
    const body = screen.getByTestId('assistant-reply-reader-body');
    expect(body.querySelector('h2')?.textContent).toBe('Pacing');
    expect(body.querySelector('strong')?.textContent).toBe('stalls');
    expect(body.querySelectorAll('li')).toHaveLength(2);
    expect(body.querySelector('script, img')).toBeNull();
    expect(body.querySelector('[onerror]')).toBeNull();
    expect(body.textContent).toContain('<script>');
    expect(body.textContent).not.toContain('**');
  });

  it('closes on Escape without letting the key reach window listeners', () => {
    const onClose = vi.fn();
    const windowListener = vi.fn();
    window.addEventListener('keydown', windowListener);
    render(<AssistantReplyReader content='Advice.' isStreaming={false} onClose={onClose} />);

    fireEvent.keyDown(screen.getByRole('button', {name: 'Close'}), {key: 'Escape'});

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(windowListener).not.toHaveBeenCalled();
    window.removeEventListener('keydown', windowListener);
  });

  it('closes from the Close button and the overlay, but not from clicks inside', () => {
    const onClose = vi.fn();
    render(<AssistantReplyReader content='Advice.' isStreaming={false} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('assistant-reply-reader-body'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: 'Close'}));
    fireEvent.click(screen.getByRole('presentation'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('copies the stored reply text, and waits for streaming to finish', async () => {
    const {rerender} = render(
      <AssistantReplyReader content={REPLY} isStreaming onClose={vi.fn()} />
    );
    expect(screen.getByRole('button', {name: 'Copy'})).toBeDisabled();

    rerender(<AssistantReplyReader content={REPLY} isStreaming={false} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', {name: 'Copy'}));

    await waitFor(() => expect(mocks.copyText).toHaveBeenCalledWith(REPLY));
    expect(mocks.pushAppToast).toHaveBeenCalledWith({message: 'Reply copied.'});
  });
});
