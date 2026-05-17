import {useCallback, useEffect, useMemo, useState} from 'react';
import type {Dispatch, MutableRefObject, SetStateAction} from 'react';
import type {
  CanonicalFact,
  Character,
  CharacterSheet,
  EntityCategory,
  Project,
  ProjectSettings,
  StateMutationEvent,
  StoredRuleset,
  WorldEntity,
  WritingDocument
} from '../entityTypes';
import {saveWritingDocument} from '../writingStorage';
import {getCategoriesByProject, initializeDefaultCategories} from '../categoryStorage';
import {saveEntity} from '../entityStorage';
import {saveCharacter} from '../characterStorage';
import type {RAGProvider} from '../services/rag/RAGService';
import type {
  ConsistencyAlias,
  GuardrailIssue
} from '../services/consistency';
import {findCanonContradictions, saveAlias} from '../services/consistency';
import {deriveFirstNameAlias} from '../services/worldBible/worldBibleCanonicalization';
import type {WorldEngine} from '../services/worldEngine';
import type {WorldEngineStatus} from '../services/worldEngine';
import type {ReviewIssueAnnotation} from '../services/worldEngine';
import type {ShodhMemoryProvider} from '../services/shodh/ShodhMemoryService';
import {normalizeCanonText} from '../services/consistency/textMatcher';
import {htmlToPlainText} from '../utils/textHelpers';
import {buildDerivedStateMutationEvents} from '../services/state/stateMutationDerivation';
import {
  invalidateStateMutationEventById,
  replaceSceneStateMutationEventsBySourceType,
  saveStateMutationEvent
} from '../services/state/stateMutationLedger';
import {describeStateMutationEventStaleness, getStateMutationEventStaleness} from '../services/state/stateMutationStaleness';
import {
  buildStateMutationPreview,
  computeBatchAcceptableStateMutationEventIds,
  describeStateMutationAcceptance,
  summarizeStateMutationCommand
} from '../services/state/stateMutationPresentation';

type FeedbackState = {
  tone: 'success' | 'error';
  message: string;
} | null;

interface ResolverNotice {
  message: string;
  primaryLabel?: string;
  destination?:
    | 'world-bible'
    | 'characters'
    | 'character-sheets'
    | 'character-sheet-create';
  targetId?: string;
  matchEntityId?: string;
  sourceName?: string;
}

interface LinkUnknownEntityResult {
  destination: 'world-bible' | 'characters' | 'character-sheets' | 'character-sheet-create';
  targetId?: string;
  focus?: 'general' | 'aliases';
}

type LinkTargetOption = {
  id: string;
  name: string;
  type: 'character' | 'entity';
  label: string;
};

type SuggestedUnknownCategory =
  | 'character'
  | 'location'
  | 'item'
  | 'creature'
  | 'faction'
  | 'flora'
  | 'mineral'
  | 'artifact'
  | 'concept'
  | null;

interface ConsistencyReviewItem {
  id: string;
  sceneId: string;
  sceneTitle: string;
  issue: GuardrailIssue;
  reviewAnnotation?: ReviewIssueAnnotation;
}

export interface StateMutationReviewItem {
  id: string;
  sceneId: string;
  sceneTitle: string;
  sceneSequence?: number;
  actorLabel: string;
  summaryLines: string[];
  effectLines: string[];
  validationIssues: string[];
  canAccept: boolean;
  canAcceptInBatch: boolean;
  acceptanceHint: string | null;
  isStale: boolean;
  staleLabel: string | null;
}

export interface StateMutationReviewGroupHiddenCounts {
  [sceneId: string]: number;
}

interface ConsistencyPopoverState {
  issueId: string;
  surface: string;
  left: number;
  top: number;
}

export type ReviewReadinessState =
  | 'idle'
  | 'running'
  | 'ready'
  | 'attention'
  | 'unavailable';

export interface ReviewReadiness {
  state: ReviewReadinessState;
  count: number;
  label: string;
  detail: string;
}

interface UseWorkspaceConsistencyParams {
  activeProject: Project | null;
  documents: WritingDocument[];
  setDocuments: Dispatch<SetStateAction<WritingDocument[]>>;
  entities: WorldEntity[];
  setEntities: Dispatch<SetStateAction<WorldEntity[]>>;
  categories: EntityCategory[];
  setCategories: Dispatch<SetStateAction<EntityCategory[]>>;
  aliases: ConsistencyAlias[];
  setAliases: Dispatch<SetStateAction<ConsistencyAlias[]>>;
  characters: Character[];
  setCharacters: Dispatch<SetStateAction<Character[]>>;
  canonicalFacts: CanonicalFact[];
  characterSheets: CharacterSheet[];
  ruleset: StoredRuleset | null;
  stateMutationEvents: StateMutationEvent[];
  selectedDocumentId: string | null;
  projectSettings: ProjectSettings | null;
  saveProjectSettings: (settings: ProjectSettings) => Promise<ProjectSettings>;
  resolvedActionCues: string[];
  worldEngine: WorldEngine;
  ragService: RAGProvider | null;
  shodhService: ShodhMemoryProvider | null;
  refreshMemories: () => Promise<void>;
  setSelectedCreatedAt: Dispatch<SetStateAction<number | null>>;
  setSaveStatus: Dispatch<SetStateAction<'idle' | 'saving' | 'saved'>>;
  setLastSavedAt: Dispatch<SetStateAction<number | null>>;
  lastAutosaveErrorRef: MutableRefObject<string | null>;
  setFeedback: Dispatch<SetStateAction<FeedbackState>>;
  addSystemHistory: (input: {
    category: 'scene' | 'consistency' | 'resource' | 'quest' | 'system';
    message: string;
    insertText?: string;
    sceneId?: string;
  }) => void;
}

const downgradeUnknownIssuesToWarnings = (
  issues: GuardrailIssue[]
): GuardrailIssue[] =>
  issues.map((issue) =>
        issue.code === 'UNKNOWN_ENTITY'
      ? {
          ...issue,
          severity: 'warning',
          message: issue.surface
            ? `Review "${issue.surface}" when you are ready to add or ignore this scene context.`
            : 'Review this name or world term when you are ready to add or ignore it.'
        }
      : issue
  );

const canonicalizeUnknownSurface = normalizeCanonText;

const hasUppercaseLetter = (value: string): boolean => /[A-Z]/.test(value);
const normalizeRecordName = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

const LOCATION_HINT_TOKENS = new Set([
  'archive',
  'bay',
  'camp',
  'capital',
  'castle',
  'cavern',
  'cave',
  'city',
  'district',
  'empire',
  'farm',
  'forest',
  'fort',
  'fortress',
  'garden',
  'hall',
  'harbor',
  'hollow',
  'inn',
  'island',
  'keep',
  'kingdom',
  'lake',
  'library',
  'manor',
  'market',
  'marsh',
  'mine',
  'monastery',
  'mountain',
  'outpost',
  'palace',
  'realm',
  'river',
  'road',
  'ruins',
  'sanctum',
  'settlement',
  'shore',
  'square',
  'street',
  'swamp',
  'temple',
  'tower',
  'town',
  'vale',
  'village',
  'woods'
]);

const ITEM_HINT_TOKENS = new Set([
  'amulet',
  'armor',
  'armour',
  'axe',
  'blade',
  'book',
  'bow',
  'bracelet',
  'charm',
  'cloak',
  'coin',
  'crown',
  'dagger',
  'elixir',
  'gem',
  'grimoire',
  'hammer',
  'helm',
  'helmet',
  'herb',
  'key',
  'knife',
  'lantern',
  'map',
  'medallion',
  'necklace',
  'orb',
  'potion',
  'relic',
  'ring',
  'robe',
  'scroll',
  'shield',
  'spear',
  'staff',
  'stone',
  'sword',
  'talisman',
  'tome',
  'vial',
  'wand'
]);

const CREATURE_HINT_TOKENS = new Set([
  'bear',
  'beast',
  'boar',
  'cat',
  'creature',
  'crow',
  'deer',
  'demon',
  'dog',
  'dragon',
  'drake',
  'eagle',
  'fiend',
  'fox',
  'giant',
  'goblin',
  'griffin',
  'hawk',
  'hound',
  'monster',
  'owl',
  'phantom',
  'rat',
  'serpent',
  'shade',
  'spider',
  'spirit',
  'stag',
  'tiger',
  'wolf',
  'wyrm'
]);

const FACTION_HINT_TOKENS = new Set([
  'alliance',
  'band',
  'brotherhood',
  'clan',
  'company',
  'council',
  'court',
  'cult',
  'dynasty',
  'faction',
  'family',
  'fellowship',
  'fleet',
  'guild',
  'house',
  'kingdom',
  'legion',
  'order',
  'syndicate',
  'tribe'
]);

