import {useCallback} from 'react';
import type {Dispatch, SetStateAction} from 'react';
import type {
  CharacterSheet,
  StatBlockInsertMode,
  StatBlockScopePreset,
  StatBlockSourceType,
  StatBlockStyle,
  WorldEntity
} from '../entityTypes';
import {parseStatBlockToken} from '../utils/statBlockTemplates';
import type {ParsedStatBlockToken} from '../utils/statBlockTemplates';
import {inferScopePresetFromSelection, type StatBlockTokenMatch} from '../services/workspace/statBlockResolution';

type FeedbackState = {
  tone: 'success' | 'error';
  message: string;
} | null;

/**
 * Opening the stat-block modal to rebind a scene token, and the status shown
 * when an author clicks a token. Split from useWorkspaceStatBlocks (3.22).
 */
export const useStatBlockRebind = (params: {
  characterSheets: CharacterSheet[];
  entities: WorldEntity[];
  resolveTokenMatch: (token: ParsedStatBlockToken) => StatBlockTokenMatch;
  setFeedback: Dispatch<SetStateAction<FeedbackState>>;
  setPendingStatBlockRebindToken: Dispatch<SetStateAction<string | null>>;
  setStatBlockSourceType: Dispatch<SetStateAction<StatBlockSourceType>>;
  setStatBlockStyle: Dispatch<SetStateAction<StatBlockStyle>>;
  setStatBlockInsertMode: Dispatch<SetStateAction<StatBlockInsertMode>>;
  setStatBlockModalOpen: Dispatch<SetStateAction<boolean>>;
  setStatBlockScopePreset: Dispatch<SetStateAction<StatBlockScopePreset>>;
  setSelectedStatCharacterId: Dispatch<SetStateAction<string>>;
  setSelectedStatEntityId: Dispatch<SetStateAction<string>>;
  setSelectedStatIds: Dispatch<SetStateAction<string[]>>;
  setSelectedResourceIds: Dispatch<SetStateAction<string[]>>;
  setSelectedStatGroupId: Dispatch<SetStateAction<string>>;
}) => {
  const {
    characterSheets,
    entities,
    resolveTokenMatch,
    setFeedback,
    setPendingStatBlockRebindToken,
    setStatBlockSourceType,
    setStatBlockStyle,
    setStatBlockInsertMode,
    setStatBlockModalOpen,
    setStatBlockScopePreset,
    setSelectedStatCharacterId,
    setSelectedStatEntityId,
    setSelectedStatIds,
    setSelectedResourceIds,
    setSelectedStatGroupId
  } = params;

  const openStatBlockRebind = useCallback(
    (rawToken: string) => {
      const parsed = parseStatBlockToken(rawToken);
      if (!parsed) {
        setFeedback({
          tone: 'error',
          message: 'This stat block token could not be parsed.'
        });
        return;
      }

      setPendingStatBlockRebindToken(rawToken);
      setStatBlockSourceType(parsed.sourceType);
      setStatBlockStyle(parsed.style);
      setStatBlockInsertMode('template');
      setStatBlockModalOpen(true);

      if (parsed.sourceType === 'character') {
        const matchingSheet =
          characterSheets.find((sheet) => sheet.id === parsed.sourceRef) ??
          characterSheets.find(
            (sheet) => sheet.name.trim().toLowerCase() === (parsed.label ?? parsed.sourceRef).trim().toLowerCase()
          );
        if (matchingSheet) {
          setSelectedStatCharacterId(matchingSheet.id);
        }
        setSelectedStatIds(parsed.selectedStatIds ?? []);
        setSelectedResourceIds(parsed.selectedResourceIds ?? []);
        setStatBlockScopePreset(
          inferScopePresetFromSelection({
            selectedStatIds: parsed.selectedStatIds,
            selectedResourceIds: parsed.selectedResourceIds
          })
        );
        setSelectedStatGroupId('');
      } else {
        const matchingEntity =
          entities.find((entity) => entity.id === parsed.sourceRef) ??
          entities.find(
            (entity) => entity.name.trim().toLowerCase() === (parsed.label ?? parsed.sourceRef).trim().toLowerCase()
          );
        if (matchingEntity) {
          setSelectedStatEntityId(matchingEntity.id);
        }
      }
    },
    [
      characterSheets,
      entities,
      setFeedback,
      setPendingStatBlockRebindToken,
      setSelectedResourceIds,
      setSelectedStatCharacterId,
      setSelectedStatEntityId,
      setSelectedStatGroupId,
      setSelectedStatIds,
      setStatBlockInsertMode,
      setStatBlockModalOpen,
      setStatBlockScopePreset,
      setStatBlockSourceType,
      setStatBlockStyle
    ]
  );

  const handleStatBlockTokenClick = useCallback(
    (rawToken: string) => {
      const parsed = parseStatBlockToken(rawToken);
      if (!parsed) {
        setFeedback({
          tone: 'error',
          message: 'This stat block token could not be parsed.'
        });
        return;
      }
      const resolution = resolveTokenMatch(parsed);
      if (resolution.status === 'resolved') {
        setFeedback({
          tone: 'success',
          message: `Stat block token is bound to ${resolution.matchName}.`
        });
        return;
      }
      if (resolution.status === 'ambiguous') {
        openStatBlockRebind(rawToken);
        setFeedback({
          tone: 'error',
          message: `Stat block token is ambiguous. Choose the correct source to rebind it. Matching records: ${resolution.candidates.join(', ')}.`
        });
        return;
      }
      openStatBlockRebind(rawToken);
      setFeedback({
        tone: 'error',
        message: `Stat block token source is missing. Choose a new ${parsed.sourceType} source to rebind it.`
      });
    },
    [openStatBlockRebind, resolveTokenMatch, setFeedback]
  );

  return {openStatBlockRebind, handleStatBlockTokenClick};
};
