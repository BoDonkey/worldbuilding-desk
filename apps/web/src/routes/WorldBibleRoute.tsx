import {useEffect, useState, useCallback, useRef, useMemo} from 'react';
import type {ChangeEvent, FormEvent} from 'react';
import type {EntityCategory, Project, WorldEntity} from '../entityTypes';
import {getEntitiesByProject, saveEntity, deleteEntity} from '../entityStorage';
import {
  getCategoriesByProject,
  saveCategory,
  deleteCategory,
  initializeDefaultCategories
} from '../categoryStorage';
import CategoryEditor from '../components/CategoryEditor';
import styles from '../assets/components/WorldBibleRoute.module.css';
import type {RAGProvider} from '../services/rag/RAGService';
import {getRAGService} from '../services/rag/getRAGService';
import type {
  ShodhMemoryProvider,
  MemoryEntry
} from '../services/shodh/ShodhMemoryService';
import {getShodhService} from '../services/shodh/getShodhService';
import {emitShodhMemoriesUpdated} from '../services/shodh/shodhEvents';
import {ShodhMemoryPanel} from '../components/ShodhMemoryPanel';
import {
  getCompendiumEntriesByProject,
  upsertCompendiumEntryFromEntity
} from '../services/compendiumService';
import type {CompendiumDomain} from '../entityTypes';
import {
  getSeriesBibleConfig,
  promoteMemoryToParent,
  promoteDocumentToParent,
  getCanonSyncState,
  syncChildWithParent
} from '../services/seriesBible/SeriesBibleService';

interface WorldBibleRouteProps {
  activeProject: Project | null;
}

type ImportMode = 'create' | 'upsert';

interface WorldBibleImportDraft {
  id: string;
  fileName: string;
  name: string;
  text: string;
  preview: string;
  categoryId: string;
  mode: ImportMode;
  include: boolean;
  parseError?: string;
}

interface JsonImportRowInput {
  rowIndex: number;
  record: Record<string, unknown>;
}

interface JsonImportSession {
  fileName: string;
  rows: JsonImportRowInput[];
  keys: string[];
  categoryId: string;
  mode: ImportMode;
  nameKey: string;
  fieldMap: Record<string, string>;
}

interface JsonImportPreparedRow {
  rowIndex: number;
  name: string;
  fields: Record<string, string>;
  errors: string[];
}

const fileNameToEntityName = (name: string): string => {
  const base = name.replace(/\.[^.]+$/, '').trim();
  return base || 'Imported entry';
};

const htmlToText = (raw: string): string => {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(raw, 'text/html');
  return parsed.body.textContent?.trim() ?? '';
};

const readU16LE = (bytes: Uint8Array, offset: number): number =>
  bytes[offset] | (bytes[offset + 1] << 8);

const readU32LE = (bytes: Uint8Array, offset: number): number =>
  (bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)) >>> 0;

const findDocxDocumentEntry = (
  bytes: Uint8Array
): {
  compressionMethod: number;
  compressedData: Uint8Array;
} | null => {
  const eocdSignature = 0x06054b50;
  const centralSignature = 0x02014b50;
  const localSignature = 0x04034b50;

  const minEocdSize = 22;
  const maxCommentLength = 0xffff;
  const searchStart = Math.max(0, bytes.length - (minEocdSize + maxCommentLength));
  let eocdOffset = -1;
  for (let i = bytes.length - minEocdSize; i >= searchStart; i -= 1) {
    if (readU32LE(bytes, i) === eocdSignature) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) return null;

  const centralDirectorySize = readU32LE(bytes, eocdOffset + 12);
  const centralDirectoryOffset = readU32LE(bytes, eocdOffset + 16);
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  if (centralDirectoryEnd > bytes.length) return null;

  const decoder = new TextDecoder('utf-8');
  let cursor = centralDirectoryOffset;

  while (cursor + 46 <= centralDirectoryEnd) {
    if (readU32LE(bytes, cursor) !== centralSignature) {
      break;
    }
    const compressionMethod = readU16LE(bytes, cursor + 10);
    const compressedSize = readU32LE(bytes, cursor + 20);
    const fileNameLength = readU16LE(bytes, cursor + 28);
    const extraLength = readU16LE(bytes, cursor + 30);
    const commentLength = readU16LE(bytes, cursor + 32);
    const localHeaderOffset = readU32LE(bytes, cursor + 42);
    const fileNameStart = cursor + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    if (fileNameEnd > bytes.length) return null;

    const fileName = decoder.decode(bytes.slice(fileNameStart, fileNameEnd));
    cursor = fileNameEnd + extraLength + commentLength;

    if (fileName !== 'word/document.xml') continue;
    if (localHeaderOffset + 30 > bytes.length) return null;
    if (readU32LE(bytes, localHeaderOffset) !== localSignature) return null;

    const localNameLength = readU16LE(bytes, localHeaderOffset + 26);
    const localExtraLength = readU16LE(bytes, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) return null;

    return {
      compressionMethod,
      compressedData: bytes.slice(dataStart, dataEnd)
    };
  }

  return null;
};

const inflateRaw = async (compressedData: Uint8Array): Promise<Uint8Array> => {
  const copy = new Uint8Array(compressedData.byteLength);
  copy.set(compressedData);
  const stream = new Blob([copy.buffer]).stream().pipeThrough(
    new DecompressionStream('deflate-raw')
  );
  const decompressed = await new Response(stream).arrayBuffer();
  return new Uint8Array(decompressed);
};

