import {useMemo, useState} from 'react';
import type {
  StateMutationCommand,
  StateMutationEvent,
  StoredRuleset
} from '../../entityTypes';
import type {CharacterReplayState} from '../../services/state/stateReplay';
import {
  buildCompoundChangePreview,
  buildPositionedStateCommand,
  type PositionedChangeDraft,
  type PositionedChangeKind
} from '../../services/state/positionedStateChange';
import styles from '../../styles/WorkspaceRoute.module.css';

const CHANGE_TYPES: Array<{value: PositionedChangeKind; label: string}> = [
  {value: 'stat_change', label: 'Change stat'},
  {value: 'stat_set', label: 'Set stat'},
  {value: 'resource_change', label: 'Change resource'},
  {value: 'resource_set', label: 'Set resource'},
  {value: 'status_apply', label: 'Apply status'},
  {value: 'status_remove', label: 'Remove status'},
  {value: 'inventory_add', label: 'Add inventory'},
  {value: 'inventory_remove', label: 'Remove inventory'},
  {value: 'inventory_consume', label: 'Consume inventory'},
  {value: 'inventory_equip', label: 'Equip item'},
  {value: 'inventory_unequip', label: 'Unequip item'},
  {value: 'location_set', label: 'Set location'}
];

const draftFromCommand = (command: StateMutationCommand): PositionedChangeDraft => {
  const base = {id: crypto.randomUUID(), kind: command.type};
  switch (command.type) {
    case 'stat_change':
      return {...base, definitionId: command.statDefinitionId, value: String(command.delta)};
    case 'stat_set':
      return {...base, definitionId: command.statDefinitionId, value: String(command.value)};
    case 'resource_change':
      return {...base, definitionId: command.resourceDefinitionId, value: String(command.delta)};
    case 'resource_set':
      return {...base, definitionId: command.resourceDefinitionId, value: String(command.value)};
    case 'status_apply':
    case 'status_remove':
      return {...base, name: command.statusName};
    case 'inventory_add':
    case 'inventory_remove':
    case 'inventory_consume':
      return {...base, name: command.itemName, quantity: String(command.quantity ?? 1)};
    case 'inventory_equip':
    case 'inventory_unequip':
      return {...base, name: command.itemName};
    case 'location_set':
      return {...base, name: command.locationName};
  }
};

const newDraft = (ruleset: StoredRuleset | null): PositionedChangeDraft => ({
  id: crypto.randomUUID(),
  kind: 'stat_change',
  definitionId: ruleset?.statDefinitions[0]?.id ?? '',
  value: ''
});

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

interface PositionedStateChangeComposerProps {
  characterName: string;
  sceneTitle: string;
  cursorPosition: number;
  actorId: string;
  ruleset: StoredRuleset | null;
  before: CharacterReplayState;
  existingEvent?: StateMutationEvent | null;
  initialLabel?: string;
  initialCommands?: StateMutationCommand[];
  isSaving: boolean;
  onCancel: () => void;
  onSave: (input: {label: string; commands: StateMutationCommand[]}) => void;
}

