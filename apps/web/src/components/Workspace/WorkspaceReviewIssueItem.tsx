import type {Dispatch, Ref, SetStateAction} from 'react';
import type {EntityCategory} from '../../entityTypes';
import type {useWorkspaceConsistency} from '../../hooks/useWorkspaceConsistency';
import {
  supportsWorldCaptureActions,
  type ConsistencyReviewItem
} from '../../services/consistency/reviewReadiness';
import {buildCharacterCaptureAliasList} from '../../services/worldBible/worldBibleCanonicalization';
import styles from '../../styles/WorkspaceRoute.module.css';
import {WorldCategorySelect} from './WorldCategorySelect';

const ISSUE_LABELS: Record<string, string> = {
  UNKNOWN_ENTITY: 'Unknown name',
  AMBIGUOUS_REFERENCE: 'Ambiguous reference',
  UNEXPECTED_SCENE_PRESENCE: 'Unexpected scene presence',
  STATE_CONFLICT: 'Continuity conflict',
  INVALID_MUTATION: 'Invalid story state change'
};

const DETECTION_REASON_LABELS: Record<string, {label: string; title: string}> = {
  known_entity: {
    label: 'Known canon',
    title: 'This text already appears to match an existing world or character record.'
  },
  titled_name: {
    label: 'Titled name',
    title: 'This looks like a named person because it includes a title such as Dr., Captain, or Professor.'
  },
  repeated_unknown: {
    label: 'Repeated name',
    title: 'This unknown name appears more than once, so review treats it as likely story context.'
  },
  leading_entity_cue: {
    label: 'Context clue',
    title: 'Nearby wording suggests this may be a place, object, person, or other story-world term.'
  },
  direct_address_candidate: {
    label: 'Direct address',
    title: 'Dialogue addresses this capitalized term as a name.'
  },
  character_context_candidate: {
    label: 'Character-like name',
    title: 'Sentence context suggests this unknown term may be a character name.'
  },
  multiword_proper_candidate: {
    label: 'Proper name',
    title: 'Capitalization and word shape suggest this may be a named story-world term.'
  },
  action_object_candidate: {
    label: 'Action object',
    title: 'The text uses this term like an object involved in an action.'
  }
};

const getIssueLabel = (code: string): string => ISSUE_LABELS[code] ?? 'Review item';

const getDetectionReason = (
  reason: string
): {label: string; title: string} =>
  DETECTION_REASON_LABELS[reason] ?? {
    label: 'Review clue',
    title: 'Review found a pattern that may need canon cleanup.'
  };

const isCharacterLikeCategory = (category: {slug: string; name: string} | null) => {
  if (!category) return false;
  const slug = category.slug.toLowerCase();
  const name = category.name.toLowerCase();
  return ['character', 'characters', 'npc', 'person', 'people'].some(
    (hint) => slug.includes(hint) || name.includes(hint)
  );
};

export interface WorkspaceReviewIssueItemProps {
  item: ConsistencyReviewItem;
  consistency: ReturnType<typeof useWorkspaceConsistency>;
  categories: EntityCategory[];
  isActive: boolean;
  isExpanded: boolean;
  /** Attached to the active item so the tab can scroll it into view. */
  activeItemRef: Ref<HTMLLIElement>;
  onShowContext: (item: ConsistencyReviewItem) => void;
  createLabel: string;
  linkLabel: string;
  worldCaptureDrafts: Record<string, string>;
  setWorldCaptureDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  rejectedAliasSuggestions: Record<string, string[]>;
  setRejectedAliasSuggestions: Dispatch<SetStateAction<Record<string, string[]>>>;
  openWorldRecord: (target: {id: string; type: 'character' | 'entity'}) => void;
}

/**
 * One project review issue: what was found and where, why review flagged it,
 * and, when expanded, the actions to add it to the World Bible (with alias
 * suggestions for a character), link it to an existing record, or ignore it.
 */
