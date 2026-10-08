import {useState} from 'react';
import type {Dispatch, SetStateAction} from 'react';
import type {EntityCategory, Project, ProjectSettings, WorldEntity} from '../../entityTypes';
import type {
  ImportMode,
  JsonImportConflictResolution,
  WorldBibleImportDraft,
  useWorldBibleImports
} from '../../hooks/useWorldBibleImports';
import type {useWorldBibleAuthoringAssistant} from '../../hooks/useWorldBibleAuthoringAssistant';
import {useConfirmDialog} from '../../hooks/useConfirmDialog';
import {AIAssistant} from '../AIAssistant/AIAssistant';
import {ImportDraftCard} from './ImportDraftCard';
import {ImportDocumentPreviewDialog} from './ImportDocumentPreviewDialog';
import {getNewFieldLabel} from '../../services/worldBible/worldBibleImportParsing';
import styles from '../../assets/components/WorldBibleRoute.module.css';

/** New-field labels planned by drafts still waiting, per category, so one import can reuse another's. */
const getPlannedNewFieldLabels = (drafts: WorldBibleImportDraft[]): Map<string, string[]> => {
  const byCategory = new Map<string, string[]>();
  drafts.forEach((draft) => {
    if (!draft.include || draft.parseError || draft.status === 'imported' || !draft.useDetectedSections) {
      return;
    }
    const labels = byCategory.get(draft.categoryId) ?? [];
    draft.detectedSections?.forEach((section) => {
      if (section.action !== 'new-field') return;
      const label = getNewFieldLabel(section);
      if (!labels.some((known) => known.toLowerCase() === label.toLowerCase())) {
        labels.push(label);
      }
    });
    byCategory.set(draft.categoryId, labels);
  });
  return byCategory;
};

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

interface WorldBibleImportWorkspaceProps {
  activeProject: Project;
  projectSettings: ProjectSettings | null;
  activeCategory: EntityCategory | undefined;
  categories: EntityCategory[];
  categoryById: Map<string, EntityCategory>;
  imports: ReturnType<typeof useWorldBibleImports>;
  authoring: ReturnType<typeof useWorldBibleAuthoringAssistant>;
  isPasteImportOpen: boolean;
  setIsPasteImportOpen: Dispatch<SetStateAction<boolean>>;
  pastedImportText: string;
  setPastedImportText: Dispatch<SetStateAction<string>>;
  handlePreparePastedImportDraft: () => void;
  /** Opens a saved record in the editor; `saved` is the just-written copy when the list is not yet refreshed. */
  onOpenImportedEntity: (entityId: string, saved?: WorldEntity) => void;
}

