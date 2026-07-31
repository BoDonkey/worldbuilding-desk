import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction
} from 'react';
import type {NavigateFunction} from 'react-router';
import type {
  CanonicalFact,
  Character,
  EntityCategory,
  LoreDocument,
  LoreDocumentKind,
  LoreDocumentLink,
  Project,
  StateMutationEvent,
  WritingDocument,
  WorldEntity
} from '../entityTypes';
import {saveLoreDocument, saveLoreDocumentLinks} from '../loreStorage';
import type {RAGProvider} from '../services/rag/RAGService';
import {
  ALTERNATIVE_NAMES_KEY,
  extractPlainTextFromRichText,
  normalizeName,
  parseAlternativeNames
} from '../services/worldBible/worldBibleEntityHelpers';
import {buildCanonicalAliasList} from '../services/worldBible/worldBibleCanonicalization';
import {htmlToPlainText} from '../utils/textHelpers';

interface WorldBibleFeedback {
  tone: 'success' | 'error';
  message: string;
}

interface UseWorldBibleSelectedEntityOptions {
  activeProject: Project | null;
  editingId: string | null;
  entities: WorldEntity[];
  characters: Character[];
  loreDocuments: LoreDocument[];
  loreDocumentLinks: LoreDocumentLink[];
  aliasMapByEntityId: Map<string, string[]>;
  canonicalFacts: CanonicalFact[];
  writingDocuments: WritingDocument[];
  stateMutationEvents: StateMutationEvent[];
  ragService: RAGProvider | null;
  categoryById: Map<string, EntityCategory>;
  navigate: NavigateFunction;
  setFeedback: Dispatch<SetStateAction<WorldBibleFeedback | null>>;
}

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const countTermMentions = (text: string, terms: string[]): number => {
  const uniqueTerms = Array.from(
    new Set(terms.map((term) => term.trim()).filter((term) => term.length > 1))
  );
  return uniqueTerms.reduce((count, term) => {
    const matches = text.match(new RegExp(`\\b${escapeRegExp(term)}\\b`, 'gi'));
    return count + (matches?.length ?? 0);
  }, 0);
};

const inferLoreKindForCategory = (
  category: EntityCategory | null
): LoreDocumentKind => {
  const slug = category?.slug.toLowerCase() ?? '';
  if (slug.includes('character') || slug.includes('cast')) return 'character_dossier';
  if (slug.includes('location') || slug.includes('place')) return 'place_history';
  if (slug.includes('faction') || slug.includes('organization')) return 'faction_notes';
  if (slug.includes('item') || slug.includes('artifact')) return 'item_history';
  return 'general_lore';
};

const summarizeEntityForLore = (
  entity: WorldEntity,
  category: EntityCategory | null
): string => {
  const fieldLines = Object.entries(entity.fields)
    .map(([key, value]) => {
      const field = category?.fieldSchema.find((candidate) => candidate.key === key);
      const label = field?.label ?? key;
      const plainValue =
        typeof value === 'string'
          ? extractPlainTextFromRichText(value)
          : String(value ?? '');
      return plainValue.trim() ? `${label}: ${plainValue.trim()}` : '';
    })
    .filter(Boolean);
  return [
    `${entity.name} source notes`,
    '',
    'Use this linked Source Note for longform background, source excerpts, timelines, and exploratory notes.',
    '',
    ...fieldLines
  ].join('\n');
};

