import {useEffect, useMemo, useRef, useState} from 'react';
import type {ChangeEvent} from 'react';
import {Navigate, useLocation, useNavigate, useSearchParams} from 'react-router-dom';
import {useAppStore} from '../store/appStore';
import {getProjectCapabilities} from '../projectMode';
import CharactersRoute from './CharactersRoute';
import CharacterSheetsRoute from './CharacterSheetsRoute';
import {getRulesetByProjectId} from '../services/rules';
import {
  exportCharactersJson,
  importCharactersJson
} from '../services/characters';
import styles from '../styles/CharactersRoute.module.css';

function CharactersHubRoute() {
  const activeProject = useAppStore((s) => s.activeProject);
  const projectSettings = useAppStore((s) => s.projectSettings);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [hasRuleset, setHasRuleset] = useState(false);
  const [pendingCharacterId, setPendingCharacterId] = useState<string | null>(
    null
  );
  const [pendingAutoCreateSheetCharacterId, setPendingAutoCreateSheetCharacterId] =
    useState<string | null>(null);
  const [isImportingCharacters, setIsImportingCharacters] = useState(false);
  const [pendingImportMode, setPendingImportMode] = useState<
    'roster' | 'full'
  >('full');
  const [dataVersion, setDataVersion] = useState(0);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const appliedLocationPrefillRef = useRef<string | null>(null);
  const view = useMemo(() => {
    return searchParams.get('view') === 'sheets' ? 'sheets' : 'roster';
  }, [searchParams]);
  const capabilities = getProjectCapabilities(projectSettings);
  const canUseSheets = hasRuleset && capabilities.canUseRuleAuthoring;

  useEffect(() => {
    const state = location.state as
      | {
          prefillCharacterId?: string;
          preferredView?: 'roster' | 'sheets';
          autoCreateSheetForCharacterId?: string;
        }
      | null;
    const prefillCharacterId = state?.prefillCharacterId ?? null;
    if (!prefillCharacterId) {
      return;
    }
    const alreadyApplied = appliedLocationPrefillRef.current === prefillCharacterId;
    if (!alreadyApplied) {
      appliedLocationPrefillRef.current = prefillCharacterId;
      setPendingCharacterId(prefillCharacterId);
      setPendingAutoCreateSheetCharacterId(state?.autoCreateSheetForCharacterId ?? null);
    }
    if (state?.preferredView === 'sheets' && canUseSheets) {
      setSearchParams({view: 'sheets'});
      return;
    }
    if (!alreadyApplied && state?.preferredView === 'roster') {
      setSearchParams({});
    }
  }, [canUseSheets, location.state, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    if (!activeProject) {
      setHasRuleset(false);
      return;
    }
    getRulesetByProjectId(activeProject.id)
      .then((ruleset) => {
        if (!cancelled) {
          setHasRuleset(Boolean(ruleset));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasRuleset(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  useEffect(() => {
    if (view === 'sheets' && activeProject && !canUseSheets) {
      setSearchParams({});
    }
  }, [view, activeProject, canUseSheets, setSearchParams]);

  const openView = (next: 'roster' | 'sheets') => {
    if (next === 'sheets' && activeProject && !canUseSheets) {
      return;
    }
    setSearchParams(next === 'sheets' ? {view: 'sheets'} : {});
  };

  const handleExportCharacters = async () => {
    if (!activeProject) return;
    setFeedback(null);
    try {
      await exportCharactersJson({
        projectId: activeProject.id,
        projectName: activeProject.name
      });
      setFeedback({tone: 'success', message: 'Characters exported.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to export characters.';
      setFeedback({tone: 'error', message});
    }
  };

  const handleExportRosterOnly = async () => {
    if (!activeProject) return;
    setFeedback(null);
    try {
      await exportCharactersJson({
        projectId: activeProject.id,
        projectName: activeProject.name,
        includeSheets: false
      });
      setFeedback({tone: 'success', message: 'Tool profiles exported.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to export tool profiles.';
      setFeedback({tone: 'error', message});
    }
  };

  const handleImportCharactersClick = (mode: 'roster' | 'full') => {
    setPendingImportMode(mode);
    importInputRef.current?.click();
  };

  const handleImportCharacters = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !activeProject) return;
    setIsImportingCharacters(true);
    setFeedback(null);
    try {
      const result = await importCharactersJson({
        file,
        projectId: activeProject.id,
        includeSheets: pendingImportMode === 'full'
      });
      setDataVersion((prev) => prev + 1);
      setFeedback({
        tone: 'success',
        message:
          pendingImportMode === 'full'
            ? `Imported ${result.charactersImported} tool profiles and ${result.sheetsImported} sheets.`
            : `Imported ${result.charactersImported} tool profiles.`
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to import characters.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsImportingCharacters(false);
    }
  };

  if (!activeProject) {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>Character Tools</h1>
        <p>
          No active project. Go to <strong>Projects</strong> to create or open a
          project first.
        </p>
      </section>
    );
  }

  if (capabilities.isGeneralFiction) {
    return (
      <Navigate
        to='/world-bible'
        replace
        state={{focusCategorySlug: 'characters'}}
      />
    );
  }

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Character Tools</h1>
      <p className={styles.lead}>
        {canUseSheets
          ? 'Use this secondary workspace for tool-profile exports, sheets, and state tracking. Canonical names, aliases, and descriptive lore belong in World Bible.'
          : 'Use this secondary workspace for tool-profile exports. Canonical names, aliases, and descriptive lore belong in World Bible.'}
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
        <button type='button' onClick={() => void handleExportRosterOnly()}>
          Export Tool Profiles
        </button>
        {canUseSheets && (
          <button type='button' onClick={() => void handleExportCharacters()}>
            Export Tool Profiles + Sheets
          </button>
        )}
        <button
          type='button'
          onClick={() => handleImportCharactersClick('roster')}
          disabled={isImportingCharacters}
        >
          {isImportingCharacters
            ? 'Importing...'
            : 'Import Tool Profiles'}
        </button>
        {canUseSheets && (
          <button
            type='button'
            onClick={() => handleImportCharactersClick('full')}
            disabled={isImportingCharacters}
          >
            {isImportingCharacters ? 'Importing...' : 'Import Tool Profiles + Sheets'}
          </button>
        )}
        <input
          ref={importInputRef}
          type='file'
          accept='.json,application/json'
          onChange={(event) => void handleImportCharacters(event)}
          style={{display: 'none'}}
        />
      </div>
      {capabilities.canUseRuleAuthoring && (
        <div className={styles.tabRow}>
          <button
            type='button'
            onClick={() => openView('roster')}
            className={view === 'roster' ? styles.tabButtonActive : ''}
          >
            Tool Profiles
          </button>
          <button
            type='button'
            onClick={() => openView('sheets')}
            disabled={!canUseSheets}
            className={view === 'sheets' ? styles.tabButtonActive : ''}
            style={{opacity: canUseSheets ? 1 : 0.55}}
          >
            Sheets + State
          </button>
        </div>
      )}
      {!hasRuleset && capabilities.canUseRuleAuthoring && (
        <div className={styles.notice}>
          Sheets and state tracking are disabled until this project has a ruleset.
          <button
            type='button'
            onClick={() => navigate('/ruleset')}
            style={{marginLeft: '0.5rem'}}
          >
            Open Ruleset
          </button>
        </div>
      )}

      {view === 'roster' && (
        <CharactersRoute
          key={`roster-${dataVersion}`}
          embedded
          canUseSheets={canUseSheets}
          prefillCharacterId={pendingCharacterId}
          onPrefillConsumed={() => setPendingCharacterId(null)}
          onOpenSheets={
            canUseSheets
              ? (characterId, options) => {
                  setPendingCharacterId(characterId ?? null);
                  setPendingAutoCreateSheetCharacterId(
                    options?.autoCreate ? characterId ?? null : null
                  );
                  openView('sheets');
                }
              : undefined
          }
        />
      )}
      {view === 'sheets' && (
        <CharacterSheetsRoute
          key={`sheets-${dataVersion}`}
          embedded
          prefillCharacterId={pendingCharacterId}
          onPrefillConsumed={() => setPendingCharacterId(null)}
          autoCreateSheetCharacterId={pendingAutoCreateSheetCharacterId}
          onAutoCreateConsumed={() => setPendingAutoCreateSheetCharacterId(null)}
        />
      )}
    </section>
  );
}

export default CharactersHubRoute;
