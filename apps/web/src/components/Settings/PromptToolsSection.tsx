import type {ProjectMode} from '../../entityTypes';
import styles from '../../assets/components/Settings/AISettingsForm.module.css';
import type {PromptToolsControls} from '../../hooks/usePromptTools';

const PROJECT_MODE_LABELS: Record<ProjectMode, string> = {
  litrpg: 'LitRPG',
  game: 'Game',
  general: 'General'
};

/**
 * Settings › AI › Prompt Tools: standing instructions for the AI chat, and
 * which are active by default in each project mode. `AISettings` holds the
 * state (`usePromptTools`) so drafts survive turning AI coaching off and on.
 */
export function PromptToolsSection({tools}: {tools: PromptToolsControls}) {
  const {
    promptTools,
    defaultsMode,
    defaultsForSelectedMode,
    toolName,
    toolContent,
    editingToolId,
    editingToolName,
    editingToolContent
  } = tools;
  return (
    <div className={styles.toolsSection}>
      <h3 className={styles.toolsHeading}>Prompt Tools</h3>
      <p className={styles.help}>
        Standing instructions for the AI chat, such as a voice or role. Tick them in the AI
        panel; they apply to every message.
      </p>
      <div className={styles.modeDefaultsHeader}>
        <label className={styles.label}>
          Configure Default Active tools for mode
          <select
            className={styles.input}
            value={defaultsMode}
            onChange={(e) => tools.setDefaultsMode(e.target.value as ProjectMode)}
          >
            {(['litrpg', 'game', 'general'] as ProjectMode[]).map((mode) => (
              <option key={mode} value={mode}>
                {PROJECT_MODE_LABELS[mode]}
              </option>
            ))}
          </select>
        </label>
        <p className={styles.help}>
          The AI assistant preselects tools using this mode’s defaults.
        </p>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Tool Name</label>
        <input
          type='text'
          className={styles.input}
          value={toolName}
          onChange={(e) => tools.setToolName(e.target.value)}
          placeholder='e.g., Literary Critic Persona'
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Tool Instructions</label>
        <textarea
          className={styles.textarea}
          value={toolContent}
          onChange={(e) => tools.setToolContent(e.target.value)}
          placeholder='Describe the voice, constraints, and evaluation criteria for this tool.'
        />
      </div>

      <button
        type='button'
        className={styles.saveButton}
        onClick={tools.handleAddPromptTool}
        disabled={!toolName.trim() || !toolContent.trim()}
      >
        Add Prompt Tool
      </button>
      <div className={styles.toolPackActions}>
        <button type='button' className={styles.secondaryButton} onClick={tools.handleInstallPresetTools}>
          Install Preset Tools
        </button>
      </div>

      {promptTools.length === 0 ? (
        <p className={styles.help}>No prompt tools yet.</p>
      ) : (
        <ul className={styles.toolList}>
          {promptTools.map((tool) => (
            <li key={tool.id} className={styles.toolItem}>
              {editingToolId === tool.id ? (
                <div className={styles.editPanel}>
                  <div className={styles.field}>
                    <label className={styles.label}>Tool Name</label>
                    <input
                      type='text'
                      className={styles.input}
                      value={editingToolName}
                      onChange={(e) => tools.setEditingToolName(e.target.value)}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Tool Instructions</label>
                    <textarea
                      className={styles.textarea}
                      value={editingToolContent}
                      onChange={(e) => tools.setEditingToolContent(e.target.value)}
                    />
                  </div>
                  <div className={styles.toolPackActions}>
                    <button
                      type='button'
                      className={styles.secondaryButton}
                      onClick={() => tools.handleSaveEditTool(tool.id)}
                    >
                      Save Changes
                    </button>
                    <button
                      type='button'
                      className={styles.secondaryButton}
                      onClick={tools.handleCancelEditTool}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.toolHeader}>
                    <strong>{tool.name}</strong>
                  </div>
                  <p className={styles.toolContent}>{tool.content}</p>
                </>
              )}
              <div className={styles.toolActions}>
                <label>
                  <input
                    type='checkbox'
                    checked={tool.enabled}
                    onChange={(e) =>
                      tools.handleTogglePromptToolEnabled(tool.id, e.target.checked)
                    }
                  />
                  Enabled
                </label>
                <label>
                  <input
                    type='checkbox'
                    checked={defaultsForSelectedMode.includes(tool.id)}
                    disabled={!tool.enabled}
                    onChange={(e) =>
                      tools.handleToggleDefaultTool(tool.id, e.target.checked)
                    }
                  />
                  Default Active ({PROJECT_MODE_LABELS[defaultsMode]})
                </label>
                <button
                  type='button'
                  className={styles.secondaryButton}
                  onClick={() => tools.handleStartEditTool(tool)}
                  disabled={editingToolId === tool.id}
                >
                  Edit
                </button>
                <button
                  type='button'
                  className={styles.deleteButton}
                  onClick={() => tools.handleDeletePromptTool(tool.id)}
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
