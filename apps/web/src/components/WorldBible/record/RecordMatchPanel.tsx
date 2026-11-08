import {getReviewResolutionLabel} from '../../../services/worldBible/worldBibleReviewHelpers';
import shared from '../worldBibleShared.module.css';
import styles from './RecordMatchPanel.module.css';
import type {OpenRecord, RecordEntityActions, RecordResolution, RecordVariant} from './recordTypes';

interface RecordMatchPanelProps {
  variant: RecordVariant;
  editingId: string | null;
  currentCharacterLabel: string;
  resolution: RecordResolution;
  entityActions: RecordEntityActions;
  onEdit: OpenRecord;
}

/** Existing records that may be the same thing as this one, with merge, alias, and keep-separate actions. */
export function RecordMatchPanel({
  variant,
  editingId,
  currentCharacterLabel,
  resolution,
  entityActions,
  onEdit
}: RecordMatchPanelProps) {
  const {
    canonicalResolutionMatches: matches,
    handleKeepSeparateMatch,
    handleIgnoreEntityMatch
  } = resolution;
  const {
    aliasingEntityTargetId,
    mergingEntityTargetId,
    handleConvertEntityToAlias,
    handleMergeMatchIntoCurrentEntity,
    handleMergeEntityIntoMatch
  } = entityActions;

  if (variant === 'character') {
    return (
      <div className={styles.matchPanel}>
        <strong>Possible canonical character overlaps</strong>
        <p>
          This character may already exist. If this is the same person,
          make the shorter name an alias of the full canon record.
        </p>
        <div className={styles.matchList}>
          {matches.slice(0, 4).map((match) => (
            <div key={match.entity.id} className={styles.matchCard}>
              <div>
                <strong>{match.entity.name}</strong>
                <div className={styles.matchReasons}>
                  {match.reasons.join(' · ')}
                </div>
                <div className={shared.reviewHint}>
                  Alias is safest when {currentCharacterLabel} is a nickname,
                  first-name reference, title, or alternate spelling for
                  {' '}{match.entity.name}.
                </div>
              </div>
              <div className={shared.reviewToolbarActions}>
                {editingId && (
                  <button
                    type='button'
                    className={shared.primaryButton}
                    onClick={() => void handleConvertEntityToAlias(match.entity)}
                    disabled={aliasingEntityTargetId === match.entity.id}
                  >
                    {aliasingEntityTargetId === match.entity.id
                      ? 'Saving...'
                      : `Make ${currentCharacterLabel} an alias of ${match.entity.name}`}
                  </button>
                )}
                {editingId && (
                  <button
                    type='button'
                    onClick={() => void handleMergeMatchIntoCurrentEntity(match.entity)}
                    disabled={mergingEntityTargetId === match.entity.id}
                  >
                    {mergingEntityTargetId === match.entity.id
                      ? 'Saving...'
                      : `Make ${match.entity.name} an alias of ${currentCharacterLabel}`}
                  </button>
                )}
                {editingId && match.matchKey && (
                  <button
                    type='button'
                    onClick={() => void handleKeepSeparateMatch(match.entity)}
                  >
                    No, keep separate
                  </button>
                )}
                <button
                  type='button'
                  onClick={() => onEdit(match.entity)}
                >
                  Open {match.entity.name}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.matchPanel}>
      <strong>Possible duplicate or alias matches</strong>
      <p>
        This draft overlaps with existing canon. Choose one action for
        each match: merge duplicates, convert this record into an alias,
        keep both records as separate canon, or ignore a noisy suggestion.
      </p>
      <div className={styles.matchList}>
        {matches.slice(0, 4).map((match) => (
          <div key={match.entity.id} className={styles.matchCard}>
            <div>
              <strong>{match.entity.name}</strong>
              <div className={styles.matchReasons}>
                {match.reasons.join(' · ')}
              </div>
              <div className={shared.reviewHint}>
                Recommended: {getReviewResolutionLabel(match.recommendedResolution)}.
              </div>
            </div>
            <div className={shared.reviewToolbarActions}>
              <button type='button' onClick={() => onEdit(match.entity)}>
                Open other record
              </button>
              <button
                type='button'
                onClick={() => onEdit(match.entity, 'aliases')}
              >
                Open aliases
              </button>
              {editingId && match.matchKey && (
                <button
                  type='button'
                  onClick={() => void handleKeepSeparateMatch(match.entity)}
                >
                  Keep both records
                </button>
              )}
              {editingId && match.matchKey && (
                <button
                  type='button'
                  onClick={() => void handleIgnoreEntityMatch(match.entity)}
                >
                  Ignore this suggestion
                </button>
              )}
              {editingId && (
                <button
                  type='button'
                  onClick={() => void handleMergeMatchIntoCurrentEntity(match.entity)}
                  disabled={mergingEntityTargetId === match.entity.id}
                >
                  {mergingEntityTargetId === match.entity.id
                    ? 'Merging...'
                    : 'Merge match into this record'}
                </button>
              )}
              {editingId && (
                <button
                  type='button'
                  onClick={() => void handleMergeEntityIntoMatch(match.entity)}
                  disabled={mergingEntityTargetId === match.entity.id}
                >
                  {mergingEntityTargetId === match.entity.id
                    ? 'Merging...'
                    : 'Merge this record into match'}
                </button>
              )}
              {editingId && (
                <button
                  type='button'
                  onClick={() => void handleConvertEntityToAlias(match.entity)}
                  disabled={
                    aliasingEntityTargetId === match.entity.id ||
                    mergingEntityTargetId === match.entity.id
                  }
                >
                  {aliasingEntityTargetId === match.entity.id
                    ? 'Converting...'
                    : 'Convert this record into an alias'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
