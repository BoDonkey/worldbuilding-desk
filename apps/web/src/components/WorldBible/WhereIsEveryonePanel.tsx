import {useMemo, useState} from 'react';
import type {
  CharacterSheet,
  EntityCategory,
  StateMutationEvent,
  WorldEntity,
  WritingDocument
} from '../../entityTypes';
import type {ConsistencyAlias} from '../../services/storage';
import {sortWritingDocuments} from '../../services/storage';
import {buildCharacterCategoryIds} from '../../services/consistency/reviewLinkOptions';
import {buildStateSubjects} from '../../services/state/stateSubjects';
import {buildPlaceNameIndex} from '../../services/worldBible/placePositions';
import {
  characterPath,
  groupPositionsByPlace,
  positionsAtScene
} from '../../services/worldBible/placeMovement';
import shared from './worldBibleShared.module.css';
import styles from './WhereIsEveryonePanel.module.css';

interface WhereIsEveryonePanelProps {
  categories: EntityCategory[];
  entities: WorldEntity[];
  aliases: ConsistencyAlias[];
  characterSheets: CharacterSheet[];
  documents: WritingDocument[];
  stateMutationEvents: StateMutationEvent[];
  onOpenScene: (sceneId: string) => void;
}

const LATEST = 'latest';

/**
 * Who is where at a chosen scene, and one character's path over a range of
 * scenes (slice 4.78). Read from the accepted scene changes by replay; this
 * panel never writes.
 */
export function WhereIsEveryonePanel(props: WhereIsEveryonePanelProps) {
  const {categories, entities, aliases, characterSheets, documents, stateMutationEvents, onOpenScene} = props;
  const [sceneChoice, setSceneChoice] = useState(LATEST);
  const [pathActorId, setPathActorId] = useState('');
  const [fromOrder, setFromOrder] = useState(1);
  const [toOrder, setToOrder] = useState(0);

  const scenes = useMemo(() => sortWritingDocuments(documents), [documents]);
  const index = useMemo(
    () => buildPlaceNameIndex({categories, entities, aliases}),
    [aliases, categories, entities]
  );
  const subjects = useMemo(() => {
    const characterCategoryIds = buildCharacterCategoryIds(categories);
    return buildStateSubjects({
      characterSheets,
      characterEntities: entities.filter((entity) => characterCategoryIds.has(entity.categoryId))
    });
  }, [categories, characterSheets, entities]);

  const sceneOrder = sceneChoice === LATEST ? undefined : Number(sceneChoice);
  const groups = useMemo(
    () => groupPositionsByPlace(
      positionsAtScene({subjects, events: stateMutationEvents, index, sceneOrder}),
      index.places
    ),
    [index, sceneOrder, stateMutationEvents, subjects]
  );

  const travellers = useMemo(
    () => subjects
      .filter((subject) => characterPath({
        subject, subjects, events: stateMutationEvents, documents, index
      }).length > 0)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [documents, index, stateMutationEvents, subjects]
  );
  const pathSubject = travellers.find((subject) => subject.actorId === pathActorId) ?? travellers[0] ?? null;
  const lastOrder = toOrder || scenes.length;
  const path = useMemo(
    () => pathSubject
      ? characterPath({
          subject: pathSubject, subjects, events: stateMutationEvents, documents, index,
          fromOrder, toOrder: lastOrder
        })
      : [],
    [documents, fromOrder, index, lastOrder, pathSubject, stateMutationEvents, subjects]
  );

  if (subjects.length === 0) return null;

  return (
    <section className={styles.panel} aria-labelledby='where-is-everyone-title'>
      <div className={styles.header}>
        <div>
          <div className={shared.castEyebrow}>Character positions</div>
          <h2 id='where-is-everyone-title'>Where is everyone</h2>
          <p>Read from accepted scene changes. Pick a scene to see who is where once it ends.</p>
        </div>
        <label className={styles.field}>
          At the end of
          <select value={sceneChoice} onChange={(event) => setSceneChoice(event.target.value)}>
            <option value={LATEST}>The latest scene</option>
            {scenes.map((scene, i) => (
              <option key={scene.id} value={String(i + 1)}>
                {i + 1}. {scene.title || 'Untitled scene'}
              </option>
            ))}
          </select>
        </label>
      </div>

      {groups.length === 0 ? (
        <p className={styles.empty}>No positions recorded by this point.</p>
      ) : (
        <ul className={styles.placeList} aria-label='Characters by place'>
          {groups.map((group) => (
            <li key={group.placeId ?? `text:${group.label}`} className={styles.placeCard}>
              <div className={styles.placeName}>
                <strong>{group.label}</strong>
                {group.containers.length > 0 && <small>in {group.containers.join(' › ')}</small>}
                {!group.placeId && <span className={styles.badge}>No place record</span>}
              </div>
              <ul className={styles.chips}>
                {group.characters.map((position) => (
                  <li key={position.subject.actorId} className={styles.chip}>{position.subject.name}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {pathSubject && (
        <section className={styles.pathSection} aria-labelledby='character-path-title'>
          <h3 id='character-path-title'>Path</h3>
          <div className={styles.pathControls}>
            <label className={styles.field}>
              Character
              <select value={pathSubject.actorId} onChange={(event) => setPathActorId(event.target.value)}>
                {travellers.map((subject) => (
                  <option key={subject.actorId} value={subject.actorId}>{subject.name}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              From scene
              <select value={fromOrder} onChange={(event) => setFromOrder(Number(event.target.value))}>
                {scenes.map((scene, i) => (
                  <option key={scene.id} value={i + 1}>{i + 1}. {scene.title || 'Untitled scene'}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              To scene
              <select value={lastOrder} onChange={(event) => setToOrder(Number(event.target.value))}>
                {scenes.map((scene, i) => (
                  <option key={scene.id} value={i + 1}>{i + 1}. {scene.title || 'Untitled scene'}</option>
                ))}
              </select>
            </label>
          </div>
          {path.length === 0 ? (
            <p className={styles.empty}>No moves recorded for {pathSubject.name} in these scenes.</p>
          ) : (
            <ol className={styles.path} aria-label={`${pathSubject.name}'s path`}>
              {path.map((stop) => (
                <li key={stop.eventId}>
                  <strong>{stop.label}</strong>
                  {!stop.placeId && <span className={styles.badge}>No place record</span>}
                  <button type='button' className={styles.sceneLink} onClick={() => onOpenScene(stop.sceneId)}>
                    {stop.sceneOrder > 0 ? `${stop.sceneOrder}. ` : ''}{stop.sceneTitle}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </section>
  );
}
