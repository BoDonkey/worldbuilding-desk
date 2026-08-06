import type {EntityCategory, WorldEntity} from '../../entityTypes';
import type {useWorldBibleReview} from '../../hooks/useWorldBibleReview';
import type {useWorldBibleEntityActions} from '../../hooks/useWorldBibleEntityActions';
import type {useWorldBibleSelectedEntity} from '../../hooks/useWorldBibleSelectedEntity';
import {buildEntityCardSummary} from '../../services/worldBible/worldBibleSummary';
import styles from '../../assets/components/WorldBibleRoute.module.css';

interface WorldBibleEntityListProps {
  viewMode: 'category' | 'review';
  activeCategoryIsCharacterLike: boolean;
  isFocusedCharacterTask: boolean;
  isFocusedRecordTask: boolean;
  activeCategory: EntityCategory;
  categories: EntityCategory[];
  visibleEntities: ReturnType<typeof useWorldBibleReview>['visibleEntities'];
  reviewEntityInsightsById: ReturnType<typeof useWorldBibleReview>['reviewEntityInsightsById'];
  reviewQueue: ReturnType<typeof useWorldBibleReview>['reviewQueue'];
  aliasMapByEntityId: Map<string, string[]>;
  linkedLoreDocumentByEntityId: ReturnType<typeof useWorldBibleSelectedEntity>['linkedLoreDocumentByEntityId'];
  linkingLoreEntityId: string | null;
  compendiumLinkedEntityIds: Set<string>;
  seriesParentProjectId: string | null;
  showCharacterTools: boolean;
  showGameSystems: boolean;
  hasRuleset: boolean;
  actions: Pick<ReturnType<typeof useWorldBibleEntityActions>,
    'isCharacterLikeEntity' | 'handleMarkEntityComplete' | 'handleDeleteEntity' |
    'handlePromoteEntity' | 'handleImportEntityToCharacters' | 'handleAddEntityToCompendium' |
    'deletingEntityId' | 'promotingEntityId' | 'importingCharacterEntityId' |
    'linkingCompendiumEntityId'>;
  handleEdit: (entity: WorldEntity, focus?: 'general' | 'aliases') => void;
  handleOpenOrCreateLinkedLoreDocument: (entity: WorldEntity) => Promise<void>;
}

