import React, {useState} from 'react';
import type {ProjectAISettings, ProjectMode} from '../../entityTypes';
import styles from '../../assets/components/Settings/AISettingsForm.module.css';
import {useConfirmDialog} from '../../hooks/useConfirmDialog';
import {useAIProviderSetup} from '../../hooks/useAIProviderSetup';
import {usePromptTools} from '../../hooks/usePromptTools';
import {InlineAlert, type InlineAlertVariant} from '../common';
import {getConsultationBudgetStatus} from '../../services/editor';
import {anyAISwitchOn, readAISwitches} from '../../services/llm/aiSwitches';
import {AISwitchesFields} from './AISwitchesFields';
import {AIProviderSetupSection} from './AIProviderSetupSection';
import {AIAdvancedSettingsSection} from './AIAdvancedSettingsSection';
import {AIGuardrailsFields} from './AIGuardrailsFields';
import {PromptToolsSection} from './PromptToolsSection';
import {AIActionsSection} from './AIActionsSection';
import {ToolPackSection} from './ToolPackSection';

interface AISettingsProps {
  aiSettings: ProjectAISettings;
  /** Project whose consultation budget this panel reports on. */
  projectId: string | null;
  projectMode: ProjectMode;
  onSettingsChange: (aiSettings: ProjectAISettings) => void;
}

/**
 * Settings › AI. Each section is its own component. The state that must
 * survive turning the AI switches off and on (typed keys, diagnostics, prompt
 * tool drafts, the advanced toggle) is held here.
 */
export const AISettings: React.FC<AISettingsProps> = ({
  aiSettings,
  projectId,
  projectMode,
  onSettingsChange
}) => {
  const providerSetup = useAIProviderSetup(aiSettings, onSettingsChange);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const {requestConfirm, confirmDialog} = useConfirmDialog();
  const [statusMessage, setStatusMessage] = useState<
    {variant: InlineAlertVariant; message: string} | null
  >(null);
  const promptTools = usePromptTools({
    aiSettings,
    projectMode,
    onSettingsChange,
    onStatus: setStatusMessage
  });

  const aiSwitches = readAISwitches(aiSettings);
  const inspectorSettings = aiSettings.inspectorSettings ?? {
    reviewEngineMode: 'deterministic' as const,
    canonDecisionProviderMode: 'project-provider' as const,
    maxConsultationsPerDay: 20,
    maxContextChars: 1800,
    maxResponseTokens: 500,
    lowCostModel: ''
  };

  // Settings owns the persistent limit and the explanation of it; the per-action cost is stated
  // at the point of use (see `ConsultationBudgetNotice`). Read once per render — the ledger is
  // plain `localStorage`, and this panel is not a live meter.
  const budgetStatus = getConsultationBudgetStatus(
    projectId ?? '__none__',
    inspectorSettings.maxConsultationsPerDay
  );

  return (
    <div className={styles.container}>
      {statusMessage && (
        <InlineAlert
          variant={statusMessage.variant}
          message={statusMessage.message}
          onDismiss={() => setStatusMessage(null)}
          autoDismissMs={statusMessage.variant === 'error' ? undefined : 4000}
        />
      )}
      <AISwitchesFields aiSettings={aiSettings} onSettingsChange={onSettingsChange} />
      {/* With both switches off the rest collapses; saved settings and keys are kept (5.18). */}
      {anyAISwitchOn(aiSwitches) && (
      <>
      <AIProviderSetupSection
        setup={providerSetup}
        aiSettings={aiSettings}
        onSettingsChange={onSettingsChange}
      />

      <AIAdvancedSettingsSection
        aiSettings={aiSettings}
        onSettingsChange={onSettingsChange}
        proseEnabled={aiSwitches.prose}
        currentBaseUrl={providerSetup.currentBaseUrl}
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => setShowAdvanced((prev) => !prev)}
      >
        <AIGuardrailsFields
          aiSettings={aiSettings}
          onSettingsChange={onSettingsChange}
          inspectorSettings={inspectorSettings}
          coachingEnabled={aiSwitches.coaching}
          budgetStatus={budgetStatus}
          budgetIsLocal={providerSetup.providerRoute.isPrivateLocal}
          currentModel={providerSetup.currentModel}
        />
      </AIAdvancedSettingsSection>

      {/* Prompt tools shape the assistant chat, which is AI coaching. */}
      {aiSwitches.coaching && <PromptToolsSection tools={promptTools} />}

      <AIActionsSection aiSettings={aiSettings} onSettingsChange={onSettingsChange} />

      <ToolPackSection
        aiSettings={aiSettings}
        onSettingsChange={onSettingsChange}
        projectMode={projectMode}
        defaultsMode={promptTools.defaultsMode}
        requestConfirm={requestConfirm}
        onStatus={setStatusMessage}
      />
      </>
      )}

      {confirmDialog}
    </div>
  );
};
