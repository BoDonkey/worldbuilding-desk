import type {StoryDashboard as StoryDashboardData} from '../../services/dashboard/storyDashboard';
import type {ProjectAISettings, WritingDocument} from '../../entityTypes';
import type {ProgressionContinuityCandidate} from '../../services/progressionContinuity/progressionContinuityCandidates';
import {WritingCoachSection} from './WritingCoachSection';
import {ProgressionContinuitySection} from './ProgressionContinuitySection';
import styles from '../../styles/CorkboardRoute.module.css';

interface StoryDashboardProps {
  dashboard: StoryDashboardData;
  status: 'idle' | 'loading' | 'ready' | 'error';
  onOpenScene: (sceneId: string) => void;
  projectId: string;
  aiConfig?: ProjectAISettings;
  documents: WritingDocument[];
  progressionContinuityCandidates: ProgressionContinuityCandidate[];
}

const formatNumber = (value: number) => new Intl.NumberFormat().format(value);
const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

export function StoryDashboard({
  dashboard,
  status,
  onOpenScene,
  projectId,
  aiConfig,
  documents,
  progressionContinuityCandidates
}: StoryDashboardProps) {
  if (status === 'loading' || status === 'idle') {
    return <div className={styles.derivedEmpty}>Reading manuscript and continuity data...</div>;
  }
  if (status === 'error') {
    return (
      <div className={styles.derivedEmpty} role='alert'>
        Story observations could not be calculated from the saved project data.
      </div>
    );
  }
  if (dashboard.scenes.length === 0) {
    return (
      <div className={styles.derivedEmpty}>
        Add a scene in Workspace to begin calculating story observations.
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.derivedNotice}>
        <div>
          <span className={styles.derivedEyebrow}>Derived from saved inputs</span>
          <h2>Story observations</h2>
        </div>
        <p>
          These read-only measurements use manuscript text, accepted continuity changes,
          explicit chapter links, and configured rules. They do not judge the story.
        </p>
      </div>

      <section className={styles.dashboardSection} aria-labelledby='dashboard-overview'>
        <div className={styles.dashboardSectionHeader}>
          <div>
            <span className={styles.derivedEyebrow}>Manuscript</span>
            <h2 id='dashboard-overview'>Overview</h2>
          </div>
          <SourceScenes sceneIds={dashboard.sourceSceneIds} scenes={dashboard.scenes} onOpenScene={onOpenScene} />
        </div>
        <div className={styles.metricGrid}>
          <Metric label='Scenes' value={formatNumber(dashboard.scenes.length)} input='Saved manuscript scenes' />
          <Metric label='Words' value={formatNumber(dashboard.totalWords)} input='Words in saved scene text' />
          <Metric
            label='Dialogue ratio'
            value={formatPercent(dashboard.dialogueRatio)}
            input={`${formatNumber(dashboard.totalQuotedWords)} words inside quotation marks / ${formatNumber(dashboard.totalWords)} total words`}
          />
          <Metric
            label='Accepted changes'
            value={formatNumber(dashboard.acceptedCommandCount)}
            input={`${formatNumber(dashboard.acceptedEventCount)} accepted scene event${dashboard.acceptedEventCount === 1 ? '' : 's'}`}
          />
        </div>
      </section>

      <section className={styles.dashboardSection} aria-labelledby='dashboard-scenes'>
        <div className={styles.dashboardSectionHeader}>
          <div>
            <span className={styles.derivedEyebrow}>Scene inputs</span>
            <h2 id='dashboard-scenes'>Scene rhythm</h2>
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.metricsTable}>
            <thead><tr><th>Scene</th><th>Words</th><th>Dialogue</th><th>Accepted changes</th></tr></thead>
            <tbody>
              {dashboard.scenes.map((scene) => (
                <tr key={scene.sceneId}>
                  <th scope='row'>
                    <button type='button' className={styles.sceneLink} onClick={() => onOpenScene(scene.sceneId)}>
                      {scene.title}
                    </button>
                  </th>
                  <td>{formatNumber(scene.wordCount)}</td>
                  <td>{formatPercent(scene.dialogueRatio)}</td>
                  <td>{formatNumber(scene.acceptedChangeCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.inputNote}>Dialogue is measured as words inside quotation marks divided by total scene words.</p>
      </section>

      <section className={styles.dashboardSection} aria-labelledby='dashboard-chapters'>
        <div className={styles.dashboardSectionHeader}>
          <div>
            <span className={styles.derivedEyebrow}>Explicit card links only</span>
            <h2 id='dashboard-chapters'>Chapter rollups</h2>
          </div>
        </div>
        {dashboard.chapters.length === 0 ? (
          <p className={styles.derivedEmpty}>Link scenes from a Chapter Card to calculate chapter totals. Titles and order are never used to guess links.</p>
        ) : (
          <div className={styles.observationList}>
            {dashboard.chapters.map((chapter) => (
              <article key={chapter.cardId} className={styles.observation}>
                <div className={styles.observationHeader}>
                  <h3>{chapter.title}</h3>
                  <span className={styles.countChip}>{chapter.status}</span>
                </div>
                <p>{formatNumber(chapter.wordCount)} words · {formatPercent(chapter.dialogueRatio)} dialogue · {formatNumber(chapter.acceptedChangeCount)} accepted changes</p>
                <SourceScenes sceneIds={chapter.sourceSceneIds} scenes={dashboard.scenes} onOpenScene={onOpenScene} />
                {chapter.missingSceneIds.length > 0 && (
                  <p className={styles.inputWarning}>{chapter.missingSceneIds.length} saved link{chapter.missingSceneIds.length === 1 ? '' : 's'} point to missing scenes.</p>
                )}
              </article>
            ))}
          </div>
        )}
        {dashboard.unlinkedCardCount > 0 && (
          <p className={styles.inputNote}>{dashboard.unlinkedCardCount} chapter card{dashboard.unlinkedCardCount === 1 ? ' is' : 's are'} intentionally excluded because no scenes are linked.</p>
        )}
      </section>

      <section className={styles.dashboardSection} aria-labelledby='dashboard-continuity'>
        <div className={styles.dashboardSectionHeader}>
          <div>
            <span className={styles.derivedEyebrow}>Accepted events only</span>
            <h2 id='dashboard-continuity'>Continuity change distribution</h2>
          </div>
        </div>
        {dashboard.stateDistribution.length === 0 ? (
          <p className={styles.derivedEmpty}>No accepted scene changes are recorded yet.</p>
        ) : (
          <div className={styles.observationList}>
            {dashboard.stateDistribution.map((metric) => (
              <article key={metric.category} className={styles.observation}>
                <div className={styles.observationHeader}>
                  <h3>{metric.category}</h3>
                  <strong>{metric.commandCount}</strong>
                </div>
                <p>{metric.commandCount} recorded change{metric.commandCount === 1 ? '' : 's'} across {metric.eventCount} accepted event{metric.eventCount === 1 ? '' : 's'}.</p>
                <SourceScenes sceneIds={metric.sourceSceneIds} scenes={dashboard.scenes} onOpenScene={onOpenScene} />
              </article>
            ))}
          </div>
        )}
        {dashboard.missingEventSceneIds.length > 0 && (
          <p className={styles.inputWarning}>{dashboard.missingEventSceneIds.length} missing source scene{dashboard.missingEventSceneIds.length === 1 ? '' : 's'} are excluded from observations.</p>
        )}
      </section>

      {dashboard.mechanics && <MechanicsDashboard dashboard={dashboard} onOpenScene={onOpenScene} />}

      <ProgressionContinuitySection
        candidates={progressionContinuityCandidates}
        documents={documents}
        scenes={dashboard.scenes}
        projectId={projectId}
        aiConfig={aiConfig}
        onOpenScene={onOpenScene}
      />

      <WritingCoachSection dashboard={dashboard} projectId={projectId} aiConfig={aiConfig} />
    </div>
  );
}

function MechanicsDashboard({dashboard, onOpenScene}: Pick<StoryDashboardProps, 'dashboard' | 'onOpenScene'>) {
  const mechanics = dashboard.mechanics!;
  return (
    <section className={styles.dashboardSection} aria-labelledby='dashboard-mechanics'>
      <div className={styles.dashboardSectionHeader}>
        <div>
          <span className={styles.derivedEyebrow}>Configured mechanics</span>
          <h2 id='dashboard-mechanics'>Progression and co-movement</h2>
        </div>
      </div>
      <div className={styles.metricGrid}>
        <Metric label='Tracked axes changed' value={formatNumber(mechanics.axes.length)} input='Configured numeric attributes and resources in accepted events' />
        <Metric label='Advancement changes' value={formatNumber(mechanics.advancementChangeCount)} input='Positive changes to explicitly named level, tier, rank, experience, XP, advancement, or progress axes' />
        <Metric label='Advancement rate' value={mechanics.advancementChangesPerTenThousandWords === null ? '—' : `${mechanics.advancementChangesPerTenThousandWords.toFixed(1)} / 10k words`} input='Advancement changes / manuscript word count' />
      </div>
      {mechanics.axes.length > 0 && (
        <div className={styles.observationList}>
          {mechanics.axes.map((axis) => (
            <article key={axis.axisId} className={styles.observation}>
              <div className={styles.observationHeader}><h3>{axis.label}</h3><strong>{axis.commandCount}</strong></div>
              <p>{axis.kind === 'attribute' ? 'Attribute' : 'Resource'} changes recorded in accepted events.</p>
              <SourceScenes sceneIds={axis.sourceSceneIds} scenes={dashboard.scenes} onOpenScene={onOpenScene} />
            </article>
          ))}
        </div>
      )}
      <div className={styles.mechanicsSubsection}>
        <h3>Multi-axis scenes</h3>
        {mechanics.coMovements.length === 0 ? <p className={styles.derivedEmpty}>No scene changes two or more configured axes.</p> : (
          <ul className={styles.plainList}>{mechanics.coMovements.map((item) => (
            <li key={item.sceneId}><button type='button' className={styles.sceneLink} onClick={() => onOpenScene(item.sceneId)}>{item.sceneTitle}</button><span>{item.axisLabels.join(', ')}</span></li>
          ))}</ul>
        )}
      </div>
      <div className={styles.mechanicsSubsection}>
        <h3>Advancement intervals</h3>
        {mechanics.advancementIntervals.length === 0 ? <p className={styles.derivedEmpty}>Two accepted positive changes to the same explicitly named advancement axis are needed for an interval.</p> : (
          <ul className={styles.plainList}>{mechanics.advancementIntervals.map((interval, index) => (
            <li key={`${interval.axisId}:${interval.fromSceneId}:${interval.toSceneId}:${index}`}>
              <span><strong>{interval.axisLabel}</strong>: {interval.sceneInterval} scene position{interval.sceneInterval === 1 ? '' : 's'}, {formatNumber(interval.wordsBetween)} words between</span>
              <SourceScenes sceneIds={[interval.fromSceneId, interval.toSceneId]} scenes={dashboard.scenes} onOpenScene={onOpenScene} />
            </li>
          ))}</ul>
        )}
      </div>
    </section>
  );
}

function Metric({label, value, input}: {label: string; value: string; input: string}) {
  return <article className={styles.metric}><span>{label}</span><strong>{value}</strong><small>{input}</small></article>;
}

export function SourceScenes({sceneIds, scenes, onOpenScene}: {
  sceneIds: string[];
  scenes: StoryDashboardData['scenes'];
  onOpenScene: (sceneId: string) => void;
}) {
  const titles = new Map(scenes.map((scene) => [scene.sceneId, scene.title]));
  if (sceneIds.length === 0) return <span className={styles.sourceLabel}>No source scenes</span>;
  return (
    <div className={styles.sourceLinks} aria-label='Source scenes'>
      <span className={styles.sourceLabel}>Sources:</span>
      {sceneIds.map((sceneId) => (
        <button key={sceneId} type='button' className={styles.sourceLink} onClick={() => onOpenScene(sceneId)}>
          {titles.get(sceneId) ?? 'Missing scene'}
        </button>
      ))}
    </div>
  );
}
