import {useEffect, useRef} from 'react';
import type {FormEvent} from 'react';
import type {WorldEntity} from '../../../entityTypes';
import type {useWorldCanvas} from '../../../hooks/useWorldCanvas';
import {isItemCategory} from '../../../services/worldBible/worldBibleSummary';
import {isSystemNegativeSpaceCategory} from '../../../services/worldBible/systemNegativeSpace';
import styles from '../../../assets/components/WorldBibleRoute.module.css';
import {WorldBibleRecordAiHelper} from '../WorldBibleRecordAiHelper';
import {WorldBibleLinkedSourceNote} from '../WorldBibleLinkedSourceNote';
import {
  WorldBibleCharacterRecord,
  type WorldBibleCharacterRecordProps
} from './WorldBibleCharacterRecord';
import {WorldBibleGeneralRecord} from './WorldBibleGeneralRecord';
import {WorldBibleCanonSummary} from './WorldBibleCanonSummary';

type WorldCanvasLinks = Pick<
  ReturnType<typeof useWorldCanvas>,
  'linkCoreIdeaEntity' | 'linkSketchEntity' | 'linkOpenThreadEntity'
>;

interface WorldBibleRecordEditorProps extends WorldBibleCharacterRecordProps {
  isCharacterLike: boolean;
  entities: WorldEntity[];
  refreshMemories: () => Promise<unknown>;
  seriesParentProjectId: string | null;
  worldCanvas: WorldCanvasLinks;
  /** Bumps when an imported record opens, to bring the form into view. */
  scrollRequest: number;
  onCancel: () => void;
}

/**
 * The open World Bible record: AI helper, canonicalization handoff, the
 * character or general form, save and cancel, and the record's canon summary.
 */
