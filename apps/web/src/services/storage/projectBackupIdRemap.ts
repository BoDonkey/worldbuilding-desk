import type {ProjectSnapshot} from './projectSnapshotService';
import {ID_PRESERVING_IMPORT_STORES} from './projectBackupCollisions';

/*
 * Slice 3.24b: imported records get new ids, so a backup can be copied into
 * the browser it came from without touching the source project.
 *
 * One map from old id to new id is built first, then every string in the
 * snapshot data is rewritten through it, so references in any field (and
 * fields added later) follow automatically. New ids keep their shape when the
 * app derives them: an id that contains the source project id, or other
 * remapped UUIDs, gets the same parts swapped (`settlement:<project>:global`
 * stays findable). Any other id gets a fresh UUID. Inside longer strings only
 * full UUIDs are replaced, so short ids cannot match ordinary text.
 *
 * Ruleset definition ids (stats, resources, rules) belong to the ruleset and
 * are not record ids here, so they are never in the map and stay unchanged.
 */

type Data = ProjectSnapshot['data'];

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const isUuid = (value: string) => value.length === 36 && new RegExp(`^${UUID_PATTERN.source}$`, 'i').test(value);

/** Every record id an import could keep: the 23 collections plus settings and ruleset. */
export function collectImportRecordIds(data: Data): string[] {
  const ids: string[] = [];
  for (const [, dataKey] of ID_PRESERVING_IMPORT_STORES) {
    for (const record of (data[dataKey] ?? []) as Array<{id?: unknown}>) {
      if (typeof record?.id === 'string' && record.id) ids.push(record.id);
    }
  }
  if (data.settings?.id) ids.push(data.settings.id);
  if (data.ruleset?.id) ids.push(data.ruleset.id);
  return ids;
}

const fnv1a64 = (text: string, seed: bigint): bigint => {
  let hash = seed;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return hash;
};

/**
 * A UUID-shaped id that is always the same for the same seed. Merges use it,
 * so merging one backup into the same project twice updates the same records
 * instead of adding copies. Not cryptographic; 128 bits from two FNV-1a runs.
 */
export function stableImportId(seed: string): string {
  const hex = (
    fnv1a64(seed, 0xcbf29ce484222325n).toString(16).padStart(16, '0') +
    fnv1a64(seed, 0x84222325cbf29ce4n).toString(16).padStart(16, '0')
  ).split('');
  hex[12] = '5';
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const s = hex.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

/** Builds old → new ids for `ids`. `newId` receives the old id. */
export function buildImportIdMap(params: {
  ids: Iterable<string>;
  sourceProjectId: string;
  targetProjectId: string;
  newId?: (oldId: string) => string;
}): Map<string, string> {
  const newId = params.newId ?? (() => crypto.randomUUID());
  const wanted = new Set(params.ids);
  const map = new Map<string, string>();
  const atomic = (uuid: string) => {
    const key = uuid.toLowerCase();
    let next = map.get(key);
    if (!next) {
      next = newId(key);
      map.set(key, next);
    }
    return next;
  };

  for (const id of wanted) {
    if (map.has(id)) continue;
    if (isUuid(id)) {
      map.set(id, atomic(id));
      continue;
    }
    let next = id;
    let derived = false;
    if (params.sourceProjectId && params.sourceProjectId !== params.targetProjectId && next.includes(params.sourceProjectId)) {
      next = next.split(params.sourceProjectId).join(params.targetProjectId);
      derived = true;
    }
    next = next.replace(UUID_PATTERN, (uuid) => {
      if (!wanted.has(uuid) && !wanted.has(uuid.toLowerCase())) return uuid;
      derived = true;
      return atomic(uuid);
    });
    map.set(id, derived ? next : newId(id));
  }
  // Atomic entries for UUIDs embedded in derived ids stay in the map, because
  // references may point at those records too.
  return map;
}

/** Rewrites every string (and object key) in `value` through `map`. */
export function remapIds<T>(value: T, map: ReadonlyMap<string, string>): T {
  if (map.size === 0) return value;
  const remapString = (text: string): string => {
    const exact = map.get(text);
    if (exact !== undefined) return exact;
    if (text.length < 36) return text;
    return text.replace(UUID_PATTERN, (uuid) => map.get(uuid) ?? map.get(uuid.toLowerCase()) ?? uuid);
  };
  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') return remapString(node);
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      return Object.fromEntries(
        Object.entries(node as Record<string, unknown>).map(([key, child]) => [remapString(key), walk(child)])
      );
    }
    return node;
  };
  return walk(value) as T;
}

/**
 * Gives the requested records new ids and rewrites every reference to them.
 * The project record, counts, and anything outside `data` are not touched.
 */
export function remapImportedSnapshot(params: {
  snapshot: ProjectSnapshot;
  ids: Iterable<string>;
  targetProjectId: string;
  newId?: (oldId: string) => string;
}): ProjectSnapshot {
  const map = buildImportIdMap({
    ids: params.ids,
    sourceProjectId: params.snapshot.project.id,
    targetProjectId: params.targetProjectId,
    newId: params.newId
  });
  return {...params.snapshot, data: remapIds(params.snapshot.data, map)};
}
