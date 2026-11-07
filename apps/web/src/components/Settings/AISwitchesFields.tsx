import type {ProjectAISettings} from '../../entityTypes';
import {anyAISwitchOn, readAISwitches} from '../../services/llm/aiSwitches';
import styles from '../../assets/components/Settings/AISettingsForm.module.css';

interface AISwitchesFieldsProps {
  aiSettings: ProjectAISettings;
  onSettingsChange: (aiSettings: ProjectAISettings) => void;
}

/**
 * The two per-project AI switches at the top of AI Settings (Slice 5.18). Both start off. Turning
 * one off hides its surfaces and refuses its requests; saved provider settings and keys are kept.
 */
export function AISwitchesFields({aiSettings, onSettingsChange}: AISwitchesFieldsProps) {
  const switches = readAISwitches(aiSettings);
  return (
    <div className={styles.toolsSection} aria-labelledby='ai-switches-heading'>
      <h3 id='ai-switches-heading' className={styles.toolsHeading}>What AI may do in this project</h3>
      <p className={styles.help}>
        These two switches are the only place AI is turned on or off for this project. Both start off.
      </p>
      <div className={styles.field}>
        <label className={styles.label}>
          <input
            type='checkbox'
            checked={switches.coaching}
            onChange={(e) => onSettingsChange({...aiSettings, aiCoaching: e.target.checked})}
          />{' '}
          AI coaching
        </label>
        <p className={styles.help}>
          AI that reads and responds and never puts text into your manuscript: the assistant chat and its
          prompt tools, the writing coach, Ask your project, canon checks and canon decision advice,
          continuity questions, World Canvas brainstorming and coaching, talking to a character,
          Character from a description, and AI actions that write a note.
        </p>
      </div>
      <div className={styles.field}>
        <label className={styles.label}>
          <input
            type='checkbox'
            checked={switches.prose}
            onChange={(e) => onSettingsChange({...aiSettings, aiProse: e.target.checked})}
          />{' '}
          AI prose
        </label>
        <p className={styles.help}>
          Model-written text for your manuscript: Preview scene revision, Draft this scene, Character
          scene, and AI actions that rewrite a selection. Every insert is previewed first and marked
          as AI text.
        </p>
      </div>
      {!anyAISwitchOn(switches) && (
        <p className={styles.help} role='status'>
          AI is off for this project. Nothing is sent to a model. Your provider settings and keys are
          kept; turn on a switch above to see them.
        </p>
      )}
    </div>
  );
}
