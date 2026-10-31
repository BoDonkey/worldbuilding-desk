import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {UpdateNotice} from './UpdateNotice';
import {UpdatesSettings} from '../Settings/UpdatesSettings';

const base: ElectronUpdateSnapshot = {
  supported: true,
  currentVersion: '0.1.0',
  checkAutomatically: true,
  installMode: 'in-app',
  status: {state: 'idle'}
};

function installBridge(initial: Partial<ElectronUpdateSnapshot>) {
  let listener: ((snapshot: ElectronUpdateSnapshot) => void) | null = null;
  let current: ElectronUpdateSnapshot = {...base, ...initial};
  const updates = {
    get: vi.fn(async () => current),
    check: vi.fn(async () => current),
    download: vi.fn(async () => current),
    install: vi.fn(async () => true),
    setCheckAutomatically: vi.fn(async (value: boolean) => (current = {...current, checkAutomatically: value})),
    openReleasePage: vi.fn(async () => undefined),
    onChange: vi.fn((callback: (snapshot: ElectronUpdateSnapshot) => void) => {
      listener = callback;
      return () => (listener = null);
    })
  };
  window.electronAPI = {llmComplete: vi.fn(), llmStream: vi.fn(), updates} as unknown as ElectronAPI;
  const push = (changes: Partial<ElectronUpdateSnapshot>) =>
    act(() => {
      current = {...current, ...changes};
      listener?.(current);
    });
  return {updates, push};
}

afterEach(() => {
  delete window.electronAPI;
});

describe('UpdateNotice (5.1)', () => {
  it('renders nothing in the browser build or a build that cannot update', async () => {
    const {container, unmount} = render(<UpdateNotice />);
    expect(container).toBeEmptyDOMElement();
    unmount();

    installBridge({supported: false, checkAutomatically: null});
    const unsupported = render(<UpdateNotice />);
    await waitFor(() => expect(window.electronAPI?.updates?.get).toHaveBeenCalled());
    expect(unsupported.container).toBeEmptyDOMElement();
  });

  it('asks once whether to check automatically, without checking first', async () => {
    const {updates} = installBridge({checkAutomatically: null});
    render(<UpdateNotice />);
    expect(await screen.findByText('Check for updates automatically?')).toBeInTheDocument();
    expect(screen.getByText(/sends no project data/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Check automatically'}));

    await waitFor(() => expect(updates.setCheckAutomatically).toHaveBeenCalledWith(true));
    expect(updates.check).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Check for updates automatically?')).toBeNull());
  });

  it('offers a found update, downloads only when asked, then restarts into it', async () => {
    const {updates, push} = installBridge({});
    render(<UpdateNotice />);
    await waitFor(() => expect(updates.get).toHaveBeenCalled());
    push({status: {state: 'available', version: '0.2.0', releaseUrl: 'x'}});
    expect(screen.getByText('SagaSpine 0.2.0 is available.')).toBeInTheDocument();
    expect(updates.download).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: 'Download update'}));
    expect(updates.download).toHaveBeenCalled();

    push({status: {state: 'downloading', version: '0.2.0', percent: 42}});
    expect(screen.getByRole('progressbar', {name: 'Downloading SagaSpine 0.2.0'})).toHaveValue(42);
    push({status: {state: 'downloaded', version: '0.2.0'}});
    fireEvent.click(screen.getByRole('button', {name: 'Restart to update'}));
    expect(updates.install).toHaveBeenCalled();
  });

  it('shows a failed download, but stays quiet about a failed automatic check', async () => {
    const {updates, push} = installBridge({});
    const {container} = render(<UpdateNotice />);
    await waitFor(() => expect(updates.get).toHaveBeenCalled());
    push({status: {state: 'error', message: 'SagaSpine could not check for updates.'}});
    expect(container).toBeEmptyDOMElement();

    push({status: {state: 'available', version: '0.2.0', releaseUrl: 'x'}});
    fireEvent.click(screen.getByRole('button', {name: 'Download update'}));
    push({status: {state: 'error', message: 'The update could not be downloaded. Try again later.'}});
    expect(screen.getByText('Update failed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Dismiss'}));
    expect(container).toBeEmptyDOMElement();
  });

  it('sends macOS authors to the release page, and Later hides the card', async () => {
    const {updates, push} = installBridge({installMode: 'release-page'});
    const {container} = render(<UpdateNotice />);
    await waitFor(() => expect(updates.get).toHaveBeenCalled());
    push({status: {state: 'available', version: '0.2.0', releaseUrl: 'x'}});
    expect(screen.queryByRole('button', {name: 'Download update'})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'Open download page'}));
    expect(updates.openReleasePage).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: 'Later'}));
    expect(container).toBeEmptyDOMElement();
  });
});

describe('UpdatesSettings (5.1)', () => {
  it('changes the automatic-check choice and checks on request', async () => {
    const {updates, push} = installBridge({checkAutomatically: false});
    render(<UpdatesSettings />);
    const toggle = await screen.findByRole('checkbox', {name: 'Check for updates automatically when SagaSpine starts'});
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    await waitFor(() => expect(updates.setCheckAutomatically).toHaveBeenCalledWith(true));

    fireEvent.click(screen.getByRole('button', {name: 'Check for updates'}));
    expect(updates.check).toHaveBeenCalled();
    push({status: {state: 'checking'}});
    expect(screen.getByRole('button', {name: 'Check for updates'})).toBeDisabled();
    push({status: {state: 'up-to-date'}});
    expect(screen.getByRole('status')).toHaveTextContent('SagaSpine is up to date.');
  });

  it('explains that an unpackaged build does not update itself', async () => {
    installBridge({supported: false});
    render(<UpdatesSettings />);
    expect(await screen.findByText(/does not update itself/)).toBeInTheDocument();
  });
});
