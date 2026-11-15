import {useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent} from 'react';
import type {
  CharacterSheet,
  EntityCategory,
  StateMutationEvent,
  WorldEntity,
  WorldMap,
  WritingDocument
} from '../../entityTypes';
import {useConfirmDialog} from '../../hooks/useConfirmDialog';
import {usePlaceSubjects} from '../../hooks/usePlaceSubjects';
import {useProjectMaps} from '../../hooks/useProjectMaps';
import {describeError} from '../../services/errors';
import {sanitizePathPart} from '../../services/portability/portableData';
import type {ConsistencyAlias} from '../../services/storage';
import {sortWritingDocuments} from '../../services/storage';
import {renderMapExport} from '../../services/worldBible/mapImageExport';
import {
  clampToImage,
  MAP_IMAGE_TYPES,
  nudgePoint,
  occupantsOnMap,
  pathOnMap,
  pinsOnMap,
  readMapImageFile
} from '../../services/worldBible/mapSurface';
import {gridTile} from '../../services/worldBible/mapGrid';
import {characterPath, positionsAtScene} from '../../services/worldBible/placeMovement';
import {useNotificationStore} from '../../store/notificationStore';
import {triggerBlobDownload} from '../../utils/downloadJson';
import {InlineAlert} from '../common/InlineAlert';
import shared from './worldBibleShared.module.css';
import styles from './MapSurface.module.css';

interface MapSurfaceProps {
  map: WorldMap;
  categories: EntityCategory[];
  entities: WorldEntity[];
  aliases: ConsistencyAlias[];
  characterSheets: CharacterSheet[];
  documents: WritingDocument[];
  stateMutationEvents: StateMutationEvent[];
  onClose: () => void;
}

const LATEST = 'latest';
type Point = {x: number; y: number};

/**
 * One map as a picture (slice 4.80, places brief § 8): the author's imported
 * image, place records pinned onto it, who is where at a chosen scene, a
 * character's path, and export as a PNG. Pins are placed by the author with
 * a click or the keyboard; nothing is placed for them.
 */
