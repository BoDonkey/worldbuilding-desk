import type {RefObject} from 'react';
import type {EntityCategory} from '../../entityTypes';
import styles from '../../assets/components/WorldBibleRoute.module.css';

interface WorldBibleCategoryRailProps {
  isCollapsed: boolean;
  categories: EntityCategory[];
  viewMode: 'category' | 'review';
  activeTab: string | null;
  showCategoryManager: boolean;
  isImportingEntities: boolean;
  isImportingJson: boolean;
  importInputRef: RefObject<HTMLInputElement | null>;
  jsonImportInputRef: RefObject<HTMLInputElement | null>;
  onSelectCategory: (categoryId: string) => void;
  onToggleCategoryManager: () => void;
  onDownloadJsonTemplate: () => void;
  onDownloadJsonSample: () => void;
}

export const WorldBibleCategoryRail = (props: WorldBibleCategoryRailProps) => {
  const {
    isCollapsed: isCategoryRailCollapsed, categories, viewMode, activeTab,
    showCategoryManager, isImportingEntities, isImportingJson, importInputRef,
    jsonImportInputRef, onSelectCategory: handleSelectCategoryTab,
    onToggleCategoryManager, onDownloadJsonTemplate: handleDownloadJsonTemplate,
    onDownloadJsonSample: handleDownloadJsonSample
  } = props;
  const setShowCategoryManager = (next: boolean) => {
    if (next !== showCategoryManager) onToggleCategoryManager();
  };
  return (
    <>
        {!isCategoryRailCollapsed && (
          <aside className={styles.categoryRail} aria-label='World Bible categories'>
            <div className={styles.categoryRailHeader}>
              <h2>Categories</h2>
              <span className={styles.categoryRailCount}>{categories.length}</span>
            </div>
            <div className={styles.tabNav}>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type='button'
                  onClick={() => handleSelectCategoryTab(cat.id)}
                  className={`${styles.tab} ${
                    viewMode === 'category' && activeTab === cat.id ? styles.active : ''
                  }`}
                >
                  {cat.name}
                </button>
              ))}
              <button
                onClick={() => setShowCategoryManager(!showCategoryManager)}
                className={styles.manageButton}
              >
                {showCategoryManager ? 'Close' : 'Manage Categories'}
              </button>
            </div>
            <div className={styles.categoryRailSection}>
              <h3>Templates</h3>
              <div className={styles.railActions}>
                <button
                  type='button'
                  onClick={() => importInputRef.current?.click()}
                  disabled={isImportingEntities}
                >
                  {isImportingEntities ? 'Importing...' : 'Import Docs'}
                </button>
                <button
                  type='button'
                  onClick={() => jsonImportInputRef.current?.click()}
                  disabled={isImportingJson}
                >
                  {isImportingJson ? 'Loading JSON...' : 'Import JSON'}
                </button>
                <button type='button' onClick={handleDownloadJsonTemplate}>
                  Download JSON Template
                </button>
                <button type='button' onClick={handleDownloadJsonSample}>
                  Download JSON Sample
                </button>
              </div>
            </div>
            <details className={styles.railHelpPanel}>
              <summary>Onboarding</summary>
              <div className={styles.helpBody}>
                <p>
                  Start here when you need stable canon before writing. Add only the records
                  you need for the next scene, then expand later.
                </p>
                <p>
                  Fast path: choose a category, create a record, and capture names,
                  alternative names, status, and one or two high-value facts the workspace
                  should recognize.
                </p>
                <p>
                  Import path: use the import cards in the active category, then review
                  anything marked as needing completion.
                </p>
              </div>
            </details>
            <details className={styles.railHelpPanel}>
              <summary>Workflow Help</summary>
              <div className={styles.helpBody}>
                <p>
                  Step 1: pick or create categories, then choose the active tab.
                </p>
                <p>
                  Step 2: add entries manually or import docs/JSON in batch.
                </p>
                <p>
                  Step 3: review/edit entries and optionally link to Compendium.
                </p>
                <p>
                  Step 4: for multi-project canon, promote key entries or sync parent canon.
                </p>
                <p>
                  Import JSON accepts: <code>[{"{...}"}]</code>,{' '}
                  <code>{"{"}entries: [{"{...}"}]{"}"}</code>,{' '}
                  <code>{"{"}items: [{"{...}"}]{"}"}</code>,{' '}
                  <code>{"{"}rows: [{"{...}"}]{"}"}</code>.
                </p>
              </div>
            </details>
          </aside>
        )}
    </>
  );
};
