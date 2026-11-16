import {useRef, useState} from 'react';
import type {
  CanonicalFact,
  EntityCategory,
  LoreDocument,
  LoreDocumentLink,
  Project,
  WorldEntity
} from '../../entityTypes';
import type {ConsistencyAlias} from '../../services/storage';
import {downloadPortableDataZip} from '../../services/portability/portableData';
import type {PortableImportDraft, WikiLinkAction} from '../../services/portability/portableImport';
import {describeError} from '../../services/errors';
import type {RAGProvider} from '../../services/rag/RAGService';
import type {ShodhMemoryProvider} from '../../services/shodh/ShodhMemoryService';
import shared from './worldBibleShared.module.css';
import styles from './WorldBibleImportDrafts.module.css';
import {useProjectMaps} from '../../hooks/useProjectMaps';
import {usePortableDataImport} from '../../hooks/usePortableDataImport';

interface PortableDataPanelProps {
  project: Project;
  categories: EntityCategory[];
  categoriesLoaded: boolean;
  entities: WorldEntity[];
  aliases: ConsistencyAlias[];
  canonicalFacts: CanonicalFact[];
  loreDocuments: LoreDocument[];
  loreDocumentLinks: LoreDocumentLink[];
  ragService: RAGProvider | null;
  shodhService: ShodhMemoryProvider | null;
  onFeedback: (feedback: {tone: 'success' | 'error'; message: string}) => void;
}

export function PortableDataPanel(props: PortableDataPanelProps) {
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const {maps, conversions} = useProjectMaps();
  const {
    drafts,
    isReading,
    isApplying,
    matchedEntities,
    waitingForCategories,
    updateDraft,
    clearDrafts,
    handleFolder,
    handleApply
  } = usePortableDataImport({
    project: props.project,
    categories: props.categories,
    categoriesLoaded: props.categoriesLoaded,
    entities: props.entities,
    aliases: props.aliases,
    indexing: {ragService: props.ragService, shodhService: props.shodhService},
    onFeedback: props.onFeedback
  });

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
        loreDocumentLinks: props.loreDocumentLinks,
        maps,
        unitConversions: conversions
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
      <div className={shared.castTaskGrid}>
        <div className={shared.castTask}>
          <h3>Export Markdown + CSV</h3>
          <p>
            Downloads a ZIP with one Markdown file per World Bible record, one spreadsheet
            (CSV) per category, and one Markdown file per Source Note. This isn't a backup
            and can't restore a project.
          </p>
          <button type='button' onClick={handleExport} disabled={isExporting}>
            {isExporting ? 'Exporting...' : 'Export Markdown + CSV'}
          </button>
        </div>
        <div className={shared.castTask}>
          <h3>Import Markdown Folder</h3>
          <p>
            Choose a folder of <code>.md</code> files. Before anything is saved, you choose
            for each file whether it becomes a World Bible record (and in which category) or
            a Source Note, or you leave it out. Imported records start marked incomplete so
            you can check them in Review. Source Notes go through the usual fact review
            before anything becomes canon.
          </p>
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
          {waitingForCategories && (
            <p className={styles.importSummary} role='status'>
              Loading World Bible categories before drafts can be imported...
            </p>
          )}
          <div className={styles.importPanelActions}>
            <button
              type='button'
              onClick={() => void handleApply()}
              disabled={isApplying || waitingForCategories}
            >
              {isApplying ? 'Importing...' : 'Import Selected'}
            </button>
            <button type='button' onClick={clearDrafts} disabled={isApplying}>Clear</button>
          </div>
        </>
      )}
    </section>
  );
}
