import {useEffect, useState} from 'react';
import type {AIProviderId, ProjectAISettings} from '../entityTypes';
import {
  PROVIDER_DEFAULT_BASE_URLS,
  isHostedAIProvider,
  normalizeConfiguredModel,
  readActiveProviderConfig
} from '../services/llm/providerConfig';
import {
  testHostedProviderConnection,
  testLocalServerConnection,
  testOllamaConnection
} from '../services/llm/connectionTest';
import {
  clearProviderKey,
  getProviderKeyStatus,
  saveProviderKey,
  usesDesktopKeyVault,
  type HostedProviderId,
  type ProviderKeyStatus
} from '../services/llm/providerKeyStore';
import {describeError} from '../services/errors';
import {useProviderRoute} from './useProviderRoute';

export interface ProviderDiagnosticsState {
  tone: 'success' | 'error' | 'notice';
  summary: string;
  details: string[];
  detectedModels?: string[];
}

/**
 * AI provider setup in Settings: choosing the provider and model, typing,
 * saving, and removing hosted API keys, and testing the connection. Saved
 * keys are never read back; only whether each provider has one.
 */
export function useAIProviderSetup(
  aiSettings: ProjectAISettings,
  onSettingsChange: (aiSettings: ProjectAISettings) => void
) {
  // Drafts of keys being entered. Saved keys are never read back into the form.
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [keyStatus, setKeyStatus] = useState<ProviderKeyStatus | null>(null);
  const providerRoute = useProviderRoute(aiSettings);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [apiKeysSaved, setApiKeysSaved] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<ProviderDiagnosticsState | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProviderKeyStatus()
      .then((status) => {
        if (!cancelled) setKeyStatus(status);
      })
      .catch((error: unknown) => {
        if (!cancelled) setKeyError(describeError(error, 'Unable to check saved API keys.'));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const keyDrafts: Record<HostedProviderId, string> = {
    anthropic: anthropicKey,
    openai: openaiKey,
    gemini: geminiKey
  };
  const keyDraftSetters: Record<HostedProviderId, (value: string) => void> = {
    anthropic: setAnthropicKey,
    openai: setOpenaiKey,
    gemini: setGeminiKey
  };
  const keyStorageNote = usesDesktopKeyVault()
    ? 'Saved keys are encrypted by your operating system and are never shown again.'
    : 'In this browser build, saved keys stay in this browser\'s storage.';
  const hostedProvider = isHostedAIProvider(aiSettings.provider) ? aiSettings.provider : null;
  const {model: currentModel, baseUrl: currentBaseUrl} = readActiveProviderConfig(aiSettings);

  /** Saves the keys that were typed. A blank field keeps the saved key. */
  const handleSaveKeys = async () => {
    setKeyError(null);
    try {
      let status = keyStatus;
      for (const provider of ['anthropic', 'openai', 'gemini'] as const) {
        const draft = keyDrafts[provider].trim();
        if (!draft) continue;
        status = await saveProviderKey(provider, draft);
        keyDraftSetters[provider]('');
      }
      setKeyStatus(status ?? (await getProviderKeyStatus()));
      setApiKeysSaved(true);
    } catch (error) {
      setKeyError(describeError(error, 'Unable to save the API key.'));
    }
  };

  const handleRemoveKey = async (provider: HostedProviderId) => {
    setKeyError(null);
    setApiKeysSaved(false);
    try {
      setKeyStatus(await clearProviderKey(provider));
      keyDraftSetters[provider]('');
    } catch (error) {
      setKeyError(describeError(error, 'Unable to remove the API key.'));
    }
  };

  /** Updates a typed key; a saved-keys notice no longer applies. */
  const handleKeyDraftChange = (provider: HostedProviderId, value: string) => {
    keyDraftSetters[provider](value);
    setApiKeysSaved(false);
  };

  const handleProviderChange = (provider: AIProviderId) => {
    // A provider chosen for the first time starts with its default address, if it has one.
    const defaultBaseUrl = PROVIDER_DEFAULT_BASE_URLS[provider];
    const nextConfigs: ProjectAISettings['configs'] = aiSettings.configs[provider]
      ? {...aiSettings.configs}
      : {...aiSettings.configs, [provider]: defaultBaseUrl ? {baseUrl: defaultBaseUrl} : {}};

    setDiagnostics(null);

    onSettingsChange({
      ...aiSettings,
      provider,
      configs: nextConfigs
    });
  };

  const markDiagnosticsNeedsRerun = (model: string) => {
    setDiagnostics((prev) =>
      prev
        ? {
            tone: 'notice',
            summary: `Selected "${model || 'automatic model detection'}". Test the connection again to verify this configuration.`,
            details: [
              'The previous test result was for the old model setting.',
              'The model field has been updated, but this new configuration has not been checked yet.'
            ],
            detectedModels: prev.detectedModels
          }
        : prev
    );
  };

  const handleModelChange = (model: string, options?: {markDiagnosticsStale?: boolean}) => {
    const currentProvider = aiSettings.provider;
    onSettingsChange({
      ...aiSettings,
      configs: {
        ...aiSettings.configs,
        [currentProvider]: {
          ...aiSettings.configs[currentProvider],
          model: normalizeConfiguredModel(model)
        }
      }
    });
    if (options?.markDiagnosticsStale) {
      markDiagnosticsNeedsRerun(model.trim());
    }
  };

  const handleUseDetectedModel = (model: string) => {
    handleModelChange(model, {markDiagnosticsStale: true});
  };

  const handleTestConnection = async () => {
    const provider = aiSettings.provider;
    setIsRunningDiagnostics(true);
    setDiagnostics(null);

    const result =
      provider === 'ollama'
        ? await testOllamaConnection({baseUrl: currentBaseUrl, model: currentModel})
        : provider === 'local-openai'
          ? await testLocalServerConnection({baseUrl: currentBaseUrl, model: currentModel})
          : await testHostedProviderConnection({providerId: provider, apiKey: keyDrafts[provider], model: currentModel});

    setDiagnostics(result);
    setIsRunningDiagnostics(false);
    if (isHostedAIProvider(provider)) {
      // The desktop app saves a typed key before testing it.
      const status = await getProviderKeyStatus().catch(() => null);
      if (status) {
        setKeyStatus(status);
        if (status[provider] && usesDesktopKeyVault()) keyDraftSetters[provider]('');
      }
    }
  };

  return {
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
    isRunningDiagnostics,
    handleKeyDraftChange,
    handleSaveKeys,
    handleRemoveKey,
    handleProviderChange,
    handleModelChange,
    handleUseDetectedModel,
    handleTestConnection
  };
}

export type AIProviderSetupControls = ReturnType<typeof useAIProviderSetup>;
