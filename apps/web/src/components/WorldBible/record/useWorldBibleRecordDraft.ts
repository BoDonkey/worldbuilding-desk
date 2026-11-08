import {useCallback, useMemo, useState} from 'react';
import type {
  EntityCategory,
  WorldCanvasLensKind,
  WorldEntity,
  WritingDocument
} from '../../../entityTypes';
import type {CharacterDetailSection} from '../WorldBibleCharacterSections';
import {
  isSystemNegativeSpaceCategory,
  normalizeSystemNegativeSpaceRecord,
  type SystemNegativeSpaceStatus
} from '../../../services/worldBible/systemNegativeSpace';
import {
  ALTERNATIVE_NAMES_KEY,
  formatAlternativeNames,
  normalizeRichTextValue,
  parseAlternativeNames
} from '../../../services/worldBible/worldBibleEntityHelpers';
import {isCharacterCategory} from '../../../services/worldBible/worldBibleSummary';

export type RecordAuthoringMode = 'idle' | 'manual';
export type RecordReviewFocus = 'general' | 'aliases';
/** A World Canvas item waiting to link to the record once it is first saved. */
export type PendingCanvasEntityLink =
  | {type: 'core-idea'}
  | {type: 'sketch'; kind: WorldCanvasLensKind; sketchId: string}
  | {type: 'open-thread'; id: string};

interface UseWorldBibleRecordDraftOptions {
  categories: EntityCategory[];
  categoryById: Map<string, EntityCategory>;
  aliasMapByEntityId: Map<string, string[]>;
  activeCategory: EntityCategory | undefined;
  /** Scenes a system negative space record may link to. */
  writingDocuments: WritingDocument[];
}

/**
 * The World Bible record panel's draft: which record is open, its unsaved
 * name and field values, how it is being authored, and the transitions
 * between a new record, an existing one, and the closed panel.
 */
