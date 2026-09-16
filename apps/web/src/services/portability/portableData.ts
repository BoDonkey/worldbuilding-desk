import type {
  CanonicalFact,
  EntityCategory,
  LoreDocument,
  LoreDocumentLink,
  WorldEntity
} from '../../entityTypes';
import type {ConsistencyAlias} from '../consistency';
import {buildZip, type ZipEntryInput} from '../../utils/zip';

export const PORTABLE_DATA_SCHEMA_VERSION = 1;

export interface PortableMarkdownFrontmatter {
  schema?: string;
  type?: string;
  title?: string;
  category?: string;
  categorySlug?: string;
  aliases?: string[];
  links?: string[];
  fields?: Record<string, unknown>;
  kind?: string;
}

export interface PortableMarkdownDraft {
  id: string;
  fileName: string;
  relativePath: string;
  title: string;
  content: string;
  frontmatter: PortableMarkdownFrontmatter;
  wikilinks: string[];
  destination: 'source-note' | 'world-bible';
}

const textEncoder = new TextEncoder();

const sanitizePathPart = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'untitled';

const yamlValue = (value: unknown): string => JSON.stringify(value);

const frontmatter = (entries: Array<[string, unknown]>): string =>
  [
    '---',
    ...entries
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}: ${yamlValue(value)}`),
    '---'
  ].join('\n');

const stripHtml = (value: string): string =>
  value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const valueToText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return stripHtml(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
};

const factValueToText = (fact: CanonicalFact): string =>
  typeof fact.value === 'string'
    ? fact.value
    : `${fact.value.label}: ${fact.value.value}`;

const csvCell = (value: unknown): string => {
  const text = valueToText(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const aliasValuesForEntity = (
  entity: WorldEntity,
  aliases: ConsistencyAlias[]
): string[] => {
  const fieldAliases = valueToText(
    entity.fields.alternative_names ?? entity.fields.aliases
  )
    .split(/[,\n]/)
    .map((value) => value.trim())
    .filter(Boolean);
  const storedAliases = aliases
    .filter((alias) => alias.targetType === 'entity' && alias.targetId === entity.id)
    .map((alias) => alias.alias.trim())
    .filter(Boolean);
  return Array.from(new Set([...fieldAliases, ...storedAliases]));
};

const linkedEntityNames = (
  entity: WorldEntity,
  entitiesById: Map<string, WorldEntity>
): string[] =>
  entity.links
    .map((id) => entitiesById.get(id)?.name)
    .filter((name): name is string => Boolean(name));

const buildEntityMarkdown = (params: {
  entity: WorldEntity;
  category: EntityCategory;
  entitiesById: Map<string, WorldEntity>;
  aliases: ConsistencyAlias[];
  facts: CanonicalFact[];
}): string => {
  const {entity, category, entitiesById, aliases, facts} = params;
  const entityAliases = aliasValuesForEntity(entity, aliases);
  const linkNames = linkedEntityNames(entity, entitiesById);
  const exportFields = Object.fromEntries(
    category.fieldSchema
      .map((field) => [field.key, entity.fields[field.key]] as const)
      .filter(([, value]) => value !== undefined && value !== '')
  );
  const lines = [
    frontmatter([
      ['schema', `worldbuilding-desk/portable/${PORTABLE_DATA_SCHEMA_VERSION}`],
      ['type', 'world-bible-record'],
      ['title', entity.name],
      ['category', category.name],
      ['categorySlug', category.slug],
      ['aliases', entityAliases],
      ['links', linkNames],
      ['fields', exportFields]
    ]),
    '',
    `# ${entity.name}`,
    ''
  ];

  category.fieldSchema.forEach((field) => {
    const value = valueToText(entity.fields[field.key]);
    if (!value) return;
    lines.push(`## ${field.label}`, '', value, '');
  });
  if (entityAliases.length > 0) {
    lines.push('## Aliases', '', entityAliases.map((value) => `- ${value}`).join('\n'), '');
  }
  if (linkNames.length > 0) {
    lines.push('## Links', '', linkNames.map((value) => `- [[${value}]]`).join('\n'), '');
  }
  if (facts.length > 0) {
    lines.push(
      '## Accepted facts',
      '',
      ...facts.map((fact) => {
        const from = fact.validFromSceneId ? `; from scene ${fact.validFromSceneId}` : '';
        const until = fact.validUntilSceneId ? `; until scene ${fact.validUntilSceneId}` : '';
        return `- **${fact.factType}:** ${factValueToText(fact)}${from}${until}`;
      }),
      ''
    );
  }
  return lines.join('\n').trim() + '\n';
};

