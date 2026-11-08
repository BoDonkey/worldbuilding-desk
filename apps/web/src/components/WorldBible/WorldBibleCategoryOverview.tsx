import type {EntityCategory} from '../../entityTypes';
import {isCharacterCategory, isItemCategory} from '../../services/worldBible/worldBibleSummary';
import {isSystemNegativeSpaceCategory} from '../../services/worldBible/systemNegativeSpace';
import styles from '../../assets/components/WorldBibleRoute.module.css';
import {CharacterIntakeTasks, type CharacterIntakeKind} from './CharacterIntakeTasks';

interface WorldBibleCategoryOverviewProps {
  category: EntityCategory;
  aiCoaching: boolean;
  isImportingEntities: boolean;
  onCreateManually: () => void;
  onStartCharacterIntake: (kind: CharacterIntakeKind) => void;
  onImportDocs: () => void;
  onPasteText: () => void;
}

/** The category's landing panel: what lives here and the ways to add a record. */
export function WorldBibleCategoryOverview({
  category,
  aiCoaching,
  isImportingEntities,
  onCreateManually,
  onStartCharacterIntake,
  onImportDocs,
  onPasteText
}: WorldBibleCategoryOverviewProps) {
  const isCharacter = isCharacterCategory(category);
  const singular = category.name.replace(/s$/i, '');
  return (
    <section className={styles.castPanel} aria-label={`${category.name} canon`}>
      <div className={styles.castHeader}>
        <div>
          <div className={styles.castEyebrow}>{category.name} canon</div>
          <h2>{category.name}</h2>
          {isCharacter ? (
            <p>
              Build story-facing character records here. Canonical names,
              aliases, description, role, and notes stay in World Bible; sheets
              remain optional system tools.
            </p>
          ) : isSystemNegativeSpaceCategory(category) ? (
            <p>
              Keep an explicit list of human problems that progression cannot solve.
              Status and scene links are author-maintained; meaning is not inferred here.
            </p>
          ) : (
            <p>
              Build story-facing {category.name.toLowerCase()} here.
              Canonical names, aliases, descriptions, and notes stay in World
              Bible.
            </p>
          )}
        </div>
      </div>
      <div className={styles.castTaskGrid}>
        <div className={styles.castTask}>
          <h3>Manual {singular}</h3>
          <p>
            {isItemCategory(category)
              ? 'Describe the item first, then add structured details only when they help.'
              : 'Start with a canonical name, aliases, and the core canon fields.'}
          </p>
          <button type='button' onClick={onCreateManually}>
            Create Manually
          </button>
        </div>
        {isCharacter && (
          <CharacterIntakeTasks onStart={onStartCharacterIntake} fromDescription={aiCoaching} />
        )}
        <div className={styles.castTask}>
          <h3>Import {singular}</h3>
          <p>Import documents or pasted dossiers, then review each generated canon record.</p>
          <div className={styles.castTaskActions}>
            <button
              type='button'
              onClick={onImportDocs}
              disabled={isImportingEntities}
            >
              {isImportingEntities ? 'Importing...' : 'Import Docs'}
            </button>
            <button type='button' onClick={onPasteText}>
              Paste Text
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
