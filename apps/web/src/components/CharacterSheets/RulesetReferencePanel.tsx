import type {Project, StoredRuleset} from '../../entityTypes';
import {ShodhMemoryPanel} from '../ShodhMemoryPanel';
import {promoteMemoryToParent} from '../../services/seriesBible/SeriesBibleService';
import type {CharacterSheetRulesetMemory} from '../../hooks/useCharacterSheetRulesetMemory';
import styles from '../../styles/CharacterSheetsRoute.module.css';

interface RulesetReferencePanelProps {
  activeProject: Project;
  ruleset: StoredRuleset;
  memory: CharacterSheetRulesetMemory;
}

/** The ruleset's memory summary, with promotion to a parent series when there is one. */
export function RulesetReferencePanel({activeProject, ruleset, memory}: RulesetReferencePanelProps) {
  const {
    rulesetMemory, rulesetMemoryFilter, setRulesetMemoryFilter,
    refreshRulesetMemory, handlePromoteRuleset
  } = memory;

  return (
    <>
      <details className={styles.rulesReference}>
        <summary>Ruleset reference and memory</summary>
        <ShodhMemoryPanel
          title={`${ruleset.name || 'World ruleset'} summary`}
          memories={rulesetMemory ? [rulesetMemory] : []}
          filterValue={rulesetMemoryFilter}
          onFilterChange={setRulesetMemoryFilter}
          highlightDocumentId={ruleset.id}
          onRefresh={() => void refreshRulesetMemory()}
          pageSize={1}
          scopeSummaryLabel='this ruleset'
          emptyState='No project memory found yet. Save the ruleset (Ruleset tab) to generate one.'
          renderSourceLabel={(entry) =>
            entry.projectId === activeProject.id ? 'Local' : 'Parent'
          }
          renderMemoryActions={(entry) => {
            if (
              activeProject.parentProjectId &&
              entry.projectId === activeProject.id
            ) {
              return (
                <button
                  type='button'
                  onClick={() => {
                    const parentId = activeProject.parentProjectId;
                    if (!parentId) return;
                    void promoteMemoryToParent(entry, parentId).then(() =>
                      refreshRulesetMemory()
                    );
                  }}
                  className={styles.inlineFontSize08rem}
                >
                  Promote
                </button>
              );
            }
            return null;
          }}
        />
      </details>
      {activeProject.parentProjectId && (
        <button
          type='button'
          className={styles.inlineMarginBottom1rem}
          onClick={() => void handlePromoteRuleset()}
        >
          Promote ruleset to parent
        </button>
      )}
    </>
  );
}
