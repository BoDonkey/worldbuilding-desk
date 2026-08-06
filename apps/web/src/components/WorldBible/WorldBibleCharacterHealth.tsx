import type {CanonicalFact, WorldEntity} from '../../entityTypes';
import type {MemoryEntry} from '../../services/shodh/ShodhMemoryService';
import type {useWorldBibleSelectedEntity} from '../../hooks/useWorldBibleSelectedEntity';
import {buildCanonicalFactSummary} from '../../services/lore/canonicalFactActions';
import styles from '../../assets/components/WorldBibleRoute.module.css';

const formatFactValue = (fact: CanonicalFact): string =>
  typeof fact.value === 'string' ? fact.value : `${fact.value.label}: ${fact.value.value}`;

interface WorldBibleCharacterHealthProps {
  selectedEntity: WorldEntity | null;
  selectedEntityAliases: string[];
  selectedEntityFacts: ReturnType<typeof useWorldBibleSelectedEntity>['selectedEntityFacts'];
  linkedLoreDocumentsForSelectedEntity: ReturnType<typeof useWorldBibleSelectedEntity>['linkedLoreDocumentsForSelectedEntity'];
  selectedEntitySceneMentions: ReturnType<typeof useWorldBibleSelectedEntity>['selectedEntitySceneMentions'];
  selectedEntityStateEvents: ReturnType<typeof useWorldBibleSelectedEntity>['selectedEntityStateEvents'];
  selectedEntityAcceptedStateEventCount: number;
  selectedEntityProposedStateEventCount: number;
  characterHealthProbeResults: ReturnType<typeof useWorldBibleSelectedEntity>['characterHealthProbeResults'];
  characterHealthProbeRunning: boolean;
  currentEntityMemories: MemoryEntry[];
  canProbe: boolean;
  handleCharacterHealthProbe: () => Promise<void>;
}

