import type {CharacterReplayState} from '../../services/state/stateReplay';
import type {PositionedChangeKind} from '../../services/state/positionedStateChange';

export function inventoryChoicesForChange(params: {
  kind: PositionedChangeKind;
  before: CharacterReplayState;
  currentName?: string;
}): string[] {
  const equippedNames = new Set(
    params.before.inventory.equipped.map((name) => name.trim().toLocaleLowerCase())
  );
  const available = params.kind === 'inventory_unequip'
    ? params.before.inventory.equipped
    : params.before.inventory.items
        .filter((item) =>
          params.kind !== 'inventory_equip' ||
          !equippedNames.has(item.name.trim().toLocaleLowerCase())
        )
        .map((item) => item.name);
  const choices = params.currentName?.trim()
    ? [params.currentName.trim(), ...available]
    : available;
  return Array.from(new Map(
    choices.map((name) => [name.trim().toLocaleLowerCase(), name.trim()])
  ).values()).filter(Boolean);
}
