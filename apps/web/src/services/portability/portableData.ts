import type {
  AuthoredMeasure,
  CanonicalFact,
  EntityCategory,
  LoreDocument,
  LoreDocumentLink,
  PlaceTravelTime,
  UnitConversion,
  WorldEntity,
  WorldMap
} from '../../entityTypes';
import type {ConsistencyAlias} from '../storage';
import {buildZip, type ZipEntryInput} from '../../utils/zip';
import {
  connectionsForPlace,
  describeConnectionMeasures,
  placeAncestors,
  placesById,
  type PlaceConnectionView,
  type PlacesById
} from '../worldBible/places';
import {isLocationCategory} from '../worldBible/worldBibleEntityPlans';
import {mapsById, normalizeUnitConversions, type MapsById} from '../worldBible/maps';

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
  /** Location records: the parent place's name and the connections this record stores. */
  place?: PortablePlace;
}

export interface PortablePlace {
  inside?: string;
  connections?: Array<{
    to: string;
    kind: string;
    oneWay?: boolean;
    distance?: AuthoredMeasure;
    travelTimes?: PlaceTravelTime[];
  }>;
  /** Where the place is on each map, by map name (slice 4.79). */
  placements?: Array<{map: string; x: number; y: number}>;
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

/** The record's own place data, by name, for frontmatter; undefined when it has none. */
const portablePlace = (entity: WorldEntity, places: PlacesById, maps: MapsById): PortablePlace | undefined => {
  const parent = entity.place?.parentId ? places.get(entity.place.parentId) : undefined;
  const connections = (entity.place?.connections ?? []).flatMap((connection) => {
    const to = places.get(connection.toId);
    if (!to || to.id === entity.id) return [];
    return [{
      to: to.name,
      kind: connection.kind,
      ...(connection.oneWay ? {oneWay: true} : {}),
      ...(connection.distance ? {distance: connection.distance} : {}),
      ...(connection.travelTimes?.length ? {travelTimes: connection.travelTimes} : {})
    }];
  });
  const placements = placementsOnMaps(entity, maps).map(({map, x, y}) => ({map: map.name, x, y}));
  if (!parent && connections.length === 0 && placements.length === 0) return undefined;
  return {
    ...(parent ? {inside: parent.name} : {}),
    ...(connections.length > 0 ? {connections} : {}),
    ...(placements.length > 0 ? {placements} : {})
  };
};

/** The record's placements on maps that still exist, by map name. */
const placementsOnMaps = (entity: WorldEntity, maps: MapsById) =>
  (entity.place?.placements ?? [])
    .flatMap((placement) => {
      const map = maps.get(placement.mapId);
      return map ? [{map, x: placement.x, y: placement.y}] : [];
    })
    .sort((a, b) => a.map.name.localeCompare(b.map.name));

/** "Region (6, 8)" per map. */
const describePlacements = (entity: WorldEntity, maps: MapsById): string[] =>
  placementsOnMaps(entity, maps).map(({map, x, y}) => `${map.name} (${x}, ${y})`);

/** "road to Ford (one-way) — 40 miles; on foot: 3 days", seen from the place being exported. */
const describeConnectionView = (
  view: PlaceConnectionView,
  places: PlacesById,
  wikilink: boolean
): string => {
  const otherName = places.get(view.otherId)?.name ?? '';
  const other = wikilink ? `[[${otherName}]]` : otherName;
  const direction =
    view.direction === 'from' ? `from ${other} (one-way, arriving here)`
    : view.direction === 'to' ? `to ${other} (one-way)`
    : `to ${other}`;
  const measures = describeConnectionMeasures(view.connection);
  return `${view.connection.kind} ${direction}${measures ? ` — ${measures}` : ''}`;
};

const buildEntityMarkdown = (params: {
  entity: WorldEntity;
  category: EntityCategory;
  entitiesById: Map<string, WorldEntity>;
  places: PlacesById;
  maps: MapsById;
  aliases: ConsistencyAlias[];
  facts: CanonicalFact[];
}): string => {
  const {entity, category, entitiesById, places, maps, aliases, facts} = params;
  const isPlace = places.has(entity.id);
  const placeData = isPlace ? portablePlace(entity, places, maps) : undefined;
  const placements = isPlace ? describePlacements(entity, maps) : [];
  const ancestors = isPlace ? placeAncestors(entity.id, places) : [];
  const connectionViews = isPlace ? connectionsForPlace(entity.id, places) : [];
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
      ['fields', exportFields],
      ['place', placeData]
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
  if (ancestors.length > 0) {
    lines.push('## Inside', '', ancestors.map((place) => `[[${place.name}]]`).join(' › '), '');
  }
  if (connectionViews.length > 0) {
    lines.push(
      '## Connections',
      '',
      connectionViews.map((view) => `- ${describeConnectionView(view, places, true)}`).join('\n'),
      ''
    );
  }
  if (placements.length > 0) {
    lines.push('## On maps', '', placements.map((value) => `- ${value}`).join('\n'), '');
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
  places: PlacesById;
  maps: MapsById;
  aliases: ConsistencyAlias[];
  facts: CanonicalFact[];
}): string => {
  const {category, entities, allEntities, places, maps, aliases, facts} = params;
  const isPlaceCategory = isLocationCategory(category);
  const headings = [
    'name',
    'aliases',
    'links',
    ...category.fieldSchema.map((field) => field.key),
    ...(isPlaceCategory ? ['inside', 'connections', 'placements'] : []),
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
      ...(isPlaceCategory
        ? [
            placeAncestors(entity.id, places).map((place) => place.name).join(' › '),
            connectionsForPlace(entity.id, places)
              .map((view) => describeConnectionView(view, places, false))
              .join(' | '),
            describePlacements(entity, maps).join(' | ')
          ]
        : []),
      entityFacts.map((fact) => `${fact.factType}: ${factValueToText(fact)}`).join(' | ')
    ].map(csvCell).join(',');
  });
  return [headings.map(csvCell).join(','), ...rows].join('\r\n') + '\r\n';
};

