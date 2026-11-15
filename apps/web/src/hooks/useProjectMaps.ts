import {useCallback, useEffect, useMemo, useState} from 'react';
import type {MapImage, UnitConversion, WorldEntity, WorldMap} from '../entityTypes';
import {
  deleteMap,
  getMapsByProject,
  saveEntity,
  saveMap
} from '../services/storage';
import {RECORDS_CHANGED} from '../services/recordEvents';
import {withPlacement} from '../services/worldBible/mapSurface';
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
    window.addEventListener(RECORDS_CHANGED.maps, load);
    return () => {
      cancelled = true;
      window.removeEventListener(RECORDS_CHANGED.maps, load);
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

  /** Sets or removes (null) a map's background image (slice 4.80). */
  const saveMapImage = useCallback(
    async (mapId: string, image: MapImage | null) => {
      const map = byId.get(mapId);
      if (!map) return;
      const next: WorldMap = {...map, updatedAt: Date.now()};
      if (image) next.image = image;
      else delete next.image;
      await saveMap(next);
    },
    [byId]
  );

  /** Pins a place at a point on a map, or unpins it (null). The author's action only. */
  const savePlacement = useCallback(
    async (place: WorldEntity, mapId: string, point: {x: number; y: number} | null) => {
      await saveEntity(withPlacement(place, mapId, point, Date.now()));
    },
    []
  );

  const saveConversions = useCallback(
    async (next: UnitConversion[]): Promise<string | null> => {
      if (!projectSettings) return 'Project settings are still loading.';
      await saveProjectSettings({...projectSettings, unitConversions: normalizeUnitConversions(next)});
      return null;
    },
    [projectSettings, saveProjectSettings]
  );

  return {maps, mapsById: byId, conversions, saveMapInput, removeMap, saveMapImage, savePlacement, saveConversions};
}
