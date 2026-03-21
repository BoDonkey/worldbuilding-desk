import React, {useEffect, useState} from 'react';
import type {
  ProjectAISettings,
  AIProviderId,
  PromptToolKind,
  PromptTool,
  ProjectMode
} from '../../entityTypes';
import styles from '../../assets/components/Settings/AISettingsForm.module.css';

interface AISettingsProps {
  aiSettings: ProjectAISettings;
  projectMode: ProjectMode;
  onSettingsChange: (aiSettings: ProjectAISettings) => void;
}

const PROVIDER_LABELS: Record<AIProviderId, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI (GPT)',
  gemini: 'Google Gemini',
  ollama: 'Ollama (Local)'
};

const PROVIDER_DEFAULT_MODELS: Record<AIProviderId, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
  ollama: 'llama3.1'
};

const PROVIDER_DEFAULT_BASE_URL: Partial<Record<AIProviderId, string>> = {
  ollama: 'http://localhost:11434'
};

const PROMPT_TOOL_KIND_LABELS: Record<PromptToolKind, string> = {
  style: 'Style Guide',
  tone: 'Tone Guide',
  persona: 'AI Persona',
  instruction: 'Instruction'
};

interface PromptToolPack {
  schemaVersion: 1;
  tools: PromptTool[];
  defaultToolIdsByMode?: Record<ProjectMode, string[]>;
}

interface PromptToolPreset {
  id: string;
  name: string;
  kind: PromptToolKind;
  summary: string;
  recommendedModes: ProjectMode[];
  content: string;
}

const PROJECT_MODE_LABELS: Record<ProjectMode, string> = {
  litrpg: 'LitRPG',
  game: 'Game',
  general: 'General'
};

const PERSONA_PRESETS: PromptToolPreset[] = [
  {
    id: 'preset-writing-critic',
    name: 'Writing Critic',
    kind: 'persona',
    summary:
      'A rigorous critique persona for scenes and chapters. It prioritizes structural clarity, pacing, emotional effect, and precise revision notes.',
    recommendedModes: ['general', 'litrpg', 'game'],
    content:
      [
        'Respond as a rigorous writing critic for fiction drafts.',
        '',
        'Priorities:',
        '- identify the highest-impact problems first',
        '- focus on clarity, pacing, scene structure, emotional payoff, and voice consistency',
        '- distinguish between major structural issues and line-level polish',
        '- avoid vague praise or generic encouragement',
        '',
        'Response format:',
        '1. Quick verdict',
        '2. Top 3 issues',
        '3. Specific examples',
        '4. Revision priorities',
        '',
        'Behavior rules:',
        '- quote only short snippets when necessary',
        '- give actionable revision guidance, not just diagnosis',
        '- if the passage is working, say what is working and why',
        '- do not rewrite the whole passage unless explicitly asked'
      ].join('\n')
  }
];

