import {useCallback, useEffect, useMemo, useState} from 'react';
import type {ChangeEvent, Dispatch, SetStateAction} from 'react';
import type {EntityCategory, WorldEntity} from '../entityTypes';
import {saveEntity} from '../entityStorage';
import {saveCategory} from '../categoryStorage';
import {
  convertPlainTextToRichHtml,
  normalizeRichTextValue
} from '../services/worldBible/worldBibleEntityHelpers';
import {describeError} from '../services/errors';
import {parseDocxFile} from '../services/worldBible/docxImport';
import {
  buildPreview,
  classifyImportSections,
  detectImportDocumentName,
  detectImportSections,
  fileNameToEntityName,
  getNewFieldLabel,
  htmlToText,
  isExistingFieldMatch,
  mapImportedTextToFields,
  markdownToRichHtml,
  reconcileImportSectionDestinations,
  sanitizeImportedHtml,
  slugifyFieldKey,
  stripMarkdownComments
} from '../services/worldBible/worldBibleImportParsing';
import type {
  ImportSectionDestination,
  ImportSourceFormat,
  WorldBibleImportSectionDraft
} from '../services/worldBible/worldBibleImportParsing';

export type {
  ImportSectionDestination,
  ImportSourceFormat,
  WorldBibleImportSectionAction,
  WorldBibleImportSectionDraft
} from '../services/worldBible/worldBibleImportParsing';
export {
  detectImportDocumentName,
  detectImportSections,
  mapImportedTextToFields,
  markdownToRichHtml
} from '../services/worldBible/worldBibleImportParsing';

export type ImportMode = 'create' | 'upsert';

export interface WorldBibleImportDraft {
  id: string;
  fileName: string;
  name: string;
  text: string;
  richTextHtml?: string;
  sourceFormat?: ImportSourceFormat;
  preview: string;
  categoryId: string;
  mode: ImportMode;
  include: boolean;
  detectedSections?: WorldBibleImportSectionDraft[];
  useDetectedSections?: boolean;
  parseError?: string;
  /** Unset means waiting: nothing from this draft is saved yet. */
  status?: 'imported' | 'failed';
  importedEntityId?: string;
  importedEntityName?: string;
  importError?: string;
}


interface JsonImportRowInput {
  rowIndex: number;
  record: Record<string, unknown>;
}

export interface JsonImportSession {
  fileName: string;
  rows: JsonImportRowInput[];
  keys: string[];
  categoryId: string;
  mode: ImportMode;
  nameKey: string;
  fieldMap: Record<string, string>;
}

export type JsonImportConflictResolution = ImportMode | 'skip';

interface JsonImportConflict {
  kind: 'existing' | 'batch-duplicate';
  message: string;
}

export interface JsonImportPreparedRow {
  rowIndex: number;
  name: string;
  fields: Record<string, string>;
  errors: string[];
  existingEntityId?: string;
  conflict?: JsonImportConflict;
  resolution: JsonImportConflictResolution;
}

type FeedbackState = {
  tone: 'success' | 'error';
  message: string;
} | null;

interface UseWorldBibleImportsParams {
  activeProjectId: string | null;
  activeCategory: EntityCategory | null;
  categories: EntityCategory[];
  entities: WorldEntity[];
  setCategories: Dispatch<SetStateAction<EntityCategory[]>>;
  setEntities: Dispatch<SetStateAction<WorldEntity[]>>;
  setFeedback: Dispatch<SetStateAction<FeedbackState>>;
  onEntitySaved?: (entity: WorldEntity, category: EntityCategory) => Promise<void>;
  onEntitiesChanged?: () => Promise<void>;
}



const valueToString = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => valueToString(item)).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return '';
};


