import {useEffect, useState} from 'react';
import type {
  CompendiumConsumableEffect,
  CompendiumConsumableDefinition,
  CompendiumEntry,
  StoredRuleset
} from '../../entityTypes';

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
    <div style={{gridColumn: '1 / -1', borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem'}}>
      <label style={{display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--color-text-primary)'}}>
        <input
          type='checkbox'
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        Consumed from inventory to apply an effect
      </label>
      {enabled && (
        <div style={{display: 'grid', gap: '0.65rem', marginTop: '0.65rem'}}>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem'}}>
            <label style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)'}}>
              Effect/status name
              <input value={statusName} onChange={(event) => setStatusName(event.target.value)} placeholder={`${entry.name} effect`} style={{width: '100%'}} />
            </label>
            <label style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)'}}>
              Duration in the story
              <input value={durationLabel} onChange={(event) => setDurationLabel(event.target.value)} placeholder='20 minutes' style={{width: '100%'}} />
            </label>
          </div>
          <div>
            <strong style={{fontSize: '0.82rem'}}>Stat and resource effects</strong>
            {effects.map((effect) => (
              <div key={effect.id} style={{display: 'grid', gridTemplateColumns: 'minmax(130px, 0.7fr) minmax(160px, 1fr) minmax(100px, 0.5fr) auto', gap: '0.5rem', marginTop: '0.4rem'}}>
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
            <button type='button' onClick={() => setEffects((current) => [...current, newEffect(ruleset)])} style={{marginTop: '0.45rem'}}>Add effect</button>
          </div>
          <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap'}}>
            <button type='button' onClick={save} disabled={!ruleset || effects.every((effect) => !effect.delta)}>Save consumable effect</button>
            <span style={{fontSize: '0.8rem', color: 'var(--color-text-secondary)'}}>Expiration is placed later at a scene cursor, so narrative time stays author-controlled.</span>
          </div>
        </div>
      )}
      {!enabled && entry.consumable && (
        <button type='button' onClick={save} style={{marginTop: '0.5rem'}}>Remove saved consumable effect</button>
      )}
    </div>
  );
}
