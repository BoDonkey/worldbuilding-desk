import type {NavigateFunction} from 'react-router';
import type {EntityCategory, WorldEntity, WritingDocument} from '../../../entityTypes';
import {EntityFieldEditor} from '../EntityFieldEditor';
import {ItemDescriptionFirstFields} from '../ItemDescriptionFirstFields';
import {SystemNegativeSpacePanel} from '../SystemNegativeSpacePanel';
import type {WorldBibleRecordDraft} from './useWorldBibleRecordDraft';
import type {
  OpenRecord,
  RecordAuthoring,
  RecordEntityActions,
  RecordResolution,
  RecordSelection
} from './recordTypes';
import {RecordNamesSection} from './RecordNamesSection';
import {RecordSectionBuilder} from './RecordSectionBuilder';
import {RecordPlaceSection} from './RecordPlaceSection';
import {isLocationCategory} from '../../../services/worldBible/worldBibleEntityPlans';

type CategoryField = EntityCategory['fieldSchema'][number];

export interface WorldBibleGeneralRecordProps {
  category: EntityCategory;
  categories: EntityCategory[];
  entities: WorldEntity[];
  writingDocuments: WritingDocument[];
  isSystemNegativeSpace: boolean;
  /** A new item starts with its description; the other fields wait behind a toggle. */
  isDescriptionFirstItemDraft: boolean;
  itemDescriptionField: CategoryField | null;
  draft: WorldBibleRecordDraft;
  selection: RecordSelection;
  authoring: RecordAuthoring;
  resolution: RecordResolution;
  entityActions: RecordEntityActions;
  onEdit: OpenRecord;
  navigate: NavigateFunction;
}

/** The record form for every non-character category: names, aliases, and the category's fields. */
export function WorldBibleGeneralRecord({
  category,
  categories,
  entities,
  writingDocuments,
  isSystemNegativeSpace,
  isDescriptionFirstItemDraft,
  itemDescriptionField,
  draft,
  selection,
  authoring,
  resolution,
  entityActions,
  onEdit,
  navigate
}: WorldBibleGeneralRecordProps) {
  const {fieldValues, setFieldValues, areItemDetailsExpanded} = draft;
  const showDetailedFields = !isDescriptionFirstItemDraft || areItemDetailsExpanded;
  const renderEntityField = (field: CategoryField) => (
    <EntityFieldEditor
      key={field.key}
      field={field}
      fieldValues={fieldValues}
      variant='default'
      onFieldValuesChange={setFieldValues}
    />
  );

  return (
    <>
      {isSystemNegativeSpace && (
        <SystemNegativeSpacePanel
          categoryId={category.id}
          entities={entities}
          documents={writingDocuments}
          editing
          status={draft.negativeSpaceStatus}
          sceneIds={draft.negativeSpaceSceneIds}
          onStatusChange={draft.setNegativeSpaceStatus}
          onSceneIdsChange={draft.setNegativeSpaceSceneIds}
          onOpenScene={(sceneId) => navigate('/workspace', {
            state: {focusDocumentId: sceneId}
          })}
        />
      )}
      {isDescriptionFirstItemDraft && (
        <ItemDescriptionFirstFields
          name={draft.name}
          descriptionField={itemDescriptionField}
          fieldValues={fieldValues}
          detailsExpanded={areItemDetailsExpanded}
          onNameChange={draft.setName}
          onFieldValuesChange={setFieldValues}
          onToggleDetails={() => draft.setAreItemDetailsExpanded((value) => !value)}
        />
      )}

      {showDetailedFields && (
        <div id='item-detailed-fields'>
          <RecordNamesSection
            variant='record'
            recordLabel={authoring.activeCategoryRecordLabel}
            currentCharacterLabel={authoring.currentCharacterLabel}
            category={category}
            categories={categories}
            showNameInput={!isDescriptionFirstItemDraft}
            draft={draft}
            selectedEntity={selection.selectedEntity}
            selectedEntityAliases={selection.selectedEntityAliases}
            resolution={resolution}
            entityActions={entityActions}
            onEdit={onEdit}
          />

          {category.fieldSchema
            .filter(
              (field) =>
                !isDescriptionFirstItemDraft || field.key !== itemDescriptionField?.key
            )
            .map(renderEntityField)}

          {isLocationCategory(category) && (
            <RecordPlaceSection
              categories={categories}
              entities={entities}
              draft={draft}
              onEdit={onEdit}
            />
          )}

          <RecordSectionBuilder variant='record' authoring={authoring} />
        </div>
      )}
    </>
  );
}
