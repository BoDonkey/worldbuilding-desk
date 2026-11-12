import {useCallback, useMemo, useState} from 'react';
import type {
  EntityCategory,
  Project,
  ProjectSettings,
  StateMutationEvent,
  WorldEntity
} from '../entityTypes';
import {
  saveEntity,
  saveStateMutationEvents,
  type ConsistencyAlias
} from '../services/storage';
import {isLocationCategory} from '../services/worldBible/worldBibleEntityPlans';
import {
  buildPlaceNameIndex,
  findUnlinkedPlaceNames,
  linkPlaceName,
  type UnlinkedPlaceName
} from '../services/worldBible/placePositions';
import {describeError} from '../services/errors';

interface FeedbackState {
  tone: 'success' | 'error';
  message: string;
}

/**
 * The World Bible queue of positions that name no place record (slice 4.77):
 * link a name to an existing place, create a place for it, or keep it as
 * text. Each choice is the author's; nothing is linked by guessing.
 */
export function useUnlinkedPlacePositions(params: {
  activeProject: Project | null;
  projectSettings: ProjectSettings | null;
  saveProjectSettings: (settings: ProjectSettings) => Promise<ProjectSettings>;
  categories: EntityCategory[];
  entities: WorldEntity[];
  aliases: ConsistencyAlias[];
  stateMutationEvents: StateMutationEvent[];
  setFeedback: (feedback: FeedbackState | null) => void;
}) {
  const {
    activeProject, projectSettings, saveProjectSettings, categories, entities, aliases,
    stateMutationEvents, setFeedback
  } = params;
  const [resolvingKey, setResolvingKey] = useState<string | null>(null);
  const index = useMemo(
    () => buildPlaceNameIndex({categories, entities, aliases}),
    [aliases, categories, entities]
  );
  const places = useMemo(
    () => [...index.places.values()].sort((a, b) => a.name.localeCompare(b.name)),
    [index]
  );
  const queue = useMemo(
    () => findUnlinkedPlaceNames({
      events: stateMutationEvents,
      index,
      keptAsText: projectSettings?.placeNamesKeptAsText
    }),
    [index, projectSettings?.placeNamesKeptAsText, stateMutationEvents]
  );

  const run = useCallback(
    async (key: string, action: () => Promise<string>, failure: string) => {
      setResolvingKey(key);
      setFeedback(null);
      try {
        setFeedback({tone: 'success', message: await action()});
      } catch (error) {
        setFeedback({tone: 'error', message: describeError(error, failure)});
      } finally {
        setResolvingKey(null);
      }
    },
    [setFeedback]
  );

  const linkToPlace = useCallback(
    (item: UnlinkedPlaceName, placeId: string) =>
      run(item.key, async () => {
        const changed = linkPlaceName({
          events: stateMutationEvents,
          key: item.key,
          placeId,
          places: index.places
        });
        await saveStateMutationEvents(changed);
        const placeName = index.places.get(placeId)?.name ?? 'the place';
        return `Linked ${item.positionCount === 1 ? 'one position' : `${item.positionCount} positions`} written as "${item.name}" to ${placeName}.`;
      }, 'Unable to link these positions.'),
    [index.places, run, stateMutationEvents]
  );

  const createPlace = useCallback(
    (item: UnlinkedPlaceName) =>
      run(item.key, async () => {
        if (!activeProject) throw new Error('Open a project first.');
        const category = categories.find(isLocationCategory);
        if (!category) throw new Error('Mark or create a World Bible category as Locations first.');
        const now = Date.now();
        const place: WorldEntity = {
          id: crypto.randomUUID(),
          projectId: activeProject.id,
          categoryId: category.id,
          name: item.name,
          fields: {},
          links: [],
          needsCompletion: true,
          isNew: true,
          createdAt: now,
          updatedAt: now
        };
        await saveEntity(place);
        await saveStateMutationEvents(linkPlaceName({
          events: stateMutationEvents,
          key: item.key,
          placeId: place.id,
          places: new Map([...index.places, [place.id, place]])
        }));
        return `Created the place "${item.name}" and linked its positions to it.`;
      }, 'Unable to create this place.'),
    [activeProject, categories, index.places, run, stateMutationEvents]
  );

  const keepAsText = useCallback(
    (item: UnlinkedPlaceName) =>
      run(item.key, async () => {
        if (!projectSettings) throw new Error('Project settings are still loading.');
        const kept = new Set(projectSettings.placeNamesKeptAsText ?? []);
        kept.add(item.key);
        await saveProjectSettings({...projectSettings, placeNamesKeptAsText: [...kept].sort()});
        return `"${item.name}" stays as text.`;
      }, 'Unable to keep this name as text.'),
    [projectSettings, run, saveProjectSettings]
  );

  return {queue, places, resolvingKey, linkToPlace, createPlace, keepAsText};
}

export type UnlinkedPlacePositions = ReturnType<typeof useUnlinkedPlacePositions>;
