import type {Dispatch, SetStateAction} from 'react';
import type {EntityCategory} from '../../entityTypes';
import type {useWorkspaceConsistency} from '../../hooks/useWorkspaceConsistency';
import {isCharacterCategory} from '../../services/characters/characterIdentity';
import {buildCharacterCaptureAliasList} from '../../services/worldBible/worldBibleCanonicalization';
import {isCharacterLikeCategory} from '../../services/workspace/workspaceView';
import {ContextPopover} from '../Editor/ContextPopover';
import {WorldCategorySelect} from './WorldCategorySelect';
import styles from '../../styles/WorkspaceRoute.module.css';

type WorkspaceConsistency = ReturnType<typeof useWorkspaceConsistency>;

export type WorkspaceReviewSurfaceActions = Pick<
  WorkspaceConsistency,
  | 'unknownCategorySelection'
  | 'setUnknownCategorySelection'
  | 'getSuggestedUnknownCategoryId'
  | 'createWorldCategory'
  | 'resolveUnknownEntity'
  | 'resolvingUnknown'
  | 'dismissUnknownEntity'
  | 'ignoreUnknownSurfaceProjectWide'
  | 'unknownLinkOptions'
  | 'closeUnknownLinkOptions'
  | 'unknownLinkSelection'
  | 'setUnknownLinkSelection'
  | 'linkUnknownEntity'
  | 'linkingUnknown'
  | 'clearUnknownSurface'
>;

const toSingularLabel = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Record';
  }
  if (/ies$/i.test(trimmed)) {
    return trimmed.replace(/ies$/i, 'y');
  }
  if (/ses$/i.test(trimmed)) {
    return trimmed.replace(/es$/i, '');
  }
  if (/s$/i.test(trimmed) && !/ss$/i.test(trimmed)) {
    return trimmed.slice(0, -1);
  }
  return trimmed;
};

interface WorkspaceReviewSurfacePopoverProps {
  surface: string;
  left: number;
  top: number;
  message: string;
  createLabel: string;
  linkLabel: string;
  categories: EntityCategory[];
  selectedSceneId: string | null;
  worldCaptureDrafts: Record<string, string>;
  setWorldCaptureDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  rejectedAliasSuggestions: Record<string, string[]>;
  setRejectedAliasSuggestions: Dispatch<SetStateAction<Record<string, string[]>>>;
  consistency: WorkspaceReviewSurfaceActions;
  onClose: () => void;
}

