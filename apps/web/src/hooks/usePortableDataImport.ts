import {useEffect, useMemo, useRef, useState, type ChangeEvent} from 'react';
import type {EntityCategory, Project, WorldEntity} from '../entityTypes';
import type {ConsistencyAlias} from '../services/storage';
import {describeError} from '../services/errors';
import {parsePortableMarkdownFiles} from '../services/portability/portableData';
import {
  applyPortableImport,
  findPortableCategoryId,
  matchPortableEntity,
  type PortableImportDraft
} from '../services/portability/portableImport';
import type {WorldBibleIndexing} from '../services/worldBible/worldBibleRecordSave';

type Feedback = {tone: 'success' | 'error'; message: string};

/**
 * The portable Markdown folder import (3.45): staged drafts, the author's
 * choices on them, and applying the selection. PortableDataPanel renders it.
 */
export function usePortableDataImport(params: {
  project: Pick<Project, 'id'>;
  categories: EntityCategory[];
  categoriesLoaded: boolean;
  entities: WorldEntity[];
  aliases: ConsistencyAlias[];
  indexing: WorldBibleIndexing;
  onFeedback: (feedback: Feedback) => void;
}) {
  const {categories, entities, aliases, onFeedback} = params;
  const categoriesRef = useRef(categories);
  const [drafts, setDrafts] = useState<PortableImportDraft[]>([]);
  const [isReading, setIsReading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    categoriesRef.current = categories;
    if (categories.length === 0) return;
    setDrafts((current) => current.map((draft) => {
      if (categories.some((category) => category.id === draft.categoryId)) {
        return draft;
      }
      return {...draft, categoryId: findPortableCategoryId(draft, categories)};
    }));
  }, [categories]);

  const matchedEntities = useMemo(() => {
    const matches = new Map<string, WorldEntity>();
    drafts.forEach((draft) => {
      draft.wikilinks.forEach((name) => {
        const match = matchPortableEntity(name, entities, aliases);
        if (match) matches.set(`${draft.id}:${name}`, match);
      });
    });
    return matches;
  }, [drafts, aliases, entities]);

  const waitingForCategories =
    !params.categoriesLoaded &&
    drafts.some((draft) => draft.include && draft.destination === 'world-bible');

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
        categoryId: findPortableCategoryId(draft, categories),
        wikiLinkActions: Object.fromEntries(draft.wikilinks.map((link) => [link, 'ignore']))
      }));
      setDrafts(next);
      onFeedback({
        tone: 'success',
        message: `Staged ${next.length} Markdown file${next.length === 1 ? '' : 's'} for review. Nothing has been saved yet.`
      });
    } catch (error) {
      onFeedback({tone: 'error', message: describeError(error, 'Unable to read Markdown folder.')});
    } finally {
      setIsReading(false);
    }
  };

  const handleApply = async () => {
    const selected = drafts.filter((draft) => draft.include);
    if (selected.length === 0) {
      onFeedback({tone: 'error', message: 'Select at least one Markdown file to import.'});
      return;
    }
    setIsApplying(true);
    try {
      const {sourceNoteCount, worldBibleCount} = await applyPortableImport({
        drafts: selected,
        project: params.project,
        categoriesNow: () => categoriesRef.current,
        entities,
        aliases,
        matchedEntities,
        indexing: params.indexing
      });
      setDrafts([]);
      onFeedback({
        tone: 'success',
        message: `Imported ${sourceNoteCount} Source Note${sourceNoteCount === 1 ? '' : 's'} and ${worldBibleCount} World Bible draft${worldBibleCount === 1 ? '' : 's'}. Review drafts and extract Source Note candidates before accepting canon.`
      });
    } catch (error) {
      onFeedback({tone: 'error', message: describeError(error, 'Unable to import Markdown folder.')});
    } finally {
      setIsApplying(false);
    }
  };

  return {
    drafts,
    isReading,
    isApplying,
    matchedEntities,
    waitingForCategories,
    updateDraft,
    clearDrafts: () => setDrafts([]),
    handleFolder,
    handleApply
  };
}
