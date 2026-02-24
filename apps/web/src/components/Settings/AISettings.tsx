import React, {useState} from 'react';
import type {ProjectAISettings, AIProviderId} from '../../entityTypes';
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

export const AISettings: React.FC<AISettingsProps> = ({aiSettings, onSettingsChange}) => {
  const [anthropicKey, setAnthropicKey] = useState(() => localStorage.getItem('anthropic_api_key') || '');
  const [openaiKey, setOpenaiKey] = useState(() => localStorage.getItem('openai_api_key') || '');

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

  return (
    <div className={styles.container}>
      <div className={styles.field}>
        <label className={styles.label}>Active Provider</label>
        <select
          className={styles.input}
          value={aiSettings.provider}
          onChange={(e) => handleProviderChange(e.target.value as AIProviderId)}
        >
          {(['anthropic', 'openai', 'ollama'] as AIProviderId[]).map((provider) => (
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

      <button onClick={handleSaveKeys} className={styles.saveButton}>
        Save API Keys
      </button>
    </div>
  );
};
