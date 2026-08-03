import styles from '../../assets/components/CompendiumRoute.module.css';
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
          className={`${styles.padding1rem} ${styles.border1pxSolidVarColorBorder} ${styles.borderRadius8px}`}
        >
          <p className={`${styles.margin0} ${styles.colorVarColorTextSecondary}`}>
            Settlement and zone systems are hidden for this project. Enable
            <strong> Settlement/Zone Systems</strong> in Settings to access them.
          </p>
        </section>
      );
    }

    return (
      <div className={`${styles.displayGrid} ${styles.gap1rem}`}>
        <p className={`${styles.marginTop0} ${styles.marginBottom0} ${styles.colorVarColorTextSecondary}`}>
          Advanced systems are optional. Enable and tune only when you need
          simulation depth for progression balancing.
        </p>
        <section className={`${styles.padding1rem} ${styles.border1pxSolidVarColorBorder} ${styles.borderRadius8px}`}>
          <h2 className={styles.marginTop0}>Zone Affinity</h2>
          <p className={`${styles.marginTop0} ${styles.fontSize085rem} ${styles.colorVarColorTextSecondary}`}>
            Track zone exposure and unlock biome-specific milestones over time.
          </p>
          <label className={`${styles.displayBlock} ${styles.marginBottom05rem}`}>
            Linked location
            <select
              value={zoneSourceEntityId}
              onChange={(e) => setZoneSourceEntityId(e.target.value)}
              className={styles.width100}
            >
              <option value=''>No linked location</option>
              {worldEntities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </select>
          </label>
          <label className={`${styles.displayBlock} ${styles.marginBottom05rem}`}>
            Progress scope
            <select
              value={zoneProgressScope === 'party' ? 'global' : zoneProgressScope}
              onChange={(e) =>
                setZoneProgressScope(e.target.value as MechanicsProgressScope)
              }
              className={styles.width100}
            >
              {MECHANICS_SCOPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {zoneProgressScope === 'character' && (
            <label className={`${styles.displayBlock} ${styles.marginBottom075rem}`}>
              Active character sheet
              <select
                value={activeMechanicsCharacterSheetId}
                onChange={(e) => setActiveMechanicsCharacterSheetId(e.target.value)}
                className={styles.width100}
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
          <label className={`${styles.displayBlock} ${styles.marginBottom05rem}`}>
            Zone Name
            <input
              type='text'
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              placeholder='Bee Cave'
              className={styles.width100}
            />
          </label>
          <label className={`${styles.displayBlock} ${styles.marginBottom05rem}`}>
            Zone Key
            <input
              type='text'
              value={zoneKey}
              onChange={(e) => setZoneKey(e.target.value)}
              placeholder='bee_cave'
              className={styles.width100}
            />
          </label>
          <label className={`${styles.displayBlock} ${styles.marginBottom075rem}`}>
            Max Affinity Points
            <input
              type='number'
              min={1}
              value={zoneMaxPoints}
              onChange={(e) => setZoneMaxPoints(Number(e.target.value))}
              className={styles.width100}
            />
          </label>
          <button type='button' onClick={() => void handleCreateZoneProfile()}>
            Add Zone Profile
          </button>
          {zoneProfiles.length === 0 && (
            <div
              className={`${styles.marginTop075rem} ${styles.padding065rem} ${styles.border1pxSolidVarColorBorder} ${styles.borderRadius6px} ${styles.backgroundColorVarColorBgSecondary}`}
            >
              <p className={`${styles.marginTop0} ${styles.marginBottom05rem}`}>
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
          <hr className={styles.margin09rem0} />
          <label className={`${styles.displayBlock} ${styles.marginBottom05rem}`}>
            Active Zone
            <select
              value={selectedZoneKey}
              onChange={(e) => setSelectedZoneKey(e.target.value)}
              className={styles.width100}
            >
              <option value=''>Select zone</option>
              {zoneProfiles.map((profile) => (
                <option key={profile.id} value={profile.biomeKey}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>
          <label className={`${styles.displayBlock} ${styles.marginBottom075rem}`}>
            Exposure Minutes
            <input
              type='number'
              min={1}
              value={zoneExposureMinutes}
              onChange={(e) => setZoneExposureMinutes(Number(e.target.value))}
              className={styles.width100}
            />
          </label>
          <button
            type='button'
            onClick={() => void handleRecordZoneExposure()}
            disabled={!selectedZoneKey || isRecordingZone}
          >
            {isRecordingZone ? 'Recording...' : 'Record Exposure'}
          </button>
          <ul className={`${styles.listStyleNone} ${styles.padding0} ${styles.marginTop075rem}`}>
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
                  className={`${styles.marginBottom065rem} ${styles.paddingBottom055rem} ${styles.borderBottom1pxSolidVarColorBorder}`}
                >
                  <strong>{profile.name}</strong> ({percent.toFixed(1)}%)
                  {profile.sourceEntityId && (
                    <div className={`${styles.fontSize08rem} ${styles.colorVarColorTextSecondary}`}>
                      Linked location:{' '}
                      {worldEntityById.get(profile.sourceEntityId)?.name ?? profile.sourceEntityId}
                    </div>
                  )}
                  <div className={`${styles.fontSize082rem} ${styles.colorVarColorTextSecondary}`}>
                    Scope: {profile.progressScope ?? 'character'}
                    {' · '}
                    Exposure: {(progressItem.totalExposureSeconds / 60).toFixed(1)} minutes
                  </div>
                  <div className={styles.fontSize082rem}>
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

        <section className={`${styles.padding1rem} ${styles.border1pxSolidVarColorBorder} ${styles.borderRadius8px}`}>
          <h2 className={styles.marginTop0}>Community / Logistics</h2>
          <p className={`${styles.marginTop0} ${styles.fontSize085rem} ${styles.colorVarColorTextSecondary}`}>
            Shared party synergy buffs driven by role combinations. Select the
            currently active party to preview concrete in-scene combo effects.
          </p>
          <div className={`${styles.fontSize085rem} ${styles.marginBottom05rem}`}>
            <strong>Active Party Members</strong>
          </div>
          <div className={`${styles.displayGrid} ${styles.gap035rem} ${styles.marginBottom08rem}`}>
            {characters.length === 0 ? (
              <div className={`${styles.fontSize082rem} ${styles.colorVarColorTextSecondary}`}>
                No characters yet. Add role-tagged characters to enable synergy.
              </div>
            ) : (
              characters.map((character) => (
                <label
                  key={character.id}
                  className={`${styles.displayFlex} ${styles.alignItemsCenter} ${styles.gap045rem}`}
                >
                  <input
                    type='checkbox'
                    checked={activePartyCharacterIds.includes(character.id)}
                    onChange={() => togglePartyCharacter(character.id)}
                  />
                  <span>
                    {character.name}
                    <span className={`${styles.fontSize08rem} ${styles.colorVarColorTextSecondary}`}>
                      {' '}
                      ({getCharacterRole(character) || 'no role'})
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>
          <div className={`${styles.fontSize085rem} ${styles.marginBottom045rem}`}>
            <strong>Active Combo Buffs</strong>
          </div>
          <ul className={`${styles.listStyleNone} ${styles.padding0} ${styles.marginTop0}`}>
            {activePartySynergies.filter((item) => item.missingRoles.length === 0).length ===
            0 ? (
              <li className={`${styles.fontSize082rem} ${styles.colorVarColorTextSecondary}`}>
                No active combos for the current party selection.
              </li>
            ) : (
              activePartySynergies
                .filter((item) => item.missingRoles.length === 0)
                .map((suggestion) => (
                  <li key={suggestion.ruleId} className={styles.marginBottom055rem}>
                    <strong>{suggestion.ruleName}</strong>
                    {suggestion.maxDistanceMeters ? (
                      <span className={`${styles.fontSize08rem} ${styles.colorVarColorTextSecondary}`}>
                        {' '}
                        ({suggestion.maxDistanceMeters}m proximity)
                      </span>
                    ) : null}
                    <div className={styles.fontSize082rem}>{suggestion.effectDescription}</div>
                    <div className={`${styles.fontSize08rem} ${styles.colorVarColorTextSecondary}`}>
                      {formatSynergyStatus(suggestion, characterById)}
                    </div>
                  </li>
                ))
            )}
          </ul>
          <div className={`${styles.fontSize085rem} ${styles.marginBottom045rem}`}>
            <strong>Roster Opportunities</strong>
          </div>
          <ul className={`${styles.listStyleNone} ${styles.padding0} ${styles.marginTop0} ${styles.marginBottom0}`}>
            {rosterSynergyOpportunities.length === 0 ? (
              <li className={`${styles.fontSize082rem} ${styles.colorVarColorTextSecondary}`}>
                Full roster can already satisfy all default synergy rules.
              </li>
            ) : (
              rosterSynergyOpportunities.map((suggestion) => (
                <li key={`roster-${suggestion.ruleId}`} className={styles.marginBottom055rem}>
                  <strong>{suggestion.ruleName}</strong>
                  <div className={styles.fontSize082rem}>{suggestion.effectDescription}</div>
                  <div className={`${styles.fontSize08rem} ${styles.colorVarColorTextSecondary}`}>
                    {formatSynergyStatus(suggestion, characterById)}
                  </div>
                  {suggestion.questPrompt && (
                    <div className={`${styles.fontSize08rem} ${styles.colorVarColorTextSecondary}`}>
                      Prompt seed: {suggestion.questPrompt}
                    </div>
                  )}
                </li>
              ))
            )}
          </ul>
        </section>

        <section className={`${styles.padding1rem} ${styles.border1pxSolidVarColorBorder} ${styles.borderRadius8px}`}>
          <h2 className={styles.marginTop0}>Settlement Progression</h2>
          <p className={`${styles.marginTop0} ${styles.fontSize085rem} ${styles.colorVarColorTextSecondary}`}>
            Generalized settlement buffs. Trophies are one source type, alongside
            structures, stations, totems, and custom modules.
          </p>
          <label className={`${styles.displayBlock} ${styles.marginBottom075rem}`}>
            Linked location
            <select
              value={selectedSettlementLocationId}
              onChange={(e) => setSelectedSettlementLocationId(e.target.value)}
              className={styles.width100}
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
            <div className={`${styles.fontSize082rem} ${styles.colorVarColorTextSecondary} ${styles.marginBottom065rem}`}>
              Settlement systems are currently attached to{' '}
              <strong>
                {worldEntityById.get(settlementState.sourceEntityId)?.name ??
                  settlementState.sourceEntityId}
              </strong>
              .
            </div>
          )}
          <label className={`${styles.displayBlock} ${styles.marginBottom05rem}`}>
            Module Name
            <input
              type='text'
              value={moduleName}
              onChange={(e) => setModuleName(e.target.value)}
              placeholder='Cave Worm Trophy'
              className={styles.width100}
            />
          </label>
          <label className={`${styles.displayBlock} ${styles.marginBottom05rem}`}>
            Source Type
            <select
              value={moduleSourceType}
              onChange={(e) =>
                setModuleSourceType(e.target.value as SettlementModule['sourceType'])
              }
              className={styles.width100}
            >
              {SETTLEMENT_SOURCE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <div className={`${styles.displayGrid} ${styles.gridTemplateColumns1fr1fr} ${styles.gap05rem}`}>
            <label className={`${styles.displayBlock} ${styles.marginBottom05rem}`}>
              Target Type
              <select
                value={moduleTargetType}
                onChange={(e) =>
                  setModuleTargetType(
                    e.target.value as SettlementModule['effects'][number]['targetType']
                  )
                }
                className={styles.width100}
              >
                {SETTLEMENT_EFFECT_TARGET_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className={`${styles.displayBlock} ${styles.marginBottom05rem}`}>
              Target ID
              <input
                type='text'
                value={moduleTargetId}
                onChange={(e) => setModuleTargetId(e.target.value)}
                placeholder='poison'
                className={styles.width100}
              />
            </label>
          </div>
          <div className={`${styles.displayGrid} ${styles.gridTemplateColumns1fr1fr} ${styles.gap05rem}`}>
            <label className={`${styles.displayBlock} ${styles.marginBottom075rem}`}>
              Operation
              <select
                value={moduleOperation}
                onChange={(e) =>
                  setModuleOperation(
                    e.target.value as SettlementModule['effects'][number]['operation']
                  )
                }
                className={styles.width100}
              >
                {SETTLEMENT_EFFECT_OPERATION_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className={`${styles.displayBlock} ${styles.marginBottom075rem}`}>
              Value
              <input
                type='text'
                value={moduleValue}
                onChange={(e) => setModuleValue(e.target.value)}
                placeholder='5'
                className={styles.width100}
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
          <hr className={styles.margin09rem0} />
          <div className={`${styles.fontSize085rem} ${styles.marginBottom05rem}`}>
            <strong>Settlement Tier Level:</strong> {settlementState?.fortressLevel ?? 1}
          </div>
          <div className={`${styles.displayFlex} ${styles.gap05rem} ${styles.marginBottom065rem}`}>
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
          <div className={`${styles.fontSize082rem} ${styles.colorVarColorTextSecondary} ${styles.marginBottom06rem}`}>
            {nextFortressTier
              ? `Next tier at level ${nextFortressTier.levelRequired}: ${nextFortressTier.name}`
              : 'All configured settlement tiers unlocked.'}
          </div>
          <div className={`${styles.fontSize085rem} ${styles.marginBottom035rem}`}>
            <strong>Base Stats</strong>
          </div>
          {settlementState && (
            <div
              className={`${styles.displayGrid} ${styles.gridTemplateColumns1fr1fr} ${styles.gap045rem} ${styles.marginBottom065rem}`}
            >
              {BASE_STAT_KEYS.map((key) => (
                <label key={`base-${key}`} className={styles.fontSize082rem}>
                  {key}
                  <input
                    type='number'
                    min={BASE_STAT_LIMITS[key].min}
                    max={BASE_STAT_LIMITS[key].max}
                    step={1}
                    value={baseStatsDraft[key]}
                    onChange={(e) => handleBaseStatDraftChange(key, e.target.value)}
                    className={styles.width100}
                  />
                </label>
              ))}
            </div>
          )}
          <div className={`${styles.displayFlex} ${styles.gap045rem} ${styles.marginBottom07rem}`}>
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
          <div className={`${styles.fontSize085rem} ${styles.marginBottom05rem}`}>
            <strong>Settlement Tier Effects:</strong>{' '}
            {settlementComputedEffects.fortressEffects.length}
          </div>
          <ul className={`${styles.listStyleNone} ${styles.padding0} ${styles.margin0}`}>
            {settlementComputedEffects.fortressEffects.length === 0 ? (
              <li className={`${styles.fontSize082rem} ${styles.colorVarColorTextSecondary}`}>
                No tier effects unlocked yet.
              </li>
            ) : (
              settlementComputedEffects.fortressEffects.map((effect, index) => (
                <li
                  key={`tier-effect-${effect.targetType}-${effect.targetId}-${index}`}
                  className={styles.marginBottom035rem}
                >
                  {formatSettlementEffectLabel(effect)}
                </li>
              ))
            )}
          </ul>
          <div className={`${styles.fontSize085rem} ${styles.marginTop065rem} ${styles.marginBottom05rem}`}>
            <strong>Active Aura Effects:</strong> {activeSettlementEffects.length}
          </div>
          <ul className={`${styles.listStyleNone} ${styles.padding0} ${styles.margin0}`}>
            {activeSettlementEffects.length === 0 ? (
              <li className={`${styles.fontSize082rem} ${styles.colorVarColorTextSecondary}`}>
                No active module effects yet.
              </li>
            ) : (
              activeSettlementEffects.map((effect, index) => (
                <li
                  key={`active-effect-${effect.targetType}-${effect.targetId}-${index}`}
                  className={styles.marginBottom035rem}
                >
                  {formatSettlementEffectLabel(effect)}
                </li>
              ))
            )}
          </ul>
          <div className={`${styles.fontSize085rem} ${styles.marginTop065rem} ${styles.marginBottom05rem}`}>
            <strong>Total Active Effects:</strong> {settlementComputedEffects.allEffects.length}
          </div>
          <div className={`${styles.fontSize082rem} ${styles.colorVarColorTextSecondary} ${styles.marginBottom065rem}`}>
            Includes settlement progression + aura modules.
          </div>
          <div className={`${styles.fontSize085rem} ${styles.marginBottom035rem}`}>
            <strong>Unlocked Settlement Tiers</strong>
          </div>
          <ul className={`${styles.listStyleNone} ${styles.padding0} ${styles.margin0}`}>
            {unlockedFortressTiers.length === 0 ? (
              <li className={`${styles.fontSize082rem} ${styles.colorVarColorTextSecondary}`}>None yet.</li>
            ) : (
              unlockedFortressTiers.map((tier) => (
                <li key={tier.id} className={styles.marginBottom045rem}>
                  <strong>
                    L{tier.levelRequired} {tier.name}
                  </strong>
                  {tier.description && (
                    <div className={`${styles.fontSize08rem} ${styles.colorVarColorTextSecondary}`}>
                      {tier.description}
                    </div>
                  )}
                </li>
              ))
            )}
          </ul>
          <div className={`${styles.fontSize082rem} ${styles.marginTop075rem}`}>
            <strong>Installed Modules:</strong>
          </div>
          <ul className={`${styles.listStyleNone} ${styles.padding0} ${styles.marginTop035rem} ${styles.marginBottom0}`}>
            {settlementModules.length === 0 ? (
              <li className={`${styles.fontSize082rem} ${styles.colorVarColorTextSecondary}`}>
                No modules installed.
              </li>
            ) : (
              settlementModules.map((module) => (
                <li key={module.id} className={styles.marginBottom045rem}>
                  <strong>{module.name}</strong>{' '}
                  <span className={`${styles.fontSize08rem} ${styles.colorVarColorTextSecondary}`}>
                    [{module.sourceType}]
                  </span>
                  {module.effects.map((effect, effectIndex) => (
                    <div
                      key={`${module.id}-effect-${effectIndex}`}
                      className={`${styles.fontSize08rem} ${styles.colorVarColorTextSecondary}`}
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
