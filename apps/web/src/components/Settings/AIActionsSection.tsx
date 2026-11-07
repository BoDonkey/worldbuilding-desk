import {useState} from 'react';
import type {ProjectAISettings, SelectionAction, SelectionActionOutput} from '../../entityTypes';
import styles from '../../assets/components/Settings/AISettingsForm.module.css';
import {InlineAlert} from '../common';
import {readAISwitches} from '../../services/llm/aiSwitches';
import {
  SELECTION_ACTION_OUTPUT_LABELS,
  actionsAllowedBySwitches,
  installMissingPresets,
  readSelectionActions
} from '../../services/assistant/selectionActions';

interface AIActionsSectionProps {
  aiSettings: ProjectAISettings;
  onSettingsChange: (aiSettings: ProjectAISettings) => void;
}

type ActionDraft = Pick<SelectionAction, 'name' | 'instructions' | 'output' | 'includeScene' | 'includeWorldBible'>;

const emptyDraft = (output: SelectionActionOutput): ActionDraft => ({
  name: '',
  instructions: '',
  output,
  includeScene: false,
  includeWorldBible: false
});

const isComplete = (draft: ActionDraft) => Boolean(draft.name.trim() && draft.instructions.trim());

/** The fields shared by adding and editing an action. */
function ActionFields({
  draft,
  outputs,
  onChange
}: {
  draft: ActionDraft;
  outputs: SelectionActionOutput[];
  onChange: (draft: ActionDraft) => void;
}) {
  return (
    <>
      <div className={styles.field}>
        <label className={styles.label}>
          Action name
          <input
            type='text'
            className={styles.input}
            value={draft.name}
            onChange={(e) => onChange({...draft, name: e.target.value})}
            placeholder='e.g., Tighten'
          />
        </label>
      </div>
      <div className={styles.field}>
        <label className={styles.label}>
          Action instructions
          <textarea
            className={styles.textarea}
            value={draft.instructions}
            onChange={(e) => onChange({...draft, instructions: e.target.value})}
            placeholder="e.g., Cut filler words and redundant phrases. Keep the meaning, voice and tense."
          />
        </label>
      </div>
      <div className={styles.field}>
        <label className={styles.label}>
          Result
          <select
            className={styles.input}
            value={draft.output}
            onChange={(e) => onChange({...draft, output: e.target.value as SelectionActionOutput})}
          >
            {outputs.map((output) => (
              <option key={output} value={output}>
                {SELECTION_ACTION_OUTPUT_LABELS[output]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={styles.toolActions}>
        <span>Also send:</span>
        <label>
          <input
            type='checkbox'
            checked={draft.includeScene}
            onChange={(e) => onChange({...draft, includeScene: e.target.checked})}
          />
          The current scene
        </label>
        <label>
          <input
            type='checkbox'
            checked={draft.includeWorldBible}
            onChange={(e) => onChange({...draft, includeWorldBible: e.target.checked})}
          />
          World Bible records the selection names
        </label>
      </div>
    </>
  );
}

/**
 * **AI actions** in AI Settings (Slice 5.19): one-click tasks for selected text, run from the
 * selection menu. Rewrites follow the AI prose switch and notes the AI coaching switch; an action
 * whose switch is off is hidden here and from the menu, and kept as saved.
 */
export function AIActionsSection({aiSettings, onSettingsChange}: AIActionsSectionProps) {
  const switches = readAISwitches(aiSettings);
  const outputs: SelectionActionOutput[] = [
    ...(switches.prose ? (['replace'] as const) : []),
    ...(switches.coaching ? (['note'] as const) : [])
  ];
  const [draft, setDraft] = useState<ActionDraft>(() => emptyDraft(outputs[0] ?? 'note'));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ActionDraft | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  if (outputs.length === 0) return null;

  const allActions = readSelectionActions(aiSettings);
  const shown = actionsAllowedBySwitches(aiSettings);
  const draftOutput = outputs.includes(draft.output) ? draft.output : outputs[0];
  const save = (selectionActions: SelectionAction[]) => onSettingsChange({...aiSettings, selectionActions});
  const update = (id: string, changes: Partial<SelectionAction>) =>
    save(allActions.map((action) => (action.id === id ? {...action, ...changes} : action)));
  const trimmed = (value: ActionDraft): ActionDraft => ({
    ...value,
    name: value.name.trim(),
    instructions: value.instructions.trim()
  });

  const handleAdd = () => {
    if (!isComplete(draft)) return;
    save([...allActions, {...trimmed({...draft, output: draftOutput}), id: crypto.randomUUID(), enabled: true}]);
    setDraft(emptyDraft(draftOutput));
  };

  const handleSaveEdit = () => {
    if (!editingId || !editDraft || !isComplete(editDraft)) return;
    update(editingId, trimmed(editDraft));
    setEditingId(null);
    setEditDraft(null);
  };

  const handleInstallPresets = () => {
    const result = installMissingPresets(allActions);
    if (result.added === 0) {
      setNotice('The preset actions are already installed.');
      return;
    }
    save(result.actions);
    setNotice(`Added ${result.added} preset action${result.added === 1 ? '' : 's'}, switched off.`);
  };

  return (
    <div className={styles.toolsSection} aria-labelledby='ai-actions-heading'>
      <h3 id='ai-actions-heading' className={styles.toolsHeading}>AI actions</h3>
      <p className={styles.help}>
        One-click tasks for selected text. Right-click a selection to run one. Rewrites wait for your
        confirmation.
      </p>
      {notice && <InlineAlert variant='info' message={notice} onDismiss={() => setNotice(null)} autoDismissMs={4000} />}

      <ActionFields draft={{...draft, output: draftOutput}} outputs={outputs} onChange={setDraft} />
      <div className={styles.toolPackActions}>
        <button type='button' className={styles.saveButton} onClick={handleAdd} disabled={!isComplete(draft)}>
          Add AI Action
        </button>
        <button type='button' className={styles.secondaryButton} onClick={handleInstallPresets}>
          Install Presets
        </button>
      </div>

      {shown.length === 0 ? (
        <p className={styles.help}>No AI actions yet.</p>
      ) : (
        <ul className={styles.toolList} aria-label='AI actions'>
          {shown.map((action) => (
            <li key={action.id} className={styles.toolItem}>
              {editingId === action.id && editDraft ? (
                <div className={styles.editPanel}>
                  <ActionFields draft={editDraft} outputs={outputs} onChange={setEditDraft} />
                  <div className={styles.toolPackActions}>
                    <button
                      type='button'
                      className={styles.secondaryButton}
                      onClick={handleSaveEdit}
                      disabled={!isComplete(editDraft)}
                    >
                      Save Changes
                    </button>
                    <button
                      type='button'
                      className={styles.secondaryButton}
                      onClick={() => {
                        setEditingId(null);
                        setEditDraft(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.toolHeader}>
                    <strong>{action.name}</strong> · {SELECTION_ACTION_OUTPUT_LABELS[action.output]}
                  </div>
                  <p className={styles.toolContent}>{action.instructions}</p>
                </>
              )}
              <div className={styles.toolActions}>
                <label>
                  <input
                    type='checkbox'
                    checked={action.enabled}
                    onChange={(e) => update(action.id, {enabled: e.target.checked})}
                    aria-label={`${action.name} on`}
                  />
                  On
                </label>
                <button
                  type='button'
                  className={styles.secondaryButton}
                  onClick={() => {
                    setEditingId(action.id);
                    setEditDraft({
                      name: action.name,
                      instructions: action.instructions,
                      output: action.output,
                      includeScene: action.includeScene,
                      includeWorldBible: action.includeWorldBible
                    });
                  }}
                  disabled={editingId === action.id}
                >
                  Edit
                </button>
                <button
                  type='button'
                  className={styles.deleteButton}
                  onClick={() => save(allActions.filter((entry) => entry.id !== action.id))}
                  aria-label={`Delete ${action.name}`}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
