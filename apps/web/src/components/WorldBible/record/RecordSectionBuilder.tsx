import styles from '../../../assets/components/WorldBibleRoute.module.css';
import type {RecordAuthoring, RecordVariant} from './recordTypes';

interface RecordSectionBuilderProps {
  variant: RecordVariant;
  authoring: RecordAuthoring;
}

/** Adds a reusable rich-text section to every record in the category. */
export function RecordSectionBuilder({variant, authoring}: RecordSectionBuilderProps) {
  const {
    newCharacterSectionName,
    setNewCharacterSectionName,
    activeCategoryRecordLabel,
    handleAddCharacterSection
  } = authoring;
  const isCharacter = variant === 'character';
  return (
    <div className={styles.characterSectionBuilder}>
      <div>
        <strong>Add {isCharacter ? 'character' : activeCategoryRecordLabel} section</strong>
        <p>
          {isCharacter
            ? 'Create a reusable rich section for this project, such as Education, Traumas, Addictions, Relationships, or Voice.'
            : 'Create a reusable rich section for this tab, such as History, Reputation, Rules, Relationships, or Notes.'}
        </p>
      </div>
      <div className={styles.characterSectionControls}>
        <input
          type='text'
          value={newCharacterSectionName}
          onChange={(event) => setNewCharacterSectionName(event.target.value)}
          placeholder={
            isCharacter ? 'Education, Traumas, Addictions...' : 'History, Reputation, Rules...'
          }
        />
        <button
          type='button'
          onClick={() => void handleAddCharacterSection()}
        >
          Add Section
        </button>
      </div>
    </div>
  );
}
