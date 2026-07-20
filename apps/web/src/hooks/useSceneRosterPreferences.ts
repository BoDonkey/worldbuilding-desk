import {useCallback, useEffect, useState} from 'react';
import {
  EMPTY_SCENE_ROSTER_OVERRIDES,
  parseSceneRosterPreferences,
  updateSceneRosterOverride,
  type SceneRosterOverrides,
  type SceneRosterPreferences
} from '../services/workspace/sceneRoster';

const storageKey = (projectId: string): string => `sceneRosterPreferences:${projectId}`;

export function useSceneRosterPreferences(projectId: string | null) {
  const [preferences, setPreferences] = useState<SceneRosterPreferences>(() =>
    parseSceneRosterPreferences(null)
  );
  const [hydratedProjectId, setHydratedProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setPreferences(parseSceneRosterPreferences(null));
      setHydratedProjectId(null);
      return;
    }
    setPreferences(parseSceneRosterPreferences(localStorage.getItem(storageKey(projectId))));
    setHydratedProjectId(projectId);
  }, [projectId]);

  useEffect(() => {
    if (!projectId || hydratedProjectId !== projectId) return;
    localStorage.setItem(storageKey(projectId), JSON.stringify(preferences));
  }, [hydratedProjectId, preferences, projectId]);

  const getOverrides = useCallback(
    (sceneId: string | null): SceneRosterOverrides =>
      sceneId
        ? preferences.bySceneId[sceneId] ?? EMPTY_SCENE_ROSTER_OVERRIDES
        : EMPTY_SCENE_ROSTER_OVERRIDES,
    [preferences]
  );

  const updateOverride = useCallback(
    (sceneId: string, candidateKey: string, action: 'pin' | 'hide' | 'reset') => {
      setPreferences((current) =>
        updateSceneRosterOverride({
          preferences: current,
          sceneId,
          candidateKey,
          action
        })
      );
    },
    []
  );

  return {getOverrides, updateOverride};
}
