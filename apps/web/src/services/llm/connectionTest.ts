import type {AIProviderId, ProjectAISettings} from '../../entityTypes';
import {LLMService} from './LLMService';
import {PROVIDER_DEFAULT_BASE_URLS} from './providerConfig';
import {
  getProviderKeyStatus,
  readBrowserProviderKey,
  saveProviderKey,
  usesDesktopKeyVault
} from './providerKeyStore';

export interface ConnectionTestResult {
  tone: 'success' | 'error';
  summary: string;
  details: string[];
  detectedModels?: string[];
}

export const PROVIDER_DISPLAY_NAMES: Record<AIProviderId, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  ollama: 'Ollama'
};

/**
 * Turns a raw provider error into plain language, without guessing at
 * causes the message doesn't actually support. Recognized patterns map to
 * an actionable sentence; anything else is shown with the provider named
 * so the author at least knows where to look.
 */
export function describeConnectionTestError(providerId: AIProviderId, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const label = PROVIDER_DISPLAY_NAMES[providerId];

  if (/api key is missing/i.test(message)) return message;
  if (/\b(401|403)\b|unauthorized|forbidden|invalid[_ ]?api[_ ]?key/i.test(message)) {
    return `${label} rejected the key. Double-check that it is correct, active, and has not been revoked.`;
  }
  if (/\b429\b|rate.?limit/i.test(message)) {
    return `${label} rate-limited the test request. The key looks valid — try again in a moment.`;
  }
  if (/failed to fetch|networkerror|network request failed|econnrefused|enotfound|fetch failed/i.test(message)) {
    return `Could not reach ${label}. Check your internet connection and try again.`;
  }
  return `${label} test failed: ${message}`;
}

/**
 * One cheap real call — a single-token completion — to confirm the key and
 * model actually work. `apiKey` is what the author just typed, if anything;
 * a blank field tests the saved key. In the desktop app a typed key is saved
 * to the OS-encrypted store first, because the main process attaches keys.
 */
export async function testHostedProviderConnection(params: {
  providerId: 'anthropic' | 'openai' | 'gemini';
  apiKey: string;
  model?: string;
}): Promise<ConnectionTestResult> {
  const {providerId, apiKey, model} = params;
  const label = PROVIDER_DISPLAY_NAMES[providerId];
  const missing: ConnectionTestResult = {tone: 'error', summary: `${label} API key is missing.`, details: []};
  const typedKey = apiKey.trim();
  const desktop = usesDesktopKeyVault();
  let rendererKey: string | undefined;

  try {
    if (desktop) {
      if (typedKey) await saveProviderKey(providerId, typedKey);
      else if (!(await getProviderKeyStatus())[providerId]) return missing;
    } else {
      rendererKey = typedKey || readBrowserProviderKey(providerId);
      if (!rendererKey) return missing;
    }
  } catch (error) {
    return {tone: 'error', summary: describeConnectionTestError(providerId, error), details: []};
  }

  try {
    const settings = {
      provider: providerId,
      configs: {
        [providerId]: {apiKey: rendererKey, model: model?.trim() || undefined}
      },
      promptTools: [],
      defaultToolIds: []
    } as unknown as ProjectAISettings;
    const service = new LLMService(settings);
    await service.complete({
      messages: [{role: 'user', content: 'Reply with just the word OK.'}],
      maxTokens: 5
    });
    return {
      tone: 'success',
      summary: `${label} connection succeeded.`,
      details: [model?.trim() ? `Configured model: ${model.trim()}.` : 'Using the app default model.']
    };
  } catch (error) {
    return {tone: 'error', summary: describeConnectionTestError(providerId, error), details: []};
  }
}

/** Reachability plus locally-installed-model check — Ollama has no key to validate. */
export async function testOllamaConnection(params: {
  baseUrl?: string;
  model?: string;
}): Promise<ConnectionTestResult> {
  const baseUrl = (params.baseUrl?.trim() || PROVIDER_DEFAULT_BASE_URLS.ollama || 'http://localhost:11434').replace(
    /\/$/,
    ''
  );
  const model = params.model?.trim() ?? '';
  const details: string[] = [];

  try {
    const response = await fetch(`${baseUrl}/api/tags`);
    if (!response.ok) {
      throw new Error(`Ollama responded with ${response.status} ${response.statusText}.`);
    }
    const data = await response.json();
    const detectedModels: string[] = Array.isArray(data.models)
      ? data.models
          .map((entry: {name?: unknown}) => (typeof entry?.name === 'string' ? entry.name.trim() : ''))
          .filter(Boolean)
      : [];

    if (detectedModels.length === 0) {
      throw new Error('Connected to Ollama, but no local models are installed.');
    }

    details.push(`Connected to ${baseUrl}.`);
    details.push(`Detected ${detectedModels.length} installed model(s).`);
    const modelIsInstalled = !model || detectedModels.includes(model);
    if (model) {
      details.push(
        modelIsInstalled
          ? `Configured model "${model}" is installed.`
          : `Configured model "${model}" is not installed locally.`
      );
    } else {
      details.push(`No explicit model configured. The app will auto-detect "${detectedModels[0]}".`);
    }

    return {
      tone: modelIsInstalled ? 'success' : 'error',
      summary: modelIsInstalled
        ? 'Ollama connection succeeded.'
        : 'Ollama is reachable, but the configured model is not installed.',
      details,
      detectedModels
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const isNetworkFailure = /failed to fetch|networkerror|network request failed|econnrefused|enotfound|fetch failed/i.test(
      message
    );
    return {
      tone: 'error',
      summary: isNetworkFailure || !message
        ? `Could not reach Ollama at ${baseUrl}. Check that it is running.`
        : message,
      details
    };
  }
}
