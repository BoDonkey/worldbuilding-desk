import {useEffect, useId, useMemo, useState} from 'react';
import type {CharacterSheet, StateMutationEvent, StoredRuleset} from '../../entityTypes';
import type {FirstTrackedValueKind} from '../../services/characters';
import {replayCharacterState} from '../../services/state/stateReplay';
import styles from '../../assets/components/WorldBibleRoute.module.css';

interface WorldBibleMechanicsPanelProps {
  characterSheet: CharacterSheet | null;
  ruleset: StoredRuleset | null;
  hasRuleset: boolean;
  stateEventCount: number;
  stateEvents: StateMutationEvent[];
  isSaving: boolean;
  isOpeningSheet: boolean;
  onCreate: (input: {kind: FirstTrackedValueKind; name: string; defaultValue: number}) => Promise<void>;
  onRecordChange: () => void;
  onOpenAdvanced: () => void;
  onAddSheet: () => void;
  draftStorageKey: string;
}

export function WorldBibleMechanicsPanel({
  characterSheet, ruleset, hasRuleset, stateEventCount, stateEvents, isSaving, isOpeningSheet,
  onCreate, onRecordChange, onOpenAdvanced, onAddSheet, draftStorageKey
}: WorldBibleMechanicsPanelProps) {
  const savedDraft = useMemo(() => {
    try {
      return JSON.parse(window.localStorage.getItem(draftStorageKey) ?? 'null') as {
        isAdding?: boolean; kind?: FirstTrackedValueKind; name?: string; defaultValue?: string;
      } | null;
    } catch { return null; }
  }, [draftStorageKey]);
  const [isAdding, setIsAdding] = useState(savedDraft?.isAdding ?? false);
  const [kind, setKind] = useState<FirstTrackedValueKind>(savedDraft?.kind ?? 'resource');
  const [name, setName] = useState(savedDraft?.name ?? 'Health');
  const [defaultValue, setDefaultValue] = useState(savedDraft?.defaultValue ?? '100');
  const [error, setError] = useState('');
  const errorId = useId();

  useEffect(() => {
    if (!isAdding) return;
    window.localStorage.setItem(draftStorageKey, JSON.stringify({isAdding, kind, name, defaultValue}));
  }, [defaultValue, draftStorageKey, isAdding, kind, name]);

  if (hasRuleset && !ruleset) {
    return <p className={styles.characterDetailUnlockHint}>Loading character mechanics…</p>;
  }

  if (!ruleset) {
    return (
      <div className={styles.characterCapabilityPanel}>
        {!isAdding ? (
          <div className={styles.characterCapabilityEmpty}>
            <p>
              Mechanics are optional. Add one useful value when you want the story
              to remember how this character changes from scene to scene.
            </p>
            <button type='button' className={styles.primaryButton} onClick={() => setIsAdding(true)}>
              Add mechanics
            </button>
          </div>
        ) : (
          <div
            className={styles.firstMechanicsForm}
          >
            <fieldset>
              <legend>What kind of value is this?</legend>
              <label>
                <input type='radio' checked={kind === 'stat'} onChange={() => { setKind('stat'); setName('Resolve'); setDefaultValue('5'); }} />
                <span><strong>Stat</strong><small>A relatively stable quality, such as Strength or Resolve.</small></span>
              </label>
              <label>
                <input type='radio' checked={kind === 'resource'} onChange={() => { setKind('resource'); setName('Health'); setDefaultValue('100'); }} />
                <span><strong>Resource</strong><small>A value that changes often, such as Health or Mana.</small></span>
              </label>
            </fieldset>
            <div className={styles.firstMechanicsFields}>
              <label>Value name<input autoFocus type='text' value={name} onChange={(event) => setName(event.target.value)} aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined} /></label>
              <label>Starting value<input type='number' value={defaultValue} onChange={(event) => setDefaultValue(event.target.value)} aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined} /></label>
            </div>
            {error && <p id={errorId} role='alert' className={styles.firstMechanicsError}>{error}</p>}
            <p className={styles.characterDetailUnlockHint}>
              Confirming creates this project’s tracking setup and attaches one sheet
              to this canonical character. Nothing is written until you confirm.
            </p>
            <div className={styles.reviewToolbarActions}>
              <button type='button' onClick={() => { window.localStorage.removeItem(draftStorageKey); setIsAdding(false); }} disabled={isSaving}>Cancel</button>
              <button type='button' className={styles.primaryButton} disabled={isSaving} onClick={() => {
                const value = Number(defaultValue);
                if (!name.trim() || !Number.isFinite(value)) {
                  setError('Enter a name and valid starting value.');
                  return;
                }
                setError('');
                void onCreate({kind, name: name.trim(), defaultValue: value});
              }}>
                {isSaving ? 'Enabling…' : 'Enable tracking'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const currentState = characterSheet ? replayCharacterState({
    sheet: characterSheet,
    ruleset,
    events: stateEvents,
    target: {
      actorId: characterSheet.characterEntityId,
      characterId: characterSheet.characterId,
      sheetId: characterSheet.id,
      actorName: characterSheet.name
    }
  }) : null;
  const statValues = characterSheet?.stats.map((stat) => ({
    id: stat.definitionId,
    label: ruleset.statDefinitions.find((definition) => definition.id === stat.definitionId)?.name ?? 'Stat',
    value: String(currentState?.stats[stat.definitionId] ?? stat.value)
  })) ?? [];
  const resourceValues = characterSheet?.resources.map((resource) => ({
    id: resource.definitionId,
    label: ruleset.resourceDefinitions.find((definition) => definition.id === resource.definitionId)?.name ?? 'Resource',
    value: `${currentState?.resources.current[resource.definitionId] ?? resource.current} / ${currentState?.resources.max[resource.definitionId] ?? resource.max}`
  })) ?? [];

  return (
    <div className={styles.characterCapabilityPanel}>
      <div className={styles.characterCapabilitySummary}>
        {[...statValues, ...resourceValues].map((value) => (
          <div key={value.id}><span>{value.label}</span><strong>{value.value}</strong></div>
        ))}
        <div><span>Recorded scene changes</span><strong>{stateEventCount}</strong></div>
      </div>
      <div className={styles.reviewToolbarActions}>
        {characterSheet ? (
          <button type='button' className={styles.primaryButton} onClick={onRecordChange}>Record a scene change</button>
        ) : (
          <button type='button' className={styles.primaryButton} onClick={onAddSheet} disabled={isOpeningSheet}>
            {isOpeningSheet ? 'Adding…' : 'Add mechanics to this character'}
          </button>
        )}
        <button type='button' onClick={onOpenAdvanced}>Advanced sheet and state</button>
      </div>
    </div>
  );
}
