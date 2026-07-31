import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction
} from 'react';
import type {EntityCategory, WorldEntity} from '../entityTypes';
import {saveCategory} from '../categoryStorage';
import type {WorldBibleImportDraft} from './useWorldBibleImports';
import {
  ALTERNATIVE_NAMES_KEY,
  extractPlainTextFromRichText,
  formatAlternativeNames,
  normalizeRichTextValue,
  parseAlternativeNames
} from '../services/worldBible/worldBibleEntityHelpers';

export type AiHelperActionTarget =
  | 'name'
  | 'aliases'
  | 'new-section'
  | `field:${string}`;

export type AiHelperProposal =
  | {kind: 'name'; text: string}
  | {kind: 'aliases'; text: string}
  | {
      kind: 'field';
      text: string;
      fieldKey: string;
      fieldLabel: string;
      fieldType: EntityCategory['fieldSchema'][number]['type'];
    }
  | {kind: 'new-section'; text: string; label: string};

interface WorldBibleFeedback {
  tone: 'success' | 'error';
  message: string;
}

interface UseWorldBibleAuthoringAssistantOptions {
  activeCategory: EntityCategory | null;
  setCategories: Dispatch<SetStateAction<EntityCategory[]>>;
  selectedEntity: WorldEntity | null;
  name: string;
  setName: Dispatch<SetStateAction<string>>;
  fieldValues: Record<string, string>;
  setFieldValues: Dispatch<SetStateAction<Record<string, string>>>;
  importDrafts: WorldBibleImportDraft[];
  categoryById: Map<string, EntityCategory>;
  updateImportDraft: (
    draftId: string,
    updates: Partial<WorldBibleImportDraft>
  ) => void;
  setFeedback: Dispatch<SetStateAction<WorldBibleFeedback | null>>;
}

const slugifyFieldKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'section';

export const deriveAiSectionLabel = (selectedText: string): string => {
  const firstLine = selectedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) return '';
  return firstLine
    .replace(/^#+\s*/, '')
    .replace(/[:.!?]+$/, '')
    .slice(0, 48)
    .trim();
};

const formatAiFieldContextValue = (value: string): string => {
  const plainText = extractPlainTextFromRichText(value).trim();
  if (!plainText) return '(empty)';
  return plainText.length > 2500
    ? `${plainText.slice(0, 2500).trim()}...`
    : plainText;
};

