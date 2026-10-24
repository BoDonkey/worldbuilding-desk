import {useEffect, useMemo, useState} from 'react';
import type {ProjectAISettings} from '../entityTypes';
import {getInstalledOllamaModels} from '../services/llm/ollamaModels';
import {classifyProviderRoute, type OllamaModelEntry, type ProviderRoute} from '../services/llm/providerRoute';

/**
 * The project's provider route, verified against Ollama's installed models
 * when the provider is Ollama. A local OpenAI-compatible server is classified
 * from its address alone. Until Ollama answers, the route is
 * `ollama-unverified`: disclosed and counted as remote.
 */
export function useProviderRoute(
  aiConfig: Pick<ProjectAISettings, 'provider' | 'configs'> | undefined | null
): ProviderRoute {
  const provider = aiConfig?.provider;
  const baseUrl = aiConfig?.configs?.ollama?.baseUrl;
  const [installed, setInstalled] = useState<{baseUrl: string | undefined; models: OllamaModelEntry[] | null}>({
    baseUrl: undefined,
    models: null
  });

  useEffect(() => {
    if (provider !== 'ollama') return;
    let cancelled = false;
    void getInstalledOllamaModels(baseUrl).then((models) => {
      if (!cancelled) setInstalled({baseUrl, models});
    });
    return () => {
      cancelled = true;
    };
  }, [provider, baseUrl]);

  const models = installed.baseUrl === baseUrl ? installed.models : null;
  const model = aiConfig?.configs?.ollama?.model;
  const localServer = aiConfig?.configs?.['local-openai'];
  const localServerBaseUrl = localServer?.baseUrl;
  const localServerModel = localServer?.model;
  // Keyed on the values the classification reads, not the settings object: settings get a new
  // identity on every save, and callers keep the route (via the consultation budget) in effect and
  // callback dependencies, so an identity change on each save would re-run their work.
  return useMemo(
    () =>
      classifyProviderRoute(
        provider
          ? ({
              provider,
              configs: {ollama: {baseUrl, model}, 'local-openai': {baseUrl: localServerBaseUrl, model: localServerModel}}
            } as Pick<ProjectAISettings, 'provider' | 'configs'>)
          : null,
        models
      ),
    [provider, baseUrl, model, models, localServerBaseUrl, localServerModel]
  );
}