const buildSourceNoteMarkdown = (params: {
  document: LoreDocument;
  links: LoreDocumentLink[];
  entitiesById: Map<string, WorldEntity>;
}): string => {
  const {document, links, entitiesById} = params;
  const linkNames = links
    .map((link) => entitiesById.get(link.targetId)?.name)
    .filter((name): name is string => Boolean(name));
  const content = document.format === 'html' ? stripHtml(document.content) : document.content;
  return [
    frontmatter([
      ['schema', `worldbuilding-desk/portable/${PORTABLE_DATA_SCHEMA_VERSION}`],
      ['type', 'source-note'],
      ['title', document.title],
      ['kind', document.kind],
      ['links', Array.from(new Set(linkNames))]
    ]),
    '',
    `# ${document.title}`,
    '',
    content.trim(),
    ''
  ].join('\n');
};

const buildCategoryCsv = (params: {
  category: EntityCategory;
  entities: WorldEntity[];
  allEntities: Map<string, WorldEntity>;
  aliases: ConsistencyAlias[];
  facts: CanonicalFact[];
}): string => {
  const {category, entities, allEntities, aliases, facts} = params;
  const headings = [
    'name',
    'aliases',
    'links',
    ...category.fieldSchema.map((field) => field.key),
    'accepted_facts'
  ];
  const rows = entities.map((entity) => {
    const entityFacts = facts.filter(
      (fact) => fact.targetType === 'entity' && fact.targetId === entity.id
    );
    return [
      entity.name,
      aliasValuesForEntity(entity, aliases).join(' | '),
      linkedEntityNames(entity, allEntities).join(' | '),
      ...category.fieldSchema.map((field) => entity.fields[field.key]),
      entityFacts.map((fact) => `${fact.factType}: ${factValueToText(fact)}`).join(' | ')
    ].map(csvCell).join(',');
  });
  return [headings.map(csvCell).join(','), ...rows].join('\r\n') + '\r\n';
};

export const PORTABLE_SCHEMA_README = `# Worldbuilding Desk portable data\n\nSchema: worldbuilding-desk/portable/${PORTABLE_DATA_SCHEMA_VERSION}\n\nThis ZIP is the human-readable interchange format. The project backup ZIP remains the full-fidelity restore format.\n\n- \`world-bible/<category>/*.md\`: one record per Markdown file. YAML frontmatter contains category, aliases, links, and a JSON-compatible \`fields\` map. Accepted facts are repeated in the Markdown body so another tool can read them without parsing application data.\n- \`world-bible/*.csv\`: one UTF-8 CSV per category. Multi-value cells use \` | \` inside a correctly quoted CSV cell.\n- \`source-notes/*.md\`: one source note per Markdown file. Source Notes are evidence, not accepted canon.\n\nOn import, files are staged for review. World Bible files become incomplete drafts; Source Notes remain non-canon and use the normal extraction/review flow. Wikilinks are suggestions only and are ignored unless the author explicitly maps them.\n`;