export function useWorldBibleAuthoringAssistant({
  activeCategory,
  setCategories,
  selectedEntity,
  name,
  setName,
  fieldValues,
  setFieldValues,
  importDrafts,
  categoryById,
  updateImportDraft,
  setFeedback
}: UseWorldBibleAuthoringAssistantOptions) {
  const [isRecordAiHelperOpen, setIsRecordAiHelperOpen] = useState(false);
  const [isImportAiHelperOpen, setIsImportAiHelperOpen] = useState(false);
  const [aiHelperSelectedText, setAiHelperSelectedText] = useState('');
  const [aiHelperActionTarget, setAiHelperActionTarget] =
    useState<AiHelperActionTarget>('name');
  const [aiHelperNewSectionLabel, setAiHelperNewSectionLabel] = useState('');
  const [aiHelperProposal, setAiHelperProposal] = useState<AiHelperProposal | null>(
    null
  );
  const [newCharacterSectionName, setNewCharacterSectionName] = useState('');

  const activeCategoryRecordLabel =
    activeCategory?.name.replace(/s$/i, '').toLowerCase() || 'record';
  const currentRecordAiContext = useMemo(() => {
    if (!activeCategory) return '';
    const fieldContext = activeCategory.fieldSchema.map((field) => {
      const value = fieldValues[field.key] ?? '';
      return [
        `Field: ${field.label}`,
        `Key: ${field.key}`,
        `Current content:\n${formatAiFieldContextValue(value)}`
      ].join('\n');
    });
    return [
      `Category: ${activeCategory.name}`,
      name.trim() ? `Current name: ${name.trim()}` : '',
      fieldContext.length > 0
        ? `Editable fields:\n\n${fieldContext.join('\n\n---\n\n')}`
        : ''
    ]
      .filter(Boolean)
      .join('\n\n');
  }, [activeCategory, fieldValues, name]);
  const aiHelperApplyTargets = useMemo(() => {
    if (!activeCategory) return [];
    return [
      {value: 'name' as AiHelperActionTarget, label: 'Name'},
      {value: 'aliases' as AiHelperActionTarget, label: 'Alternative names'},
      ...activeCategory.fieldSchema.map((field) => ({
        value: `field:${field.key}` as AiHelperActionTarget,
        label: field.label
      })),
      {value: 'new-section' as AiHelperActionTarget, label: 'New section'}
    ];
  }, [activeCategory]);
  const importAiContext = useMemo(() => {
    if (importDrafts.length === 0) return '';
    return importDrafts
      .slice(0, 8)
      .map((draft) => {
        const category = categoryById.get(draft.categoryId);
        return [
          `File: ${draft.fileName}`,
          category ? `Target category: ${category.name}` : '',
          draft.name.trim() ? `Detected name: ${draft.name.trim()}` : '',
          draft.parseError ? `Error: ${draft.parseError}` : `Preview: ${draft.preview}`
        ]
          .filter(Boolean)
          .join('\n');
      })
      .join('\n\n---\n\n');
  }, [categoryById, importDrafts]);
  const currentCharacterLabel =
    name.trim() ||
    selectedEntity?.name ||
    activeCategory?.name.slice(0, -1) ||
    'this record';

  const handleDraftAiHelperProposal = useCallback(() => {
    if (!activeCategory) return;
    const selectedText = aiHelperSelectedText.trim();
    if (!selectedText) {
      setFeedback({
        tone: 'error',
        message: 'Highlight text in the assistant response before applying it.'
      });
      return;
    }

    if (aiHelperActionTarget === 'name' || aiHelperActionTarget === 'aliases') {
      setAiHelperProposal({kind: aiHelperActionTarget, text: selectedText});
      setFeedback(null);
      return;
    }
    if (aiHelperActionTarget === 'new-section') {
      const label =
        aiHelperNewSectionLabel.trim() || deriveAiSectionLabel(selectedText);
      if (!label) {
        setFeedback({
          tone: 'error',
          message: 'Name the new section before previewing this action.'
        });
        return;
      }
      setAiHelperProposal({kind: 'new-section', text: selectedText, label});
      setFeedback(null);
      return;
    }

    const fieldKey = aiHelperActionTarget.replace(/^field:/, '');
    const targetField = activeCategory.fieldSchema.find(
      (field) => field.key === fieldKey
    );
    if (!targetField) {
      setFeedback({
        tone: 'error',
        message: 'Choose a valid destination field before previewing this action.'
      });
      return;
    }
    setAiHelperProposal({
      kind: 'field',
      text: selectedText,
      fieldKey: targetField.key,
      fieldLabel: targetField.label,
      fieldType: targetField.type
    });
    setFeedback(null);
  }, [
    activeCategory,
    aiHelperActionTarget,
    aiHelperNewSectionLabel,
    aiHelperSelectedText,
    setFeedback
  ]);

  const handleConfirmAiHelperProposal = useCallback(async () => {
    if (!activeCategory || !aiHelperProposal) return;
    const selectedText = aiHelperProposal.text.trim();
    if (!selectedText) {
      setAiHelperProposal(null);
      return;
    }

    if (aiHelperProposal.kind === 'name') {
      setName(selectedText);
      setAiHelperProposal(null);
      setFeedback({
        tone: 'success',
        message: `Set the ${activeCategoryRecordLabel} name from selected assistant text. Review before saving.`
      });
      return;
    }
    if (aiHelperProposal.kind === 'aliases') {
      setFieldValues((currentValues) => ({
        ...currentValues,
        [ALTERNATIVE_NAMES_KEY]: formatAlternativeNames(
          parseAlternativeNames(
            [
              ...parseAlternativeNames(
                currentValues[ALTERNATIVE_NAMES_KEY] || ''
              ),
              selectedText
            ].join(', ')
          )
        )
      }));
      setFeedback({
        tone: 'success',
        message: 'Added selected assistant text to alternative names. Review before saving.'
      });
      setAiHelperProposal(null);
      return;
    }
    if (aiHelperProposal.kind === 'new-section') {
      const label = aiHelperProposal.label.trim();
      if (!label) {
        setFeedback({
          tone: 'error',
          message: 'Name the new section before confirming this action.'
        });
        return;
      }
      const existingKeys = new Set(activeCategory.fieldSchema.map((field) => field.key));
      const baseKey = slugifyFieldKey(label);
      let key = baseKey;
      let suffix = 2;
      while (existingKeys.has(key)) {
        key = `${baseKey}_${suffix}`;
        suffix += 1;
      }
      const updatedCategory: EntityCategory = {
        ...activeCategory,
        fieldSchema: [...activeCategory.fieldSchema, {key, label, type: 'textarea'}]
      };
      await saveCategory(updatedCategory);
      setCategories((current) =>
        current.map((category) =>
          category.id === updatedCategory.id ? updatedCategory : category
        )
      );
      setFieldValues((current) => ({
        ...current,
        [key]: normalizeRichTextValue(selectedText)
      }));
      setAiHelperNewSectionLabel('');
      setAiHelperProposal(null);
      setFeedback({
        tone: 'success',
        message: `Added "${label}" as a new section. Review before saving.`
      });
      return;
    }

    const targetField = activeCategory.fieldSchema.find(
      (field) => field.key === aiHelperProposal.fieldKey
    );
    if (!targetField) {
      setFeedback({
        tone: 'error',
        message: 'This destination field no longer exists. Choose another action.'
      });
      setAiHelperProposal(null);
      return;
    }
    setFieldValues((current) => {
      const existing = current[targetField.key]?.trim();
      const shouldAppend = targetField.type === 'textarea';
      const nextValue = shouldAppend
        ? [existing, selectedText].filter(Boolean).join('\n\n')
        : selectedText;
      return {
        ...current,
        [targetField.key]: shouldAppend
          ? normalizeRichTextValue(nextValue)
          : nextValue
      };
    });
    setFeedback({
      tone: 'success',
      message: `Applied selected assistant text to ${targetField.label}. Review before saving.`
    });
    setAiHelperProposal(null);
  }, [
    activeCategory,
    activeCategoryRecordLabel,
    aiHelperProposal,
    setCategories,
    setFeedback,
    setFieldValues,
    setName
  ]);

  const detectedSectionImportDraftCount = useMemo(
    () =>
      importDrafts.filter(
        (draft) =>
          draft.include &&
          !draft.parseError &&
          (draft.detectedSections?.some((section) => section.action !== 'ignore') ??
            false)
      ).length,
    [importDrafts]
  );
  const handleUseDetectedSectionsForImportDrafts = useCallback(() => {
    const draftsToUpdate = importDrafts.filter(
      (draft) =>
        draft.include &&
        !draft.parseError &&
        (draft.detectedSections?.some((section) => section.action !== 'ignore') ??
          false)
    );
    if (draftsToUpdate.length === 0) {
      setFeedback({
        tone: 'error',
        message: 'No selected import drafts have detected headings to apply.'
      });
      return;
    }
    draftsToUpdate.forEach((draft) => {
      updateImportDraft(draft.id, {useDetectedSections: true});
    });
    setFeedback({
      tone: 'success',
      message:
        draftsToUpdate.length === 1
          ? 'Detected headings will be created as fields when you apply this import.'
          : `Detected headings will be created as fields for ${draftsToUpdate.length} selected imports.`
    });
  }, [importDrafts, setFeedback, updateImportDraft]);

  const handleAddCharacterSection = useCallback(async () => {
    if (!activeCategory) return;
    const label = newCharacterSectionName.trim();
    if (!label) {
      setFeedback({
        tone: 'error',
        message: `Name the ${activeCategoryRecordLabel} section first.`
      });
      return;
    }
    const existingKeys = new Set(activeCategory.fieldSchema.map((field) => field.key));
    const baseKey = slugifyFieldKey(label);
    let key = baseKey;
    let suffix = 2;
    while (existingKeys.has(key)) {
      key = `${baseKey}_${suffix}`;
      suffix += 1;
    }
    const updatedCategory: EntityCategory = {
      ...activeCategory,
      fieldSchema: [...activeCategory.fieldSchema, {key, label, type: 'textarea'}]
    };
    await saveCategory(updatedCategory);
    setCategories((current) =>
      current.map((category) =>
        category.id === updatedCategory.id ? updatedCategory : category
      )
    );
    setFieldValues((current) => ({
      ...current,
      [key]: normalizeRichTextValue('')
    }));
    setNewCharacterSectionName('');
    setFeedback({
      tone: 'success',
      message: `Added "${label}" to ${activeCategory.name.toLowerCase()} records.`
    });
  }, [
    activeCategory,
    activeCategoryRecordLabel,
    newCharacterSectionName,
    setCategories,
    setFeedback,
    setFieldValues
  ]);

  return {
    isRecordAiHelperOpen,
    setIsRecordAiHelperOpen,
    isImportAiHelperOpen,
    setIsImportAiHelperOpen,
    aiHelperSelectedText,
    setAiHelperSelectedText,
    aiHelperActionTarget,
    setAiHelperActionTarget,
    aiHelperNewSectionLabel,
    setAiHelperNewSectionLabel,
    aiHelperProposal,
    setAiHelperProposal,
    newCharacterSectionName,
    setNewCharacterSectionName,
    activeCategoryRecordLabel,
    currentRecordAiContext,
    aiHelperApplyTargets,
    importAiContext,
    currentCharacterLabel,
    handleDraftAiHelperProposal,
    handleConfirmAiHelperProposal,
    detectedSectionImportDraftCount,
    handleUseDetectedSectionsForImportDrafts,
    handleAddCharacterSection
  };
}
