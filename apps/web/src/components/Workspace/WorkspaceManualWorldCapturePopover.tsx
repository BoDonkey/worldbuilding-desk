import {useMemo, type Dispatch, type SetStateAction} from 'react';
import type {Character, EntityCategory, WorldEntity} from '../../entityTypes';
import {buildCharacterCaptureAliasList} from '../../services/worldBible/worldBibleCanonicalization';
import {
  buildManualCaptureLinkOptions,
  isCharacterLikeCategory,
  normalizeCaptureSelection
} from '../../services/workspace/workspaceView';
import {ContextPopover} from '../Editor/ContextPopover';
import {WorldCategorySelect} from './WorldCategorySelect';
import type {WorkspaceReviewSurfaceActions} from './WorkspaceReviewSurfacePopover';
import styles from '../../styles/WorkspaceRoute.module.css';

export interface ManualWorldCapture {
  sourceText: string;
  draftText: string;
  left: number;
  top: number;
}

interface WorkspaceManualWorldCapturePopoverProps {
  capture: ManualWorldCapture;
  setCapture: Dispatch<SetStateAction<ManualWorldCapture | null>>;
  createLabel: string;
  categories: EntityCategory[];
  characters: Character[];
  entities: WorldEntity[];
  /** World Bible snippets keyed by normalized name, for an exact existing match. */
  entitySnippets: Record<string, {name: string}>;
  existingTargetId: string;
  setExistingTargetId: Dispatch<SetStateAction<string>>;
  rejectedAliasSuggestions: Record<string, string[]>;
  setRejectedAliasSuggestions: Dispatch<SetStateAction<Record<string, string[]>>>;
  consistency: WorkspaceReviewSurfaceActions;
  onMatchedExisting: (message: string) => void;
}

/** **Add to World** from a selection: create a World Bible record, use or link an existing one. */
export function WorkspaceManualWorldCapturePopover({
  capture,
  setCapture,
  createLabel,
  categories,
  characters,
  entities,
  entitySnippets,
  existingTargetId,
  setExistingTargetId,
  rejectedAliasSuggestions,
  setRejectedAliasSuggestions,
  consistency,
  onMatchedExisting
}: WorkspaceManualWorldCapturePopoverProps) {
  const {
    unknownCategorySelection,
    setUnknownCategorySelection,
    createWorldCategory,
    resolveUnknownEntity,
    resolvingUnknown,
    linkUnknownEntity,
    linkingUnknown,
    clearUnknownSurface
  } = consistency;
  const normalizedDraft = normalizeCaptureSelection(capture.draftText);
  const existingEntity =
    entitySnippets[normalizedDraft] ??
    entities.find((entity) => normalizeCaptureSelection(entity.name) === normalizedDraft) ??
    null;
  const linkOptions = useMemo(
    () =>
      buildManualCaptureLinkOptions({
        draftText: capture.draftText,
        categories,
        characters,
        entities
      }),
    [categories, characters, entities, capture.draftText]
  );
  const selectedCategoryId = unknownCategorySelection.__manual__ ?? '';
  const selectedCategory = selectedCategoryId
    ? categories.find((category) => category.id === selectedCategoryId) ?? null
    : null;
  const isCharacterCapture = isCharacterLikeCategory(selectedCategory);
  const aliasPreview = isCharacterCapture
    ? buildCharacterCaptureAliasList({
        surface: capture.sourceText,
        canonicalName: capture.draftText,
        rejectedAliases: rejectedAliasSuggestions[capture.sourceText] ?? []
      })
    : [];

  return (
    <ContextPopover
      title='Add to World'
      message='Use the selected text as a starting point, then edit it before creating a world record.'
      left={capture.left}
      top={capture.top}
      onClose={() => setCapture(null)}
    >
      <div className={styles.consistencyPopoverActions}>
        <WorldCategorySelect
          categories={categories}
          value={selectedCategoryId}
          onChange={(categoryId) =>
            setUnknownCategorySelection((prev) => ({
              ...prev,
              __manual__: categoryId
            }))
          }
          onCreate={createWorldCategory}
          ariaLabel='World Bible type'
        />
        <label className={styles.captureNameField}>
          {isCharacterCapture ? 'Canonical name' : 'Name or place'}
          <input
            type='text'
            value={capture.draftText}
            onChange={(event) => {
              setExistingTargetId('');
              setCapture((prev) => (prev ? {...prev, draftText: event.target.value} : prev));
            }}
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
                          [capture.sourceText]: [...(prev[capture.sourceText] ?? []), alias]
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
              capture.sourceText,
              unknownCategorySelection.__manual__ || undefined,
              capture.draftText,
              aliasPreview
            ).then(() => {
              setRejectedAliasSuggestions((prev) => {
                const copy = {...prev};
                delete copy[capture.sourceText];
                return copy;
              });
              setCapture(null);
            })
          }
          disabled={resolvingUnknown === capture.sourceText}
        >
          {resolvingUnknown === capture.sourceText
            ? 'Adding...'
            : isCharacterCapture
              ? 'Create character'
              : createLabel}
        </button>
        {existingEntity && (
          <button
            type='button'
            onClick={() => {
              clearUnknownSurface(capture.sourceText);
              setCapture(null);
              onMatchedExisting(`"${capture.sourceText}" matched ${existingEntity.name}.`);
            }}
          >
            Use existing
          </button>
        )}
        {linkOptions.length > 0 && (
          <div className={styles.manualExistingLinkControls}>
            <select
              value={existingTargetId}
              onChange={(event) => setExistingTargetId(event.target.value)}
              aria-label='Existing world record'
            >
              <option value=''>Link to existing...</option>
              {linkOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} ({option.type})
                </option>
              ))}
            </select>
            <button
              type='button'
              onClick={() => {
                const selectedTargetId = existingTargetId;
                const selectedSurface = capture.sourceText;
                void linkUnknownEntity(selectedSurface, selectedTargetId, selectedSurface).then(
                  (linked) => {
                    if (!linked) return;
                    clearUnknownSurface(selectedSurface);
                    setExistingTargetId('');
                    setCapture(null);
                  }
                );
              }}
              disabled={!existingTargetId || linkingUnknown === capture.sourceText}
            >
              {linkingUnknown === capture.sourceText ? 'Linking...' : 'Link selected'}
            </button>
          </div>
        )}
      </div>
    </ContextPopover>
  );
}
