import {useMemo, useState} from 'react';
import type {EntityCategory, WorldEntity} from '../../entityTypes';
import {isCharacterCategory} from '../../services/characters/characterIdentity';
import type {AISwitches} from '../../services/llm/aiSwitches';
import styles from '../../styles/WorkspaceRoute.module.css';

/**
 * The Characters drawer's lab entries. Talking to a character is AI coaching; writing a
 * character scene is AI prose. Each entry shows only while its switch is on (Slice 5.18).
 */
export function WorkspaceCharacterLabSection({
  entities,
  categories,
  switches,
  onOpenCharacterLab,
  onOpenCharacterScene
}: {
  entities: WorldEntity[];
  categories: EntityCategory[];
  switches: AISwitches;
  onOpenCharacterLab: (entityId: string) => void;
  onOpenCharacterScene: (entityId: string) => void;
}) {
  const [labEntityId, setLabEntityId] = useState('');
  const labCharacterOptions = useMemo(() => {
    const characterCategoryIds = new Set(
      categories.filter((category) => isCharacterCategory(category)).map((category) => category.id)
    );
    return entities
      .filter((entity) => characterCategoryIds.has(entity.categoryId))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categories, entities]);
  const selectedLabEntityId = labCharacterOptions.some((entity) => entity.id === labEntityId)
    ? labEntityId
    : labCharacterOptions[0]?.id ?? '';

  if (!switches.coaching && !switches.prose) return null;
  const description = switches.coaching && switches.prose
    ? 'Talk to a character, test a reaction, or draft a short scene for two or three characters, grounded in canon and story state at your cursor. Draft only; nothing changes canon.'
    : switches.coaching
      ? 'Talk to a character or test a reaction, grounded in canon and story state at your cursor. Nothing changes canon.'
      : 'Draft a short scene for two or three characters, grounded in canon and story state at your cursor. Draft only; nothing changes canon.';

  return (
    <>
      <div className={styles.contextSummaryText}>
        <strong>Character lab</strong>
        <div className={styles.consistencyDescription}>{description}</div>
      </div>
      {labCharacterOptions.length === 0 ? (
        <p className={styles.contextSummaryText}>
          Add a character in World Bible to use the lab.
        </p>
      ) : (
        <>
          <label className={styles.contextSummaryText}>
            Character{' '}
            <select
              value={selectedLabEntityId}
              onChange={(event) => setLabEntityId(event.target.value)}
            >
              {labCharacterOptions.map((entity) => (
                <option key={entity.id} value={entity.id}>{entity.name}</option>
              ))}
            </select>
          </label>
          {switches.coaching && (
            <button
              type='button'
              onClick={() => onOpenCharacterLab(selectedLabEntityId)}
              disabled={!selectedLabEntityId}
            >
              Open character lab
            </button>
          )}
          {switches.prose && (
            <button
              type='button'
              onClick={() => onOpenCharacterScene(selectedLabEntityId)}
              disabled={labCharacterOptions.length < 2}
            >
              Write a character scene
            </button>
          )}
        </>
      )}
    </>
  );
}