/** Review popover for an unknown name in the scene: add it to the World Bible, link it, or ignore it. */
export function WorkspaceReviewSurfacePopover({
  surface,
  left,
  top,
  message,
  createLabel,
  linkLabel,
  categories,
  selectedSceneId,
  worldCaptureDrafts,
  setWorldCaptureDrafts,
  rejectedAliasSuggestions,
  setRejectedAliasSuggestions,
  consistency,
  onClose
}: WorkspaceReviewSurfacePopoverProps) {
  const {
    unknownCategorySelection,
    setUnknownCategorySelection,
    getSuggestedUnknownCategoryId,
    createWorldCategory,
    resolveUnknownEntity,
    resolvingUnknown,
    dismissUnknownEntity,
    ignoreUnknownSurfaceProjectWide,
    unknownLinkOptions,
    closeUnknownLinkOptions,
    unknownLinkSelection,
    setUnknownLinkSelection,
    linkUnknownEntity,
    linkingUnknown
  } = consistency;
  const draft = worldCaptureDrafts[surface] || surface || '';
  const suggestedCategoryId =
    unknownCategorySelection[surface] || getSuggestedUnknownCategoryId(surface) || '';
  const suggestedCategory = suggestedCategoryId
    ? categories.find((category) => category.id === suggestedCategoryId) ?? null
    : null;
  const isCharacterCapture = isCharacterLikeCategory(suggestedCategory);
  const aliasPreview = buildCharacterCaptureAliasList({
    surface,
    canonicalName: draft,
    rejectedAliases: rejectedAliasSuggestions[surface] ?? []
  });
  const createActionLabel = suggestedCategory
    ? isCharacterCapture
      ? 'Add Character'
      : `Add ${toSingularLabel(suggestedCategory.name)}`
    : createLabel;
  const closeCharacterMatches = (closeUnknownLinkOptions[surface] ?? []).filter(
    (entry) => entry.type === 'character'
  );
  const showCharacterCanonicalizationHint =
    Boolean(suggestedCategory && isCharacterCategory(suggestedCategory)) &&
    closeCharacterMatches.length > 0;

  return (
    <ContextPopover title={surface} message={message} left={left} top={top} onClose={onClose}>
      <div className={styles.consistencyPopoverActions}>
        <WorldCategorySelect
          categories={categories}
          value={suggestedCategoryId}
          onChange={(categoryId) =>
            setUnknownCategorySelection((prev) => ({
              ...prev,
              [surface]: categoryId
            }))
          }
          onCreate={createWorldCategory}
          ariaLabel='World Bible type'
        />
        <label className={styles.captureNameField}>
          {isCharacterCapture ? 'Canonical name' : 'Name or place'}
          <input
            type='text'
            value={draft}
            onChange={(event) =>
              setWorldCaptureDrafts((prev) => ({
                ...prev,
                [surface]: event.target.value
              }))
            }
            placeholder={isCharacterCapture ? 'Full canonical name' : 'Name or place'}
            className={styles.captureNameInput}
          />
        </label>
        {isCharacterCapture && (
          <div className={styles.canonicalCaptureHint}>
            <strong>World Bible is the canon home.</strong>
            <span>
              Save the full name here, then keep or remove suggested aliases.
            </span>
            {aliasPreview.length > 0 && (
              <div className={styles.aliasPreviewList} aria-label='Suggested aliases'>
                {aliasPreview.map((alias) => (
                  <span key={alias}>
                    {alias}
                    <button
                      type='button'
                      onClick={() =>
                        setRejectedAliasSuggestions((prev) => ({
                          ...prev,
                          [surface]: [...(prev[surface] ?? []), alias]
                        }))
                      }
                      aria-label={`Remove alias ${alias}`}
                      title='Remove alias'
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        <button
          type='button'
          onClick={() =>
            void resolveUnknownEntity(
              surface,
              suggestedCategoryId || undefined,
              draft,
              aliasPreview
            ).then(() =>
              setRejectedAliasSuggestions((prev) => {
                const copy = {...prev};
                delete copy[surface];
                return copy;
              })
            )
          }
          disabled={resolvingUnknown === surface}
        >
          {resolvingUnknown === surface
            ? 'Adding...'
            : isCharacterCapture
              ? 'Create character'
              : createActionLabel}
        </button>
        <button
          type='button'
          onClick={() => dismissUnknownEntity(surface, selectedSceneId ?? undefined)}
        >
          Ignore
        </button>
        <button
          type='button'
          onClick={() => ignoreUnknownSurfaceProjectWide(surface, selectedSceneId ?? undefined)}
        >
          Always ignore
        </button>
      </div>
      {showCharacterCanonicalizationHint && (
        <div className={styles.consistencyPopoverNote}>
          Possible existing character match:{' '}
          <strong>{closeCharacterMatches[0]?.name}</strong>. Add this
          as World Bible character canon, then use <strong>Review Character Match</strong> to
          decide whether "{draft}" should become an alias.
        </div>
      )}
      {unknownLinkOptions[surface]?.length ? (
        <div className={styles.consistencyPopoverLinkRow}>
          <select
            value={unknownLinkSelection[surface] ?? ''}
            onChange={(event) =>
              setUnknownLinkSelection((prev) => ({
                ...prev,
                [surface]: event.target.value
              }))
            }
          >
            <option value=''>Select existing record...</option>
            {unknownLinkOptions[surface].map((entity) => (
              <option key={`${entity.type}-${entity.id}`} value={`${entity.type}:${entity.id}`}>
                {entity.name} · {entity.label}
              </option>
            ))}
          </select>
          <button
            type='button'
            onClick={() =>
              void linkUnknownEntity(surface, unknownLinkSelection[surface], draft)
            }
            disabled={linkingUnknown === surface || !unknownLinkSelection[surface]}
          >
            {linkingUnknown === surface ? 'Connecting...' : linkLabel}
          </button>
          {closeUnknownLinkOptions[surface]?.length ? null : (
            <span className={styles.consistencyPopoverNote}>
              No close match found. Showing recent records.
            </span>
          )}
        </div>
      ) : (
        <div className={styles.consistencyPopoverNote}>
          No existing records available yet.
        </div>
      )}
    </ContextPopover>
  );
}
