import {useEffect, useState} from 'react';
import type {
  CompendiumConsumableEffect,
  CompendiumConsumableDefinition,
  CompendiumEntry,
  StoredRuleset
} from '../../entityTypes';
import styles from './ConsumableEffectEditor.module.css';

interface DraftEffect {
  id: string;
  type: CompendiumConsumableEffect['type'];
  definitionId: string;
  delta: string;
}

interface ConsumableEffectEditorProps {
  entry: CompendiumEntry;
  ruleset: StoredRuleset | null;
  onSave: (definition: CompendiumConsumableDefinition | undefined) => void;
}

const newEffect = (
  ruleset: StoredRuleset | null,
  type: CompendiumConsumableEffect['type'] = 'stat_change'
): DraftEffect => ({
  id: crypto.randomUUID(),
  type,
  definitionId: type === 'stat_change'
    ? ruleset?.statDefinitions[0]?.id ?? ''
    : ruleset?.resourceDefinitions[0]?.id ?? '',
  delta: ''
});

export function ConsumableEffectEditor({
  entry,
  ruleset,
  onSave
}: ConsumableEffectEditorProps) {
  const [enabled, setEnabled] = useState(Boolean(entry.consumable));
  const [statusName, setStatusName] = useState(entry.consumable?.statusName ?? '');
  const [durationLabel, setDurationLabel] = useState(entry.consumable?.durationLabel ?? '');
  const [effects, setEffects] = useState<DraftEffect[]>(() =>
    entry.consumable?.effects
      .map((effect) => ({
        id: crypto.randomUUID(),
        type: effect.type,
        definitionId: effect.definitionId,
        delta: String(effect.delta)
      })) ?? [newEffect(ruleset)]
  );

  useEffect(() => {
    setEnabled(Boolean(entry.consumable));
    setStatusName(entry.consumable?.statusName ?? '');
    setDurationLabel(entry.consumable?.durationLabel ?? '');
    const savedEffects = entry.consumable?.effects ?? [];
    setEffects(savedEffects.length > 0
      ? savedEffects.map((effect) => ({
          id: crypto.randomUUID(),
          type: effect.type,
          definitionId: effect.definitionId,
          delta: String(effect.delta)
        }))
      : [newEffect(ruleset)]);
    // Reset the form when a different or newly saved entry arrives (id and
    // updatedAt), not on every edit that only changes the entry's identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id, entry.updatedAt, ruleset]);

  const save = () => {
    if (!enabled) {
      onSave(undefined);
      return;
    }
    const parsedEffects = effects
      .map((effect) => ({...effect, parsedDelta: Number(effect.delta)}))
      .filter((effect) => effect.definitionId && Number.isFinite(effect.parsedDelta) && effect.parsedDelta !== 0)
      .map((effect) => ({
        type: effect.type,
        definitionId: effect.definitionId,
        delta: effect.parsedDelta
      }));
    if (parsedEffects.length === 0) return;
    onSave({
      durationLabel: durationLabel.trim() || undefined,
      statusName: statusName.trim() || undefined,
      effects: parsedEffects
    });
  };

  return (
    <div className={styles.editor}>
      <label className={styles.toggle}>
        <input
          type='checkbox'
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        Consumed from inventory to apply an effect
      </label>
      {enabled && (
        <div className={styles.form}>
          <div className={styles.details}>
            <label className={styles.field}>
              Effect/status name
              <input value={statusName} onChange={(event) => setStatusName(event.target.value)} placeholder={`${entry.name} effect`} />
            </label>
            <label className={styles.field}>
              Duration in the story
              <input value={durationLabel} onChange={(event) => setDurationLabel(event.target.value)} placeholder='20 minutes' />
            </label>
          </div>
          <div>
            <strong className={styles.effectsHeading}>Stat and resource effects</strong>
            {effects.map((effect) => (
              <div key={effect.id} className={styles.effectRow}>
                <select
                  aria-label='Effect type'
                  value={effect.type}
                  onChange={(event) => {
                    const type = event.target.value as CompendiumConsumableEffect['type'];
                    const definitionId = type === 'stat_change'
                      ? ruleset?.statDefinitions[0]?.id ?? ''
                      : ruleset?.resourceDefinitions[0]?.id ?? '';
                    setEffects((current) => current.map((item) => item.id === effect.id
                      ? {...item, type, definitionId, delta: ''}
                      : item));
                  }}
                >
                  <option value='stat_change'>Stat</option>
                  <option value='resource_change'>Resource</option>
                </select>
                <select value={effect.definitionId} onChange={(event) => setEffects((current) => current.map((item) => item.id === effect.id ? {...item, definitionId: event.target.value} : item))}>
                  {(effect.type === 'stat_change'
                    ? ruleset?.statDefinitions
                    : ruleset?.resourceDefinitions
                  )?.map((definition) => <option key={definition.id} value={definition.id}>{definition.name}</option>)}
                </select>
                <input type='number' value={effect.delta} onChange={(event) => setEffects((current) => current.map((item) => item.id === effect.id ? {...item, delta: event.target.value} : item))} placeholder='+5 or -2' aria-label='Effect adjustment' />
                <button type='button' disabled={effects.length === 1} onClick={() => setEffects((current) => current.filter((item) => item.id !== effect.id))}>Remove</button>
              </div>
            ))}
            <button type='button' onClick={() => setEffects((current) => [...current, newEffect(ruleset)])} className={styles.addEffect}>Add effect</button>
          </div>
          <div className={styles.actions}>
            <button type='button' onClick={save} disabled={!ruleset || effects.every((effect) => !effect.delta)}>Save consumable effect</button>
            <span className={styles.hint}>Expiration is placed later at a scene cursor, so narrative time stays author-controlled.</span>
          </div>
        </div>
      )}
      {!enabled && entry.consumable && (
        <button type='button' onClick={save} className={styles.removeSaved}>Remove saved consumable effect</button>
      )}
    </div>
  );
}
