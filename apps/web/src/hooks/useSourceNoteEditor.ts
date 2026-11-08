import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {ChangeEvent, FormEvent, RefObject} from 'react';
import {useLocation, useNavigate} from 'react-router';
import type {
  LoreDocument,
  LoreDocumentFormat,
  LoreDocumentKind,
  LoreDocumentLink,
  Project
} from '../entityTypes';
import {
  deleteLoreDocument,
  replaceLoreDocumentLinks,
  replaceLoreEntityProposals,
  replaceLoreFactProposals,
  saveLoreDocument
} from '../services/storage';
import {parseLoreImport} from '../services/lore/loreImport';
import {normalizeLoreDocumentLinks} from '../services/lore/loreDocumentLinks';
import {summarizeContent} from '../services/lore/sourceNoteCapture';
import {resolveSourceNoteFormat} from '../services/lore/sourceNoteFormat';
import {indexSourceNote} from '../services/lore/sourceNoteBatchImport';
import {getRAGService} from '../services/rag/getRAGService';
import {describeError} from '../services/errors';
import type {SourceNoteContentView} from '../components/SourceNotes/SourceNoteContentField';
import type {ConfirmRequest} from './useConfirmDialog';
import type {SetSourceNoteFeedback, SourceNotesData} from './useSourceNotesData';

export type LinkDraft = {
  targetType: 'character' | 'entity';
  targetId: string;
  relationship: LoreDocumentLink['relationship'];
};

const getLinkDraftKey = (draft: LinkDraft): string =>
  `${draft.targetType}:${draft.targetId}:${draft.relationship}`;

/**
 * The Source Note editor: the note being written or edited, its context
 * links, importing a file into it, and saving or deleting it.
 */