export const AISettings: React.FC<AISettingsProps> = ({
  aiSettings,
  projectMode,
  onSettingsChange
}) => {
  const [anthropicKey, setAnthropicKey] = useState(() => localStorage.getItem('anthropic_api_key') || '');
  const [openaiKey, setOpenaiKey] = useState(() => localStorage.getItem('openai_api_key') || '');
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [toolName, setToolName] = useState('');
  const [toolKind, setToolKind] = useState<PromptToolKind>('persona');
  const [toolContent, setToolContent] = useState('');
  const [editingToolId, setEditingToolId] = useState<string | null>(null);
  const [editingToolName, setEditingToolName] = useState('');
  const [editingToolKind, setEditingToolKind] = useState<PromptToolKind>('persona');
  const [editingToolContent, setEditingToolContent] = useState('');
  const [defaultsMode, setDefaultsMode] = useState<ProjectMode>(projectMode);

  useEffect(() => {
    setDefaultsMode(projectMode);
  }, [projectMode]);

  const handleSaveKeys = () => {
    if (anthropicKey) {
      localStorage.setItem('anthropic_api_key', anthropicKey);
    } else {
      localStorage.removeItem('anthropic_api_key');
    }

    if (openaiKey) {
      localStorage.setItem('openai_api_key', openaiKey);
    } else {
      localStorage.removeItem('openai_api_key');
    }

    if (geminiKey) {
      localStorage.setItem('gemini_api_key', geminiKey);
    } else {
      localStorage.removeItem('gemini_api_key');
    }

    alert('API keys saved');
  };

  const handleProviderChange = (provider: AIProviderId) => {
    const nextConfigs = {...aiSettings.configs};
    if (!nextConfigs[provider]) {
      nextConfigs[provider] = {
        model: PROVIDER_DEFAULT_MODELS[provider],
        ...(PROVIDER_DEFAULT_BASE_URL[provider] ? {baseUrl: PROVIDER_DEFAULT_BASE_URL[provider]} : {})
      } as any;
    }

    onSettingsChange({
      ...aiSettings,
      provider,
      configs: nextConfigs
    });
  };

  const handleModelChange = (model: string) => {
    const currentProvider = aiSettings.provider;
    onSettingsChange({
      ...aiSettings,
      configs: {
        ...aiSettings.configs,
        [currentProvider]: {
          ...aiSettings.configs[currentProvider],
          model: model.trim() || PROVIDER_DEFAULT_MODELS[currentProvider]
        }
      }
    });
  };

  const currentProviderConfig = aiSettings.configs[aiSettings.provider] ?? {};
  const currentModel = currentProviderConfig.model ?? PROVIDER_DEFAULT_MODELS[aiSettings.provider];
  const currentBaseUrl =
    (currentProviderConfig as {baseUrl?: string}).baseUrl ??
    PROVIDER_DEFAULT_BASE_URL[aiSettings.provider];
  const promptTools = aiSettings.promptTools ?? [];
  const defaultToolIds = aiSettings.defaultToolIds ?? [];
  const defaultToolIdsByMode = aiSettings.defaultToolIdsByMode ?? {
    litrpg: [...defaultToolIds],
    game: [...defaultToolIds],
    general: [...defaultToolIds]
  };
  const defaultsForSelectedMode =
    defaultToolIdsByMode[defaultsMode] ?? defaultToolIds;
  const inspectorSettings = aiSettings.inspectorSettings ?? {
    enableAIConsultation: true,
    maxConsultationsPerDay: 20,
    maxContextChars: 1800,
    maxResponseTokens: 500,
    lowCostModel: ''
  };

  const withDefaultModes = (
    updates: Partial<ProjectAISettings>
  ): ProjectAISettings => ({
    ...aiSettings,
    ...updates,
    defaultToolIdsByMode: {
      ...defaultToolIdsByMode,
      ...(updates.defaultToolIdsByMode ?? {})
    }
  });

  const triggerJsonDownload = (fileName: string, data: unknown) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleAddPromptTool = () => {
    if (!toolName.trim() || !toolContent.trim()) return;
    const id = crypto.randomUUID();
    onSettingsChange(
      withDefaultModes({
        promptTools: [
          ...promptTools,
          {
            id,
            name: toolName.trim(),
            kind: toolKind,
            content: toolContent.trim(),
            enabled: true
          }
        ],
        defaultToolIds: [...new Set([...defaultToolIds, id])],
        defaultToolIdsByMode: {
          ...defaultToolIdsByMode,
          [defaultsMode]: [...new Set([...defaultsForSelectedMode, id])]
        }
      })
    );
    setToolName('');
    setToolKind('persona');
    setToolContent('');
  };

  const handleDeletePromptTool = (toolId: string) => {
    onSettingsChange(
      withDefaultModes({
        promptTools: promptTools.filter((tool) => tool.id !== toolId),
        defaultToolIds: defaultToolIds.filter((id) => id !== toolId),
        defaultToolIdsByMode: {
          litrpg: (defaultToolIdsByMode.litrpg ?? []).filter((id) => id !== toolId),
          game: (defaultToolIdsByMode.game ?? []).filter((id) => id !== toolId),
          general: (defaultToolIdsByMode.general ?? []).filter((id) => id !== toolId)
        }
      })
    );
  };

  const handleStartEditTool = (tool: PromptTool) => {
    setEditingToolId(tool.id);
    setEditingToolName(tool.name);
    setEditingToolKind(tool.kind);
    setEditingToolContent(tool.content);
  };

  const handleCancelEditTool = () => {
    setEditingToolId(null);
    setEditingToolName('');
    setEditingToolKind('persona');
    setEditingToolContent('');
  };

  const handleSaveEditTool = (toolId: string) => {
    if (!editingToolName.trim() || !editingToolContent.trim()) return;
    onSettingsChange({
      ...aiSettings,
      promptTools: promptTools.map((tool) =>
        tool.id === toolId
          ? {
              ...tool,
              name: editingToolName.trim(),
              kind: editingToolKind,
              content: editingToolContent.trim()
            }
          : tool
      )
    });
    handleCancelEditTool();
  };

  const handleTogglePromptToolEnabled = (toolId: string, enabled: boolean) => {
    onSettingsChange(
      withDefaultModes({
        promptTools: promptTools.map((tool) =>
          tool.id === toolId ? {...tool, enabled} : tool
        ),
        defaultToolIds: enabled
          ? defaultToolIds
          : defaultToolIds.filter((id) => id !== toolId),
        defaultToolIdsByMode: enabled
          ? defaultToolIdsByMode
          : {
              litrpg: (defaultToolIdsByMode.litrpg ?? []).filter((id) => id !== toolId),
              game: (defaultToolIdsByMode.game ?? []).filter((id) => id !== toolId),
              general: (defaultToolIdsByMode.general ?? []).filter((id) => id !== toolId)
            }
      })
    );
  };

  const handleToggleDefaultTool = (toolId: string, checked: boolean) => {
    const nextModeDefaults = checked
      ? [...new Set([...(defaultToolIdsByMode[defaultsMode] ?? []), toolId])]
      : (defaultToolIdsByMode[defaultsMode] ?? []).filter((id) => id !== toolId);

    if (checked) {
      onSettingsChange(
        withDefaultModes({
          defaultToolIds: defaultsMode === projectMode
            ? [...new Set([...defaultToolIds, toolId])]
            : defaultToolIds,
          defaultToolIdsByMode: {
            ...defaultToolIdsByMode,
            [defaultsMode]: nextModeDefaults
          }
        })
      );
      return;
    }
    onSettingsChange(
      withDefaultModes({
        defaultToolIds:
          defaultsMode === projectMode
            ? defaultToolIds.filter((id) => id !== toolId)
            : defaultToolIds,
        defaultToolIdsByMode: {
          ...defaultToolIdsByMode,
          [defaultsMode]: nextModeDefaults
        }
      })
    );
  };

  const handleInstallPreset = (preset: PromptToolPreset) => {
    const existingNames = new Set(
      promptTools.map((tool) => tool.name.trim().toLowerCase())
    );
    if (existingNames.has(preset.name.trim().toLowerCase())) {
      alert(`${preset.name} is already installed.`);
      return;
    }

    const installedTool: PromptTool = {
      id: crypto.randomUUID(),
      name: preset.name,
      kind: preset.kind,
      content: preset.content,
      enabled: true
    };

    onSettingsChange(
      withDefaultModes({
        promptTools: [...promptTools, installedTool],
        defaultToolIds:
          defaultsMode === projectMode
            ? [...new Set([...defaultToolIds, installedTool.id])]
            : defaultToolIds,
        defaultToolIdsByMode: {
          ...defaultToolIdsByMode,
          [defaultsMode]: [
            ...new Set([...(defaultToolIdsByMode[defaultsMode] ?? []), installedTool.id])
          ]
        }
      })
    );
  };

  const handleExportToolPack = () => {
    const pack: PromptToolPack = {
      schemaVersion: 1,
      tools: promptTools,
      defaultToolIdsByMode
    };
    triggerJsonDownload('prompt-tools-pack.json', pack);
  };

  const handleImportToolPack = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as Partial<PromptToolPack>;
      if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.tools)) {
        throw new Error('Invalid tool pack format.');
      }
      const idMap = new Map<string, string>();
      const importedTools = parsed.tools
        .filter((tool) => tool && typeof tool.name === 'string' && typeof tool.content === 'string')
        .map((tool) => {
          const nextId = crypto.randomUUID();
          if (typeof tool.id === 'string') {
            idMap.set(tool.id, nextId);
          }
          return {
            id: nextId,
            name: tool.name,
            kind: (tool.kind as PromptToolKind) || 'instruction',
            content: tool.content,
            enabled: tool.enabled !== false
          };
        }) as PromptTool[];

      if (importedTools.length === 0) {
        throw new Error('No valid tools found in pack.');
      }

      const replace = window.confirm(
        'Replace existing prompt tools with imported tools?\n\nChoose Cancel to append imported tools.'
      );

      if (replace) {
        const enabledImportedIds = importedTools
          .filter((tool) => tool.enabled)
          .map((tool) => tool.id);
        const importedDefaultsByMode = parsed.defaultToolIdsByMode ?? {
          litrpg: enabledImportedIds,
          game: enabledImportedIds,
          general: enabledImportedIds
        };
        const validImportedIds = new Set(enabledImportedIds);
        const remapModeDefaults = (ids: string[] | undefined): string[] =>
          (ids ?? [])
            .map((id) => idMap.get(id) ?? id)
            .filter((id) => validImportedIds.has(id));
        const normalizedImportedDefaultsByMode: Record<ProjectMode, string[]> = {
          litrpg:
            remapModeDefaults(importedDefaultsByMode.litrpg).length > 0
              ? remapModeDefaults(importedDefaultsByMode.litrpg)
              : enabledImportedIds,
          game:
            remapModeDefaults(importedDefaultsByMode.game).length > 0
              ? remapModeDefaults(importedDefaultsByMode.game)
              : enabledImportedIds,
          general:
            remapModeDefaults(importedDefaultsByMode.general).length > 0
              ? remapModeDefaults(importedDefaultsByMode.general)
              : enabledImportedIds
        };
        onSettingsChange(
          withDefaultModes({
            promptTools: importedTools,
            defaultToolIds:
              defaultsMode === projectMode ? enabledImportedIds : defaultToolIds,
            defaultToolIdsByMode: normalizedImportedDefaultsByMode
          })
        );
      } else {
        const enabledImportedIds = importedTools
          .filter((tool) => tool.enabled)
          .map((tool) => tool.id);
        onSettingsChange(
          withDefaultModes({
            promptTools: [...promptTools, ...importedTools],
            defaultToolIds: [
              ...new Set([
                ...defaultToolIds,
                ...enabledImportedIds
              ])
            ],
            defaultToolIdsByMode: {
              ...defaultToolIdsByMode,
              [defaultsMode]: [
                ...new Set([
                  ...(defaultToolIdsByMode[defaultsMode] ?? []),
                  ...enabledImportedIds
                ])
              ]
            }
          })
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to import tool pack.';
      alert(message);
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.field}>
        <label className={styles.label}>Active Provider</label>
        <select
          className={styles.input}
          value={aiSettings.provider}
          onChange={(e) => handleProviderChange(e.target.value as AIProviderId)}
        >
          {(['anthropic', 'openai', 'gemini', 'ollama'] as AIProviderId[]).map((provider) => (
            <option key={provider} value={provider}>
              {PROVIDER_LABELS[provider]}
            </option>
          ))}
        </select>
        <p className={styles.help}>
          Choose which LLM provider the writing assistant should use. Additional providers will be added over time.
        </p>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Default Model</label>
        <input
          type='text'
          className={styles.input}
          value={currentModel}
          onChange={(e) => handleModelChange(e.target.value)}
          placeholder={PROVIDER_DEFAULT_MODELS[aiSettings.provider]}
        />
        <p className={styles.help}>Override the default model used for this provider.</p>
      </div>

      <div className={styles.toolsSection}>
        <h3 className={styles.toolsHeading}>Lore Inspector AI Guardrails</h3>
        <label className={styles.field}>
          <span className={styles.label}>
            <input
              type='checkbox'
              checked={inspectorSettings.enableAIConsultation}
              onChange={(e) =>
                onSettingsChange({
                  ...aiSettings,
                  inspectorSettings: {
                    ...inspectorSettings,
                    enableAIConsultation: e.target.checked
                  }
                })
              }
            />{' '}
            Enable AI consultation actions in Lore Inspector
          </span>
        </label>
        <div className={styles.field}>
          <label className={styles.label}>Max consultations per day</label>
          <input
            type='number'
            className={styles.input}
            min={1}
            value={inspectorSettings.maxConsultationsPerDay}
            onChange={(e) =>
              onSettingsChange({
                ...aiSettings,
                inspectorSettings: {
                  ...inspectorSettings,
                  maxConsultationsPerDay: Math.max(1, Number(e.target.value) || 20)
                }
              })
            }
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Max context chars per request</label>
          <input
            type='number'
            className={styles.input}
            min={300}
            value={inspectorSettings.maxContextChars}
            onChange={(e) =>
              onSettingsChange({
                ...aiSettings,
                inspectorSettings: {
                  ...inspectorSettings,
                  maxContextChars: Math.max(300, Number(e.target.value) || 1800)
                }
              })
            }
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Max response tokens</label>
          <input
            type='number'
            className={styles.input}
            min={100}
            value={inspectorSettings.maxResponseTokens}
            onChange={(e) =>
              onSettingsChange({
                ...aiSettings,
                inspectorSettings: {
                  ...inspectorSettings,
                  maxResponseTokens: Math.max(100, Number(e.target.value) || 500)
                }
              })
            }
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Low-cost model override (optional)</label>
          <input
            type='text'
            className={styles.input}
            value={inspectorSettings.lowCostModel ?? ''}
            onChange={(e) =>
              onSettingsChange({
                ...aiSettings,
                inspectorSettings: {
                  ...inspectorSettings,
                  lowCostModel: e.target.value
                }
              })
            }
            placeholder='e.g., gpt-4o-mini'
          />
        </div>
      </div>

      {aiSettings.provider === 'ollama' && (
        <div className={styles.field}>
          <label className={styles.label}>Ollama Base URL</label>
          <input
            type='text'
            className={styles.input}
            value={currentBaseUrl ?? ''}
            onChange={(e) =>
              onSettingsChange({
                ...aiSettings,
                configs: {
                  ...aiSettings.configs,
                  ollama: {
                    ...aiSettings.configs.ollama,
                    baseUrl: e.target.value || PROVIDER_DEFAULT_BASE_URL.ollama
                  }
                }
              })
            }
            placeholder={PROVIDER_DEFAULT_BASE_URL.ollama}
          />
          <p className={styles.help}>Point to the user’s Ollama instance (default localhost).</p>
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.label}>Anthropic API Key (Claude)</label>
        <input
          type='password'
          value={anthropicKey}
          onChange={(e) => setAnthropicKey(e.target.value)}
          placeholder='sk-ant-...'
          className={styles.input}
        />
        <p className={styles.help}>
          Get your key from{' '}
          <a href='https://console.anthropic.com' target='_blank' rel='noopener noreferrer'>
            console.anthropic.com
          </a>
        </p>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>OpenAI API Key (GPT & embeddings)</label>
        <input
          type='password'
          value={openaiKey}
          onChange={(e) => setOpenaiKey(e.target.value)}
          placeholder='sk-...'
          className={styles.input}
        />
        <p className={styles.help}>
          Get your key from{' '}
          <a href='https://platform.openai.com' target='_blank' rel='noopener noreferrer'>
            platform.openai.com
          </a>
        </p>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Gemini API Key</label>
        <input
          type='password'
          value={geminiKey}
          onChange={(e) => setGeminiKey(e.target.value)}
          placeholder='AIza...'
          className={styles.input}
        />
        <p className={styles.help}>
          Get your key from{' '}
          <a href='https://aistudio.google.com/app/apikey' target='_blank' rel='noopener noreferrer'>
            Google AI Studio
          </a>
        </p>
      </div>

      <button onClick={handleSaveKeys} className={styles.saveButton}>
        Save API Keys
      </button>

      <div className={styles.toolsSection}>
        <h3 className={styles.toolsHeading}>Prompt Tools</h3>
        <p className={styles.help}>
          Add reusable prompt tools like tone guides, personas, and instruction
          blocks. These can be selected in the AI assistant.
        </p>
        <div className={styles.presetGrid}>
          {PERSONA_PRESETS.map((preset) => {
            const installed = promptTools.some(
              (tool) => tool.name.trim().toLowerCase() === preset.name.trim().toLowerCase()
            );
            return (
              <div key={preset.id} className={styles.presetCard}>
                <div className={styles.toolHeader}>
                  <strong>{preset.name}</strong>
                  <span className={styles.toolKind}>
                    {PROMPT_TOOL_KIND_LABELS[preset.kind]}
                  </span>
                </div>
                <p className={styles.presetSummary}>{preset.summary}</p>
                <p className={styles.help}>
                  Best fit for: {preset.recommendedModes.map((mode) => PROJECT_MODE_LABELS[mode]).join(', ')}
                </p>
                <button
                  type='button'
                  className={styles.secondaryButton}
                  onClick={() => handleInstallPreset(preset)}
                  disabled={installed}
                >
                  {installed ? 'Installed' : `Install for ${PROJECT_MODE_LABELS[defaultsMode]}`}
                </button>
              </div>
            );
          })}
        </div>
        <div className={styles.modeDefaultsHeader}>
          <label className={styles.label}>
            Configure Default Active tools for mode
            <select
              className={styles.input}
              value={defaultsMode}
              onChange={(e) => setDefaultsMode(e.target.value as ProjectMode)}
            >
              {(['litrpg', 'game', 'general'] as ProjectMode[]).map((mode) => (
                <option key={mode} value={mode}>
                  {PROJECT_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </label>
          <p className={styles.help}>
            The AI assistant preselects tools using this mode’s defaults.
          </p>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Tool Name</label>
          <input
            type='text'
            className={styles.input}
            value={toolName}
            onChange={(e) => setToolName(e.target.value)}
            placeholder='e.g., Literary Critic Persona'
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Tool Type</label>
          <select
            className={styles.input}
            value={toolKind}
            onChange={(e) => setToolKind(e.target.value as PromptToolKind)}
          >
            {Object.entries(PROMPT_TOOL_KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Tool Instructions</label>
          <textarea
            className={styles.textarea}
            value={toolContent}
            onChange={(e) => setToolContent(e.target.value)}
            placeholder='Describe the voice, constraints, and evaluation criteria for this tool.'
          />
        </div>

        <button
          type='button'
          className={styles.saveButton}
          onClick={handleAddPromptTool}
          disabled={!toolName.trim() || !toolContent.trim()}
        >
          Add Prompt Tool
        </button>
        <div className={styles.toolPackActions}>
          <button type='button' className={styles.secondaryButton} onClick={handleExportToolPack}>
            Export Tool Pack
          </button>
          <label className={styles.secondaryButton}>
            Import Tool Pack
            <input
              type='file'
              accept='.json,application/json'
              onChange={(e) => void handleImportToolPack(e)}
              style={{display: 'none'}}
            />
          </label>
        </div>

        {promptTools.length === 0 ? (
          <p className={styles.help}>No prompt tools yet.</p>
        ) : (
          <ul className={styles.toolList}>
            {promptTools.map((tool) => (
              <li key={tool.id} className={styles.toolItem}>
                {editingToolId === tool.id ? (
                  <div className={styles.editPanel}>
                    <div className={styles.field}>
                      <label className={styles.label}>Tool Name</label>
                      <input
                        type='text'
                        className={styles.input}
                        value={editingToolName}
                        onChange={(e) => setEditingToolName(e.target.value)}
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Tool Type</label>
                      <select
                        className={styles.input}
                        value={editingToolKind}
                        onChange={(e) => setEditingToolKind(e.target.value as PromptToolKind)}
                      >
                        {Object.entries(PROMPT_TOOL_KIND_LABELS).map(([value, label]) => (
                          <option key={`edit-${value}`} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Tool Instructions</label>
                      <textarea
                        className={styles.textarea}
                        value={editingToolContent}
                        onChange={(e) => setEditingToolContent(e.target.value)}
                      />
                    </div>
                    <div className={styles.toolPackActions}>
                      <button
                        type='button'
                        className={styles.secondaryButton}
                        onClick={() => handleSaveEditTool(tool.id)}
                      >
                        Save Changes
                      </button>
                      <button
                        type='button'
                        className={styles.secondaryButton}
                        onClick={handleCancelEditTool}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={styles.toolHeader}>
                      <strong>{tool.name}</strong>
                      <span className={styles.toolKind}>
                        {PROMPT_TOOL_KIND_LABELS[tool.kind]}
                      </span>
                    </div>
                    <p className={styles.toolContent}>{tool.content}</p>
                  </>
                )}
                <div className={styles.toolActions}>
                  <label>
                    <input
                      type='checkbox'
                      checked={tool.enabled}
                      onChange={(e) =>
                        handleTogglePromptToolEnabled(tool.id, e.target.checked)
                      }
                    />
                    Enabled
                  </label>
                  <label>
                    <input
                      type='checkbox'
                      checked={defaultsForSelectedMode.includes(tool.id)}
                      disabled={!tool.enabled}
                      onChange={(e) =>
                        handleToggleDefaultTool(tool.id, e.target.checked)
                      }
                    />
                    Default Active ({PROJECT_MODE_LABELS[defaultsMode]})
                  </label>
                  <button
                    type='button'
                    className={styles.secondaryButton}
                    onClick={() => handleStartEditTool(tool)}
                    disabled={editingToolId === tool.id}
                  >
                    Edit
                  </button>
                  <button
                    type='button'
                    className={styles.deleteButton}
                    onClick={() => handleDeletePromptTool(tool.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
