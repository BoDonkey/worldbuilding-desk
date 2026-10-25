import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {sectionTokenLabel} from '../../services/llm/contextBudget';
import {PromptTokenSummary} from './PromptTokenSummary';

const breakdown = {
  instructionsTokens: 400,
  conversationTokens: 1200,
  sections: [
    {source: 'Accepted canon facts - Aria', tokens: 900},
    {source: 'Accepted canon: World Bible record - Aria', tokens: 100}
  ],
  totalTokens: 2600
};

describe('PromptTokenSummary', () => {
  it('totals the prompt against the model and shows what is left for the reply', () => {
    render(<PromptTokenSummary breakdown={breakdown} size={{tokens: 4096, source: 'reported'}} />);
    expect(screen.getByLabelText('Prompt size')).toHaveTextContent(
      'Prompt: about 2,600 tokens of the model’s 4,096 (instructions ~400, conversation ~1,200, project context ~1,000). About 1,496 left for the reply.'
    );
  });

  it('marks an assumed size, says when no room is left, and works without a size', () => {
    const {rerender} = render(<PromptTokenSummary breakdown={breakdown} size={{tokens: 2048, source: 'assumed'}} />);
    expect(screen.getByLabelText('Prompt size')).toHaveTextContent('of the model’s 2,048 (assumed)');
    expect(screen.getByLabelText('Prompt size')).toHaveTextContent('No room is left for the reply.');
    rerender(<PromptTokenSummary breakdown={{...breakdown, conversationTokens: 0}} size={null} />);
    expect(screen.getByLabelText('Prompt size')).toHaveTextContent(
      'Prompt: about 2,600 tokens (instructions ~400, project context ~1,000).'
    );
  });

  it('labels one section', () => {
    expect(sectionTokenLabel(breakdown, 'Accepted canon facts - Aria')).toBe('~900 tokens');
    expect(sectionTokenLabel(breakdown, 'Other')).toBeNull();
    expect(sectionTokenLabel(null, 'Other')).toBeNull();
  });
});
