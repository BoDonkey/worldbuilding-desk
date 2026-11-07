import type {ProjectAISettings} from '../../entityTypes';
import styles from '../../assets/components/Settings/AISettingsForm.module.css';

interface ModelContextFieldsProps {
  aiSettings: ProjectAISettings;
  /** Scene drafts are AI prose; the option shows only while that switch is on (5.18). */
  proseEnabled: boolean;
  onSettingsChange: (aiSettings: ProjectAISettings) => void;
}

/** Scene drafts (4.52) and linked World Bible records in the model's context (4.71). */
export function ModelContextFields({aiSettings, proseEnabled, onSettingsChange}: ModelContextFieldsProps) {
  return (
    <>
      {proseEnabled && (
        <>
          <h3 className={styles.toolsHeading}>Scene drafts</h3>
          <div className={styles.field}>
            <label className={styles.label}>
              <input
                type='checkbox'
                checked={Boolean(aiSettings.allowSceneDrafts)}
                onChange={(e) => onSettingsChange({...aiSettings, allowSceneDrafts: e.target.checked})}
              />{' '}
              Allow AI scene drafts
            </label>
            <p className={styles.help}>
              The AI may draft a whole scene when you ask, from an empty scene. Drafts are previews until you
              insert them, and inserted text is marked as AI text. This applies to this project only.
            </p>
          </div>
        </>
      )}

      <h3 className={styles.toolsHeading}>Model context</h3>
      <div className={styles.field}>
        <label className={styles.label}>
          <input
            type='checkbox'
            checked={Boolean(aiSettings.includeLinkedRecords)}
            onChange={(e) => onSettingsChange({...aiSettings, includeLinkedRecords: e.target.checked})}
          />{' '}
          Include linked World Bible records
        </label>
        <p className={styles.help}>
          When the Character Lab or a scene draft grounds a character, also send the World Bible records
          one step away: those linked to the character, and those its accepted facts name. Only as many as
          fit the model&apos;s context are sent, and the dialog lists anything left out. This applies to this
          project only.
        </p>
      </div>
    </>
  );
}