const CATEGORY_SEMANTIC_SLUG_HINTS: Record<
  Exclude<SuggestedUnknownCategory, null>,
  string[]
> = {
  character: ['character', 'npc', 'person', 'people'],
  location: ['location', 'place', 'city', 'town', 'region', 'landmark'],
  item: ['item', 'object', 'gear', 'equipment', 'tool', 'weapon'],
  creature: ['creature', 'monster', 'beast', 'enemy', 'mob', 'species'],
  faction: ['faction', 'guild', 'clan', 'house', 'group', 'order'],
  flora: ['flora', 'plant', 'herb'],
  mineral: ['mineral', 'ore', 'rock', 'metal'],
  artifact: ['artifact', 'relic'],
  concept: ['concept', 'lore', 'rule', 'history', 'culture']
};

const hashString = (value: string): string => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return `h${(hash >>> 0).toString(16)}`;
};

const getReviewIssueKey = (issue: GuardrailIssue): string =>
  [
    issue.code,
    canonicalizeUnknownSurface(issue.surface ?? issue.message)
  ].join(':');

const getReviewSourceForDocument = (
  doc: WritingDocument
): 'workspace-save' | 'import' =>
  doc.consistencyReviewMode === 'deferred' ? 'import' : 'workspace-save';

function findCategoryIdForSuggestedKind(
  availableCategories: EntityCategory[],
  suggested: SuggestedUnknownCategory
): string | undefined {
  if (!suggested) {
    return undefined;
  }
  const slugHints = CATEGORY_SEMANTIC_SLUG_HINTS[suggested];
  const exactMatch = availableCategories.find((category) =>
    slugHints.some((hint) => category.slug.toLowerCase() === hint)
  );
  if (exactMatch) {
    return exactMatch.id;
  }
  return availableCategories.find((category) =>
    slugHints.some((hint) => category.slug.toLowerCase().includes(hint))
  )?.id;
}

function normalizeForStorage(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeForStorage);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nestedValue]) => [key, normalizeForStorage(nestedValue)])
    );
  }
  return value;
}

function getHiddenStateMutationReviewKey(event: {
  sceneId: string;
  sourceHash: string;
  commands: StateMutationEvent['commands'];
}): string {
  return JSON.stringify({
    sceneId: event.sceneId,
    sourceHash: event.sourceHash,
    commands: event.commands.map((command) => normalizeForStorage(command))
  });
}

const makeReviewItemId = (
  docId: string,
  issue: GuardrailIssue,
  index: number
): string => `${docId}:${getReviewIssueKey(issue)}:${index}`;

