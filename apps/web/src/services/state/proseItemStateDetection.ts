export type ProseItemAction = 'acquire' | 'consume';

export interface DetectedProseItemAction {
  action: ProseItemAction;
  itemName: string;
  characterName?: string;
  sheetId?: string;
}

const ACTION_PATTERNS: Array<{action: ProseItemAction; verbs: string}> = [
  {
    action: 'acquire',
    verbs: 'found|finds|picked up|picks up|received|receives|grabbed|grabs|took|takes'
  },
  {
    action: 'consume',
    verbs: 'drank|drinks|consumed|consumes|used|uses'
  }
];

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeItemSurface = (value: string): string =>
  value
    .trim()
    .replace(/^["“”'‘’]+|["“”'‘’]+$/g, '')
    .replace(/^(?:a|an|the|some)\s+/i, '')
    .replace(/[.!?,;:]+$/g, '')
    .trim();

export function detectProseItemAction(params: {
  text: string;
  characters: Array<{name: string; sheetId: string}>;
}): DetectedProseItemAction | null {
  const text = params.text.trim();
  if (!text) return null;
  const characters = params.characters
    .slice()
    .sort((left, right) => right.name.length - left.name.length);

  for (const character of characters) {
    for (const pattern of ACTION_PATTERNS) {
      const match = text.match(new RegExp(
        `\\b${escapeRegex(character.name)}\\b\\s+(?:${pattern.verbs})\\s+(?<item>[^.!?;\\n]+)`,
        'i'
      ));
      const itemName = normalizeItemSurface(match?.groups?.item ?? '');
      if (itemName) {
        return {
          action: pattern.action,
          itemName,
          characterName: character.name,
          sheetId: character.sheetId
        };
      }
    }
  }

  return null;
}
