import type React from 'react';
import type {ProjectAISettings, ProjectMode} from '../../entityTypes';
import styles from '../../assets/components/Settings/AISettingsForm.module.css';
import type {ConfirmRequest} from '../../hooks/useConfirmDialog';
import type {InlineAlertVariant} from '../common';
import {describeError} from '../../services/errors';
import {
  appendToolPack,
  buildToolPack,
  parseToolPack,
  replaceWithToolPack,
  withDefaultModes
} from '../../services/llm/toolPack';
import {triggerJsonDownload} from '../../utils/downloadJson';

/**
 * Settings › AI › Tool Packs: export prompt tools and AI actions as one file,
 * or import one, replacing or appending to the current ones.
 */
export function ToolPackSection({
  aiSettings,
  onSettingsChange,
  projectMode,
  defaultsMode,
  requestConfirm,
  onStatus
}: {
  aiSettings: ProjectAISettings;
  onSettingsChange: (aiSettings: ProjectAISettings) => void;
  projectMode: ProjectMode;
  /** The mode whose default tools Prompt Tools is configuring; imported defaults go there. */
  defaultsMode: ProjectMode;
  requestConfirm: (request: ConfirmRequest) => void;
  onStatus: (status: {variant: InlineAlertVariant; message: string}) => void;
}) {
  const handleExportToolPack = () => {
    triggerJsonDownload('prompt-tools-pack.json', buildToolPack(aiSettings));
  };

  const handleImportToolPack = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const pack = parseToolPack(await file.text());
      const context = {defaultsMode, projectMode};
      // Reset the file input now — we've already read its contents, and the
      // choice below is made asynchronously via the confirm dialog.
      event.target.value = '';
      requestConfirm({
        title: 'Replace existing prompt tools and AI actions with the imported ones?',
        message: 'Choose Append instead to add the imported ones alongside your existing ones.',
        confirmLabel: 'Replace',
        cancelLabel: 'Append',
        onConfirm: () => onSettingsChange(withDefaultModes(aiSettings, replaceWithToolPack(aiSettings, pack, context))),
        onCancel: () => onSettingsChange(withDefaultModes(aiSettings, appendToolPack(aiSettings, pack, context)))
      });
    } catch (error) {
      onStatus({variant: 'error', message: describeError(error, 'Unable to import tool pack.')});
      event.target.value = '';
    }
  };

  return (
    <div className={styles.toolsSection}>
      <h3 className={styles.toolsHeading}>Tool Packs</h3>
      <p className={styles.help}>One file with your prompt tools and AI actions, to back up or share.</p>
      <div className={styles.toolPackActions}>
        <button type='button' className={styles.secondaryButton} onClick={handleExportToolPack}>
          Export Tool Pack
        </button>
        <label className={styles.secondaryButton}>
          Import Tool Pack
          <input
            type='file'
            accept='.json,application/json'
            onChange={(e) => void handleImportToolPack(e)}
            style={{display: 'none'}}
          />
        </label>
      </div>
    </div>
  );
}
