import {describe, expect, it, vi} from 'vitest';
import type {Project, ProjectSettings} from '../entityTypes';

vi.mock('../settingsStorage', () => ({
  getOrCreateSettings: vi.fn(),
  saveProjectSettings: vi.fn(async (settings: ProjectSettings) => settings)
}));

vi.mock('../projectStorage', () => ({
  getProjectById: vi.fn()
}));

const {getOrCreateSettings} = await import('../settingsStorage');
const {getProjectById} = await import('../projectStorage');
const {useAppStore} = await import('./appStore');

const mockedGetOrCreateSettings = vi.mocked(getOrCreateSettings);
const mockedGetProjectById = vi.mocked(getProjectById);

const makeProject = (id: string): Project => ({
  id,
  name: `Project ${id}`,
  createdAt: 1,
  updatedAt: 1
});

const makeSettings = (projectId: string): ProjectSettings =>
  ({
    id: `settings-${projectId}`,
    projectId,
    characterStyles: [],
    aiSettings: {
      provider: 'ollama',
      configs: {},
      promptTools: [],
      defaultToolIds: []
    },
    consistencyActionCues: [],
    activeSkills: [],
    projectMode: 'general',
    featureToggles: {
      enableGameSystems: false,
      enableRuntimeModifiers: false,
      enableSettlementAndZoneSystems: false,
      enableRuleAuthoring: false
    },
    createdAt: 1,
    updatedAt: 1
  }) as ProjectSettings;

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return {promise, resolve, reject};
};

describe('useAppStore', () => {
  it('ignores stale project settings loads when active project changes', async () => {
    useAppStore.setState(useAppStore.getInitialState(), true);
    mockedGetOrCreateSettings.mockReset();
    mockedGetProjectById.mockReset();

    const firstSettings = makeSettings('first');
    const secondSettings = makeSettings('second');
    const first = createDeferred<ProjectSettings>();
    const second = createDeferred<ProjectSettings>();

    mockedGetOrCreateSettings.mockImplementation((projectId) => {
      if (projectId === 'first') return first.promise;
      if (projectId === 'second') return second.promise;
      throw new Error(`Unexpected project ${projectId}`);
    });

    const firstLoad = useAppStore.getState().setActiveProject(makeProject('first'));
    const secondLoad = useAppStore.getState().setActiveProject(makeProject('second'));

    second.resolve(secondSettings);
    await secondLoad;
    expect(useAppStore.getState().projectSettings).toEqual(secondSettings);
    expect(useAppStore.getState().projectSettingsStatus).toBe('ready');

    first.resolve(firstSettings);
    await firstLoad;
    expect(useAppStore.getState().activeProject?.id).toBe('second');
    expect(useAppStore.getState().projectSettings).toEqual(secondSettings);
  });

  it('exposes settings load failures without clearing the selected project', async () => {
    useAppStore.setState(useAppStore.getInitialState(), true);
    mockedGetOrCreateSettings.mockReset();
    mockedGetProjectById.mockReset();
    mockedGetOrCreateSettings.mockRejectedValue(new Error('settings unavailable'));

    await useAppStore.getState().setActiveProject(makeProject('broken'));

    expect(useAppStore.getState().activeProject?.id).toBe('broken');
    expect(useAppStore.getState().projectSettings).toBeNull();
    expect(useAppStore.getState().projectSettingsStatus).toBe('error');
    expect(useAppStore.getState().projectSettingsError).toBe('settings unavailable');
  });
});
