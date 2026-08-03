import styles from '../../assets/components/CompendiumRoute.module.css';
import type {Dispatch, SetStateAction} from 'react';
import type {NavigateFunction} from 'react-router';
import type {
  CharacterSheet,
  CompendiumActionDefinition,
  CompendiumDomain,
  CompendiumEntry,
  CompendiumMechanicKind,
  MechanicsProgressScope,
  SettlementState,
  StoredRuleset,
  WorldEntity,
  ZoneAffinityProfile
} from '../../entityTypes';
import {ConsumableEffectEditor} from '../Mechanics/ConsumableEffectEditor';
import {MECHANICS_SCOPE_OPTIONS} from './constants';

const DOMAIN_OPTIONS: Array<{value: CompendiumDomain; label: string}> = [
  {value: 'beast', label: 'Beast'},
  {value: 'flora', label: 'Flora'},
  {value: 'mineral', label: 'Mineral'},
  {value: 'artifact', label: 'Artifact'},
  {value: 'recipe', label: 'Recipe'},
  {value: 'custom', label: 'Custom'}
];

const MECHANIC_KIND_OPTIONS: Array<{
  value: CompendiumMechanicKind;
  label: string;
}> = [
  {value: 'discovery', label: 'Discovery'},
  {value: 'zone', label: 'Zone'},
  {value: 'settlement', label: 'Settlement'},
  {value: 'general', label: 'General'}
];

interface EntriesTabProps {
  activeMechanicsCharacterSheet: CharacterSheet | null;
  activeMechanicsCharacterSheetId: string;
  characterSheets: CharacterSheet[];
  completedActionSet: Set<string>;
  editingMechanicsEntryId: string | null;
  entries: CompendiumEntry[];
  entryDomain: CompendiumDomain;
  entryName: string;
  entityToImportId: string;
  globalCompletedActionSet: Set<string>;
  highlightedEntryId: string | null;
  importDomain: CompendiumDomain;
  importMechanicKind: CompendiumMechanicKind;
  importProgressScope: MechanicsProgressScope;
  isRecordingKey: string | null;
  navigate: NavigateFunction;
  quantityByActionKey: Record<string, number>;
  reviewEntries: CompendiumEntry[];
  ruleset: StoredRuleset | null;
  settlementLocationName: string | null;
  settlementState: SettlementState | null;
  worldEntities: WorldEntity[];
  worldEntityById: Map<string, WorldEntity>;
  zoneProfileBySourceEntityId: Map<string, ZoneAffinityProfile>;
  handleCreateEntry: () => Promise<void>;
  handleImportEntity: () => Promise<void>;
  handleMarkEntryComplete: (entry: CompendiumEntry) => Promise<void>;
  handleOpenEntryMechanicsEditor: (entry: CompendiumEntry) => Promise<void>;
  handleRecordAction: (
    entry: CompendiumEntry,
    action: CompendiumActionDefinition
  ) => Promise<void>;
  handleUpdateEntryMechanics: (
    entry: CompendiumEntry,
    updates: Partial<
      Pick<CompendiumEntry, 'mechanicKind' | 'progressScope' | 'consumable'>
    >
  ) => Promise<void>;
  setActiveMechanicsCharacterSheetId: Dispatch<SetStateAction<string>>;
  setEditingMechanicsEntryId: Dispatch<SetStateAction<string | null>>;
  setEntryDomain: Dispatch<SetStateAction<CompendiumDomain>>;
  setEntryName: Dispatch<SetStateAction<string>>;
  setEntityToImportId: Dispatch<SetStateAction<string>>;
  setImportDomain: Dispatch<SetStateAction<CompendiumDomain>>;
  setImportMechanicKind: Dispatch<SetStateAction<CompendiumMechanicKind>>;
  setImportProgressScope: Dispatch<SetStateAction<MechanicsProgressScope>>;
  setQuantityByActionKey: Dispatch<SetStateAction<Record<string, number>>>;
}

