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
      className={styles.sheetList}
      style={{display: taskView === 'setup' ? 'block' : 'none'}}
    >
      <h2>Character Sheets</h2>
      {sheets.length === 0 && (
        <p>No character sheets yet. Add one on the left.</p>
      )}
      <ul style={{listStyle: 'none', padding: 0}}>
        {sheets.map((sheet) => (
          <li
            key={sheet.id}
            style={{
              marginBottom: '1rem',
              padding: '1rem',
              border: '1px solid var(--color-border)',
              borderRadius: '4px'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start'
              }}
            >
              <div style={{flex: 1}}>
                <strong style={{fontSize: '1.2em'}}>{sheet.name}</strong>
                <div
                  style={{
                    fontSize: '0.9em',
                    color: 'var(--color-text-tertiary)',
                    marginTop: '0.5rem'
                  }}
                >
                  Level {Math.max(1, sheet.level + runtimeModifiers.levelBonus)}
                  {runtimeModifiers.levelBonus > 0
                    ? ` (base ${sheet.level})`
                    : ''}
                  {' | '}
                  {sheet.experience} XP
                </div>

                {sheet.stats.length > 0 && (
                  <div style={{marginTop: '0.5rem', fontSize: '0.9em'}}>
                    <strong>Stats:</strong>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '0.25rem',
                        marginTop: '0.25rem'
                      }}
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
                  <div style={{marginTop: '0.5rem', fontSize: '0.9em'}}>
                    <strong>Resources:</strong>
                    <div style={{marginTop: '0.25rem'}}>
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
                    style={{
                      margin: '0.5rem 0 0 0',
                      fontSize: '0.9em',
                      fontStyle: 'italic',
                      color: 'var(--color-border)'
                    }}
                  >
                    {sheet.notes}
                  </p>
                )}
                {((sheet.inventoryEntries?.length ?? 0) > 0 ||
                  (sheet.inventory?.length ?? 0) > 0) && (
                  <div style={{marginTop: '0.5rem', fontSize: '0.9em'}}>
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
                  <div style={{marginTop: '0.5rem', fontSize: '0.9em'}}>
                    <strong>Equipment:</strong>{' '}
                    {(sheet.equipmentEntries?.length
                      ? sheet.equipmentEntries.map((entry) => entry.name)
                      : sheet.equipment
                    )?.join(', ')}
                  </div>
                )}
                {((sheet.statusEntries?.length ?? 0) > 0 ||
                  (sheet.statuses?.length ?? 0) > 0) && (
                  <div style={{marginTop: '0.5rem', fontSize: '0.9em'}}>
                    <strong>Statuses:</strong>{' '}
                    {(sheet.statusEntries?.length
                      ? sheet.statusEntries.map((entry) => entry.name)
                      : sheet.statuses
                    )?.join(', ')}
                  </div>
                )}
              </div>

              <div style={{display: 'flex', gap: '0.5rem'}}>
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
