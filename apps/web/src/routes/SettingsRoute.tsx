import {useEffect, useState} from 'react';
import type {
  Project,
  ProjectSettings,
  CharacterStyle,
  ProjectAISettings,
  ProjectFeatureToggles,
  ProjectMode,
  WorkspaceImportMode
} from '../entityTypes';
import {
  getInheritedConsistencyActionCues,
  getOrCreateSettings,
  saveProjectSettings
} from '../settingsStorage';
import {CharacterStyleList} from '../components/CharacterStyleList';
import {AISettings} from '../components/Settings/AISettings';
import {FontSizeControl} from '../components/Settings/FontSizeControl';
import {EditorAppearanceControl} from '../components/Settings/EditorAppearanceControl';
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
  const [consistencyCuesDraft, setConsistencyCuesDraft] = useState('');
  const [inheritedConsistencyCues, setInheritedConsistencyCues] = useState<string[]>(
    []
  );

  useEffect(() => {
    if (!activeProject) {
      setSettings(null);
      onSettingsChanged?.(null);
      return;
    }

    let cancelled = false;

    (async () => {
      const projectSettings = await getOrCreateSettings(activeProject.id);
      const inheritedCues = await getInheritedConsistencyActionCues(activeProject);
      if (!cancelled) {
        setSettings(projectSettings);
        setConsistencyCuesDraft(projectSettings.consistencyActionCues.join('\n'));
        setInheritedConsistencyCues(inheritedCues);
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

  const handleConsistencyCueSave = async () => {
    if (!settings) return;
    const cues = consistencyCuesDraft
      .split('\n')
      .map((line) => line.trim().toLowerCase())
      .filter(Boolean);
    const unique = Array.from(new Set(cues));
    const updated: ProjectSettings = {
      ...settings,
      consistencyActionCues: unique,
      updatedAt: Date.now()
    };
    await saveProjectSettings(updated);
    setSettings(updated);
    setConsistencyCuesDraft(updated.consistencyActionCues.join('\n'));
    onSettingsChanged?.(updated);
  };

  const handleImportDefaultsChange = async (
    mode: WorkspaceImportMode,
    skipSuggestions: boolean
  ) => {
    if (!settings) return;
    const updated: ProjectSettings = {
      ...settings,
      defaultImportMode: mode,
      defaultSkipImportSuggestions: skipSuggestions,
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
          <p>
            Keyboard shortcut: press <strong>Cmd/Ctrl+K</strong> to open the
            command palette for fast navigation and workspace actions.
          </p>
        </div>
      </details>

      <div className={styles.settingsGrid}>
        {/* Accessibility Section */}
        <div className={styles.section}>
          <h2>Reading & Editor</h2>
          <FontSizeControl />
          <EditorAppearanceControl />
        </div>

        {/* AI Settings Section */}
        <div className={styles.section}>
          <h2>AI Settings</h2>
          <AISettings
            aiSettings={settings.aiSettings}
            projectMode={settings.projectMode}
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

        <div className={styles.section}>
          <h2>Consistency Detection Keywords</h2>
          <p className={styles.helperText}>
            These are action words the consistency checker should treat as signals that
            the nearby noun may matter to canon.
          </p>
          <p className={styles.helperText}>
            Example: if you add <strong>brew</strong>, then a phrase like
            <strong> "brewed the moon draught"</strong> is more likely to surface
            <strong> moon draught</strong> for review.
          </p>
          <p className={styles.helperText}>
            Only add verbs that are truly project-specific. Leave this short. Common
            verbs are already built in.
          </p>
          {inheritedConsistencyCues.length > 0 && (
            <p className={styles.helperText}>
              Inherited from parent project: {inheritedConsistencyCues.join(', ')}
            </p>
          )}
          <label className={styles.fieldLabel}>
            Extra project-specific verbs
            <textarea
              value={consistencyCuesDraft}
              onChange={(e) => setConsistencyCuesDraft(e.target.value)}
              placeholder={'brew\nattune\nchannel\ninvoke'}
              className={styles.cueTextarea}
            />
          </label>
          <div className={styles.helperList}>
            <div><strong>Good fits:</strong> attune, soulbind, overclock, transmute</div>
            <div><strong>Avoid:</strong> go, look, move, say, think</div>
          </div>
          <button onClick={() => void handleConsistencyCueSave()} className={styles.addButton}>
            Save Keywords
          </button>
        </div>

        <div className={styles.section}>
          <h2>Workspace Import Defaults</h2>
          <p className={styles.helperText}>
            These defaults pre-fill import controls in Writing Workspace. Authors can still
            override per import batch.
          </p>
          <label className={styles.fieldLabel}>
            Default import mode
            <select
              value={settings.defaultImportMode ?? 'balanced'}
              onChange={(e) =>
                void handleImportDefaultsChange(
                  e.target.value as WorkspaceImportMode,
                  settings.defaultSkipImportSuggestions ?? false
                )
              }
              className={styles.styleInput}
            >
              <option value='balanced'>Balanced</option>
              <option value='strict'>Strict</option>
              <option value='lenient'>Lenient</option>
            </select>
          </label>
          <label className={styles.toggleRow}>
            <input
              type='checkbox'
              checked={settings.defaultSkipImportSuggestions ?? false}
              onChange={(e) =>
                void handleImportDefaultsChange(
                  settings.defaultImportMode ?? 'balanced',
                  e.target.checked
                )
              }
            />
            <span>Default to skipping consistency suggestions during import</span>
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
