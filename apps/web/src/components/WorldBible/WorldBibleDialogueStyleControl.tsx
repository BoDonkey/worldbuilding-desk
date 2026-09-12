import {useEffect, useState} from 'react';
import type {Character, CharacterStyle, WorldEntity} from '../../entityTypes';
import {saveCharacter} from '../../characterStorage';
import styles from '../../assets/components/WorldBibleRoute.module.css';
import {describeError} from '../../services/errors';

interface WorldBibleDialogueStyleControlProps {
  entity: WorldEntity;
  characterExtension: Character | null;
  characterStyles: CharacterStyle[];
  onSaved: (character: Character, message: string) => void;
  onManageStyles: () => void;
}

export const WorldBibleDialogueStyleControl = (
  props: WorldBibleDialogueStyleControlProps
) => {
  const [characterStyleId, setCharacterStyleId] = useState(
    props.characterExtension?.characterStyleId ?? ''
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCharacterStyleId(props.characterExtension?.characterStyleId ?? '');
    setError(null);
  }, [props.characterExtension?.characterStyleId, props.entity.id]);

  const handleSave = async () => {
    const now = Date.now();
    const character: Character = props.characterExtension
      ? {
          ...props.characterExtension,
          entityId: props.entity.id,
          name: props.entity.name,
          characterStyleId: characterStyleId || undefined,
          updatedAt: now
        }
      : {
          id: crypto.randomUUID(),
          projectId: props.entity.projectId,
          entityId: props.entity.id,
          name: props.entity.name,
          fields: {},
          characterStyleId: characterStyleId || undefined,
          createdAt: now,
          updatedAt: now
        };

    setIsSaving(true);
    setError(null);
    try {
      await saveCharacter(character);
      props.onSaved(
        character,
        characterStyleId
          ? `Dialogue style assigned to "${props.entity.name}".`
          : `Dialogue style removed from "${props.entity.name}".`
      );
    } catch (saveError) {
      setError(
        describeError(saveError, 'Unable to save dialogue style.')
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.characterCapabilityEmpty}>
      <label>
        Dialogue style
        <select
          value={characterStyleId}
          onChange={(event) => setCharacterStyleId(event.target.value)}
        >
          <option value=''>Default</option>
          {props.characterStyles.map((style) => (
            <option key={style.id} value={style.id}>
              {style.name}
            </option>
          ))}
        </select>
      </label>
      <p>
        This affects dialogue presentation only. Identity and descriptive canon
        remain in this World Bible character.
      </p>
      {error && <p role='alert'>{error}</p>}
      <div className={styles.reviewToolbarActions}>
        <button type='button' onClick={() => void handleSave()} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save dialogue style'}
        </button>
        <button type='button' onClick={props.onManageStyles}>
          Manage styles
        </button>
      </div>
    </div>
  );
};
