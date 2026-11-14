import {useMemo} from 'react';
import type {
  AuthoredMeasure,
  EntityCategory,
  PlaceConnection,
  PlaceTravelTime,
  WorldEntity
} from '../../../entityTypes';
import {
  childPlaces,
  connectionsForPlace,
  describeConnectionMeasures,
  parentPlaceOptions,
  placeAncestors,
  placesById
} from '../../../services/worldBible/places';
import shared from '../worldBibleShared.module.css';
import styles from './RecordPlaceSection.module.css';
import type {WorldBibleRecordDraft} from './useWorldBibleRecordDraft';
import type {OpenRecord} from './recordTypes';
import {RecordPlaceMaps} from './RecordPlaceMaps';

interface RecordPlaceSectionProps {
  categories: EntityCategory[];
  entities: WorldEntity[];
  draft: WorldBibleRecordDraft;
  onEdit: OpenRecord;
}

const CONNECTION_KIND_SUGGESTIONS = ['road', 'river', 'path', 'bridge', 'portal', 'stairway', 'tunnel', 'sea route'];

const amountFromInput = (value: string): number | undefined => {
  if (value.trim() === '') return undefined;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : undefined;
};

interface MeasureInputsProps {
  label: string;
  measure: AuthoredMeasure | undefined;
  wordsPlaceholder: string;
  unitPlaceholder: string;
  onChange: (measure: AuthoredMeasure) => void;
}

/** The author's words, plus an optional number and unit. */
function MeasureInputs({label, measure, wordsPlaceholder, unitPlaceholder, onChange}: MeasureInputsProps) {
  return (
    <div className={styles.measureRow} role='group' aria-label={label}>
      <input
        aria-label={`${label} in your words`}
        placeholder={wordsPlaceholder}
        value={measure?.words ?? ''}
        onChange={(event) => onChange({...measure, words: event.target.value})}
      />
      <input
        aria-label={`${label} amount`}
        type='number'
        min={0}
        step='any'
        placeholder='Number'
        value={measure?.amount ?? ''}
        onChange={(event) => onChange({...measure, amount: amountFromInput(event.target.value)})}
      />
      <input
        aria-label={`${label} unit`}
        placeholder={unitPlaceholder}
        value={measure?.unit ?? ''}
        onChange={(event) => onChange({...measure, unit: event.target.value})}
      />
    </div>
  );
}

/**
 * Where a location sits and how it connects (slice 4.76): one parent place,
 * the places inside it, and connections with authored distance and travel
 * times. Connections this record stores are edited here; ones other places
 * store are listed with a link to that record.
 */
