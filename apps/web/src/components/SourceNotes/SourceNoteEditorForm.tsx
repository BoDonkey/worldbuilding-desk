import type {RefObject} from 'react';
import type {LoreDocument, LoreDocumentLink} from '../../entityTypes';
import type {LinkDraft, SourceNoteEditorState} from '../../hooks/useSourceNoteEditor';
import type {SourceNotesData} from '../../hooks/useSourceNotesData';
import {SourceNoteContentField} from './SourceNoteContentField';
import styles from '../../styles/LoreRoute.module.css';

const RELATIONSHIP_OPTIONS: Array<{
  value: LoreDocumentLink['relationship'];
  label: string;
}> = [
  {value: 'primary_subject', label: 'Primary subject'},
  {value: 'secondary_subject', label: 'Additional subject'},
  {value: 'mentions', label: 'Mentioned record'},
  {value: 'supports', label: 'Supporting source'}
];

interface SourceNoteEditorFormProps {
  editor: SourceNoteEditorState;
  titleInputRef: RefObject<HTMLInputElement | null>;
  linkableTargets: SourceNotesData['linkableTargets'];
  extractingId: string | null;
  onExtract: (document: LoreDocument) => void;
}

/** The form for writing or editing one Source Note and its context links. */
export function SourceNoteEditorForm({
  editor,
  titleInputRef,
  linkableTargets,
  extractingId,
  onExtract
}: SourceNoteEditorFormProps) {
  const {
    editingId,
    editingDocument,
    hasUnsavedEditorChanges,
    title,
    setTitle,
    content,
    setContent,
    draftFormat,
    setDraftFormat,
    contentView,
    setContentView,
    linkDrafts,
    addLinkDraft,
    updateLinkDraft,
    removeLinkDraft,
    saving,
    deletingId,
    resetForm,
    handleSubmit,
    handleDelete
  } = editor;

  return (
    <form
      id='lore-document-editor'
      className={styles.editorCard}
      onSubmit={handleSubmit}
    >
      <div className={styles.cardHeader}>
        <h2>{editingId ? 'Edit Source Note' : 'New Source Note'}</h2>
        <div className={styles.inlineActions}>
          {editingDocument ? (
            <button
              type='button'
              onClick={() => onExtract(editingDocument)}
              disabled={
                extractingId === editingDocument.id || hasUnsavedEditorChanges
              }
            >
              {extractingId === editingDocument.id
                ? 'Extracting...'
                : 'Extract Candidates'}
            </button>
          ) : null}
          {editingDocument ? (
            <button
              type='button'
              className={styles.dangerButton}
              onClick={() => void handleDelete(editingDocument)}
              disabled={deletingId === editingDocument.id}
            >
              {deletingId === editingDocument.id ? 'Deleting...' : 'Delete Source Note'}
            </button>
          ) : null}
          {editingId ? (
            <button type='button' onClick={resetForm}>
              Start Another Note
            </button>
          ) : null}
        </div>
      </div>

      <label className={styles.fieldLabel}>
        Title
        <input
          ref={titleInputRef}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>

      <div className={styles.linkSection}>
        <div className={styles.subsectionHeader}>
          <h3>Document context links</h3>
          <button type='button' onClick={addLinkDraft}>
            Add context link
          </button>
        </div>
        <p className={styles.subsectionCopy}>
          These saved links help retrieval and proposal targeting. They do not
          accept facts as canon or create relationships between World Bible
          records. Only one link can be the primary subject; extraction uses it
          as the fallback target. Candidate suggestions remain in review until
          you explicitly accept them.
        </p>
        {editingDocument ? (
          <p className={styles.subsectionCopy}>
            {hasUnsavedEditorChanges
              ? 'Save changes before extracting again; extraction uses the last saved text and links.'
              : 'This note is saved and ready to extract.'}
          </p>
        ) : null}
        {linkDrafts.length === 0 ? (
          <p className={styles.emptyHint}>This will save as a general Source Note.</p>
        ) : null}
        {linkDrafts.map((draft, index) => (
          <div key={`${draft.targetType}-${draft.targetId}-${index}`} className={styles.linkRow}>
            <select
              value={`${draft.targetType}:${draft.targetId}`}
              aria-label={`Context link ${index + 1} record`}
              onChange={(event) => {
                const [nextType, nextId] = event.target.value.split(':');
                updateLinkDraft(index, {
                  targetType: nextType as LinkDraft['targetType'],
                  targetId: nextId
                });
              }}
            >
              <option value={`${draft.targetType}:`}>Select target</option>
              {linkableTargets.map((target) => (
                <option key={target.key} value={`${target.targetType}:${target.targetId}`}>
                  {target.label}
                </option>
              ))}
            </select>
            <select
              value={draft.relationship}
              aria-label={`Context link ${index + 1} purpose`}
              onChange={(event) =>
                updateLinkDraft(index, {
                  relationship: event.target.value as LoreDocumentLink['relationship']
                })
              }
            >
              {RELATIONSHIP_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button type='button' onClick={() => removeLinkDraft(index)}>
              Remove
            </button>
          </div>
        ))}
      </div>

      <SourceNoteContentField
        content={content}
        format={draftFormat}
        view={contentView}
        onViewChange={setContentView}
        onChange={setContent}
        onFormatChange={setDraftFormat}
      />

      <div className={styles.formActions}>
        <button type='submit' disabled={saving || !title.trim() || !content.trim()}>
          {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Source Note'}
        </button>
      </div>
    </form>
  );
}
