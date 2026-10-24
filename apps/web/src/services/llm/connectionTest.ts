import type {AIProviderId, ProjectAISettings} from '../../entityTypes';
import {LLMService} from './LLMService';
import {PROVIDER_DEFAULT_BASE_URLS} from './providerConfig';
import {isLoopbackUrl, parseOllamaTags, resolveLocalOllamaModel} from './providerRoute';
import {LOCAL_SERVER_RESPONSE_LIMIT_MESSAGE, listLocalServerModels, localServerApiBase} from './localServer';
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
  ollama: 'Ollama',
  'local-openai': 'The local model server'
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

  if (!isLoopbackUrl(baseUrl)) {
    return {
      tone: 'error',
      summary: 'Ollama must run on this computer (localhost or 127.0.0.1). Remote Ollama addresses are blocked.',
      details
    };
  }

  try {
    const response = await fetch(`${baseUrl}/api/tags`);
    if (!response.ok) {
      throw new Error(`Ollama responded with ${response.status} ${response.statusText}.`);
    }
    const installed = parseOllamaTags(await response.json());
    const localModels = installed.filter((entry) => !entry.cloud).map((entry) => entry.name);
    const cloudCount = installed.length - localModels.length;

    if (localModels.length === 0) {
      throw new Error(
        cloudCount > 0
          ? 'Connected to Ollama, but only cloud models are installed. Pull a local model to keep your text on this computer.'
          : 'Connected to Ollama, but no local models are installed.'
      );
    }

    details.push(`Connected to ${baseUrl}.`);
    details.push(`Detected ${localModels.length} installed model(s).`);
    if (cloudCount > 0) details.push(`${cloudCount} Ollama cloud model(s) are hidden because they run off this computer.`);

    const resolution = resolveLocalOllamaModel(installed, model || undefined);
    if (model) {
      details.push(resolution.ok ? `Configured model "${model}" is installed.` : resolution.reason);
    } else if (resolution.ok) {
      details.push(`No explicit model configured. The app will auto-detect "${resolution.model}".`);
    }

    return {
      tone: resolution.ok ? 'success' : 'error',
      summary: resolution.ok
        ? 'Ollama connection succeeded.'
        : resolution.kind === 'ollama-cloud'
          ? 'Ollama is reachable, but the configured model is an Ollama cloud model. Private mode blocks it.'
          : 'Ollama is reachable, but the configured model is not installed.',
      details,
      detectedModels: localModels
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

/**
 * Lists the server's models where it offers a listing, then sends one
 * single-token chat request, because some servers answer `/models` without a
 * model loaded. Requests go only to a loopback address.
 */
export async function testLocalServerConnection(params: {
  baseUrl?: string;
  model?: string;
}): Promise<ConnectionTestResult> {
  const apiBase = localServerApiBase(params.baseUrl);
  const model = params.model?.trim() ?? '';
  const details: string[] = [];

  if (!isLoopbackUrl(apiBase)) {
    return {
      tone: 'error',
      summary: 'The local model server must run on this computer (localhost or 127.0.0.1). Remote addresses are blocked.',
      details
    };
  }

  const listed = await listLocalServerModels(apiBase).catch(() => null);
  if (listed?.length) {
    details.push(`The server lists ${listed.length} model(s).`);
    if (model && !listed.includes(model)) {
      details.push(`"${model}" is not in that list. Some servers accept any name and use their loaded model.`);
    }
  } else {
    details.push('The server did not list its models, so it will use whichever model it has loaded.');
  }

  try {
    const service = new LLMService({
      provider: 'local-openai',
      configs: {'local-openai': {baseUrl: params.baseUrl, model: model || undefined}},
      promptTools: [],
      defaultToolIds: []
    });
    await service.complete({
      messages: [{role: 'user', content: 'Reply with just the word OK.'}],
      maxTokens: 5,
      cache: false
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // A five-token test can run out of room (a thinking model spends it reasoning); the server
    // still answered, which is all the test checks.
    if (!message.includes(LOCAL_SERVER_RESPONSE_LIMIT_MESSAGE)) return localServerFailure(message, apiBase, details, listed);
  }

  details.unshift(`Connected to ${apiBase}.`);
  if (!model && listed?.length) details.push(`No model configured. Requests will name "${listed[0]}".`);
  return {
    tone: 'success',
    summary: 'Local model server connection succeeded.',
    details,
    detectedModels: listed ?? undefined
  };
}

function localServerFailure(
  message: string,
  apiBase: string,
  details: string[],
  listed: string[] | null
): ConnectionTestResult {
  const unreachable = /could not connect/i.test(message);
  return {
    tone: 'error',
    summary: unreachable
      ? `Could not reach the local model server at ${apiBase}. Check that it is running${
          typeof window !== 'undefined' && !window.electronAPI
            ? ', and that it allows requests from this page (CORS) in the browser build'
            : ''
        }.`
      : message,
    details,
    detectedModels: listed ?? undefined
  };
}
