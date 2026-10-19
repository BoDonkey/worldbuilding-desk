import type {
  CompendiumActionDefinition,
  CompendiumDomain,
  SettlementState
} from '../../entityTypes';

export type BaseStatKey = keyof NonNullable<SettlementState['baseStats']>;
export const BASE_STAT_KEYS: BaseStatKey[] = [
  'defense', 'storageCapacity', 'craftingThroughput', 'morale'
];
export const BASE_STAT_LIMITS: Record<BaseStatKey, {min: number; max: number}> = {
  defense: {min: 0, max: 100000},
  storageCapacity: {min: 0, max: 100000},
  craftingThroughput: {min: 0, max: 100000},
  morale: {min: 0, max: 100000}
};

export function toBaseStatsDraft(
  baseStats: NonNullable<SettlementState['baseStats']>
): Record<BaseStatKey, string> {
  return {
    defense: String(baseStats.defense),
    storageCapacity: String(baseStats.storageCapacity),
    craftingThroughput: String(baseStats.craftingThroughput),
    morale: String(baseStats.morale)
  };
}

export function parseBaseStatsDraft(draft: Record<BaseStatKey, string>):
  | {baseStats: SettlementState['baseStats']; error?: never}
  | {baseStats?: never; error: string} {
  const baseStats = {} as SettlementState['baseStats'];
  for (const key of BASE_STAT_KEYS) {
    const parsed = Number(draft[key].trim());
    if (!Number.isFinite(parsed)) {
      return {error: `Base stat "${key}" must be a valid number.`};
    }
    const limits = BASE_STAT_LIMITS[key];
    baseStats[key] = Math.min(limits.max, Math.max(limits.min, Math.floor(parsed)));
  }
  return {baseStats};
}

export function parseCommaSeparatedIds(text: string): string[] {
  return text.split(',').map((value) => value.trim()).filter(Boolean);
}

export function parsePreviewMaterials(text: string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const [itemIdRaw, qtyRaw] = line.split(':');
    const itemId = itemIdRaw?.trim();
    const qty = Number(qtyRaw?.trim() ?? '');
    if (!itemId || !Number.isFinite(qty) || qty < 0) continue;
    result[itemId] = qty;
  }
  return result;
}

export function parseModuleValue(value: string): string | number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value.trim() !== '' ? parsed : value;
}

export const toBiomeKey = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'zone';

export function getDefaultActions(domain: CompendiumDomain): CompendiumActionDefinition[] {
  if (domain === 'beast') {
    return [
      {id: 'discover', label: 'Discover', points: 1, repeatable: false},
      {id: 'kill', label: 'Kill', points: 3, repeatable: true},
      {id: 'skin', label: 'Skin', points: 2, repeatable: true}
    ];
  }
  if (domain === 'flora' || domain === 'mineral') {
    return [
      {id: 'discover', label: 'Discover', points: 1, repeatable: false},
      {id: 'harvest', label: 'Harvest', points: 2, repeatable: true}
    ];
  }
  return [{id: 'discover', label: 'Discover', points: 1, repeatable: false}];
}
