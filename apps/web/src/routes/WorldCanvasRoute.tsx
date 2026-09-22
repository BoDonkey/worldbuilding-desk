import {useState} from 'react';
import {useNavigate} from 'react-router';
import {PageHeader} from '../components/PageHeader';
import {ProjectScratchpadButton} from '../components/ProjectScratchpadButton';
import {RouteFeedback} from '../components/common';
import {WorldCanvasView} from '../components/WorldBible/WorldCanvasView';
import {useWorldBibleProjectData} from '../hooks/useWorldBibleProjectData';
import {useWorldCanvas} from '../hooks/useWorldCanvas';
import {useAppStore} from '../store/appStore';
import styles from '../styles/WorldCanvasRoute.module.css';

function WorldCanvasRoute() {
  const navigate = useNavigate();
  const activeProject = useAppStore((state) => state.activeProject);
  const projectSettings = useAppStore((state) => state.projectSettings);
  const [feedback, setFeedback] = useState<{tone: 'success' | 'error'; message: string} | null>(null);
  const {
    categories,
    entities,
    loreDocuments,
    aliases,
    ragService
  } = useWorldBibleProjectData({activeProject, setFeedback});
  const worldCanvas = useWorldCanvas(activeProject?.id ?? null, ragService);

  return (
    <section className={styles.page}>
      <PageHeader
        eyebrow='Planning'
        title='World Canvas'
        description='Develop the ideas beneath your story through directed questions. Use the Corkboard for story progression and the Canvas for the world that gives those events meaning.'
        actions={activeProject ? (
          <>
            <button type='button' onClick={() => navigate('/corkboard')}>Open Corkboard</button>
            <ProjectScratchpadButton projectId={activeProject.id} />
          </>
        ) : undefined}
      />
      {!activeProject ? (
        <div className={styles.emptyState}>Open or create a project first to explore its World Canvas.</div>
      ) : (
        <>
          <RouteFeedback feedback={feedback} onClear={() => setFeedback(null)} />
          <WorldCanvasView
            worldCanvas={worldCanvas}
            categories={categories}
            entities={entities}
            loreDocuments={loreDocuments}
            aliases={aliases}
            aiConfig={projectSettings?.aiSettings}
            onOpenSourceNote={(documentId) => navigate('/lore', {state: {focusLoreDocumentId: documentId}})}
            onOpenEntity={(entityId) => navigate('/world-bible', {state: {focusEntityId: entityId}})}
            onProposeCanon={({category, name, target}) => navigate('/world-bible', {
              state: {
                focusCategorySlug: category.slug,
                prefillRecordName: name,
                worldCanvasLinkTarget: target
              }
            })}
            onFeedback={setFeedback}
          />
        </>
      )}
    </section>
  );
}

export default WorldCanvasRoute;