export function MapSurface(props: MapSurfaceProps) {
  const {map, categories, entities, aliases, characterSheets, documents, stateMutationEvents, onClose} = props;
  const {saveMapImage, savePlacement} = useProjectMaps();
  const {requestConfirm, confirmDialog} = useConfirmDialog();
  const pushToast = useNotificationStore((state) => state.pushToast);
  const notify = (message: string) => pushToast({tone: 'success', message});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pinRefs = useRef(new Map<string, HTMLButtonElement>());
  const [armedPlaceId, setArmedPlaceId] = useState('');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [focusPlaceId, setFocusPlaceId] = useState<string | null>(null);
  const [draft, setDraft] = useState<({placeId: string} & Point) | null>(null);
  const [sceneChoice, setSceneChoice] = useState(LATEST);
  const [pathActorId, setPathActorId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const image = map.image;
  const {index, subjects} = usePlaceSubjects({categories, entities, aliases, characterSheets});
  const places = index.places;
  const placeList = useMemo(() => [...places.values()].sort((a, b) => a.name.localeCompare(b.name)), [places]);
  const pins = useMemo(() => pinsOnMap(map, places), [map, places]);
  const scenes = useMemo(() => sortWritingDocuments(documents), [documents]);
  const sceneOrder = sceneChoice === LATEST ? undefined : Number(sceneChoice);
  const occupants = useMemo(
    () => occupantsOnMap(positionsAtScene({subjects, events: stateMutationEvents, index, sceneOrder}), pins, places),
    [index, pins, places, sceneOrder, stateMutationEvents, subjects]
  );
  const pathSubject = subjects.find((subject) => subject.actorId === pathActorId) ?? null;
  const path = useMemo(
    () => pathSubject
      ? pathOnMap(
          characterPath({subject: pathSubject, subjects, events: stateMutationEvents, documents, index, toOrder: sceneOrder}),
          pins,
          places
        )
      : [],
    [documents, index, pathSubject, pins, places, sceneOrder, stateMutationEvents, subjects]
  );

  // Focus a pin once it exists, after a keyboard placement saves and reloads.
  useEffect(() => {
    if (!focusPlaceId) return;
    const button = pinRefs.current.get(focusPlaceId);
    if (button) {
      button.focus();
      setFocusPlaceId(null);
    }
  }, [focusPlaceId, pins]);

  const run = async (action: () => Promise<void>, failure: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(describeError(caught, failure));
    } finally {
      setBusy(false);
    }
  };

  const placeAt = (placeId: string, point: Point, focus = false) => {
    const place = places.get(placeId);
    if (!place || !image) return;
    const wasPinned = pins.some((pin) => pin.place.id === placeId);
    void run(async () => {
      await savePlacement(place, map.id, clampToImage(point, image));
      notify(`${wasPinned ? 'Moved' : 'Pinned'} ${place.name}.`);
      setArmedPlaceId('');
      setSelectedPlaceId(placeId);
      if (focus) setFocusPlaceId(placeId);
    }, 'Unable to save the pin.');
  };

  const importImage = (file: File | undefined) => {
    if (!file) return;
    void run(async () => {
      const result = await readMapImageFile(file);
      if ('error' in result) {
        setError(result.error);
        return;
      }
      const replacing = Boolean(image);
      await saveMapImage(map.id, result.image);
      notify(replacing
        ? `Replaced the image of ${map.name}. Pins keep their positions in pixels; move any that no longer fit.`
        : `Imported the image of ${map.name}.`);
    }, 'Unable to import the image.');
  };

  const confirmRemoveImage = () =>
    requestConfirm({
      title: `Remove the image of ${map.name}?`,
      message: 'The map and every pin stay, as numbers in each place record. You can import an image again later.',
      confirmLabel: 'Remove image',
      variant: 'danger',
      onConfirm: () => run(async () => {
        await saveMapImage(map.id, null);
        setSelectedPlaceId(null);
        notify(`Removed the image of ${map.name}.`);
      }, 'Unable to remove the image.')
    });

  const exportImage = () =>
    void run(async () => {
      const blob = await renderMapExport({map, pins, occupants: occupants.byPlaceId, path});
      triggerBlobDownload(`${sanitizePathPart(map.name)}-map.png`, blob);
      notify(`Exported ${map.name} as an image.`);
    }, 'Unable to export the map.');

  const clickStage = (event: MouseEvent<HTMLDivElement>) => {
    const target = armedPlaceId || selectedPlaceId;
    if (!target || !image) return;
    const rect = event.currentTarget.getBoundingClientRect();
    placeAt(target, {
      x: ((event.clientX - rect.left) / rect.width) * image.width,
      y: ((event.clientY - rect.top) / rect.height) * image.height
    });
  };

  const commitDraft = () => {
    if (!draft) return;
    const {placeId, x, y} = draft;
    setDraft(null);
    placeAt(placeId, {x, y});
  };

  const pinKeyDown = (event: KeyboardEvent<HTMLButtonElement>, placeId: string, point: Point) => {
    if (!image) return;
    if (event.key === 'Enter' && draft?.placeId === placeId) {
      event.preventDefault();
      commitDraft();
      return;
    }
    if (event.key === 'Escape' && draft?.placeId === placeId) {
      event.preventDefault();
      setDraft(null);
      return;
    }
    const next = nudgePoint(draft?.placeId === placeId ? draft : point, event.key, image, event.shiftKey);
    if (!next) return;
    event.preventDefault();
    setSelectedPlaceId(placeId);
    setDraft({placeId, ...next});
  };

  const selectedPin = pins.find((pin) => pin.place.id === selectedPlaceId) ?? null;
  const offImage = pins.filter((pin) => !pin.onImage);
  const armedName = places.get(armedPlaceId || selectedPlaceId || '')?.name;
  const tile = map.grid ? gridTile(map.grid) : null;
  const occupiedPins = pins.filter((pin) => occupants.byPlaceId.has(pin.place.id));

  return (
    <section className={styles.surface} aria-labelledby='map-surface-title'>
      <div className={styles.header}>
        <div>
          <div className={shared.castEyebrow}>Map</div>
          <h3 id='map-surface-title'>{map.name}</h3>
          <p>
            {!image
              ? 'No image yet.'
              : map.grid
                ? `${map.grid.kind === 'square' ? 'Square' : 'Hex'} grid, ${map.grid.cellSize} pixels per cell. Distances are counted in ${map.distanceUnit}.`
                : `One pixel is ${map.scale} ${map.distanceUnit}.`}
          </p>
        </div>
        <div className={styles.actions}>
          <input
            ref={fileInputRef}
            type='file'
            accept={MAP_IMAGE_TYPES.join(',')}
            className={styles.fileInput}
            aria-label='Map image file'
            onChange={(event) => { importImage(event.target.files?.[0]); event.target.value = ''; }}
          />
          <button type='button' disabled={busy} onClick={() => fileInputRef.current?.click()}>
            {image ? 'Replace image' : 'Import image'}
          </button>
          {image && <button type='button' disabled={busy} onClick={exportImage}>Export image</button>}
          {image && <button type='button' className={shared.dismissButton} disabled={busy} onClick={confirmRemoveImage}>Remove image</button>}
          <button type='button' onClick={onClose}>Close map</button>
        </div>
      </div>

      {error && <InlineAlert variant='error' message={error} onDismiss={() => setError(null)} />}

      {!image ? (
        <p className={styles.empty}>
          Import an image made elsewhere (Inkarnate, Wonderdraft, a drawing or a scan) to pin places on it.
          PNG, JPEG, WebP, or GIF, up to 10 MB.
        </p>
      ) : (
        <>
          <div className={styles.toolbar}>
            <label className={styles.field}>
              Pin a place
              <select value={armedPlaceId} onChange={(event) => { setArmedPlaceId(event.target.value); setSelectedPlaceId(null); }}>
                <option value=''>Choose a place…</option>
                {placeList.map((place) => (
                  <option key={place.id} value={place.id}>
                    {place.name}{pins.some((pin) => pin.place.id === place.id) ? ' (pinned)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <button
              type='button'
              disabled={!armedPlaceId || busy}
              onClick={() => placeAt(armedPlaceId, {x: image.width / 2, y: image.height / 2}, true)}
            >
              Pin at centre
            </button>
            <label className={styles.field}>
              Who is where at the end of
              <select value={sceneChoice} onChange={(event) => setSceneChoice(event.target.value)}>
                <option value={LATEST}>The latest scene</option>
                {scenes.map((scene, i) => (
                  <option key={scene.id} value={String(i + 1)}>{i + 1}. {scene.title || 'Untitled scene'}</option>
                ))}
              </select>
            </label>
            {subjects.length > 0 && (
              <label className={styles.field}>
                Show the path of
                <select value={pathActorId} onChange={(event) => setPathActorId(event.target.value)}>
                  <option value=''>No one</option>
                  {[...subjects].sort((a, b) => a.name.localeCompare(b.name)).map((subject) => (
                    <option key={subject.actorId} value={subject.actorId}>{subject.name}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <p className={styles.hint}>
            {armedName
              ? `Click the map to put ${armedName} there.`
              : 'Choose a place, then click the map or use Pin at centre. Select a pin and use the arrow keys to move it (Shift moves further); Enter saves, Escape puts it back.'}
          </p>

          <div
            className={`${styles.stage} ${armedName ? styles.stageArmed : ''}`}
            // Full width, unless that would make a tall map taller than most of the screen.
            style={{width: `min(100%, calc(80vh * ${image.width / image.height}))`}}
            onClick={clickStage}
          >
            <img src={image.dataUrl} alt={`${map.name} map`} draggable={false} />
            {tile && (
              <svg className={styles.grid} viewBox={`0 0 ${image.width} ${image.height}`} preserveAspectRatio='none' aria-hidden='true' data-grid={map.grid?.kind}>
                <defs>
                  <pattern id={`map-grid-${map.id}`} patternUnits='userSpaceOnUse' x={tile.x} y={tile.y} width={tile.width} height={tile.height}>
                    {/* A halo under each line keeps the grid visible on light and dark images alike. */}
                    <path className={styles.gridHalo} d={tile.path} strokeWidth={Math.max(3, image.width / 270)} />
                    <path d={tile.path} strokeWidth={Math.max(1, image.width / 800)} />
                  </pattern>
                </defs>
                <rect width={image.width} height={image.height} fill={`url(#map-grid-${map.id})`} />
              </svg>
            )}
            {path.length > 1 && (
              <svg className={styles.path} viewBox={`0 0 ${image.width} ${image.height}`} preserveAspectRatio='none' aria-hidden='true'>
                <polyline points={path.map((point) => `${point.x},${point.y}`).join(' ')} vectorEffect='non-scaling-stroke' />
              </svg>
            )}
            {pins.filter((pin) => pin.onImage).map((pin) => {
              const point = draft?.placeId === pin.place.id ? draft : pin;
              const here = occupants.byPlaceId.get(pin.place.id) ?? [];
              return (
                <button
                  key={pin.place.id}
                  ref={(element) => {
                    if (element) pinRefs.current.set(pin.place.id, element);
                    else pinRefs.current.delete(pin.place.id);
                  }}
                  type='button'
                  className={`${styles.pin} ${selectedPlaceId === pin.place.id ? styles.pinSelected : ''}`}
                  style={{left: `${(point.x / image.width) * 100}%`, top: `${(point.y / image.height) * 100}%`}}
                  aria-pressed={selectedPlaceId === pin.place.id}
                  aria-label={`${pin.place.name} at (${point.x}, ${point.y})${here.length > 0 ? `, ${here.length} here` : ''}`}
                  onClick={(event) => { event.stopPropagation(); setArmedPlaceId(''); setSelectedPlaceId(pin.place.id); }}
                  onKeyDown={(event) => pinKeyDown(event, pin.place.id, pin)}
                  onBlur={commitDraft}
                >
                  <span className={styles.pinDot} aria-hidden='true' />
                  <span className={styles.pinLabel} aria-hidden='true'>
                    {pin.place.name}
                    {here.length > 0 && <span className={styles.pinCount}>{here.length}</span>}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedPin && (
            <div className={styles.selected} role='group' aria-label={`Pin ${selectedPin.place.name}`}>
              <strong>{selectedPin.place.name}</strong>
              <small>
                at ({draft?.placeId === selectedPin.place.id ? `${draft.x}, ${draft.y}` : `${selectedPin.x}, ${selectedPin.y}`})
                {' · '}click the map to move it here, or use the arrow keys on the pin.
              </small>
              <div className={styles.actions}>
                <button
                  type='button'
                  className={shared.dismissButton}
                  disabled={busy}
                  onClick={() => {
                    const place = selectedPin.place;
                    setSelectedPlaceId(null);
                    setDraft(null);
                    void run(async () => {
                      await savePlacement(place, map.id, null);
                      notify(`Removed the pin for ${place.name}.`);
                    }, 'Unable to remove the pin.');
                  }}
                >
                  Remove pin
                </button>
                <button type='button' onClick={() => { setSelectedPlaceId(null); setDraft(null); }}>Done</button>
              </div>
            </div>
          )}

          <section className={styles.who} aria-labelledby='map-who-title'>
            <h4 id='map-who-title'>Who is where</h4>
            {occupiedPins.length === 0 && occupants.elsewhere.length === 0 ? (
              <p className={styles.empty}>No positions recorded by this point.</p>
            ) : (
              <ul aria-label='Characters on this map'>
                {occupiedPins.map((pin) => (
                  <li key={pin.place.id}>
                    <strong>{pin.place.name}:</strong>{' '}
                    {(occupants.byPlaceId.get(pin.place.id) ?? [])
                      .map((occupant) => occupant.within ? `${occupant.position.subject.name} (in ${occupant.within})` : occupant.position.subject.name)
                      .join(', ')}
                  </li>
                ))}
                {occupants.elsewhere.length > 0 && (
                  <li>
                    <strong>Not on this map:</strong>{' '}
                    {occupants.elsewhere.map((position) => `${position.subject.name} (${position.label})`).join(', ')}
                  </li>
                )}
              </ul>
            )}
            {pathSubject && path.length < 2 && (
              <p className={styles.empty}>{pathSubject.name} has no moves between pinned places by this point.</p>
            )}
          </section>

          {offImage.length > 0 && (
            <section className={styles.who} aria-labelledby='map-off-image-title'>
              <h4 id='map-off-image-title'>Outside the image</h4>
              <ul>
                {offImage.map((pin) => (
                  <li key={pin.place.id}>
                    {pin.place.name} ({pin.x}, {pin.y}){' '}
                    <button
                      type='button'
                      className={styles.linkButton}
                      disabled={busy}
                      onClick={() => placeAt(pin.place.id, {x: image.width / 2, y: image.height / 2}, true)}
                    >
                      Move onto the map
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      {confirmDialog}
    </section>
  );
}