export function RecordPlaceSection({categories, entities, draft, onEdit}: RecordPlaceSectionProps) {
  const {editingId, placeParentId, setPlaceParentId, placeConnections, setPlaceConnections} = draft;
  const places = useMemo(() => placesById(categories, entities), [categories, entities]);
  const parentOptions = useMemo(() => parentPlaceOptions(editingId, places), [editingId, places]);
  const destinations = useMemo(
    () => [...places.values()]
      .filter((entry) => entry.id !== editingId)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [editingId, places]
  );
  const children = editingId ? childPlaces(editingId, places) : [];
  const parentChain = placeParentId && places.has(placeParentId)
    ? [places.get(placeParentId)!, ...placeAncestors(placeParentId, places)]
    : [];
  const incoming = editingId
    ? connectionsForPlace(editingId, places).filter((view) => view.ownerId !== editingId)
    : [];
  const kindListId = `place-connection-kinds-${editingId ?? 'new'}`;

  const updateConnection = (id: string, change: Partial<PlaceConnection>) =>
    setPlaceConnections((current) =>
      current.map((connection) => (connection.id === id ? {...connection, ...change} : connection))
    );
  const updateTravelTime = (connection: PlaceConnection, index: number, change: Partial<PlaceTravelTime>) =>
    updateConnection(connection.id, {
      travelTimes: (connection.travelTimes ?? []).map((time, position) =>
        position === index ? {...time, ...change} : time
      )
    });
  const addConnection = () =>
    setPlaceConnections((current) => [
      ...current,
      {id: crypto.randomUUID(), toId: destinations[0]?.id ?? '', kind: 'road'}
    ]);

  return (
    <section className={styles.placePanel} aria-label='Place'>
      <div className={styles.placeHeading}>
        <strong>Place</strong>
        <p>Where this place sits, and how to get to other places from here.</p>
      </div>

      <div className={shared.formGroup}>
        <label htmlFor='place-parent'>Inside</label>
        <select
          id='place-parent'
          value={placeParentId}
          onChange={(event) => setPlaceParentId(event.target.value)}
        >
          <option value=''>Not inside another place</option>
          {placeParentId && !parentOptions.some((option) => option.id === placeParentId) && (
            <option value={placeParentId}>
              {places.get(placeParentId)?.name ?? 'Missing place'} (cannot be used)
            </option>
          )}
          {parentOptions.map((option) => (
            <option key={option.id} value={option.id}>{option.name}</option>
          ))}
        </select>
        {parentChain.length > 1 && (
          <p className={styles.placeHint}>
            Also inside: {parentChain.slice(1).map((entry) => entry.name).join(' › ')}
          </p>
        )}
      </div>

      {children.length > 0 && (
        <div className={styles.placeGroup}>
          <strong>Places inside</strong>
          <div className={styles.placeChips}>
            {children.map((child) => (
              <button key={child.id} type='button' onClick={() => onEdit(child)}>
                {child.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <fieldset className={styles.connections}>
        <legend>Connections</legend>
        {destinations.length === 0 && placeConnections.length === 0 ? (
          <p className={styles.placeHint}>Add another place to connect this one to it.</p>
        ) : null}
        <datalist id={kindListId}>
          {CONNECTION_KIND_SUGGESTIONS.map((kind) => <option key={kind} value={kind} />)}
        </datalist>
        {placeConnections.map((connection, index) => {
          const label = `Connection ${index + 1}`;
          return (
            <div key={connection.id} className={styles.connectionCard} role='group' aria-label={label}>
              <div className={styles.connectionRow}>
                <label>
                  To
                  <select
                    value={connection.toId}
                    onChange={(event) => updateConnection(connection.id, {toId: event.target.value})}
                  >
                    {!places.has(connection.toId) && (
                      <option value={connection.toId}>Missing place (removed on save)</option>
                    )}
                    {destinations.map((destination) => (
                      <option key={destination.id} value={destination.id}>{destination.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Kind
                  <input
                    list={kindListId}
                    value={connection.kind}
                    onChange={(event) => updateConnection(connection.id, {kind: event.target.value})}
                  />
                </label>
                <label className={styles.inlineCheck}>
                  <input
                    type='checkbox'
                    checked={Boolean(connection.oneWay)}
                    onChange={(event) => updateConnection(connection.id, {oneWay: event.target.checked || undefined})}
                  />
                  One-way from here
                </label>
              </div>
              <span className={styles.measureCaption}>Distance (optional)</span>
              <MeasureInputs
                label='Distance'
                measure={connection.distance}
                wordsPlaceholder='Distance, e.g. a long day’s ride'
                unitPlaceholder='Unit, e.g. miles'
                onChange={(distance) => updateConnection(connection.id, {distance})}
              />
              {(connection.travelTimes ?? []).length > 0 && (
                <span className={styles.measureCaption}>Travel times</span>
              )}
              {(connection.travelTimes ?? []).map((time, timeIndex) => (
                <div key={timeIndex} className={styles.travelRow}>
                  <input
                    aria-label={`Travel mode ${timeIndex + 1}`}
                    placeholder='Mode, e.g. on foot'
                    value={time.mode}
                    onChange={(event) => updateTravelTime(connection, timeIndex, {mode: event.target.value})}
                  />
                  <MeasureInputs
                    label={`Travel time ${timeIndex + 1}`}
                    measure={time}
                    wordsPlaceholder='Time, e.g. three days'
                    unitPlaceholder='Unit, e.g. days'
                    onChange={(measure) => updateTravelTime(connection, timeIndex, measure)}
                  />
                  <button
                    type='button'
                    className={shared.dismissButton}
                    onClick={() => updateConnection(connection.id, {
                      travelTimes: (connection.travelTimes ?? []).filter((_, position) => position !== timeIndex)
                    })}
                  >
                    Remove time
                  </button>
                </div>
              ))}
              <div className={styles.connectionActions}>
                <button
                  type='button'
                  onClick={() => updateConnection(connection.id, {
                    travelTimes: [...(connection.travelTimes ?? []), {mode: ''}]
                  })}
                >
                  Add travel time
                </button>
                <button
                  type='button'
                  className={shared.dismissButton}
                  onClick={() => setPlaceConnections((current) => current.filter((entry) => entry.id !== connection.id))}
                >
                  Remove connection
                </button>
              </div>
            </div>
          );
        })}
        {destinations.length > 0 && (
          <div>
            <button type='button' onClick={addConnection}>Add connection</button>
          </div>
        )}

        {incoming.length > 0 && (
          <div className={styles.placeGroup}>
            <strong>Connections added on other places</strong>
            <ul className={styles.incomingList}>
              {incoming.map((view) => {
                const owner = places.get(view.ownerId);
                if (!owner) return null;
                const measures = describeConnectionMeasures(view.connection);
                return (
                  <li key={view.connection.id}>
                    <span>
                      {view.connection.kind} {view.direction === 'from' ? 'from' : 'to'} {owner.name}
                      {view.direction === 'from' ? ' (one-way, arriving here)' : ''}
                      {measures ? ` — ${measures}` : ''}
                    </span>
                    <button type='button' onClick={() => onEdit(owner)}>
                      Edit on {owner.name}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </fieldset>

      <RecordPlaceMaps categories={categories} entities={entities} draft={draft} />
    </section>
  );
}