export function useWorldBibleRecordDraft({
  categories,
  categoryById,
  aliasMapByEntityId,
  activeCategory,
  writingDocuments
}: UseWorldBibleRecordDraftOptions) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [characterAuthoringMode, setCharacterAuthoringMode] =
    useState<RecordAuthoringMode>('idle');
  const [recordAuthoringMode, setRecordAuthoringMode] =
    useState<RecordAuthoringMode>('idle');
  const [negativeSpaceStatus, setNegativeSpaceStatus] =
    useState<SystemNegativeSpaceStatus>('open');
  const [negativeSpaceSceneIds, setNegativeSpaceSceneIds] = useState<string[]>([]);
  const [characterDetailSection, setCharacterDetailSection] =
    useState<CharacterDetailSection>('canon');
  const [areItemDetailsExpanded, setAreItemDetailsExpanded] = useState(false);
  const [isPasteImportOpen, setIsPasteImportOpen] = useState(false);
  const [pastedImportText, setPastedImportText] = useState('');
  const [isNameResolverOpen, setIsNameResolverOpen] = useState(false);
  const [manualResolutionTargetId, setManualResolutionTargetId] = useState('');
  const [moveCategoryTargetId, setMoveCategoryTargetId] = useState('');
  const [pendingReviewFocus, setPendingReviewFocus] = useState<RecordReviewFocus | null>(
    null
  );
  const [pendingCanvasEntityLink, setPendingCanvasEntityLink] =
    useState<PendingCanvasEntityLink | null>(null);

  const isSystemNegativeSpace = isSystemNegativeSpaceCategory(activeCategory);
  /** The negative-space status and scene links as they will save; undefined for other categories. */
  const systemNegativeSpace = useMemo(
    () => isSystemNegativeSpace
      ? normalizeSystemNegativeSpaceRecord(
          {status: negativeSpaceStatus, sceneIds: negativeSpaceSceneIds},
          new Set(writingDocuments.map((document) => document.id))
        )
      : undefined,
    [
      isSystemNegativeSpace,
      negativeSpaceSceneIds,
      negativeSpaceStatus,
      writingDocuments
    ]
  );

  const reset = useCallback(() => {
    setEditingId(null);
    setName('');
    setFieldValues({});
    setPendingReviewFocus(null);
    setIsNameResolverOpen(false);
    setManualResolutionTargetId('');
    setMoveCategoryTargetId('');
    setCharacterAuthoringMode('idle');
    setCharacterDetailSection('canon');
    setRecordAuthoringMode('idle');
    setNegativeSpaceStatus('open');
    setNegativeSpaceSceneIds([]);
    setAreItemDetailsExpanded(false);
    setIsPasteImportOpen(false);
    setPastedImportText('');
    setPendingCanvasEntityLink(null);
  }, []);

  const startCharacter = useCallback(() => {
    setEditingId(null);
    setName('');
    setFieldValues({});
    setCharacterAuthoringMode('manual');
    setCharacterDetailSection('canon');
    setRecordAuthoringMode('idle');
    setIsPasteImportOpen(false);
    setPastedImportText('');
  }, []);

  const startRecord = useCallback(() => {
    setEditingId(null);
    setName('');
    setFieldValues({});
    setPendingReviewFocus(null);
    setIsNameResolverOpen(false);
    setManualResolutionTargetId('');
    setCharacterAuthoringMode('idle');
    setCharacterDetailSection('canon');
    setRecordAuthoringMode('manual');
    setNegativeSpaceStatus('open');
    setNegativeSpaceSceneIds([]);
    setAreItemDetailsExpanded(false);
    setIsPasteImportOpen(false);
    setPastedImportText('');
  }, []);

  /** Opens a new, prefilled record proposed from World Canvas, linked back once saved. */
  const startCanvasProposal = useCallback(
    (category: EntityCategory, recordName: string, link: PendingCanvasEntityLink) => {
      const isCharacter = isCharacterCategory(category);
      setEditingId(null);
      setName(recordName);
      setFieldValues({});
      setCharacterAuthoringMode(isCharacter ? 'manual' : 'idle');
      setRecordAuthoringMode(isCharacter ? 'idle' : 'manual');
      setCharacterDetailSection('canon');
      setPendingCanvasEntityLink(link);
    },
    []
  );

  /** Loads a saved record into the draft, merging stored and indexed aliases. */
  const edit = useCallback((entity: WorldEntity, focus: RecordReviewFocus = 'general') => {
    setEditingId(entity.id);
    const entityCategory = categoryById.get(entity.categoryId);
    const entityIsCharacterCategory = Boolean(
      entityCategory && isCharacterCategory(entityCategory)
    );
    setCharacterAuthoringMode(
      entityIsCharacterCategory ? 'manual' : 'idle'
    );
    setCharacterDetailSection('canon');
    setRecordAuthoringMode(entityIsCharacterCategory ? 'idle' : 'manual');
    setAreItemDetailsExpanded(true);
    setPendingReviewFocus(focus);
    setName(entity.name);
    setNegativeSpaceStatus(entity.systemNegativeSpace?.status ?? 'open');
    setNegativeSpaceSceneIds(entity.systemNegativeSpace?.sceneIds ?? []);
    setMoveCategoryTargetId(entity.categoryId);
    const persistedAlternativeNames =
      typeof entity.fields[ALTERNATIVE_NAMES_KEY] === 'string'
        ? entity.fields[ALTERNATIVE_NAMES_KEY]
        : '';
    const indexedAlternativeNames = aliasMapByEntityId.get(entity.id) ?? [];
    const mergedAlternativeNames = formatAlternativeNames(
      parseAlternativeNames(
        [...parseAlternativeNames(persistedAlternativeNames), ...indexedAlternativeNames]
          .filter((alias) => alias.trim().toLowerCase() !== entity.name.trim().toLowerCase())
          .join(', ')
      )
    );
    const normalizedFields = Object.fromEntries(
      Object.entries(entity.fields as Record<string, string>).map(([key, value]) => {
        const fieldType = categories
          .find((category) => category.id === entity.categoryId)
          ?.fieldSchema.find((field) => field.key === key)?.type;
        return [
          key,
          fieldType === 'textarea'
            ? normalizeRichTextValue(String(value ?? ''))
            : String(value ?? '')
        ];
      })
    );
    setFieldValues({
      ...normalizedFields,
      [ALTERNATIVE_NAMES_KEY]: mergedAlternativeNames
    });
  }, [aliasMapByEntityId, categories, categoryById]);

  return {
    editingId,
    name,
    setName,
    fieldValues,
    setFieldValues,
    characterAuthoringMode,
    recordAuthoringMode,
    negativeSpaceStatus,
    setNegativeSpaceStatus,
    negativeSpaceSceneIds,
    setNegativeSpaceSceneIds,
    systemNegativeSpace,
    characterDetailSection,
    setCharacterDetailSection,
    areItemDetailsExpanded,
    setAreItemDetailsExpanded,
    isPasteImportOpen,
    setIsPasteImportOpen,
    pastedImportText,
    setPastedImportText,
    isNameResolverOpen,
    setIsNameResolverOpen,
    manualResolutionTargetId,
    setManualResolutionTargetId,
    moveCategoryTargetId,
    setMoveCategoryTargetId,
    pendingReviewFocus,
    setPendingReviewFocus,
    pendingCanvasEntityLink,
    setPendingCanvasEntityLink,
    reset,
    startCharacter,
    startRecord,
    startCanvasProposal,
    edit
  };
}

export type WorldBibleRecordDraft = ReturnType<typeof useWorldBibleRecordDraft>;