export function WorldBibleRecordEditor(props: WorldBibleRecordEditorProps) {
  const {
    activeProject,
    projectSettings,
    category,
    isCharacterLike,
    aiCoaching,
    draft,
    selection,
    authoring,
    resolution,
    entityActions,
    currentEntityMemories,
    refreshMemories,
    seriesParentProjectId,
    worldCanvas,
    scrollRequest,
    setFeedback,
    onCancel
  } = props;
  const {editingId, recordAuthoringMode, characterDetailSection, areItemDetailsExpanded} = draft;
  const {selectedEntity, linkedLoreDocumentByEntityId, linkingLoreEntityId} = selection;
  const {isSubmittingEntity, saveEntityDraft, handleMarkEntityComplete} = entityActions;
  const {handoffGuidance, setHandoffGuidance} = resolution;
  const isItem = isItemCategory(category);
  const isDescriptionFirstItemDraft = isItem && !editingId;
  const itemDescriptionField = isItem
    ? category.fieldSchema.find((field) => field.key === 'description') ?? null
    : null;
  const showAiHelper = aiCoaching && (!isDescriptionFirstItemDraft || areItemDetailsExpanded);

  const recordFormRef = useRef<HTMLFormElement | null>(null);
  useEffect(() => {
    if (scrollRequest > 0) recordFormRef.current?.scrollIntoView({block: 'start'});
  }, [scrollRequest]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const canvasLinkTarget = draft.pendingCanvasEntityLink;
    const savedEntity = isItem && !editingId
      ? await saveEntityDraft({successMessage: 'Item saved.'})
      : await saveEntityDraft();
    if (savedEntity && canvasLinkTarget) {
      if (canvasLinkTarget.type === 'core-idea') {
        await worldCanvas.linkCoreIdeaEntity(savedEntity.id);
      } else if (canvasLinkTarget.type === 'sketch') {
        await worldCanvas.linkSketchEntity(canvasLinkTarget.kind, canvasLinkTarget.sketchId, savedEntity.id);
      } else {
        await worldCanvas.linkOpenThreadEntity(canvasLinkTarget.id, savedEntity.id);
      }
      draft.setPendingCanvasEntityLink(null);
    }
  };

  return (
    <div className={styles.formSection}>
      <form ref={recordFormRef} onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formHeadingRow}>
          <h2>
            {isCharacterLike
              ? editingId
                ? 'Edit Character Canon'
                : 'New Character Canon'
              : `${editingId ? 'Edit' : 'New'} ${category.name.slice(0, -1)}`}
          </h2>
          {showAiHelper && (
            <button
              type='button'
              onClick={() => {
                authoring.setAiHelperSelectedText('');
                authoring.setAiHelperProposal(null);
                authoring.setIsRecordAiHelperOpen((value) => !value);
              }}
              aria-expanded={authoring.isRecordAiHelperOpen}
            >
              {authoring.isRecordAiHelperOpen ? 'Hide AI helper' : 'AI helper'}
            </button>
          )}
        </div>
        {showAiHelper && (
          <WorldBibleRecordAiHelper
            activeProject={activeProject} projectSettings={projectSettings}
            activeCategory={category} editingId={editingId}
            authoring={authoring}
          />
        )}

        {isCharacterLike && (
          <div className={styles.reviewHint}>
            This is the character's canonical home. Use the sections below for
            story-facing canon and any optional capabilities attached to it.
          </div>
        )}
        {isCharacterLike && handoffGuidance?.kind === 'character-canonicalization' && (
          <div className={styles.handoffBanner}>
            <div>
              <strong>Resolve {handoffGuidance.sourceName}</strong>
              <p>
                World Bible owns character identity. If this is the same person
                as an existing character, make the shorter name an alias. If not,
                keep them separate.
              </p>
            </div>
            {resolution.canonicalResolutionMatches.length === 0 && selectedEntity && (
              <button
                type='button'
                onClick={() =>
                  void handleMarkEntityComplete(selectedEntity).then(() => {
                    setHandoffGuidance(null);
                  })
                }
              >
                Keep {authoring.currentCharacterLabel} canonical
              </button>
            )}
            <button
              type='button'
              className={styles.dismissButton}
              onClick={() => setHandoffGuidance(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {isCharacterLike ? (
          <WorldBibleCharacterRecord {...props} />
        ) : (
          <WorldBibleGeneralRecord
            {...props}
            isSystemNegativeSpace={isSystemNegativeSpaceCategory(category)}
            isDescriptionFirstItemDraft={isDescriptionFirstItemDraft}
            itemDescriptionField={itemDescriptionField}
          />
        )}

        {selectedEntity && !isCharacterLike && (
          <WorldBibleLinkedSourceNote
            entity={selectedEntity}
            linkedDocument={linkedLoreDocumentByEntityId.get(selectedEntity.id) ?? null}
            isOpening={linkingLoreEntityId === selectedEntity.id}
            onOpen={(entity) => void selection.handleOpenOrCreateLinkedLoreDocument(entity)}
          />
        )}

        <div className={styles.formActions}>
          <button
            type='submit'
            className={styles.primaryButton}
            disabled={isSubmittingEntity}
          >
            {isSubmittingEntity
              ? 'Saving...'
              : editingId
                ? isCharacterLike
                  ? 'Save Canon Changes'
                  : 'Save Changes'
                : isCharacterLike
                  ? 'Create Canon Record'
                  : isItem
                    ? 'Save Item'
                    : 'Create Entry'}
          </button>
          {(editingId || isCharacterLike || recordAuthoringMode !== 'idle') && (
            <button type='button' onClick={onCancel} disabled={isSubmittingEntity}>
              Cancel
            </button>
          )}
        </div>
      </form>
      {editingId &&
        (!isCharacterLike || characterDetailSection === 'notes') && (
        <WorldBibleCanonSummary
          projectId={activeProject.id}
          editingId={editingId}
          memories={currentEntityMemories}
          refreshMemories={refreshMemories}
          seriesParentProjectId={seriesParentProjectId}
          setFeedback={setFeedback}
        />
      )}
    </div>
  );
}
