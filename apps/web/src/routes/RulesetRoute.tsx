import {Component, useEffect, useRef, useState} from 'react';
import type {ChangeEvent, ReactNode} from 'react';
import {useNavigate} from 'react-router';
import type {Project} from '../entityTypes';
import type {WorldRuleset} from '@worldbuilding-desk/rules-engine';
import {WorldBuildingWizard} from '@worldbuilding-desk/rules-ui';
import '@rules-ui/styles/wizard.css';
import {saveProject, getRulesetByProjectId} from '../services/storage';
import {useAppStore} from '../store/appStore';
import {saveRuleset} from '../services/rules';
import {
  exportRulesetJson,
  importRulesetJson
} from '../services/rules';
import {describeError} from '../services/errors';
import {InlineAlert, RouteFeedback} from '../components/common';
import styles from '../styles/RulesetRoute.module.css';

// activeProject and setActiveProject read from store below

interface RulesetWizardErrorBoundaryProps {
  children: ReactNode;
}

interface RulesetWizardErrorBoundaryState {
  error: Error | null;
}

class RulesetWizardErrorBoundary extends Component<
  RulesetWizardErrorBoundaryProps,
  RulesetWizardErrorBoundaryState
> {
  state: RulesetWizardErrorBoundaryState = {error: null};

  static getDerivedStateFromError(error: Error): RulesetWizardErrorBoundaryState {
    return {error};
  }

  componentDidCatch(error: Error) {
    console.error('Ruleset wizard failed to render', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div role='alert' className={styles.renderError}>
          <h2>Ruleset editor failed to load.</h2>
          <p>
            The rest of the app is still available, but this route hit a render error.
          </p>
          <pre>{this.state.error.message}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}

function RulesetRoute() {
  const activeProject = useAppStore((s) => s.activeProject);
  const navigate = useNavigate();
  const setActiveProject = useAppStore((s) => s.setActiveProject);
  const [ruleset, setRuleset] = useState<WorldRuleset | null>(null);
  const [loading, setLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [showAdvancedRules, setShowAdvancedRules] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!activeProject) {
      setRuleset(null);
      setFeedback(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setFeedback(null);
    getRulesetByProjectId(activeProject.id)
      .then((loaded) => {
        if (!cancelled) {
          setRuleset(loaded ?? null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setFeedback({
            tone: 'error',
            message:
              describeError(error, 'Unable to load ruleset.')
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  const handleComplete = async (nextRuleset: WorldRuleset) => {
    if (!activeProject) return;

    setFeedback(null);
    try {
      const savedRuleset = await saveRuleset(nextRuleset, activeProject.id);
      setRuleset(savedRuleset);

      if (activeProject.rulesetId !== nextRuleset.id) {
        const updatedProject: Project = {
          ...activeProject,
          rulesetId: nextRuleset.id,
          updatedAt: Date.now()
        };
        await saveProject(updatedProject);
        void setActiveProject(updatedProject);
      }

      setFeedback({tone: 'success', message: 'Ruleset saved.'});
    } catch (error) {
      const message =
        describeError(error, 'Unable to save ruleset.');
      setFeedback({tone: 'error', message});
    }
  };

  const handleExport = async () => {
    if (!activeProject || !ruleset) return;
    setFeedback(null);
    try {
      await exportRulesetJson({
        projectName: activeProject.name,
        ruleset
      });
      setFeedback({tone: 'success', message: 'Ruleset exported.'});
    } catch (error) {
      const message =
        describeError(error, 'Unable to export ruleset.');
      setFeedback({tone: 'error', message});
    }
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !activeProject) return;
    setIsImporting(true);
    setFeedback(null);
    try {
      const importedRuleset = await importRulesetJson(file);
      await handleComplete(importedRuleset);
      setFeedback({
        tone: 'success',
        message: 'Ruleset imported and saved to this project.'
      });
    } catch (error) {
      const message =
        describeError(error, 'Unable to import ruleset.');
      setFeedback({tone: 'error', message});
    } finally {
      setIsImporting(false);
    }
  };

  const quarantinedRuleCount = ruleset?.quarantinedRules?.length ?? 0;
  const quarantinedRuleNotice =
    quarantinedRuleCount === 0
      ? null
      : quarantinedRuleCount === 1
        ? '1 saved rule could not be read, so it is set aside: not applied and not shared with AI. It stays in ruleset exports and project backups.'
        : `${quarantinedRuleCount} saved rules could not be read, so they are set aside: not applied and not shared with AI. They stay in ruleset exports and project backups.`;

  if (!activeProject) {
    return (
      <section>
        <h1>World Ruleset</h1>
        <p>
          No active project. Go to <strong>Projects</strong> to create or open a
          project first.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>World Ruleset</h1>
      <p className={styles.summary}>
        {ruleset
          ? `${ruleset.statDefinitions.length + ruleset.resourceDefinitions.length} tracked values are available to character mechanics.`
          : 'Tracking is optional. The quickest start is one value on a saved World Bible character.'}
      </p>
      {quarantinedRuleNotice && <InlineAlert variant='info' message={quarantinedRuleNotice} />}
      {!showAdvancedRules ? (
        <div className={styles.startPanel}>
          <h2>{ruleset ? 'Rules are ready' : 'Start with a character'}</h2>
          <p>
            {ruleset
              ? 'Use World Bible → Character → Mechanics to track values and record scene changes. Open advanced rules only to edit definitions, templates, types, limits, or transfer files.'
              : 'Open a saved character, choose Mechanics, then Add mechanics. You will name one Stat or Resource and confirm once; the project setup and linked sheet are created together.'}
          </p>
          <div className={styles.startActions}>
            <button type='button' onClick={() => navigate('/world-bible')}>Open World Bible</button>
            <button type='button' onClick={() => setShowAdvancedRules(true)}>Advanced rules</button>
          </div>
        </div>
      ) : (
      <>
      <button type='button' onClick={() => setShowAdvancedRules(false)} className={styles.hideAdvanced}>
        Hide advanced rules
      </button>
      <div className={styles.transferActions}>
        <button
          type='button'
          onClick={() => void handleExport()}
          disabled={!ruleset}
        >
          Export Ruleset
        </button>
        <button
          type='button'
          onClick={handleImportClick}
          disabled={isImporting}
        >
          {isImporting ? 'Importing...' : 'Import Ruleset'}
        </button>
        <input
          ref={importInputRef}
          type='file'
          accept='.json,application/json'
          onChange={(event) => void handleImport(event)}
          className={styles.hiddenInput}
        />
      </div>
      <RouteFeedback feedback={feedback} onClear={() => setFeedback(null)} />
      {loading ? (
        <p>Loading ruleset...</p>
      ) : (
        <div className={styles.wizardHost}>
          <RulesetWizardErrorBoundary>
            <WorldBuildingWizard
              key={activeProject.id}
              onComplete={handleComplete}
              initialRuleset={ruleset ?? undefined}
            />
          </RulesetWizardErrorBoundary>
        </div>
      )}
      </>
      )}
    </section>
  );
}

export default RulesetRoute;
