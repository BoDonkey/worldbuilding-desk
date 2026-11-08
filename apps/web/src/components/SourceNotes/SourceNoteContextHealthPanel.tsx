import type {RAGDiagnostics} from '../../services/rag/types';
import {summarizeContent} from '../../services/lore/sourceNoteCapture';
import type {SourceNoteContextHealth} from '../../hooks/useSourceNoteContextHealth';
import styles from '../../styles/LoreRoute.module.css';

const RAG_TYPE_LABELS: Array<{type: keyof RAGDiagnostics['countsByType']; label: string}> = [
  {type: 'scene', label: 'Scenes'},
  {type: 'worldbible', label: 'World Bible'},
  {type: 'lore', label: 'Source Notes'},
  {type: 'canon_fact', label: 'Canon Facts'},
  {type: 'rule', label: 'Rules'}
];

interface SourceNoteContextHealthPanelProps {
  projectId: string;
  health: SourceNoteContextHealth;
  counts: {
    sourceNotes: number;
    acceptedFacts: number;
    worldRecords: number;
    characters: number;
  };
}

/** Shows what retrieval and project memory can see, with probe and rebuild tools. */
export function SourceNoteContextHealthPanel({
  projectId,
  health,
  counts
}: SourceNoteContextHealthPanelProps) {
  const {
    ragDiagnostics,
    shodhMemories,
    healthLoading,
    healthProbe,
    changeHealthProbe,
    healthProbeResults,
    healthProbeRunning,
    healthProbeSearched,
    healthRebuilding,
    healthRebuildResult,
    contextStaleReasons,
    contextMayNeedRebuild,
    handleHealthProbe,
    openHealthProbeResult,
    canOpenHealthProbeResult,
    handleRebuildProjectContext,
    canRebuild
  } = health;

  return (
    <section className={styles.healthPanel} aria-label='Project context health'>
      <div className={styles.healthHeader}>
        <div>
          <div className={styles.starterEyebrow}>Context health</div>
          <h2>Lore, Memory, and Retrieval</h2>
          <p>
            Check whether source notes, accepted canon, scene text, and memories are visible
            to the assistant context systems.
          </p>
        </div>
        <span
          className={`${styles.statusBadge} ${
            contextMayNeedRebuild ? styles.statusBadgeWarning : ''
          }`}
        >
          {healthRebuilding
            ? 'Rebuilding'
            : healthLoading
              ? 'Refreshing'
              : contextMayNeedRebuild
                ? 'May need rebuild'
                : 'Current'}
        </span>
      </div>

      <div className={styles.healthMetricGrid}>
        <div className={styles.healthMetric}>
          <span>Indexed context</span>
          <strong>{ragDiagnostics?.documentCount ?? 0}</strong>
          <small>{ragDiagnostics?.chunkCount ?? 0} chunks</small>
        </div>
        <div className={styles.healthMetric}>
          <span>Project memory</span>
          <strong>{shodhMemories.length}</strong>
          <small>
            {shodhMemories.filter((memory) => memory.projectId === projectId).length} local
          </small>
        </div>
        <div className={styles.healthMetric}>
          <span>Source notes</span>
          <strong>{counts.sourceNotes}</strong>
          <small>{counts.acceptedFacts} accepted facts</small>
        </div>
        <div className={styles.healthMetric}>
          <span>World records</span>
          <strong>{counts.worldRecords}</strong>
          <small>{counts.characters} character capability records</small>
        </div>
      </div>

      <div className={styles.healthBreakdown}>
        {RAG_TYPE_LABELS.map((entry) => (
          <span key={entry.type} className={styles.healthChip}>
            {entry.label}: {ragDiagnostics?.countsByType[entry.type] ?? 0}
          </span>
        ))}
      </div>

      <div
        className={`${styles.healthGuidance} ${
          contextMayNeedRebuild ? styles.healthGuidanceWarning : ''
        }`}
      >
        <strong>
          {contextMayNeedRebuild ? 'Context may be stale' : 'When to rebuild'}
        </strong>
        {contextMayNeedRebuild ? (
          <p>
            Rebuild because {contextStaleReasons.join(', ')}. This refreshes
            derived context without changing saved story or canon records.
          </p>
        ) : (
          <p>
            Rebuild after importing or restoring a project, making large canon
            changes, deleting many records, or when retrieval results look stale.
          </p>
        )}
      </div>

      <div className={styles.healthActions}>
        <div>
          <strong>Rebuild derived context</strong>
          <p>
            Refresh indexed context from saved scenes, World Bible records, Source
            Notes, accepted canon facts, and rules. Project memory summaries are
            refreshed for scenes, World Bible records, accepted canon facts, and
            rules.
          </p>
        </div>
        <button
          type='button'
          onClick={handleRebuildProjectContext}
          disabled={healthRebuilding || !canRebuild}
        >
          {healthRebuilding ? 'Rebuilding...' : 'Rebuild Context'}
        </button>
      </div>

      {healthRebuildResult ? (
        <div className={styles.healthRebuildSummary} role='status'>
          Rebuilt {healthRebuildResult.scenes} scene
          {healthRebuildResult.scenes === 1 ? '' : 's'}, {healthRebuildResult.worldRecords}{' '}
          World Bible record
          {healthRebuildResult.worldRecords === 1 ? '' : 's'}, {healthRebuildResult.loreDocuments}{' '}
          lore document
          {healthRebuildResult.loreDocuments === 1 ? '' : 's'}, {healthRebuildResult.canonFacts}{' '}
          canon fact
          {healthRebuildResult.canonFacts === 1 ? '' : 's'}, and {healthRebuildResult.rulesets}{' '}
          ruleset
          {healthRebuildResult.rulesets === 1 ? '' : 's'}.
        </div>
      ) : null}

      <form
        className={styles.healthProbe}
        onSubmit={(event) => {
          event.preventDefault();
          void handleHealthProbe();
        }}
      >
        <label>
          Probe retrieval
          <input
            value={healthProbe}
            onChange={(event) => changeHealthProbe(event.target.value)}
            placeholder='Try a character, place, alias, or lore phrase'
          />
        </label>
        <button type='submit' disabled={healthProbeRunning || !healthProbe.trim()}>
          {healthProbeRunning ? 'Running...' : 'Run Probe'}
        </button>
      </form>
      <p className={styles.healthProbeHint}>
        Shows up to 5 indexed chunks to test retrieval health. If expected material is
        missing, rebuild context first; if it is still missing, confirm the source was
        saved, accepted into canon, or indexed by the relevant workflow.
      </p>

      {healthProbeResults.length > 0 ? (
        <div className={styles.healthResults}>
          <p className={styles.healthResultSummary}>
            Showing {healthProbeResults.length} indexed context chunk
            {healthProbeResults.length === 1 ? '' : 's'}. Multiple chunks can come from
            the same source.
          </p>
          {healthProbeResults.map((result) => (
            <article key={result.chunk.id} className={styles.healthResult}>
              <div>
                <strong>{result.chunk.documentTitle}</strong>
                <span>{result.chunk.metadata.type.replace(/_/g, ' ')}</span>
              </div>
              <p>{summarizeContent(result.chunk.content, 180)}</p>
              {canOpenHealthProbeResult(result) ? (
                <button
                  type='button'
                  className={styles.healthResultAction}
                  onClick={() => openHealthProbeResult(result)}
                >
                  Open Source
                </button>
              ) : null}
            </article>
          ))}
        </div>
      ) : healthProbeSearched && !healthProbeRunning ? (
        <p className={styles.healthNoResults} role='status'>
          No matching indexed context found. Rebuild if the phrase exists in saved
          source material; otherwise save or accept the source content before probing again.
        </p>
      ) : null}
    </section>
  );
}
