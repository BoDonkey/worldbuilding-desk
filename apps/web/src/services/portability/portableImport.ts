import type {EntityCategory, LoreDocument, Project, WorldEntity} from '../../entityTypes';
import {replaceLoreDocumentLinks, saveLoreDocument, type ConsistencyAlias} from '../storage';
import {summarizeContent} from '../lore/sourceNoteCapture';
import {normalizeNameExact} from '../names/nameMatching';
import {
  ALTERNATIVE_NAMES_KEY,
  getPreferredImportField,
  normalizeRichTextValue,
  parseAlternativeNames
} from '../worldBible/worldBibleEntityHelpers';
import {markdownToRichHtml} from '../worldBible/worldBibleImportParsing';
import {
  saveWorldBibleRecord,
  type WorldBibleIndexing
} from '../worldBible/worldBibleRecordSave';
import type {PortableMarkdownDraft} from './portableData';

/**
 * Applying a reviewed portable Markdown folder (3.45; moved out of
 * PortableDataPanel). Source Notes stay non-canon; World Bible files become
 * incomplete drafts saved through `saveWorldBibleRecord`.
 */

export type WikiLinkAction = 'ignore' | 'link' | 'alias';

export interface PortableImportDraft extends PortableMarkdownDraft {
  include: boolean;
  categoryId: string;
  wikiLinkActions: Record<string, WikiLinkAction>;
}

export const findPortableCategoryId = (
  draft: PortableMarkdownDraft,
  categories: EntityCategory[]
): string => {
  const category = categories.find(
    (candidate) =>
      normalizeNameExact(candidate.slug) === normalizeNameExact(draft.frontmatter.categorySlug ?? '') ||
      normalizeNameExact(candidate.name) === normalizeNameExact(draft.frontmatter.category ?? '')
  );
  return category?.id ?? categories[0]?.id ?? '';
};

/** The record a wikilink names, by record name or by alias. */
export const matchPortableEntity = (
  name: string,
  entities: WorldEntity[],
  aliases: ConsistencyAlias[]
): WorldEntity | null => {
  const key = normalizeNameExact(name);
  const direct = entities.find((entity) => normalizeNameExact(entity.name) === key);
  if (direct) return direct;
  const alias = aliases.find(
    (candidate) => candidate.targetType === 'entity' && normalizeNameExact(candidate.alias) === key
  );
  return alias ? entities.find((entity) => entity.id === alias.targetId) ?? null : null;
};

const validLoreKind = (value: unknown): LoreDocument['kind'] => {
  const allowed: LoreDocument['kind'][] = [
    'character_dossier',
    'place_history',
    'faction_notes',
    'item_history',
    'myth',
    'timeline',
    'general_lore'
  ];
  return typeof value === 'string' && allowed.includes(value as LoreDocument['kind'])
    ? value as LoreDocument['kind']
    : 'general_lore';
};

/**
 * The World Bible draft a Markdown file becomes, and the aliases to store for
 * it. Every alias stays in the record's alternative-names field; an alias
 * another record already answers to is not moved to this one.
 */
export const planPortableWorldBibleRecord = (params: {
  draft: PortableImportDraft;
  category: EntityCategory;
  projectId: string;
  linkedEntityIds: string[];
  entities: WorldEntity[];
  aliases: ConsistencyAlias[];
  now: number;
}): {entity: WorldEntity; aliases: string[]} => {
  const {draft, category} = params;
  const fields: Record<string, unknown> = {};
  const importedFields = draft.frontmatter.fields;
  if (importedFields && typeof importedFields === 'object') {
    category.fieldSchema.forEach((field) => {
      const value = importedFields[field.key];
      if (value === undefined || value === null || value === '') return;
      fields[field.key] = field.type === 'textarea'
        ? normalizeRichTextValue(String(value))
        : value;
    });
  }
  const preferredField = getPreferredImportField(category);
  if (preferredField && !fields[preferredField.key]) {
    fields[preferredField.key] = preferredField.type === 'textarea'
      ? markdownToRichHtml(draft.content)
      : draft.content.trim();
  }
  const frontmatterAliases = Array.isArray(draft.frontmatter.aliases)
    ? draft.frontmatter.aliases
    : [];
  const selectedAliases = draft.wikilinks.filter(
    (name) => draft.wikiLinkActions[name] === 'alias'
  );
  const combinedAliases = parseAlternativeNames(
    [...frontmatterAliases, ...selectedAliases].join(', ')
  );
  if (combinedAliases.length > 0) {
    fields[ALTERNATIVE_NAMES_KEY] = combinedAliases.join(', ');
  }
  const taken = new Set([
    ...params.entities.map((entity) => normalizeNameExact(entity.name)),
    ...params.aliases.map((alias) => normalizeNameExact(alias.alias))
  ]);
  return {
    entity: {
      id: crypto.randomUUID(),
      projectId: params.projectId,
      categoryId: category.id,
      name: draft.title.trim(),
      fields,
      isNew: true,
      needsCompletion: true,
      links: Array.from(new Set(params.linkedEntityIds)),
      createdAt: params.now,
      updatedAt: params.now
    },
    aliases: combinedAliases.filter((alias) => !taken.has(normalizeNameExact(alias)))
  };
};

