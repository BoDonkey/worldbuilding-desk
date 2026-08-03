import styles from '../../styles/CharacterSheetsRoute.module.css';
import type {
  CharacterSheet,
  StoredRuleset,
  WritingDocument
} from '../../entityTypes';

export type MutationFormType =
  | 'resource_change'
  | 'resource_set'
  | 'stat_change'
  | 'stat_set'
  | 'status_apply'
  | 'status_remove'
  | 'inventory_add'
  | 'inventory_remove'
  | 'inventory_consume'
  | 'inventory_equip'
  | 'inventory_unequip'
  | 'location_set';

const MUTATION_FORM_TYPES: Array<{value: MutationFormType; label: string}> = [
  {value: 'resource_change', label: 'Resource change'},
  {value: 'resource_set', label: 'Resource set'},
  {value: 'stat_change', label: 'Stat change'},
  {value: 'stat_set', label: 'Stat set'},
  {value: 'status_apply', label: 'Apply status'},
  {value: 'status_remove', label: 'Remove status'},
  {value: 'inventory_add', label: 'Add inventory'},
  {value: 'inventory_remove', label: 'Remove inventory'},
  {value: 'inventory_consume', label: 'Consume inventory'},
  {value: 'inventory_equip', label: 'Equip inventory'},
  {value: 'inventory_unequip', label: 'Unequip inventory'},
  {value: 'location_set', label: 'Set location'}
];

interface MutationFormProps {
  editingMutationEventId: string | null;
  mutationTargetSheetId: string;
  setMutationTargetSheetId: (value: string) => void;
  sheets: CharacterSheet[];
  mutationSceneId: string;
  setMutationSceneId: (value: string) => void;
  orderedDocuments: WritingDocument[];
  mutationType: MutationFormType;
  setMutationType: (value: MutationFormType) => void;
  mutationResourceDefinitionId: string;
  setMutationResourceDefinitionId: (value: string) => void;
  mutationStatDefinitionId: string;
  setMutationStatDefinitionId: (value: string) => void;
  mutationNumberValue: string;
  setMutationNumberValue: (value: string) => void;
  mutationTextValue: string;
  setMutationTextValue: (value: string) => void;
  mutationBooleanValue: boolean;
  setMutationBooleanValue: (value: boolean) => void;
  mutationStatusName: string;
  setMutationStatusName: (value: string) => void;
  mutationItemName: string;
  setMutationItemName: (value: string) => void;
  mutationQuantity: string;
  setMutationQuantity: (value: string) => void;
  mutationLocationName: string;
  setMutationLocationName: (value: string) => void;
  ruleset: StoredRuleset;
  selectedMutationStatDefinition:
    | StoredRuleset['statDefinitions'][number]
    | null;
}

