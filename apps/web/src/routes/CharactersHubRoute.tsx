import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {ChangeEvent} from 'react';
import {useLocation, useNavigate, useSearchParams} from 'react-router-dom';
import type {Project, ProjectSettings} from '../entityTypes';
import CharactersRoute from './CharactersRoute';
import CharacterSheetsRoute from './CharacterSheetsRoute';
import {getRulesetByProjectId} from '../services/rulesetService';
import {
  exportCharactersJson,
  importCharactersJson
} from '../services/characterTransferService';
import styles from '../styles/CharactersRoute.module.css';

interface CharactersHubRouteProps {
  activeProject: Project | null;
  projectSettings?: ProjectSettings | null;
}

function CharactersHubRoute({
  activeProject,
  projectSettings = null
}: CharactersHubRouteProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [hasRuleset, setHasRuleset] = useState(false);
  const [pendingCharacterId, setPendingCharacterId] = useState<string | null>(
    null
  );
  const [pendingSheetId, setPendingSheetId] = useState<string | null>(null);
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
  const view = useMemo(() => {
    return searchParams.get('view') === 'sheets' ? 'sheets' : 'roster';
  }, [searchParams]);

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
    if (view === 'sheets' && activeProject && !hasRuleset) {
      setSearchParams({});
    }
  }, [view, activeProject, hasRuleset, setSearchParams]);

  const openView = useCallback(
    (next: 'roster' | 'sheets') => {
      if (next === 'sheets' && activeProject && !hasRuleset) {
        return;
      }
      setSearchParams(next === 'sheets' ? {view: 'sheets'} : {});
    },
    [activeProject, hasRuleset, setSearchParams]
  );

  useEffect(() => {
    const state = location.state as
      | {view?: 'roster' | 'sheets'; focusCharacterId?: string; focusSheetId?: string}
      | null;
    if (!state) {
      return;
    }
    if (state.focusCharacterId) {
      setPendingCharacterId(state.focusCharacterId);
    }
    if (state.focusSheetId) {
      setPendingSheetId(state.focusSheetId);
    }
    if (state.view === 'sheets') {
      openView('sheets');
    } else if (state.view === 'roster') {
      openView('roster');
    }
    navigate(location.pathname + location.search, {replace: true, state: null});
  }, [location.pathname, location.search, location.state, navigate, openView, setSearchParams]);

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
      setFeedback({tone: 'success', message: 'Roster exported.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to export roster.';
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
            ? `Imported ${result.charactersImported} characters and ${result.sheetsImported} sheets.`
            : `Imported ${result.charactersImported} characters (roster only).`
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
      <section>
        <h1 style={{marginTop: 0}}>Characters</h1>
        <p>
          No active project. Go to <strong>Projects</strong> to create or open a
          project first.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Characters</h1>
      <p className={styles.lead}>
        {projectSettings?.projectMode === 'general'
          ? 'Manage your cast in one place. Use roster profiles for story-facing character notes, and treat sheets as optional advanced records.'
          : 'Manage roster profiles and gameplay-ready sheets in one place.'}
      </p>
      <p className={styles.lead} style={{marginTop: '-0.4rem', fontSize: '0.95rem'}}>
        World Bible holds canon records for people in the setting. Characters is the
        cast workspace for author-facing profiles and, in system-heavy projects, character sheets.
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
          Export Roster
        </button>
        {hasRuleset && (
          <button type='button' onClick={() => void handleExportCharacters()}>
            Export Roster + Sheets
          </button>
        )}
        <button
          type='button'
          onClick={() => handleImportCharactersClick('roster')}
          disabled={isImportingCharacters}
        >
          {isImportingCharacters
            ? 'Importing...'
            : 'Import Roster'}
        </button>
        {hasRuleset && (
          <button
            type='button'
            onClick={() => handleImportCharactersClick('full')}
            disabled={isImportingCharacters}
          >
            {isImportingCharacters ? 'Importing...' : 'Import Roster + Sheets'}
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
      <div className={styles.tabRow}>
        <button
          type='button'
          onClick={() => openView('roster')}
          className={view === 'roster' ? styles.tabButtonActive : ''}
        >
          Roster
        </button>
        <button
          type='button'
          onClick={() => openView('sheets')}
          disabled={!hasRuleset}
          className={view === 'sheets' ? styles.tabButtonActive : ''}
          style={{opacity: hasRuleset ? 1 : 0.55}}
        >
          {projectSettings?.projectMode === 'general' ? 'Sheets (Optional)' : 'Sheets'}
        </button>
      </div>
      {!hasRuleset && projectSettings?.projectMode !== 'general' && (
        <div className={styles.notice}>
          Sheets are disabled until this project has a ruleset.
          <button
            type='button'
            onClick={() => navigate('/ruleset')}
            style={{marginLeft: '0.5rem', fontSize: '0.8rem'}}
          >
            Open Ruleset
          </button>
        </div>
      )}

      {view === 'roster' && (
        <CharactersRoute
          key={`roster-${dataVersion}`}
          activeProject={activeProject}
          projectSettings={projectSettings}
          embedded
          focusCharacterId={pendingCharacterId}
          onFocusCharacterConsumed={() => setPendingCharacterId(null)}
          canOpenSheets={hasRuleset}
          onOpenSheets={(characterId) => {
            if (!hasRuleset) {
              return;
            }
            setPendingCharacterId(characterId ?? null);
            openView('sheets');
          }}
        />
      )}
      {view === 'sheets' && (
        <CharacterSheetsRoute
          key={`sheets-${dataVersion}`}
          activeProject={activeProject}
          projectSettings={projectSettings}
          embedded
          prefillCharacterId={pendingCharacterId}
          focusSheetId={pendingSheetId}
          onPrefillConsumed={() => setPendingCharacterId(null)}
          onFocusSheetConsumed={() => setPendingSheetId(null)}
        />
      )}
    </section>
  );
}

export default CharactersHubRoute;