export function buildPortableDataZip(params: {
  categories: EntityCategory[];
  entities: WorldEntity[];
  aliases: ConsistencyAlias[];
  canonicalFacts: CanonicalFact[];
  loreDocuments: LoreDocument[];
  loreDocumentLinks: LoreDocumentLink[];
}): Uint8Array {
  const entitiesById = new Map(params.entities.map((entity) => [entity.id, entity]));
  const categoriesById = new Map(params.categories.map((category) => [category.id, category]));
  const entries: ZipEntryInput[] = [
    {fileName: 'README.md', fileData: textEncoder.encode(PORTABLE_SCHEMA_README)}
  ];
  const usedPaths = new Set(entries.map((entry) => entry.fileName));
  const uniquePath = (path: string): string => {
    if (!usedPaths.has(path)) {
      usedPaths.add(path);
      return path;
    }
    const extensionIndex = path.lastIndexOf('.');
    const stem = extensionIndex >= 0 ? path.slice(0, extensionIndex) : path;
    const extension = extensionIndex >= 0 ? path.slice(extensionIndex) : '';
    let suffix = 2;
    while (usedPaths.has(`${stem}-${suffix}${extension}`)) suffix += 1;
    const candidate = `${stem}-${suffix}${extension}`;
    usedPaths.add(candidate);
    return candidate;
  };

  params.entities.forEach((entity) => {
    const category = categoriesById.get(entity.categoryId);
    if (!category) return;
    const facts = params.canonicalFacts.filter(
      (fact) => fact.targetType === 'entity' && fact.targetId === entity.id
    );
    entries.push({
      fileName: uniquePath(`world-bible/${sanitizePathPart(category.slug || category.name)}/${sanitizePathPart(entity.name)}.md`),
      fileData: textEncoder.encode(
        buildEntityMarkdown({
          entity,
          category,
          entitiesById,
          aliases: params.aliases,
          facts
        })
      )
    });
  });

  params.categories.forEach((category) => {
    entries.push({
      fileName: uniquePath(`world-bible/${sanitizePathPart(category.slug || category.name)}.csv`),
      fileData: textEncoder.encode(
        buildCategoryCsv({
          category,
          entities: params.entities.filter((entity) => entity.categoryId === category.id),
          allEntities: entitiesById,
          aliases: params.aliases,
          facts: params.canonicalFacts
        })
      )
    });
  });

  params.loreDocuments.forEach((document) => {
    entries.push({
      fileName: uniquePath(`source-notes/${sanitizePathPart(document.title)}.md`),
      fileData: textEncoder.encode(
        buildSourceNoteMarkdown({
          document,
          links: params.loreDocumentLinks.filter(
            (link) => link.loreDocumentId === document.id
          ),
          entitiesById
        })
      )
    });
  });

  return buildZip(entries);
}

export function downloadPortableDataZip(params: {
  projectName: string;
  categories: EntityCategory[];
  entities: WorldEntity[];
  aliases: ConsistencyAlias[];
  canonicalFacts: CanonicalFact[];
  loreDocuments: LoreDocument[];
  loreDocumentLinks: LoreDocumentLink[];
}): void {
  const bytes = buildPortableDataZip(params);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], {type: 'application/zip'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizePathPart(params.projectName)}-portable-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const parseFrontmatterValue = (raw: string): unknown => {
  const value = raw.trim();
  if (!value) return '';
  try {
    return JSON.parse(value);
  } catch {
    return value.replace(/^['"]|['"]$/g, '');
  }
};

export function parsePortableMarkdown(raw: string, fileName: string): PortableMarkdownDraft {
  const normalized = raw.replace(/\r\n/g, '\n');
  let body = normalized;
  const metadata: Record<string, unknown> = {};
  if (normalized.startsWith('---\n')) {
    const end = normalized.indexOf('\n---\n', 4);
    if (end >= 0) {
      normalized.slice(4, end).split('\n').forEach((line) => {
        const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
        if (match) metadata[match[1]] = parseFrontmatterValue(match[2]);
      });
      body = normalized.slice(end + 5).trim();
    }
  }
  const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const fallbackTitle = fileName.replace(/\.(?:md|markdown)$/i, '').trim() || 'Imported note';
  const type = typeof metadata.type === 'string' ? metadata.type : undefined;
  const title = typeof metadata.title === 'string' ? metadata.title : heading ?? fallbackTitle;
  const wikilinks = Array.from(
    new Set(
      Array.from(body.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g))
        .map((match) => match[1].trim())
        .filter(Boolean)
    )
  );
  const metadataLinks = Array.isArray(metadata.links)
    ? metadata.links.filter((value): value is string => typeof value === 'string')
    : [];
  return {
    id: crypto.randomUUID(),
    fileName,
    relativePath: fileName,
    title,
    content: body,
    frontmatter: metadata as PortableMarkdownFrontmatter,
    wikilinks: Array.from(new Set([...metadataLinks, ...wikilinks])),
    destination: type === 'world-bible-record' ? 'world-bible' : 'source-note'
  };
}

export async function parsePortableMarkdownFiles(files: File[]): Promise<PortableMarkdownDraft[]> {
  const markdownFiles = files.filter((file) => /\.(?:md|markdown)$/i.test(file.name));
  return Promise.all(
    markdownFiles.map(async (file) => {
      const draft = parsePortableMarkdown(await file.text(), file.name);
      return {
        ...draft,
        relativePath: file.webkitRelativePath || file.name
      };
    })
  );
}
