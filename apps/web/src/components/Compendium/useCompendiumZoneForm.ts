import {useState} from 'react';
import type {MechanicsProgressScope, ZoneAffinityProfile, ZoneAffinityProgress} from '../../entityTypes';
import {upsertZoneAffinityProfile, recordZoneExposure} from '../../services/storage';
import {describeError} from '../../services/errors';
import type {CompendiumFormContext, SetFormValue} from './formTypes';

interface Options extends CompendiumFormContext {
  zoneProfiles: ZoneAffinityProfile[];
  activeMechanicsCharacterSheetId: string;
  setZoneProfiles: SetFormValue<ZoneAffinityProfile[]>;
  setZoneProgress: SetFormValue<ZoneAffinityProgress[]>;
}

export function useCompendiumZoneForm({
  activeProject,
  setFeedback,
  zoneProfiles,
  activeMechanicsCharacterSheetId,
  setZoneProfiles,
  setZoneProgress
}: Options) {
  const [zoneName, setZoneName] = useState('');
  const [zoneKey, setZoneKey] = useState('');
  const [zoneMaxPoints, setZoneMaxPoints] = useState(100);
  const [zoneSourceEntityId, setZoneSourceEntityId] = useState('');
  const [zoneProgressScope, setZoneProgressScope] =
    useState<MechanicsProgressScope>('character');
  const [selectedZoneKey, setSelectedZoneKey] = useState('');
  const [zoneExposureMinutes, setZoneExposureMinutes] = useState(10);
  const [isRecordingZone, setIsRecordingZone] = useState(false);
  const selectedZoneProfile =
    selectedZoneKey
      ? zoneProfiles.find((profile) => profile.biomeKey === selectedZoneKey) ?? null
      : null;
  const handleCreateZoneProfile = async () => {
    if (!activeProject || !zoneName.trim() || !zoneKey.trim()) return;
    setFeedback(null);
    try {
      const profile = await upsertZoneAffinityProfile({
        projectId: activeProject.id,
        biomeKey: zoneKey.trim().toLowerCase(),
        name: zoneName.trim(),
        sourceEntityId: zoneSourceEntityId || undefined,
        progressScope: zoneProgressScope,
        maxAffinityPoints: Math.max(1, Math.floor(zoneMaxPoints)),
        milestones: [
          {
            id: `${zoneKey.trim().toLowerCase()}-25`,
            thresholdPercent: 25,
            name: '25% Affinity',
            description: 'Biome familiarity unlocked.'
          },
          {
            id: `${zoneKey.trim().toLowerCase()}-50`,
            thresholdPercent: 50,
            name: '50% Affinity',
            description: 'Biome resistance unlocked.'
          },
          {
            id: `${zoneKey.trim().toLowerCase()}-100`,
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
      setZoneName('');
      setZoneKey('');
      setZoneMaxPoints(100);
      setZoneSourceEntityId('');
      setZoneProgressScope('character');
      setFeedback({tone: 'success', message: 'Zone affinity profile created.'});
    } catch (error) {
      const message =
        describeError(error, 'Unable to create zone profile.');
      setFeedback({tone: 'error', message});
    }
  };
  const handleRecordZoneExposure = async () => {
    if (!activeProject || !selectedZoneKey) return;
    if (
      selectedZoneProfile?.progressScope === 'character' &&
      !activeMechanicsCharacterSheetId
    ) {
      setFeedback({
        tone: 'error',
        message: 'Choose a character sheet before recording character-scoped zone exposure.'
      });
      return;
    }
    setIsRecordingZone(true);
    setFeedback(null);
    try {
      const result = await recordZoneExposure({
        projectId: activeProject.id,
        biomeKey: selectedZoneKey,
        exposureSeconds: Math.max(1, Math.floor(zoneExposureMinutes * 60)),
        characterSheetId:
          selectedZoneProfile?.progressScope === 'character'
            ? activeMechanicsCharacterSheetId || undefined
            : undefined
      });
      setZoneProgress((prev) => {
        const idx = prev.findIndex((item) => item.id === result.progress.id);
        if (idx === -1) return [...prev, result.progress].sort((a, b) => b.affinityPoints - a.affinityPoints);
        const next = [...prev];
        next[idx] = result.progress;
        return next.sort((a, b) => b.affinityPoints - a.affinityPoints);
      });
      if (result.unlockedMilestoneIds.length > 0) {
        setFeedback({
          tone: 'success',
          message: `Exposure recorded. Unlocked ${result.unlockedMilestoneIds.length} zone milestone(s).`
        });
      } else {
        setFeedback({tone: 'success', message: 'Zone exposure recorded.'});
      }
    } catch (error) {
      const message =
        describeError(error, 'Unable to record zone exposure.');
      setFeedback({tone: 'error', message});
    } finally {
      setIsRecordingZone(false);
    }
  };

  return {
    zoneName,
    setZoneName,
    zoneKey,
    setZoneKey,
    zoneMaxPoints,
    setZoneMaxPoints,
    zoneSourceEntityId,
    setZoneSourceEntityId,
    zoneProgressScope,
    setZoneProgressScope,
    selectedZoneKey,
    setSelectedZoneKey,
    zoneExposureMinutes,
    setZoneExposureMinutes,
    isRecordingZone,
    handleCreateZoneProfile,
    handleRecordZoneExposure
  };
}