const ensureSectionFields = async (
  category: EntityCategory,
  sections: WorldBibleImportSectionDraft[]
): Promise<EntityCategory> => {
  if (sections.length === 0) return category;
  const existingKeys = new Set(category.fieldSchema.map((field) => field.key));
  const nextFields = [...category.fieldSchema];
  let changed = false;

  sections.forEach((section) => {
    if (section.action !== 'new-field') return;
    const label = getNewFieldLabel(section);
    const existing = nextFields.find((field) => isExistingFieldMatch(field, label));
    if (existing) return;

    const baseKey = slugifyFieldKey(label);
    let key = baseKey;
    let suffix = 2;
    while (existingKeys.has(key)) {
      key = `${baseKey}_${suffix}`;
      suffix += 1;
    }
    existingKeys.add(key);
    nextFields.push({key, label, type: 'textarea'});
    changed = true;
  });

  if (!changed) return category;
  const updatedCategory = {...category, fieldSchema: nextFields};
  await saveCategory(updatedCategory);
  return updatedCategory;
};

interface ApplyImportDraftOptions {
  draftIds?: string[];
}

const buildStructuredImportDraft = (
  source: {
    fileName: string;
    text: string;
    richTextHtml?: string;
    sourceFormat: ImportSourceFormat;
  },
  category: EntityCategory
): WorldBibleImportDraft => {
  const name = detectImportDocumentName(source.text, source.fileName);
  const detectedSections = classifyImportSections(
    detectImportSections(source.text),
    category,
    name
  );
  return {
    id: crypto.randomUUID(),
    fileName: source.fileName,
    name,
    text: source.text,
    richTextHtml: source.richTextHtml,
    sourceFormat: source.sourceFormat,
    preview: buildPreview(source.text),
    categoryId: category.id,
    mode: 'create',
    include: true,
    detectedSections,
    useDetectedSections: detectedSections.length > 0
  };
};

