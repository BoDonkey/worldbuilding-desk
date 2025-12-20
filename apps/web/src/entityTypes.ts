import type { WorldRuleset } from '@litrpg-tool/rules-engine';

export type EntityType = 'character' | 'location' | 'item' | 'rule';

export interface EntityFields {
  notes?: string;
  [key: string]: unknown;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  rulesetId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface WritingDocument {
  id: string;
  projectId: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectSettings {
  id: string;
  projectId: string;
  characterStyles: CharacterStyle[];
  createdAt: number;
  updatedAt: number;
}

export interface Character {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  characterStyleId?: string;
  fields: {
    age?: string;
    role?: string;
    notes?: string;
    [key: string]: unknown;
  };
  createdAt: number;
  updatedAt: number;
}

export interface CharacterStyle {
  id: string;
  name: string;
  markName: string; // e.g., 'characterDialogue', 'systemMessage'
  styles: {
    fontFamily?: string;
    fontSize?: string;
    color?: string;
    backgroundColor?: string;
    fontWeight?: 'normal' | 'bold';
    fontStyle?: 'normal' | 'italic';
  };
}

export interface CharacterStat {
  definitionId: string;  // Links to StatDefinition.id from ruleset
  value: number;
  modifiers?: Array<{
    source: string;
    value: number;
    type: 'flat' | 'multiplier';
  }>;
}

export interface CharacterResource {
  definitionId: string;  // Links to ResourceDefinition.id from ruleset
  current: number;
  max: number;
}

// apps/web/src/entityTypes.ts
export interface CharacterSheet {
  id: string;
  projectId: string;
  characterId?: string;
  name: string;
  level: number;
  experience: number;
  stats: CharacterStat[];
  resources: CharacterResource[];
  inventory: string[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface EntityCategory {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  fieldSchema: FieldDefinition[];
  icon?: string;
  createdAt: number;
}

export interface FieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'checkbox' | 'dice' | 'modifier';
  options?: string[]; // For select/multiselect
  diceConfig?: {
    allowMultipleDice: boolean; // e.g., "3d6" vs just "1d20"
  };
  required?: boolean;
}

export interface WorldEntity {
  id: string;
  projectId: string;
  categoryId: string;
  name: string;
  fields: EntityFields;
  links: string[];
  createdAt: number;
  updatedAt: number;
}

export interface StoredRuleset extends WorldRuleset {
  projectId: string;
}