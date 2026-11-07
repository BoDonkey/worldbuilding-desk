import {useEffect, useRef} from 'react';
import type {EntityCategory, WorldEntity} from '../../../entityTypes';
import {ALTERNATIVE_NAMES_KEY} from '../../../services/worldBible/worldBibleEntityHelpers';
import styles from '../../../assets/components/WorldBibleRoute.module.css';
import type {WorldBibleRecordDraft} from './useWorldBibleRecordDraft';
import type {OpenRecord, RecordEntityActions, RecordResolution, RecordVariant} from './recordTypes';
import {RecordNameResolver} from './RecordNameResolver';
import {RecordMatchPanel} from './RecordMatchPanel';

interface RecordNamesSectionProps {
  variant: RecordVariant;
  recordLabel: string;
  currentCharacterLabel: string;
  category: EntityCategory;
  categories: EntityCategory[];
  /** Items drafted description-first name the record in their own field. */
  showNameInput: boolean;
  draft: WorldBibleRecordDraft;
  selectedEntity: WorldEntity | null;
  selectedEntityAliases: string[];
  resolution: RecordResolution;
  entityActions: RecordEntityActions;
  onEdit: OpenRecord;
}

/**
 * A record's canonical name and aliases: renames, alias suggestions and
 * promotion, moving to another category, manual resolution, and overlap matches.
 */
export function RecordNamesSection({
  variant,
  recordLabel,
  currentCharacterLabel,
  category,
  categories,
  showNameInput,
  draft,
  selectedEntity,
  selectedEntityAliases,
  resolution,
  entityActions,
  onEdit
}: RecordNamesSectionProps) {
  const {
    editingId,
    name,
    setName,
    fieldValues,
    setFieldValues,
    isNameResolverOpen,
    setIsNameResolverOpen,
    moveCategoryTargetId,
    setMoveCategoryTargetId,
    pendingReviewFocus,
    setPendingReviewFocus
  } = draft;
  const {
    isCanonicalRenameDraft,
    suggestedCharacterAliases,
    canonicalResolutionMatches,
    handlePromoteAliasToCanonical,
    handleMoveSelectedEntityCategory,
    handleAddSuggestedCharacterAlias,
    movingEntityCategoryId
  } = resolution;
  const isCharacter = variant === 'character';
  const aliasTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Records opened from an alias review land with the cursor at the end of their aliases.
  useEffect(() => {
    if (pendingReviewFocus !== 'aliases') return;
    aliasTextareaRef.current?.focus();
    aliasTextareaRef.current?.setSelectionRange(
      aliasTextareaRef.current.value.length,
      aliasTextareaRef.current.value.length
    );
    setPendingReviewFocus(null);
  }, [editingId, pendingReviewFocus, setPendingReviewFocus]);

  return (
    <section
      className={styles.canonSection}
      aria-label={isCharacter ? 'Canonical names and aliases' : 'Names and aliases'}
    >
      <div className={styles.canonSectionHeader}>
        <div>
          <strong>{isCharacter ? 'Canon and aliases' : 'Names and aliases'}</strong>
          <span>
            {isCharacter
              ? 'Canonical name, aliases, overlap review, and merge decisions for this character.'
              : `Canonical name, alternate names, overlap review, and merge decisions for this ${recordLabel}.`}
          </span>
        </div>
        <button
          type='button'
          onClick={() => setIsNameResolverOpen((value) => !value)}
        >
          {isNameResolverOpen ? 'Hide resolver' : 'Resolve names'}
        </button>
      </div>

      {showNameInput && (
        <div className={styles.formGroup}>
          <label>
            Name
            <input
              type='text'
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          {isCanonicalRenameDraft && selectedEntity && (
            <div className={styles.reviewHint}>
              Saving this rename will keep <strong>{selectedEntity.name}</strong> as an
              alternative name.
            </div>
          )}
        </div>
      )}

      <div className={styles.formGroup}>
        <label>
          Alternative names
          <textarea
            ref={aliasTextareaRef}
            value={fieldValues[ALTERNATIVE_NAMES_KEY] || ''}
            onChange={(e) =>
              setFieldValues({
                ...fieldValues,
                [ALTERNATIVE_NAMES_KEY]: e.target.value
              })
            }
            rows={3}
            placeholder={
              isCharacter
                ? 'Comma-separated nicknames, titles, short forms, or alternate spellings'
                : 'Comma-separated aliases, titles, or shorthand references'
            }
          />
        </label>
        {isCharacter && (
          <div className={styles.reviewHint}>
            Use alternative names for short forms like first-name references,
            titles, nicknames, and prior canonical forms after a rename.
          </div>
        )}
        {isCharacter && suggestedCharacterAliases.length > 0 && (
          <div className={styles.aliasSuggestionPanel}>
            <span>Suggested aliases</span>
            <div className={styles.aliasSuggestionList}>
              {suggestedCharacterAliases.map((alias) => (
                <button
                  key={alias}
                  type='button'
                  onClick={() => handleAddSuggestedCharacterAlias(alias)}
                >
                  Add {alias}
                </button>
              ))}
            </div>
          </div>
        )}
        {selectedEntity && selectedEntityAliases.length > 0 && (
          <div className={styles.aliasPromotionPanel}>
            <span>Current aliases</span>
            <div className={styles.aliasPromotionList}>
              {selectedEntityAliases.map((alias) => (
                <span key={alias} className={styles.aliasPromotionChip}>
                  {alias}
                  <button
                    type='button'
                    onClick={() => handlePromoteAliasToCanonical(alias)}
                  >
                    Make canonical
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedEntity && (
        <div className={styles.categoryMovePanel}>
          <label>
            Category
            <select
              value={moveCategoryTargetId || selectedEntity.categoryId}
              onChange={(event) => setMoveCategoryTargetId(event.target.value)}
            >
              {categories.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type='button'
            onClick={() => void handleMoveSelectedEntityCategory()}
            disabled={
              movingEntityCategoryId === selectedEntity.id ||
              !moveCategoryTargetId ||
              moveCategoryTargetId === selectedEntity.categoryId
            }
          >
            {movingEntityCategoryId === selectedEntity.id
              ? 'Moving...'
              : 'Move to category'}
          </button>
        </div>
      )}

      {isNameResolverOpen && (
        <RecordNameResolver
          variant={variant}
          recordLabel={recordLabel}
          categoryName={category.name}
          editingId={editingId}
          name={name}
          selectedEntity={selectedEntity}
          currentCharacterLabel={currentCharacterLabel}
          setManualResolutionTargetId={draft.setManualResolutionTargetId}
          resolution={resolution}
          entityActions={entityActions}
          onEdit={onEdit}
        />
      )}

      {canonicalResolutionMatches.length > 0 && (
        <RecordMatchPanel
          variant={variant}
          editingId={editingId}
          currentCharacterLabel={currentCharacterLabel}
          resolution={resolution}
          entityActions={entityActions}
          onEdit={onEdit}
        />
      )}
    </section>
  );
}
