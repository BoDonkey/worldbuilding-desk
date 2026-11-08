import {useEffect, useRef} from 'react';
import type {Dispatch, SetStateAction} from 'react';
import type {Location} from 'react-router';
import type {EntityCategory, WorldEntity} from '../entityTypes';
import type {CharacterDetailSection} from '../components/WorldBible/WorldBibleCharacterSections';
import type {
  PendingCanvasEntityLink,
  RecordReviewFocus
} from '../components/WorldBible/record/useWorldBibleRecordDraft';
import type {WorldBibleCanonicalizationHandoff} from './useWorldBibleRecordResolution';

/** Navigation state other screens pass when they send the author to World Bible. */
interface WorldBibleLocationState {
  focusEntityId?: string;
  focusCategorySlug?: string;
  startCharacterImport?: boolean;
  focus?: RecordReviewFocus;
  focusCharacterSection?: CharacterDetailSection;
  handoffKind?: 'character-canonicalization';
  handoffSourceName?: string;
  handoffMatchEntityId?: string;
  prefillRecordName?: string;
  worldCanvasLinkTarget?: PendingCanvasEntityLink;
  openReview?: boolean;
}

interface UseWorldBibleLocationFocusOptions {
  location: Location;
  categories: EntityCategory[];
  entities: WorldEntity[];
  activeTab: string | null;
  setActiveTab: (categoryId: string) => void;
  setViewMode: (mode: 'category' | 'review') => void;
  isPasteImportOpen: boolean;
  setIsPasteImportOpen: (open: boolean) => void;
  startCanvasProposal: (
    category: EntityCategory,
    recordName: string,
    link: PendingCanvasEntityLink
  ) => void;
  handleEdit: (entity: WorldEntity, focus?: RecordReviewFocus) => void;
  setCharacterDetailSection: (section: CharacterDetailSection) => void;
  setHandoffGuidance: Dispatch<SetStateAction<WorldBibleCanonicalizationHandoff | null>>;
}

/**
 * Applies deep links into World Bible: open the review queue, a category,
 * a paste import, a record proposed from World Canvas, or a focused record
 * (with an optional section and canonicalization handoff). Each link applies
 * once per navigation.
 */
export function useWorldBibleLocationFocus({
  location,
  categories,
  entities,
  activeTab,
  setActiveTab,
  setViewMode,
  isPasteImportOpen,
  setIsPasteImportOpen,
  startCanvasProposal,
  handleEdit,
  setCharacterDetailSection,
  setHandoffGuidance
}: UseWorldBibleLocationFocusOptions) {
  const focusedEntityKeyRef = useRef<string | null>(null);
  const canvasProposalKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const state = location.state as WorldBibleLocationState | null;
    if (state?.openReview) {
      setViewMode('review');
    }
    if (state?.focusCategorySlug && categories.length > 0) {
      const targetCategory = categories.find(
        (category) => category.slug === state.focusCategorySlug
      );
      if (targetCategory && activeTab !== targetCategory.id) {
        setActiveTab(targetCategory.id);
      }
      setViewMode('category');
      if (state.startCharacterImport && !isPasteImportOpen) {
        setIsPasteImportOpen(true);
      }
      const canvasProposalKey = state.prefillRecordName && state.worldCanvasLinkTarget
        ? `${location.key}:${state.focusCategorySlug}:${state.prefillRecordName}`
        : null;
      if (
        targetCategory &&
        state.prefillRecordName &&
        state.worldCanvasLinkTarget &&
        canvasProposalKeyRef.current !== canvasProposalKey
      ) {
        startCanvasProposal(targetCategory, state.prefillRecordName, state.worldCanvasLinkTarget);
        canvasProposalKeyRef.current = canvasProposalKey;
      }
    }
    const focusEntityId = state?.focusEntityId;
    if (!focusEntityId) return;
    const focus = state?.focus ?? 'general';
    const focusKey = `${location.key}:${focusEntityId}:${focus}:${state?.focusCharacterSection ?? ''}`;
    if (focusedEntityKeyRef.current === focusKey) {
      return;
    }
    const target = entities.find((entity) => entity.id === focusEntityId);
    if (!target) return;
    setActiveTab(target.categoryId);
    setViewMode('category');
    handleEdit(target, focus);
    if (state?.focusCharacterSection) {
      setCharacterDetailSection(state.focusCharacterSection);
    }
    if (state?.handoffKind === 'character-canonicalization' && state.handoffSourceName) {
      setHandoffGuidance({
        kind: 'character-canonicalization',
        sourceName: state.handoffSourceName,
        matchEntityId: state.handoffMatchEntityId
      });
    }
    focusedEntityKeyRef.current = focusKey;
  }, [
    activeTab,
    categories,
    entities,
    handleEdit,
    isPasteImportOpen,
    location.key,
    location.state,
    setActiveTab,
    setViewMode,
    setIsPasteImportOpen,
    startCanvasProposal,
    setCharacterDetailSection,
    setHandoffGuidance
  ]);
}
