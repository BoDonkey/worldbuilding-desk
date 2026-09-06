import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {CraftCitationList} from './CraftCitationList';

describe('CraftCitationList', () => {
  it('renders external citations as safe links and local references as labels', () => {
    render(<CraftCitationList citations={[
      {id: 'external', label: 'External craft source', url: 'https://example.com/craft'},
      {id: 'internal', label: 'Internal research review'}
    ]} />);

    expect(screen.getByRole('link', {name: 'External craft source'})).toMatchObject({
      target: '_blank',
      rel: 'noreferrer'
    });
    expect(screen.getByText('Internal research review')).toBeVisible();
  });

  it('renders nothing without citations', () => {
    const {container} = render(<CraftCitationList citations={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
