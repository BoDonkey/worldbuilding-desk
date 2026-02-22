import {useEffect, useState} from 'react';
import type {Project, ProjectSettings, CharacterStyle, ProjectAISettings} from '../entityTypes';
import {getOrCreateSettings, saveProjectSettings} from '../settingsStorage';
import {CharacterStyleList} from '../components/CharacterStyleList';
import {AISettings} from '../components/Settings/AISettings';
import {FontSizeControl} from '../components/Settings/FontSizeControl';
import styles from '../styles/SettingsRoute.module.css';

interface SettingsRouteProps {
  activeProject: Project | null;
}

function SettingsRoute({activeProject}: SettingsRouteProps) {
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [newStyleName, setNewStyleName] = useState('');
  const [expandedStyleId, setExpandedStyleId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeProject) {
      setSettings(null);
      return;
    }

    let cancelled = false;

    (async () => {
      const projectSettings = await getOrCreateSettings(activeProject.id);
      if (!cancelled) {
        setSettings(projectSettings);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProject]);

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
