import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {CharacterLabSummaryPanel} from './CharacterLabSummaryPanel';

const handlers = () => ({onSummarize: vi.fn(), onEdit: vi.fn(), onRemove: vi.fn()});
const summary = {text: 'They argued about the oath.', coversThroughId: 'x', coveredCount: 3, edited: false};

describe('CharacterLabSummaryPanel', () => {
  it('shows nothing without an offer or a summary', () => {
    const {container} = render(
      <CharacterLabSummaryPanel summary={null} offer={null} summarizableCount={2} busy={false} disabledReason={null} {...handlers()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('offers to summarize, with the share of the context', () => {
    const h = handlers();
    render(<CharacterLabSummaryPanel summary={null} offer={0.42} summarizableCount={1} busy={false} disabledReason={null} {...h} />);
    expect(screen.getByText(/fills about 42% of the model’s context/)).toHaveTextContent('the 1 earlier turn can');
    fireEvent.click(screen.getByRole('button', {name: 'Summarize earlier turns'}));
    expect(h.onSummarize).toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: 'Remove summary'})).toBeNull();
  });

  it('shows the summary as an editable note that is not canon, and can remove it', () => {
    const h = handlers();
    render(<CharacterLabSummaryPanel summary={summary} offer={null} summarizableCount={0} busy={false} disabledReason={null} {...h} />);
    const box = screen.getByLabelText(/Summary of the earlier conversation · 3 turns · not canon/);
    expect(box).toHaveValue('They argued about the oath.');
    fireEvent.change(box, {target: {value: 'New wording.'}});
    expect(h.onEdit).toHaveBeenCalledWith('New wording.');
    expect(screen.queryByRole('button', {name: /Summarize|Add earlier/})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'Remove summary'}));
    expect(h.onRemove).toHaveBeenCalled();
  });

  it('marks a summary the author edited', () => {
    render(
      <CharacterLabSummaryPanel summary={{...summary, edited: true}} offer={null} summarizableCount={0} busy={false} disabledReason={null} {...handlers()} />
    );
    expect(screen.getByLabelText('Summary of the earlier conversation · 3 turns · not canon · edited')).toBeInTheDocument();
  });

  it('extends an existing summary, and disables while busy or blocked', () => {
    const {rerender} = render(
      <CharacterLabSummaryPanel summary={summary} offer={0.5} summarizableCount={2} busy={false} disabledReason='Daily limit reached.' {...handlers()} />
    );
    expect(screen.getByRole('button', {name: 'Add earlier turns to the summary'})).toBeDisabled();
    rerender(<CharacterLabSummaryPanel summary={summary} offer={0.5} summarizableCount={2} busy {...handlers()} disabledReason={null} />);
    expect(screen.getByRole('button', {name: 'Add earlier turns to the summary'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Remove summary'})).toBeDisabled();
  });
});