export const useWorkspaceConsistency = ({
  activeProject,
  documents,
  setDocuments,
  entities,
  setEntities,
  categories,
  setCategories,
  aliases,
  setAliases,
  characters,
  setCharacters,
  canonicalFacts,
  characterSheets,
  ruleset,
  stateMutationEvents,
  selectedDocumentId,
  projectSettings,
  saveProjectSettings,
  resolvedActionCues,
  worldEngine,
  ragService,
  shodhService,
  refreshMemories,
  setSelectedCreatedAt,
  setSaveStatus,
  setLastSavedAt,
  lastAutosaveErrorRef,
  setFeedback,
  addSystemHistory
}: UseWorkspaceConsistencyParams) => {
  const [guardrailIssues, setGuardrailIssues] = useState<GuardrailIssue[]>([]);
  const [dismissedUnknownByDocument, setDismissedUnknownByDocument] = useState<
    Record<string, string[]>
  >({});
  const [hiddenStateMutationReviewKeys, setHiddenStateMutationReviewKeys] = useState<string[]>(
    []
  );
  const [isReviewPrefsHydrated, setReviewPrefsHydrated] = useState(false);
  const [resolvingUnknown, setResolvingUnknown] = useState<string | null>(null);
  const [linkingUnknown, setLinkingUnknown] = useState<string | null>(null);
  const [resolverNotice, setResolverNotice] = useState<ResolverNotice | null>(null);
  const [unknownLinkSelection, setUnknownLinkSelection] = useState<
    Record<string, string>
  >({});
  const [unknownCategorySelection, setUnknownCategorySelection] = useState<
    Record<string, string>
  >({});
  const [isRunningConsistencyReview, setIsRunningConsistencyReview] = useState(false);
  const [consistencyReviewItems, setConsistencyReviewItems] = useState<
    ConsistencyReviewItem[]
  >([]);
  const [lastConsistencyReviewAt, setLastConsistencyReviewAt] = useState<number | null>(
    null
  );
  const [consistencyPopover, setConsistencyPopover] =
    useState<ConsistencyPopoverState | null>(null);
  const [worldEngineStatus, setWorldEngineStatus] =
    useState<WorldEngineStatus | null>(null);
  const [applyingStateMutationReviewId, setApplyingStateMutationReviewId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void worldEngine
      .getStatus()
      .then((status) => {
        if (!cancelled) {
          setWorldEngineStatus(status);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setWorldEngineStatus({
            state: 'installedUnavailable',
            reason:
              error instanceof Error
                ? error.message
                : 'Review engine status could not be checked.'
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [worldEngine]);

  useEffect(() => {
    if (!activeProject) {
      setDismissedUnknownByDocument({});
      setHiddenStateMutationReviewKeys([]);
      setReviewPrefsHydrated(true);
      return;
    }
    try {
      const raw = localStorage.getItem(`workspaceReviewPrefs:${activeProject.id}`);
      if (!raw) {
        setDismissedUnknownByDocument({});
        setReviewPrefsHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') {
        setDismissedUnknownByDocument({});
        setReviewPrefsHydrated(true);
        return;
      }
      const prefs = parsed as {
        dismissedUnknownByDocument?: unknown;
        hiddenStateMutationReviewKeys?: unknown;
      };
      const nextDismissed: Record<string, string[]> = {};
      if (
        prefs.dismissedUnknownByDocument &&
        typeof prefs.dismissedUnknownByDocument === 'object'
      ) {
        Object.entries(prefs.dismissedUnknownByDocument as Record<string, unknown>).forEach(
          ([docId, values]) => {
            if (!Array.isArray(values)) return;
            nextDismissed[docId] = values
              .filter((value): value is string => typeof value === 'string')
              .map((value) => value.trim())
              .filter(Boolean);
          }
        );
      }
      const nextHiddenKeys = Array.isArray(prefs.hiddenStateMutationReviewKeys)
        ? prefs.hiddenStateMutationReviewKeys.filter(
            (value): value is string => typeof value === 'string' && value.trim().length > 0
          )
        : [];
      setDismissedUnknownByDocument(nextDismissed);
      setHiddenStateMutationReviewKeys(nextHiddenKeys);
    } catch {
      setDismissedUnknownByDocument({});
      setHiddenStateMutationReviewKeys([]);
    } finally {
      setReviewPrefsHydrated(true);
    }
  }, [activeProject]);

  useEffect(() => {
    if (!activeProject || !projectSettings || !isReviewPrefsHydrated) return;
    try {
      const raw = localStorage.getItem(`workspaceReviewPrefs:${activeProject.id}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as
        | {
            ignoredUnknownSurfaces?: unknown;
          }
        | null;
      const legacyIgnoredValues = parsed?.ignoredUnknownSurfaces;
      const legacyIgnored = (
        Array.isArray(legacyIgnoredValues) ? legacyIgnoredValues : []
      )
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
      if (legacyIgnored.length === 0) return;

      const mergedIgnored = Array.from(
        new Set([...(projectSettings.ignoredUnknownSurfaces ?? []), ...legacyIgnored])
      );
      if (mergedIgnored.length === (projectSettings.ignoredUnknownSurfaces ?? []).length) {
        return;
      }

      const nextSettings: ProjectSettings = {
        ...projectSettings,
        ignoredUnknownSurfaces: mergedIgnored,
        updatedAt: Date.now()
      };
      void saveProjectSettings(nextSettings)
        .catch(() => {
          // Ignore migration errors and continue using current settings.
        });
    } catch {
      // Ignore malformed legacy local storage.
    }
  }, [activeProject, isReviewPrefsHydrated, projectSettings, saveProjectSettings]);

  useEffect(() => {
    if (!activeProject || !isReviewPrefsHydrated) return;
    localStorage.setItem(
      `workspaceReviewPrefs:${activeProject.id}`,
      JSON.stringify({
        dismissedUnknownByDocument,
        hiddenStateMutationReviewKeys
      })
    );
  }, [
    activeProject,
    dismissedUnknownByDocument,
    hiddenStateMutationReviewKeys,
    isReviewPrefsHydrated
  ]);

  useEffect(() => {
    if (!consistencyPopover) return;
    const close = () => setConsistencyPopover(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [consistencyPopover]);

  const characterCategoryIds = useMemo(
    () =>
      new Set(
        categories
          .filter((category) => category.slug.toLowerCase().includes('character'))
          .map((category) => category.id)
      ),
    [categories]
  );

  const characterLoreEntityIdByCharacterId = useMemo(() => {
    const linkedEntityIdByCharacterId = new Map<string, string>();
    entities.forEach((entity) => {
      if (!characterCategoryIds.has(entity.categoryId)) {
        return;
      }
      const normalizedEntityName = normalizeRecordName(entity.name);
      const matchingCharacter = characters.find(
        (character) => normalizeRecordName(character.name) === normalizedEntityName
      );
      if (matchingCharacter) {
        linkedEntityIdByCharacterId.set(matchingCharacter.id, entity.id);
      }
    });
    return linkedEntityIdByCharacterId;
  }, [characterCategoryIds, characters, entities]);

  const knownConsistencyEntities = useMemo(() => {
    const entityById = new Map(entities.map((entity) => [entity.id, entity]));
    const characterById = new Map(characters.map((character) => [character.id, character]));
    return [
      ...entities.map((entity) => ({
        id: entity.id,
        name: entity.name,
        type: 'entity' as const
      })),
      ...characters.map((character) => ({
        id: character.id,
        name: character.name,
        type: 'character' as const
      })),
      ...aliases
        .map((alias) => {
          if (alias.targetType === 'character') {
            const linkedEntityId = characterLoreEntityIdByCharacterId.get(alias.targetId);
            if (linkedEntityId) {
              const linkedEntity = entityById.get(linkedEntityId);
              if (!linkedEntity) {
                return null;
              }
              return {
                id: linkedEntity.id,
                name: alias.alias,
                type: 'entity' as const
              };
            }
          }
          const linkedRecord =
            alias.targetType === 'character'
              ? characterById.get(alias.targetId)
              : entityById.get(alias.targetId);
          if (!linkedRecord) {
            return null;
          }
          return {
            id: linkedRecord.id,
            name: alias.alias,
            type: alias.targetType === 'character' ? ('character' as const) : ('entity' as const)
          };
        })
        .filter(
          (entry): entry is {id: string; name: string; type: 'character' | 'entity'} =>
            Boolean(entry)
      )
    ];
  }, [aliases, characterLoreEntityIdByCharacterId, characters, entities]);

  const knownConsistencySurfaceSet = useMemo(
    () =>
      new Set(
        knownConsistencyEntities
          .map((entity) => canonicalizeUnknownSurface(entity.name))
          .filter(Boolean)
      ),
    [knownConsistencyEntities]
  );

  const isKnownConsistencyIssue = useCallback(
    (issue: GuardrailIssue): boolean => {
      if (issue.code !== 'UNKNOWN_ENTITY' || !issue.surface) {
        return false;
      }
      return knownConsistencySurfaceSet.has(canonicalizeUnknownSurface(issue.surface));
    },
    [knownConsistencySurfaceSet]
  );

  const filterDismissedUnknownIssues = useCallback(
    (docId: string, issues: GuardrailIssue[]): GuardrailIssue[] => {
      const dismissed = new Set(
        (dismissedUnknownByDocument[docId] ?? []).map((surface) =>
          canonicalizeUnknownSurface(surface)
        )
      );
      const ignored = new Set(
        (projectSettings?.ignoredUnknownSurfaces ?? []).map((surface) =>
          canonicalizeUnknownSurface(surface)
        )
      );
      if (dismissed.size === 0 && ignored.size === 0) {
        return issues;
      }
      return issues.filter((issue) => {
        if (issue.code !== 'UNKNOWN_ENTITY') {
          return true;
        }
        const surface = issue.surface ? canonicalizeUnknownSurface(issue.surface) : '';
        return !surface || (!dismissed.has(surface) && !ignored.has(surface));
      });
    },
    [dismissedUnknownByDocument, projectSettings?.ignoredUnknownSurfaces]
  );

  const removeReviewSurface = useCallback(
    (
      surface: string,
      options?: {
        docId?: string;
      }
    ) => {
      const normalized = canonicalizeUnknownSurface(surface);
      if (!normalized) return;
      const shouldKeepIssue = (issue: GuardrailIssue) => {
        const issueSurface = canonicalizeUnknownSurface(issue.surface ?? '');
        if (!issueSurface) {
          return true;
        }
        return issueSurface !== normalized;
      };
      setGuardrailIssues((prev) => prev.filter(shouldKeepIssue));
      setConsistencyReviewItems((prev) =>
        prev.filter((item) => {
          if (options?.docId && item.sceneId !== options.docId) {
            return true;
          }
          return shouldKeepIssue(item.issue);
        })
      );
    },
    []
  );

  const attachAliasTexts = useCallback(
    async (params: {
      projectId: string;
      targetId: string;
      targetType: 'entity' | 'character';
      aliasTexts: string[];
    }) => {
      const uniqueAliases = Array.from(
        new Map(
          params.aliasTexts
            .map((alias) => alias.trim())
            .filter(Boolean)
            .map((alias) => [alias.toLowerCase(), alias])
        ).values()
      );

      for (const alias of uniqueAliases) {
        const saved = await saveAlias({
          projectId: params.projectId,
          targetId: params.targetId,
          targetType: params.targetType,
          alias
        });
        setAliases((prev) => {
          const existingIndex = prev.findIndex((entry) => entry.id === saved.id);
          if (existingIndex >= 0) {
            const copy = [...prev];
            copy[existingIndex] = saved;
            return copy;
          }
          return [...prev, saved];
        });
      }
    },
    [setAliases]
  );

  const persistDoc = useCallback(
    async (
      doc: WritingDocument,
      options?: {
        source?: 'workspace-save' | 'workspace-autosave' | 'import';
        consistencyMode?: 'strict' | 'balanced' | 'lenient';
      }
    ): Promise<{unresolvedCount: number; consistencyRun: boolean}> => {
      const source = options?.source ?? 'workspace-save';
      const consistencyMode = options?.consistencyMode ?? 'strict';
      const isImport = source === 'import';
      let unresolvedCount = 0;

      if (isImport) {
        await saveWritingDocument(doc);
      }

      if (consistencyMode !== 'lenient') {
        try {
          const {proposal, validation, observations} = await worldEngine.reviewText({
            projectId: doc.projectId,
            text: htmlToPlainText(doc.content),
            source,
            knownEntities: knownConsistencyEntities,
            actionCues: resolvedActionCues
          });
          const presentedIssues =
            consistencyMode === 'strict'
              ? validation.issues
              : downgradeUnknownIssuesToWarnings(validation.issues);
          setGuardrailIssues(filterDismissedUnknownIssues(doc.id, presentedIssues));
          unresolvedCount = validation.issues.filter(
            (issue) => issue.code === 'UNKNOWN_ENTITY'
          ).length;

          if (!validation.allowCommit && consistencyMode === 'strict' && !isImport) {
            const visibleUnknowns = validation.issues
              .map((issue) => issue.surface)
              .filter((surface): surface is string => Boolean(surface))
              .slice(0, 3);
            const suffix =
              validation.issues.length > 3
                ? ` (+${validation.issues.length - 3} more)`
                : '';
            const summary = visibleUnknowns.join(', ');
            throw new Error(
              `Scene save needs review first: ${validation.issues.length} unknown ${validation.issues.length === 1 ? 'name or world term' : 'names or world terms'} (${summary}${suffix}).`
            );
          }

          if (validation.allowCommit) {
            await worldEngine.applyAcceptedProposal(proposal, validation);
            const orderedDocuments = documents
              .slice()
              .sort((a, b) => a.createdAt - b.createdAt);
            const sceneOrder =
              orderedDocuments.findIndex((entry) => entry.id === doc.id) + 1;
            if (sceneOrder > 0) {
              try {
                const nextDerivedEvents = buildDerivedStateMutationEvents({
                  projectId: doc.projectId,
                  sceneId: doc.id,
                  sceneTitle: doc.title,
                  sceneOrder,
                  sourceRevision: doc.updatedAt,
                  sourceHash: hashString(doc.content),
                  observations,
                  characterSheets,
                  ruleset,
                  existingEvents: stateMutationEvents
                });
                await replaceSceneStateMutationEventsBySourceType({
                  projectId: doc.projectId,
                  sceneId: doc.id,
                  sourceType: 'deterministic-review',
                  nextEvents: nextDerivedEvents,
                  invalidationReason:
                    'Replaced deterministic review-derived state changes after scene save.'
                });
              } catch (error) {
                console.warn('State mutation derivation failed for scene', doc.id, error);
              }
            }
          }
        } catch (error) {
          if (!isImport) {
            throw error;
          }
          console.warn('Import review failed after scene persistence', doc.id, error);
        }
      }

      if (!isImport) {
        await saveWritingDocument(doc);
      }

      try {
        if (ragService) {
          await ragService.indexDocument(
            doc.id,
            doc.title || 'Untitled scene',
            doc.content,
            'scene'
          );
        }
      } catch (error) {
        console.warn('RAG indexing failed for scene', doc.id, error);
      }

      try {
        if (shodhService) {
          await shodhService.captureAutoMemory({
            projectId: doc.projectId,
            documentId: doc.id,
            title: doc.title || 'Untitled scene',
            content: doc.content,
            tags: ['scene']
          });
          await refreshMemories();
        }
      } catch (error) {
        console.warn('Auto-memory capture failed for scene', doc.id, error);
      }

      setDocuments((prev) => {
        const index = prev.findIndex((entry) => entry.id === doc.id);
        if (index === -1) {
          return [...prev, doc];
        }
        const copy = [...prev];
        copy[index] = doc;
        return copy;
      });

      setSelectedCreatedAt(doc.createdAt);
      setSaveStatus('saved');
      setLastSavedAt(Date.now());
      if (consistencyMode === 'strict' && !isImport) {
        setGuardrailIssues([]);
      }
      lastAutosaveErrorRef.current = null;
      return {
        unresolvedCount,
        consistencyRun: consistencyMode !== 'lenient'
      };
    },
    [
      filterDismissedUnknownIssues,
      documents,
      characterSheets,
      knownConsistencyEntities,
      ruleset,
      resolvedActionCues,
      ragService,
      shodhService,
      refreshMemories,
      stateMutationEvents,
      setDocuments,
      setLastSavedAt,
      setSaveStatus,
      setSelectedCreatedAt,
      lastAutosaveErrorRef,
      worldEngine
    ]
  );

  const refreshDeferredReview = useCallback(
    async (doc: WritingDocument) => {
      const {validation} = await worldEngine.reviewText({
        projectId: doc.projectId,
        text: htmlToPlainText(doc.content),
        source: getReviewSourceForDocument(doc),
        knownEntities: knownConsistencyEntities,
        actionCues: resolvedActionCues
      });
      const presentedIssues = filterDismissedUnknownIssues(
        doc.id,
        downgradeUnknownIssuesToWarnings(validation.issues)
      );
      setGuardrailIssues(presentedIssues);
      setConsistencyReviewItems((prev) => [
        ...prev.filter((item) => item.sceneId !== doc.id),
        ...presentedIssues.map((issue, index) => ({
          id: makeReviewItemId(doc.id, issue, index),
          sceneId: doc.id,
          sceneTitle: doc.title || 'Untitled scene',
          issue
        }))
      ]);
    },
    [
      filterDismissedUnknownIssues,
      knownConsistencyEntities,
      resolvedActionCues,
      worldEngine
    ]
  );

  const refreshActiveDraftReview = useCallback(
    async (doc: WritingDocument) => {
      setIsRunningConsistencyReview(true);
      try {
        const {validation, issueAnnotations} = await worldEngine.reviewText({
          projectId: doc.projectId,
          text: htmlToPlainText(doc.content),
          source: 'workspace-autosave',
          knownEntities: knownConsistencyEntities,
          actionCues: resolvedActionCues
        });
        const presentedIssues = filterDismissedUnknownIssues(
          doc.id,
          downgradeUnknownIssuesToWarnings(validation.issues)
        );
        setGuardrailIssues(presentedIssues);
        setConsistencyReviewItems((prev) => [
          ...prev.filter((item) => item.sceneId !== doc.id),
          ...presentedIssues.map((issue, index) => ({
            id: makeReviewItemId(doc.id, issue, index),
            sceneId: doc.id,
            sceneTitle: doc.title || 'Untitled scene',
            issue,
            reviewAnnotation: issueAnnotations[index]
          }))
        ]);
      } finally {
        setIsRunningConsistencyReview(false);
      }
    },
    [
      filterDismissedUnknownIssues,
      knownConsistencyEntities,
      resolvedActionCues,
      worldEngine
    ]
  );

  const handleRunConsistencyReview = useCallback(async () => {
    if (!activeProject) return;
    if (documents.length === 0) {
      setConsistencyReviewItems([]);
      setLastConsistencyReviewAt(Date.now());
      setFeedback({tone: 'error', message: 'No scenes available to review.'});
      addSystemHistory({
        category: 'consistency',
        message: 'Consistency review skipped: no scenes available.'
      });
      return;
    }

    setIsRunningConsistencyReview(true);
    setFeedback(null);
    try {
      const items: ConsistencyReviewItem[] = [];
      for (const doc of documents) {
        const {validation, issueAnnotations} = await worldEngine.reviewText({
          projectId: activeProject.id,
          text: htmlToPlainText(doc.content),
          source: getReviewSourceForDocument(doc),
          knownEntities: knownConsistencyEntities,
          actionCues: resolvedActionCues
        });
        const presentedIssues = filterDismissedUnknownIssues(doc.id, validation.issues);
        presentedIssues.forEach((issue, index) => {
          items.push({
            id: makeReviewItemId(doc.id, issue, index),
            sceneId: doc.id,
            sceneTitle: doc.title || 'Untitled scene',
            issue,
            reviewAnnotation: issueAnnotations[index]
          });
        });
      }

      const contradictionItems = findCanonContradictions({
        documents,
        entities,
        characters,
        canonicalFacts,
        knownEntities: knownConsistencyEntities
      });
      const combinedItems = [...items, ...contradictionItems];

      setConsistencyReviewItems(combinedItems);
      setLastConsistencyReviewAt(Date.now());
      if (combinedItems.length === 0) {
        setFeedback({
          tone: 'success',
          message: `Consistency review complete: no issues across ${documents.length} scene(s).`
        });
        addSystemHistory({
          category: 'consistency',
          message: `Consistency review complete with no issues across ${documents.length} scene(s).`
        });
      } else {
        const contradictionCount = contradictionItems.length;
        const firstSceneId = combinedItems[0]?.sceneId;
        const message =
          `Project review found ${combinedItems.length} item(s) across ${documents.length} scene(s).` +
          (contradictionCount > 0
            ? ` ${contradictionCount} contradiction${contradictionCount === 1 ? '' : 's'} with canon records.`
            : '');
        setFeedback({tone: 'error', message});
        addSystemHistory({
          category: 'consistency',
          message,
          sceneId: firstSceneId
        });
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to run consistency review.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsRunningConsistencyReview(false);
    }
  }, [
    activeProject,
    addSystemHistory,
    canonicalFacts,
    characters,
    documents,
    entities,
    filterDismissedUnknownIssues,
    knownConsistencyEntities,
    resolvedActionCues,
    setFeedback,
    worldEngine
  ]);

  const unknownGuardrailIssues = useMemo(() => {
    const seen = new Set<string>();
    return guardrailIssues
      .filter((issue) => issue.code === 'UNKNOWN_ENTITY' && Boolean(issue.surface))
      .filter((issue) => !isKnownConsistencyIssue(issue))
      .filter((issue) => {
        const key = canonicalizeUnknownSurface(issue.surface ?? '');
        if (!key || seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
  }, [guardrailIssues, isKnownConsistencyIssue]);

  const hasBlockingUnknownGuardrailIssues = useMemo(
    () => unknownGuardrailIssues.some((issue) => issue.severity === 'blocking'),
    [unknownGuardrailIssues]
  );

  const highlightableUnknownIssues = useMemo(() => {
    const issueMap = new Map<
      string,
      {
        id: string;
        surface: string;
        message: string;
        severity: 'blocking' | 'warning';
      }
    >();
    const addIssue = (issue: GuardrailIssue) => {
      if (issue.code !== 'UNKNOWN_ENTITY' || !issue.surface) return;
      const key = getReviewIssueKey(issue);
      if (issueMap.has(key)) return;
      issueMap.set(key, {
        id: `${issue.code}:${issue.surface}`,
        surface: issue.surface,
        message: issue.message,
        severity: issue.severity
      });
    };

    unknownGuardrailIssues.forEach(addIssue);
    if (selectedDocumentId) {
      consistencyReviewItems
        .filter((item) => item.sceneId === selectedDocumentId)
        .filter((item) => !isKnownConsistencyIssue(item.issue))
        .forEach((item) => addIssue(item.issue));
    }

    return Array.from(issueMap.values());
  }, [consistencyReviewItems, isKnownConsistencyIssue, selectedDocumentId, unknownGuardrailIssues]);

  const reviewReadiness = useMemo<ReviewReadiness>(() => {
    const issueKeys = new Set<string>();
    unknownGuardrailIssues.forEach((issue) => {
      issueKeys.add(getReviewIssueKey(issue));
    });
    consistencyReviewItems
      .filter((item) => !isKnownConsistencyIssue(item.issue))
      .forEach((item) => {
        issueKeys.add(getReviewIssueKey(item.issue));
      });
    const stateMutationItemCount = stateMutationEvents.filter(
      (event) => event.status === 'proposed' && event.sourceType === 'deterministic-review'
    ).length;
    const count = issueKeys.size + stateMutationItemCount;
    if (worldEngineStatus && worldEngineStatus.state !== 'available') {
      return {
        state: 'unavailable',
        count,
        label: 'Review unavailable',
        detail:
          worldEngineStatus.state === 'notInstalled'
            ? 'Local review engine is not installed.'
            : worldEngineStatus.reason
      };
    }
    if (isRunningConsistencyReview) {
      return {
        state: 'running',
        count,
        label: 'Review running',
        detail: 'Review is checking the current project.'
      };
    }
    if (hasBlockingUnknownGuardrailIssues) {
      return {
        state: 'attention',
        count,
        label: count === 1 ? '1 review item' : `${count} review items`,
        detail: 'Some review items need attention before a strict save can finish.'
      };
    }
    if (count > 0) {
      return {
        state: 'ready',
        count,
        label: count === 1 ? '1 review item' : `${count} review items`,
        detail: 'Review items are ready when you want to check them.'
      };
    }
    return {
      state: 'idle',
      count: 0,
      label: 'Review clear',
      detail: 'No open review items.'
    };
  }, [
    consistencyReviewItems,
    hasBlockingUnknownGuardrailIssues,
    isKnownConsistencyIssue,
    isRunningConsistencyReview,
    unknownGuardrailIssues,
    stateMutationEvents,
    worldEngineStatus
  ]);

  const getSuggestedUnknownCategory = useCallback(
    (surface: string): SuggestedUnknownCategory => {
      const normalizedSurface = canonicalizeUnknownSurface(surface);
      if (!normalizedSurface) {
        return null;
      }
      const issue = unknownGuardrailIssues.find(
        (candidate) =>
          candidate.code === 'UNKNOWN_ENTITY' &&
          canonicalizeUnknownSurface(candidate.surface ?? '') === normalizedSurface
      );
      const detectionReason = issue?.detectionReason ?? null;
      if (
        detectionReason === 'titled_name' ||
        detectionReason === 'character_context_candidate'
      ) {
        return 'character';
      }
      if (detectionReason === 'action_object_candidate') {
        return 'item';
      }

      const tokens = normalizedSurface.split(/\s+/).filter(Boolean);
      const lastToken = tokens[tokens.length - 1] ?? '';
      const originalSurfaceLooksNamed = hasUppercaseLetter(surface);
      if (lastToken && LOCATION_HINT_TOKENS.has(lastToken) && originalSurfaceLooksNamed) {
        return 'location';
      }
      if (lastToken && ITEM_HINT_TOKENS.has(lastToken)) {
        return 'item';
      }
      if (lastToken && CREATURE_HINT_TOKENS.has(lastToken)) {
        return 'creature';
      }
      if (lastToken && FACTION_HINT_TOKENS.has(lastToken)) {
        return 'faction';
      }

      const issueDocument =
        issue && selectedDocumentId
          ? documents.find((document) => document.id === selectedDocumentId) ?? null
          : null;
      if (issue?.span && issueDocument) {
        const prefix = issueDocument.content
          .slice(Math.max(0, issue.span.start - 32), issue.span.start)
          .replace(/<[^>]+>/g, ' ')
          .toLowerCase();
        if (/\b(from|to|into|toward|towards|at|in|near|inside|outside)\s*$/u.test(prefix)) {
          return 'location';
        }
        if (/\b(with|using|equip(?:ped)?|wield(?:ed)?|drink|drank|grab(?:bed)?|draw|drew|throw|threw|cast)\s*$/u.test(prefix)) {
          return 'item';
        }
        if (/\b(named|called)\s*$/u.test(prefix)) {
          return 'character';
        }
      }

      return null;
    },
    [documents, selectedDocumentId, unknownGuardrailIssues]
  );

  const getSuggestedUnknownCategoryId = useCallback(
    (surface: string): string | undefined => {
      const suggested = getSuggestedUnknownCategory(surface);
      return findCategoryIdForSuggestedKind(categories, suggested);
    },
    [categories, getSuggestedUnknownCategory]
  );

  const stateMutationReviewItems = useMemo<StateMutationReviewItem[]>(() => {
    const actorLabelById = new Map<string, string>();
    const sheetByActorId = new Map<string, CharacterSheet>();
    characterSheets.forEach((sheet) => {
      actorLabelById.set(sheet.id, sheet.name);
      sheetByActorId.set(sheet.id, sheet);
      if (sheet.characterId) {
        actorLabelById.set(sheet.characterId, sheet.name);
        sheetByActorId.set(sheet.characterId, sheet);
      }
    });
    const resourceDefinitionNameById = new Map(
      (ruleset?.resourceDefinitions ?? []).map((definition) => [definition.id, definition.name])
    );
    const statDefinitionNameById = new Map(
      (ruleset?.statDefinitions ?? []).map((definition) => [definition.id, definition.name])
    );
    const acceptedEvents = stateMutationEvents.filter((event) => event.status === 'accepted');
    const batchAcceptableIds = computeBatchAcceptableStateMutationEventIds({
      proposedEvents: stateMutationEvents.filter(
        (event) => event.status === 'proposed' && event.sourceType === 'deterministic-review'
      ),
      acceptedEvents,
      characterSheets,
      ruleset,
      labels: {
        resourceDefinitionNameById,
        statDefinitionNameById
      }
    });

    return stateMutationEvents
      .filter(
        (event) => event.status === 'proposed' && event.sourceType === 'deterministic-review'
      )
      .filter(
        (event) =>
          !hiddenStateMutationReviewKeys.includes(getHiddenStateMutationReviewKey(event))
      )
      .map((event) => {
        const staleness = getStateMutationEventStaleness({
          event,
          documents
        });
        const primaryCommand = event.commands[0];
        const sheet = primaryCommand ? sheetByActorId.get(primaryCommand.actorId) ?? null : null;
        const sceneOrder = event.sceneOrder ?? Number.MAX_SAFE_INTEGER;
        const preview =
          sheet && primaryCommand
            ? buildStateMutationPreview({
                sheet,
                ruleset,
                events: acceptedEvents,
                target: {
                  actorId: primaryCommand.actorId,
                  characterId: sheet.characterId,
                  sheetId: sheet.id,
                  actorName: sheet.name
                },
                command: primaryCommand,
                upToSceneOrder: sceneOrder,
                labels: {
                  resourceDefinitionNameById,
                  statDefinitionNameById
                }
              })
            : null;
        const canAccept = (preview?.validationIssues.length ?? 0) === 0;
        const canAcceptInBatch = batchAcceptableIds.has(event.id);
        return {
          id: event.id,
          sceneId: event.sceneId,
          sceneTitle: event.sceneTitle || 'Untitled scene',
          sceneSequence: event.sceneSequence,
          actorLabel:
            actorLabelById.get(event.commands[0]?.actorId ?? '') ?? 'Unknown actor',
          summaryLines: event.commands.map((command) =>
            summarizeStateMutationCommand({
              command,
              labels: {
                resourceDefinitionNameById,
                statDefinitionNameById
              }
            })
          ),
          effectLines: preview?.effectLines ?? [],
          validationIssues: preview?.validationIssues ?? [],
          canAccept,
          canAcceptInBatch,
          acceptanceHint: describeStateMutationAcceptance({
            canAccept,
            canAcceptInBatch,
            validationIssues: preview?.validationIssues ?? []
          }),
          isStale: staleness.isStale,
          staleLabel: describeStateMutationEventStaleness(staleness)
        };
      })
      .sort((a, b) => {
        if (a.sceneTitle !== b.sceneTitle) {
          return a.sceneTitle.localeCompare(b.sceneTitle);
        }
        return (a.sceneSequence ?? Number.MAX_SAFE_INTEGER) - (b.sceneSequence ?? Number.MAX_SAFE_INTEGER);
      });
  }, [characterSheets, documents, hiddenStateMutationReviewKeys, ruleset, stateMutationEvents]);

  const hiddenStateMutationReviewCountBySceneId =
    useMemo<StateMutationReviewGroupHiddenCounts>(() => {
      const counts: StateMutationReviewGroupHiddenCounts = {};
      stateMutationEvents
        .filter(
          (event) =>
            event.status === 'proposed' && event.sourceType === 'deterministic-review'
        )
        .forEach((event) => {
          if (!hiddenStateMutationReviewKeys.includes(getHiddenStateMutationReviewKey(event))) {
            return;
          }
          counts[event.sceneId] = (counts[event.sceneId] ?? 0) + 1;
        });
      return counts;
    }, [hiddenStateMutationReviewKeys, stateMutationEvents]);

  const hiddenStateMutationReviewCount = useMemo(
    () =>
      Object.values(hiddenStateMutationReviewCountBySceneId).reduce(
        (sum, count) => sum + count,
        0
      ),
    [hiddenStateMutationReviewCountBySceneId]
  );

  const acceptStateMutationReviewItem = useCallback(
    async (eventId: string, applyingId?: string) => {
      const event = stateMutationEvents.find((entry) => entry.id === eventId);
      if (!event || event.status !== 'proposed') {
        return;
      }
      setApplyingStateMutationReviewId(applyingId ?? eventId);
      setFeedback(null);
      try {
        await saveStateMutationEvent({
          ...event,
          status: 'accepted',
          invalidatedAt: undefined,
          invalidationReason: undefined
        });
        setFeedback({
          tone: 'success',
          message: `Accepted suggested state change from "${event.sceneTitle || 'scene'}".`
        });
        addSystemHistory({
          category: 'consistency',
          message: `Accepted suggested state change from "${event.sceneTitle || 'scene'}".`,
          sceneId: event.sceneId
        });
      } catch (error) {
        setFeedback({
          tone: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Unable to accept suggested state change.'
        });
      } finally {
        setApplyingStateMutationReviewId(null);
      }
    },
    [addSystemHistory, setFeedback, stateMutationEvents]
  );

  const rejectStateMutationReviewItem = useCallback(
    async (eventId: string, applyingId?: string) => {
      const event = stateMutationEvents.find((entry) => entry.id === eventId);
      if (!event || event.status !== 'proposed') {
        return;
      }
      setApplyingStateMutationReviewId(applyingId ?? eventId);
      setFeedback(null);
      try {
        await invalidateStateMutationEventById({
          eventId,
          reason: 'Rejected from Project Review suggested state changes.'
        });
        setFeedback({
          tone: 'success',
          message: `Rejected suggested state change from "${event.sceneTitle || 'scene'}".`
        });
        addSystemHistory({
          category: 'consistency',
          message: `Rejected suggested state change from "${event.sceneTitle || 'scene'}".`,
          sceneId: event.sceneId
        });
      } catch (error) {
        setFeedback({
          tone: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Unable to reject suggested state change.'
        });
      } finally {
        setApplyingStateMutationReviewId(null);
      }
    },
    [addSystemHistory, setFeedback, stateMutationEvents]
  );

  const hideStateMutationReviewItem = useCallback(
    (eventId: string) => {
      const event = stateMutationEvents.find((entry) => entry.id === eventId);
      if (!event || event.status !== 'proposed') {
        return;
      }
      const hiddenKey = getHiddenStateMutationReviewKey(event);
      setHiddenStateMutationReviewKeys((prev) =>
        prev.includes(hiddenKey) ? prev : [...prev, hiddenKey]
      );
      setFeedback({
        tone: 'success',
        message: `Hidden suggested state change from "${event.sceneTitle || 'scene'}" until the scene changes.`
      });
    },
    [setFeedback, stateMutationEvents]
  );

  const restoreHiddenStateMutationReviewItems = useCallback(
    (sceneId: string) => {
      const hiddenKeysForScene = stateMutationEvents
        .filter(
          (event) =>
            event.sceneId === sceneId &&
            event.status === 'proposed' &&
            event.sourceType === 'deterministic-review'
        )
        .map((event) => getHiddenStateMutationReviewKey(event))
        .filter((key) => hiddenStateMutationReviewKeys.includes(key));
      if (hiddenKeysForScene.length === 0) {
        setFeedback({
          tone: 'error',
          message: 'No hidden suggested state changes to restore in this scene.'
        });
        return;
      }
      setHiddenStateMutationReviewKeys((prev) =>
        prev.filter((key) => !hiddenKeysForScene.includes(key))
      );
      const sceneTitle =
        stateMutationEvents.find((event) => event.sceneId === sceneId)?.sceneTitle || 'scene';
      setFeedback({
        tone: 'success',
        message: `Restored hidden suggested state changes from "${sceneTitle}".`
      });
    },
    [hiddenStateMutationReviewKeys, setFeedback, stateMutationEvents]
  );

  const restoreAllHiddenStateMutationReviewItems = useCallback(() => {
    if (hiddenStateMutationReviewCount === 0) {
      setFeedback({
        tone: 'error',
        message: 'No hidden suggested state changes to restore.'
      });
      return;
    }
    setHiddenStateMutationReviewKeys([]);
    setFeedback({
      tone: 'success',
      message: `Restored ${hiddenStateMutationReviewCount} hidden suggested state change${hiddenStateMutationReviewCount === 1 ? '' : 's'}.`
    });
  }, [hiddenStateMutationReviewCount, setFeedback]);

  const acceptSceneStateMutationReviewItems = useCallback(
    async (sceneId: string) => {
      const applyingId = `scene:${sceneId}:accept`;
      const sceneItems = stateMutationReviewItems
        .filter((item) => item.sceneId === sceneId)
        .sort(
          (a, b) =>
            (a.sceneSequence ?? Number.MAX_SAFE_INTEGER) -
            (b.sceneSequence ?? Number.MAX_SAFE_INTEGER)
        );
      const batchAcceptableItems = sceneItems.filter((item) => item.canAcceptInBatch);
      if (batchAcceptableItems.length === 0) {
        setFeedback({
          tone: 'error',
          message: 'No valid suggested state changes to accept in this scene.'
        });
        return;
      }
      for (const item of batchAcceptableItems) {
        await acceptStateMutationReviewItem(item.id, applyingId);
      }
      setFeedback({
        tone: 'success',
        message: `Accepted ${batchAcceptableItems.length} suggested state change${batchAcceptableItems.length === 1 ? '' : 's'} from "${batchAcceptableItems[0]?.sceneTitle || 'scene'}".`
      });
    },
    [acceptStateMutationReviewItem, setFeedback, stateMutationReviewItems]
  );

  const rejectSceneStateMutationReviewItems = useCallback(
    async (sceneId: string) => {
      const applyingId = `scene:${sceneId}:reject`;
      const sceneItems = stateMutationReviewItems.filter((item) => item.sceneId === sceneId);
      if (sceneItems.length === 0) {
        setFeedback({
          tone: 'error',
          message: 'No suggested state changes to reject in this scene.'
        });
        return;
      }
      for (const item of sceneItems) {
        await rejectStateMutationReviewItem(item.id, applyingId);
      }
      setFeedback({
        tone: 'success',
        message: `Rejected ${sceneItems.length} suggested state change${sceneItems.length === 1 ? '' : 's'} from "${sceneItems[0]?.sceneTitle || 'scene'}".`
      });
    },
    [rejectStateMutationReviewItem, setFeedback, stateMutationReviewItems]
  );

  const unknownLinkOptions = useMemo(() => {
    const optionMap: Record<string, LinkTargetOption[]> = {};
    const categoryLabelById = new Map(
      categories.map((category) => [category.id, category.name])
    );
    unknownGuardrailIssues.forEach((issue) => {
      const surface = (issue.surface ?? '').trim();
      if (!surface) return;
      const normalizedSurface = surface.toLowerCase();
      const candidatesByKey = new Map<string, LinkTargetOption>();
      entities.forEach((entity) => {
        candidatesByKey.set(`entity:${entity.id}`, {
          id: entity.id,
          name: entity.name,
          type: 'entity',
          label: categoryLabelById.get(entity.categoryId) ?? 'World Bible'
        });
      });
      characters.forEach((character) => {
        const linkedEntityId = characterLoreEntityIdByCharacterId.get(character.id);
        if (linkedEntityId && candidatesByKey.has(`entity:${linkedEntityId}`)) {
          return;
        }
        candidatesByKey.set(`character:${character.id}`, {
          id: character.id,
          name: character.name,
          type: 'character',
          label: 'Character'
        });
      });
      const candidates = Array.from(candidatesByKey.values());
      const ranked = [...candidates].sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aExact = aName === normalizedSurface ? 0 : 1;
        const bExact = bName === normalizedSurface ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        const aClose =
          aName.includes(normalizedSurface) || normalizedSurface.includes(aName) ? 0 : 1;
        const bClose =
          bName.includes(normalizedSurface) || normalizedSurface.includes(bName) ? 0 : 1;
        if (aClose !== bClose) return aClose - bClose;
        return a.name.localeCompare(b.name);
      });
      optionMap[surface] = ranked.slice(0, 20);
    });
    return optionMap;
  }, [categories, characterLoreEntityIdByCharacterId, characters, entities, unknownGuardrailIssues]);

  const closeUnknownLinkOptions = useMemo(() => {
    const optionMap: Record<
      string,
      Array<{id: string; name: string; type: 'character' | 'entity'}>
    > = {};
    unknownGuardrailIssues.forEach((issue) => {
      const surface = (issue.surface ?? '').trim();
      if (!surface) return;
      const normalizedSurface = surface.toLowerCase();
      const candidates = unknownLinkOptions[surface] ?? [];
      optionMap[surface] = candidates.filter((record) => {
        const normalizedName = record.name.toLowerCase();
        if (normalizedName === normalizedSurface) {
          return true;
        }
        return (
          normalizedName.includes(normalizedSurface) ||
          normalizedSurface.includes(normalizedName)
        );
      });
    });
    return optionMap;
  }, [unknownGuardrailIssues, unknownLinkOptions]);

  const resolveUnknownEntity = useCallback(
    async (
      surface: string,
      categoryId?: string,
      preferredName?: string
    ) => {
      if (!activeProject) return;

      const normalizedSurface = surface.trim();
      const normalizedName = preferredName?.trim() || normalizedSurface;
      if (!normalizedSurface || !normalizedName) return;

      setResolvingUnknown(surface);
      setFeedback(null);
      try {
        let availableCategories = categories;
        if (availableCategories.length === 0) {
          await initializeDefaultCategories(activeProject.id);
          availableCategories = await getCategoriesByProject(activeProject.id);
          setCategories(availableCategories);
        }

        const inferredCategoryId = getSuggestedUnknownCategoryId(normalizedSurface);
        const selectedCategory = categoryId
          ? availableCategories.find((c) => c.id === categoryId)
          : inferredCategoryId
            ? availableCategories.find((c) => c.id === inferredCategoryId) ?? null
            : null;
        const chosenCategory =
          selectedCategory ??
          availableCategories.find((category) =>
            ['characters', 'locations', 'items'].includes(category.slug)
          ) ??
          availableCategories[0];

        if (!chosenCategory) {
          throw new Error('No categories available for entity creation.');
        }

        const now = Date.now();
        const explicitCharacterSelection = Boolean(
          selectedCategory &&
            ['character', 'characters', 'npc', 'person', 'people'].some((hint) =>
              selectedCategory.slug.toLowerCase().includes(hint)
            )
        );
        if (explicitCharacterSelection) {
          const normalizedCharacterName = normalizeRecordName(normalizedName);
          const linkedCharacterEntity = entities.find(
            (entity) =>
              entity.categoryId === chosenCategory.id &&
              normalizeRecordName(entity.name) === normalizedCharacterName
          );
          const closeCharacterMatch = [...characters]
            .filter(
              (candidate) =>
                normalizeRecordName(candidate.name) !== normalizedCharacterName
            )
            .sort((left, right) => {
              const leftName = normalizeRecordName(left.name);
              const rightName = normalizeRecordName(right.name);
              const leftClose =
                leftName.includes(normalizedCharacterName) ||
                normalizedCharacterName.includes(leftName)
                  ? 0
                  : 1;
              const rightClose =
                rightName.includes(normalizedCharacterName) ||
                normalizedCharacterName.includes(rightName)
                  ? 0
                  : 1;
              if (leftClose !== rightClose) {
                return leftClose - rightClose;
              }
              return left.name.localeCompare(right.name);
            })[0] ?? null;
          const character: Character = {
            id: crypto.randomUUID(),
            projectId: activeProject.id,
            name: normalizedName,
            fields: {},
            createdAt: now,
            updatedAt: now
          };
          await saveCharacter(character);
          const characterEntity =
            linkedCharacterEntity ??
            ({
              id: crypto.randomUUID(),
              projectId: activeProject.id,
              categoryId: chosenCategory.id,
              name: normalizedName,
              fields: {},
              isNew: true,
              needsCompletion: false,
              links: [],
              createdAt: now,
              updatedAt: now
            } satisfies WorldEntity);
          if (!linkedCharacterEntity) {
            await saveEntity(characterEntity);
            setEntities((prev) => [...prev, characterEntity]);
          }
          const derivedNameAlias = deriveFirstNameAlias(normalizedName);
          const aliasTexts = [
            ...(normalizedName.toLowerCase() === normalizedSurface.toLowerCase()
              ? []
              : [normalizedName, normalizedSurface]),
            ...(derivedNameAlias ? [derivedNameAlias] : [])
          ];
          await attachAliasTexts({
            projectId: activeProject.id,
            targetId: characterEntity.id,
            targetType: 'entity',
            aliasTexts
          });
          setCharacters((prev) => [...prev, character]);
          setFeedback({
            tone: 'success',
            message: `"${normalizedName}" added to World Bible Characters and Character Tools.`
          });
          setResolverNotice({
            message: closeCharacterMatch
              ? `"${normalizedName}" added to World Bible Characters. Review possible match with "${closeCharacterMatch.name}".`
              : `"${normalizedName}" added to World Bible Characters.`,
            primaryLabel: closeCharacterMatch ? 'Review Character Match' : undefined,
            destination: 'world-bible',
            targetId: characterEntity.id,
            matchEntityId: closeCharacterMatch?.id,
            sourceName: normalizedName
          });
        } else {
          const entity: WorldEntity = {
            id: crypto.randomUUID(),
            projectId: activeProject.id,
            categoryId: chosenCategory.id,
            name: normalizedName,
            fields: {},
            isNew: true,
            needsCompletion: false,
            links: [],
            createdAt: now,
            updatedAt: now
          };
          await saveEntity(entity);
          await attachAliasTexts({
            projectId: activeProject.id,
            targetId: entity.id,
            targetType: 'entity',
            aliasTexts:
              normalizedName.toLowerCase() === normalizedSurface.toLowerCase()
                ? []
                : [normalizedName, normalizedSurface]
          });
          setEntities((prev) => [...prev, entity]);
          setFeedback({
            tone: 'success',
            message: `"${normalizedName}" added to ${chosenCategory.name}. It will stay marked new until you open the lore entry and save it.`
          });
          setResolverNotice({
            message: `"${normalizedName}" added to your world.`,
            destination: 'world-bible',
            targetId: entity.id
          });
        }
        removeReviewSurface(normalizedSurface);
        const derivedReviewSurface = deriveFirstNameAlias(normalizedName);
        if (derivedReviewSurface) {
          removeReviewSurface(derivedReviewSurface);
        }
        setUnknownLinkSelection((prev) => {
          const copy = {...prev};
          delete copy[surface];
          return copy;
        });
        setUnknownCategorySelection((prev) => {
          const copy = {...prev};
          delete copy[surface];
          return copy;
        });
        setConsistencyPopover((prev) =>
          canonicalizeUnknownSurface(prev?.surface ?? '') ===
          canonicalizeUnknownSurface(normalizedSurface)
            ? null
            : prev
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to create entity.';
        setFeedback({tone: 'error', message});
      } finally {
        setResolvingUnknown(null);
      }
    },
    [
      activeProject,
      attachAliasTexts,
      categories,
      characters,
      entities,
      getSuggestedUnknownCategoryId,
      removeReviewSurface,
      setCategories,
      setCharacters,
      setEntities,
      setFeedback
    ]
  );

  const clearUnknownSurface = useCallback((surface: string) => {
    removeReviewSurface(surface, {docId: selectedDocumentId ?? undefined});
  }, [removeReviewSurface, selectedDocumentId]);

  const resolveAllUnknownEntities = useCallback(async () => {
    const surfaces = unknownGuardrailIssues
      .map((issue) => issue.surface?.trim())
      .filter((surface): surface is string => Boolean(surface));
    if (surfaces.length === 0) return;

    for (const surface of surfaces) {
      await resolveUnknownEntity(surface);
    }
  }, [resolveUnknownEntity, unknownGuardrailIssues]);

  const dismissAllUnknownEntities = useCallback((docId?: string) => {
    const dismissedSurfaces = Array.from(
      new Set(
        unknownGuardrailIssues
          .map((issue) => issue.surface?.trim())
          .filter((surface): surface is string => Boolean(surface))
      )
    );
    const blocked = new Set(
        unknownGuardrailIssues
          .map((issue) => (issue.surface ? canonicalizeUnknownSurface(issue.surface) : ''))
          .filter((surface): surface is string => Boolean(surface))
    );
    if (docId && dismissedSurfaces.length > 0) {
      setDismissedUnknownByDocument((prev) => ({
        ...prev,
        [docId]: Array.from(
          new Set([...(prev[docId] ?? []), ...dismissedSurfaces])
        )
      }));
    }
    setGuardrailIssues((prev) =>
      prev.filter((issue) => {
        const surface = issue.surface ? canonicalizeUnknownSurface(issue.surface) : '';
        return !surface || !blocked.has(surface);
      })
    );
    setConsistencyReviewItems((prev) =>
      prev.filter((item) => {
        const surface = item.issue.surface
          ? canonicalizeUnknownSurface(item.issue.surface)
          : '';
        return !surface || !blocked.has(surface);
      })
    );
    setFeedback({
      tone: 'success',
      message: 'Unknown entity warnings dismissed for now.'
    });
  }, [setFeedback, unknownGuardrailIssues]);

  const dismissUnknownEntity = useCallback((surface: string, docId?: string) => {
    const normalized = canonicalizeUnknownSurface(surface);
    if (!normalized) return;
    if (docId) {
      setDismissedUnknownByDocument((prev) => ({
        ...prev,
        [docId]: Array.from(new Set([...(prev[docId] ?? []), surface.trim()]))
      }));
    }
    removeReviewSurface(surface, {docId});
    setConsistencyPopover((prev) =>
      canonicalizeUnknownSurface(prev?.surface ?? '') === normalized ? null : prev
    );
  }, [removeReviewSurface]);

  const ignoreUnknownSurfaceProjectWide = useCallback(
    (surface: string, docId?: string) => {
      const normalized = surface.trim();
      if (!normalized) return;
      if (!projectSettings || !activeProject) {
        setFeedback({
          tone: 'error',
          message: 'Project settings are not available yet. Try again in a moment.'
        });
        return;
      }
      const mergedIgnored = Array.from(
        new Set([...(projectSettings.ignoredUnknownSurfaces ?? []), normalized.toLowerCase()])
      );
      if (docId) {
        setDismissedUnknownByDocument((prev) => ({
          ...prev,
          [docId]: Array.from(new Set([...(prev[docId] ?? []), surface.trim()]))
        }));
      }
      removeReviewSurface(surface);
      setConsistencyPopover((prev) =>
        canonicalizeUnknownSurface(prev?.surface ?? '') ===
        canonicalizeUnknownSurface(surface)
          ? null
          : prev
      );
      const nextSettings: ProjectSettings = {
        ...projectSettings,
        ignoredUnknownSurfaces: mergedIgnored,
        updatedAt: Date.now()
      };
      void saveProjectSettings(nextSettings)
        .then(() => {
          setFeedback({
            tone: 'success',
            message: `"${normalized}" will be ignored for this project in future reviews.`
          });
        })
        .catch((error) => {
          const message =
            error instanceof Error ? error.message : 'Unable to save project review settings.';
          setFeedback({tone: 'error', message});
        });
    },
    [
      activeProject,
      projectSettings,
      removeReviewSurface,
      setFeedback,
      saveProjectSettings
    ]
  );

  const linkUnknownEntity = useCallback(
    async (
      surface: string,
      explicitEntityId?: string,
      preferredAlias?: string
    ): Promise<LinkUnknownEntityResult | false> => {
      if (!activeProject) return false;
      const selectedEntityId = explicitEntityId ?? unknownLinkSelection[surface];
      if (!selectedEntityId) {
        setFeedback({
          tone: 'error',
          message: `Select an entity before linking "${surface}".`
        });
        return false;
      }

      setLinkingUnknown(surface);
      setFeedback(null);
      try {
        const [selectedTargetType, selectedTargetId] = selectedEntityId.split(':');
        if (
          (selectedTargetType !== 'entity' && selectedTargetType !== 'character') ||
          !selectedTargetId
        ) {
          throw new Error('Invalid link target selected.');
        }
        const characterCategoryIds = new Set(
          categories
            .filter((category) => category.slug.toLowerCase().includes('character'))
            .map((category) => category.id)
        );
        let targetType: 'entity' | 'character' = selectedTargetType;
        let targetId = selectedTargetId;
        if (selectedTargetType === 'character') {
          const selectedCharacter = characters.find((character) => character.id === selectedTargetId);
          const linkedEntity = selectedCharacter
            ? entities.find(
                (entity) =>
                  characterCategoryIds.has(entity.categoryId) &&
                  normalizeRecordName(entity.name) === normalizeRecordName(selectedCharacter.name)
              )
            : null;
          if (linkedEntity) {
            targetType = 'entity';
            targetId = linkedEntity.id;
          }
        }
        const aliasTexts =
          preferredAlias && preferredAlias.trim()
            ? [preferredAlias.trim(), surface]
            : [surface];
        await attachAliasTexts({
          projectId: activeProject.id,
          targetId,
          targetType,
          aliasTexts
        });
        removeReviewSurface(surface);
        setUnknownLinkSelection((prev) => {
          const copy = {...prev};
          delete copy[surface];
          return copy;
        });
        setConsistencyPopover((prev) =>
          canonicalizeUnknownSurface(prev?.surface ?? '') ===
          canonicalizeUnknownSurface(surface)
            ? null
            : prev
        );
        setFeedback({
          tone: 'success',
          message: `Connected "${surface}" to an existing record. Save again to validate.`
        });
        setResolverNotice(null);
        return {
          destination:
            targetType === 'character'
              ? ruleset
                ? 'character-sheet-create'
                : 'characters'
              : 'world-bible',
          targetId,
          focus:
            selectedTargetType === 'character' || selectedTargetType === 'entity'
              ? selectedTargetType === 'character'
                ? 'aliases'
                : 'general'
              : 'general'
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to link alias.';
        setFeedback({tone: 'error', message});
        return false;
      } finally {
        setLinkingUnknown(null);
      }
    },
    [
      activeProject,
      attachAliasTexts,
      categories,
      characters,
      entities,
      ruleset,
      removeReviewSurface,
      setFeedback,
      unknownLinkSelection
    ]
  );

  const activeConsistencyPopoverIssue = consistencyPopover
    ? highlightableUnknownIssues.find((issue) => issue.id === consistencyPopover.issueId) ?? null
    : null;

  const openConsistencyPopover = useCallback(
    (
      issueId: string,
      anchorRect: {left: number; bottom: number},
      surface: string
    ) => {
      setConsistencyPopover({
        issueId,
        surface,
        left: anchorRect.left,
        top: anchorRect.bottom + 8
      });
      setUnknownLinkSelection((prev) => ({
        ...prev,
        [surface]:
          prev[surface] ??
          (unknownLinkOptions[surface]?.[0]
            ? `${unknownLinkOptions[surface][0].type}:${unknownLinkOptions[surface][0].id}`
            : '')
      }));
      setUnknownCategorySelection((prev) => ({
        ...prev,
        [surface]: prev[surface] ?? getSuggestedUnknownCategoryId(surface) ?? ''
      }));
    },
    [getSuggestedUnknownCategoryId, unknownLinkOptions]
  );

  return {
    guardrailIssues,
    setGuardrailIssues,
    resolvingUnknown,
    linkingUnknown,
    resolverNotice,
    setResolverNotice,
    getSuggestedUnknownCategoryId,
    unknownLinkSelection,
    setUnknownLinkSelection,
    unknownCategorySelection,
    setUnknownCategorySelection,
    isRunningConsistencyReview,
    consistencyReviewItems,
    stateMutationReviewItems,
    hiddenStateMutationReviewCountBySceneId,
    hiddenStateMutationReviewCount,
    applyingStateMutationReviewId,
    lastConsistencyReviewAt,
    reviewReadiness,
    consistencyPopover,
    setConsistencyPopover,
    knownConsistencyEntities,
    persistDoc,
    refreshDeferredReview,
    refreshActiveDraftReview,
    handleRunConsistencyReview,
    unknownGuardrailIssues,
    hasBlockingUnknownGuardrailIssues,
    highlightableUnknownIssues,
    isReviewPrefsHydrated,
    unknownLinkOptions,
    closeUnknownLinkOptions,
    resolveUnknownEntity,
    resolveAllUnknownEntities,
    dismissAllUnknownEntities,
    dismissUnknownEntity,
    ignoreUnknownSurfaceProjectWide,
    linkUnknownEntity,
    clearUnknownSurface,
    activeConsistencyPopoverIssue,
    openConsistencyPopover,
    acceptStateMutationReviewItem,
    rejectStateMutationReviewItem,
    acceptSceneStateMutationReviewItems,
    rejectSceneStateMutationReviewItems,
    hideStateMutationReviewItem,
    restoreHiddenStateMutationReviewItems,
    restoreAllHiddenStateMutationReviewItems
  };
};
