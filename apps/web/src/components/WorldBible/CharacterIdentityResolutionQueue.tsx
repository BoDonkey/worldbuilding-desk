import {useState} from 'react';
import type {WorldEntity} from '../../entityTypes';
import type {CharacterIdentityResolutionItem} from '../../services/characters/characterIdentityResolution';
import type {ReviewQueueItem} from '../../services/consistency';
import styles from '../../assets/components/WorldBibleRoute.module.css';

const classificationLabel = (
  classification: CharacterIdentityResolutionItem['classification']
): string => {
  if (classification === 'tools-only-orphan') return 'Legacy character data only';
  if (classification === 'sheet-only') return 'Sheet only';
  return 'Possible identity collision';
};

export function CharacterIdentityResolutionQueue(props: {
  items: CharacterIdentityResolutionItem[];
  canonicalCharacters: WorldEntity[];
  resolvingKey: string | null;
  onLink: (item: CharacterIdentityResolutionItem, entityId: string) => Promise<void>;
  onCreateCanon: (item: CharacterIdentityResolutionItem) => Promise<void>;
  onKeepSeparate: (item: CharacterIdentityResolutionItem) => Promise<void>;
  canonReviewItems: ReviewQueueItem[];
  onOpenCanonReview: (entity: WorldEntity, focus?: 'general' | 'aliases') => void;
}) {
  const [targetByKey, setTargetByKey] = useState<Record<string, string>>({});

  return (
    <div className={styles.reviewQueueStack}>
    <section className={styles.identityQueue} aria-labelledby='character-identity-queue-title'>
      <div className={styles.identityQueueHeader}>
        <div>
          <div className={styles.castEyebrow}>Legacy character intake</div>
          <h2 id='character-identity-queue-title'>Needs canon link</h2>
          <p>
            These older character capability or sheet records are not World Bible canon.
            Choose what each record means; nothing is linked or created automatically.
          </p>
        </div>
        <span className={styles.categoryRailCount}>{props.items.length}</span>
      </div>

      {props.items.length === 0 ? (
        <p className={styles.emptyState}>No unresolved character identities.</p>
      ) : (
        <ul className={styles.identityQueueList}>
          {props.items.map((item) => {
            const isResolving = props.resolvingKey === item.key;
            const targetId = targetByKey[item.key] ?? '';
            return (
              <li key={item.key} className={styles.identityQueueCard}>
                <div className={styles.entityHeader}>
                  <strong className={styles.entityName}>{item.name}</strong>
                  <span className={styles.aliasMatchBadge}>
                    {classificationLabel(item.classification)}
                  </span>
                </div>
                <p>{item.reason}</p>
                {item.recordType === 'sheet' && (
                  <p className={styles.reviewHint}>
                    The sheet remains mechanically usable, but it is not canon and cannot
                    record new state until linked.
                  </p>
                )}
                <div className={styles.identityLinkRow}>
                  <label>
                    Existing World Bible character
                    <select
                      value={targetId}
                      onChange={(event) =>
                        setTargetByKey((current) => ({
                          ...current,
                          [item.key]: event.target.value
                        }))
                      }
                      disabled={isResolving}
                    >
                      <option value=''>Choose character…</option>
                      {props.canonicalCharacters.map((entity) => (
                        <option key={entity.id} value={entity.id}>
                          {entity.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type='button'
                    className={styles.primaryButton}
                    disabled={isResolving || !targetId}
                    onClick={() => void props.onLink(item, targetId)}
                  >
                    Link existing
                  </button>
                </div>
                <div className={styles.entityActions}>
                  <button
                    type='button'
                    disabled={isResolving}
                    onClick={() => void props.onCreateCanon(item)}
                  >
                    Create canon record
                  </button>
                  <button
                    type='button'
                    className={styles.dismissButton}
                    disabled={isResolving}
                    onClick={() => void props.onKeepSeparate(item)}
                  >
                    Keep separate
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
    <section className={styles.identityQueue} aria-labelledby='canon-review-queue-title'>
      <div className={styles.identityQueueHeader}>
        <div>
          <div className={styles.castEyebrow}>Canon follow-up</div>
          <h2 id='canon-review-queue-title'>World Bible records to review</h2>
          <p>Finish imported records and confirm new aliases when you are ready.</p>
        </div>
        <span className={styles.categoryRailCount}>{props.canonReviewItems.length}</span>
      </div>
      {props.canonReviewItems.length === 0 ? (
        <p className={styles.emptyState}>No canon records need follow-up.</p>
      ) : (
        <ul className={styles.identityQueueList}>
          {props.canonReviewItems.map((item) => (
            <li key={item.entity.id} className={styles.identityQueueCard}>
              <div className={styles.entityHeader}>
                <strong className={styles.entityName}>{item.entity.name}</strong>
                {item.reasons.includes('needsCompletion') && (
                  <span className={styles.completionBadge}>Needs completion</span>
                )}
                {item.reasons.includes('aliasFollowUp') && (
                  <span className={styles.aliasMatchBadge}>Aliases need review</span>
                )}
              </div>
              <div className={styles.entityActions}>
                <button
                  type='button'
                  onClick={() =>
                    props.onOpenCanonReview(
                      item.entity,
                      item.reasons.includes('aliasFollowUp') ? 'aliases' : 'general'
                    )
                  }
                >
                  Open review
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
    </div>
  );
}
