import {fireEvent, render, screen} from '@testing-library/react';
import {useState} from 'react';
import {describe, expect, it} from 'vitest';
import type {InlineHighlightsMode} from '../../entityTypes';
import {InlineHighlightsField} from './InlineHighlightsField';

const Harness = () => {
  const [mode, setMode] = useState<InlineHighlightsMode>('visible');
  return <InlineHighlightsField value={mode} onChange={setMode} />;
};

describe('InlineHighlightsField (4.98)', () => {
  it('shows the hint for the selected mode', () => {
    render(<Harness />);
    const select = screen.getByLabelText('Highlight visibility');
    expect(screen.getByText(/show in full while you write/)).toBeTruthy();

    fireEvent.change(select, {target: {value: 'subtle'}});
    expect(screen.getByText(/lighter, thinner underlines/)).toBeTruthy();
    expect(screen.queryByText(/show in full/)).toBeNull();

    fireEvent.change(select, {target: {value: 'hidden-while-typing'}});
    expect(screen.getByText(/hide while you type/)).toBeTruthy();
    expect(screen.queryByText(/lighter, thinner/)).toBeNull();
  });
});
