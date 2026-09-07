import {useState} from 'react';
import {useNavigate} from 'react-router';
import {useAppStore} from '../../store/appStore';
import {createSampleProject} from '../../services/onboarding/createSampleProject';
import {
  dismissOnboardingGuide,
  getOnboardingGuideVariant,
  isOnboardingGuideDismissed,
  type OnboardingGuideVariant
} from '../../services/onboarding/onboardingGuide';
import styles from '../../styles/WorkspaceRoute.module.css';

interface GettingStartedGuideProps {
  projectId: string;
}

/**
 * Contextual, dismissible guidance for the write -> capture canon -> review
 * loop, shown only on projects created through the first-run or sample
 * paths (never appears unprompted on a project an author already had).
 * Dismissal persists per project and never blocks normal use; resetting it
 * is a deliberate author action (Settings), not automatic.
 */
export function GettingStartedGuide({projectId}: GettingStartedGuideProps) {
  const navigate = useNavigate();
  const setActiveProject = useAppStore((state) => state.setActiveProject);
  const saveProjectSettings = useAppStore((state) => state.saveProjectSettings);
  const [dismissed, setDismissed] = useState(() => isOnboardingGuideDismissed(projectId));
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const variant: OnboardingGuideVariant | null = getOnboardingGuideVariant(projectId);

  // Only projects created through the first-run or sample paths are marked. An
  // unmarked project is one the author already had — never show this unprompted.
  if (!variant || dismissed) return null;

  const dismiss = () => {
    dismissOnboardingGuide(projectId);
    setDismissed(true);
  };

  const exploreSample = async () => {
    setIsLoadingSample(true);
    try {
      const sampleProject = await createSampleProject({saveProjectSettings});
      await setActiveProject(sampleProject);
    } finally {
      setIsLoadingSample(false);
    }
  };

  return (
    <div className={styles.gettingStartedPanel}>
      <div className={styles.gettingStartedHeader}>
        <h2>Getting started</h2>
        <button type='button' className={styles.gettingStartedDismiss} onClick={dismiss}>
          Dismiss
        </button>
      </div>
      <ol className={styles.gettingStartedSteps}>
        <li>Write your scene here, in the editor. There is nothing else to set up first.</li>
        <li>
          Add background details as a{' '}
          <button type='button' className={styles.gettingStartedLink} onClick={() => navigate('/lore')}>
            Source Note
          </button>
          , then extract facts from it into your World Bible when you are ready to make something
          canon.
        </li>
        <li>
          If two sources disagree,{' '}
          <button
            type='button'
            className={styles.gettingStartedLink}
            onClick={() => navigate('/canon-decisions')}
          >
            Canon Decisions
          </button>{' '}
          will show you the conflict so you can decide — nothing becomes canon without your
          click.
        </li>
      </ol>
      {variant === 'blank' && (
        <p className={styles.gettingStartedSample}>
          Prefer to explore a finished example first?{' '}
          <button type='button' onClick={() => void exploreSample()} disabled={isLoadingSample}>
            {isLoadingSample ? 'Loading sample...' : 'Load a sample project'}
          </button>
        </p>
      )}
      {variant === 'sample' && (
        <p className={styles.gettingStartedSample}>
          This sample&apos;s two lore documents disagree about how long Brannic has served the
          Compact. Try extracting facts from both in Source Notes, then check Canon Decisions.
        </p>
      )}
    </div>
  );
}