export function EntriesTab({
  activeMechanicsCharacterSheet,
  activeMechanicsCharacterSheetId,
  characterSheets,
  completedActionSet,
  editingMechanicsEntryId,
  entries,
  entryDomain,
  entryName,
  entityToImportId,
  globalCompletedActionSet,
  handleCreateEntry,
  handleImportEntity,
  handleMarkEntryComplete,
  handleOpenEntryMechanicsEditor,
  handleRecordAction,
  handleUpdateEntryMechanics,
  highlightedEntryId,
  importDomain,
  importMechanicKind,
  importProgressScope,
  isRecordingKey,
  navigate,
  quantityByActionKey,
  reviewEntries,
  ruleset,
  setActiveMechanicsCharacterSheetId,
  setEditingMechanicsEntryId,
  setEntryDomain,
  setEntryName,
  setEntityToImportId,
  setImportDomain,
  setImportMechanicKind,
  setImportProgressScope,
  setQuantityByActionKey,
  settlementLocationName,
  settlementState,
  worldEntities,
  worldEntityById,
  zoneProfileBySourceEntityId
}: EntriesTabProps) {
  return (
    <>
      <p className={`${styles.marginTop0} ${styles.marginBottom09rem} ${styles.colorVarColorTextSecondary}`}>
        Create new mechanics records or import from World Bible, then log actions
        from each entry card.
      </p>
      <section
        className={`${styles.marginBottom1rem} ${styles.padding085rem} ${styles.border1pxSolidVarColorBorder} ${styles.borderRadius8px} ${styles.backgroundColorVarColorBgSecondary}`}
      >
        <strong>Discovery Scope</strong>
        <div className={`${styles.fontSize084rem} ${styles.colorVarColorTextSecondary} ${styles.marginTop025rem} ${styles.marginBottom055rem}`}>
          Character-scoped discovery and progression use the selected actor below.
        </div>
        <label className={`${styles.displayBlock} ${styles.maxWidth320px}`}>
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
      </section>
      <div
        className={`${styles.displayGrid} ${styles.gridTemplateColumnsRepeatAutoFitMinmax280px1fr} ${styles.gap1rem} ${styles.marginBottom1rem}`}
      >
        <article className={`${styles.padding1rem} ${styles.border1pxSolidVarColorBorder} ${styles.borderRadius8px}`}>
          <h2 className={styles.marginTop0}>Add Entry</h2>
          <p className={`${styles.marginTop0} ${styles.fontSize085rem} ${styles.colorVarColorTextSecondary}`}>
            Use this for custom creatures, resources, or artifacts not yet in the
            World Bible.
          </p>
          <label className={`${styles.displayBlock} ${styles.marginBottom05rem}`}>
            Name
            <input
              type='text'
              value={entryName}
              onChange={(e) => setEntryName(e.target.value)}
              className={styles.width100}
            />
          </label>
          <label className={`${styles.displayBlock} ${styles.marginBottom075rem}`}>
            Domain
            <select
              value={entryDomain}
              onChange={(e) => setEntryDomain(e.target.value as CompendiumDomain)}
              className={styles.width100}
            >
              {DOMAIN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button type='button' onClick={() => void handleCreateEntry()}>
            Create Entry
          </button>
        </article>

        <article className={`${styles.padding1rem} ${styles.border1pxSolidVarColorBorder} ${styles.borderRadius8px}`}>
          <h2 className={styles.marginTop0}>Import from World Bible</h2>
          <p className={`${styles.marginTop0} ${styles.fontSize085rem} ${styles.colorVarColorTextSecondary}`}>
            Best for existing entities so names stay aligned across tools. Choose what kind of mechanics this record should gain.
          </p>
          <label className={`${styles.displayBlock} ${styles.marginBottom05rem}`}>
            Entity
            <select
              value={entityToImportId}
              onChange={(e) => setEntityToImportId(e.target.value)}
              className={styles.width100}
            >
              <option value=''>Select an entity</option>
              {worldEntities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </select>
          </label>
          <label className={`${styles.displayBlock} ${styles.marginBottom05rem}`}>
            Mechanics type
            <select
              value={importMechanicKind}
              onChange={(e) =>
                setImportMechanicKind(e.target.value as CompendiumMechanicKind)
              }
              className={styles.width100}
            >
              {MECHANIC_KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {importMechanicKind !== 'settlement' && (
            <label className={`${styles.displayBlock} ${styles.marginBottom05rem}`}>
              Progress scope
              <select
                value={importProgressScope === 'party' ? 'global' : importProgressScope}
                onChange={(e) =>
                  setImportProgressScope(e.target.value as MechanicsProgressScope)
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
          )}
          {importProgressScope === 'character' && importMechanicKind !== 'settlement' && (
            <label className={`${styles.displayBlock} ${styles.marginBottom05rem}`}>
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
          <label className={`${styles.displayBlock} ${styles.marginBottom075rem}`}>
            Domain
            <select
              value={importDomain}
              onChange={(e) => setImportDomain(e.target.value as CompendiumDomain)}
              className={styles.width100}
            >
              {DOMAIN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type='button'
            onClick={() => void handleImportEntity()}
            disabled={!entityToImportId}
          >
            Link Mechanics
          </button>
        </article>
      </div>

      <section className={`${styles.padding1rem} ${styles.border1pxSolidVarColorBorder} ${styles.borderRadius8px}`}>
        <h2 className={styles.marginTop0}>Entries</h2>
        {reviewEntries.length > 0 && (
          <div
            className={`${styles.marginBottom085rem} ${styles.padding085rem} ${styles.border1pxSolidVarColorBorder} ${styles.borderRadius8px} ${styles.backgroundColorVarColorBgSecondary}`}
          >
            <div
              className={`${styles.displayFlex} ${styles.justifyContentSpaceBetween} ${styles.alignItemsFlexStart} ${styles.gap075rem} ${styles.flexWrapWrap}`}
            >
              <div>
                <strong>Review Queue</strong>
                <div className={`${styles.fontSize084rem} ${styles.colorVarColorTextSecondary} ${styles.marginTop025rem}`}>
                  Finish imported or placeholder entries before treating mechanics as
                  complete.
                </div>
              </div>
              <span
                className={`${styles.displayInlineFlex} ${styles.alignItemsCenter} ${styles.padding02rem055rem} ${styles.borderRadius999px} ${styles.backgroundColorVarColorBgTertiary} ${styles.colorVarColorTextPrimary} ${styles.fontSize078rem} ${styles.fontWeight700}`}
              >
                {reviewEntries.length} open
              </span>
            </div>
            <div className={`${styles.displayGrid} ${styles.gap06rem} ${styles.marginTop075rem}`}>
              {reviewEntries.slice(0, 8).map((entry) => (
                <div
                  key={`review-${entry.id}`}
                  className={`${styles.border1pxSolidVarColorBgTertiary} ${styles.borderRadius8px} ${styles.backgroundColorVarColorBgPrimary} ${styles.padding07rem}`}
                >
                  <div className={`${styles.displayFlex} ${styles.justifyContentSpaceBetween} ${styles.gap05rem}`}>
                    <strong>{entry.name}</strong>
                    <span className={`${styles.fontSize078rem} ${styles.colorVarColorTextSecondary}`}>[{entry.domain}]</span>
                  </div>
                  <div className={`${styles.fontSize082rem} ${styles.colorVarColorTextSecondary} ${styles.marginTop035rem}`}>
                    {entry.sourceEntityId
                      ? 'Linked from World Bible. Add or adjust the optional mechanics details, then mark complete when ready.'
                      : 'Created directly in mechanics. Fill out the entry intent and mark complete when ready.'}
                  </div>
                  <div className={`${styles.displayFlex} ${styles.gap045rem} ${styles.flexWrapWrap} ${styles.marginTop06rem}`}>
                    {entry.sourceEntityId && (
                      <button
                        type='button'
                        onClick={() =>
                          navigate('/world-bible', {state: {focusEntityId: entry.sourceEntityId}})
                        }
                      >
                        Open source record
                      </button>
                    )}
                    <button
                      type='button'
                      onClick={() => void handleMarkEntryComplete(entry)}
                    >
                      Mark complete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {entries.length === 0 && (
          <div
            className={`${styles.marginBottom085rem} ${styles.padding075rem} ${styles.border1pxSolidVarColorBorder} ${styles.borderRadius6px} ${styles.backgroundColorVarColorBgSecondary}`}
          >
            <p className={`${styles.marginTop0} ${styles.marginBottom06rem}`}>
              No mechanics entries yet.
            </p>
            <div className={`${styles.displayFlex} ${styles.gap05rem} ${styles.flexWrapWrap}`}>
              <button
                type='button'
                onClick={() => {
                  if (!entryName.trim()) setEntryName('First Entry');
                }}
              >
                Create your first entry
              </button>
              <button
                type='button'
                onClick={() => {
                  if (!entityToImportId && worldEntities.length > 0) {
                    setEntityToImportId(worldEntities[0].id);
                  }
                }}
                disabled={worldEntities.length === 0}
              >
                Link your first World Bible record
              </button>
            </div>
          </div>
        )}
        <ul className={`${styles.listStyleNone} ${styles.padding0} ${styles.margin0}`}>
          {entries.map((entry) => {
            const sourceEntity = entry.sourceEntityId
              ? worldEntityById.get(entry.sourceEntityId) ?? null
              : null;
            const linkedZoneProfile = entry.sourceEntityId
              ? zoneProfileBySourceEntityId.get(entry.sourceEntityId) ?? null
              : null;
            const isLinkedSettlement =
              Boolean(entry.sourceEntityId) &&
              settlementState?.sourceEntityId === entry.sourceEntityId;
            return (
              <li
                key={entry.id}
                id={`compendium-entry-${entry.id}`}
                className={`${styles.entryCard} ${
                  highlightedEntryId === entry.id
                    ? styles.entryCardHighlighted
                    : ''
                }`}
              >
                <div
                  className={`${styles.displayFlex} ${styles.alignItemsCenter} ${styles.gap05rem} ${styles.flexWrapWrap}`}
                >
                  <strong>{entry.name}</strong>
                  <span className={`${styles.fontSize085rem} ${styles.colorVarColorTextSecondary}`}>[{entry.domain}]</span>
                  {entry.consumable && (
                    <span className={`${styles.fontSize078rem} ${styles.fontWeight600} ${styles.border1pxSolidVarColorBorder} ${styles.borderRadius999px} ${styles.padding018rem05rem}`}>
                      Consumable · {entry.consumable.durationLabel ?? 'until expired'}
                    </span>
                  )}
                  <button
                    type='button'
                    onClick={() => setEditingMechanicsEntryId((current) => current === entry.id ? null : entry.id)}
                    className={styles.marginLeftAuto}
                  >
                    {editingMechanicsEntryId === entry.id ? 'Close settings' : 'Edit settings'}
                  </button>
                  {entry.needsCompletion && (
                    <span
                      className={`${styles.displayInlineFlex} ${styles.alignItemsCenter} ${styles.padding018rem05rem} ${styles.borderRadius999px} ${styles.backgroundColorVarColorWarningSoftBg} ${styles.border1pxSolidVarColorWarningSoftBorder} ${styles.colorVarColorWarning} ${styles.fontSize078rem} ${styles.fontWeight600}`}
                    >
                      Needs completion
                    </span>
                  )}
                </div>
                {entry.sourceEntityId && (
                  <div className={`${styles.fontSize08rem} ${styles.colorVarColorTextSecondary}`}>
                    Linked to World Bible entity
                  </div>
                )}
                {entry.sourceEntityId && (
                  <div
                    className={`${styles.marginTop055rem} ${styles.marginBottom055rem} ${styles.padding075rem} ${styles.border1pxSolidVarColorAccentSoftBg} ${styles.borderRadius8px} ${styles.backgroundColorVarColorBgSecondary}`}
                  >
                    <div className={`${styles.displayFlex} ${styles.justifyContentSpaceBetween} ${styles.gap075rem} ${styles.flexWrapWrap}`}>
                      <div>
                        <strong>Location Mechanics Summary</strong>
                        <div className={`${styles.fontSize082rem} ${styles.colorVarColorTextSecondary} ${styles.marginTop025rem}`}>
                          {sourceEntity?.name ?? entry.name}
                          {' · '}
                          {entry.mechanicKind === 'zone'
                            ? 'Zone-linked'
                            : entry.mechanicKind === 'settlement'
                              ? 'Settlement-linked'
                              : entry.mechanicKind === 'discovery'
                                ? 'Discovery-tracked'
                                : 'General mechanics'}
                        </div>
                      </div>
                      <div className={`${styles.displayFlex} ${styles.gap045rem} ${styles.flexWrapWrap}`}>
                        <button
                          type='button'
                          onClick={() =>
                            setEditingMechanicsEntryId((current) =>
                              current === entry.id ? null : entry.id
                            )
                          }
                        >
                          {editingMechanicsEntryId === entry.id
                            ? 'Hide Mechanics Settings'
                            : 'Edit Mechanics'}
                        </button>
                        <button
                          type='button'
                          onClick={() => void handleOpenEntryMechanicsEditor(entry)}
                        >
                          {entry.mechanicKind === 'zone'
                            ? linkedZoneProfile
                              ? 'Open Zone Editor'
                              : 'Create Zone Link'
                            : entry.mechanicKind === 'settlement'
                              ? 'Open Settlement Editor'
                              : 'Open Mechanics'}
                        </button>
                        <button
                          type='button'
                          onClick={() =>
                            navigate('/world-bible', {
                              state: {focusEntityId: entry.sourceEntityId}
                            })
                          }
                        >
                          Open World Record
                        </button>
                      </div>
                    </div>
                    <div
                      className={`${styles.displayGrid} ${styles.gridTemplateColumnsRepeatAutoFitMinmax180px1fr} ${styles.gap05rem} ${styles.marginTop065rem} ${styles.fontSize082rem} ${styles.colorVarColorTextSecondary}`}
                    >
                      <div>
                        <strong>Scope:</strong>{' '}
                        {entry.progressScope === 'character'
                          ? activeMechanicsCharacterSheet?.name
                            ? `Per character (${activeMechanicsCharacterSheet.name})`
                            : 'Per character'
                          : 'Shared / global'}
                      </div>
                      <div>
                        <strong>Zone:</strong>{' '}
                        {linkedZoneProfile
                          ? `${linkedZoneProfile.name} (${linkedZoneProfile.progressScope ?? 'character'})`
                          : 'Not linked'}
                      </div>
                      <div>
                        <strong>Settlement:</strong>{' '}
                        {isLinkedSettlement
                          ? settlementLocationName ?? 'Linked'
                          : 'Not linked'}
                      </div>
                    </div>
                  </div>
                )}
                {editingMechanicsEntryId === entry.id && (
                  <div
                    className={`${styles.displayGrid} ${styles.gridTemplateColumnsRepeatAutoFitMinmax180px1fr} ${styles.gap05rem} ${styles.marginTop055rem} ${styles.marginBottom055rem} ${styles.padding075rem} ${styles.border1pxSolidVarColorBorder} ${styles.borderRadius8px} ${styles.backgroundColorVarColorBgSecondary}`}
                  >
                    <label className={`${styles.fontSize082rem} ${styles.colorVarColorTextSecondary}`}>
                      Mechanics type
                      <select
                        value={entry.mechanicKind ?? 'discovery'}
                        onChange={(e) =>
                          void handleUpdateEntryMechanics(entry, {
                            mechanicKind: e.target.value as CompendiumEntry['mechanicKind']
                          })
                        }
                        className={styles.width100}
                      >
                        <option value='discovery'>Discovery</option>
                        <option value='zone'>Zone</option>
                        <option value='settlement'>Settlement</option>
                        <option value='general'>General</option>
                      </select>
                    </label>
                    <label className={`${styles.fontSize082rem} ${styles.colorVarColorTextSecondary}`}>
                      Progress scope
                      <select
                        value={
                          entry.progressScope === 'party'
                            ? 'global'
                            : entry.progressScope ?? 'character'
                        }
                        onChange={(e) =>
                          void handleUpdateEntryMechanics(entry, {
                            progressScope: e.target.value as MechanicsProgressScope
                          })
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
                    {entry.progressScope === 'character' && (
                      <div className={`${styles.fontSize08rem} ${styles.colorVarColorTextSecondary} ${styles.gridColumn11}`}>
                        Recording for:{' '}
                        {activeMechanicsCharacterSheet?.name ?? 'No character sheet selected'}
                      </div>
                    )}
                    <ConsumableEffectEditor
                      entry={entry}
                      ruleset={ruleset}
                      onSave={(consumable) => void handleUpdateEntryMechanics(entry, {consumable})}
                    />
                  </div>
                )}
                {entry.needsCompletion && (
                  <div className={styles.marginTop05rem}>
                    <button
                      type='button'
                      onClick={() => void handleMarkEntryComplete(entry)}
                    >
                      Mark complete
                    </button>
                  </div>
                )}
                <div className={`${styles.displayFlex} ${styles.gap05rem} ${styles.flexWrapWrap} ${styles.marginTop05rem}`}>
                  {entry.actions.map((action) => {
                    const key = `${entry.id}:${action.id}`;
                    const alreadyDone =
                      entry.progressScope === 'character'
                        ? completedActionSet.has(key)
                        : globalCompletedActionSet.has(key);
                    const disabled =
                      isRecordingKey === key || (!action.repeatable && alreadyDone);
                    const quantity = Math.max(1, Math.floor(quantityByActionKey[key] || 1));
                    return (
                      <div key={key} className={`${styles.displayFlex} ${styles.alignItemsCenter} ${styles.gap035rem}`}>
                        {action.repeatable && (
                          <input
                            type='number'
                            min={1}
                            value={quantity}
                            onChange={(e) =>
                              setQuantityByActionKey((prev) => ({
                                ...prev,
                                [key]: Number(e.target.value)
                              }))
                            }
                            className={styles.width58px}
                          />
                        )}
                        <button
                          type='button'
                          onClick={() => void handleRecordAction(entry, action)}
                          disabled={disabled}
                        >
                          {isRecordingKey === key
                            ? 'Logging...'
                            : !action.repeatable && alreadyDone
                              ? `${action.label} complete`
                              : `${action.label} (+${action.points * quantity})`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
