import {useCallback, useRef, useState} from 'react';
import {useAppStore} from '../store/appStore';
import type {LoreDocument} from '../entityTypes';
import {SourceNoteStarterPanel} from '../components/SourceNotes/SourceNoteStarterPanel';
import {SourceNoteDocumentList} from '../components/SourceNotes/SourceNoteDocumentList';
import {SourceNoteBatchImportDialog} from '../components/SourceNotes/SourceNoteBatchImportDialog';
import {SourceNoteEditorForm} from '../components/SourceNotes/SourceNoteEditorForm';
import {SourceNoteExtractionReview} from '../components/SourceNotes/SourceNoteExtractionReview';
import {SourceNoteContextHealthPanel} from '../components/SourceNotes/SourceNoteContextHealthPanel';
import {ProjectScratchpadButton} from '../components/ProjectScratchpadButton';
import {PageHeader} from '../components/PageHeader';
import styles from '../styles/LoreRoute.module.css';
import {useConfirmDialog} from '../hooks/useConfirmDialog';
import {useCollapsedPreference} from '../hooks/useCollapsedPreference';
import {useStatusAnnouncement} from '../hooks/useStatusAnnouncement';
import {useSourceNotesData, type SourceNoteFeedback} from '../hooks/useSourceNotesData';
import {useSourceNoteContextHealth} from '../hooks/useSourceNoteContextHealth';
import {useSourceNoteEditor} from '../hooks/useSourceNoteEditor';
import {
  useSourceNoteExtractionReview,
  type FactTargetDrafts
} from '../hooks/useSourceNoteExtractionReview';
import {RouteFeedback} from '../components/common';

const getLoreRailStorageKey = (projectId: string) =>
  `wbd:lore:document-rail-collapsed:${projectId}`;

function LoreRoute() {
  const {requestConfirm, confirmDialog} = useConfirmDialog();
  const activeProject = useAppStore((state) => state.activeProject);
  const announceStatus = useStatusAnnouncement();
  const [feedback, setFeedback] = useState<SourceNoteFeedback | null>(null);
  // Shared by the editor (which clears them) and the review (which uses them).
  const [factTargetDrafts, setFactTargetDrafts] = useState<FactTargetDrafts>({});
  const clearFactTargetDrafts = useCallback(() => setFactTargetDrafts({}), []);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const {collapsed: isDocumentRailCollapsed, toggle: handleToggleDocumentRail} = useCollapsedPreference(
    activeProject ? getLoreRailStorageKey(activeProject.id) : null
  );

  const data = useSourceNotesData(activeProject);
  const health = useSourceNoteContextHealth({
    activeProject,
    data,
    setFeedback,
    onOpenSourceNote: (document) => openInEditor(document)
  });
  const editor = useSourceNoteEditor({
    activeProject,
    data,
    setFeedback,
    requestConfirm,
    refreshContextHealth: health.refreshProjectContextHealth,
    onEditorReset: clearFactTargetDrafts,
    importInputRef,
    titleInputRef
  });
  const review = useSourceNoteExtractionReview({
    activeProject,
    data,
    editingId: editor.editingId,
    hasUnsavedEditorChanges: editor.hasUnsavedEditorChanges,
    factTargetDrafts,
    setFactTargetDrafts,
    setShodhMemories: health.setShodhMemories,
    refreshContextHealth: health.refreshProjectContextHealth,
    setFeedback,
    requestConfirm,
    announceStatus
  });

  function openInEditor(document: LoreDocument) {
    editor.beginEdit(document);
    editor.focusLoreEditor();
  }

  if (!activeProject) {
    return (
      <section className={styles.page}>
        <h1 className={styles.pageTitle}>Source Notes</h1>
        <p className={styles.pageIntro}>
          Open a project first to create longform source documents.
        </p>
      </section>
    );
  }

  const {documents, linksByDocumentId, entityProposalsByDocumentId, proposalsByDocumentId} = data;
  const {batchImportFiles, setBatchImportFiles} = editor;

  return (
    <section className={styles.page}>
      <PageHeader
        eyebrow='Source notes'
        title='Source Notes'
        description={
          <>
            Keep dossiers, timelines, myths, and deep reference notes here as
            source material. Context links help retrieval and extraction target
            the right World Bible records; they do not accept canon or create
            relationships between those records.
          </>
        }
        actions={
          <>
            <ProjectScratchpadButton projectId={activeProject.id} />
            <button type='button' onClick={handleToggleDocumentRail}>
              {isDocumentRailCollapsed ? 'Show Documents' : 'Hide Documents'}
            </button>
          </>
        }
      />
      <input
        ref={importInputRef}
        type='file'
        accept='.docx,.txt,.md,.markdown,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        className={styles.hiddenInput}
        multiple
        onChange={editor.handleImport}
      />

      <RouteFeedback feedback={feedback} onClear={() => setFeedback(null)} />
      {batchImportFiles && activeProject ? (
        <SourceNoteBatchImportDialog
          files={batchImportFiles}
          projectId={activeProject.id}
          documents={documents}
          linkTargets={data.linkableTargets}
          ragService={data.ragService}
          onOpen={(id) => {
            const target = documents.find((document) => document.id === id);
            if (target) editor.beginEdit(target);
            setBatchImportFiles(null);
          }}
          onClose={() => setBatchImportFiles(null)}
          onFinished={() => void health.refreshProjectContextHealth()}
        />
      ) : null}

      <SourceNoteStarterPanel
        isImporting={editor.isImporting}
        onStartWriting={editor.focusLoreEditor}
        onImport={editor.handleImportClick}
      />

      <div
        className={`${styles.layout} ${
          isDocumentRailCollapsed ? styles.layoutRailCollapsed : ''
        }`}
      >
        {!isDocumentRailCollapsed && (
        <SourceNoteDocumentList
          documents={documents}
          linksByDocumentId={linksByDocumentId}
          pendingCountByDocumentId={(id) => (entityProposalsByDocumentId.get(id)?.length ?? 0) + (proposalsByDocumentId.get(id)?.length ?? 0)}
          acceptedCountByDocumentId={(id) => data.canonicalFactsByDocumentId.get(id)?.length ?? 0}
          saving={editor.saving}
          deletingId={editor.deletingId}
          onEdit={editor.beginEdit}
          onDelete={(document) => void editor.handleDelete(document)}
        />
        )}
        <div className={styles.editorStack}>
          <SourceNoteEditorForm
            editor={editor}
            titleInputRef={titleInputRef}
            linkableTargets={data.linkableTargets}
            extractingId={review.extractingId}
            onExtract={(document) => void review.handleExtractFacts(document)}
          />

          {editor.editingDocument ? <SourceNoteExtractionReview review={review} /> : null}
        </div>

      </div>

      <SourceNoteContextHealthPanel
        projectId={activeProject.id}
        health={health}
        counts={{
          sourceNotes: documents.length,
          acceptedFacts: data.canonicalFacts.length,
          worldRecords: data.entities.length,
          characters: data.characters.length
        }}
      />

      {confirmDialog}
    </section>
  );
}

export default LoreRoute;
