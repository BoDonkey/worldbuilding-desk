import type {EntityCategory, Project, ProjectSettings} from '../../entityTypes';
import type {
  AiHelperActionTarget,
  useWorldBibleAuthoringAssistant
} from '../../hooks/useWorldBibleAuthoringAssistant';
import {deriveAiSectionLabel} from '../../hooks/useWorldBibleAuthoringAssistant';
import {AIAssistant} from '../AIAssistant/AIAssistant';
import styles from '../../assets/components/WorldBibleRoute.module.css';

interface WorldBibleRecordAiHelperProps {
  activeProject: Project;
  projectSettings: ProjectSettings | null;
  activeCategory: EntityCategory;
  editingId: string | null;
  authoring: ReturnType<typeof useWorldBibleAuthoringAssistant>;
}

export const WorldBibleRecordAiHelper = ({
  activeProject, projectSettings, activeCategory, editingId, authoring
}: WorldBibleRecordAiHelperProps) => {
  const {
    isRecordAiHelperOpen, setIsRecordAiHelperOpen, aiHelperSelectedText,
    setAiHelperSelectedText, aiHelperActionTarget, setAiHelperActionTarget,
    aiHelperNewSectionLabel, setAiHelperNewSectionLabel, aiHelperProposal,
    setAiHelperProposal, activeCategoryRecordLabel, currentRecordAiContext,
    aiHelperApplyTargets, handleDraftAiHelperProposal, handleConfirmAiHelperProposal
  } = authoring;
  return (
    <>
              {isRecordAiHelperOpen && (
                <section className={styles.aiHelperPanel} aria-label='World Bible AI helper'>
                  <div className={styles.aiHelperHeader}>
                    <div>
                      <strong>AI helper</strong>
                      <p>
                        Ask for names, descriptions, field ideas, revisions, cleanup,
                        or new sections. Highlight assistant text, preview an action,
                        then confirm it.
                      </p>
                    </div>
                    <button
                      type='button'
                      onClick={() => {
                        setAiHelperSelectedText('');
                        setAiHelperNewSectionLabel('');
                        setAiHelperProposal(null);
                        setIsRecordAiHelperOpen(false);
                      }}
                    >
                      Close
                    </button>
                  </div>
                  <div className={styles.aiHelperApplyBar}>
                    <label>
                      Use selection as
                      <select
                        value={aiHelperActionTarget}
                        onChange={(event) => {
                          setAiHelperActionTarget(event.target.value as AiHelperActionTarget);
                          setAiHelperProposal(null);
                        }}
                      >
                        {aiHelperApplyTargets.map((target) => (
                          <option key={target.value} value={target.value}>
                            {target.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {aiHelperActionTarget === 'new-section' && (
                      <label>
                        Section label
                        <input
                          type='text'
                          value={aiHelperNewSectionLabel}
                          onChange={(event) => {
                            setAiHelperNewSectionLabel(event.target.value);
                            setAiHelperProposal(null);
                          }}
                          placeholder={
                            deriveAiSectionLabel(aiHelperSelectedText) || 'e.g., Customs'
                          }
                        />
                      </label>
                    )}
                    <div
                      className={`${styles.aiHelperSelectionPreview} ${
                        aiHelperActionTarget === 'new-section'
                          ? styles.aiHelperSelectionPreviewWithSection
                          : ''
                      }`}
                    >
                      {aiHelperSelectedText.trim() || 'Highlight text in an assistant response'}
                    </div>
                    <button
                      type='button'
                      onClick={handleDraftAiHelperProposal}
                      disabled={!aiHelperSelectedText.trim()}
                    >
                      Preview action
                    </button>
                  </div>
                  {aiHelperProposal && (
                    <div className={styles.aiHelperProposalCard} role='status'>
                      <div>
                        <span className={styles.aiHelperProposalEyebrow}>
                          Pending action
                        </span>
                        <strong>
                          {aiHelperProposal.kind === 'name' &&
                            `Set ${activeCategoryRecordLabel} name`}
                          {aiHelperProposal.kind === 'aliases' &&
                            'Add alternative name'}
                          {aiHelperProposal.kind === 'field' &&
                            `${
                              aiHelperProposal.fieldType === 'textarea'
                                ? 'Append to'
                                : 'Set'
                            } ${aiHelperProposal.fieldLabel}`}
                          {aiHelperProposal.kind === 'new-section' &&
                            `Create section "${aiHelperProposal.label}"`}
                        </strong>
                      </div>
                      <p>{aiHelperProposal.text}</p>
                      <div className={styles.aiHelperProposalActions}>
                        <button
                          type='button'
                          className={styles.secondaryButton}
                          onClick={() => setAiHelperProposal(null)}
                        >
                          Dismiss
                        </button>
                        <button
                          type='button'
                          className={styles.primaryButton}
                          onClick={() => void handleConfirmAiHelperProposal()}
                        >
                          Confirm action
                        </button>
                      </div>
                    </div>
                  )}
                  <AIAssistant
                    projectId={activeProject.id}
                    aiConfig={projectSettings?.aiSettings}
                    projectMode={projectSettings?.projectMode}
                    context={{
                      type: 'world-bible',
                      id: editingId ?? activeCategory.id,
                      selectedText: currentRecordAiContext
                    }}
                    onAssistantSelectionChange={(selectedText) => {
                      setAiHelperSelectedText(selectedText);
                      setAiHelperProposal(null);
                    }}
                    showContextPreview={false}
                  />
                </section>
              )}
    </>
  );
};
