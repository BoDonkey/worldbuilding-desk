import {useEffect, useMemo, useRef} from 'react';
import type {Character, WorldEntity, WritingDocument} from '../entityTypes';
import type {ConsistencyAlias} from '../services/consistency/aliasStorage';

export const useWorkspaceReviewRefresh = (params: {
  selectedId: string | null;
  selectedDocument: WritingDocument | null;
  title: string;
  content: string;
  entities: WorldEntity[];
  aliases: ConsistencyAlias[];
  characters: Character[];
  isReviewPrefsHydrated: boolean;
  refreshDeferredReview: (document: WritingDocument) => Promise<unknown>;
  refreshActiveDraftReview: (document: WritingDocument) => Promise<unknown>;
}) => {
  const {
    selectedId, selectedDocument, title, content, entities, aliases, characters,
    isReviewPrefsHydrated, refreshDeferredReview, refreshActiveDraftReview
  } = params;
  const selectedDocumentRef = useRef(selectedDocument);
  const draftTitleRef = useRef(title);
  const draftContentRef = useRef(content);
  const lastIdleReviewSignatureRef = useRef<string | null>(null);
  useEffect(() => {
    selectedDocumentRef.current = selectedDocument;
    draftTitleRef.current = title;
    draftContentRef.current = content;
  }, [content, selectedDocument, title]);
  const reviewRefreshSignature = useMemo(
    () => [
      ...entities.map((entity) =>
        `entity:${entity.id}:${entity.name}:${entity.updatedAt}:${entity.needsCompletion ?? false}`
      ),
      ...aliases.map((alias) =>
        `alias:${alias.id}:${alias.targetId}:${alias.targetType}:${alias.alias}:${alias.updatedAt}`
      ),
      ...characters.map((character) =>
        `character:${character.id}:${character.name}:${character.updatedAt}`
      )
    ].sort().join('|'),
    [aliases, characters, entities]
  );

  useEffect(() => {
    if (!isReviewPrefsHydrated || !selectedId) return;
    const doc = selectedDocumentRef.current;
    if (!doc || doc.id !== selectedId) return;
    const draftTitle = draftTitleRef.current.trim() || doc.title || 'Untitled scene';
    const draftContent = draftContentRef.current;
    const draftDoc = draftTitle === doc.title && draftContent === doc.content
      ? doc
      : {...doc, title: draftTitle, content: draftContent, updatedAt: Date.now()};
    const refresh = draftDoc.consistencyReviewMode === 'deferred'
      ? refreshDeferredReview(draftDoc)
      : refreshActiveDraftReview(draftDoc);
    void refresh.catch((error) => {
      console.warn('Active scene review refresh failed', error);
    });
  }, [
    isReviewPrefsHydrated, refreshActiveDraftReview, refreshDeferredReview,
    reviewRefreshSignature, selectedId
  ]);

  useEffect(() => {
    if (!isReviewPrefsHydrated || !selectedId) return;
    const persistedDoc = selectedDocumentRef.current;
    if (!persistedDoc || persistedDoc.id !== selectedId) return;
    if (persistedDoc.consistencyReviewMode === 'deferred') return;
    const draftTitle = title.trim() || 'Untitled scene';
    if (persistedDoc.title === draftTitle && persistedDoc.content === content) {
      lastIdleReviewSignatureRef.current = null;
      return;
    }
    const draftSignature = `${selectedId}:${draftTitle}:${content}`;
    const timeoutId = window.setTimeout(() => {
      if (lastIdleReviewSignatureRef.current === draftSignature) return;
      lastIdleReviewSignatureRef.current = draftSignature;
      void refreshActiveDraftReview({
        ...persistedDoc, title: draftTitle, content, updatedAt: Date.now()
      }).catch((error) => {
        lastIdleReviewSignatureRef.current = null;
        console.warn('Idle draft review failed', error);
      });
    }, 2500);
    return () => clearTimeout(timeoutId);
  }, [content, isReviewPrefsHydrated, refreshActiveDraftReview, selectedId, title]);
};
