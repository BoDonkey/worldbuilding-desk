import type {ProjectFeatureToggles, ProjectMode} from '../../entityTypes';
import styles from '../../styles/SettingsRoute.module.css';

type ToggleKey = keyof ProjectFeatureToggles;

/** What each toggle shows, in the order listed (Slice 4.88). */
const TOGGLES: Array<{key: ToggleKey; label: string; description: string}> = [
  {
    key: 'enableGameSystems',
    label: 'Enable Game Systems',
    description: 'Character sheets, the Compendium, stat pins, and the mechanics tools in the Workspace.'
  },
  {
    key: 'enableRuntimeModifiers',
    label: 'Enable Runtime Modifiers',
    description: 'Compendium crafting adjusts level and material costs from settlements and party synergies. Needs Settlement/Zone Systems.'
  },
  {
    key: 'enableSettlementAndZoneSystems',
    label: 'Enable Settlement/Zone Systems',
    description: 'The Compendium\'s world systems: settlements, zone progress, and party synergy suggestions.'
  },
  {
    key: 'enableRuleAuthoring',
    label: 'Enable Rule Authoring',
    description: 'The Ruleset page, where you define the stats and rules sheets use.'
  }
];

interface FeatureTogglesFieldsProps {
  projectMode: ProjectMode;
  featureToggles: ProjectFeatureToggles;
  onChange: (key: ToggleKey, enabled: boolean) => void;
}

/**
 * Settings → Feature Toggles (4.88). A General Fiction project has no
 * mechanics, so it gets one line saying how to turn them on, unless a toggle
 * is already on; then the toggles stay so the author can turn it off.
 */
export function FeatureTogglesFields({projectMode, featureToggles, onChange}: FeatureTogglesFieldsProps) {
  const anyOn = TOGGLES.some((toggle) => featureToggles[toggle.key]);
  if (projectMode === 'general' && !anyOn) {
    return (
      <p className={styles.helperText}>
        Mechanics and rulesets are off in General Fiction. To use them, switch <strong>Project Mode</strong> to
        LitRPG Author.
      </p>
    );
  }
  return (
    <>
      <p className={styles.helperText}>
        {projectMode === 'general'
          ? 'Mechanics are usually off in General Fiction. Turn these off to hide them, or switch Project Mode to LitRPG Author to keep them.'
          : 'Use toggles to simplify the interface for this project. Turning one off hides its tools and keeps their data.'}
      </p>
      {TOGGLES.map((toggle) => (
        <div key={toggle.key} className={styles.toggleField}>
          <label className={styles.toggleRow}>
            <input
              type='checkbox'
              checked={featureToggles[toggle.key]}
              onChange={(event) => onChange(toggle.key, event.target.checked)}
              aria-describedby={`feature-toggle-${toggle.key}`}
            />
            <span>{toggle.label}</span>
          </label>
          <p id={`feature-toggle-${toggle.key}`} className={styles.toggleDescription}>{toggle.description}</p>
        </div>
      ))}
    </>
  );
}
