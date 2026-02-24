import React, {useState} from 'react';
import type {
  ProjectAISettings,
  AIProviderId,
  PromptToolKind
} from '../../entityTypes';
import styles from '../../assets/components/Settings/AISettingsForm.module.css';

interface AISettingsProps {
  aiSettings: ProjectAISettings;
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

export const AISettings: React.FC<AISettingsProps> = ({aiSettings, onSettingsChange}) => {
  const [anthropicKey, setAnthropicKey] = useState(() => localStorage.getItem('anthropic_api_key') || '');
  const [openaiKey, setOpenaiKey] = useState(() => localStorage.getItem('openai_api_key') || '');
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [toolName, setToolName] = useState('');
  const [toolKind, setToolKind] = useState<PromptToolKind>('persona');
  const [toolContent, setToolContent] = useState('');

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

  const handleAddPromptTool = () => {
    if (!toolName.trim() || !toolContent.trim()) return;
    const id = crypto.randomUUID();
    onSettingsChange({
      ...aiSettings,
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
      defaultToolIds: [...defaultToolIds, id]
    });
    setToolName('');
    setToolKind('persona');
    setToolContent('');
  };

  const handleDeletePromptTool = (toolId: string) => {
    onSettingsChange({
      ...aiSettings,
      promptTools: promptTools.filter((tool) => tool.id !== toolId),
      defaultToolIds: defaultToolIds.filter((id) => id !== toolId)
    });
  };

  const handleTogglePromptToolEnabled = (toolId: string, enabled: boolean) => {
    onSettingsChange({
      ...aiSettings,
      promptTools: promptTools.map((tool) =>
        tool.id === toolId ? {...tool, enabled} : tool
      ),
      defaultToolIds: enabled
        ? defaultToolIds
        : defaultToolIds.filter((id) => id !== toolId)
    });
  };

  const handleToggleDefaultTool = (toolId: string, checked: boolean) => {
    if (checked) {
      onSettingsChange({
        ...aiSettings,
        defaultToolIds: [...new Set([...defaultToolIds, toolId])]
      });
      return;
    }
    onSettingsChange({
      ...aiSettings,
      defaultToolIds: defaultToolIds.filter((id) => id !== toolId)
    });
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

        {promptTools.length === 0 ? (
          <p className={styles.help}>No prompt tools yet.</p>
        ) : (
          <ul className={styles.toolList}>
            {promptTools.map((tool) => (
              <li key={tool.id} className={styles.toolItem}>
                <div className={styles.toolHeader}>
                  <strong>{tool.name}</strong>
                  <span className={styles.toolKind}>
                    {PROMPT_TOOL_KIND_LABELS[tool.kind]}
                  </span>
                </div>
                <p className={styles.toolContent}>{tool.content}</p>
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
                      checked={defaultToolIds.includes(tool.id)}
                      disabled={!tool.enabled}
                      onChange={(e) =>
                        handleToggleDefaultTool(tool.id, e.target.checked)
                      }
                    />
                    Default Active
                  </label>
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
