import {useEffect, useMemo, useRef, useState, type ChangeEvent} from 'react';
import type {
  CanonicalFact,
  EntityCategory,
  LoreDocument,
  LoreDocumentLink,
  Project,
  WorldEntity
} from '../../entityTypes';
import type {ConsistencyAlias} from '../../services/consistency';
import {saveEntity} from '../../entityStorage';
import {replaceLoreDocumentLinks, saveLoreDocument} from '../../loreStorage';
import {summarizeContent} from '../../services/lore/sourceNoteCapture';
import {
  downloadPortableDataZip,
  parsePortableMarkdownFiles,
  type PortableMarkdownDraft
} from '../../services/portability/portableData';
import {
  ALTERNATIVE_NAMES_KEY,
  buildWorldBibleEntityContent,
  getPreferredImportField,
  normalizeRichTextValue,
  parseAlternativeNames
} from '../../services/worldBible/worldBibleEntityHelpers';
import {markdownToRichHtml} from '../../hooks/useWorldBibleImports';
import {describeError} from '../../services/errors';
import type {RAGProvider} from '../../services/rag/RAGService';
import type {ShodhMemoryProvider} from '../../services/shodh/ShodhMemoryService';
import styles from '../../assets/components/WorldBibleRoute.module.css';

type WikiLinkAction = 'ignore' | 'link' | 'alias';

interface PortableImportDraft extends PortableMarkdownDraft {
  include: boolean;
  categoryId: string;
  wikiLinkActions: Record<string, WikiLinkAction>;
}

interface PortableDataPanelProps {
  project: Project;
  categories: EntityCategory[];
  entities: WorldEntity[];
  aliases: ConsistencyAlias[];
  canonicalFacts: CanonicalFact[];
  loreDocuments: LoreDocument[];
  loreDocumentLinks: LoreDocumentLink[];
  ragService: RAGProvider | null;
  shodhService: ShodhMemoryProvider | null;
  onFeedback: (feedback: {tone: 'success' | 'error'; message: string}) => void;
}

const normalizeName = (value: string): string => value.trim().toLowerCase();

const findCategoryId = (
  draft: PortableMarkdownDraft,
  categories: EntityCategory[]
): string => {
  const category = categories.find(
    (candidate) =>
      normalizeName(candidate.slug) === normalizeName(draft.frontmatter.categorySlug ?? '') ||
      normalizeName(candidate.name) === normalizeName(draft.frontmatter.category ?? '')
  );
  return category?.id ?? categories[0]?.id ?? '';
};

const matchEntity = (
  name: string,
  entities: WorldEntity[],
  aliases: ConsistencyAlias[]
): WorldEntity | null => {
  const key = normalizeName(name);
  const direct = entities.find((entity) => normalizeName(entity.name) === key);
  if (direct) return direct;
  const alias = aliases.find(
    (candidate) => candidate.targetType === 'entity' && normalizeName(candidate.alias) === key
  );
  return alias ? entities.find((entity) => entity.id === alias.targetId) ?? null : null;
};

const validLoreKind = (value: unknown): LoreDocument['kind'] => {
  const allowed: LoreDocument['kind'][] = [
    'character_dossier',
    'place_history',
    'faction_notes',
    'item_history',
    'myth',
    'timeline',
    'general_lore'
  ];
  return typeof value === 'string' && allowed.includes(value as LoreDocument['kind'])
    ? value as LoreDocument['kind']
    : 'general_lore';
};

