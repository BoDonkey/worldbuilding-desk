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
    expect(topics.querySelectorAll('button')).toHaveLength(8);
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

  it('starts with topics collapsed and opens the one chosen from the list', async () => {
    renderRoute(<HelpRoute />, '/help');
    const heading = await screen.findByRole('heading', {level: 2, name: 'Setting up AI'});
    const topic = heading.closest('details')!;
    expect(topic).not.toHaveAttribute('open');
    fireEvent.click(screen.getByRole('button', {name: /Setting up AI/}));
    expect(topic).toHaveAttribute('open');
  });

  it('opens matching topics while searching, and expands or collapses all', async () => {
    renderRoute(<HelpRoute />, '/help');
    fireEvent.change(await screen.findByLabelText('Search help'), {target: {value: 'sagabackup'}});
    expect(screen.getByRole('heading', {level: 2, name: 'Backups and exports'}).closest('details')).toHaveAttribute('open');
    fireEvent.change(screen.getByLabelText('Search help'), {target: {value: ''}});
    fireEvent.click(screen.getByRole('button', {name: 'Expand all'}));
    for (const topic of document.querySelectorAll('details')) expect(topic).toHaveAttribute('open');
    fireEvent.click(screen.getByRole('button', {name: 'Collapse all'}));
    for (const topic of document.querySelectorAll('details')) expect(topic).not.toHaveAttribute('open');
  });

  it('shows the portable export format as a readable topic', async () => {
    renderRoute(<HelpRoute />, '/help?topic=portable-format');
    const heading = await screen.findByRole('heading', {level: 2, name: 'Portable export format'});
    const topic = heading.closest('details')!;
    expect(topic).toHaveAttribute('open');
    expect(topic.textContent).toMatch(/worldbuilding-desk\/portable\//);
    expect(topic.textContent).not.toContain('# SagaSpine');
    expect(topic.querySelector('code')?.textContent).toBe('README.md');
  });
});
