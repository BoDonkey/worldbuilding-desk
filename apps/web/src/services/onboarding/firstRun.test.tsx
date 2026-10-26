import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createFirstRunProject, hasCheckedFirstRun} from './firstRun';

const storageMocks = vi.hoisted(() => ({
  saveProject: vi.fn(),
  createDefaultSettings: vi.fn(),
  saveWritingDocument: vi.fn()
}));

vi.mock('../storage', () => storageMocks);

beforeEach(() => {
  vi.clearAllMocks();
  storageMocks.createDefaultSettings.mockResolvedValue({
    projectId: 'generated-project',
    projectMode: 'litrpg',
    featureToggles: {}
  });
});

// .test.tsx so this runs under vitest's jsdom project (see vitest.config.ts), which has
// real browser localStorage — unlike the plain-node project used by most service tests.
afterEach(() => {
  localStorage.clear();
  delete (window as {Cypress?: unknown}).Cypress;
});

describe('hasCheckedFirstRun', () => {
  it('is false before the check has ever run', () => {
    expect(hasCheckedFirstRun()).toBe(false);
  });

  it('is true once the localStorage flag is set', () => {
    localStorage.setItem('wbd:first-run-checked', 'true');
    expect(hasCheckedFirstRun()).toBe(true);
  });

  it('is always true under Cypress, regardless of the stored flag, so e2e specs never race an unrequested first-run project', () => {
    (window as {Cypress?: unknown}).Cypress = {};
    expect(hasCheckedFirstRun()).toBe(true);
  });
});

describe('createFirstRunProject', () => {
  it('creates the one-time blank General Fiction starting project', async () => {
    const saveProjectSettings = vi.fn();
    const project = await createFirstRunProject({saveProjectSettings});

    expect(project.name).toBe('My First Project');
    expect(storageMocks.saveProject).toHaveBeenCalledWith(project);
    expect(saveProjectSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        projectMode: 'general',
        featureToggles: expect.objectContaining({enableGameSystems: false})
      })
    );
    expect(storageMocks.saveWritingDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: project.id,
        title: 'Chapter One',
        content: ''
      })
    );
    expect(hasCheckedFirstRun()).toBe(false);
  });
});
