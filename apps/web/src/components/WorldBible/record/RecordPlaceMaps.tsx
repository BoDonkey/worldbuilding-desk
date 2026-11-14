import {useMemo, useState} from 'react';
import type {EntityCategory, PlacePlacement, WorldEntity} from '../../../entityTypes';
import {useProjectMaps} from '../../../hooks/useProjectMaps';
import {describeDistanceFigure, placeDistance} from '../../../services/worldBible/placeDistance';
import {normalizePlacements, placesById} from '../../../services/worldBible/places';
import shared from '../worldBibleShared.module.css';
import styles from './RecordPlaceSection.module.css';
import type {WorldBibleRecordDraft} from './useWorldBibleRecordDraft';

interface RecordPlaceMapsProps {
  categories: EntityCategory[];
  entities: WorldEntity[];
  draft: WorldBibleRecordDraft;
}

const coordinateValue = (value: number) => (Number.isFinite(value) ? value : '');
const coordinateFromInput = (value: string) => (value.trim() === '' ? Number.NaN : Number(value));

/**
 * Where this place is on each map, entered as numbers until the map surface
 * (4.80), and how far it is from another place (slice 4.79). The distance is
 * worked out from the record as edited, and every figure names its source.
 */
export function RecordPlaceMaps({categories, entities, draft}: RecordPlaceMapsProps) {
  const {editingId, place, placePlacements, setPlacePlacements} = draft;
  const {maps, mapsById, conversions} = useProjectMaps();
  const [otherId, setOtherId] = useState('');

  const places = useMemo(
    () => placesById(
      categories,
      entities.map((entity) => (entity.id === editingId
        ? {...entity, place: place && {...place, placements: normalizePlacements(place.placements)}}
        : entity))
    ),
    [categories, editingId, entities, place]
  );
  const others = useMemo(
    () => [...places.values()]
      .filter((entry) => entry.id !== editingId)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [editingId, places]
  );
  const usedMapIds = new Set(placePlacements.map((placement) => placement.mapId));
  const freeMaps = maps.filter((map) => !usedMapIds.has(map.id));
  const target = others.find((entry) => entry.id === otherId) ?? null;
  const result = useMemo(
    () => editingId && target
      ? placeDistance({fromId: editingId, toId: target.id, places, maps: mapsById, conversions})
      : null,
    [conversions, editingId, mapsById, places, target]
  );

  const updatePlacement = (index: number, change: Partial<PlacePlacement>) =>
    setPlacePlacements((current) =>
      current.map((placement, position) => (position === index ? {...placement, ...change} : placement))
    );

  return (
    <>
      <fieldset className={styles.connections}>
        <legend>On maps</legend>
        {maps.length === 0 ? (
          <p className={styles.placeHint}>
            Add a map under Maps and distances on the Locations page to put this place on it.
          </p>
        ) : (
          <p className={styles.placeHint}>A point in each map's own units. Leave a map out if this place is not on it.</p>
        )}
        {placePlacements.map((placement, index) => {
          const map = mapsById.get(placement.mapId);
          return (
            <div key={index} className={styles.placementRow} role='group' aria-label={`Placement ${index + 1}`}>
              <label>
                Map
                <select value={placement.mapId} onChange={(event) => updatePlacement(index, {mapId: event.target.value})}>
                  {!map && <option value={placement.mapId}>Missing map</option>}
                  {map && <option value={map.id}>{map.name}</option>}
                  {freeMaps.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                </select>
              </label>
              <label>
                X
                <input type='number' step='any' value={coordinateValue(placement.x)} onChange={(event) => updatePlacement(index, {x: coordinateFromInput(event.target.value)})} />
              </label>
              <label>
                Y
                <input type='number' step='any' value={coordinateValue(placement.y)} onChange={(event) => updatePlacement(index, {y: coordinateFromInput(event.target.value)})} />
              </label>
              <button
                type='button'
                className={shared.dismissButton}
                onClick={() => setPlacePlacements((current) => current.filter((_, position) => position !== index))}
              >
                Remove
              </button>
            </div>
          );
        })}
        {freeMaps.length > 0 && (
          <div>
            <button
              type='button'
              onClick={() => setPlacePlacements((current) => [...current, {mapId: freeMaps[0].id, x: Number.NaN, y: Number.NaN}])}
            >
              Put on a map
            </button>
          </div>
        )}
      </fieldset>

      {editingId && others.length > 0 && (
        <div className={styles.placeGroup}>
          <label className={styles.distanceField}>
            <strong>Distance to</strong>
            <select value={target?.id ?? ''} onChange={(event) => setOtherId(event.target.value)}>
              <option value=''>Choose a place</option>
              {others.map((other) => <option key={other.id} value={other.id}>{other.name}</option>)}
            </select>
          </label>
          {result && target && (
            result.distances.length === 0 && result.travelTimes.length === 0 ? (
              <p className={styles.placeHint}>
                No distance known: connect the two places, or put both on a map.
              </p>
            ) : (
              <ul className={styles.incomingList} aria-label={`Distance to ${target.name}`}>
                {result.distances.map((figure, index) => (
                  <li key={`d${index}`}>{describeDistanceFigure(figure, places, mapsById)}</li>
                ))}
                {result.travelTimes.map((figure, index) => (
                  <li key={`t${index}`}>{figure.mode}: {describeDistanceFigure(figure, places, mapsById)}</li>
                ))}
              </ul>
            )
          )}
        </div>
      )}
    </>
  );
}
