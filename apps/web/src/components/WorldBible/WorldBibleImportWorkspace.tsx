import type {Dispatch, RefObject, SetStateAction} from 'react';
import type {EntityCategory, Project, ProjectSettings} from '../../entityTypes';
import type {
  ImportMode,
  JsonImportConflictResolution,
  WorldBibleImportDraft,
  useWorldBibleImports
} from '../../hooks/useWorldBibleImports';
import type {useWorldBibleAuthoringAssistant} from '../../hooks/useWorldBibleAuthoringAssistant';
import {AIAssistant} from '../AIAssistant/AIAssistant';
import {ImportSectionPanel} from './ImportSectionPanel';
import {normalizeRichTextValue} from '../../services/worldBible/worldBibleEntityHelpers';
import styles from '../../assets/components/WorldBibleRoute.module.css';

const getPreferredImportField = (category: EntityCategory) =>
  category.fieldSchema.find((field) => field.key === 'description') ??
  category.fieldSchema.find((field) => field.type === 'textarea') ??
  category.fieldSchema.find((field) => field.type === 'text');

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
  richImportDraftCount: number;
  activeImportPreviewDraft: WorldBibleImportDraft | null;
  importPreviewDialogRef: RefObject<HTMLDivElement | null>;
  setActiveImportPreviewId: Dispatch<SetStateAction<string | null>>;
  handleApplyImportDrafts: (options?: {draftIds?: string[]; openFirstImported?: boolean}) => Promise<void>;
}