export const WorldBibleCharacterHealth = (props: WorldBibleCharacterHealthProps) => {
  const {
    selectedEntity, selectedEntityAliases, selectedEntityFacts,
    linkedLoreDocumentsForSelectedEntity, selectedEntitySceneMentions,
    selectedEntityStateEvents, selectedEntityAcceptedStateEventCount,
    selectedEntityProposedStateEventCount, characterHealthProbeResults,
    characterHealthProbeRunning, currentEntityMemories, canProbe,
    handleCharacterHealthProbe
  } = props;
  return (
    <>
                  {selectedEntity && (
                    <section
                      className={styles.characterHealthPanel}
                      aria-label='Character detail health'
                    >
                      <div className={styles.characterHealthHeader}>
                        <div>
                          <strong>Character detail health</strong>
                          <span>Canon, source notes, scenes, memory, and state for this character.</span>
                        </div>
                        <button
                          type='button'
                          onClick={() => void handleCharacterHealthProbe()}
                          disabled={characterHealthProbeRunning || !canProbe}
                        >
                          {characterHealthProbeRunning ? 'Searching...' : 'Probe context'}
                        </button>
                      </div>

                      <div className={styles.characterHealthMetrics}>
                        <div className={styles.characterHealthMetric}>
                          <span>Aliases</span>
                          <strong>{selectedEntityAliases.length}</strong>
                        </div>
                        <div className={styles.characterHealthMetric}>
                          <span>Facts</span>
                          <strong>{selectedEntityFacts.length}</strong>
                        </div>
                        <div className={styles.characterHealthMetric}>
                          <span>Source notes</span>
                          <strong>{linkedLoreDocumentsForSelectedEntity.length}</strong>
                        </div>
                        <div className={styles.characterHealthMetric}>
                          <span>Scenes</span>
                          <strong>{selectedEntitySceneMentions.length}</strong>
                        </div>
                        <div className={styles.characterHealthMetric}>
                          <span>Memories</span>
                          <strong>{currentEntityMemories.length}</strong>
                        </div>
                        <div className={styles.characterHealthMetric}>
                          <span>State</span>
                          <strong>{selectedEntityStateEvents.length}</strong>
                        </div>
                      </div>

                      <div className={styles.characterHealthColumns}>
                        <div className={styles.characterHealthCard}>
                          <strong>Aliases</strong>
                          {selectedEntityAliases.length > 0 ? (
                            <div className={styles.characterHealthChipRow}>
                              {selectedEntityAliases.map((alias) => (
                                <span key={alias} className={styles.characterHealthChip}>
                                  {alias}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p>No aliases recorded.</p>
                          )}
                        </div>

                        <div className={styles.characterHealthCard}>
                          <strong>Accepted facts</strong>
                          {selectedEntityFacts.length > 0 ? (
                            <ul className={styles.characterHealthList}>
                              {selectedEntityFacts.slice(0, 5).map((fact) => (
                                <li key={fact.id} title={buildCanonicalFactSummary(fact)}>
                                  <span>{fact.factType.replace(/_/g, ' ')}</span>
                                  <strong>{formatFactValue(fact)}</strong>
                                  {fact.sourceLoreDocumentTitle && (
                                    <small>{fact.sourceLoreDocumentTitle}</small>
                                  )}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p>No accepted facts yet.</p>
                          )}
                        </div>

                        <div className={styles.characterHealthCard}>
                          <strong>Linked lore docs</strong>
                          {linkedLoreDocumentsForSelectedEntity.length > 0 ? (
                            <ul className={styles.characterHealthList}>
                              {linkedLoreDocumentsForSelectedEntity.slice(0, 5).map(({link, document}) => (
                                <li key={link.id}>
                                  <span>{document.title}</span>
                                  <small>{document.kind.replace(/_/g, ' ')}</small>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p>No linked lore docs.</p>
                          )}
                        </div>

                        <div className={styles.characterHealthCard}>
                          <strong>Scene mentions</strong>
                          {selectedEntitySceneMentions.length > 0 ? (
                            <ul className={styles.characterHealthList}>
                              {selectedEntitySceneMentions.slice(0, 5).map(({document, mentionCount}) => (
                                <li key={document.id}>
                                  <span>{document.title}</span>
                                  <small>
                                    {mentionCount} {mentionCount === 1 ? 'mention' : 'mentions'}
                                  </small>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p>No scene mentions found.</p>
                          )}
                        </div>

                        <div className={styles.characterHealthCard}>
                          <strong>Shodh memory</strong>
                          {currentEntityMemories.length > 0 ? (
                            <ul className={styles.characterHealthList}>
                              {currentEntityMemories.slice(0, 5).map((memory) => (
                                <li key={memory.id}>
                                  <span>{memory.title}</span>
                                  <small>{memory.tags?.join(', ') || 'memory'}</small>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p>No memories captured for this record.</p>
                          )}
                        </div>

                        <div className={styles.characterHealthCard}>
                          <strong>State events</strong>
                          {selectedEntityStateEvents.length > 0 ? (
                            <>
                              <div className={styles.characterHealthChipRow}>
                                <span className={styles.characterHealthChip}>
                                  {selectedEntityAcceptedStateEventCount} accepted
                                </span>
                                <span className={styles.characterHealthChip}>
                                  {selectedEntityProposedStateEventCount} pending
                                </span>
                              </div>
                              <ul className={styles.characterHealthList}>
                                {selectedEntityStateEvents.slice(0, 5).map((event) => (
                                  <li key={event.id}>
                                    <span>{event.sceneTitle ?? 'Untitled scene'}</span>
                                    <small>{event.status}</small>
                                  </li>
                                ))}
                              </ul>
                            </>
                          ) : (
                            <p>No state events found.</p>
                          )}
                        </div>
                      </div>

                      {characterHealthProbeResults.length > 0 && (
                        <div className={styles.characterHealthProbeResults}>
                          <strong>RAG probe hits</strong>
                          <ul className={styles.characterHealthList}>
                            {characterHealthProbeResults.map((result) => (
                              <li key={result.chunk.id}>
                                <span>{result.chunk.documentTitle}</span>
                                <small>
                                  {result.chunk.metadata.type} · score {result.score.toFixed(2)}
                                </small>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </section>
                  )}
    </>
  );
};
