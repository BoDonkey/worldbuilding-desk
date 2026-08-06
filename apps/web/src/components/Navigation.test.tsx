import {screen, waitFor, within} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {renderRoute, seedRouteTestState} from '../test/renderRoute';
import {Navigation} from './Navigation';

vi.mock('../services/compendium', () => ({
  getCompendiumEntriesByProject: vi.fn(async () => [
    {needsCompletion: true},
    {needsCompletion: true},
    {needsCompletion: false}
  ])
}));

describe('Navigation', () => {
  beforeEach(() => {
    seedRouteTestState();
  });

  it('exposes the aggregate mechanics count on desktop and narrow More controls', async () => {
    renderRoute(<Navigation />, '/workspace');

    const desktopMore = screen.getByRole('button', {name: /^More/});
    const mobileMore = screen.getByRole('button', {
      name: /Toggle more navigation options/
    });

    await waitFor(() => {
      expect(within(desktopMore).getByText('2')).toBeInTheDocument();
      expect(within(mobileMore).getByText('2')).toBeInTheDocument();
    });
    expect(mobileMore).toHaveAccessibleName(
      'Toggle more navigation options, 2 pending mechanics items'
    );
  });
});
