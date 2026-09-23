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

const LENS_ORDER: readonly WorldCanvasLensKind[] = [
  'people', 'places', 'factions', 'history', 'power', 'customs', 'constraints'
];

export function mapCategoryToLens(category: EntityCategory): WorldCanvasLensKind | null {
  if (category.kind === 'character') return 'people';
  const slug = category.slug.toLowerCase();
  if (['location', 'place', 'region'].some((hint) => slug.includes(hint))) return 'places';
  if (['faction', 'guild', 'house', 'order'].some((hint) => slug.includes(hint))) return 'factions';
  return null;
}

export type CanvasReferenceSourceType = 'world-bible' | 'source-note';
export type CanvasReferenceProvenance =
  | 'author-pinned'
  | 'category-match'
  | 'source-note-kind'
  | 'linked-record'
  | 'unclassified';

export interface CanvasReference {
  id: string;
  label: string;
  sourceType: CanvasReferenceSourceType;
  lensKinds: WorldCanvasLensKind[];
  existence: 'available' | 'missing';
  provenance: CanvasReferenceProvenance;
  provenanceLabel: string;
  rule?: string;
}

export interface WorldCanvasReferencePalette {
  pinned: CanvasReference[];
  suggested: CanvasReference[];
  browse: CanvasReference[];
}

interface DerivedContext {
  entities: WorldEntity[];
  categories: EntityCategory[];
  loreDocuments: LoreDocument[];
  links: LoreDocumentLink[];
  isGeneralFiction?: boolean;
}

interface ReferenceAccumulator {
  id: string;
  sourceType: CanvasReferenceSourceType;
  lensKinds: Set<WorldCanvasLensKind>;
  origins: Set<string>;
  rules: Set<string>;
}

const referenceKey = (sourceType: CanvasReferenceSourceType, id: string) => `${sourceType}:${id}`;

const visibleCategories = (categories: EntityCategory[], isGeneralFiction = false) => new Map(
  categories
    .filter((category) => !isGeneralFiction || !isSystemNegativeSpaceCategory(category))
    .map((category) => [category.id, category])
);

const sortLensKinds = (kinds: Iterable<WorldCanvasLensKind>) => [...new Set(kinds)].sort(
  (left, right) => LENS_ORDER.indexOf(left) - LENS_ORDER.indexOf(right)
);

const addReference = (
  target: Map<string, ReferenceAccumulator>,
  params: {
    id: string;
    sourceType: CanvasReferenceSourceType;
    lensKind?: WorldCanvasLensKind;
    origin?: string;
    rule?: string;
  }
) => {
  const key = referenceKey(params.sourceType, params.id);
  const existing = target.get(key) ?? {
    id: params.id,
    sourceType: params.sourceType,
    lensKinds: new Set<WorldCanvasLensKind>(),
    origins: new Set<string>(),
    rules: new Set<string>()
  };
  if (params.lensKind) existing.lensKinds.add(params.lensKind);
  if (params.origin) existing.origins.add(params.origin);
  if (params.rule) existing.rules.add(params.rule);
  target.set(key, existing);
};

const collectPinned = (canvas: WorldCanvasDocument) => {
  const pinned = new Map<string, ReferenceAccumulator>();
  if (canvas.coreIdeaEntityId) addReference(pinned, {id: canvas.coreIdeaEntityId, sourceType: 'world-bible', origin: 'Linked from Core Idea'});
  if (canvas.coreIdeaSourceNoteId) addReference(pinned, {id: canvas.coreIdeaSourceNoteId, sourceType: 'source-note', origin: 'Linked from Core Idea'});
  canvas.lenses.forEach((lens) => {
    lens.sketches.forEach((sketch) => {
      sketch.linkedEntityIds.forEach((id) => addReference(pinned, {id, sourceType: 'world-bible', lensKind: lens.kind, origin: 'Linked from a sketch'}));
      sketch.linkedSourceNoteIds.forEach((id) => addReference(pinned, {id, sourceType: 'source-note', lensKind: lens.kind, origin: 'Linked from a sketch'}));
    });
  });
  canvas.openThreads.forEach((thread) => {
    if (thread.linkedEntityId) addReference(pinned, {id: thread.linkedEntityId, sourceType: 'world-bible', lensKind: thread.lensKind, origin: 'Linked from an Open Thread'});
    if (thread.linkedSourceNoteId) addReference(pinned, {id: thread.linkedSourceNoteId, sourceType: 'source-note', lensKind: thread.lensKind, origin: 'Linked from an Open Thread'});
  });
  return pinned;
};

