import type {Dispatch, SetStateAction} from 'react';
import type {
  Character,
  CharacterSheet,
  FortressTierDefinition,
  MechanicsProgressScope,
  PartySynergySuggestion,
  SettlementAuraEffect,
  SettlementModule,
  SettlementState,
  WorldEntity,
  ZoneAffinityProfile,
  ZoneAffinityProgress
} from '../../entityTypes';
import {
  formatSettlementEffectLabel,
  formatSynergyStatus,
  getCharacterRole,
  getZoneAffinityPercent
} from '../../services/compendium';
import {
  BASE_STAT_KEYS,
  BASE_STAT_LIMITS,
  MECHANICS_SCOPE_OPTIONS,
  type BaseStatKey
} from './constants';

const SETTLEMENT_SOURCE_OPTIONS: SettlementModule['sourceType'][] = [
  'trophy',
  'structure',
  'station',
  'totem',
  'custom'
];
const SETTLEMENT_EFFECT_TARGET_OPTIONS: SettlementModule['effects'][number]['targetType'][] = [
  'resistance',
  'stat',
  'resource',
  'custom'
];
const SETTLEMENT_EFFECT_OPERATION_OPTIONS: SettlementModule['effects'][number]['operation'][] = [
  'add',
  'multiply',
  'set'
];

interface WorldSystemsTabProps {
  activeMechanicsCharacterSheetId: string;
  activePartyCharacterIds: string[];
  activePartySynergies: PartySynergySuggestion[];
  activeSettlementEffects: SettlementAuraEffect[];
  baseStatsDraft: Record<BaseStatKey, string>;
  characterById: Map<string, Character>;
  characterSheets: CharacterSheet[];
  characters: Character[];
  enableWorldSystems: boolean;
  handleAddSettlementModule: () => Promise<void>;
  handleAdjustFortressLevel: (delta: number) => Promise<void>;
  handleBaseStatDraftChange: (key: BaseStatKey, value: string) => void;
  handleCreateZoneProfile: () => Promise<void>;
  handleRecordZoneExposure: () => Promise<void>;
  handleResetBaseStatsDraft: () => void;
  handleSaveBaseStats: () => Promise<void>;
  isBaseStatsDraftDirty: boolean;
  isRecordingZone: boolean;
  isSavingFortress: boolean;
  isSavingModule: boolean;
  moduleName: string;
  moduleOperation: SettlementModule['effects'][number]['operation'];
  moduleSourceType: SettlementModule['sourceType'];
  moduleTargetId: string;
  moduleTargetType: SettlementModule['effects'][number]['targetType'];
  moduleValue: string;
  nextFortressTier: FortressTierDefinition | null;
  rosterSynergyOpportunities: PartySynergySuggestion[];
  selectedSettlementLocationId: string;
  selectedZoneKey: string;
  setActiveMechanicsCharacterSheetId: Dispatch<SetStateAction<string>>;
  setModuleName: Dispatch<SetStateAction<string>>;
  setModuleOperation: Dispatch<
    SetStateAction<SettlementModule['effects'][number]['operation']>
  >;
  setModuleSourceType: Dispatch<SetStateAction<SettlementModule['sourceType']>>;
  setModuleTargetId: Dispatch<SetStateAction<string>>;
  setModuleTargetType: Dispatch<
    SetStateAction<SettlementModule['effects'][number]['targetType']>
  >;
  setModuleValue: Dispatch<SetStateAction<string>>;
  setSelectedSettlementLocationId: Dispatch<SetStateAction<string>>;
  setSelectedZoneKey: Dispatch<SetStateAction<string>>;
  setZoneExposureMinutes: Dispatch<SetStateAction<number>>;
  setZoneKey: Dispatch<SetStateAction<string>>;
  setZoneMaxPoints: Dispatch<SetStateAction<number>>;
  setZoneName: Dispatch<SetStateAction<string>>;
  setZoneProgressScope: Dispatch<SetStateAction<MechanicsProgressScope>>;
  setZoneSourceEntityId: Dispatch<SetStateAction<string>>;
  settlementComputedEffects: {
    auraEffects: SettlementAuraEffect[];
    fortressEffects: SettlementAuraEffect[];
    allEffects: SettlementAuraEffect[];
  };
  settlementModules: SettlementModule[];
  settlementState: SettlementState | null;
  togglePartyCharacter: (characterId: string) => void;
  unlockedFortressTiers: FortressTierDefinition[];
  worldEntities: WorldEntity[];
  worldEntityById: Map<string, WorldEntity>;
  zoneExposureMinutes: number;
  zoneKey: string;
  zoneMaxPoints: number;
  zoneName: string;
  zoneProfiles: ZoneAffinityProfile[];
  zoneProgressByKey: Map<string, ZoneAffinityProgress>;
  zoneProgressScope: MechanicsProgressScope;
  zoneSourceEntityId: string;
}

