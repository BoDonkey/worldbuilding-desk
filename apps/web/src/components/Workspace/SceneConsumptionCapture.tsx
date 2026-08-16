import {useMemo, useState} from 'react';
import type {
  CompendiumConsumableDefinition,
  CompendiumEntry,
  StateMutationCommand,
  StoredRuleset
} from '../../entityTypes';
import {buildConsumableCommands} from '../../services/state/consumableEffects';
import {
  buildCompoundChangePreview
} from '../../services/state/positionedStateChange';
import type {CharacterReplayState} from '../../services/state/stateReplay';
import styles from '../../styles/WorkspaceRoute.module.css';

interface ConsumptionContext {
  sheetId: string;
  actorId: string;
  name: string;
  before: CharacterReplayState;
}

interface SceneConsumptionCaptureProps {
  itemName: string;
  evidenceText?: string;
  contexts: ConsumptionContext[];
  suggestedSheetId?: string;
  ruleset: StoredRuleset | null;
  approvedEntry?: CompendiumEntry | null;
  itemReference?: {sourceEntityId?: string; definitionId?: string};
  exactReusableItem?: {id: string; name: string} | null;
  reusableItemMatches: Array<{id: string; name: string}>;
  canCreateReusableItem: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (input: {
    sheetId: string;
    itemName: string;
    commands: StateMutationCommand[];
    rememberedConsumable?: CompendiumConsumableDefinition;
    saveReusable: boolean;
    reusableEntityId?: string;
    canonicalName: string;
  }) => void;
}

type MissingInventoryChoice = '' | 'add-and-consume' | 'without-tracking';

const hasInventoryItem = (
  state: CharacterReplayState,
  itemName: string,
  reference: SceneConsumptionCaptureProps['itemReference']
): boolean => state.inventory.items.some((item) =>
  (reference?.definitionId && item.definitionId === reference.definitionId) ||
  (reference?.sourceEntityId && item.sourceEntityId === reference.sourceEntityId) ||
  item.name.trim().toLocaleLowerCase() === itemName.trim().toLocaleLowerCase()
);

