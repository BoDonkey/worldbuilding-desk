import type {InspectorSettings, ProjectAISettings} from '../../entityTypes';
import styles from '../../assets/components/Settings/AISettingsForm.module.css';
import {PROVIDER_FALLBACK_MODELS} from '../../services/llm/providerConfig';
import {
  HOSTED_PRICE_TABLE_CHECKED_AT,
  formatHostedResponseCost,
  getHostedResponseCostCeiling
} from '../../services/llm/hostedResponsePolicy';
import {LOCAL_CONSULTATION_DAILY_GUARD, type ConsultationBudgetStatus} from '../../services/editor';

/**
 * Settings › AI › AI Guardrails: who reviews the draft, the canon decision
 * provider policy (both AI coaching only), the daily consultation limit with
 * today's use, and the context and response limits.
 */
export function AIGuardrailsFields({
  aiSettings,
  onSettingsChange,
  inspectorSettings,
  coachingEnabled,
  budgetStatus,
  budgetIsLocal,
  currentModel
}: {
  aiSettings: ProjectAISettings;
  onSettingsChange: (aiSettings: ProjectAISettings) => void;
  /** The project's inspector settings, with defaults filled in. */
  inspectorSettings: InspectorSettings;
  coachingEnabled: boolean;
  budgetStatus: ConsultationBudgetStatus;
  budgetIsLocal: boolean;
  currentModel: string;
}) {
  const responseModel =
    currentModel || PROVIDER_FALLBACK_MODELS[aiSettings.provider] || 'provider default';
  const responseCostCeiling = getHostedResponseCostCeiling(
    aiSettings.provider,
    responseModel,
    inspectorSettings.maxResponseTokens
  );

  return (
    <>
      <h3 className={styles.toolsHeading}>AI Guardrails</h3>
      {coachingEnabled && (
      <>
      <div className={styles.field}>
        <label className={styles.label}>Who checks your draft</label>
        <select
          className={styles.input}
          value={inspectorSettings.reviewEngineMode ?? 'deterministic'}
          onChange={(e) =>
            onSettingsChange({
              ...aiSettings,
              inspectorSettings: {
                ...inspectorSettings,
                reviewEngineMode:
                  e.target.value === 'local-ai-preview'
                    ? 'local-ai-preview'
                    : 'deterministic'
              }
            })
          }
        >
          <option value='deterministic'>Deterministic review</option>
          <option value='local-ai-preview'>Local AI review annotations</option>
        </select>
        <p className={styles.help}>
          Local AI mode uses the Ollama model configured above, keeps deterministic
          validation as the source of truth, and only enriches the per-issue review
          annotation layer.
        </p>
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Canon decision AI provider policy</label>
        <select
          className={styles.input}
          value={inspectorSettings.canonDecisionProviderMode ?? 'project-provider'}
          onChange={(e) =>
            onSettingsChange({
              ...aiSettings,
              inspectorSettings: {
                ...inspectorSettings,
                canonDecisionProviderMode:
                  e.target.value === 'local-ollama'
                    ? 'local-ollama'
                    : 'project-provider'
              }
            })
          }
        >
          <option value='project-provider'>Use project provider</option>
          <option value='local-ollama'>Force local Ollama</option>
        </select>
        <p className={styles.help}>
          Canon decision consultations can follow the main assistant provider or stay local through Ollama even when writing assistance uses a hosted model.
        </p>
      </div>
      </>
      )}
      <div className={styles.field}>
        <label className={styles.label}>Max consultations per day</label>
        <input
          type='number'
          className={styles.input}
          min={1}
          value={inspectorSettings.maxConsultationsPerDay}
          onChange={(e) =>
            onSettingsChange({
              ...aiSettings,
              inspectorSettings: {
                ...inspectorSettings,
                maxConsultationsPerDay: Math.max(1, Number(e.target.value) || 20)
              }
            })
          }
        />
        <p className={styles.help}>
          Guards against runaway loops and surprise provider spend, not against deliberate work.
          It counts whole requests for this project, whichever feature makes them, and resets at{' '}
          {budgetStatus.resetsAtLabel}.{' '}
          {budgetIsLocal
            ? `Your local provider does not spend it at all — local requests stop only at a separate runaway guard of ${LOCAL_CONSULTATION_DAILY_GUARD} a day.`
            : 'Local providers (Ollama or a local model server) do not spend it at all.'}
        </p>
        <div className={styles.budgetUsage}>
          <p className={styles.budgetUsageSummary}>
            <strong>Today:</strong> {budgetStatus.used} of {budgetStatus.limit} used
            {budgetStatus.granted > 0
              ? ` (${budgetStatus.configuredLimit} plus ${budgetStatus.granted} you added for today)`
              : ''}
            {budgetIsLocal || budgetStatus.localUsed > 0
              ? ` · ${budgetStatus.localUsed} local request${budgetStatus.localUsed === 1 ? '' : 's'}, unbudgeted`
              : ''}
          </p>
          {budgetStatus.byFeature.length > 0 ? (
            <ul className={styles.budgetUsageList}>
              {budgetStatus.byFeature.map((entry) => (
                <li key={entry.feature}>
                  <span>{entry.label}</span>
                  <span>{entry.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.budgetUsageEmpty}>
              No AI consultations spent for this project today.
            </p>
          )}
        </div>
      </div>
      <div className={styles.field}>
        <label className={styles.label}>How much story context to send</label>
        <input
          type='number'
          className={styles.input}
          min={300}
          value={inspectorSettings.maxContextChars}
          onChange={(e) =>
            onSettingsChange({
              ...aiSettings,
              inspectorSettings: {
                ...inspectorSettings,
                maxContextChars: Math.max(300, Number(e.target.value) || 1800)
              }
            })
          }
        />
        <p className={styles.help}>Measured in characters of story context per request.</p>
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Max response tokens</label>
        <input
          type='number'
          className={styles.input}
          min={100}
          value={inspectorSettings.maxResponseTokens}
          onChange={(e) =>
            onSettingsChange({
              ...aiSettings,
              inspectorSettings: {
                ...inspectorSettings,
                maxResponseTokens: Math.max(100, Number(e.target.value) || 500)
              }
            })
          }
        />
        {responseCostCeiling ? (
          <p className={styles.help} data-testid='hosted-response-cost-ceiling'>
            Hosted response ceiling: up to {responseCostCeiling.tokens.toLocaleString()} tokens
            {responseCostCeiling.maximumOutputUsd !== undefined
              ? ` (${formatHostedResponseCost(responseCostCeiling.maximumOutputUsd)} maximum response charge for ${responseModel})`
              : ` (the current price for ${responseModel} is not listed)`}
            . Input tokens cost extra. Structured replies may use the 1,500-token minimum shown
            here. Prices checked {HOSTED_PRICE_TABLE_CHECKED_AT}.
          </p>
        ) : (
          <p className={styles.help}>Local replies have no provider charge and do not use this cap; the local model&apos;s context size sets their length.</p>
        )}
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Cheaper model for routine checks (optional)</label>
        <input
          type='text'
          className={styles.input}
          value={inspectorSettings.lowCostModel ?? ''}
          onChange={(e) =>
            onSettingsChange({
              ...aiSettings,
              inspectorSettings: {
                ...inspectorSettings,
                lowCostModel: e.target.value
              }
            })
          }
          placeholder='e.g., gpt-4o-mini'
        />
      </div>
    </>
  );
}
