import type {AIProviderId, ProjectAISettings} from '../../entityTypes';
import {HOSTED_PROVIDER_NAMES, PROVIDER_DEFAULT_BASE_URLS} from './providerConfig';

/**
 * Where a project's AI requests actually go. One classification drives the
 * data-flow disclosures, the request policy, and consultation accounting, so
 * a surface can never call a route "local" that the request policy or the
 * budget treats as remote.
 *
 * - `private-local`: Ollama on a loopback address with a model verified as
 *   installed on this computer. The only route that is disclosed as staying
 *   on device and exempt from the consultation budget.
 * - `hosted`: Anthropic, OpenAI, or Gemini.
 * - `ollama-cloud`: an Ollama model that runs on Ollama's servers. Blocked.
 * - `ollama-remote`: Ollama at a non-loopback address. Blocked.
 * - `ollama-unverified`: loopback Ollama whose model could not be confirmed
 *   as installed locally (not checked yet, unreachable, or not installed).
 *   Fails closed: disclosed and counted as remote, and the request policy
 *   refuses to send until the model is confirmed.
 */
export type ProviderRouteKind =
  | 'private-local'
  | 'hosted'
  | 'ollama-cloud'
  | 'ollama-remote'
  | 'ollama-unverified';

export interface ProviderRoute {
  kind: ProviderRouteKind;
  provider: AIProviderId | undefined;
  /** True only for `private-local`: on-device disclosure and budget exemption. */
  isPrivateLocal: boolean;
  /** False when the request policy will refuse to send. */
  allowsRequests: boolean;
  /** The Ollama model a request will use, when verified. */
  model?: string;
  /** Plain-language reason when the route is not private-local Ollama. */
  reason?: string;
}

export interface OllamaModelEntry {
  name: string;
  /** Runs on Ollama's servers rather than this computer. */
  cloud: boolean;
}

const DEFAULT_OLLAMA_BASE_URL = PROVIDER_DEFAULT_BASE_URLS.ollama ?? 'http://localhost:11434';

export function isLoopbackUrl(baseUrl: string | undefined): boolean {
  try {
    const url = new URL((baseUrl?.trim() || DEFAULT_OLLAMA_BASE_URL));
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return host === 'localhost' || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host);
  } catch {
    return false;
  }
}

/** Ollama cloud models carry a `cloud` tag, e.g. `gpt-oss:120b-cloud` or `qwen3:cloud`. */
export function isOllamaCloudModelName(name: string): boolean {
  const tag = name.includes(':') ? name.slice(name.lastIndexOf(':') + 1) : '';
  return /(^|-)cloud$/i.test(tag);
}

/**
 * Reads `/api/tags`. An entry is treated as cloud if Ollama marks it remote
 * (`remote_host` / `remote_model`) or its tag names the cloud.
 */
export function parseOllamaTags(data: unknown): OllamaModelEntry[] {
  const models = (data as {models?: unknown})?.models;
  if (!Array.isArray(models)) return [];
  return models.flatMap((entry) => {
    const record = entry as Record<string, unknown>;
    const name = typeof record?.name === 'string' ? record.name.trim() : '';
    if (!name) return [];
    const cloud = Boolean(record.remote_host || record.remote_model) || isOllamaCloudModelName(name);
    return [{name, cloud}];
  });
}

const withDefaultTag = (name: string) => (name.includes(':') ? name : `${name}:latest`);

export type OllamaModelResolution =
  | {ok: true; model: string}
  | {ok: false; kind: 'ollama-cloud' | 'ollama-unverified'; reason: string};

/**
 * Picks the model a request may use: the configured one if it is installed
 * and local, or (when none is configured) the first installed local model.
 * Cloud models are never chosen and never accepted.
 */
