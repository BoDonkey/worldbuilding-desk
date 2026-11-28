import type {PlaceData, UnitConversion} from './placeTypes';
export type {
  AuthoredMeasure,
  PlaceTravelTime,
  PlaceConnection,
  PlaceData,
  PlacePlacement,
  WorldMap,
  MapGrid,
  MapImage,
  UnitConversion
} from './placeTypes';

import type { WorldRuleset } from '@worldbuilding-desk/rules-engine';

export interface EntityFields {
  notes?: string;
  [key: string]: unknown;
}

export interface Project {
  id: string;
  name: string;
  /** Persisted application-data schema. Independent from IndexedDB DB_VERSION. */
  storageSchemaVersion?: number;
  description?: string;
  rulesetId?: string;
  parentProjectId?: string;
  inheritRag?: boolean;
  inheritShodh?: boolean;
  canonVersion?: string;
  lastSyncedCanon?: string;
  /** When a backup of this project last succeeded (4.93). Never bumps `updatedAt`. */
  lastBackupAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface WritingDocument {
  id: string;
  projectId: string;
  title: string;
  content: string;
  consistencyReviewMode?: 'default' | 'deferred';
  order?: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Why a scene snapshot was taken (slice 4.95). `manual` is Take snapshot; the
 * rest are automatic: before an AI revision is applied, before another
 * snapshot is restored, the first edit of a scene each day, and just before
 * the scene is deleted (deleting a scene keeps its snapshots). `milestone`
 * snapshots are taken of every scene at once by a draft milestone (4.96).
 */
export type SceneSnapshotKind =
  'manual' | 'before-ai' | 'before-restore' | 'daily' | 'before-delete' | 'milestone' | 'before-rewrite' | 'alternative';

/**
 * A saved copy of a scene's text (slice 4.95). The author's own words, kept
 * for comparing and restoring: never canon, never sent to a model, never read
 * by review or retrieval.
 */
export interface SceneSnapshot {
  id: string;
  projectId: string;
  /** The `WritingDocument` it is a copy of, which may since have been deleted. */
  sceneId: string;
  /** The scene's title when the snapshot was taken, to name a deleted scene. */
  sceneTitle?: string;
  /** The scene's HTML as it was. */
  content: string;
  /** The author's name for it ("Draft 1"); automatic snapshots have none. */
  name?: string;
  kind: SceneSnapshotKind;
  /** Draft milestone (4.96): its id and the scene's order then; `name` is the milestone's. */
  milestone?: {id: string; order: number};
  /** Passage alternative (4.97): `content` is the rewrite; the original HTML and text to find it by. */
  passage?: {original: string; originalText: string};
  wordCount: number;
  createdAt: number;
}

export interface ScratchpadDocument {
  id: string;
  projectId: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export type WorldCanvasLensKind =
  | 'people'
  | 'places'
  | 'factions'
  | 'history'
  | 'power'
  | 'customs'
  | 'constraints';

export type WorldCanvasThreadStatus = 'open' | 'settled' | 'set_aside';

export interface WorldCanvasOpenThread {
  id: string;
  text: string;
  status: WorldCanvasThreadStatus;
  lensKind?: WorldCanvasLensKind;
  /** Set when the author retained this thread from a World Canvas brainstorm item. */
  origin?: 'brainstorm';
  linkedSourceNoteId?: string;
  linkedEntityId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface WorldCanvasSketch {
  id: string;
  text: string;
  linkedSourceNoteIds: string[];
  linkedEntityIds: string[];
  linkedOpenThreadIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface WorldCanvasLens {
  kind: WorldCanvasLensKind;
  sketches: WorldCanvasSketch[];
  activeSketchId: string;
  /** Optional so canvases saved before 4.34 continue to open expanded. */
  isCollapsed?: boolean;
  updatedAt: number;
}

/**
 * The first-mechanics form an author started on a World Bible character but
 * has not confirmed (slice 3.23c). One per character; deleted on confirm or
 * cancel. `defaultValue` keeps the author's text as typed.
 */
export interface MechanicsDraft {
  id: string;
  projectId: string;
  entityId: string;
  kind: 'stat' | 'resource';
  name: string;
  defaultValue: string;
  updatedAt: number;
}

export interface WorldCanvasDocument {
  schemaVersion: 2;
  id: string;
  projectId: string;
  premise: string;
  coreIdeaSourceNoteId?: string;
  coreIdeaEntityId?: string;
  lenses: WorldCanvasLens[];
  openThreads: WorldCanvasOpenThread[];
  createdAt: number;
  updatedAt: number;
}

export type ChapterCardStatus = 'planned' | 'draft' | 'written';

export interface PlotPoint {
  id: string;
  chapterCardId: string;
  title: string;
  notes?: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface ChapterCard {
  id: string;
  projectId: string;
  title: string;
  summary: string;
  status: ChapterCardStatus;
  order: number;
  /** Explicit planning-to-draft links. Never inferred from title or order. */
  sceneIds?: string[];
  plotPoints: PlotPoint[];
  createdAt: number;
  updatedAt: number;
}

export type SystemHistoryCategory =
  | 'scene'
  | 'consistency'
  | 'resource'
  | 'quest'
  | 'system';

export interface SystemHistoryEntry {
  id: string;
  projectId: string;
  category: SystemHistoryCategory;
  message: string;
  insertText: string;
  sourceKey?: string;
  sceneId?: string;
  createdAt: number;
}

export type AIProviderId = 'anthropic' | 'openai' | 'gemini' | 'ollama' | 'local-openai';

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

/** A local server that speaks the OpenAI chat-completions API (KoboldCPP, LM Studio, llama.cpp). */
export interface LocalOpenAIProviderSettings {
  baseUrl?: string;
  model?: string;
  /** Reply cap in tokens for a server that does not report its context size (Slice 4.75). */
  maxReplyTokens?: number;
}

export interface ProviderConfigMap {
  anthropic?: AnthropicProviderSettings;
  openai?: OpenAIProviderSettings;
  gemini?: GeminiProviderSettings;
  ollama?: OllamaProviderSettings;
  'local-openai'?: LocalOpenAIProviderSettings;
}

export interface ProjectAISettings {
  provider: AIProviderId;
  configs: ProviderConfigMap;
  promptTools: PromptTool[];
  /**
   * One-shot AI actions run on selected text from the selection menu (Slice 5.19). Separate
   * from prompt tools. Unset means the shipped presets, all switched off; see
   * `services/assistant/selectionActions.ts`.
   */
  selectionActions?: SelectionAction[];
  defaultToolIds: string[];
  defaultToolIdsByMode?: Record<ProjectMode, string[]>;
  inspectorSettings?: InspectorSettings;
  /**
   * AI coaching switch (Slice 5.18): AI that reads and responds and never writes into the
   * manuscript. Off unless true. Per project; see `services/llm/aiSwitches.ts`.
   */
  aiCoaching?: boolean;
  /** AI prose switch (Slice 5.18): model-written text into the manuscript. Off unless true. */
  aiProse?: boolean;
  /**
   * Lets the AI draft whole scenes on request (Slice 4.52). Off by default and
   * per project: child projects do not copy it. Drafts are previews until the
   * author inserts them, and inserted text is marked as AI text.
   */
  allowSceneDrafts?: boolean;
  /**
   * Adds World Bible records one hop from a grounded character to the model's
   * context, within the context budget (Slice 4.71). Off by default.
   */
  includeLinkedRecords?: boolean;
}

export interface InspectorSettings {
  reviewEngineMode?: 'deterministic' | 'local-ai-preview';
  canonDecisionProviderMode?: 'project-provider' | 'local-ollama';
  maxConsultationsPerDay: number;
  maxContextChars: number;
  maxResponseTokens: number;
  lowCostModel?: string;
}

/**
 * Standing instructions the author can tick in the assistant. Tools saved
 * before the type was removed may still carry a `kind`; it is ignored.
 */
export interface PromptTool {
  id: string;
  name: string;
  content: string;
  enabled: boolean;
}

/** `replace` rewrites the selection (AI prose); `note` answers about it and edits nothing (AI coaching). */
export type SelectionActionOutput = 'replace' | 'note';

export interface SelectionAction {
  id: string;
  name: string;
  instructions: string;
  /** The selection is always sent; these add the current scene and the World Bible records it names. */
  includeScene: boolean;
  includeWorldBible: boolean;
  output: SelectionActionOutput;
  enabled: boolean;
  /** Set on an action installed from a preset, so Install presets can tell which are missing. */
  presetId?: string;
}

export type ProjectMode = 'litrpg' | 'game' | 'general';
export type WorkspaceImportMode = 'strict' | 'balanced' | 'lenient';

export interface ProjectFeatureToggles {
  enableGameSystems: boolean;
  enableRuntimeModifiers: boolean;
  enableSettlementAndZoneSystems: boolean;
  enableRuleAuthoring: boolean;
}

export type StatBlockSourceType = 'character' | 'item';
export type StatBlockStyle = 'full' | 'buffs' | 'compact';
export type StatBlockInsertMode = 'block' | 'template';
export type StatBlockScopePreset = 'all' | 'stats' | 'resources' | 'custom';

export interface StatBlockGroup {
  id: string;
  name: string;
  statIds: string[];
  resourceIds: string[];
}

export interface StatBlockPreferences {
  sourceType: StatBlockSourceType;
  style: StatBlockStyle;
  insertMode: StatBlockInsertMode;
  scopePreset?: StatBlockScopePreset;
  selectedGroupId?: string;
  selectedStatIds?: string[];
  selectedResourceIds?: string[];
  groups?: StatBlockGroup[];
}

export type InlineHighlightsMode = 'visible' | 'subtle' | 'hidden-while-typing';

export interface EditorFeedbackSettings {
  inlineHighlightsMode: InlineHighlightsMode;
}

export interface ProjectSettings {
  id: string;
  projectId: string;
  characterStyles: CharacterStyle[];
  aiSettings: ProjectAISettings;
  consistencyActionCues: string[];
  ignoredUnknownSurfaces?: string[];
  ignoredEntityMatchKeys?: string[];
  keptSeparateCharacterIdentityKeys?: string[];
  /** Position names the author chose to keep as text instead of linking to a place (slice 4.77). */
  placeNamesKeptAsText?: string[];
  /** Author-set conversions between distance units, used to add up routes (slice 4.79). */
  unitConversions?: UnitConversion[];
  activeSkills: string[];
  projectMode: ProjectMode;
  featureToggles: ProjectFeatureToggles;
  defaultImportMode?: WorkspaceImportMode;
  defaultSkipImportSuggestions?: boolean;
  statBlockPreferences?: StatBlockPreferences;
  editorFeedback?: EditorFeedbackSettings;
  createdAt: number;
  updatedAt: number;
}

export interface Character {
  id: string;
  projectId: string;
  entityId?: string;
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

export interface CharacterTrackedEntry {
  id: string;
  mode: 'quick' | 'cataloged';
  name: string;
  quantity?: number;
  notes?: string;
  sourceEntityId?: string;
  definitionId?: string;
}

export interface CharacterSheet {
  id: string;
  projectId: string;
  characterEntityId?: string;
  characterId?: string;
  name: string;
  level: number;
  experience: number;
  stats: CharacterStat[];
  resources: CharacterResource[];
  inventory: string[];
  equipment?: string[];
  statuses?: string[];
  inventoryEntries?: CharacterTrackedEntry[];
  equipmentEntries?: CharacterTrackedEntry[];
  statusEntries?: CharacterTrackedEntry[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

// The manuscript-time state model lives in the rules engine (Slice 3.10).
export type {
  StateMutationActorId,
  StateMutationInventoryQuantity,
  ResourceChangeStateMutationCommand,
  ResourceSetStateMutationCommand,
  StatChangeStateMutationCommand,
  StatSetStateMutationCommand,
  StatusStateMutationCommand,
  InventoryQuantityStateMutationCommand,
  InventoryEquipStateMutationCommand,
  LocationSetStateMutationCommand,
  StateMutationCommand,
  StateMutationEvent
} from '@worldbuilding-desk/rules-engine';

export interface EntityCategory {
  id: string;
  projectId: string;
  kind: 'character' | 'general';
  /** Explicit built-in semantics; custom category names and slugs remain free-form. */
  recordType?: 'system-negative-space';
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
  /** Author-maintained structure for problems that progression cannot solve. */
  systemNegativeSpace?: {
    status: 'open' | 'worsening' | 'changed' | 'resolved';
    sceneIds: string[];
  };
  /** Containment and connections for a location record (slice 4.76). */
  place?: PlaceData;
  /**
   * The image shown for this record in lists and at the top of the record
   * (slice 4.100). The full image is an `EntityImage`; only a small thumbnail
   * lives here. Display only: AI surfaces never read it.
   */
  portrait?: EntityPortrait;
  isNew?: boolean;
  needsCompletion?: boolean;
  aliasesReviewedAt?: number;
  links: string[];
  createdAt: number;
  updatedAt: number;
}

/** The chosen image of a World Bible record, with a small thumbnail for lists (slice 4.100). */
export interface EntityPortrait {
  imageId: string;
  /** About 160 px on the longer side; the full image is the `EntityImage`. */
  thumbnailDataUrl: string;
}

/**
 * An image on a World Bible record (slice 4.100), stored in its own store so
 * loading records never loads full images. No size limit (author decision,
 * 2026-11-28). Display only: AI surfaces never read images.
 */
export interface EntityImage {
  id: string;
  projectId: string;
  entityId: string;
  dataUrl: string;
  mimeType: string;
  width: number;
  height: number;
  byteLength: number;
  fileName?: string;
  createdAt: number;
}

export type LoreDocumentKind =
  | 'character_dossier'
  | 'place_history'
  | 'faction_notes'
  | 'item_history'
  | 'myth'
  | 'timeline'
  | 'general_lore';

export type LoreDocumentFormat = 'plain_text' | 'markdown' | 'html';

export interface LoreDocument {
  id: string;
  projectId: string;
  title: string;
  kind: LoreDocumentKind;
  format: LoreDocumentFormat;
  content: string;
  summary?: string;
  source:
    | {type: 'manual'}
    | {type: 'import'; fileName: string; mimeType?: string}
    | {type: 'ai-session'; sessionId: string};
  status: 'active' | 'archived';
  createdAt: number;
  updatedAt: number;
}

export interface LoreDocumentLink {
  id: string;
  projectId: string;
  loreDocumentId: string;
  targetType: 'character' | 'entity';
  targetId: string;
  relationship: 'primary_subject' | 'secondary_subject' | 'mentions' | 'supports';
  createdAt: number;
}

export type CanonicalFactValue =
  | string
  | {
      label: string;
      value: string;
    };

export type CanonicalFactType =
  | 'alias'
  | 'age'
  | 'occupation'
  | 'membership'
  | 'heritage'
  /** Gender and pronouns. */
  | 'identity'
  | 'appearance'
  | 'trait'
  | 'ability'
  | 'relationship'
  | 'goal'
  | 'background';

export interface LoreFactProposal {
  id: string;
  projectId: string;
  loreDocumentId: string;
  targetType?: 'character' | 'entity';
  targetId?: string;
  targetName?: string;
  factType: CanonicalFactType;
  value: CanonicalFactValue;
  confidence: number;
  evidence: {
    start: number;
    end: number;
    text: string;
  };
  status: 'proposed' | 'accepted' | 'rejected';
  createdAt: number;
  updatedAt: number;
}

export type LoreEntityKind =
  | 'character'
  | 'location'
  | 'item'
  | 'faction'
  | 'concept';

export interface LoreEntityProposal {
  id: string;
  projectId: string;
  loreDocumentId: string;
  name: string;
  entityKind: LoreEntityKind;
  confidence: number;
  evidence: {
    start: number;
    end: number;
    text: string;
  };
  targetType?: 'character' | 'entity';
  targetId?: string;
  status: 'proposed' | 'accepted' | 'rejected';
  createdAt: number;
  updatedAt: number;
}

export type CanonDecisionKind = 'entity_identity' | 'fact_conflict';

export type CanonDecisionResolution =
  | 'merge'
  | 'alias'
  | 'keep_separate'
  | 'accept_new'
  | 'accept_update'
  | 'reject'
  | 'defer';

export interface CanonDecisionClusterMemberRef {
  type:
    | 'lore_entity_proposal'
    | 'lore_fact_proposal'
    | 'canonical_fact'
    | 'character'
    | 'world_entity';
  id: string;
}

export interface CanonDecisionCluster {
  id: string;
  projectId: string;
  kind: CanonDecisionKind;
  title: string;
  summary: string;
  memberRefs: CanonDecisionClusterMemberRef[];
  status: 'open' | 'resolved' | 'deferred';
  suggestedResolution?: CanonDecisionResolution;
  resolution?: CanonDecisionResolution;
  reasonCodes: string[];
  createdAt: number;
  updatedAt: number;
}

export interface CanonDecisionSuppression {
  id: string;
  projectId: string;
  kind: 'entity_identity' | 'fact_conflict';
  key: string;
  resolution: Extract<
    CanonDecisionResolution,
    'alias' | 'keep_separate' | 'reject' | 'accept_update'
  >;
  createdAt: number;
  updatedAt: number;
}

export interface CanonicalFact {
  id: string;
  projectId: string;
  targetType: 'character' | 'entity';
  targetId: string;
  targetName?: string;
  loreDocumentId?: string;
  sourceLoreDocumentTitle?: string;
  sourceProposalId?: string;
  factType: CanonicalFactType;
  value: CanonicalFactValue;
  evidenceText?: string;
  evidenceStart?: number;
  evidenceEnd?: number;
  /** Inclusive manuscript boundary, resolved from the scene's current order at use time. */
  validFromSceneId?: string;
  /** Exclusive manuscript boundary: the fact no longer applies as of this scene. */
  validUntilSceneId?: string;
  acceptedAt: number;
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

export type MechanicsProgressScope = 'global' | 'character' | 'party';
export type CompendiumMechanicKind = 'discovery' | 'zone' | 'settlement' | 'general';

export type CompendiumConsumableEffect =
  | {
      type: 'stat_change';
      definitionId: string;
      delta: number;
    }
  | {
      type: 'resource_change';
      definitionId: string;
      delta: number;
    };

export interface CompendiumConsumableDefinition {
  durationLabel?: string;
  statusName?: string;
  effects: CompendiumConsumableEffect[];
}

export interface CompendiumEntry {
  id: string;
  projectId: string;
  name: string;
  domain: CompendiumDomain;
  sourceEntityId?: string;
  description?: string;
  tags?: string[];
  mechanicKind?: CompendiumMechanicKind;
  progressScope?: MechanicsProgressScope;
  needsCompletion?: boolean;
  consumable?: CompendiumConsumableDefinition;
  actions: CompendiumActionDefinition[];
  createdAt: number;
  updatedAt: number;
}

export interface CompendiumMilestone {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  pointsRequired: number;
  unlockRecipeIds?: string[];
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
  sourceEntityId?: string;
  progressScope?: MechanicsProgressScope;
  maxAffinityPoints: number;
  milestones: ZoneAffinityMilestone[];
  createdAt: number;
  updatedAt: number;
}

export interface ZoneAffinityProgress {
  id: string;
  projectId: string;
  biomeKey: string;
  characterSheetId?: string;
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
  sourceEntityId?: string;
  fortressLevel: number;
  baseStats: {
    defense: number;
    storageCapacity: number;
    craftingThroughput: number;
    morale: number;
  };
  moduleIds: string[];
  updatedAt: number;
}

export interface FortressTierDefinition {
  id: string;
  levelRequired: number;
  name: string;
  description?: string;
  effects: SettlementAuraEffect[];
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