export const useWorldBibleImports = ({
  activeProjectId,
  activeCategory,
  categories,
  entities,
  setCategories,
  setEntities,
  setFeedback,
  onEntitySaved,
  onEntitiesChanged
}: UseWorldBibleImportsParams) => {
  const [isImportingEntities, setIsImportingEntities] = useState(false);
  const [isApplyingImports, setIsApplyingImports] = useState(false);
  const [importDrafts, setImportDrafts] = useState<WorldBibleImportDraft[]>([]);
  const [isImportingJson, setIsImportingJson] = useState(false);
  const [isApplyingJsonImport, setIsApplyingJsonImport] = useState(false);
  const [jsonImportSession, setJsonImportSession] = useState<JsonImportSession | null>(
    null
  );
  const [jsonImportConflictResolutions, setJsonImportConflictResolutions] = useState<
    Record<number, JsonImportConflictResolution>
  >({});

  useEffect(() => {
    if (!activeProjectId) {
      setImportDrafts([]);
      setJsonImportSession(null);
      setJsonImportConflictResolutions({});
    }
  }, [activeProjectId]);

  const activeJsonCategory = useMemo(
    () =>
      jsonImportSession
        ? categories.find((category) => category.id === jsonImportSession.categoryId) ?? null
        : null,
    [categories, jsonImportSession]
  );

  const preparedJsonRows = useMemo<JsonImportPreparedRow[]>(() => {
    if (!jsonImportSession || !activeJsonCategory) return [];
    const existingByName = new Map(
      entities
        .filter((entity) => entity.categoryId === jsonImportSession.categoryId)
        .map((entity) => [entity.name.trim().toLowerCase(), entity])
    );
    const duplicateNameCounts = new Map<string, number>();
    jsonImportSession.rows.forEach((row) => {
      const nameRaw = valueToString(row.record[jsonImportSession.nameKey]);
      const normalized = nameRaw.trim().toLowerCase();
      if (!normalized) return;
      duplicateNameCounts.set(normalized, (duplicateNameCounts.get(normalized) ?? 0) + 1);
    });

    return jsonImportSession.rows.map((row) => {
      const errors: string[] = [];
      const nameRaw = valueToString(row.record[jsonImportSession.nameKey]);
      const name = nameRaw.trim();
      if (!name) {
        errors.push('Missing name value.');
      }

      const fields: Record<string, string> = {};
      for (const field of activeJsonCategory.fieldSchema) {
        const mappedKey = jsonImportSession.fieldMap[field.key];
        if (!mappedKey) {
          if (field.required) {
            errors.push(`Required field "${field.label}" is not mapped.`);
          }
          continue;
        }
        const value = valueToString(row.record[mappedKey]);
        if (field.required && !value) {
          errors.push(`Required field "${field.label}" is empty.`);
        }
        if (value) {
          fields[field.key] = value;
        }
      }
      const normalizedName = name.trim().toLowerCase();
      const existingEntity = normalizedName
        ? existingByName.get(normalizedName)
        : undefined;
      const hasBatchDuplicate = normalizedName
        ? (duplicateNameCounts.get(normalizedName) ?? 0) > 1
        : false;
      const conflict =
        jsonImportSession.mode === 'create' && existingEntity
          ? {
              kind: 'existing' as const,
              message: `Matches existing ${activeJsonCategory.name.slice(0, -1).toLowerCase()} "${existingEntity.name}". Choose whether to create a duplicate, update it, or skip this row.`
            }
          : hasBatchDuplicate
            ? {
                kind: 'batch-duplicate' as const,
                message:
                  'Another JSON row uses this same name in the selected category. Choose whether to create, update by name, or skip this row.'
              }
            : undefined;
      const resolution =
        jsonImportConflictResolutions[row.rowIndex] ??
        (conflict ? ('skip' as const) : jsonImportSession.mode);
      return {
        rowIndex: row.rowIndex,
        name,
        fields,
        errors,
        existingEntityId: existingEntity?.id,
        conflict,
        resolution
      };
    });
  }, [activeJsonCategory, entities, jsonImportConflictResolutions, jsonImportSession]);

  const jsonImportValidCount = preparedJsonRows.filter(
    (row) => row.errors.length === 0
  ).length;
  const jsonImportConflictCount = preparedJsonRows.filter((row) => row.conflict).length;
  const unresolvedJsonConflictCount = preparedJsonRows.filter(
    (row) => row.conflict && !jsonImportConflictResolutions[row.rowIndex]
  ).length;

  const handleImportEntities = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    if (!activeProjectId || !activeCategory) return;
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    setIsImportingEntities(true);
    setFeedback(null);
    const drafts: WorldBibleImportDraft[] = [];
    let parseFailures = 0;

    try {
      const files = Array.from(fileList);
      for (const file of files) {
        const lower = file.name.toLowerCase();
        try {
          if (lower.endsWith('.doc')) {
            parseFailures += 1;
            drafts.push({
              id: crypto.randomUUID(),
              fileName: file.name,
              name: fileNameToEntityName(file.name),
              text: '',
              preview: '',
              categoryId: activeCategory.id,
              mode: 'create',
              include: false,
              parseError:
                'Legacy .doc files are not supported yet. Convert to .docx, .txt, or .md.'
            });
            continue;
          }
          const isHtml = lower.endsWith('.html') || lower.endsWith('.htm');
          const isMarkdown = lower.endsWith('.md') || lower.endsWith('.markdown');
          let text: string;
          let richTextHtml: string;
          if (lower.endsWith('.docx')) {
            const docx = await parseDocxFile(file);
            text = docx.text;
            richTextHtml = docx.html;
          } else if (isHtml) {
            const raw = await file.text();
            text = htmlToText(raw);
            richTextHtml = sanitizeImportedHtml(raw);
          } else if (isMarkdown) {
            text = stripMarkdownComments(await file.text()).trim();
            richTextHtml = markdownToRichHtml(text);
          } else {
            text = (await file.text()).trim();
            richTextHtml = convertPlainTextToRichHtml(text);
          }
          drafts.push(buildStructuredImportDraft({
            fileName: file.name,
            text,
            richTextHtml,
            sourceFormat: isMarkdown ? 'markdown' : 'text'
          }, activeCategory));
        } catch {
          parseFailures += 1;
          drafts.push({
            id: crypto.randomUUID(),
            fileName: file.name,
            name: fileNameToEntityName(file.name),
            text: '',
            preview: '',
            categoryId: activeCategory.id,
            mode: 'create',
            include: false,
            parseError: 'Failed to parse this file.'
          });
        }
      }
      setImportDrafts(drafts);
      setFeedback({
        tone: parseFailures > 0 ? 'error' : 'success',
        message:
          parseFailures > 0
            ? `Prepared ${drafts.length - parseFailures} import draft(s); ${parseFailures} file(s) need attention.`
            : `Prepared ${drafts.length} import draft(s). Review and apply when ready.`
      });
    } finally {
      setIsImportingEntities(false);
      event.target.value = '';
    }
  }, [activeCategory, activeProjectId, setFeedback]);

  const preparePastedImportDraft = useCallback(
    (sourceText: string, sourceName?: string) => {
      if (!activeProjectId || !activeCategory) return;
      const text = sourceText.trim();
      if (!text) {
        setFeedback({
          tone: 'error',
          message: 'Paste text before preparing an import draft.'
        });
        return;
      }
      const fallbackName = sourceName?.trim() ||
        `Pasted ${activeCategory.name.replace(/s$/i, '') || 'entry'}`;
      const draft = buildStructuredImportDraft({
        fileName: fallbackName,
        text,
        richTextHtml: convertPlainTextToRichHtml(text),
        sourceFormat: 'text'
      }, activeCategory);
      setImportDrafts([draft]);
      setFeedback({
        tone: 'success',
        message: 'Prepared 1 pasted import draft. Review and apply when ready.'
      });
    },
    [activeCategory, activeProjectId, setFeedback]
  );

  const updateImportDraft = useCallback(
    (draftId: string, updates: Partial<WorldBibleImportDraft>) => {
      setImportDrafts((prev) =>
        prev.map((draft) => {
          if (draft.id !== draftId) return draft;
          const nextDraft = {...draft, ...updates};
          // A different category has different fields, so destinations start
          // over; renaming the entry keeps the author's chosen destinations.
          if (updates.categoryId && updates.categoryId !== draft.categoryId) {
            const category = categories.find((item) => item.id === nextDraft.categoryId);
            if (category && nextDraft.detectedSections) {
              nextDraft.detectedSections = classifyImportSections(
                nextDraft.detectedSections,
                category,
                nextDraft.name
              );
            }
          }
          return nextDraft;
        })
      );
    },
    [categories]
  );

  const updateImportSectionDestination = useCallback(
    (
      draftId: string,
      sectionId: string,
      destination: ImportSectionDestination
    ) => {
      setImportDrafts((prev) =>
        prev.map((draft) =>
          draft.id === draftId
            ? {
                ...draft,
                detectedSections: draft.detectedSections?.map((section) =>
                  section.id === sectionId
                    ? {
                        ...section,
                        action: destination.action,
                        fieldKey: destination.fieldKey,
                        newFieldLabel: destination.newFieldLabel
                      }
                    : section
                )
              }
            : draft
        )
      );
    },
    []
  );

  // When a category's fields change (an import in this batch created one, or
  // the author edited fields), open drafts pick up the new fields.
  useEffect(() => {
    setImportDrafts((prev) => {
      let changed = false;
      const next = prev.map((draft) => {
        const category = categories.find((item) => item.id === draft.categoryId);
        if (!category || !draft.detectedSections) return draft;
        const detectedSections = reconcileImportSectionDestinations(
          draft.detectedSections,
          category,
          draft.name
        );
        if (detectedSections === draft.detectedSections) return draft;
        changed = true;
        return {...draft, detectedSections};
      });
      return changed ? next : prev;
    });
  }, [categories]);

  const handleJsonImportFile = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    if (!activeProjectId || !activeCategory) return;
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImportingJson(true);
    setFeedback(null);
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as unknown;
      const recordsSource = Array.isArray(parsed)
        ? parsed
        : typeof parsed === 'object' && parsed !== null
          ? ((parsed as Record<string, unknown>).entries ??
            (parsed as Record<string, unknown>).items ??
            (parsed as Record<string, unknown>).rows)
          : null;

      if (!Array.isArray(recordsSource)) {
        throw new Error(
          'JSON must be an array of objects or an object with entries/items/rows.'
        );
      }

      const rows: JsonImportRowInput[] = [];
      const keySet = new Set<string>();
      recordsSource.forEach((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return;
        const record = item as Record<string, unknown>;
        Object.keys(record).forEach((key) => keySet.add(key));
        rows.push({
          rowIndex: index + 1,
          record
        });
      });

      if (rows.length === 0) {
        throw new Error('No object rows found in JSON.');
      }

      const keys = Array.from(keySet).sort();
      const defaultNameKey = keys.includes('name') ? 'name' : (keys[0] ?? '');
      const defaultFieldMap: Record<string, string> = {};
      activeCategory.fieldSchema.forEach((field) => {
        defaultFieldMap[field.key] = keys.includes(field.key) ? field.key : '';
      });

      setJsonImportSession({
        fileName: file.name,
        rows,
        keys,
        categoryId: activeCategory.id,
        mode: 'create',
        nameKey: defaultNameKey,
        fieldMap: defaultFieldMap
      });
      setJsonImportConflictResolutions({});
      setFeedback({
        tone: 'success',
        message: `Loaded ${rows.length} JSON row(s). Map fields and apply when ready.`
      });
    } catch (error) {
      const message =
        describeError(error, 'Unable to parse JSON import file.');
      setFeedback({tone: 'error', message});
      setJsonImportSession(null);
      setJsonImportConflictResolutions({});
    } finally {
      setIsImportingJson(false);
      event.target.value = '';
    }
  }, [activeCategory, activeProjectId, setFeedback]);

  const handleJsonCategoryChange = useCallback((categoryId: string) => {
    const category = categories.find((item) => item.id === categoryId);
    setJsonImportSession((prev) => {
      if (!prev) return prev;
      const nextFieldMap: Record<string, string> = {};
      if (category) {
        category.fieldSchema.forEach((field) => {
          nextFieldMap[field.key] = prev.keys.includes(field.key) ? field.key : '';
        });
      }
      return {
        ...prev,
        categoryId,
        fieldMap: nextFieldMap
      };
    });
    setJsonImportConflictResolutions({});
  }, [categories]);

  const handleJsonFieldMapChange = useCallback((fieldKey: string, sourceKey: string) => {
    setJsonImportSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        fieldMap: {
          ...prev.fieldMap,
          [fieldKey]: sourceKey
        }
      };
    });
  }, []);

  const handleJsonConflictResolutionChange = useCallback(
    (rowIndex: number, resolution: JsonImportConflictResolution) => {
      setJsonImportConflictResolutions((prev) => ({
        ...prev,
        [rowIndex]: resolution
      }));
    },
    []
  );

  const handleJsonNameKeyChange = useCallback((nameKey: string) => {
    setJsonImportSession((prev) => (prev ? {...prev, nameKey} : prev));
  }, []);

  const handleJsonModeChange = useCallback((mode: ImportMode) => {
    setJsonImportSession((prev) => (prev ? {...prev, mode} : prev));
  }, []);

  const clearImportDrafts = useCallback(() => {
    setImportDrafts([]);
  }, []);

  const clearJsonImportSession = useCallback(() => {
    setJsonImportSession(null);
    setJsonImportConflictResolutions({});
  }, []);

  const applyImportDrafts = useCallback(async (options?: ApplyImportDraftOptions) => {
    if (!activeProjectId) return null;
    const queuedDrafts = importDrafts.filter(
      (draft) =>
        draft.include &&
        !draft.parseError &&
        draft.status !== 'imported' &&
        (!options?.draftIds || options.draftIds.includes(draft.id))
    );
    if (queuedDrafts.length === 0) {
      setFeedback({
        tone: 'error',
        message: 'No valid import drafts selected.'
      });
      return null;
    }

    setIsApplyingImports(true);
    setFeedback(null);
    const nextEntities = [...entities];
    const categoryById = new Map(categories.map((category) => [category.id, category]));
    let createdCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    let categoriesChanged = false;
    let firstImportedEntity: WorldEntity | null = null;
    const results = new Map<string, Partial<WorldBibleImportDraft>>();

    try {
      for (const draft of queuedDrafts) {
        const category = categoryById.get(draft.categoryId);
        if (!category) {
          failedCount += 1;
          results.set(draft.id, {
            status: 'failed',
            importError: 'Its category no longer exists. Choose another category.'
          });
          continue;
        }

        try {
          const sectionDrafts = draft.useDetectedSections
            ? reconcileImportSectionDestinations(draft.detectedSections ?? [], category, draft.name)
            : [];
          const importCategory = await ensureSectionFields(category, sectionDrafts);
          if (importCategory !== category) {
            categoryById.set(importCategory.id, importCategory);
            categoriesChanged = true;
          }
          const now = Date.now();
          const normalizedName = draft.name.trim().toLowerCase();
          const existing =
            draft.mode === 'upsert'
              ? nextEntities.find(
                  (entity) =>
                    entity.categoryId === draft.categoryId &&
                    entity.name.trim().toLowerCase() === normalizedName
                )
              : undefined;

          const entity: WorldEntity = existing
            ? {
                ...existing,
                fields: {
                  ...existing.fields,
                  ...mapImportedTextToFields(
                    importCategory,
                    draft.text,
                    draft.richTextHtml,
                    sectionDrafts,
                    draft.sourceFormat
                  )
                },
                updatedAt: now
              }
            : {
                id: crypto.randomUUID(),
                projectId: activeProjectId,
                categoryId: draft.categoryId,
                name: draft.name.trim() || fileNameToEntityName(draft.fileName),
                fields: mapImportedTextToFields(
                  importCategory,
                  draft.text,
                  draft.richTextHtml,
                  sectionDrafts,
                  draft.sourceFormat
                ),
                needsCompletion: false,
                links: [],
                createdAt: now,
                updatedAt: now
              };

          await saveEntity(entity);
          await onEntitySaved?.(entity, importCategory);
          if (!firstImportedEntity) {
            firstImportedEntity = entity;
          }

          if (existing) {
            const idx = nextEntities.findIndex((item) => item.id === existing.id);
            if (idx !== -1) nextEntities[idx] = entity;
            updatedCount += 1;
          } else {
            nextEntities.push(entity);
            createdCount += 1;
          }
          results.set(draft.id, {
            status: 'imported',
            importedEntityId: entity.id,
            importedEntityName: entity.name,
            importError: undefined
          });
        } catch (error) {
          failedCount += 1;
          results.set(draft.id, {
            status: 'failed',
            importError: describeError(error, 'This record could not be saved.')
          });
        }
      }

      setEntities(nextEntities);
      if (categoriesChanged) {
        setCategories(Array.from(categoryById.values()));
      }
      if (createdCount + updatedCount > 0) {
        await onEntitiesChanged?.();
      }

      setFeedback({
        tone: failedCount > 0 ? 'error' : 'success',
        message:
          `Imported ${createdCount} new entr${
            createdCount === 1 ? 'y' : 'ies'
          } and updated ${updatedCount}.` +
          (failedCount > 0 ? ` ${failedCount} failed.` : '')
      });

      // Drafts stay listed with their outcome so the author can see what was
      // saved, open it, or retry a failure.
      setImportDrafts((prev) =>
        prev.map((draft) => {
          const result = results.get(draft.id);
          return result ? {...draft, ...result} : draft;
        })
      );

      return firstImportedEntity;
    } finally {
      setIsApplyingImports(false);
    }
  }, [
    activeProjectId,
    categories,
    entities,
    importDrafts,
    onEntitiesChanged,
    onEntitySaved,
    setCategories,
    setEntities,
    setFeedback
  ]);

  const applyJsonImport = useCallback(async () => {
    if (!activeProjectId || !jsonImportSession || !activeJsonCategory) return;
    const validRows = preparedJsonRows.filter((row) => row.errors.length === 0);
    if (validRows.length === 0) {
      setFeedback({
        tone: 'error',
        message: 'No valid JSON rows to import. Fix mapping/validation first.'
      });
      return;
    }
    if (unresolvedJsonConflictCount > 0) {
      setFeedback({
        tone: 'error',
        message: `Review ${unresolvedJsonConflictCount} conflicting JSON row(s) before importing.`
      });
      return;
    }

    setIsApplyingJsonImport(true);
    setFeedback(null);
    const nextEntities = [...entities];
    let createdCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    try {
      for (const row of validRows) {
        try {
          if (row.resolution === 'skip') {
            skippedCount += 1;
            continue;
          }
          const now = Date.now();
          const normalizedName = row.name.trim().toLowerCase();
          const existing =
            row.resolution === 'upsert'
              ? nextEntities.find(
                  (entity) =>
                    entity.categoryId === jsonImportSession.categoryId &&
                    entity.name.trim().toLowerCase() === normalizedName
                )
              : undefined;
          const normalizedRowFields = {...row.fields};
          activeJsonCategory.fieldSchema.forEach((field) => {
            if (field.type !== 'textarea') return;
            const rawValue = normalizedRowFields[field.key];
            normalizedRowFields[field.key] =
              typeof rawValue === 'string' ? normalizeRichTextValue(rawValue) : '<p></p>';
          });

          const entity: WorldEntity = existing
            ? {
                ...existing,
                fields: {
                  ...existing.fields,
                  ...normalizedRowFields
                },
                updatedAt: now
              }
            : {
                id: crypto.randomUUID(),
                projectId: activeProjectId,
                categoryId: jsonImportSession.categoryId,
                name: row.name,
                fields: normalizedRowFields,
                needsCompletion: false,
                links: [],
                createdAt: now,
                updatedAt: now
              };

          await saveEntity(entity);
          await onEntitySaved?.(entity, activeJsonCategory);

          if (existing) {
            const idx = nextEntities.findIndex((item) => item.id === existing.id);
            if (idx !== -1) nextEntities[idx] = entity;
            updatedCount += 1;
          } else {
            nextEntities.push(entity);
            createdCount += 1;
          }
        } catch {
          failedCount += 1;
        }
      }

      setEntities(nextEntities);
      await onEntitiesChanged?.();
      setFeedback({
        tone: failedCount > 0 ? 'error' : 'success',
        message:
          `JSON import created ${createdCount} entr${
            createdCount === 1 ? 'y' : 'ies'
          } and updated ${updatedCount}.` +
          (skippedCount > 0 ? ` Skipped ${skippedCount}.` : '') +
          (failedCount > 0 ? ` ${failedCount} failed.` : '')
      });
      if (failedCount === 0) {
        clearJsonImportSession();
      }
    } finally {
      setIsApplyingJsonImport(false);
    }
  }, [
    activeJsonCategory,
    activeProjectId,
    clearJsonImportSession,
    entities,
    jsonImportSession,
    onEntitiesChanged,
    onEntitySaved,
    preparedJsonRows,
    setEntities,
    setFeedback,
    unresolvedJsonConflictCount
  ]);

  return {
    isImportingEntities,
    isApplyingImports,
    importDrafts,
    clearImportDrafts,
    isImportingJson,
    isApplyingJsonImport,
    jsonImportSession,
    jsonImportConflictResolutions,
    activeJsonCategory,
    preparedJsonRows,
    jsonImportValidCount,
    jsonImportConflictCount,
    unresolvedJsonConflictCount,
    handleImportEntities,
    preparePastedImportDraft,
    updateImportDraft,
    updateImportSectionDestination,
    applyImportDrafts,
    applyJsonImport,
    handleJsonImportFile,
    handleJsonCategoryChange,
    handleJsonNameKeyChange,
    handleJsonModeChange,
    handleJsonFieldMapChange,
    handleJsonConflictResolutionChange,
    clearJsonImportSession
  };
};
