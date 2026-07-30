import type {Dispatch, SetStateAction} from 'react';
import type {NavigateFunction} from 'react-router-dom';
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
      <p style={{marginTop: 0, marginBottom: '0.9rem', color: 'var(--color-text-secondary)'}}>
        Create new mechanics records or import from World Bible, then log actions
        from each entry card.
      </p>
      <section
        style={{
          marginBottom: '1rem',
          padding: '0.85rem',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          backgroundColor: 'var(--color-bg-secondary)'
        }}
      >
        <strong>Discovery Scope</strong>
        <div style={{fontSize: '0.84rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem', marginBottom: '0.55rem'}}>
          Character-scoped discovery and progression use the selected actor below.
        </div>
        <label style={{display: 'block', maxWidth: '320px'}}>
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
      </section>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
          marginBottom: '1rem'
        }}
      >
        <article style={{padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px'}}>
          <h2 style={{marginTop: 0}}>Add Entry</h2>
          <p style={{marginTop: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)'}}>
            Use this for custom creatures, resources, or artifacts not yet in the
            World Bible.
          </p>
          <label style={{display: 'block', marginBottom: '0.5rem'}}>
            Name
            <input
              type='text'
              value={entryName}
              onChange={(e) => setEntryName(e.target.value)}
              style={{width: '100%'}}
            />
          </label>
          <label style={{display: 'block', marginBottom: '0.75rem'}}>
            Domain
            <select
              value={entryDomain}
              onChange={(e) => setEntryDomain(e.target.value as CompendiumDomain)}
              style={{width: '100%'}}
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

        <article style={{padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px'}}>
          <h2 style={{marginTop: 0}}>Import from World Bible</h2>
          <p style={{marginTop: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)'}}>
            Best for existing entities so names stay aligned across tools. Choose what kind of mechanics this record should gain.
          </p>
          <label style={{display: 'block', marginBottom: '0.5rem'}}>
            Entity
            <select
              value={entityToImportId}
              onChange={(e) => setEntityToImportId(e.target.value)}
              style={{width: '100%'}}
            >
              <option value=''>Select an entity</option>
              {worldEntities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{display: 'block', marginBottom: '0.5rem'}}>
            Mechanics type
            <select
              value={importMechanicKind}
              onChange={(e) =>
                setImportMechanicKind(e.target.value as CompendiumMechanicKind)
              }
              style={{width: '100%'}}
            >
              {MECHANIC_KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {importMechanicKind !== 'settlement' && (
            <label style={{display: 'block', marginBottom: '0.5rem'}}>
              Progress scope
              <select
                value={importProgressScope === 'party' ? 'global' : importProgressScope}
                onChange={(e) =>
                  setImportProgressScope(e.target.value as MechanicsProgressScope)
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
          )}
          {importProgressScope === 'character' && importMechanicKind !== 'settlement' && (
            <label style={{display: 'block', marginBottom: '0.5rem'}}>
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
          <label style={{display: 'block', marginBottom: '0.75rem'}}>
            Domain
            <select
              value={importDomain}
              onChange={(e) => setImportDomain(e.target.value as CompendiumDomain)}
              style={{width: '100%'}}
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

      <section style={{padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px'}}>
        <h2 style={{marginTop: 0}}>Entries</h2>
        {reviewEntries.length > 0 && (
          <div
            style={{
              marginBottom: '0.85rem',
              padding: '0.85rem',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              backgroundColor: 'var(--color-bg-secondary)'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '0.75rem',
                flexWrap: 'wrap'
              }}
            >
              <div>
                <strong>Review Queue</strong>
                <div style={{fontSize: '0.84rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem'}}>
                  Finish imported or placeholder entries before treating mechanics as
                  complete.
                </div>
              </div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '999px',
                  backgroundColor: 'var(--color-bg-tertiary)',
                  color: 'var(--color-text-primary)',
                  fontSize: '0.78rem',
                  fontWeight: 700
                }}
              >
                {reviewEntries.length} open
              </span>
            </div>
            <div style={{display: 'grid', gap: '0.6rem', marginTop: '0.75rem'}}>
              {reviewEntries.slice(0, 8).map((entry) => (
                <div
                  key={`review-${entry.id}`}
                  style={{
                    border: '1px solid var(--color-bg-tertiary)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-bg-primary)',
                    padding: '0.7rem'
                  }}
                >
                  <div style={{display: 'flex', justifyContent: 'space-between', gap: '0.5rem'}}>
                    <strong>{entry.name}</strong>
                    <span style={{fontSize: '0.78rem', color: 'var(--color-text-secondary)'}}>[{entry.domain}]</span>
                  </div>
                  <div style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: '0.35rem'}}>
                    {entry.sourceEntityId
                      ? 'Linked from World Bible. Add or adjust the optional mechanics details, then mark complete when ready.'
                      : 'Created directly in mechanics. Fill out the entry intent and mark complete when ready.'}
                  </div>
                  <div style={{display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.6rem'}}>
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
            style={{
              marginBottom: '0.85rem',
              padding: '0.75rem',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              backgroundColor: 'var(--color-bg-secondary)'
            }}
          >
            <p style={{marginTop: 0, marginBottom: '0.6rem'}}>
              No mechanics entries yet.
            </p>
            <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
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
        <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
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
                style={{
                  border:
                    highlightedEntryId === entry.id
                      ? '1px solid var(--color-accent)'
                      : '1px solid var(--color-border)',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  marginBottom: '0.75rem',
                  backgroundColor:
                    highlightedEntryId === entry.id ? 'var(--color-accent-soft-bg)' : 'transparent',
                  boxShadow:
                    highlightedEntryId === entry.id
                      ? '0 0 0 1px color-mix(in oklab, var(--color-accent) 10%, transparent)'
                      : 'none'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    flexWrap: 'wrap'
                  }}
                >
                  <strong>{entry.name}</strong>
                  <span style={{fontSize: '0.85rem', color: 'var(--color-text-secondary)'}}>[{entry.domain}]</span>
                  {entry.consumable && (
                    <span style={{fontSize: '0.78rem', fontWeight: 600, border: '1px solid var(--color-border)', borderRadius: '999px', padding: '0.18rem 0.5rem'}}>
                      Consumable · {entry.consumable.durationLabel ?? 'until expired'}
                    </span>
                  )}
                  <button
                    type='button'
                    onClick={() => setEditingMechanicsEntryId((current) => current === entry.id ? null : entry.id)}
                    style={{marginLeft: 'auto'}}
                  >
                    {editingMechanicsEntryId === entry.id ? 'Close settings' : 'Edit settings'}
                  </button>
                  {entry.needsCompletion && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '0.18rem 0.5rem',
                        borderRadius: '999px',
                        backgroundColor: 'var(--color-warning-soft-bg)',
                        border: '1px solid var(--color-warning-soft-border)',
                        color: 'var(--color-warning)',
                        fontSize: '0.78rem',
                        fontWeight: 600
                      }}
                    >
                      Needs completion
                    </span>
                  )}
                </div>
                {entry.sourceEntityId && (
                  <div style={{fontSize: '0.8rem', color: 'var(--color-text-secondary)'}}>
                    Linked to World Bible entity
                  </div>
                )}
                {entry.sourceEntityId && (
                  <div
                    style={{
                      marginTop: '0.55rem',
                      marginBottom: '0.55rem',
                      padding: '0.75rem',
                      border: '1px solid var(--color-accent-soft-bg)',
                      borderRadius: '8px',
                      backgroundColor: 'var(--color-bg-secondary)'
                    }}
                  >
                    <div style={{display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap'}}>
                      <div>
                        <strong>Location Mechanics Summary</strong>
                        <div style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem'}}>
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
                      <div style={{display: 'flex', gap: '0.45rem', flexWrap: 'wrap'}}>
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
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '0.5rem',
                        marginTop: '0.65rem',
                        fontSize: '0.82rem',
                        color: 'var(--color-text-secondary)'
                      }}
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
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '0.5rem',
                      marginTop: '0.55rem',
                      marginBottom: '0.55rem',
                      padding: '0.75rem',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      backgroundColor: 'var(--color-bg-secondary)'
                    }}
                  >
                    <label style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)'}}>
                      Mechanics type
                      <select
                        value={entry.mechanicKind ?? 'discovery'}
                        onChange={(e) =>
                          void handleUpdateEntryMechanics(entry, {
                            mechanicKind: e.target.value as CompendiumEntry['mechanicKind']
                          })
                        }
                        style={{width: '100%'}}
                      >
                        <option value='discovery'>Discovery</option>
                        <option value='zone'>Zone</option>
                        <option value='settlement'>Settlement</option>
                        <option value='general'>General</option>
                      </select>
                    </label>
                    <label style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)'}}>
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
                        style={{width: '100%'}}
                      >
                        {MECHANICS_SCOPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {entry.progressScope === 'character' && (
                      <div style={{fontSize: '0.8rem', color: 'var(--color-text-secondary)', gridColumn: '1 / -1'}}>
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
                  <div style={{marginTop: '0.5rem'}}>
                    <button
                      type='button'
                      onClick={() => void handleMarkEntryComplete(entry)}
                    >
                      Mark complete
                    </button>
                  </div>
                )}
                <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem'}}>
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
                      <div key={key} style={{display: 'flex', alignItems: 'center', gap: '0.35rem'}}>
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
                            style={{width: '58px'}}
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
