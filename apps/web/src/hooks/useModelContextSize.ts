import {useEffect, useState} from 'react';
import type {ProjectAISettings} from '../entityTypes';
import {resolveModelContextSize, type ModelContextSize} from '../services/llm/modelContextSize';

/**
 * The configured model's context size (Slice 4.71), or null until known.
 * Asked again when the provider, address, or model changes.
 */
export function useModelContextSize(
  aiConfig: Pick<ProjectAISettings, 'provider' | 'configs'> | null | undefined,
  enabled = true
): ModelContextSize | null {
  const provider = aiConfig?.provider;
  const config = provider ? aiConfig?.configs?.[provider] : undefined;
  const baseUrl = config && 'baseUrl' in config ? config.baseUrl : undefined;
  const model = config?.model;
  const key = `${provider ?? ''}|${baseUrl ?? ''}|${model ?? ''}`;
  const [size, setSize] = useState<{key: string; value: ModelContextSize} | null>(null);

  useEffect(() => {
    if (!enabled || !provider) return;
    let cancelled = false;
    void resolveModelContextSize({provider, configs: {[provider]: {baseUrl, model}}} as Pick<
      ProjectAISettings,
      'provider' | 'configs'
    >).then((value) => {
      if (!cancelled) setSize({key, value});
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, provider, baseUrl, model, key]);

  return size?.key === key ? size.value : null;
}
