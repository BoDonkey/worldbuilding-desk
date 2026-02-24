import type {ProjectSettings, ProjectAISettings, ProjectMode} from './entityTypes';
import { openDb, SETTINGS_STORE_NAME } from './db';
import {getDefaultFeatureToggles, normalizeFeatureToggles} from './projectMode';

const DEFAULT_AI_SETTINGS: ProjectAISettings = {
  provider: 'anthropic',
  configs: {
    anthropic: {
      model: 'claude-sonnet-4-20250514'
    },
    openai: {
      model: 'gpt-4o-mini'
    },
    gemini: {
      model: 'gemini-2.0-flash'
    },
    ollama: {
      model: 'llama3.1',
      baseUrl: 'http://localhost:11434'
    }
  },
  promptTools: [],
  defaultToolIds: []
};

const DEFAULT_PROJECT_MODE: ProjectMode = 'litrpg';

function ensureAISettings(settings: ProjectSettings): ProjectSettings {
  const aiSettings: ProjectAISettings = {
    ...(settings.aiSettings ?? {...DEFAULT_AI_SETTINGS})
  };

  aiSettings.configs = {
    ...DEFAULT_AI_SETTINGS.configs,
    ...(aiSettings.configs ?? {})
  };
  aiSettings.promptTools = aiSettings.promptTools ?? [];
  aiSettings.defaultToolIds = aiSettings.defaultToolIds ?? [];

  return {
    ...settings,
    aiSettings,
    activeSkills: settings.activeSkills ?? [],
    projectMode: settings.projectMode ?? DEFAULT_PROJECT_MODE,
    featureToggles: normalizeFeatureToggles({
      mode: settings.projectMode ?? DEFAULT_PROJECT_MODE,
      featureToggles: settings.featureToggles
    })
  };
}

export async function getProjectSettings(projectId: string): Promise<ProjectSettings | null> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(SETTINGS_STORE_NAME, 'readonly');
    const store = tx.objectStore(SETTINGS_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const all = request.result as ProjectSettings[];
      const settings = all.find(s => s.projectId === projectId);
      resolve(settings ? ensureAISettings(settings) : null);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function saveProjectSettings(settings: ProjectSettings): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(SETTINGS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(SETTINGS_STORE_NAME);
    const request = store.put(settings);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function createDefaultSettings(projectId: string): Promise<ProjectSettings> {
  const now = Date.now();
  const settings: ProjectSettings = {
    id: crypto.randomUUID(),
    projectId,
    characterStyles: [],
    aiSettings: {...DEFAULT_AI_SETTINGS},
    activeSkills: [],
    projectMode: DEFAULT_PROJECT_MODE,
    featureToggles: getDefaultFeatureToggles(DEFAULT_PROJECT_MODE),
    createdAt: now,
    updatedAt: now
  };

  await saveProjectSettings(settings);
  return settings;
}

export async function getOrCreateSettings(projectId: string): Promise<ProjectSettings> {
  const existing = await getProjectSettings(projectId);
  if (existing) return existing;
  return createDefaultSettings(projectId);
}
