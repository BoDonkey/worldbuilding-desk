export const DB_NAME = 'worldbuilding-db';
export const DB_VERSION = 13;
export const ENTITY_STORE_NAME = 'entities';
export const CATEGORY_STORE_NAME = 'entityCategories';
export const PROJECT_STORE_NAME = 'projects';
export const WRITING_STORE_NAME = 'writingDocuments';
export const SETTINGS_STORE_NAME = 'projectSettings';
export const CHARACTER_STORE_NAME = 'characters';
export const CHARACTER_SHEET_STORE_NAME = 'character_sheets';
export const COMPENDIUM_ENTRY_STORE_NAME = 'compendium_entries';
export const COMPENDIUM_MILESTONE_STORE_NAME = 'compendium_milestones';
export const COMPENDIUM_RECIPE_STORE_NAME = 'compendium_recipes';
export const COMPENDIUM_PROGRESS_STORE_NAME = 'compendium_progress';
export const COMPENDIUM_ACTION_LOG_STORE_NAME = 'compendium_action_logs';
export const ZONE_AFFINITY_PROFILE_STORE_NAME = 'zone_affinity_profiles';
export const ZONE_AFFINITY_PROGRESS_STORE_NAME = 'zone_affinity_progress';
export const SETTLEMENT_MODULE_STORE_NAME = 'settlement_modules';
export const SETTLEMENT_STATE_STORE_NAME = 'settlement_state';
export const CONSISTENCY_PROPOSAL_STORE_NAME = 'consistency_proposals';
export const CONSISTENCY_EVENT_STORE_NAME = 'consistency_events';
export const CONSISTENCY_ALIAS_STORE_NAME = 'consistency_aliases';

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(ENTITY_STORE_NAME)) {
        db.createObjectStore(ENTITY_STORE_NAME, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(PROJECT_STORE_NAME)) {
        db.createObjectStore(PROJECT_STORE_NAME, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(WRITING_STORE_NAME)) {
        db.createObjectStore(WRITING_STORE_NAME, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
        db.createObjectStore(SETTINGS_STORE_NAME, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(CHARACTER_STORE_NAME)) {
        db.createObjectStore(CHARACTER_STORE_NAME, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(CHARACTER_SHEET_STORE_NAME)) {
        db.createObjectStore(CHARACTER_SHEET_STORE_NAME, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(CATEGORY_STORE_NAME)) {
        db.createObjectStore(CATEGORY_STORE_NAME, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(COMPENDIUM_ENTRY_STORE_NAME)) {
        db.createObjectStore(COMPENDIUM_ENTRY_STORE_NAME, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(COMPENDIUM_MILESTONE_STORE_NAME)) {
        db.createObjectStore(COMPENDIUM_MILESTONE_STORE_NAME, {
          keyPath: 'id'
        });
      }

      if (!db.objectStoreNames.contains(COMPENDIUM_RECIPE_STORE_NAME)) {
        db.createObjectStore(COMPENDIUM_RECIPE_STORE_NAME, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(COMPENDIUM_PROGRESS_STORE_NAME)) {
        db.createObjectStore(COMPENDIUM_PROGRESS_STORE_NAME, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(COMPENDIUM_ACTION_LOG_STORE_NAME)) {
        db.createObjectStore(COMPENDIUM_ACTION_LOG_STORE_NAME, {
          keyPath: 'id'
        });
      }

      if (!db.objectStoreNames.contains(ZONE_AFFINITY_PROFILE_STORE_NAME)) {
        db.createObjectStore(ZONE_AFFINITY_PROFILE_STORE_NAME, {
          keyPath: 'id'
        });
      }

      if (!db.objectStoreNames.contains(ZONE_AFFINITY_PROGRESS_STORE_NAME)) {
        db.createObjectStore(ZONE_AFFINITY_PROGRESS_STORE_NAME, {
          keyPath: 'id'
        });
      }

      if (!db.objectStoreNames.contains(SETTLEMENT_MODULE_STORE_NAME)) {
        db.createObjectStore(SETTLEMENT_MODULE_STORE_NAME, {
          keyPath: 'id'
        });
      }

      if (!db.objectStoreNames.contains(SETTLEMENT_STATE_STORE_NAME)) {
        db.createObjectStore(SETTLEMENT_STATE_STORE_NAME, {
          keyPath: 'id'
        });
      }

      if (!db.objectStoreNames.contains(CONSISTENCY_PROPOSAL_STORE_NAME)) {
        db.createObjectStore(CONSISTENCY_PROPOSAL_STORE_NAME, {
          keyPath: 'id'
        });
      }

      if (!db.objectStoreNames.contains(CONSISTENCY_EVENT_STORE_NAME)) {
        db.createObjectStore(CONSISTENCY_EVENT_STORE_NAME, {
          keyPath: 'id'
        });
      }

      if (!db.objectStoreNames.contains(CONSISTENCY_ALIAS_STORE_NAME)) {
        db.createObjectStore(CONSISTENCY_ALIAS_STORE_NAME, {
          keyPath: 'id'
        });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}
