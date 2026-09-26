import {useEffect, useId, useState} from 'react';
import {useLocation, useNavigate} from 'react-router';
import styles from '../styles/StatPinPanel.module.css';
import {useAppStore} from '../store/appStore';
import {useWorkspaceUiStore} from '../store/workspaceUiStore';
import {getProjectCapabilities} from '../projectMode';
import {useCharacterStatPeekData} from '../hooks/useCharacterStatPeekData';
import {sortWritingDocuments} from '../writingStorage';
import {resolveCharacterStatCardTemplate} from '../services/state/characterPeek';
import {
  describeCharacterSnapshotChanges,
  type CharacterSnapshot,
  type CharacterSnapshotPosition
} from '../services/state/characterSnapshot';
import {
  describeCharacterSnapshotChange,
  resolveChangesBaseline
} from '../services/state/statPanel';
import {CharacterStatCard} from './CharacterSheets/CharacterStatCard';
import {PinStatsButton} from './CharacterSheets/PinStatsButton';

/**
 * Keeps the panel clear of controls a route pins to the bottom of the screen
 * (marked `data-stat-panel-avoid`, e.g. Workspace's save bar): the distance from
 * the viewport bottom to just above that element, or null when there is none.
 */
function useAvoidedBottomOffset(enabled: boolean, routeKey: string): number | null {
  const [offset, setOffset] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let observed: Element | null = null;
    const measure = () => {
      const element = document.querySelector('[data-stat-panel-avoid]');
      if (element !== observed) {
        if (observed) resizeObserver?.unobserve(observed);
        if (element) resizeObserver?.observe(element);
        observed = element;
      }
      if (!element) {
        setOffset(null);
        return;
      }
      const next = Math.max(0, Math.round(window.innerHeight - element.getBoundingClientRect().top + 8));
      setOffset((current) => (current === next ? current : next));
    };
    let frame: number | null = null;
    const scheduleMeasure = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        measure();
      });
    };
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleMeasure);
    // The route may render its bar after the panel; re-check as the page settles.
    const mutationObserver = new MutationObserver(scheduleMeasure);
    mutationObserver.observe(document.body, {childList: true, subtree: true});
    scheduleMeasure();
    window.addEventListener('resize', scheduleMeasure);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
      setOffset(null);
    };
  }, [enabled, routeKey]);
  return offset;
}

const PANEL_ROUTES = ['/workspace', '/world-canvas', '/corkboard', '/world-bible'];
const NO_PINS: string[] = [];

/**
 * Up to three pinned characters' stat cards across the writing and
 * brainstorming routes. Follows the scene and cursor in Workspace; elsewhere
 * shows the latest state or the end of a chosen scene. Read-only.
 */