export function useWorldBibleSelectedEntity({
  activeProject,
  editingId,
  entities,
  characters,
  loreDocuments,
  loreDocumentLinks,
  aliasMapByEntityId,
  canonicalFacts,
  writingDocuments,
  stateMutationEvents,
  ragService,
  categoryById,
  navigate,
  setFeedback
}: UseWorldBibleSelectedEntityOptions) {
  const [linkingLoreEntityId, setLinkingLoreEntityId] = useState<string | null>(null);
  const [characterHealthProbeResults, setCharacterHealthProbeResults] = useState<
    Awaited<ReturnType<RAGProvider['search']>>
  >([]);
  const [characterHealthProbeRunning, setCharacterHealthProbeRunning] = useState(false);

  const selectedEntity = editingId
    ? entities.find((entity) => entity.id === editingId) ?? null
    : null;
  const selectedEntityCharacterToolProfile = useMemo(
    () =>
      selectedEntity
        ? characters.find(
            (character) =>
              normalizeName(character.name) === normalizeName(selectedEntity.name)
          ) ?? null
        : null,
    [characters, selectedEntity]
  );
  const linkedLoreDocumentByEntityId = useMemo(() => {
    const documentsById = new Map(
      loreDocuments.map((document) => [document.id, document])
    );
    const map = new Map<string, LoreDocument>();
    loreDocumentLinks.forEach((link) => {
      if (link.targetType !== 'entity') return;
      const document = documentsById.get(link.loreDocumentId);
      if (!document || map.has(link.targetId)) return;
      map.set(link.targetId, document);
    });
    return map;
  }, [loreDocumentLinks, loreDocuments]);
  const linkedLoreDocumentsForSelectedEntity = useMemo(() => {
    if (!selectedEntity) return [];
    const documentsById = new Map(
      loreDocuments.map((document) => [document.id, document])
    );
    const targetKeys = new Set([
      `entity:${selectedEntity.id}`,
      ...(selectedEntityCharacterToolProfile
        ? [`character:${selectedEntityCharacterToolProfile.id}`]
        : [])
    ]);
    return loreDocumentLinks
      .filter((link) => targetKeys.has(`${link.targetType}:${link.targetId}`))
      .map((link) => {
        const document = documentsById.get(link.loreDocumentId);
        return document ? {link, document} : null;
      })
      .filter(
        (entry): entry is {link: LoreDocumentLink; document: LoreDocument} =>
          Boolean(entry)
      );
  }, [
    loreDocumentLinks,
    loreDocuments,
    selectedEntity,
    selectedEntityCharacterToolProfile
  ]);
  const selectedEntityAliases = useMemo(
    () =>
      selectedEntity
        ? buildCanonicalAliasList({
            nextName: selectedEntity.name,
            aliases: aliasMapByEntityId.get(selectedEntity.id) ?? [],
            suggestedAliases: parseAlternativeNames(
              String(selectedEntity.fields[ALTERNATIVE_NAMES_KEY] ?? '')
            )
          })
        : [],
    [aliasMapByEntityId, selectedEntity]
  );
  const selectedEntityFacts = useMemo(() => {
    if (!selectedEntity) return [];
    const targetKeys = new Set([
      `entity:${selectedEntity.id}`,
      ...(selectedEntityCharacterToolProfile
        ? [`character:${selectedEntityCharacterToolProfile.id}`]
        : [])
    ]);
    return canonicalFacts
      .filter((fact) => targetKeys.has(`${fact.targetType}:${fact.targetId}`))
      .sort((left, right) => left.factType.localeCompare(right.factType));
  }, [canonicalFacts, selectedEntity, selectedEntityCharacterToolProfile]);
  const selectedEntitySceneMentions = useMemo(() => {
    if (!selectedEntity) return [];
    const terms = [selectedEntity.name, ...selectedEntityAliases];
    return writingDocuments
      .map((document) => ({
        document,
        mentionCount: countTermMentions(htmlToPlainText(document.content), terms)
      }))
      .filter((entry) => entry.mentionCount > 0)
      .sort((left, right) => right.mentionCount - left.mentionCount);
  }, [selectedEntity, selectedEntityAliases, writingDocuments]);
  const selectedEntityStateEvents = useMemo(() => {
    if (!selectedEntity) return [];
    const actorIds = new Set(
      [selectedEntity.id, selectedEntityCharacterToolProfile?.id].filter(
        (id): id is string => Boolean(id)
      )
    );
    return stateMutationEvents.filter((event) =>
      event.commands.some((command) => actorIds.has(command.actorId))
    );
  }, [selectedEntity, selectedEntityCharacterToolProfile, stateMutationEvents]);
  const selectedEntityAcceptedStateEventCount = useMemo(
    () =>
      selectedEntityStateEvents.filter((event) => event.status === 'accepted').length,
    [selectedEntityStateEvents]
  );
  const selectedEntityProposedStateEventCount = useMemo(
    () =>
      selectedEntityStateEvents.filter((event) => event.status !== 'accepted').length,
    [selectedEntityStateEvents]
  );

  const handleCharacterHealthProbe = useCallback(async () => {
    if (!selectedEntity || !ragService) {
      setCharacterHealthProbeResults([]);
      return;
    }
    const query = [selectedEntity.name, ...selectedEntityAliases].join(' ').trim();
    if (!query) {
      setCharacterHealthProbeResults([]);
      return;
    }

    setCharacterHealthProbeRunning(true);
    try {
      setCharacterHealthProbeResults(await ragService.search(query, 5));
    } catch (error) {
      console.warn('Character detail health probe failed', error);
      setCharacterHealthProbeResults([]);
    } finally {
      setCharacterHealthProbeRunning(false);
    }
  }, [ragService, selectedEntity, selectedEntityAliases]);

  useEffect(() => {
    setCharacterHealthProbeResults([]);
  }, [selectedEntity?.id]);

  const handleOpenOrCreateLinkedLoreDocument = useCallback(
    async (entity: WorldEntity) => {
      if (!activeProject) return;
      const existingDocument = linkedLoreDocumentByEntityId.get(entity.id);
      if (existingDocument) {
        navigate('/lore', {state: {focusLoreDocumentId: existingDocument.id}});
        return;
      }

      const category = categoryById.get(entity.categoryId) ?? null;
      const now = Date.now();
      const documentId = crypto.randomUUID();
      const nextDocument: LoreDocument = {
        id: documentId,
        projectId: activeProject.id,
        title: `${entity.name} Dossier`,
        kind: inferLoreKindForCategory(category),
        format: 'plain_text',
        content: summarizeEntityForLore(entity, category),
        summary: `Linked source notes for ${entity.name}.`,
        source: {type: 'manual'},
        status: 'active',
        createdAt: now,
        updatedAt: now
      };
      const link: LoreDocumentLink = {
        id: crypto.randomUUID(),
        projectId: activeProject.id,
        loreDocumentId: documentId,
        targetType: 'entity',
        targetId: entity.id,
        relationship: 'primary_subject',
        createdAt: now
      };

      setLinkingLoreEntityId(entity.id);
      try {
        await saveLoreDocument(nextDocument);
        await saveLoreDocumentLinks([link]);
        setFeedback({
          tone: 'success',
          message: `Created a linked Source Note for "${entity.name}".`
        });
        navigate('/lore', {state: {focusLoreDocumentId: documentId}});
      } catch (error) {
        setFeedback({
          tone: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Unable to create linked Source Note.'
        });
      } finally {
        setLinkingLoreEntityId(null);
      }
    },
    [
      activeProject,
      categoryById,
      linkedLoreDocumentByEntityId,
      navigate,
      setFeedback
    ]
  );

  return {
    selectedEntity,
    linkedLoreDocumentByEntityId,
    linkedLoreDocumentsForSelectedEntity,
    selectedEntityAliases,
    selectedEntityFacts,
    selectedEntitySceneMentions,
    selectedEntityStateEvents,
    selectedEntityAcceptedStateEventCount,
    selectedEntityProposedStateEventCount,
    characterHealthProbeResults,
    characterHealthProbeRunning,
    handleCharacterHealthProbe,
    linkingLoreEntityId,
    handleOpenOrCreateLinkedLoreDocument
  };
}
