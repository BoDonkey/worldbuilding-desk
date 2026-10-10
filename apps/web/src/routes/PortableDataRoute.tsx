import {useMemo, useState} from 'react';
import {useAppStore} from '../store/appStore';
import {getProjectCapabilities} from '../projectMode';
import {isSystemNegativeSpaceCategory} from '../services/worldBible/systemNegativeSpace';
import {useWorldBibleProjectData} from '../hooks/useWorldBibleProjectData';
import {PortableDataPanel} from '../components/WorldBible/PortableDataPanel';
import {RouteFeedback} from '../components/common';
import styles from '../styles/CharactersRoute.module.css';

/** Project-wide Markdown + CSV export and Markdown folder import (More → Utilities). */
function PortableDataRoute() {
  const activeProject = useAppStore((state) => state.activeProject);
  const projectSettings = useAppStore((state) => state.projectSettings);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const {
    categories,
    categoriesLoaded,
    entities,
    aliases,
    canonicalFacts,
    loreDocuments,
    loreDocumentLinks,
    ragService,
    shodhService
  } = useWorldBibleProjectData({activeProject, setFeedback});
  const showGameSystems = getProjectCapabilities(projectSettings).canUseGameSystems;
  const visibleCategories = useMemo(
    () => showGameSystems
      ? categories
      : categories.filter((category) => !isSystemNegativeSpaceCategory(category)),
    [categories, showGameSystems]
  );

  if (!activeProject) {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>Portable data</h1>
        <p>No active project. Open a project before exporting or importing portable data.</p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Portable data</h1>
      <p className={styles.lead}>
        Move your World Bible and Source Notes in and out of SagaSpine as plain files,
        for example to use them in Obsidian or a spreadsheet. Manuscript scenes and
        chapters aren't included. For a complete copy of the project, use{' '}
        <strong>Backup</strong> on the Projects page.
      </p>
      <RouteFeedback feedback={feedback} onClear={() => setFeedback(null)} />
      <PortableDataPanel
        project={activeProject}
        categories={visibleCategories}
        categoriesLoaded={categoriesLoaded}
        entities={entities}
        aliases={aliases}
        canonicalFacts={canonicalFacts}
        loreDocuments={loreDocuments}
        loreDocumentLinks={loreDocumentLinks}
        ragService={ragService}
        shodhService={shodhService}
        onFeedback={setFeedback}
      />
    </section>
  );
}

export default PortableDataRoute;