export const WorldBibleImportWorkspace = (props: WorldBibleImportWorkspaceProps) => {
  const {
    activeProject, projectSettings, activeCategory, categories, categoryById, imports, authoring,
    isPasteImportOpen, setIsPasteImportOpen, pastedImportText, setPastedImportText,
    handlePreparePastedImportDraft, richImportDraftCount, activeImportPreviewDraft,
    importPreviewDialogRef, setActiveImportPreviewId,
    handleApplyImportDrafts
  } = props;
  const {
    isApplyingImports, importDrafts, clearImportDrafts, isApplyingJsonImport,
    jsonImportSession, jsonImportConflictResolutions, activeJsonCategory,
    preparedJsonRows, jsonImportValidCount, jsonImportConflictCount,
    unresolvedJsonConflictCount, updateImportDraft, updateImportSectionAction,
    applyJsonImport, handleJsonCategoryChange, handleJsonNameKeyChange,
    handleJsonModeChange, handleJsonFieldMapChange,
    handleJsonConflictResolutionChange, clearJsonImportSession
  } = imports;
  const {
    isImportAiHelperOpen, setIsImportAiHelperOpen, importAiContext,
    detectedSectionImportDraftCount, handleUseDetectedSectionsForImportDrafts
  } = authoring;
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
                onClick={() => void handleApplyImportDrafts()}
                disabled={isApplyingImports}
              >
                {isApplyingImports ? 'Importing...' : 'Apply Imports'}
              </button>
              <button
                type='button'
                onClick={clearImportDrafts}
                disabled={isApplyingImports}
              >
                Clear
              </button>
            </div>
          </div>
          <p className={styles.importSummary}>
            {importDrafts.filter((draft) => draft.include && !draft.parseError).length}{' '}
            selected · {importDrafts.filter((draft) => draft.parseError).length} with
            errors · {richImportDraftCount} targeting rich-text lore fields
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
            {importDrafts.map((draft) => {
              const category = categoryById.get(draft.categoryId) ?? null;
              const preferredField = category ? getPreferredImportField(category) : null;
              const landsAsRichText = preferredField?.type === 'textarea';
              const sourceKind = draft.fileName.toLowerCase().endsWith('.html') ||
                draft.fileName.toLowerCase().endsWith('.htm')
                ? 'HTML'
                : draft.fileName.toLowerCase().endsWith('.md') ||
                    draft.fileName.toLowerCase().endsWith('.markdown')
                  ? 'Markdown'
                  : draft.fileName.toLowerCase().endsWith('.docx')
                    ? 'DOCX'
                    : 'Text';
              return (
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
                    <div className={styles.importChipRow}>
                      <span className={styles.importChip}>{sourceKind}</span>
                      {preferredField && (
                        <span
                          className={`${styles.importChip} ${
                            landsAsRichText ? styles.importChipRich : styles.importChipPlain
                          }`}
                        >
                          {landsAsRichText
                            ? `Rich text -> ${preferredField.label}`
                            : `Plain field -> ${preferredField.label}`}
                        </span>
                      )}
                      {draft.detectedSections && draft.detectedSections.length > 0 && (
                        <span className={`${styles.importChip} ${styles.importChipRich}`}>
                          {draft.detectedSections.length} headings detected
                        </span>
                      )}
                      <span className={styles.importChip}>
                        {draft.mode === 'upsert' ? 'Update by name' : 'Create new'}
                      </span>
                    </div>
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
                        {categories.map((categoryOption) => (
                          <option key={categoryOption.id} value={categoryOption.id}>
                            {categoryOption.name}
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
                    <>
                      <ImportSectionPanel
                        draft={draft}
                        isApplyingImports={isApplyingImports}
                        onUpdateDraft={updateImportDraft}
                        onUpdateSectionAction={updateImportSectionAction}
                      />
                      <div className={styles.importDraftActions}>
                        <button
                          type='button'
                          className={styles.importPreviewButton}
                          onClick={() =>
                            void handleApplyImportDrafts({
                              draftIds: [draft.id],
                              openFirstImported: true
                            })
                          }
                          disabled={isApplyingImports}
                        >
                          Import and open
                        </button>
                        {draft.richTextHtml && (
                          <button
                            type='button'
                            className={styles.importPreviewButton}
                            onClick={() => setActiveImportPreviewId(draft.id)}
                            disabled={isApplyingImports}
                          >
                            Preview source document
                          </button>
                        )}
                      </div>
                      <p className={styles.importPreview}>{draft.preview}</p>
                      <p className={styles.importDraftNote}>
                        {draft.useDetectedSections && (draft.detectedSections?.length ?? 0) > 0
                          ? 'Description keeps intro and record-section headings. Only reusable field headings change the category schema.'
                          : landsAsRichText
                            ? 'This import will preserve richer prose structure in the target lore field.'
                            : 'This import will land as plain text in the target field.'}
                      </p>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {activeImportPreviewDraft && (() => {
        const previewCategory = categoryById.get(activeImportPreviewDraft.categoryId) ?? null;
        const previewField = previewCategory ? getPreferredImportField(previewCategory) : null;
        const previewSourceKind =
          activeImportPreviewDraft.fileName.toLowerCase().endsWith('.html') ||
          activeImportPreviewDraft.fileName.toLowerCase().endsWith('.htm')
            ? 'HTML'
            : activeImportPreviewDraft.fileName.toLowerCase().endsWith('.md') ||
                activeImportPreviewDraft.fileName.toLowerCase().endsWith('.markdown')
              ? 'Markdown'
              : activeImportPreviewDraft.fileName.toLowerCase().endsWith('.docx')
                ? 'DOCX'
                : 'Text';
        return (
          <div
            ref={importPreviewDialogRef}
            className={styles.importPreviewOverlay}
            role='dialog'
            aria-modal='true'
            aria-label='Import document preview'
            onClick={() => setActiveImportPreviewId(null)}
          >
            <div
              className={styles.importPreviewCard}
              onClick={(event) => event.stopPropagation()}
            >
              <div className={styles.importPreviewHeader}>
                <div>
                  <div className={styles.importPreviewEyebrow}>Import document preview</div>
                  <h3 className={styles.importPreviewTitle}>
                    {activeImportPreviewDraft.name || activeImportPreviewDraft.fileName}
                  </h3>
                  <div className={styles.importChipRow}>
                    <span className={styles.importChip}>{previewSourceKind}</span>
                    {previewField && (
                      <span
                        className={`${styles.importChip} ${
                          previewField.type === 'textarea'
                            ? styles.importChipRich
                            : styles.importChipPlain
                        }`}
                      >
                        {previewField.type === 'textarea'
                          ? `Rich text -> ${previewField.label}`
                          : `Plain field -> ${previewField.label}`}
                      </span>
                    )}
                    <span className={styles.importChip}>{activeImportPreviewDraft.fileName}</span>
                  </div>
                </div>
                <button
                  type='button'
                  className={styles.importPreviewButton}
                  onClick={() =>
                    void handleApplyImportDrafts({
                      draftIds: [activeImportPreviewDraft.id],
                      openFirstImported: true
                    })
                  }
                  disabled={isApplyingImports}
                >
                  Import and open
                </button>
                <button
                  type='button'
                  className={styles.importPreviewButton}
                  onClick={() => setActiveImportPreviewId(null)}
                  disabled={isApplyingImports}
                >
                  Close preview
                </button>
              </div>
              <div className={styles.importPreviewDocument}>
                <article
                  className={styles.importPreviewContent}
                  dangerouslySetInnerHTML={{
                    __html:
                      activeImportPreviewDraft.richTextHtml ||
                      normalizeRichTextValue(activeImportPreviewDraft.text)
                  }}
                />
              </div>
            </div>
          </div>
        );
      })()}

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
