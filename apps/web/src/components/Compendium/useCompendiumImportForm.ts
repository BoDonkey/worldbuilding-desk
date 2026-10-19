import {useState} from 'react';
import type {
  CompendiumDomain,
  CompendiumMechanicKind,
  MechanicsProgressScope,
  CompendiumEntry,
  WorldEntity,
  ZoneAffinityProfile,
  SettlementState
} from '../../entityTypes';
import {
  upsertCompendiumEntryFromEntity,
  upsertZoneAffinityProfile,
  updateSettlementLocation
} from '../../services/compendium';
import {getDefaultActions, toBiomeKey} from '../../services/compendium/compendiumFormValues';
import {describeError} from '../../services/errors';
import type {CompendiumTab} from './constants';
import type {CompendiumFormContext, SetFormValue} from './formTypes';

interface Options extends CompendiumFormContext {
  worldEntityById: Map<string, WorldEntity>;
  activeMechanicsCharacterSheetId: string;
  setEntries: SetFormValue<CompendiumEntry[]>;
  setZoneProfiles: SetFormValue<ZoneAffinityProfile[]>;
  setSelectedZoneKey: SetFormValue<string>;
  setSelectedSettlementLocationId: SetFormValue<string>;
  setSettlementState: SetFormValue<SettlementState | null>;
  setShowAdvancedSetup: SetFormValue<boolean>;
  setActiveTab: SetFormValue<CompendiumTab>;
}

export function useCompendiumImportForm({
  activeProject,
  setFeedback,
  worldEntityById,
  activeMechanicsCharacterSheetId,
  setEntries,
  setZoneProfiles,
  setSelectedZoneKey,
  setSelectedSettlementLocationId,
  setSettlementState,
  setShowAdvancedSetup,
  setActiveTab
}: Options) {
  const [entityToImportId, setEntityToImportId] = useState('');
  const [importDomain, setImportDomain] = useState<CompendiumDomain>('beast');
  const [importMechanicKind, setImportMechanicKind] =
    useState<CompendiumMechanicKind>('discovery');
  const [importProgressScope, setImportProgressScope] =
    useState<MechanicsProgressScope>('character');
  const handleImportEntity = async () => {
    if (!activeProject || !entityToImportId) return;
    const entity = worldEntityById.get(entityToImportId);
    if (!entity) return;
    if (importProgressScope === 'character' && !activeMechanicsCharacterSheetId) {
      setFeedback({
        tone: 'error',
        message: 'Choose a character sheet before linking character-scoped mechanics.'
      });
      return;
    }
    setFeedback(null);
    try {
      const entry = await upsertCompendiumEntryFromEntity({
        projectId: activeProject.id,
        entity,
        domain: importDomain,
        defaultActions: getDefaultActions(importDomain),
        needsCompletion: entity.needsCompletion ?? false,
        mechanicKind: importMechanicKind,
        progressScope: importProgressScope
      });
      setEntries((prev) => {
        const idx = prev.findIndex((item) => item.id === entry.id);
        if (idx === -1) return [...prev, entry].sort((a, b) => a.name.localeCompare(b.name));
        const next = [...prev];
        next[idx] = entry;
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      if (importMechanicKind === 'zone') {
        const biomeKey = toBiomeKey(entity.name);
        const profile = await upsertZoneAffinityProfile({
          projectId: activeProject.id,
          biomeKey,
          name: entity.name,
          sourceEntityId: entity.id,
          progressScope: importProgressScope,
          maxAffinityPoints: 100,
          milestones: [
            {
              id: `${biomeKey}-25`,
              thresholdPercent: 25,
              name: '25% Affinity',
              description: 'Biome familiarity unlocked.'
            },
            {
              id: `${biomeKey}-50`,
              thresholdPercent: 50,
              name: '50% Affinity',
              description: 'Biome resistance unlocked.'
            },
            {
              id: `${biomeKey}-100`,
              thresholdPercent: 100,
              name: '100% Affinity',
              description: 'Biome mastery unlocked.'
            }
          ]
        });
        setZoneProfiles((prev) => {
          const idx = prev.findIndex((item) => item.id === profile.id);
          if (idx === -1) return [...prev, profile].sort((a, b) => a.name.localeCompare(b.name));
          const next = [...prev];
          next[idx] = profile;
          return next.sort((a, b) => a.name.localeCompare(b.name));
        });
        setSelectedZoneKey(profile.biomeKey);
        setShowAdvancedSetup(true);
        setActiveTab('world-systems');
        setFeedback({tone: 'success', message: 'Location linked as a zone profile.'});
        return;
      }
      if (importMechanicKind === 'settlement') {
        const nextState = await updateSettlementLocation({
          projectId: activeProject.id,
          sourceEntityId: entity.id,
          name: entity.name
        });
        setSelectedSettlementLocationId(entity.id);
        setSettlementState(nextState);
        setShowAdvancedSetup(true);
        setActiveTab('world-systems');
        setFeedback({tone: 'success', message: 'Location linked to settlement/community systems.'});
        return;
      }
      setFeedback({tone: 'success', message: 'World Bible entity linked to mechanics.'});
    } catch (error) {
      const message =
        describeError(error, 'Unable to import entity.');
      setFeedback({tone: 'error', message});
    }
  };

  return {
    entityToImportId,
    setEntityToImportId,
    importDomain,
    setImportDomain,
    importMechanicKind,
    setImportMechanicKind,
    importProgressScope,
    setImportProgressScope,
    handleImportEntity
  };
}
