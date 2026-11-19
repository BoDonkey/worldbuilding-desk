import type {ReactNode} from 'react';
import type {ProjectAISettings} from '../../entityTypes';
import styles from '../../assets/components/Settings/AISettingsForm.module.css';
import {PROVIDER_DEFAULT_BASE_URLS} from '../../services/llm/providerConfig';
import {LocalServerReplyLengthField} from './LocalServerFields';
import {ModelContextFields} from './ModelContextFields';

/**
 * Settings › AI › advanced settings, behind a show/hide toggle: the local
 * server's reply length or Ollama's address, model context, and then
 * `children` (the AI guardrails). `AISettings` keeps the open state so it
 * survives turning the AI switches off and on.
 */
export function AIAdvancedSettingsSection({
  aiSettings,
  onSettingsChange,
  proseEnabled,
  currentBaseUrl,
  showAdvanced,
  onToggleAdvanced,
  children
}: {
  aiSettings: ProjectAISettings;
  onSettingsChange: (aiSettings: ProjectAISettings) => void;
  proseEnabled: boolean;
  currentBaseUrl: string | undefined;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  children: ReactNode;
}) {
  return (
    <div className={styles.toolsSection}>
      <button
        type='button'
        className={styles.secondaryButton}
        onClick={onToggleAdvanced}
        aria-expanded={showAdvanced}
      >
        {showAdvanced ? 'Hide advanced settings' : 'Show advanced settings'}
      </button>

      {showAdvanced && (
        <>
          {aiSettings.provider === 'local-openai' && (
            <LocalServerReplyLengthField aiSettings={aiSettings} onSettingsChange={onSettingsChange} />
          )}
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
                        baseUrl: e.target.value || PROVIDER_DEFAULT_BASE_URLS.ollama
                      }
                    }
                  })
                }
                placeholder={PROVIDER_DEFAULT_BASE_URLS.ollama}
              />
              <p className={styles.help}>
                Only needed if Ollama runs somewhere other than this computer (default localhost).
              </p>
            </div>
          )}

          <ModelContextFields
            aiSettings={aiSettings}
            proseEnabled={proseEnabled}
            onSettingsChange={onSettingsChange}
          />

          {children}
        </>
      )}
    </div>
  );
}
