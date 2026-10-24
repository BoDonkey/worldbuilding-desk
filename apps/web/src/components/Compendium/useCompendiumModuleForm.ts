import {useState} from 'react';
import type {SettlementModule, SettlementState} from '../../entityTypes';
import {saveSettlementModule, attachModuleToSettlement} from '../../services/storage';
import {parseModuleValue} from '../../services/compendium/compendiumFormValues';
import {describeError} from '../../services/errors';
import type {CompendiumFormContext, SetFormValue} from './formTypes';

interface Options extends CompendiumFormContext {
  settlementState: SettlementState | null;
  selectedSettlementLocationId: string;
  setSettlementModules: SetFormValue<SettlementModule[]>;
  setSettlementState: SetFormValue<SettlementState | null>;
}

export function useCompendiumModuleForm({
  activeProject,
  setFeedback,
  settlementState,
  selectedSettlementLocationId,
  setSettlementModules,
  setSettlementState
}: Options) {
  const [moduleName, setModuleName] = useState('');
  const [moduleSourceType, setModuleSourceType] =
    useState<SettlementModule['sourceType']>('trophy');
  const [moduleTargetType, setModuleTargetType] =
    useState<SettlementModule['effects'][number]['targetType']>('resistance');
  const [moduleTargetId, setModuleTargetId] = useState('poison');
  const [moduleOperation, setModuleOperation] =
    useState<SettlementModule['effects'][number]['operation']>('add');
  const [moduleValue, setModuleValue] = useState('5');
  const [isSavingModule, setIsSavingModule] = useState(false);
  const handleAddSettlementModule = async () => {
    if (!activeProject || !settlementState || !moduleName.trim()) return;
    setIsSavingModule(true);
    setFeedback(null);
    try {
      const normalizedValue = parseModuleValue(moduleValue);

      const module: SettlementModule = {
        id: crypto.randomUUID(),
        projectId: activeProject.id,
        name: moduleName.trim(),
        sourceType: moduleSourceType,
        auraRadiusMeters: 30,
        active: true,
        effects: [
          {
            targetType: moduleTargetType,
            targetId: moduleTargetId.trim() || 'custom',
            operation: moduleOperation,
            value: normalizedValue
          }
        ],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await saveSettlementModule(module);
      const nextState = await attachModuleToSettlement({
        projectId: activeProject.id,
        moduleId: module.id,
        sourceEntityId: selectedSettlementLocationId || undefined
      });
      setSettlementModules((prev) =>
        [...prev, module].sort((a, b) => a.name.localeCompare(b.name))
      );
      setSettlementState(nextState);
      setModuleName('');
      setModuleValue('5');
      setFeedback({tone: 'success', message: 'Settlement module added.'});
    } catch (error) {
      const message =
        describeError(error, 'Unable to add settlement module.');
      setFeedback({tone: 'error', message});
    } finally {
      setIsSavingModule(false);
    }
  };

  return {
    moduleName,
    setModuleName,
    moduleSourceType,
    setModuleSourceType,
    moduleTargetType,
    setModuleTargetType,
    moduleTargetId,
    setModuleTargetId,
    moduleOperation,
    setModuleOperation,
    moduleValue,
    setModuleValue,
    isSavingModule,
    handleAddSettlementModule
  };
}
