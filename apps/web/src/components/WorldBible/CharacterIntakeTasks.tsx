import styles from '../../assets/components/WorldBibleRoute.module.css';
import {CharacterFromDescriptionDialog} from '../CharacterLab/CharacterFromDescriptionDialog';
import {CharacterCardImportDialog} from '../CharacterLab/CharacterCardImportDialog';

export type CharacterIntakeKind = 'description' | 'card';

/** The character category's guided starts: from a description, or from a character card (4.69). */
export function CharacterIntakeTasks({onStart}: {onStart: (kind: CharacterIntakeKind) => void}) {
  return (
    <>
      <div className={styles.castTask}>
        <h3>From a description</h3>
        <p>
          Describe a character in a few sentences. The character lab splits it into
          facts for your review and suggestions kept as notes.
        </p>
        <button type='button' onClick={() => onStart('description')}>
          Start from a description
        </button>
      </div>
      <div className={styles.castTask}>
        <h3>From a character card</h3>
        <p>
          Bring in a character from SillyTavern or a card library (PNG or JSON). You see where each
          part goes before anything is saved.
        </p>
        <button type='button' onClick={() => onStart('card')}>
          Import a character card
        </button>
      </div>
    </>
  );
}

/**
 * The open intake dialog. Rendered at the route root, not inside the task
 * panel, so it stays open while the panel hides (for example when a saved
 * record opens in the editor).
 */
export function CharacterIntakeDialog(props: {
  kind: CharacterIntakeKind | null;
  projectId: string;
  category: {id: string; slug: string} | null;
  onOpenCharacter: (entityId: string) => void;
  onClose: () => void;
}) {
  const {kind, category, ...rest} = props;
  if (!kind || !category) return null;
  return kind === 'description' ? (
    <CharacterFromDescriptionDialog isOpen category={category} {...rest} />
  ) : (
    <CharacterCardImportDialog category={category} {...rest} />
  );
}
