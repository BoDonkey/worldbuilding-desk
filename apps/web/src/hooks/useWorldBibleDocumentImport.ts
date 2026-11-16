import {useCallback, useEffect, useState} from 'react';
import type {ChangeEvent, Dispatch, SetStateAction} from 'react';
import type {EntityCategory, WorldEntity} from '../entityTypes';
import {saveCategory} from '../services/storage';
import {
  saveWorldBibleRecord,
  type WorldBibleIndexing
} from '../services/worldBible/worldBibleRecordSave';
import {convertPlainTextToRichHtml} from '../services/worldBible/worldBibleEntityHelpers';
import {describeError} from '../services/errors';
import {parseDocxFile} from '../services/worldBible/docxImport';
import {
  buildPreview,
  classifyImportSections,
  detectImportDocumentName,
  detectImportSections,
  fileNameToEntityName,
  getNewFieldLabel,
  getImportFieldLabelError,
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

/**
 * World Bible document import (split from useWorldBibleImports, 3.49):
 * Markdown, text, and DOCX files or pasted text become drafts the author
 * reviews (category, mode, detected sections), then saves through
 * `saveWorldBibleRecord`. Behavior unchanged.
 */

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

type FeedbackState = {
  tone: 'success' | 'error';
  message: string;
} | null;

interface UseWorldBibleDocumentImportParams {
  activeProjectId: string | null;
  activeCategory: EntityCategory | null;
  categories: EntityCategory[];
  entities: WorldEntity[];
  setCategories: Dispatch<SetStateAction<EntityCategory[]>>;
  setEntities: Dispatch<SetStateAction<WorldEntity[]>>;
  setFeedback: Dispatch<SetStateAction<FeedbackState>>;
  /** Imported records are indexed for search and memory as they save. */
  indexing: WorldBibleIndexing;
  onEntitiesChanged?: () => Promise<void>;
}

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
    const labelError = getImportFieldLabelError(label);
    if (labelError) throw new Error(labelError);
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

export const useWorldBibleDocumentImport = ({
  activeProjectId,
  activeCategory,
  categories,
  entities,
  setCategories,
  setEntities,
  setFeedback,
  indexing,
  onEntitiesChanged
}: UseWorldBibleDocumentImportParams) => {
  const [isImportingEntities, setIsImportingEntities] = useState(false);
  const [isApplyingImports, setIsApplyingImports] = useState(false);
  const [importDrafts, setImportDrafts] = useState<WorldBibleImportDraft[]>([]);

  useEffect(() => {
    if (!activeProjectId) setImportDrafts([]);
  }, [activeProjectId]);

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

  const clearImportDrafts = useCallback(() => {
    setImportDrafts([]);
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

          await saveWorldBibleRecord({
            entity,
            category: importCategory,
            categories: Array.from(categoryById.values()),
            entities: nextEntities,
            indexing
          });
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
    indexing,
    setCategories,
    setEntities,
    setFeedback
  ]);

  return {
    isImportingEntities,
    isApplyingImports,
    importDrafts,
    clearImportDrafts,
    handleImportEntities,
    preparePastedImportDraft,
    updateImportDraft,
    updateImportSectionDestination,
    applyImportDrafts
  };
};
