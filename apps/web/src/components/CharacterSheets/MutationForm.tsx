import {Fragment} from 'react';
import {stateMutationCommandTypes} from '@worldbuilding-desk/rules-engine';
import styles from '../../styles/CharacterSheetsRoute.module.css';
import type {
  CharacterSheet,
  StateMutationCommand,
  StoredRuleset,
  WritingDocument
} from '../../entityTypes';
import {getAppStateKind, type SheetFormField} from '../../services/state/kinds';

export type MutationFormType = StateMutationCommand['type'];

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
  const textFields: Record<
    Extract<SheetFormField, {type: 'text'}>['value'],
    {value: string; onChange: (value: string) => void}
  > = {
    statusName: {value: mutationStatusName, onChange: setMutationStatusName},
    itemName: {value: mutationItemName, onChange: setMutationItemName},
    locationName: {value: mutationLocationName, onChange: setMutationLocationName},
    textValue: {value: mutationTextValue, onChange: setMutationTextValue}
  };

  const renderField = (field: SheetFormField) => {
    switch (field.type) {
      case 'definition':
        return field.source === 'resource' ? (
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
        ) : (
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
        );
      case 'number':
        return (
          <div className={styles.inlineMarginBottom075rem}>
            <label>
              {field.label}
              <br />
              <input
                type='number'
                value={mutationNumberValue}
                onChange={(e) => setMutationNumberValue(e.target.value)}
                className={styles.inlineWidth100}
              />
            </label>
          </div>
        );
      case 'statValue':
        return selectedMutationStatDefinition?.type === 'boolean' ? (
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
              {field.textLabel}
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
              {field.numberLabel}
              <br />
              <input
                type='number'
                value={mutationNumberValue}
                onChange={(e) => setMutationNumberValue(e.target.value)}
                className={styles.inlineWidth100}
              />
            </label>
          </div>
        );
      case 'text': {
        const binding = textFields[field.value];
        return (
          <div className={styles.inlineMarginBottom075rem}>
            <label>
              {field.label}
              <br />
              <input
                type='text'
                value={binding.value}
                onChange={(e) => binding.onChange(e.target.value)}
                placeholder={field.placeholder}
                className={styles.inlineWidth100}
              />
            </label>
          </div>
        );
      }
      case 'quantity':
        return (
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
        );
    }
  };

  return (
    <>
      <h2 className={styles.inlineMarginTop0}>Record a detailed scene change</h2>
      <p className={`${styles.inlineFontSize09rem} ${styles.inlineColorVarColorTextSecondary}`}>
        Choose what changed in one manuscript scene. Nothing is recorded until
        the preview is valid and you choose Record state change; recorded changes
        build the replayed timeline.
      </p>
      {editingMutationEventId && (
        <div
          className={`${styles.inlineMarginBottom075rem} ${styles.inlinePadding055rem07rem} ${styles.inlineBorderRadius8px} ${styles.inlineBorder1pxSolidVarColorAccentSoftBorder} ${styles.inlineBackgroundColorVarColorAccentSoftBg} ${styles.inlineColorVarColorAccent} ${styles.inlineFontSize088rem}`}
        >
          Editing an existing scene change.
        </div>
      )}

      <div className={styles.inlineMarginBottom075rem}>
        <label>
          Character
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
          Scene
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
          What changed?
          <br />
          <select
            value={mutationType}
            onChange={(e) => setMutationType(e.target.value as MutationFormType)}
            className={styles.inlineWidth100}
          >
            {stateMutationCommandTypes.map((type) => (
              <option key={type} value={type}>
                {getAppStateKind(type).sheetForm.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {getAppStateKind(mutationType).sheetForm.fields.map((field, index) => (
        <Fragment key={`${field.type}-${index}`}>{renderField(field)}</Fragment>
      ))}
    </>
  );
}