export function WorkspaceReviewIssueItem({
  item,
  consistency,
  categories,
  isActive,
  isExpanded,
  activeItemRef,
  onShowContext,
  createLabel,
  linkLabel,
  worldCaptureDrafts,
  setWorldCaptureDrafts,
  rejectedAliasSuggestions,
  setRejectedAliasSuggestions,
  openWorldRecord
}: WorkspaceReviewIssueItemProps) {
  const {
    unknownCategorySelection,
    setUnknownCategorySelection,
    getSuggestedUnknownCategoryId,
    unknownLinkSelection,
    setUnknownLinkSelection,
    unknownLinkOptions,
    createWorldCategory,
    resolveUnknownEntity,
    resolvingUnknown,
    dismissUnknownEntity,
    ignoreUnknownSurfaceProjectWide,
    linkUnknownEntity,
    linkingUnknown,
    dismissConsistencyReviewItem
  } = consistency;
  const surface = item.issue.surface?.trim() ?? '';
  const actionSurface = surface || item.issue.message;
  const isContinuityIssue =
    item.issue.code === 'STATE_CONFLICT' || item.issue.code === 'INVALID_MUTATION';
  const selectedCategoryId =
    unknownCategorySelection[actionSurface] ||
    (surface ? getSuggestedUnknownCategoryId(surface) : '') ||
    '';
  const draftName = worldCaptureDrafts[actionSurface] || actionSurface;
  const selectedCategory = selectedCategoryId
    ? categories.find((category) => category.id === selectedCategoryId) ?? null
    : null;
  const isCharacterCapture = isCharacterLikeCategory(selectedCategory);
  const rejectedAliases = rejectedAliasSuggestions[actionSurface] ?? [];
  const aliasPreview = isCharacterCapture
    ? buildCharacterCaptureAliasList({
        surface: actionSurface,
        canonicalName: draftName,
        rejectedAliases
      })
    : [];
  const selectedLinkValue = unknownLinkSelection[actionSurface] ?? '';
  const linkOptions = unknownLinkOptions[actionSurface] ?? [];
  const issueTitle = surface || getIssueLabel(item.issue.code);
  const reviewAnnotation = item.reviewAnnotation;
  const reviewSummary = reviewAnnotation?.summary;
  const shouldShowReviewSummary =
    reviewSummary &&
    !(
      item.issue.code === 'UNKNOWN_ENTITY' &&
      item.issue.severity === 'warning' &&
      reviewAnnotation?.source === 'deterministic'
    );

  return (
    <li
      ref={isActive ? activeItemRef : undefined}
      className={`${styles.consistencyListItem} ${
        isContinuityIssue ? styles.consistencyListItemConflict : ''
      } ${
        isActive ? styles.consistencyListItemActive : ''
      }`}
    >
      <div className={styles.consistencyItemHeader}>
        <div>
          <strong className={styles.consistencyItemTitle}>{issueTitle}</strong>
          {isContinuityIssue && (
            <span className={styles.consistencyConflictBadge}>Needs attention</span>
          )}
          {item.issue.code === 'UNKNOWN_ENTITY' &&
            item.issue.severity === 'warning' && (
              <span className={styles.consistencyReason}>Review later</span>
            )}
          {item.staleSinceReview && (
            <span className={styles.consistencyReason} title='This scene changed after the last project review. Run the review again to refresh it.'>
              Scene changed since review
            </span>
          )}
        </div>
        <div className={styles.consistencyHeaderActions}>
          <button
            type='button'
            onClick={() => onShowContext(item)}
            className={styles.consistencySceneButton}
            title={surface ? `Show "${surface}" in ${item.sceneTitle}` : `Open ${item.sceneTitle}`}
          >
            Show context
          </button>
          {isContinuityIssue && (
            <button
              type='button'
              onClick={() => dismissConsistencyReviewItem(item.id)}
              className={styles.consistencyDismissButton}
              title='Dismiss until the next project review'
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
      <div className={styles.consistencyItemBody}>
        <button
          type='button'
          onClick={() => onShowContext(item)}
          className={styles.consistencySceneButton}
          title={surface ? `Show "${surface}" in ${item.sceneTitle}` : `Open ${item.sceneTitle}`}
        >
          {item.sceneTitle}
        </button>
        {surface ? (
          <span className={styles.consistencyMessage}>{item.issue.message}</span>
        ) : (
          <>: {item.issue.message}</>
        )}
      </div>
      {shouldShowReviewSummary && (
        <div className={styles.consistencyDescription}>
          {reviewSummary}
        </div>
      )}
      {item.reviewAnnotation && (
        <span className={styles.consistencyReason}>
          {item.reviewAnnotation.engineLabel}
        </span>
      )}
      {item.issue.detectionReason && (
        <span
          className={styles.consistencyReason}
          title={getDetectionReason(item.issue.detectionReason).title}
        >
          {getDetectionReason(item.issue.detectionReason).label}
        </span>
      )}
      {item.issue.relatedEntities && item.issue.relatedEntities.length > 0 && (
        <span className={styles.consistencyRelated}>
          {item.issue.relatedEntities.slice(0, 3).map((target) => (
            <button
              key={`${item.id}-${target.id}`}
              type='button'
              onClick={() => openWorldRecord(target)}
              className={styles.consistencyRelatedButton}
            >
              Open {target.name}
            </button>
          ))}
        </span>
      )}
      {isExpanded && supportsWorldCaptureActions(item.issue) && (
        <div className={styles.reviewActionPanel}>
          <label className={styles.reviewActionField}>
            World Bible type
            <WorldCategorySelect
              categories={categories}
              value={selectedCategoryId}
              onChange={(categoryId) =>
                setUnknownCategorySelection((prev) => ({
                  ...prev,
                  [actionSurface]: categoryId
                }))
              }
              onCreate={createWorldCategory}
            />
          </label>
          <label className={styles.reviewActionField}>
            {isCharacterCapture ? 'Canonical name' : 'Name'}
            <input
              type='text'
              value={draftName}
              onChange={(event) =>
                setWorldCaptureDrafts((prev) => ({
                  ...prev,
                  [actionSurface]: event.target.value
                }))
              }
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
                            [actionSurface]: [
                              ...(prev[actionSurface] ?? []),
                              alias
                            ]
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
          <div className={styles.reviewActionRow}>
            <button
              type='button'
              onClick={() =>
                void resolveUnknownEntity(
                  actionSurface,
                  selectedCategoryId || undefined,
                  draftName,
                  aliasPreview
                ).then(() =>
                  setRejectedAliasSuggestions((prev) => {
                    const copy = {...prev};
                    delete copy[actionSurface];
                    return copy;
                  })
                )
              }
              disabled={resolvingUnknown === actionSurface}
            >
              {resolvingUnknown === actionSurface
                ? 'Adding...'
                : isCharacterCapture
                  ? 'Create character'
                  : createLabel}
            </button>
            <button
              type='button'
              onClick={() => dismissUnknownEntity(actionSurface, item.sceneId)}
            >
              Ignore
            </button>
            <button
              type='button'
              onClick={() =>
                ignoreUnknownSurfaceProjectWide(actionSurface, item.sceneId)
              }
            >
              Always ignore
            </button>
          </div>
          {linkOptions.length > 0 ? (
            <div className={styles.reviewActionRow}>
              <select
                value={selectedLinkValue}
                onChange={(event) =>
                  setUnknownLinkSelection((prev) => ({
                    ...prev,
                    [actionSurface]: event.target.value
                  }))
                }
                aria-label='Existing world record'
              >
                <option value=''>Select existing record...</option>
                {linkOptions.map((option) => (
                  <option
                    key={`${option.type}-${option.id}`}
                    value={`${option.type}:${option.id}`}
                  >
                    {option.name} · {option.label}
                  </option>
                ))}
              </select>
              <button
                type='button'
                onClick={() =>
                  void linkUnknownEntity(actionSurface, selectedLinkValue, draftName)
                }
                disabled={linkingUnknown === actionSurface || !selectedLinkValue}
              >
                {linkingUnknown === actionSurface ? 'Connecting...' : linkLabel}
              </button>
            </div>
          ) : (
            <div className={styles.consistencyDescription}>
              No existing records available yet.
            </div>
          )}
        </div>
      )}
    </li>
  );
}