const docxXmlToText = (xml: string): string => {
  const withBreaks = xml
    .replace(/<w:tab\b[^>]*\/>/g, '\t')
    .replace(/<w:br\b[^>]*\/>/g, '\n')
    .replace(/<w:cr\b[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n\n');
  const withoutTags = withBreaks.replace(/<[^>]+>/g, '');
  const parser = new DOMParser();
  const decoded = parser.parseFromString(
    `<!doctype html><body>${withoutTags}`,
    'text/html'
  ).body.textContent;
  return decoded?.trim() ?? '';
};

const parseDocxToText = async (file: File): Promise<string> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entry = findDocxDocumentEntry(bytes);
  if (!entry) {
    throw new Error('Could not read DOCX structure.');
  }

  let xmlBytes: Uint8Array;
  if (entry.compressionMethod === 0) {
    xmlBytes = entry.compressedData;
  } else if (entry.compressionMethod === 8) {
    xmlBytes = await inflateRaw(entry.compressedData);
  } else {
    throw new Error(`Unsupported DOCX compression method (${entry.compressionMethod}).`);
  }

  const xml = new TextDecoder('utf-8').decode(xmlBytes);
  return docxXmlToText(xml);
};

const mapImportedTextToFields = (
  category: EntityCategory,
  text: string
): Record<string, string> => {
  const normalized = text.trim();
  const fields: Record<string, string> = {};
  const preferredField =
    category.fieldSchema.find((field) => field.key === 'description') ??
    category.fieldSchema.find((field) => field.type === 'textarea') ??
    category.fieldSchema.find((field) => field.type === 'text');

  if (preferredField) {
    fields[preferredField.key] = normalized;
  } else {
    fields.description = normalized;
  }

  return fields;
};

const buildPreview = (text: string, limit = 180): string => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '(empty)';
  return normalized.length > limit
    ? `${normalized.slice(0, limit)}...`
    : normalized;
};

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

const getFieldTemplateValue = (field: EntityCategory['fieldSchema'][number]): unknown => {
  if (field.type === 'checkbox') return false;
  if (field.type === 'number') return 0;
  if (field.type === 'select') return field.options?.[0] ?? '';
  if (field.type === 'multiselect') return field.options?.slice(0, 2) ?? [];
  if (field.type === 'dice') {
    return field.diceConfig?.allowMultipleDice ? '2d6+1d4' : '1d20';
  }
  if (field.type === 'modifier') return '+2';
  if (field.type === 'textarea') return 'Detailed notes here';
  return '';
};