export function StatPinPanel({isRailCollapsed}: {isRailCollapsed: boolean}) {
  const location = useLocation();
  const navigate = useNavigate();
  const bodyId = useId();
  const activeProject = useAppStore((s) => s.activeProject);
  const projectSettings = useAppStore((s) => s.projectSettings);
  const projectId = activeProject?.id ?? null;
  const pins = useWorkspaceUiStore((s) =>
    projectId ? s.statPinsByProjectId[projectId] ?? NO_PINS : NO_PINS
  );
  const isOpen = useWorkspaceUiStore((s) => s.isStatPanelOpen);
  const setOpen = useWorkspaceUiStore((s) => s.setStatPanelOpen);
  const storedWorkspaceContext = useWorkspaceUiStore((s) => s.workspaceStatContext);
  const [asOf, setAsOf] = useState<{projectId: string | null; sceneId: string | null}>({
    projectId: null,
    sceneId: null
  });
  const [openChanges, setOpenChanges] = useState<Record<string, boolean>>({});

  const capabilities = getProjectCapabilities(activeProject ? projectSettings : null);
  const isOnPanelRoute = PANEL_ROUTES.some((route) => location.pathname.startsWith(route));
  const isVisible =
    Boolean(projectId) && capabilities.canUseGameSystems && isOnPanelRoute && pins.length > 0;
  const data = useCharacterStatPeekData(projectId, isVisible, location.pathname);
  const avoidBottom = useAvoidedBottomOffset(isVisible, location.pathname);

  if (!isVisible || !projectId) return null;

  const workspaceContext =
    location.pathname.startsWith('/workspace') && storedWorkspaceContext?.projectId === projectId
      ? storedWorkspaceContext
      : null;
  const orderedDocuments = sortWritingDocuments(data.documents);
  const asOfSceneId = asOf.projectId === projectId ? asOf.sceneId : null;
  const asOfScene = asOfSceneId
    ? orderedDocuments.find((document) => document.id === asOfSceneId) ?? null
    : null;

  let position: CharacterSnapshotPosition;
  let referenceSceneId: string | null;
  let asOfLabel: string;
  let getSnapshot: (sheetId: string, position: CharacterSnapshotPosition) => CharacterSnapshot | null;
  if (workspaceContext) {
    position = {
      kind: 'scene',
      sceneOrder: workspaceContext.sceneOrder,
      moment: 'cursor',
      cursorPosition: workspaceContext.cursorPosition
    };
    referenceSceneId = workspaceContext.sceneId;
    asOfLabel = `At the cursor in ${workspaceContext.sceneTitle}`;
    getSnapshot = workspaceContext.getSnapshot;
  } else if (asOfScene) {
    position = {
      kind: 'scene',
      sceneOrder: orderedDocuments.indexOf(asOfScene) + 1,
      moment: 'ending'
    };
    referenceSceneId = asOfScene.id;
    asOfLabel = `At the end of ${asOfScene.title || 'Untitled scene'}`;
    getSnapshot = data.getSnapshotAt;
  } else {
    position = {kind: 'latest'};
    referenceSceneId = orderedDocuments[orderedDocuments.length - 1]?.id ?? null;
    asOfLabel = 'Latest, after every accepted change';
    getSnapshot = data.getSnapshotAt;
  }
  const baseline = referenceSceneId
    ? resolveChangesBaseline({
        documents: data.documents,
        chapterCards: data.chapterCards,
        sceneId: referenceSceneId
      })
    : null;
  const template = resolveCharacterStatCardTemplate(projectSettings?.statBlockPreferences);

  return (
    <aside
      className={`${styles.panel} ${isRailCollapsed ? styles.railCollapsed : styles.railExpanded}`}
      aria-label='Pinned stats'
      style={avoidBottom ? {bottom: `${avoidBottom}px`} : undefined}
    >
      <div className={styles.header}>
        <button
          type='button'
          className={styles.toggle}
          aria-expanded={isOpen}
          aria-controls={bodyId}
          onClick={() => setOpen(!isOpen)}
        >
          Pinned stats ({pins.length})
        </button>
        {isOpen && !workspaceContext && (
          <label className={styles.asOf}>
            As of
            <select
              value={asOfScene?.id ?? 'latest'}
              onChange={(event) =>
                setAsOf({
                  projectId,
                  sceneId: event.target.value === 'latest' ? null : event.target.value
                })
              }
            >
              <option value='latest'>Latest</option>
              {orderedDocuments.map((document) => (
                <option key={document.id} value={document.id}>
                  End of {document.title || 'Untitled scene'}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {isOpen && (
        <div id={bodyId} className={styles.body}>
          {pins.map((sheetId) => {
            const target = data.targets.find((candidate) => candidate.sheetId === sheetId);
            const snapshot = data.isLoaded || workspaceContext ? getSnapshot(sheetId, position) : null;
            if (!snapshot) {
              return (
                <div key={sheetId} className={styles.missing}>
                  <span>
                    {data.isLoaded
                      ? 'A pinned character no longer has a stats sheet.'
                      : 'Loading pinned stats…'}
                  </span>
                  {data.isLoaded && (
                    <PinStatsButton sheetId={sheetId} name={target?.name ?? 'this character'} />
                  )}
                </div>
              );
            }
            const showChanges = Boolean(openChanges[sheetId]);
            const before =
              showChanges && baseline
                ? getSnapshot(sheetId, {
                    kind: 'scene',
                    sceneOrder: baseline.sceneOrder,
                    moment: 'opening'
                  })
                : null;
            const changes = before ? describeCharacterSnapshotChanges(before, snapshot) : [];
            return (
              <CharacterStatCard
                key={sheetId}
                snapshot={snapshot}
                asOfLabel={asOfLabel}
                template={template}
                density='compact'
                actions={
                  <>
                    <div className={styles.cardActions}>
                      <button
                        type='button'
                        aria-expanded={showChanges}
                        onClick={() =>
                          setOpenChanges((current) => ({...current, [sheetId]: !showChanges}))
                        }
                      >
                        Changes since previous chapter
                      </button>
                      {capabilities.canUseRuleAuthoring && (
                        <button
                          type='button'
                          onClick={() =>
                            navigate('/sheets', {
                              state: {prefillSheetId: sheetId, showAdvanced: true}
                            })
                          }
                        >
                          Open sheet
                        </button>
                      )}
                      <PinStatsButton sheetId={sheetId} name={snapshot.name} />
                    </div>
                    {showChanges && (
                      <div className={styles.changes} aria-label={`${snapshot.name} changes`}>
                        {baseline ? (
                          <>
                            <div>{baseline.label}</div>
                            {changes.length > 0 ? (
                              <ul>
                                {changes.map((change, index) => (
                                  <li key={index}>{describeCharacterSnapshotChange(change)}</li>
                                ))}
                              </ul>
                            ) : (
                              <div>No changes.</div>
                            )}
                          </>
                        ) : (
                          <div>Save a scene to compare against the previous chapter.</div>
                        )}
                      </div>
                    )}
                  </>
                }
              />
            );
          })}
        </div>
      )}
    </aside>
  );
}
