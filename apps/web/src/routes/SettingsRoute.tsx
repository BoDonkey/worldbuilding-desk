import {useEffect, useState} from 'react';
import type {
  Project,
  ProjectSettings,
  CharacterStyle,
  ProjectAISettings,
  ProjectFeatureToggles,
  ProjectMode
} from '../entityTypes';
import {getOrCreateSettings, saveProjectSettings} from '../settingsStorage';
import {CharacterStyleList} from '../components/CharacterStyleList';
import {AISettings} from '../components/Settings/AISettings';
import {FontSizeControl} from '../components/Settings/FontSizeControl';
import {
  getDefaultFeatureToggles,
  PROJECT_MODE_OPTIONS
} from '../projectMode';
import styles from '../styles/SettingsRoute.module.css';

interface SettingsRouteProps {
  activeProject: Project | null;
  onSettingsChanged?: (settings: ProjectSettings | null) => void;
}

function SettingsRoute({activeProject, onSettingsChanged}: SettingsRouteProps) {
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [newStyleName, setNewStyleName] = useState('');
  const [expandedStyleId, setExpandedStyleId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeProject) {
      setSettings(null);
      onSettingsChanged?.(null);
      return;
    }

    let cancelled = false;

    (async () => {
      const projectSettings = await getOrCreateSettings(activeProject.id);
      if (!cancelled) {
        setSettings(projectSettings);
        onSettingsChanged?.(projectSettings);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProject, onSettingsChanged]);

  const handleAddStyle = async () => {
    if (!settings || !newStyleName.trim()) return;

    const newStyle: CharacterStyle = {
      id: crypto.randomUUID(),
      name: newStyleName.trim(),
      markName: newStyleName.toLowerCase().replace(/\s+/g, '-'),
      styles: {
        color: '#ffffff',
        fontStyle: 'normal',
        fontWeight: 'normal'
      }
    };

    const updated: ProjectSettings = {
      ...settings,
      characterStyles: [...settings.characterStyles, newStyle],
      updatedAt: Date.now()
    };

    await saveProjectSettings(updated);
    setSettings(updated);
    onSettingsChanged?.(updated);
    setNewStyleName('');
    setExpandedStyleId(newStyle.id);
  };

  const handleUpdateStyle = async (
    styleId: string,
    updates: Partial<CharacterStyle['styles']>
  ) => {
    if (!settings) return;

    const updated: ProjectSettings = {
      ...settings,
      characterStyles: settings.characterStyles.map((s) =>
        s.id === styleId ? {...s, styles: {...s.styles, ...updates}} : s
      ),
      updatedAt: Date.now()
    };

    await saveProjectSettings(updated);
    setSettings(updated);
    onSettingsChanged?.(updated);
  };

  const handleDeleteStyle = async (styleId: string) => {
    if (!settings) return;

    const updated: ProjectSettings = {
      ...settings,
      characterStyles: settings.characterStyles.filter((s) => s.id !== styleId),
      updatedAt: Date.now()
    };

    await saveProjectSettings(updated);
    setSettings(updated);
    onSettingsChanged?.(updated);
    if (expandedStyleId === styleId) {
      setExpandedStyleId(null);
    }
  };

  const handleAISettingsChange = async (aiSettings: ProjectAISettings) => {
    if (!settings) return;

    const updated: ProjectSettings = {
      ...settings,
      aiSettings,
      updatedAt: Date.now()
    };

    await saveProjectSettings(updated);
    setSettings(updated);
    onSettingsChanged?.(updated);
  };

  const handleProjectModeChange = async (mode: ProjectMode) => {
    if (!settings) return;
    const updated: ProjectSettings = {
      ...settings,
      projectMode: mode,
      featureToggles: getDefaultFeatureToggles(mode),
      updatedAt: Date.now()
    };
    await saveProjectSettings(updated);
    setSettings(updated);
    onSettingsChanged?.(updated);
  };

  const handleFeatureToggleChange = async (
    key: keyof ProjectFeatureToggles,
    checked: boolean
  ) => {
    if (!settings) return;
    const updated: ProjectSettings = {
      ...settings,
      featureToggles: {
        ...settings.featureToggles,
        [key]: checked
      },
      updatedAt: Date.now()
    };
    await saveProjectSettings(updated);
    setSettings(updated);
    onSettingsChanged?.(updated);
  };

  if (!activeProject) {
    return (
      <section className={styles.container}>
        <h1>Settings</h1>
        <p>
          No active project. Go to <strong>Projects</strong> to create or open a
          project first.
        </p>
      </section>
    );
  }

  if (!settings) {
    return (
      <section className={styles.container}>
        <h1>Settings</h1>
        <p>Loading settings...</p>
      </section>
    );
  }

  return (
    <section className={styles.container}>
      <h1>Settings for {activeProject.name}</h1>
      <details className={styles.helpPanel}>
        <summary>Settings Wizard Help</summary>
        <div className={styles.helpBody}>
          <p>
            Step 1: pick a <strong>Project Mode</strong> to set defaults for this
            project.
          </p>
          <p>
            Step 2: fine-tune <strong>Feature Toggles</strong> to simplify what users
            see.
          </p>
          <p>
            Step 3: configure AI and style settings for day-to-day writing.
          </p>
        </div>
      </details>

      <div className={styles.settingsGrid}>
        {/* Accessibility Section */}
        <div className={styles.section}>
          <h2>Accessibility</h2>
          <FontSizeControl />
        </div>

        {/* AI Settings Section */}
        <div className={styles.section}>
          <h2>AI Settings</h2>
          <AISettings
            aiSettings={settings.aiSettings}
            onSettingsChange={handleAISettingsChange}
          />
        </div>

        <div className={styles.section}>
          <h2>Project Mode</h2>
          <p className={styles.helperText}>
            Choose the default experience for this project. Changing mode resets
            feature toggles to mode defaults.
          </p>
          <label className={styles.fieldLabel}>
            Mode
            <select
              value={settings.projectMode}
              onChange={(e) =>
                void handleProjectModeChange(e.target.value as ProjectMode)
              }
              className={styles.styleInput}
            >
              {PROJECT_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={styles.section}>
          <h2>Feature Toggles</h2>
          <p className={styles.helperText}>
            Use toggles to simplify UI per project while preserving data.
          </p>
          <label className={styles.toggleRow}>
            <input
              type='checkbox'
              checked={settings.featureToggles.enableGameSystems}
              onChange={(e) =>
                void handleFeatureToggleChange('enableGameSystems', e.target.checked)
              }
            />
            <span>Enable Game Systems</span>
          </label>
          <label className={styles.toggleRow}>
            <input
              type='checkbox'
              checked={settings.featureToggles.enableRuntimeModifiers}
              onChange={(e) =>
                void handleFeatureToggleChange(
                  'enableRuntimeModifiers',
                  e.target.checked
                )
              }
            />
            <span>Enable Runtime Modifiers</span>
          </label>
          <label className={styles.toggleRow}>
            <input
              type='checkbox'
              checked={settings.featureToggles.enableSettlementAndZoneSystems}
              onChange={(e) =>
                void handleFeatureToggleChange(
                  'enableSettlementAndZoneSystems',
                  e.target.checked
                )
              }
            />
            <span>Enable Settlement/Zone Systems</span>
          </label>
          <label className={styles.toggleRow}>
            <input
              type='checkbox'
              checked={settings.featureToggles.enableRuleAuthoring}
              onChange={(e) =>
                void handleFeatureToggleChange(
                  'enableRuleAuthoring',
                  e.target.checked
                )
              }
            />
            <span>Enable Rule Authoring</span>
          </label>
        </div>

        {/* Character Styles Section */}
        <div className={styles.section}>
          <h2>Character Dialogue Styles</h2>
          <div className={styles.addStyle}>
            <input
              type='text'
              value={newStyleName}
              onChange={(e) => setNewStyleName(e.target.value)}
              placeholder='Style name (e.g., Protagonist Thoughts)'
              className={styles.styleInput}
            />
            <button onClick={handleAddStyle} className={styles.addButton}>
              Add Style
            </button>
          </div>

          <CharacterStyleList
            styles={settings.characterStyles}
            onUpdate={handleUpdateStyle}
            onDelete={handleDeleteStyle}
            expandedStyleId={expandedStyleId}
            onToggleExpand={setExpandedStyleId}
          />
        </div>
      </div>
    </section>
  );
}

export default SettingsRoute;
