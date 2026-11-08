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
import {stateMutationCommandTypes} from '@worldbuilding-desk/rules-engine';
import {getAppStateKind} from '../../services/state/kinds';
import styles from '../../styles/WorkspaceRoute.module.css';
import {inventoryChoicesForChange} from './positionedStateChangeInventory';

const composerInput = (kind: PositionedChangeKind) => getAppStateKind(kind).composer.input;
const definitionSource = (kind: PositionedChangeKind): 'stat' | 'resource' | null => {
  const input = composerInput(kind);
  return input.type === 'definition' ? input.source : null;
};

// Stats lead the list, matching the composer's default change.
const CHANGE_TYPES: Array<{value: PositionedChangeKind; label: string}> = stateMutationCommandTypes
  .map((value) => ({value, label: getAppStateKind(value).composer.label}))
  .sort((a, b) =>
    Number(definitionSource(b.value) === 'stat') - Number(definitionSource(a.value) === 'stat')
  );
const BASIC_CHANGE_TYPES = CHANGE_TYPES.flatMap((entry) => {
  const input = composerInput(entry.value);
  return input.type === 'definition' ? [{...entry, label: input.basicLabel}] : [];
});
const BASIC_KINDS = new Set(BASIC_CHANGE_TYPES.map((entry) => entry.value));

const draftFromCommand = (command: StateMutationCommand): PositionedChangeDraft => ({
  id: crypto.randomUUID(),
  kind: command.type,
  ...getAppStateKind(command.type).composer.load(command)
});

const newDraft = (ruleset: StoredRuleset | null): PositionedChangeDraft => ({
  id: crypto.randomUUID(),
  kind: ruleset?.statDefinitions.some((definition) => definition.type === 'number')
    ? 'stat_change'
    : 'resource_change',
  definitionId: ruleset?.statDefinitions.find((definition) => definition.type === 'number')?.id
    ?? ruleset?.resourceDefinitions[0]?.id
    ?? '',
  value: ''
});

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
  const [showAdvanced, setShowAdvanced] = useState(Boolean(
    existingEvent || (initialCommands?.length ?? 0) > 1 || initialCommands?.some((command) => !BASIC_KINDS.has(command.type))
  ));
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
        {characterName} · {sceneTitle}{showAdvanced ? ` · position ${cursorPosition}` : ''}
      </p>

      {showAdvanced && (
      <label className={styles.changeComposerLabel}>
        What happens here?
        <input
          type='text'
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder='Drinks Potion of Giant Strength'
        />
      </label>
      )}

      <div className={styles.changeComposerRows}>
        {drafts.map((draft, index) => {
          const input = composerInput(draft.kind);
          const usesInventoryChoice = input.type === 'name' && input.inventoryChoice;
          const inventoryChoices = usesInventoryChoice
            ? inventoryChoicesForChange({
                kind: draft.kind,
                before,
                currentName: draft.name
              })
            : [];
          const selectedStatDefinition = definitionSource(draft.kind) === 'stat'
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
                      const source = definitionSource(kind);
                      updateDraft(draft.id, {
                        kind,
                        definitionId: source === 'stat'
                          ? (showAdvanced
                              ? ruleset?.statDefinitions[0]?.id
                              : ruleset?.statDefinitions.find((definition) => definition.type === 'number')?.id) ?? ''
                          : source === 'resource'
                            ? ruleset?.resourceDefinitions[0]?.id ?? ''
                            : undefined,
                        value: '',
                        name: '',
                        quantity: '1'
                      });
                    }}
                  >
                    {(showAdvanced ? CHANGE_TYPES : BASIC_CHANGE_TYPES).map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </label>
                {input.type === 'definition' ? (
                  <>
                    <label>
                      {input.source === 'stat' ? 'Stat' : 'Resource'}
                      <select
                        value={draft.definitionId ?? ''}
                        onChange={(event) =>
                          updateDraft(draft.id, {definitionId: event.target.value})
                        }
                      >
                        {(input.source === 'stat'
                          ? showAdvanced
                            ? ruleset?.statDefinitions
                            : ruleset?.statDefinitions.filter((definition) => definition.type === 'number')
                          : ruleset?.resourceDefinitions
                        )?.map((definition) => (
                          <option key={definition.id} value={definition.id}>
                            {definition.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {input.valueLabel}
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
                              : input.valuePlaceholder
                          }
                        />
                      )}
                    </label>
                  </>
                ) : input.type === 'amount' ? (
                  <>
                    <label>
                      {input.valueLabel}
                      <input
                        type='number'
                        value={draft.value ?? ''}
                        onChange={(event) => updateDraft(draft.id, {value: event.target.value})}
                        placeholder={input.valuePlaceholder}
                      />
                    </label>
                    <label>
                      {input.noteLabel}
                      <input
                        type='text'
                        value={draft.name ?? ''}
                        onChange={(event) => updateDraft(draft.id, {name: event.target.value})}
                        placeholder={input.notePlaceholder}
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      {input.label}
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
                    {input.quantity && (
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

      {showAdvanced ? <button
        type='button'
        className={styles.changeComposerAddButton}
        onClick={() => setDrafts((current) => [...current, newDraft(ruleset)])}
      >
        Add another change
      </button> : (
        <button type='button' className={styles.changeComposerAddButton} onClick={() => setShowAdvanced(true)}>
          Advanced changes
        </button>
      )}

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
          {isSaving ? 'Saving…' : existingEvent ? 'Save changes' : 'Confirm scene change'}
        </button>
      </div>
    </div>
  );
}