export function useSourceNoteEditor(params: {
  activeProject: Project | null;
  data: SourceNotesData;
  setFeedback: SetSourceNoteFeedback;
  requestConfirm: (request: ConfirmRequest) => void;
  refreshContextHealth: () => Promise<void>;
  /** Called whenever the editor starts over on a note (new or edit). */
  onEditorReset: () => void;
  /** The hidden file input and the title field, owned by the route's markup. */
  importInputRef: RefObject<HTMLInputElement | null>;
  titleInputRef: RefObject<HTMLInputElement | null>;
}) {
  const {
    activeProject,
    data,
    setFeedback,
    requestConfirm,
    refreshContextHealth,
    onEditorReset,
    importInputRef,
    titleInputRef
  } = params;
  const {documents, linksByDocumentId, ragService} = data;
  const location = useLocation();
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<LoreDocumentKind>('general_lore');
  const [content, setContent] = useState('');
  const [draftFormat, setDraftFormat] = useState<LoreDocumentFormat>('markdown');
  const [contentView, setContentView] = useState<SourceNoteContentView | null>(null);
  const [draftSource, setDraftSource] = useState<LoreDocument['source']>({type: 'manual'});
  const [linkDrafts, setLinkDrafts] = useState<LinkDraft[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [batchImportFiles, setBatchImportFiles] = useState<File[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const focusedLoreDocumentKeyRef = useRef<string | null>(null);
  // Bumped whenever the editor starts over (new, edit, import) so a save that
  // finishes late does not clear a form the author has since moved on to.
  const formSessionRef = useRef(0);

  const editingDocument = useMemo(
    () => documents.find((document) => document.id === editingId) ?? null,
    [documents, editingId]
  );

  const hasUnsavedEditorChanges = useMemo(() => {
    if (!editingDocument) return false;
    const savedLinks = (linksByDocumentId.get(editingDocument.id) ?? [])
      .map((link) => getLinkDraftKey(link))
      .sort();
    const draftLinks = linkDrafts
      .filter((draft) => draft.targetId)
      .map(getLinkDraftKey)
      .sort();
    return (
      title !== editingDocument.title ||
      kind !== editingDocument.kind ||
      content !== editingDocument.content ||
      JSON.stringify(savedLinks) !== JSON.stringify(draftLinks)
    );
  }, [content, editingDocument, kind, linkDrafts, linksByDocumentId, title]);

  const indexLoreDocument = async (document: LoreDocument, links: LoreDocumentLink[]) => // A save can beat the service load.
    indexSourceNote(ragService ?? (activeProject && (await getRAGService({projectId: activeProject.id, inheritFromParent: activeProject.inheritRag, parentProjectId: activeProject.parentProjectId}))), document, links);

  const deleteLoreRagDocument = async (documentId: string) => {
    if (!ragService) return;
    await ragService.deleteDocument(`lore:${documentId}`);
  };

  const loadDraftContent = (nextContent: string, format: LoreDocumentFormat) => {
    setContent(nextContent);
    setDraftFormat(format);
    setContentView(null);
  };

  const resetForm = () => {
    formSessionRef.current += 1;
    setEditingId(null);
    setTitle('');
    setKind('general_lore');
    loadDraftContent('', 'markdown');
    setDraftSource({type: 'manual'});
    setLinkDrafts([]);
    onEditorReset();
  };

  const beginEdit = useCallback((document: LoreDocument) => {
    formSessionRef.current += 1;
    setEditingId(document.id);
    setTitle(document.title);
    setKind(document.kind);
    loadDraftContent(document.content, resolveSourceNoteFormat(document));
    setDraftSource(document.source);
    setLinkDrafts(
      (linksByDocumentId.get(document.id) ?? []).map((link) => ({
        targetType: link.targetType,
        targetId: link.targetId,
        relationship: link.relationship
      }))
    );
    onEditorReset();
    setFeedback(null);
  }, [linksByDocumentId, onEditorReset, setFeedback]);

  useEffect(() => {
    const state = location.state as {focusLoreDocumentId?: string} | null;
    const focusLoreDocumentId = state?.focusLoreDocumentId;
    if (!focusLoreDocumentId) return;
    const focusKey = `${location.key}:${focusLoreDocumentId}`;
    if (focusedLoreDocumentKeyRef.current === focusKey) return;
    const target = documents.find((document) => document.id === focusLoreDocumentId);
    if (!target) return;
    beginEdit(target);
    focusedLoreDocumentKeyRef.current = focusKey;
    navigate(location.pathname, {replace: true, state: {}});
  }, [beginEdit, documents, location.key, location.pathname, location.state, navigate]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeProject || !title.trim() || !content.trim()) return;

    setSaving(true);
    setFeedback(null);
    const now = Date.now();
    const existing = editingId
      ? documents.find((document) => document.id === editingId) ?? null
      : null;
    const documentId = editingId ?? crypto.randomUUID();
    const nextDocument: LoreDocument = {
      id: documentId,
      projectId: activeProject.id,
      title: title.trim(),
      kind,
      format: draftFormat,
      content: content.trim(),
      summary: summarizeContent(content),
      source: existing?.source ?? draftSource,
      status: 'active',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };

    const nextLinks = normalizeLoreDocumentLinks(
      linkDrafts.map((draft) => ({
        id: crypto.randomUUID(),
        projectId: activeProject.id,
        loreDocumentId: documentId,
        targetType: draft.targetType,
        targetId: draft.targetId,
        relationship: draft.relationship,
        createdAt: now
      }))
    );

    const formSession = formSessionRef.current;
    try {
      await saveLoreDocument(nextDocument);
      await replaceLoreDocumentLinks({loreDocumentId: documentId, links: nextLinks});
      await indexLoreDocument(nextDocument, nextLinks);
      await refreshContextHealth();
      if (formSessionRef.current === formSession) {
        resetForm();
      }
      const placementMessage =
        nextLinks.length > 0
          ? `Linked to ${nextLinks.length} canon target${nextLinks.length === 1 ? '' : 's'}.`
          : 'Saved as general project source material.';
      setFeedback({
        tone: 'success',
        message: `${editingId ? 'Source Note updated.' : 'Source Note created.'} ${placementMessage}`
      });
    } catch (error) {
      const message =
        describeError(error, 'Unable to save lore document.');
      setFeedback({tone: 'error', message});
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (document: LoreDocument) => {
    requestConfirm({
      title: `Delete Source Note "${document.title}"?`,
      message: 'This removes the note and any lore/fact proposals extracted from it.',
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        setDeletingId(document.id);
        setFeedback(null);
        try {
          await deleteLoreDocument(document.id);
          await replaceLoreEntityProposals({
            projectId: document.projectId,
            loreDocumentId: document.id,
            proposals: []
          });
          await replaceLoreFactProposals({
            projectId: document.projectId,
            loreDocumentId: document.id,
            proposals: []
          });
          await deleteLoreRagDocument(document.id);
          await refreshContextHealth();
          if (editingId === document.id) {
            resetForm();
          }
          setFeedback({tone: 'success', message: 'Source Note deleted.'});
        } catch (error) {
          const message =
            describeError(error, 'Unable to delete Source Note.');
          setFeedback({tone: 'error', message});
        } finally {
          setDeletingId(null);
        }
      }
    });
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const [file] = files;
    event.target.value = '';
    if (!file || !activeProject) return;
    // Several files save straight to Source Notes; one file still loads into the form for review.
    if (files.length > 1) return setBatchImportFiles(files);

    setIsImporting(true);
    setFeedback(null);
    try {
      const parsed = await parseLoreImport(file);
      formSessionRef.current += 1;
      setEditingId(null);
      setTitle(parsed.title);
      setKind('general_lore');
      loadDraftContent(parsed.content, parsed.format);
      setDraftSource({
        type: 'import',
        fileName: parsed.fileName,
        mimeType: parsed.mimeType
      });
      setLinkDrafts([]);
      setFeedback({
        tone: 'success',
        message: `Imported "${parsed.fileName}". Add document context links if useful, then save the Source Note.`
      });
    } catch (error) {
      const message =
        describeError(error, 'Unable to import lore file.');
      setFeedback({tone: 'error', message});
    } finally {
      setIsImporting(false);
    }
  };

  const updateLinkDraft = (index: number, next: Partial<LinkDraft>) => {
    setLinkDrafts((current) => {
      const updated = current.map((draft, draftIndex) =>
        draftIndex === index ? {...draft, ...next} : draft
      );
      if (next.relationship !== 'primary_subject') return updated;
      return updated.map((draft, draftIndex) =>
        draftIndex !== index && draft.relationship === 'primary_subject'
          ? {...draft, relationship: 'secondary_subject'}
          : draft
      );
    });
  };

  const addLinkDraft = () => {
    setLinkDrafts((current) => [
      ...current,
      {
        targetType: 'entity',
        targetId: '',
        relationship: current.some((draft) => draft.relationship === 'primary_subject')
          ? 'secondary_subject'
          : 'primary_subject'
      }
    ]);
  };

  const removeLinkDraft = (index: number) => {
    setLinkDrafts((current) => current.filter((_, draftIndex) => draftIndex !== index));
  };

  const focusLoreEditor = () => {
    document.getElementById('lore-document-editor')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
    window.setTimeout(() => titleInputRef.current?.focus(), 120);
  };

  return {
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
    isImporting,
    batchImportFiles,
    setBatchImportFiles,
    saving,
    deletingId,
    resetForm,
    beginEdit,
    handleSubmit,
    handleDelete,
    handleImportClick,
    handleImport,
    focusLoreEditor
  };
}

export type SourceNoteEditorState = ReturnType<typeof useSourceNoteEditor>;