const materialize = (
  reference: ReferenceAccumulator,
  context: DerivedContext,
  provenance: CanvasReferenceProvenance
): CanvasReference => {
  const record = reference.sourceType === 'world-bible'
    ? context.entities.find((entity) => entity.id === reference.id)
    : context.loreDocuments.find((document) => document.id === reference.id);
  const origins = [...reference.origins];
  const rules = [...reference.rules];
  return {
    id: reference.id,
    label: record ? ('name' in record ? record.name : record.title) : 'No longer exists',
    sourceType: reference.sourceType,
    lensKinds: sortLensKinds(reference.lensKinds),
    existence: record ? 'available' : 'missing',
    provenance,
    provenanceLabel: origins.join('; ') || 'Available in this project',
    ...(rules.length ? {rule: rules.join('; ')} : {})
  };
};

const sortReferences = (references: CanvasReference[]) => references.sort((left, right) =>
  left.label.localeCompare(right.label) || left.sourceType.localeCompare(right.sourceType) || left.id.localeCompare(right.id)
);

/** Builds the palette without mutating or repairing Canvas links. */
export function deriveWorldCanvasReferencePalette(
  canvas: WorldCanvasDocument,
  context: DerivedContext
): WorldCanvasReferencePalette {
  const categoriesById = visibleCategories(context.categories, context.isGeneralFiction);
  const visibleEntities = context.entities.filter((entity) => categoriesById.has(entity.categoryId));
  const entitiesById = new Map(visibleEntities.map((entity) => [entity.id, entity]));
  const pinnedByKey = collectPinned(canvas);
  const suggestedByKey = new Map<string, ReferenceAccumulator>();

  visibleEntities.forEach((entity) => {
    const category = categoriesById.get(entity.categoryId)!;
    const lensKind = mapCategoryToLens(category);
    if (!lensKind) return;
    addReference(suggestedByKey, {
      id: entity.id,
      sourceType: 'world-bible',
      lensKind,
      origin: `World Bible category: ${category.name}`,
      rule: `Suggested because the ${category.name} category maps to this lens.`
    });
  });

  const sourceNoteLenses = new Map<string, Set<WorldCanvasLensKind>>();
  context.links.forEach((link) => {
    const entity = entitiesById.get(link.targetId);
    const category = entity ? categoriesById.get(entity.categoryId) : undefined;
    const lensKind = category ? mapCategoryToLens(category) : null;
    if (!lensKind) return;
    const kinds = sourceNoteLenses.get(link.loreDocumentId) ?? new Set<WorldCanvasLensKind>();
    kinds.add(lensKind);
    sourceNoteLenses.set(link.loreDocumentId, kinds);
  });

  context.loreDocuments.filter((document) => document.status === 'active').forEach((document) => {
    LENS_ORDER.forEach((lensKind) => {
      if ((SOURCE_NOTE_KIND_BY_LENS[lensKind] ?? []).includes(document.kind)) {
        addReference(suggestedByKey, {
          id: document.id,
          sourceType: 'source-note',
          lensKind,
          origin: `Source Note kind: ${document.kind}`,
          rule: 'Suggested because this Source Note type maps to this lens.'
        });
      }
    });
    sourceNoteLenses.get(document.id)?.forEach((lensKind) => addReference(suggestedByKey, {
      id: document.id,
      sourceType: 'source-note',
      lensKind,
      origin: 'Linked to a matching World Bible record',
      rule: 'Suggested because this Source Note links to a World Bible record mapped to this lens.'
    }));
  });

  pinnedByKey.forEach((_reference, key) => suggestedByKey.delete(key));
  const classifiedKeys = new Set([...pinnedByKey.keys(), ...suggestedByKey.keys()]);
  const browseByKey = new Map<string, ReferenceAccumulator>();
  visibleEntities.forEach((entity) => {
    const key = referenceKey('world-bible', entity.id);
    if (classifiedKeys.has(key)) return;
    const category = categoriesById.get(entity.categoryId);
    addReference(browseByKey, {id: entity.id, sourceType: 'world-bible', origin: category ? `World Bible category: ${category.name}` : 'World Bible record'});
  });
  context.loreDocuments.filter((document) => document.status === 'active').forEach((document) => {
    const key = referenceKey('source-note', document.id);
    if (classifiedKeys.has(key)) return;
    addReference(browseByKey, {id: document.id, sourceType: 'source-note', origin: 'Source Note without a deterministic lens match'});
  });

  const pinned = sortReferences([...pinnedByKey.values()].map((reference) => materialize(reference, context, 'author-pinned')));
  const suggested = sortReferences([...suggestedByKey.values()].map((reference) => {
    const provenance = reference.origins.has('Linked to a matching World Bible record')
      ? 'linked-record'
      : reference.sourceType === 'world-bible'
        ? 'category-match'
        : 'source-note-kind';
    return materialize(reference, context, provenance);
  }));
  const browse = sortReferences([...browseByKey.values()].map((reference) => materialize(reference, context, 'unclassified')));
  return {pinned, suggested, browse};
}