export function resolveLocalOllamaModel(
  installed: readonly OllamaModelEntry[],
  configured?: string
): OllamaModelResolution {
  const explicit = configured?.trim();
  if (explicit) {
    if (isOllamaCloudModelName(explicit)) {
      return {ok: false, kind: 'ollama-cloud', reason: ollamaCloudReason(explicit)};
    }
    const match = installed.find((entry) => withDefaultTag(entry.name) === withDefaultTag(explicit));
    if (!match) {
      return {
        ok: false,
        kind: 'ollama-unverified',
        reason: `The Ollama model "${explicit}" is not installed on this computer. Pull it, or pick an installed model in Settings.`
      };
    }
    if (match.cloud) return {ok: false, kind: 'ollama-cloud', reason: ollamaCloudReason(match.name)};
    // Send the name as configured; Ollama resolves `qwen3` and `qwen3:latest` alike.
    return {ok: true, model: explicit};
  }
  const firstLocal = installed.find((entry) => !entry.cloud);
  if (!firstLocal) {
    return {
      ok: false,
      kind: 'ollama-unverified',
      reason: 'No Ollama model is installed on this computer. Pull a local model, then try again.'
    };
  }
  return {ok: true, model: firstLocal.name};
}

function ollamaCloudReason(model: string): string {
  return `"${model}" is an Ollama cloud model, so your text would leave this computer. Private mode blocks it; choose a locally installed model in Settings.`;
}

const REMOTE_OLLAMA_REASON =
  'Ollama must run on this computer (localhost or 127.0.0.1). Remote Ollama addresses are blocked.';

/**
 * Classifies a project's AI settings. `installed` is the Ollama model list
 * from `/api/tags`, or null when it has not been (or could not be) read.
 */
export function classifyProviderRoute(
  aiConfig: Pick<ProjectAISettings, 'provider' | 'configs'> | undefined | null,
  installed: readonly OllamaModelEntry[] | null
): ProviderRoute {
  const provider = aiConfig?.provider;
  if (provider !== 'ollama') {
    return {kind: 'hosted', provider, isPrivateLocal: false, allowsRequests: true};
  }
  const config = aiConfig?.configs?.ollama;
  if (!isLoopbackUrl(config?.baseUrl)) {
    return {kind: 'ollama-remote', provider, isPrivateLocal: false, allowsRequests: false, reason: REMOTE_OLLAMA_REASON};
  }
  if (config?.model && isOllamaCloudModelName(config.model)) {
    return {
      kind: 'ollama-cloud',
      provider,
      isPrivateLocal: false,
      allowsRequests: false,
      reason: ollamaCloudReason(config.model)
    };
  }
  if (!installed) {
    return {
      kind: 'ollama-unverified',
      provider,
      isPrivateLocal: false,
      allowsRequests: false,
      reason: 'Could not confirm that the Ollama model runs on this computer, so it is treated as remote until Ollama answers.'
    };
  }
  const resolution = resolveLocalOllamaModel(installed, config?.model);
  if (!resolution.ok) {
    return {kind: resolution.kind, provider, isPrivateLocal: false, allowsRequests: false, reason: resolution.reason};
  }
  return {kind: 'private-local', provider, isPrivateLocal: true, allowsRequests: true, model: resolution.model};
}

/** Shown only for a verified private-local route. */
export const PRIVATE_LOCAL_DISCLOSURE = 'Runs on your local Ollama model. Nothing leaves this computer.';

/**
 * Point-of-use data-flow sentence. `sentMaterial` names what a request sends,
 * e.g. "your description and instructions".
 */
export function describeRouteDataFlow(route: ProviderRoute, sentMaterial: string): string | null {
  switch (route.kind) {
    case 'private-local':
      return PRIVATE_LOCAL_DISCLOSURE;
    case 'hosted':
      return route.provider
        ? `Sends ${sentMaterial} to ${HOSTED_PROVIDER_NAMES[route.provider as Exclude<AIProviderId, 'ollama'>]}’s servers only when you send.`
        : null;
    default:
      return route.reason ?? null;
  }
}

