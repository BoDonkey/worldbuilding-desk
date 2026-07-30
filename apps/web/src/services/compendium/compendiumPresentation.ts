import type {
  Character,
  PartySynergySuggestion,
  SettlementAuraEffect
} from '../../entityTypes';

export function formatSettlementEffectLabel(
  effect: SettlementAuraEffect
): string {
  const opText =
    effect.operation === 'add'
      ? '+'
      : effect.operation === 'multiply'
        ? 'x'
        : '=';
  return `${effect.targetType}:${effect.targetId} ${opText}${String(effect.value)}`;
}

export function getCharacterRole(character: Character): string {
  return String(character.fields.role ?? '').trim();
}

export function formatSynergyStatus(
  suggestion: PartySynergySuggestion,
  characterById: Map<string, Character>
): string {
  const matchedNames = suggestion.matchedCharacterIds
    .map((id) => characterById.get(id)?.name)
    .filter(Boolean)
    .join(', ');
  if (suggestion.missingRoles.length === 0) {
    return matchedNames ? `Active via ${matchedNames}.` : 'Active.';
  }
  const missing = suggestion.missingRoles.join(', ');
  return matchedNames
    ? `Need ${missing}. Current: ${matchedNames}.`
    : `Need ${missing}.`;
}
