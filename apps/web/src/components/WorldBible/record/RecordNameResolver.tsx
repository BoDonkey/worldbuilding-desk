import type {WorldEntity} from '../../../entityTypes';
import shared from '../worldBibleShared.module.css';
import styles from './RecordNameResolver.module.css';
import type {OpenRecord, RecordEntityActions, RecordResolution, RecordVariant} from './recordTypes';

interface RecordNameResolverProps {
  variant: RecordVariant;
  recordLabel: string;
  categoryName: string;
  editingId: string | null;
  name: string;
  selectedEntity: WorldEntity | null;
  currentCharacterLabel: string;
  setManualResolutionTargetId: (id: string) => void;
  resolution: RecordResolution;
  entityActions: RecordEntityActions;
  onEdit: OpenRecord;
}

/**
 * Manual name resolution: pick another record in the category and decide
 * which name stays canonical. Characters can also save a canonical rename.
 */
export function RecordNameResolver({
  variant,
  recordLabel,
  categoryName,
  editingId,
  name,
  selectedEntity,
  currentCharacterLabel,
  setManualResolutionTargetId,
  resolution,
  entityActions,
  onEdit
}: RecordNameResolverProps) {
  const {
    isCanonicalRenameDraft,
    canonicalRenameAliasPreview,
    handleSaveCanonicalRename,
    manualResolutionTargets,
    manualResolutionTarget
  } = resolution;
  const {
    isSubmittingEntity,
    aliasingEntityTargetId,
    mergingEntityTargetId,
    handleConvertEntityToAlias,
    handleMergeMatchIntoCurrentEntity
  } = entityActions;
  const isCharacter = variant === 'character';

  return (
    <div className={styles.nameResolverPanel}>
      {isCharacter ? (
        <>
          <strong>Resolve against another character</strong>
          <p>
            Pick any character in this category when the app cannot infer the
            relationship. You choose which name stays canonical.
          </p>
        </>
      ) : (
        <>
          <strong>Resolve against another {recordLabel}</strong>
          <p>
            Pick any {recordLabel} in this category when the app
            cannot infer the relationship. You choose which name stays canonical.
          </p>
        </>
      )}
      {isCharacter && isCanonicalRenameDraft && selectedEntity && (
        <div className={styles.canonicalRenameSummary}>
          <div>
            <strong>Rename this character instead</strong>
            <p>
              Save <strong>{name.trim()}</strong> as the canonical name
              for this record. The old name and listed alternatives stay
              attached as aliases.
            </p>
          </div>
          {canonicalRenameAliasPreview.length > 0 && (
            <div className={styles.aliasPreviewList}>
              {canonicalRenameAliasPreview.map((alias) => (
                <span key={alias}>{alias}</span>
              ))}
            </div>
          )}
          <button
            type='button'
            className={shared.primaryButton}
            onClick={() => void handleSaveCanonicalRename()}
            disabled={isSubmittingEntity}
          >
            {isSubmittingEntity ? 'Saving...' : 'Save canonical rename'}
          </button>
        </div>
      )}
      {editingId ? (
        manualResolutionTargets.length > 0 ? (
          <>
            <label>
              {isCharacter ? 'Character' : categoryName}
              <select
                value={manualResolutionTarget?.id ?? ''}
                onChange={(event) =>
                  setManualResolutionTargetId(event.target.value)
                }
              >
                {manualResolutionTargets.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name}
                  </option>
                ))}
              </select>
            </label>
            {manualResolutionTarget && (
              <div className={shared.reviewToolbarActions}>
                <button
                  type='button'
                  className={shared.primaryButton}
                  onClick={() =>
                    void handleConvertEntityToAlias(manualResolutionTarget)
                  }
                  disabled={
                    aliasingEntityTargetId === manualResolutionTarget.id ||
                    (!isCharacter && mergingEntityTargetId === manualResolutionTarget.id)
                  }
                >
                  {aliasingEntityTargetId === manualResolutionTarget.id
                    ? isCharacter ? 'Saving...' : 'Converting...'
                    : isCharacter
                      ? `Make ${currentCharacterLabel} an alias of ${manualResolutionTarget.name}`
                      : `Make ${name.trim() || selectedEntity?.name || 'this record'} an alias of ${manualResolutionTarget.name}`}
                </button>
                <button
                  type='button'
                  onClick={() =>
                    void handleMergeMatchIntoCurrentEntity(manualResolutionTarget)
                  }
                  disabled={mergingEntityTargetId === manualResolutionTarget.id}
                >
                  {mergingEntityTargetId === manualResolutionTarget.id
                    ? isCharacter ? 'Saving...' : 'Merging...'
                    : isCharacter
                      ? `Make ${manualResolutionTarget.name} an alias of ${currentCharacterLabel}`
                      : `Merge ${manualResolutionTarget.name} into this record`}
                </button>
                <button
                  type='button'
                  onClick={() => onEdit(manualResolutionTarget, 'aliases')}
                >
                  Open {manualResolutionTarget.name}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className={shared.reviewHint}>
            {isCharacter
              ? 'No other characters exist in this category yet.'
              : `No other ${categoryName.toLowerCase()} exist in this category yet.`}
          </div>
        )
      ) : (
        <div className={shared.reviewHint}>
          {isCharacter
            ? 'Save this character before resolving it against another record.'
            : `Save this ${recordLabel} before resolving it against another record.`}
        </div>
      )}
    </div>
  );
}