export function SceneConsumptionCapture({
  itemName,
  evidenceText,
  contexts,
  suggestedSheetId,
  ruleset,
  approvedEntry,
  itemReference,
  exactReusableItem,
  reusableItemMatches,
  canCreateReusableItem,
  isSaving,
  onCancel,
  onSave
}: SceneConsumptionCaptureProps) {
  const approvedConsumable = approvedEntry?.consumable?.effects.length
    ? approvedEntry.consumable
    : undefined;
  const initialEffect = approvedConsumable?.effects[0];
  const [sheetId, setSheetId] = useState(
    suggestedSheetId && contexts.some((entry) => entry.sheetId === suggestedSheetId)
      ? suggestedSheetId
      : contexts[0]?.sheetId ?? ''
  );
  const [customize, setCustomize] = useState(!approvedConsumable);
  const [effectKind, setEffectKind] = useState<'resource' | 'stat'>(
    initialEffect?.type === 'stat_change' ? 'stat' : 'resource'
  );
  const [definitionId, setDefinitionId] = useState(
    initialEffect?.definitionId ??
    ruleset?.resourceDefinitions[0]?.id ??
    ruleset?.statDefinitions.find((entry) => entry.type === 'number')?.id ?? ''
  );
  const [operation, setOperation] = useState<'change' | 'set'>('change');
  const [value, setValue] = useState(
    initialEffect ? String(initialEffect.delta) : ''
  );
  const [rememberEffect, setRememberEffect] = useState(false);
  const [missingChoice, setMissingChoice] = useState<MissingInventoryChoice>('');
  const [saveReusable, setSaveReusable] = useState(false);
  const [reusableEntityId, setReusableEntityId] = useState(
    exactReusableItem?.id ?? ''
  );
  const [canonicalName, setCanonicalName] = useState(itemName);
  const context = contexts.find((entry) => entry.sheetId === sheetId) ?? contexts[0];
  const itemIsPresent = context
    ? hasInventoryItem(context.before, itemName, itemReference)
    : false;
  const numericValue = Number(value);
  const hasNumericValue = value.trim() !== '' && Number.isFinite(numericValue);

  const commands = useMemo<StateMutationCommand[]>(() => {
    if (!context) return [];
    const inventoryCommands: StateMutationCommand[] = [];
    if (itemIsPresent) {
      inventoryCommands.push({
        type: 'inventory_consume', actorId: context.actorId, itemName, quantity: 1,
        ...itemReference
      });
    } else if (missingChoice === 'add-and-consume') {
      inventoryCommands.push(
        {
          type: 'inventory_add', actorId: context.actorId, itemName, quantity: 1,
          ...itemReference
        },
        {
          type: 'inventory_consume', actorId: context.actorId, itemName, quantity: 1,
          ...itemReference
        }
      );
    }

    if (!customize && approvedConsumable) {
      return [
        ...inventoryCommands,
        ...buildConsumableCommands({
          actorId: context.actorId,
          itemName,
          definition: approvedConsumable,
          itemReference
        }).slice(1)
      ];
    }
    if (!definitionId || !hasNumericValue) return inventoryCommands;
    const effect: StateMutationCommand = effectKind === 'resource'
      ? operation === 'change'
        ? {
            type: 'resource_change', actorId: context.actorId,
            resourceDefinitionId: definitionId, delta: numericValue
          }
        : {
            type: 'resource_set', actorId: context.actorId,
            resourceDefinitionId: definitionId, value: numericValue
          }
      : operation === 'change'
        ? {
            type: 'stat_change', actorId: context.actorId,
            statDefinitionId: definitionId, delta: numericValue
          }
        : {
            type: 'stat_set', actorId: context.actorId,
            statDefinitionId: definitionId, value: numericValue
          };
    return [...inventoryCommands, effect];
  }, [
    approvedConsumable,
    context,
    customize,
    definitionId,
    effectKind,
    itemIsPresent,
    itemName,
    itemReference,
    hasNumericValue,
    missingChoice,
    numericValue,
    operation
  ]);
  const preview = useMemo(
    () => context
      ? buildCompoundChangePreview({
          before: context.before,
          commands,
          labels: {
            statDefinitionNameById: new Map(
              ruleset?.statDefinitions.map((entry) => [entry.id, entry.name]) ?? []
            ),
            resourceDefinitionNameById: new Map(
              ruleset?.resourceDefinitions.map((entry) => [entry.id, entry.name]) ?? []
            )
          }
        })
      : null,
    [commands, context, ruleset]
  );
  const rememberedConsumable: CompendiumConsumableDefinition | undefined =
    customize && rememberEffect && operation === 'change' && definitionId &&
    hasNumericValue
      ? {
          effects: [{
            type: effectKind === 'stat' ? 'stat_change' : 'resource_change',
            definitionId,
            delta: numericValue
          }]
        }
      : undefined;
  const inventoryChoiceReady = itemIsPresent || Boolean(missingChoice);
  const effectReady = !customize || (Boolean(definitionId) && hasNumericValue);
  const reusableReady = !saveReusable || Boolean(
    reusableEntityId || (canCreateReusableItem && canonicalName.trim())
  );
  const canConfirm = Boolean(
    context && inventoryChoiceReady && effectReady && reusableReady &&
    commands.length > 0 && (preview?.issues.length ?? 0) === 0
  );

  return (
    <div className={`${styles.modalCard} ${styles.changeComposerCard}`}>
      <h3 className={styles.modalTitle}>Record item use</h3>
      <p className={styles.modalDescription}>
        Confirm what changes here without leaving the scene.
      </p>
      {evidenceText && <p className={styles.changeComposerEvidence}>“{evidenceText}”</p>}
      <div className={styles.changeComposerFields}>
        <label>
          Item
          <input value={itemName} readOnly />
        </label>
        <label>
          Character
          <select value={sheetId} onChange={(event) => {
            setSheetId(event.target.value);
            setMissingChoice('');
          }}>
            {contexts.map((entry) => (
              <option key={entry.sheetId} value={entry.sheetId}>{entry.name}</option>
            ))}
          </select>
        </label>
      </div>

      {!itemIsPresent && (
        <div className={styles.changeComposerWarning}>
          <label>
            This item is not in the tracked inventory.
            <select
              aria-label='Missing inventory choice'
              value={missingChoice}
              onChange={(event) => setMissingChoice(event.target.value as MissingInventoryChoice)}
            >
              <option value=''>Choose what to do…</option>
              <option value='add-and-consume'>Add one and consume it</option>
              <option value='without-tracking'>Consume without inventory tracking</option>
            </select>
          </label>
        </div>
      )}

      {approvedConsumable && !customize ? (
        <div className={styles.changeComposerPreview}>
          <strong>Remembered effect: {approvedEntry?.name ?? itemName}</strong>
          <p>The approved effect is prefilled for this use.</p>
          <button type='button' onClick={() => setCustomize(true)}>
            Customize this use
          </button>
        </div>
      ) : (
        <div className={styles.changeComposerDisclosure}>
          <div className={styles.changeComposerFields}>
            <label>
              Attribute type
              <select value={effectKind} onChange={(event) => {
                const kind = event.target.value as 'resource' | 'stat';
                setEffectKind(kind);
                setDefinitionId(kind === 'resource'
                  ? ruleset?.resourceDefinitions[0]?.id ?? ''
                  : ruleset?.statDefinitions.find((entry) => entry.type === 'number')?.id ?? '');
              }}>
                <option value='resource'>Resource</option>
                <option value='stat'>Stat</option>
              </select>
            </label>
            <label>
              Attribute
              <select value={definitionId} onChange={(event) => setDefinitionId(event.target.value)}>
                {(effectKind === 'resource'
                  ? ruleset?.resourceDefinitions
                  : ruleset?.statDefinitions.filter((entry) => entry.type === 'number')
                )?.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name}</option>
                ))}
              </select>
            </label>
            <label>
              Operation
              <select value={operation} onChange={(event) =>
                setOperation(event.target.value as 'change' | 'set')
              }>
                <option value='change'>Change by</option>
                <option value='set'>Set to</option>
              </select>
            </label>
            <label>
              {operation === 'change' ? 'Change' : 'New value'}
              <input
                type='number'
                value={value}
                placeholder='+25'
                onChange={(event) => setValue(event.target.value)}
              />
            </label>
          </div>
          <label>
            <input
              type='checkbox'
              checked={rememberEffect}
              disabled={operation === 'set'}
              onChange={(event) => setRememberEffect(event.target.checked)}
            />
            {approvedEntry ? 'Update remembered effect for future uses' : 'Remember this effect'}
          </label>
          {operation === 'set' && (
            <p className={styles.modalDescription}>Set-to effects apply only to this scene.</p>
          )}
        </div>
      )}

      {!exactReusableItem && (
        <div className={styles.changeComposerDisclosure}>
          <label>
            <input
              type='checkbox'
              checked={saveReusable}
              onChange={(event) => setSaveReusable(event.target.checked)}
            />
            Save as a reusable world item
          </label>
          {saveReusable && (
            <div className={styles.changeComposerFields}>
              <label>
                Reusable item
                <select value={reusableEntityId} onChange={(event) =>
                  setReusableEntityId(event.target.value)
                }>
                  {canCreateReusableItem && <option value=''>Create a new item</option>}
                  {!canCreateReusableItem && <option value=''>Choose an existing item…</option>}
                  {reusableItemMatches.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
              {!reusableEntityId && canCreateReusableItem && (
                <label>
                  Canonical name
                  <input value={canonicalName} onChange={(event) =>
                    setCanonicalName(event.target.value)
                  } />
                </label>
              )}
            </div>
          )}
        </div>
      )}

      <div className={styles.changeComposerPreview}>
        <strong>Before → after</strong>
        {preview?.steps.length ? (
          <ol>{preview.steps.map((step, index) => (
            <li key={`${step.command.type}-${index}`}>
              <span>{step.summary}</span>
              <small>{step.effects.join(' · ')}</small>
            </li>
          ))}</ol>
        ) : <p>Complete the choices above to preview this use.</p>}
        {preview?.issues.length ? (
          <div className={styles.changeComposerWarning}>{preview.issues.join(' ')}</div>
        ) : null}
      </div>
      <div className={styles.modalActions}>
        <button type='button' onClick={onCancel}>Cancel</button>
        <button
          type='button'
          disabled={isSaving || !canConfirm}
          onClick={() => context && onSave({
            sheetId: context.sheetId,
            itemName,
            commands,
            rememberedConsumable,
            saveReusable,
            reusableEntityId: reusableEntityId || undefined,
            canonicalName: canonicalName.trim()
          })}
        >
          {isSaving ? 'Recording…' : 'Confirm item use'}
        </button>
      </div>
    </div>
  );
}