async function saveSourceNote(
  draft: PortableImportDraft,
  linked: WorldEntity[],
  projectId: string,
  indexing: WorldBibleIndexing,
  now: number
): Promise<void> {
  const documentId = crypto.randomUUID();
  const document: LoreDocument = {
    id: documentId,
    projectId,
    title: draft.title.trim(),
    kind: validLoreKind(draft.frontmatter.kind),
    format: 'markdown',
    content: draft.content.trim(),
    summary: summarizeContent(draft.content),
    source: {type: 'import', fileName: draft.relativePath, mimeType: 'text/markdown'},
    status: 'active',
    createdAt: now,
    updatedAt: now
  };
  await saveLoreDocument(document);
  await replaceLoreDocumentLinks({
    loreDocumentId: documentId,
    links: linked.map((entity, index) => ({
      id: crypto.randomUUID(),
      projectId,
      loreDocumentId: documentId,
      targetType: 'entity' as const,
      targetId: entity.id,
      relationship: index === 0 ? 'primary_subject' as const : 'mentions' as const,
      createdAt: now
    }))
  });
  await indexing.ragService?.indexDocument(
    `lore:${document.id}`,
    document.title,
    document.content,
    'lore',
    {tags: [document.kind, 'lore'], entityIds: linked.map((entity) => entity.id)}
  );
}

/**
 * Saves the selected drafts in order. Stops at the first failure; files
 * before it stay saved. `categoriesNow` is read per draft so a category
 * created mid-import is seen.
 */
export async function applyPortableImport(params: {
  drafts: PortableImportDraft[];
  project: Pick<Project, 'id'>;
  categoriesNow: () => EntityCategory[];
  entities: WorldEntity[];
  aliases: ConsistencyAlias[];
  /** Wikilinks the author chose to link, keyed `${draft.id}:${name}`. */
  matchedEntities: ReadonlyMap<string, WorldEntity>;
  indexing: WorldBibleIndexing;
}): Promise<{sourceNoteCount: number; worldBibleCount: number}> {
  let sourceNoteCount = 0;
  let worldBibleCount = 0;
  const entities = [...params.entities];
  const aliases = [...params.aliases];
  for (const draft of params.drafts) {
    const now = Date.now();
    const linked = draft.wikilinks
      .filter((name) => draft.wikiLinkActions[name] === 'link')
      .map((name) => params.matchedEntities.get(`${draft.id}:${name}`))
      .filter((entity): entity is WorldEntity => Boolean(entity));
    if (draft.destination === 'source-note') {
      await saveSourceNote(draft, linked, params.project.id, params.indexing, now);
      sourceNoteCount += 1;
      continue;
    }

    const categories = params.categoriesNow();
    const categoryId = categories.some((candidate) => candidate.id === draft.categoryId)
      ? draft.categoryId
      : findPortableCategoryId(draft, categories);
    const category = categories.find((candidate) => candidate.id === categoryId);
    if (!category) throw new Error(`Choose a category for "${draft.title}".`);
    const plan = planPortableWorldBibleRecord({
      draft,
      category,
      projectId: params.project.id,
      linkedEntityIds: linked.map((entity) => entity.id),
      entities,
      aliases,
      now
    });
    const saved = await saveWorldBibleRecord({
      entity: plan.entity,
      category,
      categories,
      entities,
      aliases: plan.aliases,
      indexing: params.indexing
    });
    entities.push(saved.entity);
    aliases.push(...saved.aliases);
    worldBibleCount += 1;
  }
  return {sourceNoteCount, worldBibleCount};
}
