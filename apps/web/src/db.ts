export const DB_NAME = 'worldbuilding-db';
export const DB_VERSION = 24;
export const ENTITY_STORE_NAME = 'entities';
export const CATEGORY_STORE_NAME = 'entityCategories';
export const PROJECT_STORE_NAME = 'projects';
export const WRITING_STORE_NAME = 'writingDocuments';
export const SCRATCHPAD_STORE_NAME = 'scratchpads';
export const CORKBOARD_CHAPTER_CARD_STORE_NAME = 'corkboard_chapter_cards';
export const SETTINGS_STORE_NAME = 'projectSettings';
export const CHARACTER_STORE_NAME = 'characters';
export const CHARACTER_SHEET_STORE_NAME = 'character_sheets';
export const LORE_DOCUMENT_STORE_NAME = 'lore_documents';
export const LORE_DOCUMENT_LINK_STORE_NAME = 'lore_document_links';
export const LORE_FACT_PROPOSAL_STORE_NAME = 'lore_fact_proposals';
export const LORE_ENTITY_PROPOSAL_STORE_NAME = 'lore_entity_proposals';
export const CANONICAL_FACT_STORE_NAME = 'canonical_facts';
export const CANON_DECISION_CLUSTER_STORE_NAME = 'canon_decision_clusters';
export const CANON_DECISION_SUPPRESSION_STORE_NAME = 'canon_decision_suppressions';
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
export const STATE_MUTATION_EVENT_STORE_NAME = 'state_mutation_events';

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

      if (!db.objectStoreNames.contains(SCRATCHPAD_STORE_NAME)) {
        db.createObjectStore(SCRATCHPAD_STORE_NAME, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(CORKBOARD_CHAPTER_CARD_STORE_NAME)) {
        db.createObjectStore(CORKBOARD_CHAPTER_CARD_STORE_NAME, { keyPath: 'id' });
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

      if (!db.objectStoreNames.contains(LORE_DOCUMENT_STORE_NAME)) {
        db.createObjectStore(LORE_DOCUMENT_STORE_NAME, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(LORE_DOCUMENT_LINK_STORE_NAME)) {
        db.createObjectStore(LORE_DOCUMENT_LINK_STORE_NAME, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(LORE_FACT_PROPOSAL_STORE_NAME)) {
        db.createObjectStore(LORE_FACT_PROPOSAL_STORE_NAME, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(LORE_ENTITY_PROPOSAL_STORE_NAME)) {
        db.createObjectStore(LORE_ENTITY_PROPOSAL_STORE_NAME, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(CANONICAL_FACT_STORE_NAME)) {
        db.createObjectStore(CANONICAL_FACT_STORE_NAME, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(CANON_DECISION_CLUSTER_STORE_NAME)) {
        db.createObjectStore(CANON_DECISION_CLUSTER_STORE_NAME, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(CANON_DECISION_SUPPRESSION_STORE_NAME)) {
        db.createObjectStore(CANON_DECISION_SUPPRESSION_STORE_NAME, { keyPath: 'id' });
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

      if (!db.objectStoreNames.contains(STATE_MUTATION_EVENT_STORE_NAME)) {
        db.createObjectStore(STATE_MUTATION_EVENT_STORE_NAME, {
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
