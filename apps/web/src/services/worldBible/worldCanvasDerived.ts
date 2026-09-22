import type {
  EntityCategory,
  LoreDocument,
  LoreDocumentKind,
  LoreDocumentLink,
  WorldCanvasLensKind,
  WorldEntity
} from '../../entityTypes';
import {isSystemNegativeSpaceCategory} from './systemNegativeSpace';

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
