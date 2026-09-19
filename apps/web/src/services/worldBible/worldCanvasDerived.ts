import type {
  EntityCategory,
  LoreDocument,
  LoreDocumentKind,
  LoreDocumentLink,
  WorldCanvasDocument,
  WorldCanvasLensKind,
  WorldEntity
} from '../../entityTypes';
import {isSystemNegativeSpaceCategory} from './systemNegativeSpace';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const SOURCE_NOTE_KIND_BY_LENS: Readonly<
  Partial<Record<WorldCanvasLensKind, readonly LoreDocumentKind[]>>
> = {
  people: ['character_dossier'],
  places: ['place_history'],
  factions: ['faction_notes'],
  history: ['timeline'],
  power: [],
  customs: ['myth'],
  constraints: []
};

export function mapCategoryToLens(
  category: EntityCategory
): WorldCanvasLensKind | null {
  if (category.kind === 'character') return 'people';
  const slug = category.slug.toLowerCase();
  if (['location', 'place', 'region'].some((hint) => slug.includes(hint))) {
    return 'places';
  }
  if (['faction', 'guild', 'house', 'order'].some((hint) => slug.includes(hint))) {
    return 'factions';
  }
  return null;
}

interface DerivedContext {
  entities: WorldEntity[];
  categories: EntityCategory[];
  loreDocuments: LoreDocument[];
  links: LoreDocumentLink[];
  isGeneralFiction?: boolean;
}

export interface WorldCanvasLensSummary {
  recordNames: string[];
  recordCount: number;
  sourceNoteTitles: string[];
  sourceNoteCount: number;
}

const visibleCategories = (
  categories: EntityCategory[],
  isGeneralFiction = false
) => new Map(
  categories
    .filter((category) => !isGeneralFiction || !isSystemNegativeSpaceCategory(category))
    .map((category) => [category.id, category])
);

const sortNames = (names: Iterable<string>): string[] =>
  [...new Set(names)].sort((left, right) => left.localeCompare(right));

export function summarizeLens(
  lens: {kind: WorldCanvasLensKind; linkedEntityIds?: string[]; linkedSourceNoteIds?: string[]},
  context: DerivedContext
): WorldCanvasLensSummary {
  const categoriesById = visibleCategories(
    context.categories,
    context.isGeneralFiction
  );
  const visibleEntities = context.entities.filter((entity) => {
    const category = categoriesById.get(entity.categoryId);
    return category && mapCategoryToLens(category) === lens.kind;
  });
  const explicitEntityIds = new Set(lens.linkedEntityIds ?? []);
  context.entities.forEach((entity) => {
    if (!explicitEntityIds.has(entity.id)) return;
    const category = categoriesById.get(entity.categoryId);
    if (category && !visibleEntities.some((candidate) => candidate.id === entity.id)) {
      visibleEntities.push(entity);
    }
  });

  const visibleEntityIds = new Set(visibleEntities.map((entity) => entity.id));
  const linkedDocumentIds = new Set(
    context.links
      .filter((link) => visibleEntityIds.has(link.targetId))
      .map((link) => link.loreDocumentId)
  );
  const explicitDocumentIds = new Set(lens.linkedSourceNoteIds ?? []);
  const lensKinds = new Set(SOURCE_NOTE_KIND_BY_LENS[lens.kind] ?? []);
  const sourceNotes = context.loreDocuments.filter(
    (document) => document.status === 'active' && (
      lensKinds.has(document.kind) ||
      linkedDocumentIds.has(document.id) ||
      explicitDocumentIds.has(document.id)
    )
  );
  const recordNames = sortNames(visibleEntities.map((entity) => entity.name));
  const sourceNoteTitles = sortNames(sourceNotes.map((document) => document.title));
  return {
    recordNames,
    recordCount: recordNames.length,
    sourceNoteTitles,
    sourceNoteCount: sourceNoteTitles.length
  };
}

export function summarizeOtherRecords(
  context: Pick<DerivedContext, 'entities' | 'categories' | 'isGeneralFiction'>
): string[] {
  const categoriesById = visibleCategories(
    context.categories,
    context.isGeneralFiction
  );
  return sortNames(
    context.entities
      .filter((entity) => {
        const category = categoriesById.get(entity.categoryId);
        return category ? mapCategoryToLens(category) === null : !context.isGeneralFiction;
      })
      .map((entity) => entity.name)
  );
}

export type WorldCanvasWorthALookKind =
  | 'needs-completion'
  | 'missing-source-note'
  | 'stale-question'
  | 'review-candidates';

export interface WorldCanvasWorthALookItem {
  id: string;
  kind: WorldCanvasWorthALookKind;
  label: string;
  reason: string;
  entityId?: string;
  questionId?: string;
  action: 'record' | 'question' | 'review';
}

interface WorthALookParams {
  canvas: WorldCanvasDocument;
  entities: WorldEntity[];
  categories: EntityCategory[];
  links: LoreDocumentLink[];
  unresolvedReviewCount?: number;
  isGeneralFiction?: boolean;
  now?: number;
  limit?: number;
}

export function buildWorthALookList({
  canvas,
  entities,
  categories,
  links,
  unresolvedReviewCount = 0,
  isGeneralFiction = false,
  now = Date.now(),
  limit = 8
}: WorthALookParams): WorldCanvasWorthALookItem[] {
  const categoriesById = visibleCategories(categories, isGeneralFiction);
  const visibleEntities = entities
    .filter((entity) => {
      const category = categoriesById.get(entity.categoryId);
      if (!category) return !isGeneralFiction;
      return !isGeneralFiction || !isSystemNegativeSpaceCategory(category);
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  const linkedEntityIds = new Set(links.map((link) => link.targetId));
  const reviewItem: WorldCanvasWorthALookItem | null = unresolvedReviewCount > 0
    ? {
        id: 'review-candidates',
        kind: 'review-candidates',
        label: `${unresolvedReviewCount} review candidate${unresolvedReviewCount === 1 ? '' : 's'}`,
        reason: 'These candidates are waiting for an author decision in Review.',
        action: 'review'
      }
    : null;
  const items: WorldCanvasWorthALookItem[] = [];

  if (visibleEntities.length === 0 && reviewItem) items.push(reviewItem);
  visibleEntities
    .filter((entity) => entity.needsCompletion)
    .forEach((entity) => items.push({
      id: `needs-completion:${entity.id}`,
      kind: 'needs-completion',
      label: entity.name,
      reason: 'This record is marked for author review.',
      entityId: entity.id,
      action: 'record'
    }));
  if (visibleEntities.length > 0 && reviewItem) items.push(reviewItem);
  visibleEntities
    .filter((entity) => !linkedEntityIds.has(entity.id))
    .forEach((entity) => items.push({
      id: `missing-source-note:${entity.id}`,
      kind: 'missing-source-note',
      label: entity.name,
      reason: 'No Source Note is linked to this record.',
      entityId: entity.id,
      action: 'record'
    }));
  canvas.questions
    .filter((question) => question.status === 'open')
    .filter((question) => now - question.createdAt > THIRTY_DAYS_MS)
    .sort((left, right) => left.createdAt - right.createdAt || left.text.localeCompare(right.text))
    .forEach((question) => items.push({
      id: `stale-question:${question.id}`,
      kind: 'stale-question',
      label: question.text,
      reason: 'This question has stayed open for more than 30 days.',
      questionId: question.id,
      action: 'question'
    }));

  return items.slice(0, Math.max(0, limit));
}
