import { useEffect, useState } from 'react';
import type { Project, ProjectSettings, CharacterStyle } from '../entityTypes';
import { getOrCreateSettings, saveProjectSettings } from '../settingsStorage';
import { CharacterStyleList } from '../components/CharacterStyleList';

interface SettingsRouteProps {
  activeProject: Project | null;
}

function SettingsRoute({ activeProject }: SettingsRouteProps) {
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
    setExpandedStyleId(newStyle.id); // Open the editor for the new style
  };

  const handleUpdateStyle = async (styleId: string, updates: Partial<CharacterStyle['styles']>) => {
    if (!settings) return;

    const updated: ProjectSettings = {
      ...settings,
      characterStyles: settings.characterStyles.map(s =>
        s.id === styleId
          ? { ...s, styles: { ...s.styles, ...updates } }
          : s
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
      characterStyles: settings.characterStyles.filter(s => s.id !== styleId),
      updatedAt: Date.now()
    };

    await saveProjectSettings(updated);
    setSettings(updated);
    if (expandedStyleId === styleId) {
      setExpandedStyleId(null);
    }
  };

  if (!activeProject) {
    return (
      <section>
        <h1>Settings</h1>
        <p>No active project. Select a project to configure settings.</p>
      </section>
    );
  }

  if (!settings) {
    return (
      <section>
        <h1>Settings</h1>
        <p>Loading...</p>
      </section>
    );
  }

  return (
    <section>
      <h1>Settings for {activeProject.name}</h1>

      <div style={{ marginTop: '2rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="text"
            value={newStyleName}
            onChange={(e) => setNewStyleName(e.target.value)}
            placeholder="Style name (e.g., Protagonist Thoughts)"
            style={{ marginRight: '0.5rem', width: '300px' }}
          />
          <button onClick={handleAddStyle}>Add Style</button>
        </div>

        <CharacterStyleList
          styles={settings.characterStyles}
          onUpdate={handleUpdateStyle}
          onDelete={handleDeleteStyle}
          expandedStyleId={expandedStyleId}
          onToggleExpand={setExpandedStyleId}
        />
      </div>
    </section>
  );
}

export default SettingsRoute;