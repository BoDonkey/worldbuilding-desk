import {useMemo, useState} from 'react';
import type {EntityCategory, UnitConversion, WorldEntity, WorldMap} from '../../entityTypes';
import {useConfirmDialog} from '../../hooks/useConfirmDialog';
import {useProjectMaps} from '../../hooks/useProjectMaps';
import {describeError} from '../../services/errors';
import {useNotificationStore} from '../../store/notificationStore';
import {InlineAlert} from '../common/InlineAlert';
import {mapAncestors, normalizeUnitConversions, parentMapOptions} from '../../services/worldBible/maps';
import {placesById} from '../../services/worldBible/places';
import shared from './worldBibleShared.module.css';
import styles from './MapsPanel.module.css';

interface MapsPanelProps {
  categories: EntityCategory[];
  entities: WorldEntity[];
}

interface MapForm {
  id?: string;
  name: string;
  distanceUnit: string;
  scale: string;
  parentMapId: string;
  parentX: string;
  parentY: string;
}

const EMPTY_FORM: MapForm = {name: '', distanceUnit: 'miles', scale: '1', parentMapId: '', parentX: '', parentY: ''};
const UNIT_SUGGESTIONS = ['miles', 'kilometres', 'leagues', 'feet', 'metres', 'squares', 'hexes'];

const formFor = (map: WorldMap): MapForm => ({
  id: map.id,
  name: map.name,
  distanceUnit: map.distanceUnit,
  scale: String(map.scale),
  parentMapId: map.parentPlacement?.mapId ?? '',
  parentX: map.parentPlacement ? String(map.parentPlacement.x) : '',
  parentY: map.parentPlacement ? String(map.parentPlacement.y) : ''
});

const numberOrNaN = (value: string): number => (value.trim() === '' ? Number.NaN : Number(value));

/**
 * Maps of the world and the author's unit conversions (slice 4.79). There is
 * no map surface yet (4.80): places are put on a map with numbers in their
 * location record. A map can sit, as one point, on a larger map.
 */
