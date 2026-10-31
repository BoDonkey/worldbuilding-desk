import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {SourceNoteCapturePreview} from './SourceNoteCapturePreview';

const mocks = vi.hoisted(() => ({save: vi.fn()}));
vi.mock('../../services/lore/sourceNoteCapture', () => ({saveDraftSourceNoteFromAssistantOutput: mocks.save}));

const TRANSCRIPT = 'Question: Which way in?\n\nAnswer:\nThrough the kitchen.';

function renderPreview() {
  const onClose = vi.fn();
  const onCaptured = vi.fn();
  render(
    <SourceNoteCapturePreview
      projectId='project-1'
      sessionId='session-1'
      text={TRANSCRIPT}
      ragService={null}
      onClose={onClose}
      onCaptured={onCaptured}
    />
  );
  return {onClose, onCaptured, field: screen.getByLabelText('Source Note text (edit before saving)')};
}

describe('SourceNoteCapturePreview (5.17)', () => {
  beforeEach(() => {
    mocks.save.mockReset();
    mocks.save.mockResolvedValue({title: 'Question: Which way in?'});
  });

  it('saves the transcript as the author edited it', async () => {
    const {field, onCaptured, onClose} = renderPreview();
    expect(field).toHaveValue(TRANSCRIPT);
    fireEvent.change(field, {target: {value: 'Mira enters through the kitchen.'}});
    fireEvent.click(screen.getByRole('button', {name: 'Confirm action'}));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({content: 'Mira enters through the kitchen.'}));
    expect(onCaptured).toHaveBeenCalledWith('Question: Which way in?');
  });

  it('saves nothing when the author clears the text', async () => {
    const {field, onClose} = renderPreview();
    fireEvent.change(field, {target: {value: '   '}});
    fireEvent.click(screen.getByRole('button', {name: 'Confirm action'}));

    expect(await screen.findByRole('alert')).toHaveTextContent('Add some text to save as a Source Note.');
    expect(mocks.save).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
