import {useCallback, useEffect, useRef, useState} from 'react';
import {buildCharacterExportChoices, type CharacterExportChoices} from '../../services/characters/characterExportChoices';
import {RECORDS_CHANGED} from '../../services/recordEvents';
import {
  getAliasesByProject,
  getCategoriesByProject,
  getCharacterSheetsByProject,
  getCharactersByProject,
  getEntitiesByProject
} from '../../services/storage';

const EMPTY: CharacterExportChoices = {choices: [], unlinked: []};
const EVENTS = [RECORDS_CHANGED.entity, RECORDS_CHANGED.alias, RECORDS_CHANGED.character, RECORDS_CHANGED.characterSheet];

/** The characters Character packages can export one by one, kept current as records change. */
export function useCharacterExportChoices(projectId: string | null, keptSeparateKeys: string[] | undefined) {
  const [state, setState] = useState<{status: 'loading' | 'ready' | 'error'; data: CharacterExportChoices}>(
    {status: 'loading', data: EMPTY}
  );
  const requestRef = useRef(0);
  const keptKey = (keptSeparateKeys ?? []).join('|');

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    if (!projectId) {
      setState({status: 'ready', data: EMPTY});
      return;
    }
    try {
      const [categories, entities, aliases, characters, sheets] = await Promise.all([
        getCategoriesByProject(projectId),
        getEntitiesByProject(projectId),
        getAliasesByProject(projectId),
        getCharactersByProject(projectId),
        getCharacterSheetsByProject(projectId)
      ]);
      if (request !== requestRef.current) return;
      setState({
        status: 'ready',
        data: buildCharacterExportChoices({
          projectId, categories, entities, aliases, characters, sheets,
          keptSeparateKeys: keptKey ? keptKey.split('|') : []
        })
      });
    } catch {
      if (request === requestRef.current) setState({status: 'error', data: EMPTY});
    }
  }, [keptKey, projectId]);

  useEffect(() => {
    void load();
    EVENTS.forEach((event) => window.addEventListener(event, load));
    return () => EVENTS.forEach((event) => window.removeEventListener(event, load));
  }, [load]);

  return state;
}
