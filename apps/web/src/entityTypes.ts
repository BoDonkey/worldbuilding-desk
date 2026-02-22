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
  parentProjectId?: string;
  inheritRag?: boolean;
  inheritShodh?: boolean;
  canonVersion?: string;
  lastSyncedCanon?: string;
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

export type AIProviderId = 'anthropic' | 'openai' | 'gemini' | 'ollama';

export interface AnthropicProviderSettings {
  apiKey?: string;
  model?: string;
}

export interface OpenAIProviderSettings {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export interface GeminiProviderSettings {
  apiKey?: string;
  model?: string;
}

export interface OllamaProviderSettings {
  baseUrl?: string;
  model?: string;
}

export interface ProviderConfigMap {
  anthropic?: AnthropicProviderSettings;
  openai?: OpenAIProviderSettings;
  gemini?: GeminiProviderSettings;
  ollama?: OllamaProviderSettings;
}

export interface ProjectAISettings {
  provider: AIProviderId;
  configs: ProviderConfigMap;
}

export interface ProjectSettings {
  id: string;
  projectId: string;
  characterStyles: CharacterStyle[];
  aiSettings: ProjectAISettings;
  activeSkills: string[];
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

export type CompendiumDomain =
  | 'beast'
  | 'flora'
  | 'mineral'
  | 'artifact'
  | 'recipe'
  | 'custom';

export interface CompendiumActionDefinition {
  id: string;
  label: string;
  points: number;
  repeatable?: boolean;
}

export interface CompendiumEntry {
  id: string;
  projectId: string;
  name: string;
  domain: CompendiumDomain;
  sourceEntityId?: string;
  description?: string;
  tags?: string[];
  actions: CompendiumActionDefinition[];
  createdAt: number;
  updatedAt: number;
}

export interface CompendiumRewardEffect {
  targetType: 'stat' | 'resource' | 'custom';
  targetId: string;
  operation: 'add' | 'multiply' | 'set';
  value: number | string | boolean;
}

export interface CompendiumMilestone {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  pointsRequired: number;
  unlockRecipeIds?: string[];
  permanentEffects?: CompendiumRewardEffect[];
  createdAt: number;
}

export type RecipeCategory = 'food' | 'crafting' | 'alchemy' | 'custom';

export interface RecipeMaterialRequirement {
  itemId: string;
  quantity: number;
}

export interface RecipeRequirements {
  minCharacterLevel?: number;
  requiredMilestoneIds?: string[];
  requiredMaterials?: RecipeMaterialRequirement[];
}

export interface UnlockableRecipe {
  id: string;
  projectId: string;
  name: string;
  category: RecipeCategory;
  description?: string;
  requirements?: RecipeRequirements;
  createdAt: number;
  updatedAt: number;
}

export interface CompendiumProgress {
  id: string;
  projectId: string;
  characterSheetId?: string;
  totalPoints: number;
  unlockedMilestoneIds: string[];
  unlockedRecipeIds: string[];
  updatedAt: number;
}

export interface CompendiumActionLog {
  id: string;
  projectId: string;
  progressId: string;
  entryId: string;
  actionId: string;
  quantity: number;
  pointsAwarded: number;
  createdAt: number;
}

export interface ZoneAffinityMilestone {
  id: string;
  thresholdPercent: number;
  name: string;
  description?: string;
  passiveDescription?: string;
}

export interface ZoneAffinityProfile {
  id: string;
  projectId: string;
  biomeKey: string;
  name: string;
  maxAffinityPoints: number;
  milestones: ZoneAffinityMilestone[];
  createdAt: number;
  updatedAt: number;
}

export interface ZoneAffinityProgress {
  id: string;
  projectId: string;
  biomeKey: string;
  affinityPoints: number;
  totalExposureSeconds: number;
  unlockedMilestoneIds: string[];
  updatedAt: number;
}

export type SettlementModuleSourceType =
  | 'trophy'
  | 'structure'
  | 'station'
  | 'totem'
  | 'custom';

export interface SettlementAuraEffect {
  targetType: 'stat' | 'resource' | 'resistance' | 'custom';
  targetId: string;
  operation: 'add' | 'multiply' | 'set';
  value: number | string | boolean;
}

export interface SettlementModule {
  id: string;
  projectId: string;
  name: string;
  sourceType: SettlementModuleSourceType;
  sourceEntityId?: string;
  auraRadiusMeters: number;
  effects: SettlementAuraEffect[];
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SettlementState {
  id: string;
  projectId: string;
  name: string;
  fortressLevel: number;
  moduleIds: string[];
  updatedAt: number;
}

export interface PartySynergyRule {
  id: string;
  name: string;
  requiredRoles: string[];
  maxDistanceMeters?: number;
  effectDescription: string;
  questPrompt?: string;
}

export interface PartySynergySuggestion {
  ruleId: string;
  ruleName: string;
  matchedCharacterIds: string[];
  missingRoles: string[];
  effectDescription: string;
  questPrompt?: string;
  maxDistanceMeters?: number;
}