export function MutationForm({
  editingMutationEventId,
  mutationTargetSheetId,
  setMutationTargetSheetId,
  sheets,
  mutationSceneId,
  setMutationSceneId,
  orderedDocuments,
  mutationType,
  setMutationType,
  mutationResourceDefinitionId,
  setMutationResourceDefinitionId,
  mutationStatDefinitionId,
  setMutationStatDefinitionId,
  mutationNumberValue,
  setMutationNumberValue,
  mutationTextValue,
  setMutationTextValue,
  mutationBooleanValue,
  setMutationBooleanValue,
  mutationStatusName,
  setMutationStatusName,
  mutationItemName,
  setMutationItemName,
  mutationQuantity,
  setMutationQuantity,
  mutationLocationName,
  setMutationLocationName,
  ruleset,
  selectedMutationStatDefinition
}: MutationFormProps) {
  return (
    <>
      <h2 className={styles.inlineMarginTop0}>Record Scene State Change</h2>
      <p className={`${styles.inlineFontSize09rem} ${styles.inlineColorVarColorTextSecondary}`}>
        Attach an accepted state mutation to a manuscript scene. This
        writes directly to the mutation ledger and becomes replayable
        history.
      </p>
      {editingMutationEventId && (
        <div
          className={`${styles.inlineMarginBottom075rem} ${styles.inlinePadding055rem07rem} ${styles.inlineBorderRadius8px} ${styles.inlineBorder1pxSolidVarColorAccentSoftBorder} ${styles.inlineBackgroundColorVarColorAccentSoftBg} ${styles.inlineColorVarColorAccent} ${styles.inlineFontSize088rem}`}
        >
          Editing existing state step.
        </div>
      )}

      <div className={styles.inlineMarginBottom075rem}>
        <label>
          Character Sheet
          <br />
          <select
            value={mutationTargetSheetId}
            onChange={(e) => setMutationTargetSheetId(e.target.value)}
            className={styles.inlineWidth100}
          >
            <option value=''>Select a sheet...</option>
            {sheets.map((sheet) => (
              <option key={sheet.id} value={sheet.id}>
                {sheet.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.inlineMarginBottom075rem}>
        <label>
          Source Scene
          <br />
          <select
            value={mutationSceneId}
            onChange={(e) => setMutationSceneId(e.target.value)}
            className={styles.inlineWidth100}
          >
            <option value=''>Select a scene...</option>
            {orderedDocuments.map((document, index) => (
              <option key={document.id} value={document.id}>
                {index + 1}. {document.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.inlineMarginBottom075rem}>
        <label>
          Change Type
          <br />
          <select
            value={mutationType}
            onChange={(e) => setMutationType(e.target.value as MutationFormType)}
            className={styles.inlineWidth100}
          >
            {MUTATION_FORM_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {(mutationType === 'resource_change' ||
        mutationType === 'resource_set') && (
        <>
          <div className={styles.inlineMarginBottom075rem}>
            <label>
              Resource
              <br />
              <select
                value={mutationResourceDefinitionId}
                onChange={(e) => setMutationResourceDefinitionId(e.target.value)}
                className={styles.inlineWidth100}
              >
                <option value=''>Select a resource...</option>
                {ruleset.resourceDefinitions.map((definition) => (
                  <option key={definition.id} value={definition.id}>
                    {definition.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className={styles.inlineMarginBottom075rem}>
            <label>
              {mutationType === 'resource_change' ? 'Delta' : 'Value'}
              <br />
              <input
                type='number'
                value={mutationNumberValue}
                onChange={(e) => setMutationNumberValue(e.target.value)}
                className={styles.inlineWidth100}
              />
            </label>
          </div>
        </>
      )}

      {(mutationType === 'stat_change' || mutationType === 'stat_set') && (
        <>
          <div className={styles.inlineMarginBottom075rem}>
            <label>
              Stat
              <br />
              <select
                value={mutationStatDefinitionId}
                onChange={(e) => setMutationStatDefinitionId(e.target.value)}
                className={styles.inlineWidth100}
              >
                <option value=''>Select a stat...</option>
                {ruleset.statDefinitions.map((definition) => (
                  <option key={definition.id} value={definition.id}>
                    {definition.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {selectedMutationStatDefinition?.type === 'boolean' ? (
            <div className={styles.inlineMarginBottom075rem}>
              <label
                className={`${styles.inlineDisplayFlex} ${styles.inlineGap05rem} ${styles.inlineAlignItemsCenter}`}
              >
                <input
                  type='checkbox'
                  checked={mutationBooleanValue}
                  onChange={(e) => setMutationBooleanValue(e.target.checked)}
                />
                Value
              </label>
            </div>
          ) : selectedMutationStatDefinition?.type === 'text' ? (
            <div className={styles.inlineMarginBottom075rem}>
              <label>
                {mutationType === 'stat_change' ? 'Delta text' : 'Value'}
                <br />
                <input
                  type='text'
                  value={mutationTextValue}
                  onChange={(e) => setMutationTextValue(e.target.value)}
                  className={styles.inlineWidth100}
                />
              </label>
            </div>
          ) : (
            <div className={styles.inlineMarginBottom075rem}>
              <label>
                {mutationType === 'stat_change' ? 'Delta' : 'Value'}
                <br />
                <input
                  type='number'
                  value={mutationNumberValue}
                  onChange={(e) => setMutationNumberValue(e.target.value)}
                  className={styles.inlineWidth100}
                />
              </label>
            </div>
          )}
        </>
      )}

      {(mutationType === 'status_apply' ||
        mutationType === 'status_remove') && (
        <div className={styles.inlineMarginBottom075rem}>
          <label>
            Status name
            <br />
            <input
              type='text'
              value={mutationStatusName}
              onChange={(e) => setMutationStatusName(e.target.value)}
              placeholder='Poisoned'
              className={styles.inlineWidth100}
            />
          </label>
        </div>
      )}

      {(mutationType === 'inventory_add' ||
        mutationType === 'inventory_remove' ||
        mutationType === 'inventory_consume' ||
        mutationType === 'inventory_equip' ||
        mutationType === 'inventory_unequip') && (
        <>
          <div className={styles.inlineMarginBottom075rem}>
            <label>
              Item name
              <br />
              <input
                type='text'
                value={mutationItemName}
                onChange={(e) => setMutationItemName(e.target.value)}
                placeholder='Iron Key'
                className={styles.inlineWidth100}
              />
            </label>
          </div>
          {(mutationType === 'inventory_add' ||
            mutationType === 'inventory_remove' ||
            mutationType === 'inventory_consume') && (
            <div className={styles.inlineMarginBottom075rem}>
              <label>
                Quantity
                <br />
                <input
                  type='number'
                  min={1}
                  value={mutationQuantity}
                  onChange={(e) => setMutationQuantity(e.target.value)}
                  className={styles.inlineWidth100}
                />
              </label>
            </div>
          )}
        </>
      )}

      {mutationType === 'location_set' && (
        <div className={styles.inlineMarginBottom075rem}>
          <label>
            Location
            <br />
            <input
              type='text'
              value={mutationLocationName}
              onChange={(e) => setMutationLocationName(e.target.value)}
              placeholder='South Gate'
              className={styles.inlineWidth100}
            />
          </label>
        </div>
      )}


    </>
  );
}
