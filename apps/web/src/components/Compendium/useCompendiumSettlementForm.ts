import {useEffect, useMemo, useState} from 'react';
import type {SettlementState} from '../../entityTypes';
import {updateSettlementFortressLevel, updateSettlementBaseStats} from '../../services/compendium';
import {
  BASE_STAT_KEYS,
  toBaseStatsDraft,
  parseBaseStatsDraft,
  type BaseStatKey
} from '../../services/compendium/compendiumFormValues';
import {describeError} from '../../services/errors';
import type {CompendiumFormContext, SetFormValue} from './formTypes';

interface Options extends CompendiumFormContext {
  settlementState: SettlementState | null;
  setSettlementState: SetFormValue<SettlementState | null>;
}

export function useCompendiumSettlementForm({
  activeProject,
  setFeedback,
  settlementState,
  setSettlementState
}: Options) {
  const [selectedSettlementLocationId, setSelectedSettlementLocationId] = useState('');
  const [isSavingFortress, setIsSavingFortress] = useState(false);
  const [baseStatsDraft, setBaseStatsDraft] = useState<Record<BaseStatKey, string>>({
    defense: '10',
    storageCapacity: '100',
    craftingThroughput: '100',
    morale: '50'
  });
  useEffect(() => {
    if (!settlementState) return;
    setBaseStatsDraft(toBaseStatsDraft(settlementState.baseStats));
  }, [settlementState]);
  useEffect(() => {
    if (activeProject) return;
    setSelectedSettlementLocationId('');
    setBaseStatsDraft({defense: '10', storageCapacity: '100', craftingThroughput: '100', morale: '50'});
  }, [activeProject]);
  const isBaseStatsDraftDirty = useMemo(() => {
    if (!settlementState) return false;
    return BASE_STAT_KEYS.some(
      (key) => baseStatsDraft[key] !== String(settlementState.baseStats[key])
    );
  }, [baseStatsDraft, settlementState]);
  const handleAdjustFortressLevel = async (delta: number) => {
    if (!activeProject || !settlementState) return;
    const nextLevel = Math.max(1, settlementState.fortressLevel + delta);
    setIsSavingFortress(true);
    setFeedback(null);
    try {
      const nextState = await updateSettlementFortressLevel({
        projectId: activeProject.id,
        level: nextLevel,
        sourceEntityId: selectedSettlementLocationId || undefined
      });
      setSettlementState(nextState);
      setFeedback({
        tone: 'success',
        message: `Settlement tier level set to ${nextState.fortressLevel}.`
      });
    } catch (error) {
      const message =
        describeError(error, 'Unable to update settlement tier level.');
      setFeedback({tone: 'error', message});
    } finally {
      setIsSavingFortress(false);
    }
  };
  const handleBaseStatDraftChange = (statKey: BaseStatKey, value: string): void => {
    setBaseStatsDraft((prev) => ({
      ...prev,
      [statKey]: value
    }));
  };
  const handleResetBaseStatsDraft = (): void => {
    if (!settlementState) return;
    setBaseStatsDraft(toBaseStatsDraft(settlementState.baseStats));
  };
  const handleSaveBaseStats = async () => {
    if (!activeProject || !settlementState) return;
    const parsed = parseBaseStatsDraft(baseStatsDraft);
    if (parsed.error !== undefined) {
      setFeedback({tone: 'error', message: parsed.error});
      return;
    }
    const nextBaseStats = parsed.baseStats;

    setIsSavingFortress(true);
    setFeedback(null);
    try {
      const nextState = await updateSettlementBaseStats({
        projectId: activeProject.id,
        baseStats: nextBaseStats,
        sourceEntityId: selectedSettlementLocationId || undefined
      });
      setSettlementState(nextState);
      setBaseStatsDraft(toBaseStatsDraft(nextState.baseStats));
      setFeedback({tone: 'success', message: 'Base stats saved.'});
    } catch (error) {
      const message =
        describeError(error, 'Unable to update base stats.');
      setFeedback({tone: 'error', message});
    } finally {
      setIsSavingFortress(false);
    }
  };

  return {
    selectedSettlementLocationId,
    setSelectedSettlementLocationId,
    baseStatsDraft,
    isBaseStatsDraftDirty,
    isSavingFortress,
    handleAdjustFortressLevel,
    handleBaseStatDraftChange,
    handleResetBaseStatsDraft,
    handleSaveBaseStats
  };
}
