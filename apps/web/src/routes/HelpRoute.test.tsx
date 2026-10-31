import {fireEvent, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it} from 'vitest';
import HelpRoute from './HelpRoute';
import {renderRoute, seedRouteTestState} from '../test/renderRoute';

beforeEach(() => {
  seedRouteTestState();
});

describe('HelpRoute', () => {
  it('lists every topic and links to its screens', async () => {
    renderRoute(<HelpRoute />, '/help');
    expect(await screen.findByRole('heading', {level: 1, name: 'Help'})).toBeInTheDocument();
    const topics = screen.getByRole('navigation', {name: 'Help topics'});
    expect(topics.querySelectorAll('button')).toHaveLength(7);
    expect(screen.getByRole('heading', {level: 2, name: 'Where your data goes'})).toBeInTheDocument();
    expect(screen.getAllByRole('link', {name: 'Open Projects'})[0]).toHaveAttribute('href', '/projects');
  });

  it('filters topics and says when nothing matches', async () => {
    renderRoute(<HelpRoute />, '/help');
    const search = await screen.findByLabelText('Search help');
    fireEvent.change(search, {target: {value: 'sagabackup'}});
    expect(screen.getByRole('heading', {level: 2, name: 'Backups and exports'})).toBeInTheDocument();
    expect(screen.queryByRole('heading', {level: 2, name: 'Setting up AI'})).not.toBeInTheDocument();
    fireEvent.change(search, {target: {value: 'zebra'}});
    expect(screen.getByText(/No help topic matches/)).toHaveAttribute('role', 'status');
  });

  it('opens at the topic named in the address', async () => {
    renderRoute(<HelpRoute />, '/help?topic=privacy');
    const heading = await screen.findByRole('heading', {level: 2, name: 'Where your data goes'});
    expect(heading).toHaveFocus();
  });

  it('moves focus to a topic chosen from the list', async () => {
    renderRoute(<HelpRoute />, '/help');
    fireEvent.click(await screen.findByRole('button', {name: /Setting up AI/}));
    expect(screen.getByRole('heading', {level: 2, name: 'Setting up AI'})).toHaveFocus();
  });

  it('shows the portable export format', async () => {
    renderRoute(<HelpRoute />, '/help');
    expect(await screen.findByText(/worldbuilding-desk\/portable\//)).toBeInTheDocument();
  });
});