export function WorldSystemsTab({
  activeMechanicsCharacterSheetId,
  activePartyCharacterIds,
  activePartySynergies,
  activeSettlementEffects,
  baseStatsDraft,
  characterById,
  characterSheets,
  characters,
  enableWorldSystems,
  handleAddSettlementModule,
  handleAdjustFortressLevel,
  handleBaseStatDraftChange,
  handleCreateZoneProfile,
  handleRecordZoneExposure,
  handleResetBaseStatsDraft,
  handleSaveBaseStats,
  isBaseStatsDraftDirty,
  isRecordingZone,
  isSavingFortress,
  isSavingModule,
  moduleName,
  moduleOperation,
  moduleSourceType,
  moduleTargetId,
  moduleTargetType,
  moduleValue,
  nextFortressTier,
  rosterSynergyOpportunities,
  selectedSettlementLocationId,
  selectedZoneKey,
  setActiveMechanicsCharacterSheetId,
  setModuleName,
  setModuleOperation,
  setModuleSourceType,
  setModuleTargetId,
  setModuleTargetType,
  setModuleValue,
  setSelectedSettlementLocationId,
  setSelectedZoneKey,
  setZoneExposureMinutes,
  setZoneKey,
  setZoneMaxPoints,
  setZoneName,
  setZoneProgressScope,
  setZoneSourceEntityId,
  settlementComputedEffects,
  settlementModules,
  settlementState,
  togglePartyCharacter,
  unlockedFortressTiers,
  worldEntities,
  worldEntityById,
  zoneExposureMinutes,
  zoneKey,
  zoneMaxPoints,
  zoneName,
  zoneProfiles,
  zoneProgressByKey,
  zoneProgressScope,
  zoneSourceEntityId
}: WorldSystemsTabProps) {
    if (!enableWorldSystems) {
      return (
        <section
          style={{padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px'}}
        >
          <p style={{margin: 0, color: 'var(--color-text-secondary)'}}>
            Settlement and zone systems are hidden for this project. Enable
            <strong> Settlement/Zone Systems</strong> in Settings to access them.
          </p>
        </section>
      );
    }

    return (
      <div style={{display: 'grid', gap: '1rem'}}>
        <p style={{marginTop: 0, marginBottom: 0, color: 'var(--color-text-secondary)'}}>
          Advanced systems are optional. Enable and tune only when you need
          simulation depth for progression balancing.
        </p>
        <section style={{padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px'}}>
          <h2 style={{marginTop: 0}}>Zone Affinity</h2>
          <p style={{marginTop: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)'}}>
            Track zone exposure and unlock biome-specific milestones over time.
          </p>
          <label style={{display: 'block', marginBottom: '0.5rem'}}>
            Linked location
            <select
              value={zoneSourceEntityId}
              onChange={(e) => setZoneSourceEntityId(e.target.value)}
              style={{width: '100%'}}
            >
              <option value=''>No linked location</option>
              {worldEntities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{display: 'block', marginBottom: '0.5rem'}}>
            Progress scope
            <select
              value={zoneProgressScope === 'party' ? 'global' : zoneProgressScope}
              onChange={(e) =>
                setZoneProgressScope(e.target.value as MechanicsProgressScope)
              }
              style={{width: '100%'}}
            >
              {MECHANICS_SCOPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {zoneProgressScope === 'character' && (
            <label style={{display: 'block', marginBottom: '0.75rem'}}>
              Active character sheet
              <select
                value={activeMechanicsCharacterSheetId}
                onChange={(e) => setActiveMechanicsCharacterSheetId(e.target.value)}
                style={{width: '100%'}}
              >
                <option value=''>No character selected</option>
                {characterSheets.map((sheet) => (
                  <option key={sheet.id} value={sheet.id}>
                    {sheet.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label style={{display: 'block', marginBottom: '0.5rem'}}>
            Zone Name
            <input
              type='text'
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              placeholder='Bee Cave'
              style={{width: '100%'}}
            />
          </label>
          <label style={{display: 'block', marginBottom: '0.5rem'}}>
            Zone Key
            <input
              type='text'
              value={zoneKey}
              onChange={(e) => setZoneKey(e.target.value)}
              placeholder='bee_cave'
              style={{width: '100%'}}
            />
          </label>
          <label style={{display: 'block', marginBottom: '0.75rem'}}>
            Max Affinity Points
            <input
              type='number'
              min={1}
              value={zoneMaxPoints}
              onChange={(e) => setZoneMaxPoints(Number(e.target.value))}
              style={{width: '100%'}}
            />
          </label>
          <button type='button' onClick={() => void handleCreateZoneProfile()}>
            Add Zone Profile
          </button>
          {zoneProfiles.length === 0 && (
            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.65rem',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                backgroundColor: 'var(--color-bg-secondary)'
              }}
            >
              <p style={{marginTop: 0, marginBottom: '0.5rem'}}>
                No zone profiles yet.
              </p>
              <button
                type='button'
                onClick={() => {
                  if (!zoneName.trim()) setZoneName('Starter Zone');
                  if (!zoneKey.trim()) setZoneKey('starter_zone');
                }}
              >
                Create your first zone profile
              </button>
            </div>
          )}
          <hr style={{margin: '0.9rem 0'}} />
          <label style={{display: 'block', marginBottom: '0.5rem'}}>
            Active Zone
            <select
              value={selectedZoneKey}
              onChange={(e) => setSelectedZoneKey(e.target.value)}
              style={{width: '100%'}}
            >
              <option value=''>Select zone</option>
              {zoneProfiles.map((profile) => (
                <option key={profile.id} value={profile.biomeKey}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{display: 'block', marginBottom: '0.75rem'}}>
            Exposure Minutes
            <input
              type='number'
              min={1}
              value={zoneExposureMinutes}
              onChange={(e) => setZoneExposureMinutes(Number(e.target.value))}
              style={{width: '100%'}}
            />
          </label>
          <button
            type='button'
            onClick={() => void handleRecordZoneExposure()}
            disabled={!selectedZoneKey || isRecordingZone}
          >
            {isRecordingZone ? 'Recording...' : 'Record Exposure'}
          </button>
          <ul style={{listStyle: 'none', padding: 0, marginTop: '0.75rem'}}>
            {zoneProfiles.map((profile) => {
              const progressKey = `${profile.biomeKey}:${
                profile.progressScope === 'character'
                  ? activeMechanicsCharacterSheetId || 'global'
                  : 'global'
              }`;
              const progressItem = zoneProgressByKey.get(progressKey) ?? {
                id: '',
                projectId: profile.projectId,
                biomeKey: profile.biomeKey,
                characterSheetId:
                  profile.progressScope === 'character'
                    ? activeMechanicsCharacterSheetId || undefined
                    : undefined,
                affinityPoints: 0,
                totalExposureSeconds: 0,
                unlockedMilestoneIds: [],
                updatedAt: profile.updatedAt
              };
              const percent = getZoneAffinityPercent(progressItem, profile);
              const unlocked = new Set(progressItem.unlockedMilestoneIds);
              return (
                <li
                  key={`zone-${profile.id}`}
                  style={{
                    marginBottom: '0.65rem',
                    paddingBottom: '0.55rem',
                    borderBottom: '1px solid var(--color-border)'
                  }}
                >
                  <strong>{profile.name}</strong> ({percent.toFixed(1)}%)
                  {profile.sourceEntityId && (
                    <div style={{fontSize: '0.8rem', color: 'var(--color-text-secondary)'}}>
                      Linked location:{' '}
                      {worldEntityById.get(profile.sourceEntityId)?.name ?? profile.sourceEntityId}
                    </div>
                  )}
                  <div style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)'}}>
                    Scope: {profile.progressScope ?? 'character'}
                    {' · '}
                    Exposure: {(progressItem.totalExposureSeconds / 60).toFixed(1)} minutes
                  </div>
                  <div style={{fontSize: '0.82rem'}}>
                    {profile.milestones.map((milestone) => (
                      <div key={milestone.id}>
                        {unlocked.has(milestone.id) ? 'Unlocked' : 'Locked'}{' '}
                        {milestone.thresholdPercent}%: {milestone.name}
                      </div>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section style={{padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px'}}>
          <h2 style={{marginTop: 0}}>Community / Logistics</h2>
          <p style={{marginTop: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)'}}>
            Shared party synergy buffs driven by role combinations. Select the
            currently active party to preview concrete in-scene combo effects.
          </p>
          <div style={{fontSize: '0.85rem', marginBottom: '0.5rem'}}>
            <strong>Active Party Members</strong>
          </div>
          <div style={{display: 'grid', gap: '0.35rem', marginBottom: '0.8rem'}}>
            {characters.length === 0 ? (
              <div style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)'}}>
                No characters yet. Add role-tagged characters to enable synergy.
              </div>
            ) : (
              characters.map((character) => (
                <label
                  key={character.id}
                  style={{display: 'flex', alignItems: 'center', gap: '0.45rem'}}
                >
                  <input
                    type='checkbox'
                    checked={activePartyCharacterIds.includes(character.id)}
                    onChange={() => togglePartyCharacter(character.id)}
                  />
                  <span>
                    {character.name}
                    <span style={{fontSize: '0.8rem', color: 'var(--color-text-secondary)'}}>
                      {' '}
                      ({getCharacterRole(character) || 'no role'})
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>
          <div style={{fontSize: '0.85rem', marginBottom: '0.45rem'}}>
            <strong>Active Combo Buffs</strong>
          </div>
          <ul style={{listStyle: 'none', padding: 0, marginTop: 0}}>
            {activePartySynergies.filter((item) => item.missingRoles.length === 0).length ===
            0 ? (
              <li style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)'}}>
                No active combos for the current party selection.
              </li>
            ) : (
              activePartySynergies
                .filter((item) => item.missingRoles.length === 0)
                .map((suggestion) => (
                  <li key={suggestion.ruleId} style={{marginBottom: '0.55rem'}}>
                    <strong>{suggestion.ruleName}</strong>
                    {suggestion.maxDistanceMeters ? (
                      <span style={{fontSize: '0.8rem', color: 'var(--color-text-secondary)'}}>
                        {' '}
                        ({suggestion.maxDistanceMeters}m proximity)
                      </span>
                    ) : null}
                    <div style={{fontSize: '0.82rem'}}>{suggestion.effectDescription}</div>
                    <div style={{fontSize: '0.8rem', color: 'var(--color-text-secondary)'}}>
                      {formatSynergyStatus(suggestion, characterById)}
                    </div>
                  </li>
                ))
            )}
          </ul>
          <div style={{fontSize: '0.85rem', marginBottom: '0.45rem'}}>
            <strong>Roster Opportunities</strong>
          </div>
          <ul style={{listStyle: 'none', padding: 0, marginTop: 0, marginBottom: 0}}>
            {rosterSynergyOpportunities.length === 0 ? (
              <li style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)'}}>
                Full roster can already satisfy all default synergy rules.
              </li>
            ) : (
              rosterSynergyOpportunities.map((suggestion) => (
                <li key={`roster-${suggestion.ruleId}`} style={{marginBottom: '0.55rem'}}>
                  <strong>{suggestion.ruleName}</strong>
                  <div style={{fontSize: '0.82rem'}}>{suggestion.effectDescription}</div>
                  <div style={{fontSize: '0.8rem', color: 'var(--color-text-secondary)'}}>
                    {formatSynergyStatus(suggestion, characterById)}
                  </div>
                  {suggestion.questPrompt && (
                    <div style={{fontSize: '0.8rem', color: 'var(--color-text-secondary)'}}>
                      Prompt seed: {suggestion.questPrompt}
                    </div>
                  )}
                </li>
              ))
            )}
          </ul>
        </section>

        <section style={{padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px'}}>
          <h2 style={{marginTop: 0}}>Settlement Progression</h2>
          <p style={{marginTop: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)'}}>
            Generalized settlement buffs. Trophies are one source type, alongside
            structures, stations, totems, and custom modules.
          </p>
          <label style={{display: 'block', marginBottom: '0.75rem'}}>
            Linked location
            <select
              value={selectedSettlementLocationId}
              onChange={(e) => setSelectedSettlementLocationId(e.target.value)}
              style={{width: '100%'}}
            >
              <option value=''>No linked location</option>
              {worldEntities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </select>
          </label>
          {settlementState?.sourceEntityId && (
            <div style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginBottom: '0.65rem'}}>
              Settlement systems are currently attached to{' '}
              <strong>
                {worldEntityById.get(settlementState.sourceEntityId)?.name ??
                  settlementState.sourceEntityId}
              </strong>
              .
            </div>
          )}
          <label style={{display: 'block', marginBottom: '0.5rem'}}>
            Module Name
            <input
              type='text'
              value={moduleName}
              onChange={(e) => setModuleName(e.target.value)}
              placeholder='Cave Worm Trophy'
              style={{width: '100%'}}
            />
          </label>
          <label style={{display: 'block', marginBottom: '0.5rem'}}>
            Source Type
            <select
              value={moduleSourceType}
              onChange={(e) =>
                setModuleSourceType(e.target.value as SettlementModule['sourceType'])
              }
              style={{width: '100%'}}
            >
              {SETTLEMENT_SOURCE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem'}}>
            <label style={{display: 'block', marginBottom: '0.5rem'}}>
              Target Type
              <select
                value={moduleTargetType}
                onChange={(e) =>
                  setModuleTargetType(
                    e.target.value as SettlementModule['effects'][number]['targetType']
                  )
                }
                style={{width: '100%'}}
              >
                {SETTLEMENT_EFFECT_TARGET_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label style={{display: 'block', marginBottom: '0.5rem'}}>
              Target ID
              <input
                type='text'
                value={moduleTargetId}
                onChange={(e) => setModuleTargetId(e.target.value)}
                placeholder='poison'
                style={{width: '100%'}}
              />
            </label>
          </div>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem'}}>
            <label style={{display: 'block', marginBottom: '0.75rem'}}>
              Operation
              <select
                value={moduleOperation}
                onChange={(e) =>
                  setModuleOperation(
                    e.target.value as SettlementModule['effects'][number]['operation']
                  )
                }
                style={{width: '100%'}}
              >
                {SETTLEMENT_EFFECT_OPERATION_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label style={{display: 'block', marginBottom: '0.75rem'}}>
              Value
              <input
                type='text'
                value={moduleValue}
                onChange={(e) => setModuleValue(e.target.value)}
                placeholder='5'
                style={{width: '100%'}}
              />
            </label>
          </div>
          <button
            type='button'
            onClick={() => void handleAddSettlementModule()}
            disabled={isSavingModule || !settlementState || !moduleName.trim()}
          >
            {isSavingModule ? 'Adding...' : 'Add Settlement Module'}
          </button>
          <hr style={{margin: '0.9rem 0'}} />
          <div style={{fontSize: '0.85rem', marginBottom: '0.5rem'}}>
            <strong>Settlement Tier Level:</strong> {settlementState?.fortressLevel ?? 1}
          </div>
          <div style={{display: 'flex', gap: '0.5rem', marginBottom: '0.65rem'}}>
            <button
              type='button'
              onClick={() => void handleAdjustFortressLevel(-1)}
              disabled={!settlementState || settlementState.fortressLevel <= 1 || isSavingFortress}
            >
              - Tier
            </button>
            <button
              type='button'
              onClick={() => void handleAdjustFortressLevel(1)}
              disabled={!settlementState || isSavingFortress}
            >
              + Tier
            </button>
          </div>
          <div style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginBottom: '0.6rem'}}>
            {nextFortressTier
              ? `Next tier at level ${nextFortressTier.levelRequired}: ${nextFortressTier.name}`
              : 'All configured settlement tiers unlocked.'}
          </div>
          <div style={{fontSize: '0.85rem', marginBottom: '0.35rem'}}>
            <strong>Base Stats</strong>
          </div>
          {settlementState && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.45rem',
                marginBottom: '0.65rem'
              }}
            >
              {BASE_STAT_KEYS.map((key) => (
                <label key={`base-${key}`} style={{fontSize: '0.82rem'}}>
                  {key}
                  <input
                    type='number'
                    min={BASE_STAT_LIMITS[key].min}
                    max={BASE_STAT_LIMITS[key].max}
                    step={1}
                    value={baseStatsDraft[key]}
                    onChange={(e) => handleBaseStatDraftChange(key, e.target.value)}
                    style={{width: '100%'}}
                  />
                </label>
              ))}
            </div>
          )}
          <div style={{display: 'flex', gap: '0.45rem', marginBottom: '0.7rem'}}>
            <button
              type='button'
              onClick={() => void handleSaveBaseStats()}
              disabled={!settlementState || !isBaseStatsDraftDirty || isSavingFortress}
            >
              {isSavingFortress ? 'Saving...' : 'Save Base Stats'}
            </button>
            <button
              type='button'
              onClick={handleResetBaseStatsDraft}
              disabled={!settlementState || !isBaseStatsDraftDirty || isSavingFortress}
            >
              Reset
            </button>
          </div>
          <div style={{fontSize: '0.85rem', marginBottom: '0.5rem'}}>
            <strong>Settlement Tier Effects:</strong>{' '}
            {settlementComputedEffects.fortressEffects.length}
          </div>
          <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
            {settlementComputedEffects.fortressEffects.length === 0 ? (
              <li style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)'}}>
                No tier effects unlocked yet.
              </li>
            ) : (
              settlementComputedEffects.fortressEffects.map((effect, index) => (
                <li
                  key={`tier-effect-${effect.targetType}-${effect.targetId}-${index}`}
                  style={{marginBottom: '0.35rem'}}
                >
                  {formatSettlementEffectLabel(effect)}
                </li>
              ))
            )}
          </ul>
          <div style={{fontSize: '0.85rem', marginTop: '0.65rem', marginBottom: '0.5rem'}}>
            <strong>Active Aura Effects:</strong> {activeSettlementEffects.length}
          </div>
          <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
            {activeSettlementEffects.length === 0 ? (
              <li style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)'}}>
                No active module effects yet.
              </li>
            ) : (
              activeSettlementEffects.map((effect, index) => (
                <li
                  key={`active-effect-${effect.targetType}-${effect.targetId}-${index}`}
                  style={{marginBottom: '0.35rem'}}
                >
                  {formatSettlementEffectLabel(effect)}
                </li>
              ))
            )}
          </ul>
          <div style={{fontSize: '0.85rem', marginTop: '0.65rem', marginBottom: '0.5rem'}}>
            <strong>Total Active Effects:</strong> {settlementComputedEffects.allEffects.length}
          </div>
          <div style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginBottom: '0.65rem'}}>
            Includes settlement progression + aura modules.
          </div>
          <div style={{fontSize: '0.85rem', marginBottom: '0.35rem'}}>
            <strong>Unlocked Settlement Tiers</strong>
          </div>
          <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
            {unlockedFortressTiers.length === 0 ? (
              <li style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)'}}>None yet.</li>
            ) : (
              unlockedFortressTiers.map((tier) => (
                <li key={tier.id} style={{marginBottom: '0.45rem'}}>
                  <strong>
                    L{tier.levelRequired} {tier.name}
                  </strong>
                  {tier.description && (
                    <div style={{fontSize: '0.8rem', color: 'var(--color-text-secondary)'}}>
                      {tier.description}
                    </div>
                  )}
                </li>
              ))
            )}
          </ul>
          <div style={{fontSize: '0.82rem', marginTop: '0.75rem'}}>
            <strong>Installed Modules:</strong>
          </div>
          <ul style={{listStyle: 'none', padding: 0, marginTop: '0.35rem', marginBottom: 0}}>
            {settlementModules.length === 0 ? (
              <li style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)'}}>
                No modules installed.
              </li>
            ) : (
              settlementModules.map((module) => (
                <li key={module.id} style={{marginBottom: '0.45rem'}}>
                  <strong>{module.name}</strong>{' '}
                  <span style={{fontSize: '0.8rem', color: 'var(--color-text-secondary)'}}>
                    [{module.sourceType}]
                  </span>
                  {module.effects.map((effect, effectIndex) => (
                    <div
                      key={`${module.id}-effect-${effectIndex}`}
                      style={{fontSize: '0.8rem', color: 'var(--color-text-secondary)'}}
                    >
                      {formatSettlementEffectLabel(effect)}
                    </div>
                  ))}
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    );
}
