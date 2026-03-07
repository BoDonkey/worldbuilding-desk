import {useEffect, useState} from 'react';
import type {Project} from '../entityTypes';
import type {WorldRuleset} from '@litrpg-tool/rules-engine';
import {WorldBuildingWizard} from '@litrpg-tool/rules-ui';
import '@rules-ui/styles/wizard.css';
import {saveProject} from '../projectStorage';
import {getRulesetByProjectId, saveRuleset} from '../services/rulesetService';

interface RulesetRouteProps {
  activeProject: Project | null;
  onProjectUpdated(project: Project): void;
}

function RulesetRoute({activeProject, onProjectUpdated}: RulesetRouteProps) {
  const [ruleset, setRuleset] = useState<WorldRuleset | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);

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
              error instanceof Error
                ? error.message
                : 'Unable to load ruleset.'
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
      await saveRuleset(nextRuleset, activeProject.id);
      setRuleset(nextRuleset);

      if (activeProject.rulesetId !== nextRuleset.id) {
        const updatedProject: Project = {
          ...activeProject,
          rulesetId: nextRuleset.id,
          updatedAt: Date.now()
        };
        await saveProject(updatedProject);
        onProjectUpdated(updatedProject);
      }

      setFeedback({tone: 'success', message: 'Ruleset saved.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to save ruleset.';
      setFeedback({tone: 'error', message});
    }
  };

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
    <section style={{height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column'}}>
      <h1 style={{marginTop: 0, marginBottom: '0.5rem'}}>World Ruleset</h1>
      <p style={{marginTop: 0, marginBottom: '0.75rem', color: '#4b5563'}}>
        {ruleset ? 'Editing existing ruleset.' : 'No ruleset yet. Create one for this project.'}
      </p>
      {feedback && (
        <p
          role='status'
          style={{
            marginBottom: '1rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '6px',
            border: `1px solid ${
              feedback.tone === 'error' ? '#fecaca' : '#bbf7d0'
            }`,
            backgroundColor:
              feedback.tone === 'error' ? '#fef2f2' : '#f0fdf4',
            color: feedback.tone === 'error' ? '#991b1b' : '#166534'
          }}
        >
          {feedback.message}
        </p>
      )}
      {loading ? (
        <p>Loading ruleset...</p>
      ) : (
        <div style={{flex: 1, minHeight: 0}}>
          <WorldBuildingWizard
            key={activeProject.id}
            onComplete={handleComplete}
            initialRuleset={ruleset ?? undefined}
          />
        </div>
      )}
    </section>
  );
}

export default RulesetRoute;
