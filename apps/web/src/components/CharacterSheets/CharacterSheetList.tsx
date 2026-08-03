import type {CharacterSheet, StoredRuleset} from '../../entityTypes';
import {
  getEffectiveResourceValues,
  getEffectiveStatValue,
  type CharacterRuntimeModifiers
} from '../../services/compendium';
import styles from '../../styles/CharacterSheetsRoute.module.css';

interface CharacterSheetListProps {
  taskView: 'setup' | 'scene-history';
  sheets: CharacterSheet[];
  ruleset: StoredRuleset;
  runtimeModifiers: CharacterRuntimeModifiers;
  deletingSheetId: string | null;
  onEdit: (sheet: CharacterSheet) => void;
  onDelete: (sheetId: string) => void | Promise<void>;
}

export function CharacterSheetList({
  taskView,
  sheets,
  ruleset,
  runtimeModifiers,
  deletingSheetId,
  onEdit,
  onDelete
}: CharacterSheetListProps) {
  const getStatDefinition = (definitionId: string) =>
    ruleset.statDefinitions.find((definition) => definition.id === definitionId);
  const getResourceDefinition = (definitionId: string) =>
    ruleset.resourceDefinitions.find(
      (definition) => definition.id === definitionId
    );

  return (
    <div
      className={`${styles.sheetList} ${
        taskView === 'setup' ? '' : styles.hidden
      }`}
    >
      <h2>Character Sheets</h2>
      {sheets.length === 0 && (
        <p>No character sheets yet. Add one on the left.</p>
      )}
      <ul className={`${styles.inlineListStyleNone} ${styles.inlinePadding0}`}>
        {sheets.map((sheet) => (
          <li
            key={sheet.id}
            className={`${styles.inlineMarginBottom1rem} ${styles.inlinePadding1rem} ${styles.inlineBorder1pxSolidVarColorBorder} ${styles.inlineBorderRadius4px}`}
          >
            <div
              className={`${styles.inlineDisplayFlex} ${styles.inlineJustifyContentSpaceBetween} ${styles.inlineAlignItemsFlexStart}`}
            >
              <div className={styles.inlineFlex1}>
                <strong className={styles.inlineFontSize12em}>{sheet.name}</strong>
                <div
                  className={`${styles.inlineFontSize09em} ${styles.inlineColorVarColorTextTertiary} ${styles.inlineMarginTop05rem}`}
                >
                  Level {Math.max(1, sheet.level + runtimeModifiers.levelBonus)}
                  {runtimeModifiers.levelBonus > 0
                    ? ` (base ${sheet.level})`
                    : ''}
                  {' | '}
                  {sheet.experience} XP
                </div>

                {sheet.stats.length > 0 && (
                  <div className={`${styles.inlineMarginTop05rem} ${styles.inlineFontSize09em}`}>
                    <strong>Stats:</strong>
                    <div
                      className={`${styles.inlineDisplayGrid} ${styles.inlineGridTemplateColumnsRepeat31fr} ${styles.inlineGap025rem} ${styles.inlineMarginTop025rem}`}
                    >
                      {sheet.stats.map((stat) => {
                        const def = getStatDefinition(stat.definitionId);
                        const effectiveValue = getEffectiveStatValue({
                          definitionId: stat.definitionId,
                          baseValue: stat.value,
                          runtime: runtimeModifiers
                        });
                        return def ? (
                          <span key={stat.definitionId}>
                            {def.name}: {stat.value}
                            {effectiveValue !== stat.value
                              ? ` (${effectiveValue})`
                              : ''}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

                {sheet.resources.length > 0 && (
                  <div className={`${styles.inlineMarginTop05rem} ${styles.inlineFontSize09em}`}>
                    <strong>Resources:</strong>
                    <div className={styles.inlineMarginTop025rem}>
                      {sheet.resources.map((resource) => {
                        const def = getResourceDefinition(
                          resource.definitionId
                        );
                        const effective = getEffectiveResourceValues({
                          definitionId: resource.definitionId,
                          current: resource.current,
                          max: resource.max,
                          runtime: runtimeModifiers
                        });
                        return def ? (
                          <div key={resource.definitionId}>
                            {def.name}: {resource.current}/{resource.max}
                            {(effective.current !== resource.current ||
                              effective.max !== resource.max) &&
                              ` (${effective.current}/${effective.max})`}
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

                {sheet.notes && (
                  <p
                    className={`${styles.inlineMargin05rem000} ${styles.inlineFontSize09em} ${styles.inlineFontStyleItalic} ${styles.inlineColorVarColorBorder}`}
                  >
                    {sheet.notes}
                  </p>
                )}
                {((sheet.inventoryEntries?.length ?? 0) > 0 ||
                  (sheet.inventory?.length ?? 0) > 0) && (
                  <div className={`${styles.inlineMarginTop05rem} ${styles.inlineFontSize09em}`}>
                    <strong>Inventory:</strong>{' '}
                    {(sheet.inventoryEntries?.length
                      ? sheet.inventoryEntries.map((entry) =>
                          entry.quantity && entry.quantity > 1
                            ? `${entry.name} x${entry.quantity}`
                            : entry.name
                        )
                      : sheet.inventory
                    ).join(', ')}
                  </div>
                )}
                {((sheet.equipmentEntries?.length ?? 0) > 0 ||
                  (sheet.equipment?.length ?? 0) > 0) && (
                  <div className={`${styles.inlineMarginTop05rem} ${styles.inlineFontSize09em}`}>
                    <strong>Equipment:</strong>{' '}
                    {(sheet.equipmentEntries?.length
                      ? sheet.equipmentEntries.map((entry) => entry.name)
                      : sheet.equipment
                    )?.join(', ')}
                  </div>
                )}
                {((sheet.statusEntries?.length ?? 0) > 0 ||
                  (sheet.statuses?.length ?? 0) > 0) && (
                  <div className={`${styles.inlineMarginTop05rem} ${styles.inlineFontSize09em}`}>
                    <strong>Statuses:</strong>{' '}
                    {(sheet.statusEntries?.length
                      ? sheet.statusEntries.map((entry) => entry.name)
                      : sheet.statuses
                    )?.join(', ')}
                  </div>
                )}
              </div>

              <div className={`${styles.inlineDisplayFlex} ${styles.inlineGap05rem}`}>
                <button type='button' onClick={() => onEdit(sheet)}>
                  Edit
                </button>
                <button
                  type='button'
                  onClick={() => onDelete(sheet.id)}
                  disabled={deletingSheetId === sheet.id}
                >
                  {deletingSheetId === sheet.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