export function PositionedStateChangeComposer({
  characterName,
  sceneTitle,
  cursorPosition,
  actorId,
  ruleset,
  before,
  existingEvent,
  initialLabel,
  initialCommands,
  isSaving,
  onCancel,
  onSave
}: PositionedStateChangeComposerProps) {
  const [label, setLabel] = useState(existingEvent?.label ?? initialLabel ?? '');
  const [drafts, setDrafts] = useState<PositionedChangeDraft[]>(
    existingEvent?.commands.length
      ? existingEvent.commands.map(draftFromCommand)
      : initialCommands?.length
        ? initialCommands.map(draftFromCommand)
      : [newDraft(ruleset)]
  );
  const commands = useMemo(
    () =>
      drafts
        .map((draft) => buildPositionedStateCommand({actorId, draft, ruleset}))
        .filter((command): command is StateMutationCommand => Boolean(command)),
    [actorId, drafts, ruleset]
  );
  const preview = useMemo(
    () =>
      buildCompoundChangePreview({
        before,
        commands,
        labels: {
          statDefinitionNameById: new Map(
            ruleset?.statDefinitions.map((definition) => [definition.id, definition.name]) ?? []
          ),
          resourceDefinitionNameById: new Map(
            ruleset?.resourceDefinitions.map((definition) => [definition.id, definition.name]) ?? []
          )
        }
      }),
    [before, commands, ruleset]
  );

  const updateDraft = (id: string, patch: Partial<PositionedChangeDraft>) => {
    setDrafts((current) =>
      current.map((draft) => (draft.id === id ? {...draft, ...patch} : draft))
    );
  };

  return (
    <div className={`${styles.modalCard} ${styles.changeComposerCard}`}>
      <h3 className={styles.modalTitle}>
        {existingEvent ? 'Edit scene change' : 'Record change here'}
      </h3>
      <p className={styles.modalDescription}>
        {characterName} · {sceneTitle} · cursor position {cursorPosition}
      </p>

      <label className={styles.changeComposerLabel}>
        What happens here?
        <input
          type='text'
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder='Drinks Potion of Giant Strength'
        />
      </label>

      <div className={styles.changeComposerRows}>
        {drafts.map((draft, index) => {
          const needsDefinition = [
            'stat_change',
            'stat_set',
            'resource_change',
            'resource_set'
          ].includes(draft.kind);
          const needsQuantity = [
            'inventory_add',
            'inventory_remove',
            'inventory_consume'
          ].includes(draft.kind);
          const nameLabel = draft.kind === 'location_set'
            ? 'Location'
            : draft.kind.startsWith('status_')
              ? 'Status'
              : 'Item';
          const usesInventoryChoice = [
            'inventory_remove',
            'inventory_consume',
            'inventory_equip',
            'inventory_unequip'
          ].includes(draft.kind);
          const inventoryChoices = usesInventoryChoice
            ? inventoryChoicesForChange({
                kind: draft.kind,
                before,
                currentName: draft.name
              })
            : [];
          const selectedStatDefinition = draft.kind.startsWith('stat_')
            ? ruleset?.statDefinitions.find(
                (definition) => definition.id === draft.definitionId
              ) ?? null
            : null;
          return (
            <div key={draft.id} className={styles.changeComposerRow}>
              <div className={styles.changeComposerRowHeader}>
                <strong>Change {index + 1}</strong>
                {drafts.length > 1 && (
                  <button
                    type='button'
                    onClick={() =>
                      setDrafts((current) => current.filter((entry) => entry.id !== draft.id))
                    }
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className={styles.changeComposerFields}>
                <label>
                  Type
                  <select
                    value={draft.kind}
                    onChange={(event) => {
                      const kind = event.target.value as PositionedChangeKind;
                      updateDraft(draft.id, {
                        kind,
                        definitionId: kind.startsWith('stat_')
                          ? ruleset?.statDefinitions[0]?.id ?? ''
                          : kind.startsWith('resource_')
                            ? ruleset?.resourceDefinitions[0]?.id ?? ''
                            : undefined,
                        value: '',
                        name: '',
                        quantity: '1'
                      });
                    }}
                  >
                    {CHANGE_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </label>
                {needsDefinition ? (
                  <>
                    <label>
                      {draft.kind.startsWith('stat_') ? 'Stat' : 'Resource'}
                      <select
                        value={draft.definitionId ?? ''}
                        onChange={(event) =>
                          updateDraft(draft.id, {definitionId: event.target.value})
                        }
                      >
                        {(draft.kind.startsWith('stat_')
                          ? ruleset?.statDefinitions
                          : ruleset?.resourceDefinitions
                        )?.map((definition) => (
                          <option key={definition.id} value={definition.id}>
                            {definition.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {draft.kind.endsWith('_set') ? 'New value' : 'Change'}
                      {selectedStatDefinition?.type === 'boolean' ? (
                        <select
                          value={draft.value ?? 'true'}
                          onChange={(event) =>
                            updateDraft(draft.id, {value: event.target.value})
                          }
                        >
                          <option value='true'>True</option>
                          <option value='false'>False</option>
                        </select>
                      ) : (
                        <input
                          type={selectedStatDefinition?.type === 'text' ? 'text' : 'number'}
                          value={draft.value ?? ''}
                          onChange={(event) => updateDraft(draft.id, {value: event.target.value})}
                          placeholder={
                            selectedStatDefinition?.type === 'text'
                              ? 'New text value'
                              : draft.kind.endsWith('_set') ? '20' : '+10 or -10'
                          }
                        />
                      )}
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      {nameLabel}
                      {usesInventoryChoice ? (
                        <select
                          value={draft.name ?? ''}
                          onChange={(event) =>
                            updateDraft(draft.id, {name: event.target.value})
                          }
                          disabled={inventoryChoices.length === 0}
                        >
                          <option value=''>
                            {inventoryChoices.length > 0
                              ? 'Select an inventory item…'
                              : 'No applicable inventory items'}
                          </option>
                          {inventoryChoices.map((name) => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type='text'
                          value={draft.name ?? ''}
                          onChange={(event) =>
                            updateDraft(draft.id, {name: event.target.value})
                          }
                        />
                      )}
                    </label>
                    {needsQuantity && (
                      <label>
                        Quantity
                        <input
                          type='number'
                          min={1}
                          value={draft.quantity ?? '1'}
                          onChange={(event) =>
                            updateDraft(draft.id, {quantity: event.target.value})
                          }
                        />
                      </label>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button
        type='button'
        className={styles.changeComposerAddButton}
        onClick={() => setDrafts((current) => [...current, newDraft(ruleset)])}
      >
        Add another change
      </button>

      <div className={styles.changeComposerPreview}>
        <strong>Before → after</strong>
        {preview.steps.length === 0 ? (
          <p>Complete a change above to preview it.</p>
        ) : (
          <ol>
            {preview.steps.map((step, index) => (
              <li key={`${step.command.type}-${index}`}>
                <span>{step.summary}</span>
                <small>{step.effects.join(' · ')}</small>
              </li>
            ))}
          </ol>
        )}
        {preview.issues.length > 0 && (
          <div className={styles.changeComposerWarning}>{preview.issues.join(' ')}</div>
        )}
      </div>

      <div className={styles.modalActions}>
        <button type='button' onClick={onCancel}>Cancel</button>
        <button
          type='button'
          onClick={() => onSave({label: label.trim(), commands})}
          disabled={isSaving || commands.length !== drafts.length || preview.issues.length > 0}
        >
          {isSaving ? 'Saving…' : existingEvent ? 'Save changes' : 'Record at cursor'}
        </button>
      </div>
    </div>
  );
}
