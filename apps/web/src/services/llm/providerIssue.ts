import type {ProjectAISettings} from '../../entityTypes';
import {describeError} from '../errors';
import {LLMService} from './LLMService';

export interface ProviderIssueMessages {
  /** Shown when no provider is set up; names the feature that needs one. */
  notConfigured: string;
  /** Fallback when a setup is present but rejected; defaults to `notConfigured`. */
  invalid?: string;
  /** Records the rejection as a diagnostic; off by default, since this runs on every config change. */
  record?: boolean;
}

/**
 * Why no request can be sent with this provider setup, or null when one can. Checks without
 * sending anything: building the service is what rejects a missing key or an unknown provider.
 */
export function getProviderIssue(
  aiConfig: ProjectAISettings | undefined,
  messages: ProviderIssueMessages
): string | null {
  if (!aiConfig) return messages.notConfigured;
  try {
    new LLMService(aiConfig);
    return null;
  } catch (error) {
    return describeError(error, messages.invalid ?? messages.notConfigured, {record: messages.record ?? false});
  }
}
