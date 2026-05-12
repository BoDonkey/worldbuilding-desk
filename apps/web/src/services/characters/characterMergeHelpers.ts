import type {Character} from '../../entityTypes';
import type {ConsistencyAlias} from '../consistency';

export interface CharacterMergeCandidate {
  character: Character;
  reasons: string[];
}

const normalizeName = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

const tokenizeName = (value: string): string[] =>
  normalizeName(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

const buildAliasMapByCharacterId = (
  aliases: ConsistencyAlias[]
): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  aliases.forEach((alias) => {
    if (alias.targetType !== 'character') {
      return;
    }
    const current = map.get(alias.targetId) ?? [];
    const next = Array.from(
      new Map(
        [...current, alias.alias]
          .map((entry) => entry.trim())
          .filter(Boolean)
          .map((entry) => [normalizeName(entry), entry])
      ).values()
    );
    map.set(alias.targetId, next);
  });
  return map;
};

const looksLikeNameVariant = (left: string, right: string): boolean => {
  if (!left || !right || left === right) {
    return false;
  }
  const minLength = Math.min(left.length, right.length);
  if (minLength < 4) {
    return false;
  }
  if (!left.startsWith(right) && !right.startsWith(left)) {
    return false;
  }
  return Math.abs(left.length - right.length) <= 4;
};

const sharesStrongNameTokenVariant = (left: string, right: string): boolean => {
  const leftTokens = tokenizeName(left);
  const rightTokens = tokenizeName(right);
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return false;
  }

  if (leftTokens.length === 1 && rightTokens.length > 1) {
    const token = leftTokens[0] ?? '';
    return token.length >= 5 && rightTokens.includes(token);
  }

  if (rightTokens.length === 1 && leftTokens.length > 1) {
    const token = rightTokens[0] ?? '';
    return token.length >= 5 && leftTokens.includes(token);
  }

  return false;
};

const getReasonPriority = (reason: string): number => {
  switch (reason) {
    case 'Same name':
      return 0;
    case 'Name already exists as an alias':
      return 1;
    case 'Aliases overlap':
      return 2;
    case 'Looks like a longer or shorter name variant':
      return 3;
    default:
      return 4;
  }
};

export const mergeCharacterFields = (
  targetFields: Character['fields'],
  sourceFields: Character['fields']
): Character['fields'] => {
  const merged = {...targetFields};

  Object.entries(sourceFields).forEach(([key, value]) => {
    const existing = merged[key];
    const normalizedExisting = typeof existing === 'string' ? existing.trim() : existing;

    if (
      normalizedExisting === undefined ||
      normalizedExisting === null ||
      normalizedExisting === '' ||
      (Array.isArray(normalizedExisting) && normalizedExisting.length === 0)
    ) {
      merged[key] = value;
    }
  });

  return merged;
};

export const buildCharacterMergeCandidatesById = (params: {
  characters: Character[];
  aliases: ConsistencyAlias[];
}): Map<string, CharacterMergeCandidate[]> => {
  const aliasMapByCharacterId = buildAliasMapByCharacterId(params.aliases);

  return new Map(
    params.characters.map((character) => {
      const normalizedCharacterName = normalizeName(character.name);
      const characterAliases = (aliasMapByCharacterId.get(character.id) ?? [])
        .map(normalizeName)
        .filter(Boolean)
        .filter((alias) => alias !== normalizedCharacterName);

      const candidates = params.characters
        .filter((candidate) => candidate.id !== character.id)
        .map((candidate) => {
          const reasons = new Set<string>();
          const normalizedCandidateName = normalizeName(candidate.name);
          const candidateAliases = (aliasMapByCharacterId.get(candidate.id) ?? [])
            .map(normalizeName)
            .filter(Boolean)
            .filter((alias) => alias !== normalizedCandidateName);

          if (normalizedCharacterName === normalizedCandidateName) {
            reasons.add('Same name');
          }
          if (
            candidateAliases.includes(normalizedCharacterName) ||
            characterAliases.includes(normalizedCandidateName)
          ) {
            reasons.add('Name already exists as an alias');
          }
          if (candidateAliases.some((alias) => characterAliases.includes(alias))) {
            reasons.add('Aliases overlap');
          }
          if (looksLikeNameVariant(normalizedCharacterName, normalizedCandidateName)) {
            reasons.add('Looks like a longer or shorter name variant');
          }
          if (sharesStrongNameTokenVariant(normalizedCharacterName, normalizedCandidateName)) {
            reasons.add('Looks like a longer or shorter name variant');
          }

          return {
            character: candidate,
            reasons: Array.from(reasons).sort(
              (left, right) => getReasonPriority(left) - getReasonPriority(right)
            )
          };
        })
        .filter((candidate) => candidate.reasons.length > 0)
        .sort((left, right) => {
          const leftScore = getReasonPriority(left.reasons[0] ?? '');
          const rightScore = getReasonPriority(right.reasons[0] ?? '');
          if (leftScore !== rightScore) {
            return leftScore - rightScore;
          }
          return left.character.name.localeCompare(right.character.name);
        });

      return [character.id, candidates];
    })
  );
};
