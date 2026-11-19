import type {AIProviderId, ProjectAISettings} from '../../entityTypes';
import styles from '../../assets/components/Settings/AISettingsForm.module.css';
import {isLocalAIProvider, PROVIDER_MODEL_PLACEHOLDERS} from '../../services/llm/providerConfig';
import type {HostedProviderId} from '../../services/llm/providerKeyStore';
import {AI_PROVIDER_LABELS} from '../../services/llm/providerLabels';
import type {AIProviderSetupControls} from '../../hooks/useAIProviderSetup';
import {InlineAlert} from '../common';
import {LocalServerAddressField} from './LocalServerFields';

const HOSTED_KEY_FIELDS: Record<HostedProviderId, {label: string; placeholder: string; href: string; site: string}> = {
  anthropic: {label: 'Anthropic API Key (Claude)', placeholder: 'sk-ant-...', href: 'https://console.anthropic.com', site: 'console.anthropic.com'},
  openai: {label: 'OpenAI API Key (GPT)', placeholder: 'sk-...', href: 'https://platform.openai.com', site: 'platform.openai.com'},
  gemini: {label: 'Gemini API Key', placeholder: 'AIza...', href: 'https://aistudio.google.com/app/apikey', site: 'Google AI Studio'}
};

/** Settings › AI › Setup: provider, model, API key, and the connection test. */
export function AIProviderSetupSection({
  setup,
  aiSettings,
  onSettingsChange
}: {
  setup: AIProviderSetupControls;
  aiSettings: ProjectAISettings;
  onSettingsChange: (aiSettings: ProjectAISettings) => void;
}) {
  const {
    providerRoute,
    hostedProvider,
    currentModel,
    currentBaseUrl,
    keyDrafts,
    keyStatus,
    keyStorageNote,
    apiKeysSaved,
    setApiKeysSaved,
    keyError,
    setKeyError,
    diagnostics,
    isRunningDiagnostics
  } = setup;

  const renderSavedKeyNote = (provider: HostedProviderId) =>
    keyStatus?.[provider] ? (
      <p className={styles.help}>
        A key is saved. Enter a new key to replace it, or{' '}
        <button type='button' className={styles.secondaryButton} onClick={() => void setup.handleRemoveKey(provider)}>
          Remove saved key
        </button>
      </p>
    ) : null;

  return (
    <div className={styles.toolsSection}>
      <h3 className={styles.toolsHeading}>Setup</h3>
      <div className={styles.field}>
        <label className={styles.label}>Provider</label>
        <select
          className={styles.input}
          value={aiSettings.provider}
          onChange={(e) => setup.handleProviderChange(e.target.value as AIProviderId)}
        >
          {(Object.keys(AI_PROVIDER_LABELS) as AIProviderId[]).map((provider) => (
            <option key={provider} value={provider}>
              {AI_PROVIDER_LABELS[provider]}
            </option>
          ))}
        </select>
        <p className={styles.help}>
          {providerRoute.kind === 'private-local'
            ? `${aiSettings.provider === 'local-openai' ? 'Your local model server' : 'Ollama'} runs entirely on your device with ${providerRoute.model ? `"${providerRoute.model}"` : aiSettings.provider === 'local-openai' ? 'the model it has loaded' : 'an installed local model'}. No story text ever leaves your computer.`
            : providerRoute.kind !== 'hosted'
              ? providerRoute.reason
              : `When you use the writing assistant, the necessary text is sent to ${AI_PROVIDER_LABELS[aiSettings.provider]}'s servers under that provider's terms — only when you invoke it, never in the background.`}
        </p>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Model</label>
        <input
          type='text'
          className={styles.input}
          value={currentModel}
          onChange={(e) => setup.handleModelChange(e.target.value, {markDiagnosticsStale: true})}
          placeholder={PROVIDER_MODEL_PLACEHOLDERS[aiSettings.provider]}
        />
        <p className={styles.help}>
          {aiSettings.provider === 'local-openai'
            ? 'Leave blank to use the first model the server lists, or the one it has loaded.'
            : `Leave blank to use the app default${aiSettings.provider === 'ollama' ? ' — Ollama will auto-detect an installed local model' : ''}.`}
        </p>
      </div>

      {aiSettings.provider === 'local-openai' && (
        <LocalServerAddressField aiSettings={aiSettings} onSettingsChange={onSettingsChange} value={currentBaseUrl} />
      )}

      {hostedProvider && (
        <div className={styles.field}>
          <label className={styles.label}>{HOSTED_KEY_FIELDS[hostedProvider].label}</label>
          <input
            type='password'
            value={keyDrafts[hostedProvider]}
            onChange={(e) => setup.handleKeyDraftChange(hostedProvider, e.target.value)}
            placeholder={keyStatus?.[hostedProvider] ? 'Saved key (hidden)' : HOSTED_KEY_FIELDS[hostedProvider].placeholder}
            autoComplete='off'
            className={styles.input}
          />
          <p className={styles.help}>
            Get your key from{' '}
            <a href={HOSTED_KEY_FIELDS[hostedProvider].href} target='_blank' rel='noopener noreferrer'>
              {HOSTED_KEY_FIELDS[hostedProvider].site}
            </a>
          </p>
          {renderSavedKeyNote(hostedProvider)}
        </div>
      )}

      {hostedProvider && <p className={styles.help}>{keyStorageNote}</p>}
      <div className={styles.apiKeyActions}>
        <button
          type='button'
          className={styles.secondaryButton}
          onClick={() => void setup.handleTestConnection()}
          disabled={isRunningDiagnostics}
        >
          {isRunningDiagnostics ? 'Testing connection...' : 'Test connection'}
        </button>
        {hostedProvider && (
          <>
            <button onClick={() => void setup.handleSaveKeys()} className={styles.saveButton}>
              Save API Keys
            </button>
            {apiKeysSaved && (
              <InlineAlert
                variant='success'
                message='API keys saved.'
                onDismiss={() => setApiKeysSaved(false)}
                autoDismissMs={4000}
              />
            )}
            {keyError && (
              <InlineAlert variant='error' message={keyError} onDismiss={() => setKeyError(null)} />
            )}
          </>
        )}
      </div>

      {diagnostics && (
        <div
          className={`${styles.diagnosticsPanel} ${
            diagnostics.tone === 'error'
              ? styles.diagnosticsError
              : diagnostics.tone === 'notice'
                ? styles.diagnosticsNotice
                : styles.diagnosticsSuccess
          }`}
        >
          <strong>{diagnostics.summary}</strong>
          <ul>
            {diagnostics.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
          {isLocalAIProvider(aiSettings.provider) && diagnostics.detectedModels?.length ? (
            <div className={styles.detectedModelActions}>
              {diagnostics.detectedModels.map((model) => (
                <button
                  key={model}
                  type='button'
                  className={styles.secondaryButton}
                  onClick={() => setup.handleUseDetectedModel(model)}
                >
                  Use {model}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