export function MapsPanel({categories, entities}: MapsPanelProps) {
  const {maps, mapsById, conversions, saveMapInput, removeMap, saveConversions} = useProjectMaps();
  const {requestConfirm, confirmDialog} = useConfirmDialog();
  const [form, setForm] = useState<MapForm | null>(null);
  const [conversionDraft, setConversionDraft] = useState<UnitConversion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pushToast = useNotificationStore((state) => state.pushToast);
  const notify = (message: string) => pushToast({tone: 'success', message});

  const placeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const place of placesById(categories, entities).values()) {
      for (const placement of place.place?.placements ?? []) {
        counts.set(placement.mapId, (counts.get(placement.mapId) ?? 0) + 1);
      }
    }
    return counts;
  }, [categories, entities]);
  const parentOptions = useMemo(
    () => parentMapOptions(form?.id ?? null, mapsById),
    [form?.id, mapsById]
  );

  const update = (change: Partial<MapForm>) => setForm((current) => (current ? {...current, ...change} : current));

  const submit = async () => {
    if (!form) return;
    try {
      const problem = await saveMapInput({
        id: form.id,
        name: form.name,
        distanceUnit: form.distanceUnit,
        scale: numberOrNaN(form.scale),
        parentPlacement: form.parentMapId
          ? {mapId: form.parentMapId, x: numberOrNaN(form.parentX), y: numberOrNaN(form.parentY)}
          : undefined
      });
      if (problem) {
        setError(problem);
        return;
      }
      setError(null);
      notify(`Saved ${form.name.trim()}.`);
      setForm(null);
    } catch (caught) {
      setError(describeError(caught, 'Unable to save the map.'));
    }
  };

  const confirmRemove = (map: WorldMap) => {
    const children = maps.filter((candidate) => candidate.parentPlacement?.mapId === map.id);
    const placed = placeCounts.get(map.id) ?? 0;
    requestConfirm({
      title: `Delete ${map.name}?`,
      message: [
        placed > 0 ? `${placed} place${placed === 1 ? ' loses its' : 's lose their'} point on this map.` : '',
        children.length > 0 ? `${children.map((child) => child.name).join(', ')} will no longer sit on a larger map.` : '',
        'Places themselves are not changed.'
      ].filter(Boolean).join(' '),
      confirmLabel: 'Delete map',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await removeMap(map.id);
          notify(`Deleted ${map.name}.`);
        } catch (caught) {
          setError(describeError(caught, 'Unable to delete the map.'));
        }
      }
    });
  };

  const saveConversionDraft = async () => {
    if (!conversionDraft) return;
    try {
      const problem = await saveConversions(conversionDraft);
      if (problem) {
        setError(problem);
        return;
      }
    } catch (caught) {
      setError(describeError(caught, 'Unable to save the unit conversions.'));
      return;
    }
    const kept = normalizeUnitConversions(conversionDraft).length;
    setError(null);
    setConversionDraft(null);
    notify(kept < conversionDraft.length
      ? `Saved ${kept} unit conversion${kept === 1 ? '' : 's'}. Rows missing a unit or a number above zero were left out.`
      : 'Saved unit conversions.');
  };

  const updateConversion = (index: number, change: Partial<UnitConversion>) =>
    setConversionDraft((current) =>
      (current ?? []).map((conversion, position) => (position === index ? {...conversion, ...change} : conversion))
    );

  return (
    <section className={styles.panel} aria-labelledby='maps-panel-title'>
      <div className={styles.header}>
        <div>
          <div className={shared.castEyebrow}>Maps</div>
          <h2 id='maps-panel-title'>Maps and distances</h2>
          <p>Each map has its own unit and scale. Put a place on a map from its record.</p>
        </div>
        {!form && (
          <button type='button' className={styles.actionButton} onClick={() => { setForm(EMPTY_FORM); setError(null); }}>
            New map
          </button>
        )}
      </div>

      <datalist id='map-unit-suggestions'>
        {UNIT_SUGGESTIONS.map((unit) => <option key={unit} value={unit} />)}
      </datalist>

      {error && <InlineAlert variant='error' message={error} onDismiss={() => setError(null)} />}

      {form && (
        <form
          className={styles.form}
          aria-label={form.id ? `Edit map ${form.name}` : 'New map'}
          onSubmit={(event) => { event.preventDefault(); void submit(); }}
        >
          <label className={styles.field}>
            Name
            <input value={form.name} onChange={(event) => update({name: event.target.value})} />
          </label>
          <label className={styles.field}>
            Distance unit
            <input list='map-unit-suggestions' value={form.distanceUnit} onChange={(event) => update({distanceUnit: event.target.value})} />
          </label>
          <label className={styles.field}>
            One map unit is this many {form.distanceUnit.trim() || 'units'}
            <input type='number' min={0} step='any' value={form.scale} onChange={(event) => update({scale: event.target.value})} />
          </label>
          <label className={styles.field}>
            Sits on
            <select value={form.parentMapId} onChange={(event) => update({parentMapId: event.target.value})}>
              <option value=''>Not on a larger map</option>
              {parentOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          {form.parentMapId && (
            <div className={styles.pointRow} role='group' aria-label='Point on the larger map'>
              <label className={styles.field}>
                X
                <input type='number' step='any' value={form.parentX} onChange={(event) => update({parentX: event.target.value})} />
              </label>
              <label className={styles.field}>
                Y
                <input type='number' step='any' value={form.parentY} onChange={(event) => update({parentY: event.target.value})} />
              </label>
            </div>
          )}
          <div className={shared.formActions}>
            <button type='submit' className={shared.primaryButton}>Save map</button>
            <button type='button' onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}

      {maps.length === 0 ? (
        !form && <p className={styles.empty}>No maps yet.</p>
      ) : (
        <ul className={styles.mapList} aria-label='Maps'>
          {maps.map((map) => {
            const parents = mapAncestors(map.id, mapsById);
            const placed = placeCounts.get(map.id) ?? 0;
            return (
              <li key={map.id} className={styles.mapCard}>
                <div>
                  <strong>{map.name}</strong>
                  <small>
                    1 map unit = {map.scale} {map.distanceUnit}
                    {parents.length > 0 && map.parentPlacement
                      ? ` · on ${parents[0].name} at (${map.parentPlacement.x}, ${map.parentPlacement.y})`
                      : ''}
                    {` · ${placed} place${placed === 1 ? '' : 's'}`}
                  </small>
                </div>
                <div className={styles.mapActions}>
                  <button type='button' onClick={() => { setForm(formFor(map)); setError(null); }}>Edit</button>
                  <button type='button' className={shared.dismissButton} onClick={() => confirmRemove(map)}>Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <section className={styles.conversions} aria-labelledby='unit-conversions-title'>
        <h3 id='unit-conversions-title'>Unit conversions</h3>
        <p className={styles.empty}>
          Routes add up legs only in units linked here. Without a conversion, figures in different units are shown side by side.
        </p>
        {conversionDraft === null ? (
          <>
            {conversions.length > 0 && (
              <ul className={styles.conversionList}>
                {conversions.map((conversion) => (
                  <li key={`${conversion.from}:${conversion.to}`}>1 {conversion.from} = {conversion.factor} {conversion.to}</li>
                ))}
              </ul>
            )}
            <button type='button' className={styles.actionButton} onClick={() => setConversionDraft(conversions.length > 0 ? conversions : [{from: '', to: '', factor: 1}])}>
              Edit conversions
            </button>
          </>
        ) : (
          <div className={styles.form}>
            {conversionDraft.map((conversion, index) => (
              <div key={index} className={styles.conversionRow} role='group' aria-label={`Conversion ${index + 1}`}>
                <span>1</span>
                <input aria-label='From unit' list='map-unit-suggestions' value={conversion.from} onChange={(event) => updateConversion(index, {from: event.target.value})} />
                <span>=</span>
                <input aria-label='Factor' type='number' min={0} step='any' value={Number.isFinite(conversion.factor) ? conversion.factor : ''} onChange={(event) => updateConversion(index, {factor: numberOrNaN(event.target.value)})} />
                <input aria-label='To unit' list='map-unit-suggestions' value={conversion.to} onChange={(event) => updateConversion(index, {to: event.target.value})} />
                <button type='button' className={shared.dismissButton} onClick={() => setConversionDraft((current) => (current ?? []).filter((_, position) => position !== index))}>
                  Remove
                </button>
              </div>
            ))}
            <div className={shared.formActions}>
              <button type='button' onClick={() => setConversionDraft((current) => [...(current ?? []), {from: '', to: '', factor: 1}])}>
                Add conversion
              </button>
              <button type='button' className={shared.primaryButton} onClick={() => void saveConversionDraft()}>Save conversions</button>
              <button type='button' onClick={() => setConversionDraft(null)}>Cancel</button>
            </div>
          </div>
        )}
      </section>
      {confirmDialog}
    </section>
  );
}
