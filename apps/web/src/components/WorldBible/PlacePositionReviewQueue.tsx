import {useState} from 'react';
import type {UnlinkedPlacePositions} from '../../hooks/useUnlinkedPlacePositions';
import shared from './worldBibleShared.module.css';
import styles from './WorldBibleEntityCards.module.css';

/**
 * Positions written as a name that matches no place record, or several
 * (slice 4.77). The author links each name to a place, creates one, or keeps
 * it as text.
 */
export function PlacePositionReviewQueue({review}: {review: UnlinkedPlacePositions}) {
  const [targetByKey, setTargetByKey] = useState<Record<string, string>>({});
  const {queue, places, resolvingKey} = review;
  if (queue.length === 0) return null;

  return (
    <section className={styles.identityQueue} aria-labelledby='place-position-queue-title'>
      <div className={styles.identityQueueHeader}>
        <div>
          <div className={shared.castEyebrow}>Character positions</div>
          <h2 id='place-position-queue-title'>Positions not linked to a place</h2>
          <p>
            These places were written as text in recorded scene changes. Link each
            name to a place record so checks can tell the tavern is inside the city.
            Nothing is linked automatically.
          </p>
        </div>
        <span className={shared.categoryRailCount}>{queue.length}</span>
      </div>
      <ul className={styles.identityQueueList}>
        {queue.map((item) => {
          const isResolving = resolvingKey === item.key;
          const targetId = targetByKey[item.key] ?? '';
          const candidates = item.candidateIds.length > 1
            ? places.filter((place) => item.candidateIds.includes(place.id))
            : places;
          return (
            <li key={item.key} className={styles.identityQueueCard}>
              <div className={styles.entityHeader}>
                <strong className={styles.entityName}>{item.name}</strong>
                <span className={styles.aliasMatchBadge}>
                  {item.positionCount === 1 ? '1 position' : `${item.positionCount} positions`}
                </span>
              </div>
              <p>
                {item.candidateIds.length > 1
                  ? 'This name matches more than one place. Choose the one it means.'
                  : 'No place record has this name or alias.'}
              </p>
              <div className={styles.identityLinkRow}>
                <label>
                  Existing place
                  <select
                    value={targetId}
                    onChange={(event) =>
                      setTargetByKey((current) => ({...current, [item.key]: event.target.value}))
                    }
                    disabled={isResolving || candidates.length === 0}
                  >
                    <option value=''>
                      {candidates.length > 0 ? 'Choose place…' : 'No place records yet'}
                    </option>
                    {candidates.map((place) => (
                      <option key={place.id} value={place.id}>{place.name}</option>
                    ))}
                  </select>
                </label>
                <button
                  type='button'
                  className={shared.primaryButton}
                  disabled={isResolving || !targetId}
                  onClick={() => void review.linkToPlace(item, targetId)}
                >
                  Link to place
                </button>
              </div>
              <div className={shared.entityActions}>
                {item.candidateIds.length === 0 && (
                  <button
                    type='button'
                    disabled={isResolving}
                    onClick={() => void review.createPlace(item)}
                  >
                    Create place
                  </button>
                )}
                <button
                  type='button'
                  className={shared.dismissButton}
                  disabled={isResolving}
                  onClick={() => void review.keepAsText(item)}
                >
                  Keep as text
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