const csvTable = (headings: string[], rows: unknown[][]): string =>
  [headings, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';

/** One row per map: unit, scale, and where it sits on a larger map. */
const buildMapsCsv = (maps: MapsById): string =>
  csvTable(
    ['name', 'distance_unit', 'scale', 'sits_on', 'x', 'y'],
    [...maps.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((map) => {
        const parent = map.parentPlacement ? maps.get(map.parentPlacement.mapId) : undefined;
        return [
          map.name,
          map.distanceUnit,
          map.scale,
          parent?.name ?? '',
          parent ? map.parentPlacement!.x : '',
          parent ? map.parentPlacement!.y : ''
        ];
      })
  );

export const PORTABLE_SCHEMA_README = `# SagaSpine portable data\n\nSchema: worldbuilding-desk/portable/${PORTABLE_DATA_SCHEMA_VERSION}\n\nThis ZIP is the human-readable interchange format. The project backup ZIP remains the full-fidelity restore format.\n\n- \`world-bible/<category>/*.md\`: one record per Markdown file. YAML frontmatter contains category, aliases, links, a JSON-compatible \`fields\` map, and for places a \`place\` map (\`inside\`: the parent place's name; \`connections\`: the connections stored on that record, each with \`to\`, \`kind\`, optional \`oneWay\`, \`distance\`, and \`travelTimes\`; \`placements\`: the place's point on each map, as \`map\`, \`x\`, \`y\`). Accepted facts are repeated in the Markdown body so another tool can read them without parsing application data.\n- \`world-bible/*.csv\`: one UTF-8 CSV per category. Multi-value cells use \` | \` inside a correctly quoted CSV cell.\n- \`maps/maps.csv\`: one row per map with its distance unit, scale (distance units per map unit), and the larger map it sits on with the point (\`x\`, \`y\`) where it sits. \`maps/unit-conversions.csv\`: the author's conversions, read as 1 \`from\` = \`factor\` \`to\`.\n- \`source-notes/*.md\`: one source note per Markdown file. Source Notes are evidence, not accepted canon.\n\nOn import, files are staged for review. World Bible files become incomplete drafts; Source Notes remain non-canon and use the normal extraction/review flow. Wikilinks are suggestions only and are ignored unless the author explicitly maps them.\n`;

export function buildPortableDataZip(params: {
  categories: EntityCategory[];
  entities: WorldEntity[];
  aliases: ConsistencyAlias[];
  canonicalFacts: CanonicalFact[];
  loreDocuments: LoreDocument[];
  loreDocumentLinks: LoreDocumentLink[];
  maps?: WorldMap[];
  unitConversions?: UnitConversion[];
}): Uint8Array {
  const entitiesById = new Map(params.entities.map((entity) => [entity.id, entity]));
  const categoriesById = new Map(params.categories.map((category) => [category.id, category]));
  const places = placesById(params.categories, params.entities);
  const maps = mapsById(params.maps ?? []);
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
          places,
          maps,
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
          places,
          maps,
          aliases: params.aliases,
          facts: params.canonicalFacts
        })
      )
    });
  });

  if (maps.size > 0) {
    entries.push({fileName: uniquePath('maps/maps.csv'), fileData: textEncoder.encode(buildMapsCsv(maps))});
  }
  const conversions = normalizeUnitConversions(params.unitConversions);
  if (conversions.length > 0) {
    entries.push({
      fileName: uniquePath('maps/unit-conversions.csv'),
      fileData: textEncoder.encode(csvTable(
        ['from', 'factor', 'to'],
        conversions.map((conversion) => [conversion.from, conversion.factor, conversion.to])
      ))
    });
  }

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
  maps?: WorldMap[];
  unitConversions?: UnitConversion[];
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