// Compatibility helpers retained for older callers while the palette becomes canonical.
export interface WorldCanvasLensSummary {
  recordNames: string[];
  recordCount: number;
  sourceNoteTitles: string[];
  sourceNoteCount: number;
}

export function summarizeLens(
  lens: {kind: WorldCanvasLensKind; linkedEntityIds?: string[]; linkedSourceNoteIds?: string[]},
  context: DerivedContext
): WorldCanvasLensSummary {
  const canvas: WorldCanvasDocument = {
    schemaVersion: 2, id: 'summary', projectId: 'summary', premise: '',
    lenses: [{kind: lens.kind, sketches: [{id: 'summary', text: '', linkedEntityIds: lens.linkedEntityIds ?? [], linkedSourceNoteIds: lens.linkedSourceNoteIds ?? [], linkedOpenThreadIds: [], createdAt: 0, updatedAt: 0}], activeSketchId: 'summary', updatedAt: 0}],
    openThreads: [], createdAt: 0, updatedAt: 0
  };
  const palette = deriveWorldCanvasReferencePalette(canvas, context);
  const references = [...palette.pinned, ...palette.suggested].filter((reference) => reference.lensKinds.includes(lens.kind));
  const recordNames = references.filter((reference) => reference.sourceType === 'world-bible' && reference.existence === 'available').map((reference) => reference.label);
  const sourceNoteTitles = references.filter((reference) => reference.sourceType === 'source-note' && reference.existence === 'available').map((reference) => reference.label);
  return {recordNames, recordCount: recordNames.length, sourceNoteTitles, sourceNoteCount: sourceNoteTitles.length};
}

export function summarizeOtherRecords(
  context: Pick<DerivedContext, 'entities' | 'categories' | 'isGeneralFiction'>
): string[] {
  const categoriesById = visibleCategories(context.categories, context.isGeneralFiction);
  return context.entities
    .filter((entity) => {
      const category = categoriesById.get(entity.categoryId);
      return category ? mapCategoryToLens(category) === null : false;
    })
    .map((entity) => entity.name)
    .sort((left, right) => left.localeCompare(right));
}
