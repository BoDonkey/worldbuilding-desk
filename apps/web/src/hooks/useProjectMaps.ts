import {useCallback, useEffect, useMemo, useState} from 'react';
import type {UnitConversion, WorldMap} from '../entityTypes';
import {
  deleteMap,
  getMapsByProject,
  MAPS_CHANGED_EVENT,
  saveMap
} from '../services/storage';
import {
  mapsById,
  normalizeMapInput,
  normalizeUnitConversions,
  type MapInput
} from '../services/worldBible/maps';
import {useAppStore} from '../store/appStore';

/**
 * The active project's maps and unit conversions (slice 4.79). Every save
 * goes through `services/worldBible/maps.ts`; the methods return an error
 * message the author can act on, or null. Each copy of this hook reloads
 * when any of them saves, so the Maps panel and an open record agree.
 */
export function useProjectMaps() {
  const activeProject = useAppStore((s) => s.activeProject);
  const projectSettings = useAppStore((s) => s.projectSettings);
  const saveProjectSettings = useAppStore((s) => s.saveProjectSettings);
  const projectId = activeProject?.id ?? null;
  const [maps, setMaps] = useState<WorldMap[]>([]);

  useEffect(() => {
    if (!projectId) {
      setMaps([]);
      return;
    }
    let cancelled = false;
    const load = () => {
      void getMapsByProject(projectId).then((next) => {
        if (!cancelled) setMaps(next);
      });
    };
    load();
    window.addEventListener(MAPS_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(MAPS_CHANGED_EVENT, load);
    };
  }, [projectId]);

  const byId = useMemo(() => mapsById(maps), [maps]);
  const conversions = useMemo(
    () => normalizeUnitConversions(projectSettings?.unitConversions),
    [projectSettings?.unitConversions]
  );

  const saveMapInput = useCallback(
    async (input: MapInput): Promise<string | null> => {
      if (!projectId) return 'Open a project first.';
      const result = normalizeMapInput({input, projectId, maps: byId, now: Date.now()});
      if ('error' in result) return result.error;
      await saveMap(result.map);
      return null;
    },
    [byId, projectId]
  );

  const removeMap = useCallback(
    async (mapId: string) => {
      if (projectId) await deleteMap(projectId, mapId);
    },
    [projectId]
  );

  const saveConversions = useCallback(
    async (next: UnitConversion[]): Promise<string | null> => {
      if (!projectSettings) return 'Project settings are still loading.';
      await saveProjectSettings({...projectSettings, unitConversions: normalizeUnitConversions(next)});
      return null;
    },
    [projectSettings, saveProjectSettings]
  );

  return {maps, mapsById: byId, conversions, saveMapInput, removeMap, saveConversions};
}