export function PortableDataPanel(props: PortableDataPanelProps) {
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const categoriesRef = useRef(props.categories);
  const [drafts, setDrafts] = useState<PortableImportDraft[]>([]);
  const [isReading, setIsReading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    categoriesRef.current = props.categories;
    if (props.categories.length === 0) return;
    setDrafts((current) => current.map((draft) => {
      if (props.categories.some((category) => category.id === draft.categoryId)) {
        return draft;
      }
      return {...draft, categoryId: findCategoryId(draft, props.categories)};
    }));
  }, [props.categories]);

  const matchedEntities = useMemo(() => {
    const matches = new Map<string, WorldEntity>();
    drafts.forEach((draft) => {
      draft.wikilinks.forEach((name) => {
        const match = matchEntity(name, props.entities, props.aliases);
        if (match) matches.set(`${draft.id}:${name}`, match);
      });
    });
    return matches;
  }, [drafts, props.aliases, props.entities]);

  const updateDraft = (id: string, updates: Partial<PortableImportDraft>) => {
    setDrafts((current) => current.map((draft) => draft.id === id ? {...draft, ...updates} : draft));
  };

  const handleFolder = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;
    setIsReading(true);
    try {
      const parsed = await parsePortableMarkdownFiles(files);
      const next = parsed.map<PortableImportDraft>((draft) => ({
        ...draft,
        include: !/^(?:readme|license|changelog)$/i.test(draft.title),
        categoryId: findCategoryId(draft, props.categories),
        wikiLinkActions: Object.fromEntries(draft.wikilinks.map((link) => [link, 'ignore']))
      }));
      setDrafts(next);
      props.onFeedback({
        tone: 'success',
        message: `Staged ${next.length} Markdown file${next.length === 1 ? '' : 's'} for review. Nothing has been saved yet.`
      });
    } catch (error) {
      props.onFeedback({tone: 'error', message: describeError(error, 'Unable to read Markdown folder.')});
    } finally {
      setIsReading(false);
    }
  };

  const handleExport = () => {
    setIsExporting(true);
    try {
      downloadPortableDataZip({
        projectName: props.project.name,
        categories: props.categories,
        entities: props.entities,
        aliases: props.aliases,
        canonicalFacts: props.canonicalFacts,
        loreDocuments: props.loreDocuments,
        loreDocumentLinks: props.loreDocumentLinks
      });
      props.onFeedback({
        tone: 'success',
        message: 'Exported portable Markdown and CSV. Project backup remains the full-fidelity restore format.'
      });
    } catch (error) {
      props.onFeedback({tone: 'error', message: describeError(error, 'Unable to export portable data.')});
    } finally {
      setIsExporting(false);
    }
  };

  const handleApply = async () => {
    const selected = drafts.filter((draft) => draft.include);
    if (selected.length === 0) {
      props.onFeedback({tone: 'error', message: 'Select at least one Markdown file to import.'});
      return;
    }
    setIsApplying(true);
    let sourceNoteCount = 0;
    let worldBibleCount = 0;
    try {
      for (const draft of selected) {
        const now = Date.now();
        const chosenLinks = draft.wikilinks
          .filter((name) => draft.wikiLinkActions[name] === 'link')
          .map((name) => matchedEntities.get(`${draft.id}:${name}`))
          .filter((entity): entity is WorldEntity => Boolean(entity));
        if (draft.destination === 'source-note') {
          const documentId = crypto.randomUUID();
          const document: LoreDocument = {
            id: documentId,
            projectId: props.project.id,
            title: draft.title.trim(),
            kind: validLoreKind(draft.frontmatter.kind),
            format: 'markdown',
            content: draft.content.trim(),
            summary: summarizeContent(draft.content),
            source: {type: 'import', fileName: draft.relativePath, mimeType: 'text/markdown'},
            status: 'active',
            createdAt: now,
            updatedAt: now
          };
          await saveLoreDocument(document);
          await replaceLoreDocumentLinks({
            loreDocumentId: documentId,
            links: chosenLinks.map((entity, index) => ({
              id: crypto.randomUUID(),
              projectId: props.project.id,
              loreDocumentId: documentId,
              targetType: 'entity' as const,
              targetId: entity.id,
              relationship: index === 0 ? 'primary_subject' as const : 'mentions' as const,
              createdAt: now
            }))
          });
          await props.ragService?.indexDocument(
            `lore:${document.id}`,
            document.title,
            document.content,
            'lore',
            {
              tags: [document.kind, 'lore'],
              entityIds: chosenLinks.map((entity) => entity.id)
            }
          );
          sourceNoteCount += 1;
          continue;
        }

        const currentCategories = categoriesRef.current;
        const resolvedCategoryId = currentCategories.some(
          (candidate) => candidate.id === draft.categoryId
        )
          ? draft.categoryId
          : findCategoryId(draft, currentCategories);
        const category = currentCategories.find(
          (candidate) => candidate.id === resolvedCategoryId
        );
        if (!category) throw new Error(`Choose a category for "${draft.title}".`);
        const fields: Record<string, unknown> = {};
        const importedFields = draft.frontmatter.fields;
        if (importedFields && typeof importedFields === 'object') {
          category.fieldSchema.forEach((field) => {
            const value = importedFields[field.key];
            if (value === undefined || value === null || value === '') return;
            fields[field.key] = field.type === 'textarea'
              ? normalizeRichTextValue(String(value))
              : value;
          });
        }
        const preferredField = getPreferredImportField(category);
        if (preferredField && !fields[preferredField.key]) {
          fields[preferredField.key] = preferredField.type === 'textarea'
            ? markdownToRichHtml(draft.content)
            : draft.content.trim();
        }
        const frontmatterAliases = Array.isArray(draft.frontmatter.aliases)
          ? draft.frontmatter.aliases
          : [];
        const selectedAliases = draft.wikilinks.filter(
          (name) => draft.wikiLinkActions[name] === 'alias'
        );
        const combinedAliases = parseAlternativeNames(
          [...frontmatterAliases, ...selectedAliases].join(', ')
        );
        if (combinedAliases.length > 0) {
          fields[ALTERNATIVE_NAMES_KEY] = combinedAliases.join(', ');
        }
        const entity: WorldEntity = {
          id: crypto.randomUUID(),
          projectId: props.project.id,
          categoryId: category.id,
          name: draft.title.trim(),
          fields,
          isNew: true,
          needsCompletion: true,
          links: Array.from(new Set(chosenLinks.map((entity) => entity.id))),
          createdAt: now,
          updatedAt: now
        };
        await saveEntity(entity);
        const indexedContent = buildWorldBibleEntityContent(entity);
        await props.ragService?.indexDocument(
          entity.id,
          entity.name,
          indexedContent,
          'worldbible',
          {tags: [category.slug], entityIds: [entity.id]}
        );
        await props.shodhService?.captureAutoMemory({
          projectId: entity.projectId,
          documentId: entity.id,
          title: entity.name,
          content: indexedContent,
          tags: ['worldbible', category.slug]
        });
        worldBibleCount += 1;
      }
      setDrafts([]);
      props.onFeedback({
        tone: 'success',
        message: `Imported ${sourceNoteCount} Source Note${sourceNoteCount === 1 ? '' : 's'} and ${worldBibleCount} World Bible draft${worldBibleCount === 1 ? '' : 's'}. Review drafts and extract Source Note candidates before accepting canon.`
      });
    } catch (error) {
      props.onFeedback({tone: 'error', message: describeError(error, 'Unable to import Markdown folder.')});
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <section className={styles.importPanel} aria-label='Portable data'>
      <input
        ref={(node) => {
          folderInputRef.current = node;
          node?.setAttribute('webkitdirectory', '');
        }}
        type='file'
        accept='.md,.markdown,text/markdown'
        multiple
        onChange={(event) => void handleFolder(event)}
        style={{display: 'none'}}
      />
      <div className={styles.importPanelHeader}>
        <div>
          <h2>Portable data</h2>
          <p className={styles.importSummary}>
            Export readable Markdown and CSV, or review an Obsidian-style Markdown folder before importing it.
          </p>
        </div>
        <div className={styles.importPanelActions}>
          <button type='button' onClick={handleExport} disabled={isExporting}>
            {isExporting ? 'Exporting...' : 'Export Markdown + CSV'}
          </button>
          <button type='button' onClick={() => folderInputRef.current?.click()} disabled={isReading}>
            {isReading ? 'Reading...' : 'Import Markdown Folder'}
          </button>
        </div>
      </div>
      {drafts.length > 0 && (
        <>
          <p className={styles.importSummary}>
            Source Notes remain non-canon. World Bible files land as incomplete drafts in Review. Wikilinks are ignored unless you choose an action.
          </p>
          <ul className={styles.importDraftList}>
            {drafts.map((draft) => (
              <li key={draft.id} className={styles.importDraftCard}>
                <div className={styles.importDraftTop}>
                  <label>
                    <input
                      type='checkbox'
                      checked={draft.include}
                      disabled={isApplying}
                      onChange={(event) => updateDraft(draft.id, {include: event.target.checked})}
                    />
                    <span>{draft.relativePath}</span>
                  </label>
                </div>
                <div className={styles.importDraftFields}>
                  <label>
                    Title
                    <input
                      value={draft.title}
                      disabled={isApplying}
                      onChange={(event) => updateDraft(draft.id, {title: event.target.value})}
                    />
                  </label>
                  <label>
                    Import as
                    <select
                      value={draft.destination}
                      disabled={isApplying}
                      onChange={(event) => updateDraft(draft.id, {
                        destination: event.target.value as PortableImportDraft['destination']
                      })}
                    >
                      <option value='source-note'>Source Note</option>
                      <option value='world-bible'>World Bible draft</option>
                    </select>
                  </label>
                  {draft.destination === 'world-bible' && (
                    <label>
                      Category
                      <select
                        value={draft.categoryId}
                        disabled={isApplying}
                        onChange={(event) => updateDraft(draft.id, {categoryId: event.target.value})}
                      >
                        {props.categories.map((category) => (
                          <option key={category.id} value={category.id}>{category.name}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                {draft.wikilinks.length > 0 && (
                  <div className={styles.importSectionMapping}>
                    <strong>Wikilink proposals</strong>
                    <div className={styles.importSectionList}>
                      {draft.wikilinks.map((name) => {
                        const matched = matchedEntities.get(`${draft.id}:${name}`);
                        return (
                          <div key={name} className={styles.importSectionItem}>
                            <div>
                              <strong>[[{name}]]</strong>
                              <span>{matched ? `Matches ${matched.name}` : 'No existing World Bible match'}</span>
                            </div>
                            <select
                              value={draft.wikiLinkActions[name] ?? 'ignore'}
                              disabled={isApplying}
                              onChange={(event) => updateDraft(draft.id, {
                                wikiLinkActions: {
                                  ...draft.wikiLinkActions,
                                  [name]: event.target.value as WikiLinkAction
                                }
                              })}
                            >
                              <option value='ignore'>Ignore</option>
                              <option value='link' disabled={!matched}>Link existing record</option>
                              {draft.destination === 'world-bible' && <option value='alias'>Use as alias</option>}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className={styles.importPanelActions}>
            <button type='button' onClick={() => void handleApply()} disabled={isApplying}>
              {isApplying ? 'Importing...' : 'Import Selected'}
            </button>
            <button type='button' onClick={() => setDrafts([])} disabled={isApplying}>Clear</button>
          </div>
        </>
      )}
    </section>
  );
}
