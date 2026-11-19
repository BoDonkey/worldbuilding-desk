import styles from '../../assets/components/Editor.module.css';
import type {EditorContextPopoverControls} from '../../hooks/useEditorContextPopovers';
import type {LoreInspectorRecord} from '../../services/workspace/workspaceConsultation';
import {ContextPopover} from './ContextPopover';

/** The lore peek and stat-block preview popovers, when open. */
export function EditorContextPopovers({
  popovers,
  onOpenLoreInspector,
  onRebindStatBlockToken
}: {
  popovers: EditorContextPopoverControls;
  onOpenLoreInspector?: (record: LoreInspectorRecord) => void;
  onRebindStatBlockToken?: (rawToken: string) => void;
}) {
  const {loreRecord, loreAnchor, statBlockPopover, setStatBlockPopover, closeLorePopover} = popovers;
  return (
    <>
      {loreRecord && loreAnchor && (
        <ContextPopover
          title={loreRecord.name}
          message={loreRecord.type === 'character' ? 'Character lore peek' : 'World lore peek'}
          left={loreAnchor.left}
          top={loreAnchor.top}
          onClose={closeLorePopover}
        >
          <div className={styles.lorePeekVitals}>
            {loreRecord.vitalSigns.map((item) => (
              <span key={item} className={styles.loreVitalChip}>
                {item}
              </span>
            ))}
          </div>
          <div className={styles.lorePeekList}>
            <div>
              <strong>Goal:</strong> {loreRecord.synopsis.goal}
            </div>
            <div>
              <strong>Recent Event:</strong> {loreRecord.synopsis.recentEvent}
            </div>
            <div>
              <strong>Motivation:</strong> {loreRecord.synopsis.motivation}
            </div>
          </div>
          <div className={styles.systemActions}>
            <button
              type='button'
              onClick={() => {
                onOpenLoreInspector?.(loreRecord);
                closeLorePopover();
              }}
            >
              Open Lore Inspector
            </button>
          </div>
        </ContextPopover>
      )}
      {statBlockPopover && (
        <ContextPopover
          title={statBlockPopover.preview.title}
          message={statBlockPopover.preview.message}
          left={statBlockPopover.left}
          top={statBlockPopover.top}
          onClose={() => setStatBlockPopover(null)}
        >
          <div className={styles.statBlockPopoverMeta}>
            <span
              className={`${styles.statBlockStatusChip} ${
                statBlockPopover.preview.status === 'resolved'
                  ? styles.statBlockStatusResolved
                  : statBlockPopover.preview.status === 'ambiguous'
                    ? styles.statBlockStatusAmbiguous
                    : styles.statBlockStatusMissing
              }`}
            >
              {statBlockPopover.preview.status === 'resolved'
                ? 'Linked'
                : statBlockPopover.preview.status === 'ambiguous'
                  ? 'Needs rebind'
                  : 'Missing source'}
            </span>
            <span className={styles.statBlockKindLabel}>
              {statBlockPopover.preview.sourceType === 'character'
                ? 'Character'
                : 'Entity'}
            </span>
          </div>
          {statBlockPopover.preview.html && (
            <div
              className={styles.statBlockPreviewCard}
              dangerouslySetInnerHTML={{__html: statBlockPopover.preview.html}}
            />
          )}
          {statBlockPopover.preview.requiresRebind && (
            <div className={styles.systemActions}>
              <button
                type='button'
                onClick={() => {
                  onRebindStatBlockToken?.(statBlockPopover.preview.rawToken);
                  setStatBlockPopover(null);
                }}
              >
                Rebind Token
              </button>
            </div>
          )}
        </ContextPopover>
      )}
    </>
  );
}