export const WorldBibleImportWorkspace = (props: WorldBibleImportWorkspaceProps) => {
  const {
    activeProject, projectSettings, activeCategory, categories, categoryById, imports, authoring,
    isPasteImportOpen, setIsPasteImportOpen, pastedImportText, setPastedImportText,
    handlePreparePastedImportDraft, onOpenImportedEntity
  } = props;
  const {
    isApplyingImports, importDrafts, clearImportDrafts, applyImportDrafts, isApplyingJsonImport,
    jsonImportSession, jsonImportConflictResolutions, activeJsonCategory,
    preparedJsonRows, jsonImportValidCount, jsonImportConflictCount,
    unresolvedJsonConflictCount, updateImportDraft, updateImportSectionDestination,
    applyJsonImport, handleJsonCategoryChange, handleJsonNameKeyChange,
    handleJsonModeChange, handleJsonFieldMapChange,
    handleJsonConflictResolutionChange, clearJsonImportSession
  } = imports;
  const {
    isImportAiHelperOpen, setIsImportAiHelperOpen, importAiContext,
    detectedSectionImportDraftCount, handleUseDetectedSectionsForImportDrafts
  } = authoring;
  const [activeImportPreviewId, setActiveImportPreviewId] = useState<string | null>(null);
  const {requestConfirm, confirmDialog} = useConfirmDialog();
  const plannedNewFieldLabels = getPlannedNewFieldLabels(importDrafts);
  const activeImportPreviewDraft =
    importDrafts.find((draft) => draft.id === activeImportPreviewId) ?? null;

  const importedCount = importDrafts.filter((draft) => draft.status === 'imported').length;
  const failedCount = importDrafts.filter((draft) => draft.status === 'failed').length;
  const unreadableCount = importDrafts.filter((draft) => draft.parseError).length;
  const unsavedDrafts = importDrafts.filter(
    (draft) => !draft.parseError && draft.status !== 'imported'
  );
  const selectedUnsavedCount = unsavedDrafts.filter((draft) => draft.include).length;

  const handleImport = async (options?: {draftIds?: string[]; openFirstImported?: boolean}) => {
    const firstImported = await applyImportDrafts(options);
    if (options?.openFirstImported && firstImported) {
      setActiveImportPreviewId(null);
      onOpenImportedEntity(firstImported.id, firstImported);
    }
  };

  const handleCloseImports = () => {
    if (unsavedDrafts.length === 0) {
      clearImportDrafts();
      return;
    }
    requestConfirm({
      title: 'Discard drafts that are not imported?',
      message: `${plural(unsavedDrafts.length, 'draft')} will be discarded without saving. Records already imported stay in the project.`,
      confirmLabel: 'Discard',
      variant: 'danger',
      onConfirm: clearImportDrafts
    });
  };

  return (
    <>
      {activeCategory && isPasteImportOpen && (
        <section className={styles.characterImportPanel} aria-label='Paste import text'>
          <div className={styles.importPanelHeader}>
            <div>
              <h2>Paste {activeCategory.name.replace(/s$/i, '')}</h2>
              <p className={styles.importSummary}>
                Paste a dossier or notes. The shared import preview will classify headings
                before anything is saved.
              </p>
            </div>
            <div className={styles.importPanelActions}>
              <button
                type='button'
                onClick={() => {
                  setIsPasteImportOpen(false);
                  setPastedImportText('');
                }}
              >
                Close
              </button>
            </div>
          </div>
          <label className={styles.characterImportLabel}>
            Import text
            <textarea
              value={pastedImportText}
              onChange={(event) => setPastedImportText(event.target.value)}
              rows={10}
              placeholder={'Name: Mira Voss\n\nBackground:\n...'}
            />
          </label>
          <div className={styles.importPanelActions}>
            <button type='button' onClick={handlePreparePastedImportDraft}>
              Review Paste
            </button>
          </div>
        </section>
      )}

      {importDrafts.length > 0 && (
        <section className={styles.importPanel}>
          <div className={styles.importPanelHeader}>
            <h2>Import Preview</h2>
            <div className={styles.importPanelActions}>
              <button
                type='button'
                onClick={() => setIsImportAiHelperOpen((value) => !value)}
                aria-expanded={isImportAiHelperOpen}
              >
                {isImportAiHelperOpen ? 'Hide AI helper' : 'AI helper'}
              </button>
              <button
                type='button'
                onClick={() => void handleImport()}
                disabled={isApplyingImports || selectedUnsavedCount === 0}
              >
                {isApplyingImports ? 'Importing...' : `Import selected (${selectedUnsavedCount})`}
              </button>
              <button
                type='button'
                onClick={handleCloseImports}
                disabled={isApplyingImports}
              >
                {unsavedDrafts.length > 0 ? 'Discard drafts' : 'Close'}
              </button>
            </div>
          </div>
          <p className={styles.importSummary}>
            Nothing is saved to the project until a draft is imported. Import and open saves
            one draft; Import selected saves every checked draft.
          </p>
          <p className={styles.importSummary} aria-label='Import status'>
            {plural(unsavedDrafts.length - failedCount, 'draft')} waiting · {importedCount} imported
            {failedCount > 0 ? ` · ${failedCount} failed` : ''}
            {unreadableCount > 0 ? ` · ${unreadableCount} unreadable` : ''}
          </p>
          {isImportAiHelperOpen && (
            <section className={styles.aiHelperPanel} aria-label='Import AI helper'>
              <div className={styles.aiHelperHeader}>
                <div>
                  <strong>Import AI helper</strong>
                  <p>
                    Ask about field mapping, cleanup, duplicate handling, or whether
                    these drafts should become one record or several.
                  </p>
                </div>
                <button
                  type='button'
                  onClick={() => setIsImportAiHelperOpen(false)}
                >
                  Close
                </button>
              </div>
              <div className={styles.importHelperActions}>
                <div>
                  <strong>Apply structure to pending imports</strong>
                  <p>
                    The helper can advise, but field changes are staged through the
                    import draft before anything is saved.
                  </p>
                </div>
                <button
                  type='button'
                  onClick={handleUseDetectedSectionsForImportDrafts}
                  disabled={detectedSectionImportDraftCount === 0 || isApplyingImports}
                >
                  Use detected headings
                </button>
                <span>
                  {detectedSectionImportDraftCount > 0
                    ? `${detectedSectionImportDraftCount} selected draft${
                        detectedSectionImportDraftCount === 1 ? '' : 's'
                      } with headings`
                    : 'No selected drafts have detected headings'}
                </span>
              </div>
              <AIAssistant
                projectId={activeProject.id}
                parentProjectId={activeProject.parentProjectId}
                inheritRag={activeProject.inheritRag}
                inheritShodh={activeProject.inheritShodh}
                aiConfig={projectSettings?.aiSettings}
                projectMode={projectSettings?.projectMode}
                context={{
                  type: 'world-bible',
                  id: activeCategory?.id ?? activeProject.id,
                  selectedText: importAiContext
                }}
                showContextPreview={false}
              />
            </section>
          )}
          <ul className={styles.importDraftList}>
            {importDrafts.map((draft) => (
              <ImportDraftCard
                key={draft.id}
                draft={draft}
                category={categoryById.get(draft.categoryId) ?? null}
                categories={categories}
                plannedNewFieldLabels={plannedNewFieldLabels.get(draft.categoryId)}
                isApplyingImports={isApplyingImports}
                onUpdateDraft={updateImportDraft}
                onUpdateSectionDestination={updateImportSectionDestination}
                onImportAndOpen={(draftId) =>
                  void handleImport({draftIds: [draftId], openFirstImported: true})
                }
                onOpenImported={(entityId) => onOpenImportedEntity(entityId)}
                onPreviewSource={setActiveImportPreviewId}
              />
            ))}
          </ul>
        </section>
      )}

      {activeImportPreviewDraft && (
        <ImportDocumentPreviewDialog
          draft={activeImportPreviewDraft}
          category={categoryById.get(activeImportPreviewDraft.categoryId) ?? null}
          isApplyingImports={isApplyingImports}
          onImportAndOpen={(draftId) =>
            void handleImport({draftIds: [draftId], openFirstImported: true})
          }
          onClose={() => setActiveImportPreviewId(null)}
        />
      )}
      {confirmDialog}

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
                onClick={() => void applyJsonImport()}
                disabled={isApplyingJsonImport}
              >
                {isApplyingJsonImport ? 'Importing...' : 'Apply JSON Import'}
              </button>
              <button
                type='button'
                onClick={clearJsonImportSession}
                disabled={isApplyingJsonImport}
              >
                Clear
              </button>
            </div>
          </div>
          <p className={styles.importSummary}>
            File: {jsonImportSession.fileName} · Rows: {jsonImportSession.rows.length} ·
            Valid: {jsonImportValidCount} · Invalid:{' '}
            {preparedJsonRows.length - jsonImportValidCount} · Conflicts:{' '}
            {jsonImportConflictCount}
          </p>
          {jsonImportConflictCount > 0 && (
            <p className={styles.importError}>
              Resolve duplicate-name conflicts before applying import. Unreviewed conflicts:{' '}
              {unresolvedJsonConflictCount}
            </p>
          )}
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
                onChange={(e) => handleJsonNameKeyChange(e.target.value)}
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
                onChange={(e) => handleJsonModeChange(e.target.value as ImportMode)}
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
                {row.conflict && (
                  <>
                    <p className={styles.importError}>{row.conflict.message}</p>
                    <label>
                      Conflict resolution
                      <select
                        value={jsonImportConflictResolutions[row.rowIndex] ?? ''}
                        onChange={(e) =>
                          handleJsonConflictResolutionChange(
                            row.rowIndex,
                            e.target.value as JsonImportConflictResolution
                          )
                        }
                        disabled={isApplyingJsonImport}
                      >
                        <option value=''>-- Choose resolution --</option>
                        <option value='skip'>Skip Row</option>
                        <option value='upsert'>Update by Name</option>
                        <option value='create'>Create Duplicate</option>
                      </select>
                    </label>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
};
