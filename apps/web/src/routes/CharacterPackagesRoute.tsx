import {useEffect, useRef, useState} from 'react';
import type {ChangeEvent} from 'react';
import {useNavigate} from 'react-router';
import {useAppStore} from '../store/appStore';
import {getProjectCapabilities} from '../projectMode';
import {getRulesetByProjectId} from '../services/rules';
import {
  exportCharactersJson,
  importCharactersJson
} from '../services/characters';
import styles from '../styles/CharactersRoute.module.css';

function CharacterPackagesRoute() {
  const activeProject = useAppStore((state) => state.activeProject);
  const projectSettings = useAppStore((state) => state.projectSettings);
  const navigate = useNavigate();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [hasRuleset, setHasRuleset] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [pendingIncludeSheets, setPendingIncludeSheets] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const capabilities = getProjectCapabilities(projectSettings);
  const canTransferSheets = capabilities.canUseRuleAuthoring && hasRuleset;

  useEffect(() => {
    let cancelled = false;
    if (!activeProject) {
      setHasRuleset(false);
      return;
    }
    void getRulesetByProjectId(activeProject.id)
      .then((ruleset) => {
        if (!cancelled) setHasRuleset(Boolean(ruleset));
      })
      .catch(() => {
        if (!cancelled) setHasRuleset(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  const handleExport = async (includeSheets: boolean) => {
    if (!activeProject) return;
    setFeedback(null);
    try {
      await exportCharactersJson({
        projectId: activeProject.id,
        projectName: activeProject.name,
        includeSheets
      });
      setFeedback({
        tone: 'success',
        message: includeSheets
          ? 'Character packages exported with sheets.'
          : 'Character packages exported.'
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to export characters.'
      });
    }
  };

  const openImport = (includeSheets: boolean) => {
    setPendingIncludeSheets(includeSheets);
    importInputRef.current?.click();
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !activeProject) return;
    setIsImporting(true);
    setFeedback(null);
    try {
      const result = await importCharactersJson({
        file,
        projectId: activeProject.id,
        includeSheets: pendingIncludeSheets
      });
      setFeedback({
        tone: 'success',
        message: pendingIncludeSheets
          ? `Imported ${result.charactersImported} character capability records and ${result.sheetsImported} sheets. Review any unresolved legacy identity in World Bible.`
          : `Imported ${result.charactersImported} character capability records. Review any unresolved legacy identity in World Bible.`
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to import characters.'
      });
    } finally {
      setIsImporting(false);
    }
  };

  if (!activeProject) {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>Character packages</h1>
        <p>No active project. Open a project before transferring character packages.</p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Character packages</h1>
      <p className={styles.lead}>
        Transfer several World Bible characters between projects. Edit a single
        character or export its package from that character's World Bible detail.
      </p>
      {feedback && (
        <p
          role='status'
          className={`${styles.feedback} ${
            feedback.tone === 'error' ? styles.feedbackError : styles.feedbackSuccess
          }`}
        >
          {feedback.message}
        </p>
      )}
      <div className={styles.toolbar}>
        <button type='button' onClick={() => void handleExport(false)}>
          Export all characters
        </button>
        {canTransferSheets && (
          <button type='button' onClick={() => void handleExport(true)}>
            Export all with sheets
          </button>
        )}
        <button type='button' onClick={() => openImport(false)} disabled={isImporting}>
          {isImporting ? 'Importing...' : 'Import character packages'}
        </button>
        {canTransferSheets && (
          <button type='button' onClick={() => openImport(true)} disabled={isImporting}>
            {isImporting ? 'Importing...' : 'Import packages with sheets'}
          </button>
        )}
        <input
          ref={importInputRef}
          type='file'
          accept='.json,application/json'
          onChange={(event) => void handleImport(event)}
          style={{display: 'none'}}
        />
      </div>
      {!canTransferSheets && capabilities.canUseRuleAuthoring && (
        <p className={styles.notice}>
          Sheet transfer becomes available after this project has rules.
        </p>
      )}
      <div className={styles.bottomActions}>
        <button
          type='button'
          onClick={() =>
            navigate('/world-bible', {state: {focusCategorySlug: 'characters'}})
          }
        >
          Open World Bible characters
        </button>
      </div>
    </section>
  );
}

export default CharacterPackagesRoute;