export const WorldBibleEntityList = (props: WorldBibleEntityListProps) => {
  const {
    viewMode, activeCategoryIsCharacterLike, isFocusedCharacterTask,
    isFocusedRecordTask, activeCategory, categories, visibleEntities,
    reviewEntityInsightsById, reviewQueue, aliasMapByEntityId,
    linkedLoreDocumentByEntityId, linkingLoreEntityId, compendiumLinkedEntityIds,
    seriesParentProjectId, showCharacterTools, showGameSystems, hasRuleset,
    actions, handleEdit, handleOpenOrCreateLinkedLoreDocument
  } = props;
  const {
    isCharacterLikeEntity, handleMarkEntityComplete, handleDeleteEntity,
    handlePromoteEntity, handleImportEntityToCharacters, handleAddEntityToCompendium,
    deletingEntityId, promotingEntityId, importingCharacterEntityId,
    linkingCompendiumEntityId
  } = actions;
  const seriesConfig = seriesParentProjectId ? {parentProjectId: seriesParentProjectId} : null;
  return (
    <>
          {viewMode !== 'review' && (activeCategoryIsCharacterLike ? !isFocusedCharacterTask : !isFocusedRecordTask) && (
          <div
            className={`${styles.listSection} ${styles.castListSection}`}
          >
            <h2>{activeCategory.name}</h2>
            {visibleEntities.length === 0 && (
              <p className={styles.emptyState}>
                {`No ${activeCategory.name.toLowerCase()} yet. Use Create Manually above when you are ready.`}
              </p>
            )}
            <ul className={styles.entityList}>
              {visibleEntities.map((entity) => {
                const entityCategory =
                  categories.find((category) => category.id === entity.categoryId) ?? null;
                const {
                  primarySummary,
                  summarySourceLabel,
                  summaryIsTruncated,
                  secondaryFields,
                  hiddenFieldCount
                } = buildEntityCardSummary(
                  entity,
                  entityCategory,
                  aliasMapByEntityId.get(entity.id) ?? []
                );
                const entityIsCharacterLike = isCharacterLikeEntity(entity);
                const entityInsight = reviewEntityInsightsById.get(entity.id);
                const entityQueueItem = reviewQueue.find((item) => item.entity.id === entity.id);
                const needsAliasReview = Boolean(
                  entityQueueItem?.reasons.includes('aliasFollowUp')
                );
                const needsCompletionReview = Boolean(
                  entityQueueItem?.reasons.includes('needsCompletion') || entity.needsCompletion
                );
                const hasNameResolutionMatch =
                  entityIsCharacterLike && (entityInsight?.matchCount ?? 0) > 0;
                const needsNameReview = needsAliasReview || hasNameResolutionMatch;
                const hasReviewBadge = needsCompletionReview || needsNameReview;
                const linkedLoreDocument = linkedLoreDocumentByEntityId.get(entity.id) ?? null;

                return (
                <li key={entity.id} className={styles.entityCard}>
                  <div className={styles.entityHeader}>
                    <div className={styles.entityName}>{entity.name}</div>
                    {entity.isNew && (
                      <span className={styles.newBadge}>New</span>
                    )}
                    {needsCompletionReview && (
                      <span className={styles.completionBadge}>Needs completion</span>
                    )}
                    {needsNameReview && (
                      <span className={styles.aliasMatchBadge}>Names need review</span>
                    )}
                  </div>
                  {hasNameResolutionMatch && (
                    <div className={styles.entityAttentionNote}>
                      This character looks related to{' '}
                      {entityInsight?.matchCount === 1
                        ? 'another canon record'
                        : `${entityInsight?.matchCount ?? 0} canon records`}
                      . Use Resolve names to merge duplicates or convert short forms into aliases.
                    </div>
                  )}
                  {primarySummary && (
                    <div className={styles.entitySummaryBlock}>
                      {summarySourceLabel && (
                        <span className={styles.entitySummaryLabel}>
                          {summarySourceLabel}
                        </span>
                      )}
                      <p className={styles.entitySummary}>{primarySummary}</p>
                      {summaryIsTruncated && (
                        <span className={styles.entitySummaryHint}>
                          Open to read full text
                        </span>
                      )}
                    </div>
                  )}
                  {secondaryFields.map((field) => (
                    <div key={field.label} className={styles.entityField}>
                      <strong>{field.label}:</strong> {field.value}
                    </div>
                  ))}
                  {hiddenFieldCount > 0 && (
                    <div className={styles.entityFieldMore}>
                      + {hiddenFieldCount} more field{hiddenFieldCount === 1 ? '' : 's'}
                    </div>
                  )}
                  {linkedLoreDocument && (
                    <div className={styles.entityField}>
                      <strong>Source Note:</strong> {linkedLoreDocument.title}
                    </div>
                  )}
                  <div className={styles.entityActions}>
                    <button
                      onClick={() => handleEdit(entity)}
                    >
                      Edit
                    </button>
                    {hasNameResolutionMatch && (
                      <button
                        type='button'
                        className={styles.primaryButton}
                        onClick={() => handleEdit(entity, 'aliases')}
                      >
                        Resolve names
                      </button>
                    )}
                    {hasReviewBadge && (
                      <button
                        type='button'
                        onClick={() => void handleMarkEntityComplete(entity)}
                      >
                        Mark reviewed
                      </button>
                    )}
                    <button
                      type='button'
                      onClick={() => void handleOpenOrCreateLinkedLoreDocument(entity)}
                      disabled={linkingLoreEntityId === entity.id}
                    >
                      {linkingLoreEntityId === entity.id
                        ? 'Creating...'
                        : linkedLoreDocument
                          ? 'Open Source Note'
                          : 'Create linked Source Note'}
                    </button>
                    <button
                      onClick={() => handleDeleteEntity(entity.id)}
                      disabled={deletingEntityId === entity.id}
                      className={styles.deleteButton}
                    >
                      {deletingEntityId === entity.id ? 'Deleting...' : 'Delete'}
                    </button>
                    {seriesConfig?.parentProjectId && (
                      <button
                        type='button'
                        onClick={() => void handlePromoteEntity(entity)}
                        disabled={promotingEntityId === entity.id}
                      >
                        {promotingEntityId === entity.id
                          ? 'Promoting...'
                          : 'Promote to parent'}
                      </button>
                    )}
                    {entityIsCharacterLike && showCharacterTools && (
                      <button
                        type='button'
                        onClick={() => void handleImportEntityToCharacters(entity)}
                        disabled={importingCharacterEntityId === entity.id}
                        title='Open optional character tools for roster details. World Bible remains the canonical record.'
                      >
                        {importingCharacterEntityId === entity.id
                          ? 'Opening...'
                          : 'Open optional tools'}
                      </button>
                    )}
                    {entityIsCharacterLike && showCharacterTools && hasRuleset && (
                      <button
                        type='button'
                        onClick={() =>
                          void handleImportEntityToCharacters(entity, {
                            autoCreateSheet: true
                          })
                        }
                        disabled={importingCharacterEntityId === entity.id}
                        title='Open or create sheet and state tracking for this World Bible character. World Bible remains the canonical record.'
                      >
                        {importingCharacterEntityId === entity.id
                          ? 'Opening...'
                          : 'Create/open sheet + state'}
                      </button>
                    )}
                    {showGameSystems && (
                      <button
                        type='button'
                        onClick={() => void handleAddEntityToCompendium(entity)}
                        disabled={linkingCompendiumEntityId === entity.id}
                        title='Attach optional progression, crafting, discovery, or bestiary mechanics.'
                      >
                        {linkingCompendiumEntityId === entity.id
                          ? 'Linking...'
                          : compendiumLinkedEntityIds.has(entity.id)
                            ? 'Update Mechanics'
                            : 'Add Mechanics'}
                      </button>
                    )}
                  </div>
                </li>
                );
              })}
            </ul>
          </div>
          )}
    </>
  );
};
