import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {ContextLeftOutNotice} from './ContextLeftOutNotice';

describe('ContextLeftOutNotice', () => {
  it('shows nothing when everything fit', () => {
    const {container} = render(<ContextLeftOutNotice omitted={[]} budgetTokens={900} size={{tokens: 4096, source: 'reported'}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists what was left out, and says when the context size is only assumed', () => {
    render(
      <ContextLeftOutNotice
        omitted={[
          {source: 'Accepted canon facts - Aria', detail: 'trait: blunt'},
          {source: 'Accepted canon facts - Aria', detail: 'trait: patient'},
          {source: 'Accepted canon: linked World Bible record - Keep (linked to Aria)', detail: ''}
        ]}
        budgetTokens={1200}
        size={{tokens: 4096, source: 'assumed'}}
      />
    );
    expect(screen.getByText(/Left out to fit the model’s context \(3 items; about 1,200 tokens were available/)).toBeInTheDocument();
    expect(screen.getByText(/was not reported, so 4,096 tokens is assumed/)).toBeInTheDocument();
    expect(screen.getByText('Show what was left out')).toBeInTheDocument();
    expect(screen.getAllByText('Accepted canon facts - Aria', {exact: false})).toHaveLength(1);
    expect(screen.getByText('trait: blunt')).toBeInTheDocument();
    expect(screen.getByText('trait: patient')).toBeInTheDocument();
    expect(screen.getByText('Accepted canon: linked World Bible record - Keep (linked to Aria)')).toBeInTheDocument();
  });
});