const triggerJsonDownload = (fileName: string, data: unknown): void => {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

function WorldBibleRoute({activeProject}: WorldBibleRouteProps) {
  const [categories, setCategories] = useState<EntityCategory[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [entities, setEntities] = useState<WorldEntity[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [ragService, setRagService] = useState<RAGProvider | null>(null);
  const [shodhService, setShodhService] =
    useState<ShodhMemoryProvider | null>(null);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [memoryFilter, setMemoryFilter] = useState('');
  const seriesConfig = activeProject
    ? getSeriesBibleConfig(activeProject)
    : null;
  const [canonState, setCanonState] = useState<{
    parentCanonVersion?: string;
    childLastSynced?: string;
    parentName?: string;
  }>({});
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isSubmittingEntity, setIsSubmittingEntity] = useState(false);
  const [deletingEntityId, setDeletingEntityId] = useState<string | null>(null);
  const [promotingEntityId, setPromotingEntityId] = useState<string | null>(null);
  const [promotingMemoryId, setPromotingMemoryId] = useState<string | null>(null);
  const [isSyncingCanon, setIsSyncingCanon] = useState(false);
  const [linkingCompendiumEntityId, setLinkingCompendiumEntityId] = useState<
    string | null
  >(null);
  const [compendiumLinkedEntityIds, setCompendiumLinkedEntityIds] = useState<
    Set<string>
  >(new Set());
  const [isImportingEntities, setIsImportingEntities] = useState(false);
  const [isApplyingImports, setIsApplyingImports] = useState(false);
  const [importDrafts, setImportDrafts] = useState<WorldBibleImportDraft[]>([]);
  const [isImportingJson, setIsImportingJson] = useState(false);
  const [isApplyingJsonImport, setIsApplyingJsonImport] = useState(false);
  const [jsonImportSession, setJsonImportSession] = useState<JsonImportSession | null>(
    null
  );
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const jsonImportInputRef = useRef<HTMLInputElement | null>(null);
  const refreshMemories = useCallback(async () => {
    if (!shodhService) {
      setMemories([]);
      emitShodhMemoriesUpdated([]);
      return;
    }
    const list = await shodhService.listMemories();
    setMemories(list);
    emitShodhMemoriesUpdated(list);
  }, [shodhService]);

  const handlePromoteMemory = useCallback(
    async (memory: MemoryEntry) => {
      if (!seriesConfig?.parentProjectId) return;
      setPromotingMemoryId(memory.id);
      setFeedback(null);
      try {
        await promoteMemoryToParent(memory, seriesConfig.parentProjectId);
        await refreshMemories();
        setFeedback({tone: 'success', message: 'Memory promoted to parent canon.'});
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to promote memory.';
        setFeedback({tone: 'error', message});
      } finally {
        setPromotingMemoryId(null);
      }
    },
    [seriesConfig?.parentProjectId, refreshMemories]
  );

  useEffect(() => {
    if (!activeProject) {
      setImportDrafts([]);
      setJsonImportSession(null);
      return;
    }

    let cancelled = false;

    (async () => {
      const projectId = activeProject.id;

      await initializeDefaultCategories(projectId);

      const [cats, ents] = await Promise.all([
        getCategoriesByProject(projectId),
        getEntitiesByProject(projectId)
      ]);

      if (!cancelled) {
        setCategories(cats);
        setEntities(ents);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  useEffect(() => {
    if (!activeProject) {
      setCompendiumLinkedEntityIds(new Set());
      return;
    }

    let cancelled = false;
    getCompendiumEntriesByProject(activeProject.id)
      .then((entries) => {
        if (cancelled) return;
        setCompendiumLinkedEntityIds(
          new Set(entries.map((entry) => entry.sourceEntityId).filter(Boolean) as string[])
        );
      })
      .catch((error) => {
        if (cancelled) return;
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to load compendium links.';
        setFeedback({tone: 'error', message});
      });

    return () => {
      cancelled = true;
    };
  }, [activeProject, entities.length]);

  useEffect(() => {
    void refreshMemories();
  }, [refreshMemories]);

  useEffect(() => {
    if (!activeTab && categories.length > 0) {
      setActiveTab(categories[0].id);
    }
  }, [categories, activeTab]);

  useEffect(() => {
    if (!activeProject) {
      setRagService(null);
      setShodhService(null);
      return;
    }

    const bibleConfig = getSeriesBibleConfig(activeProject);
    const ragOptions =
      bibleConfig.parentProjectId && bibleConfig.inheritRag
        ? {
            projectId: activeProject.id,
            inheritFromParent: true,
            parentProjectId: bibleConfig.parentProjectId
          }
        : {projectId: activeProject.id};
    const shodhOptions =
      bibleConfig.parentProjectId && bibleConfig.inheritShodh
        ? {
            projectId: activeProject.id,
            inheritFromParent: true,
            parentProjectId: bibleConfig.parentProjectId
          }
        : {projectId: activeProject.id};

    let cancelled = false;
    Promise.all([getRAGService(ragOptions), getShodhService(shodhOptions)]).then(
      ([rag, shodh]) => {
        if (!cancelled) {
          setRagService(rag);
          setShodhService(shodh);
        }
      }
    );

    return () => {
      cancelled = true;
      setRagService(null);
      setShodhService(null);
    };
  }, [activeProject]);

  useEffect(() => {
    let cancelled = false;
    if (!activeProject || !seriesConfig?.parentProjectId) {
      setCanonState({});
      return;
    }
    getCanonSyncState(activeProject).then((state) => {
      if (!cancelled) {
        setCanonState(state);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeProject, seriesConfig?.parentProjectId]);

  useEffect(() => {
    if (!ragService) return;
    const vocabulary = entities.map((entity) => ({
      id: entity.id,
      terms: [
        entity.name,
        ...Object.values(entity.fields).filter(
          (value): value is string => typeof value === 'string'
        )
      ]
    }));
    ragService.setEntityVocabulary(vocabulary);
  }, [entities, ragService]);

  const activeCategory = categories.find((c) => c.id === activeTab);
  const activeJsonCategory = useMemo(
    () =>
      jsonImportSession
        ? categories.find((category) => category.id === jsonImportSession.categoryId) ?? null
        : null,
    [categories, jsonImportSession]
  );
  const preparedJsonRows = useMemo<JsonImportPreparedRow[]>(() => {
    if (!jsonImportSession || !activeJsonCategory) return [];
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
      return {
        rowIndex: row.rowIndex,
        name,
        fields,
        errors
      };
    });
  }, [activeJsonCategory, jsonImportSession]);
  const jsonImportValidCount = preparedJsonRows.filter(
    (row) => row.errors.length === 0
  ).length;
  const filteredEntities = entities.filter((e) => e.categoryId === activeTab);
  const currentEntityMemories = editingId
    ? memories.filter((memory) => memory.documentId === editingId)
    : [];
  const memoryPanelEmpty =
    'This entry has no captured memories yet. Save it to generate one or adjust the filter.';

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setFieldValues({});
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeProject || !activeCategory) return;

    setIsSubmittingEntity(true);
    setFeedback(null);
    try {
      const now = Date.now();
      const id = editingId ?? crypto.randomUUID();
      const existing = entities.find((e) => e.id === id);

      const entity: WorldEntity = {
        id,
        projectId: activeProject.id,
        categoryId: activeCategory.id,
        name,
        fields: {...fieldValues},
        links: existing?.links ?? [],
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };

      await saveEntity(entity);
      if (ragService) {
        await ragService.indexDocument(
          entity.id,
          entity.name,
          buildEntityContent(entity),
          'worldbible',
          {
            tags: [activeCategory.slug],
            entityIds: [entity.id]
          }
        );
      }
      if (shodhService) {
        await shodhService.captureAutoMemory({
          projectId: activeProject.id,
          documentId: entity.id,
          title: entity.name,
          content: buildEntityContent(entity),
          tags: ['worldbible', activeCategory.slug]
        });
        await refreshMemories();
      }

      setEntities((prev) => {
        const idx = prev.findIndex((e) => e.id === id);
        if (idx === -1) return [...prev, entity];
        const copy = [...prev];
        copy[idx] = entity;
        return copy;
      });

      resetForm();
      setFeedback({
        tone: 'success',
        message: editingId ? 'Entry updated.' : 'Entry created.'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save entry.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsSubmittingEntity(false);
    }
  };

  const handleEdit = (entity: WorldEntity) => {
    setEditingId(entity.id);
    setName(entity.name);
    setFieldValues(entity.fields as Record<string, string>);
  };

  const handleImportEntities = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!activeProject || !activeCategory) return;
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
          const raw = lower.endsWith('.docx')
            ? await parseDocxToText(file)
            : await file.text();
          const text =
            lower.endsWith('.html') || lower.endsWith('.htm')
              ? htmlToText(raw)
              : raw.trim();
          drafts.push({
            id: crypto.randomUUID(),
            fileName: file.name,
            name: fileNameToEntityName(file.name),
            text,
            preview: buildPreview(text),
            categoryId: activeCategory.id,
            mode: 'create',
            include: true
          });
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
  };

  const updateImportDraft = (
    draftId: string,
    updates: Partial<WorldBibleImportDraft>
  ) => {
    setImportDrafts((prev) =>
      prev.map((draft) => (draft.id === draftId ? {...draft, ...updates} : draft))
    );
  };

  const handleApplyImportDrafts = async () => {
    if (!activeProject) return;
    const queuedDrafts = importDrafts.filter((draft) => draft.include && !draft.parseError);
    if (queuedDrafts.length === 0) {
      setFeedback({
        tone: 'error',
        message: 'No valid import drafts selected.'
      });
      return;
    }

    setIsApplyingImports(true);
    setFeedback(null);
    const nextEntities = [...entities];
    let createdCount = 0;
    let updatedCount = 0;
    let failedCount = 0;

    try {
      for (const draft of queuedDrafts) {
        const category = categories.find((item) => item.id === draft.categoryId);
        if (!category) {
          failedCount += 1;
          continue;
        }

        try {
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
                  ...mapImportedTextToFields(category, draft.text)
                },
                updatedAt: now
              }
            : {
                id: crypto.randomUUID(),
                projectId: activeProject.id,
                categoryId: draft.categoryId,
                name: draft.name.trim() || fileNameToEntityName(draft.fileName),
                fields: mapImportedTextToFields(category, draft.text),
                links: [],
                createdAt: now,
                updatedAt: now
              };

          await saveEntity(entity);
          if (ragService) {
            await ragService.indexDocument(
              entity.id,
              entity.name,
              buildEntityContent(entity),
              'worldbible',
              {
                tags: [category.slug],
                entityIds: [entity.id]
              }
            );
          }
          if (shodhService) {
            await shodhService.captureAutoMemory({
              projectId: activeProject.id,
              documentId: entity.id,
              title: entity.name,
              content: buildEntityContent(entity),
              tags: ['worldbible', category.slug]
            });
          }

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
      if (createdCount + updatedCount > 0) {
        await refreshMemories();
      }

      setFeedback({
        tone: failedCount > 0 ? 'error' : 'success',
        message:
          `Imported ${createdCount} new entr${
            createdCount === 1 ? 'y' : 'ies'
          } and updated ${updatedCount}.` +
          (failedCount > 0 ? ` ${failedCount} failed.` : '')
      });

      if (failedCount === 0) {
        setImportDrafts([]);
      }
    } finally {
      setIsApplyingImports(false);
    }
  };

  const handleJsonImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!activeProject || !activeCategory) return;
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
      setFeedback({
        tone: 'success',
        message: `Loaded ${rows.length} JSON row(s). Map fields and apply when ready.`
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to parse JSON import file.';
      setFeedback({tone: 'error', message});
      setJsonImportSession(null);
    } finally {
      setIsImportingJson(false);
      event.target.value = '';
    }
  };

  const handleJsonCategoryChange = (categoryId: string) => {
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
  };

  const handleJsonFieldMapChange = (fieldKey: string, sourceKey: string) => {
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
  };

  const handleApplyJsonImport = async () => {
    if (!activeProject || !jsonImportSession || !activeJsonCategory) return;
    const validRows = preparedJsonRows.filter((row) => row.errors.length === 0);
    if (validRows.length === 0) {
      setFeedback({
        tone: 'error',
        message: 'No valid JSON rows to import. Fix mapping/validation first.'
      });
      return;
    }

    setIsApplyingJsonImport(true);
    setFeedback(null);
    const nextEntities = [...entities];
    let createdCount = 0;
    let updatedCount = 0;
    let failedCount = 0;

    try {
      for (const row of validRows) {
        try {
          const now = Date.now();
          const normalizedName = row.name.trim().toLowerCase();
          const existing =
            jsonImportSession.mode === 'upsert'
              ? nextEntities.find(
                  (entity) =>
                    entity.categoryId === jsonImportSession.categoryId &&
                    entity.name.trim().toLowerCase() === normalizedName
                )
              : undefined;

          const entity: WorldEntity = existing
            ? {
                ...existing,
                fields: {
                  ...existing.fields,
                  ...row.fields
                },
                updatedAt: now
              }
            : {
                id: crypto.randomUUID(),
                projectId: activeProject.id,
                categoryId: jsonImportSession.categoryId,
                name: row.name,
                fields: row.fields,
                links: [],
                createdAt: now,
                updatedAt: now
              };

          await saveEntity(entity);
          if (ragService) {
            await ragService.indexDocument(
              entity.id,
              entity.name,
              buildEntityContent(entity),
              'worldbible',
              {
                tags: [activeJsonCategory.slug],
                entityIds: [entity.id]
              }
            );
          }
          if (shodhService) {
            await shodhService.captureAutoMemory({
              projectId: activeProject.id,
              documentId: entity.id,
              title: entity.name,
              content: buildEntityContent(entity),
              tags: ['worldbible', activeJsonCategory.slug]
            });
          }

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
      await refreshMemories();
      setFeedback({
        tone: failedCount > 0 ? 'error' : 'success',
        message:
          `JSON import created ${createdCount} entr${
            createdCount === 1 ? 'y' : 'ies'
          } and updated ${updatedCount}.` +
          (failedCount > 0 ? ` ${failedCount} failed.` : '')
      });
      if (failedCount === 0) {
        setJsonImportSession(null);
      }
    } finally {
      setIsApplyingJsonImport(false);
    }
  };

  const handleDownloadJsonTemplate = () => {
    if (!activeCategory) return;
    const row: Record<string, unknown> = {
      name: `${activeCategory.name.slice(0, -1) || 'Entry'} Name`
    };
    activeCategory.fieldSchema.forEach((field) => {
      row[field.key] = getFieldTemplateValue(field);
    });
    triggerJsonDownload(
      `${activeCategory.slug || 'worldbible'}-template.json`,
      {
        entries: [row],
        notes: {
          description:
            'Use this template for World Bible JSON import. Keep "name" populated for each row.'
        }
      }
    );
  };

  const handleDownloadJsonSample = () => {
    if (!activeCategory) return;
    const baseName = activeCategory.name.slice(0, -1) || 'Entry';
    const makeRow = (index: number): Record<string, unknown> => {
      const row: Record<string, unknown> = {
        name: `${baseName} ${index}`
      };
      activeCategory.fieldSchema.forEach((field) => {
        const value = getFieldTemplateValue(field);
        if (typeof value === 'string' && value.length > 0) {
          row[field.key] = `${value} ${index}`.trim();
        } else {
          row[field.key] = value;
        }
      });
      return row;
    };
    triggerJsonDownload(
      `${activeCategory.slug || 'worldbible'}-sample.json`,
      {
        entries: [makeRow(1), makeRow(2), makeRow(3)]
      }
    );
  };

  const handleDeleteEntity = async (id: string) => {
    if (!confirm('Delete this entity?')) return;
    setDeletingEntityId(id);
    setFeedback(null);
    try {
      await deleteEntity(id);
      if (ragService) {
        await ragService.deleteDocument(id);
      }
      if (shodhService) {
        await shodhService.deleteMemoriesForDocument(id);
        await refreshMemories();
      }
      setEntities((prev) => prev.filter((e) => e.id !== id));
      if (editingId === id) resetForm();
      setFeedback({tone: 'success', message: 'Entry deleted.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to delete entry.';
      setFeedback({tone: 'error', message});
    } finally {
      setDeletingEntityId(null);
    }
  };

  const buildEntityContent = (entity: WorldEntity) => {
    const fieldText = Object.entries(entity.fields)
      .map(([key, value]) => `${key}: ${value ?? ''}`)
      .join('\n');
    return `${entity.name}\n${fieldText}`;
  };

  const inferCompendiumDomain = (entity: WorldEntity): CompendiumDomain => {
    const category = categories.find((item) => item.id === entity.categoryId);
    const slug = (category?.slug ?? '').toLowerCase();
    if (slug.includes('monster') || slug.includes('beast') || slug.includes('creature')) {
      return 'beast';
    }
    if (slug.includes('plant') || slug.includes('flora') || slug.includes('herb')) {
      return 'flora';
    }
    if (slug.includes('ore') || slug.includes('mineral') || slug.includes('rock')) {
      return 'mineral';
    }
    if (slug.includes('artifact') || slug.includes('relic')) {
      return 'artifact';
    }
    return 'custom';
  };

  const handleAddEntityToCompendium = async (entity: WorldEntity) => {
    if (!activeProject) return;
    setLinkingCompendiumEntityId(entity.id);
    setFeedback(null);
    try {
      await upsertCompendiumEntryFromEntity({
        projectId: activeProject.id,
        entity,
        domain: inferCompendiumDomain(entity)
      });
      setCompendiumLinkedEntityIds((prev) => {
        const next = new Set(prev);
        next.add(entity.id);
        return next;
      });
      setFeedback({
        tone: 'success',
        message: `"${entity.name}" linked to Compendium.`
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to link entity to compendium.';
      setFeedback({tone: 'error', message});
    } finally {
      setLinkingCompendiumEntityId(null);
    }
  };

  const handlePromoteEntity = async (entity: WorldEntity) => {
    if (!seriesConfig?.parentProjectId) return;
    setPromotingEntityId(entity.id);
    setFeedback(null);
    try {
      await promoteDocumentToParent({
        parentProjectId: seriesConfig.parentProjectId,
        documentId: entity.id,
        title: entity.name,
        content: buildEntityContent(entity),
        type: 'worldbible',
        tags: [activeCategory?.slug ?? 'worldbible']
      });
      setFeedback({tone: 'success', message: 'Entry promoted to parent canon.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to promote entry.';
      setFeedback({tone: 'error', message});
    } finally {
      setPromotingEntityId(null);
    }
  };
  const handleCanonSync = async () => {
    if (!activeProject) return;
    setIsSyncingCanon(true);
    setFeedback(null);
    try {
      const updated = await syncChildWithParent(activeProject.id);
      if (updated) {
        setCanonState((prev) => ({
          ...prev,
          childLastSynced: updated.lastSyncedCanon
        }));
      }
      setFeedback({tone: 'success', message: 'Canon sync state updated.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to mark canon as synced.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsSyncingCanon(false);
    }
  };

  if (!activeProject) {
    return (
      <section className={styles.noProject}>
        <h1>World Bible</h1>
        <p>
          No active project. Go to <strong>Projects</strong> to create or open a
          project first.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.container}>
      <div className={styles.header}>
        <h1>World Bible</h1>
        {activeCategory && (
          <>
            <div className={styles.headerActions}>
              <button
                type='button'
                onClick={() => importInputRef.current?.click()}
                disabled={isImportingEntities}
              >
                {isImportingEntities
                  ? 'Importing...'
                  : `Import Docs into ${activeCategory.name}`}
              </button>
              <button
                type='button'
                onClick={() => jsonImportInputRef.current?.click()}
                disabled={isImportingJson}
              >
                {isImportingJson ? 'Loading JSON...' : 'Import JSON'}
              </button>
              <button type='button' onClick={handleDownloadJsonTemplate}>
                Download JSON Template
              </button>
              <button type='button' onClick={handleDownloadJsonSample}>
                Download JSON Sample
              </button>
            </div>
            <input
              ref={importInputRef}
              type='file'
              accept='.txt,.md,.markdown,.html,.htm,.docx,.doc,text/plain,text/markdown,text/html,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword'
              multiple
              onChange={(e) => void handleImportEntities(e)}
              style={{display: 'none'}}
            />
            <input
              ref={jsonImportInputRef}
              type='file'
              accept='.json,application/json'
              onChange={(e) => void handleJsonImportFile(e)}
              style={{display: 'none'}}
            />
          </>
        )}
      </div>
      {feedback && (
        <p
          role='status'
          style={{
            marginBottom: '1rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '6px',
            border: `1px solid ${
              feedback.tone === 'error' ? '#fecaca' : '#bbf7d0'
            }`,
            backgroundColor:
              feedback.tone === 'error' ? '#fef2f2' : '#f0fdf4',
            color: feedback.tone === 'error' ? '#991b1b' : '#166534'
          }}
        >
          {feedback.message}
        </p>
      )}
      {seriesConfig?.parentProjectId && (
        <div className={styles.banner}>
          <strong>Parent canon:</strong> {canonState.parentName ?? 'Unknown'} ·
          Version {canonState.parentCanonVersion ?? 'n/a'}
          {canonState.parentCanonVersion &&
            canonState.childLastSynced &&
            canonState.parentCanonVersion !== canonState.childLastSynced && (
              <span className={styles.outOfSync}>Out of sync</span>
            )}
          <div className={styles.syncRow}>
            <span>
              Last synced:{' '}
              {canonState.childLastSynced ?? 'never'}
            </span>
            <button
              type='button'
              onClick={() => void handleCanonSync()}
              disabled={isSyncingCanon}
            >
              {isSyncingCanon ? 'Marking...' : 'Mark as synced'}
            </button>
          </div>
        </div>
      )}

      <div className={styles.tabNav}>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveTab(cat.id)}
            className={`${styles.tab} ${
              activeTab === cat.id ? styles.active : ''
            }`}
          >
            {cat.name}
          </button>
        ))}
        <button
          onClick={() => setShowCategoryManager(!showCategoryManager)}
          className={styles.manageButton}
        >
          {showCategoryManager ? 'Close' : 'Manage Categories'}
        </button>
      </div>

      <details className={styles.helpPanel}>
        <summary>World Bible Workflow Help</summary>
        <div className={styles.helpBody}>
          <p>
            Step 1: pick or create categories, then choose the active tab.
          </p>
          <p>
            Step 2: add entries manually or import docs/JSON in batch.
          </p>
          <p>
            Step 3: review/edit entries and optionally link to Compendium.
          </p>
          <p>
            Step 4: for multi-project canon, promote key entries or sync parent canon.
          </p>
          <p>
            Import JSON accepts: <code>[{"{...}"}]</code>,{' '}
            <code>{"{"}entries: [{"{...}"}]{"}"}</code>,{' '}
            <code>{"{"}items: [{"{...}"}]{"}"}</code>,{' '}
            <code>{"{"}rows: [{"{...}"}]{"}"}</code>.
          </p>
          <p>
            Use <strong>Download JSON Template</strong> to get the exact field keys
            for the selected category.
          </p>
        </div>
      </details>

      {importDrafts.length > 0 && (
        <section className={styles.importPanel}>
          <div className={styles.importPanelHeader}>
            <h2>Import Preview</h2>
            <div className={styles.importPanelActions}>
              <button
                type='button'
                onClick={() => void handleApplyImportDrafts()}
                disabled={isApplyingImports}
              >
                {isApplyingImports ? 'Importing...' : 'Apply Imports'}
              </button>
              <button
                type='button'
                onClick={() => setImportDrafts([])}
                disabled={isApplyingImports}
              >
                Clear
              </button>
            </div>
          </div>
          <p className={styles.importSummary}>
            {importDrafts.filter((draft) => draft.include && !draft.parseError).length}{' '}
            selected · {importDrafts.filter((draft) => draft.parseError).length} with
            errors
          </p>
          <ul className={styles.importDraftList}>
            {importDrafts.map((draft) => (
              <li key={draft.id} className={styles.importDraftCard}>
                <div className={styles.importDraftTop}>
                  <label>
                    <input
                      type='checkbox'
                      checked={draft.include}
                      disabled={Boolean(draft.parseError) || isApplyingImports}
                      onChange={(e) =>
                        updateImportDraft(draft.id, {include: e.target.checked})
                      }
                    />
                    <span>{draft.fileName}</span>
                  </label>
                </div>
                <div className={styles.importDraftFields}>
                  <label>
                    Entry Name
                    <input
                      type='text'
                      value={draft.name}
                      disabled={Boolean(draft.parseError) || isApplyingImports}
                      onChange={(e) =>
                        updateImportDraft(draft.id, {name: e.target.value})
                      }
                    />
                  </label>
                  <label>
                    Category
                    <select
                      value={draft.categoryId}
                      disabled={Boolean(draft.parseError) || isApplyingImports}
                      onChange={(e) =>
                        updateImportDraft(draft.id, {categoryId: e.target.value})
                      }
                    >
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Behavior
                    <select
                      value={draft.mode}
                      disabled={Boolean(draft.parseError) || isApplyingImports}
                      onChange={(e) =>
                        updateImportDraft(draft.id, {mode: e.target.value as ImportMode})
                      }
                    >
                      <option value='create'>Create New</option>
                      <option value='upsert'>Update by Name</option>
                    </select>
                  </label>
                </div>
                {draft.parseError ? (
                  <p className={styles.importError}>{draft.parseError}</p>
                ) : (
                  <p className={styles.importPreview}>{draft.preview}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {jsonImportSession && (
        <section className={styles.importPanel}>
          <p className={styles.wizardStep}>
            Step 2 of 3: map keys and resolve validation errors.
          </p>
          <div className={styles.importPanelHeader}>
            <h2>JSON Import Mapping</h2>
            <div className={styles.importPanelActions}>
              <button
                type='button'
                onClick={() => void handleApplyJsonImport()}
                disabled={isApplyingJsonImport}
              >
                {isApplyingJsonImport ? 'Importing...' : 'Apply JSON Import'}
              </button>
              <button
                type='button'
                onClick={() => setJsonImportSession(null)}
                disabled={isApplyingJsonImport}
              >
                Clear
              </button>
            </div>
          </div>
          <p className={styles.importSummary}>
            File: {jsonImportSession.fileName} · Rows: {jsonImportSession.rows.length} ·
            Valid: {jsonImportValidCount} · Invalid:{' '}
            {preparedJsonRows.length - jsonImportValidCount}
          </p>
          <div className={styles.importDraftFields}>
            <label>
              Category
              <select
                value={jsonImportSession.categoryId}
                onChange={(e) => handleJsonCategoryChange(e.target.value)}
                disabled={isApplyingJsonImport}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Row Name Key
              <select
                value={jsonImportSession.nameKey}
                onChange={(e) =>
                  setJsonImportSession((prev) =>
                    prev ? {...prev, nameKey: e.target.value} : prev
                  )
                }
                disabled={isApplyingJsonImport}
              >
                <option value=''>-- Select key --</option>
                {jsonImportSession.keys.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Behavior
              <select
                value={jsonImportSession.mode}
                onChange={(e) =>
                  setJsonImportSession((prev) =>
                    prev ? {...prev, mode: e.target.value as ImportMode} : prev
                  )
                }
                disabled={isApplyingJsonImport}
              >
                <option value='create'>Create New</option>
                <option value='upsert'>Update by Name</option>
              </select>
            </label>
          </div>

          {activeJsonCategory && (
            <div className={styles.mappingGrid}>
              {activeJsonCategory.fieldSchema.map((field) => (
                <label key={field.key}>
                  Map to {field.label}
                  <select
                    value={jsonImportSession.fieldMap[field.key] ?? ''}
                    onChange={(e) =>
                      handleJsonFieldMapChange(field.key, e.target.value)
                    }
                    disabled={isApplyingJsonImport}
                  >
                    <option value=''>-- Unmapped --</option>
                    {jsonImportSession.keys.map((key) => (
                      <option key={`${field.key}:${key}`} value={key}>
                        {key}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}

          <ul className={styles.importDraftList}>
            {preparedJsonRows.slice(0, 30).map((row) => (
              <li key={`json-row-${row.rowIndex}`} className={styles.importDraftCard}>
                <div className={styles.importDraftTop}>
                  <strong>Row {row.rowIndex}</strong>
                </div>
                <p className={styles.importPreview}>
                  {row.name ? row.name : '(no name)'}
                </p>
                {row.errors.length > 0 && (
                  <p className={styles.importError}>{row.errors.join(' ')}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {showCategoryManager && (
        <CategoryManager
          projectId={activeProject.id}
          categories={categories}
          onCategoriesChange={setCategories}
          onClose={() => setShowCategoryManager(false)}
        />
      )}

      {activeCategory && (
        <div className={styles.content}>
          <div className={styles.formSection}>
            <form onSubmit={handleSubmit} className={styles.form}>
              <h2>
                {editingId ? 'Edit' : 'New'} {activeCategory.name.slice(0, -1)}
              </h2>

              <div className={styles.formGroup}>
                <label>
                  Name
                  <input
                    type='text'
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </label>
              </div>

              {activeCategory.fieldSchema.map((field) => (
                <div key={field.key} className={styles.formGroup}>
                  <label>
                    {field.label}
                    {field.required && ' *'}
                    {field.type === 'textarea' ? (
                      <textarea
                        value={fieldValues[field.key] || ''}
                        onChange={(e) =>
                          setFieldValues({
                            ...fieldValues,
                            [field.key]: e.target.value
                          })
                        }
                        rows={4}
                        required={field.required}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        value={fieldValues[field.key] || ''}
                        onChange={(e) =>
                          setFieldValues({
                            ...fieldValues,
                            [field.key]: e.target.value
                          })
                        }
                        required={field.required}
                      >
                        <option value=''>-- Select --</option>
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'multiselect' ? (
                      <div className={styles.multiselectContainer}>
                        {field.options?.map((opt) => (
                          <label key={opt} className={styles.multiselectOption}>
                            <input
                              type='checkbox'
                              checked={(fieldValues[field.key] || '')
                                .split(',')
                                .includes(opt)}
                              onChange={(e) => {
                                const current = (fieldValues[field.key] || '')
                                  .split(',')
                                  .filter(Boolean);
                                const updated = e.target.checked
                                  ? [...current, opt]
                                  : current.filter((v) => v !== opt);
                                setFieldValues({
                                  ...fieldValues,
                                  [field.key]: updated.join(',')
                                });
                              }}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    ) : field.type === 'checkbox' ? (
                      <input
                        type='checkbox'
                        checked={fieldValues[field.key] === 'true'}
                        onChange={(e) =>
                          setFieldValues({
                            ...fieldValues,
                            [field.key]: e.target.checked ? 'true' : 'false'
                          })
                        }
                      />
                    ) : field.type === 'dice' ? (
                      <input
                        type='text'
                        value={fieldValues[field.key] || ''}
                        onChange={(e) =>
                          setFieldValues({
                            ...fieldValues,
                            [field.key]: e.target.value
                          })
                        }
                        placeholder={
                          field.diceConfig?.allowMultipleDice
                            ? 'e.g., 3d6, 2d8+1d4'
                            : 'e.g., 1d20'
                        }
                        pattern={
                          field.diceConfig?.allowMultipleDice ? '.*' : '1d\\d+'
                        }
                        required={field.required}
                      />
                    ) : field.type === 'modifier' ? (
                      <input
                        type='text'
                        value={fieldValues[field.key] || ''}
                        onChange={(e) =>
                          setFieldValues({
                            ...fieldValues,
                            [field.key]: e.target.value
                          })
                        }
                        placeholder='e.g., +5, -2'
                        pattern='[+-]?\\d+'
                        required={field.required}
                      />
                    ) : (
                      <input
                        type={field.type}
                        value={fieldValues[field.key] || ''}
                        onChange={(e) =>
                          setFieldValues({
                            ...fieldValues,
                            [field.key]: e.target.value
                          })
                        }
                        required={field.required}
                      />
                    )}
                  </label>
                </div>
              ))}

              <div className={styles.formActions}>
                <button
                  type='submit'
                  className={styles.primaryButton}
                  disabled={isSubmittingEntity}
                >
                  {isSubmittingEntity
                    ? 'Saving...'
                    : editingId
                      ? 'Save Changes'
                      : 'Create Entry'}
                </button>
                {editingId && (
                  <button type='button' onClick={resetForm} disabled={isSubmittingEntity}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
            {editingId && (
              <ShodhMemoryPanel
                title='Canon summary'
                memories={currentEntityMemories}
                filterValue={memoryFilter}
                onFilterChange={setMemoryFilter}
                highlightDocumentId={editingId}
                onRefresh={() => void refreshMemories()}
                pageSize={0}
                scopeSummaryLabel='this entry'
                emptyState={memoryPanelEmpty}
                renderSourceLabel={(memory) =>
                  memory.projectId === activeProject.id ? 'Local' : 'Parent'
                }
                renderMemoryActions={(memory) => {
                  if (
                    seriesConfig?.parentProjectId &&
                    memory.projectId === activeProject.id
                  ) {
                    return (
                      <button
                        type='button'
                        onClick={() => void handlePromoteMemory(memory)}
                        disabled={promotingMemoryId === memory.id}
                        style={{fontSize: '0.8rem'}}
                      >
                        {promotingMemoryId === memory.id ? 'Promoting...' : 'Promote'}
                      </button>
                    );
                  }
                  return null;
                }}
              />
            )}
          </div>

          <div className={styles.listSection}>
            <h2>{activeCategory.name}</h2>
            {filteredEntities.length === 0 && (
              <p className={styles.emptyState}>
                No {activeCategory.name.toLowerCase()} yet. Add one on the left.
              </p>
            )}
            <ul className={styles.entityList}>
              {filteredEntities.map((entity) => (
                <li key={entity.id} className={styles.entityCard}>
                  <div className={styles.entityName}>{entity.name}</div>
                  {Object.entries(entity.fields).map(([key, value]) => (
                    <div key={key} className={styles.entityField}>
                      <strong>{key}:</strong> {String(value)}
                    </div>
                  ))}
                  <div className={styles.entityActions}>
                    <button onClick={() => handleEdit(entity)}>Edit</button>
                    <button
                      onClick={() => handleDeleteEntity(entity.id)}
                      disabled={deletingEntityId === entity.id}
                      className={styles.deleteButton}
                    >
                      {deletingEntityId === entity.id ? 'Deleting...' : 'Delete'}
                    </button>
                    {seriesConfig?.parentProjectId && (
                      <button
                        type='button'
                        onClick={() => void handlePromoteEntity(entity)}
                        disabled={promotingEntityId === entity.id}
                      >
                        {promotingEntityId === entity.id
                          ? 'Promoting...'
                          : 'Promote to parent'}
                      </button>
                    )}
                    <button
                      type='button'
                      onClick={() => void handleAddEntityToCompendium(entity)}
                      disabled={linkingCompendiumEntityId === entity.id}
                    >
                      {linkingCompendiumEntityId === entity.id
                        ? 'Linking...'
                        : compendiumLinkedEntityIds.has(entity.id)
                          ? 'Update Compendium'
                          : 'Add to Compendium'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

interface CategoryManagerProps {
  projectId: string;
  categories: EntityCategory[];
  onCategoriesChange: (cats: EntityCategory[]) => void;
  onClose: () => void;
}

function CategoryManager({
  projectId,
  categories,
  onCategoriesChange,
  onClose
}: CategoryManagerProps) {
  const [newCatName, setNewCatName] = useState('');
  const [editingCategory, setEditingCategory] = useState<EntityCategory | null>(
    null
  );

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;

    const cat: EntityCategory = {
      id: crypto.randomUUID(),
      projectId,
      name: newCatName,
      slug: newCatName.toLowerCase().replace(/\s+/g, '-'),
      fieldSchema: [
        {key: 'description', label: 'Description', type: 'textarea'}
      ],
      createdAt: Date.now()
    };

    await saveCategory(cat);
    onCategoriesChange([...categories, cat]);
    setNewCatName('');
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete this category? All entities in it will be orphaned.'))
      return;
    await deleteCategory(id);
    onCategoriesChange(categories.filter((c) => c.id !== id));
  };

  const handleSaveCategory = (updated: EntityCategory) => {
    onCategoriesChange(
      categories.map((c) => (c.id === updated.id ? updated : c))
    );
    setEditingCategory(null);
  };

  if (editingCategory) {
    return (
      <CategoryEditor
        category={editingCategory}
        onSave={handleSaveCategory}
        onCancel={() => setEditingCategory(null)}
      />
    );
  }

  return (
    <div className={styles.categoryManager}>
      <h3>Manage Categories</h3>
      <div className={styles.addCategoryForm}>
        <input
          type='text'
          placeholder='New category name (e.g., Monsters)'
          value={newCatName}
          onChange={(e) => setNewCatName(e.target.value)}
        />
        <button onClick={handleAddCategory}>Add Category</button>
      </div>

      <ul className={styles.categoryList}>
        {categories.map((cat) => (
          <li key={cat.id} className={styles.categoryItem}>
            <div className={styles.categoryInfo}>
              <strong>{cat.name}</strong>
              <span className={styles.categoryMeta}>
                ({cat.fieldSchema.length} fields)
              </span>
            </div>
            <div className={styles.categoryActions}>
              <button onClick={() => setEditingCategory(cat)}>
                Edit Fields
              </button>
              <button
                onClick={() => handleDeleteCategory(cat.id)}
                className={styles.deleteButton}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button onClick={onClose} className={styles.closeButton}>
        Close
      </button>
    </div>
  );
}

export default WorldBibleRoute;
