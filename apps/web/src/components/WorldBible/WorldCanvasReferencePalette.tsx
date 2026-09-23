import {useEffect, useState} from 'react';
import type {WorldCanvasLensKind} from '../../entityTypes';
import type {
  CanvasReference,
  CanvasReferenceSourceType,
  WorldCanvasReferencePalette
} from '../../services/worldBible/worldCanvasDerived';
import {describeError} from '../../services/errors';
import {LENS_DEFINITIONS} from '../../services/worldBible/worldCanvasService';
import styles from './WorldCanvasView.module.css';

interface WorldCanvasReferencePaletteProps {
  palette: WorldCanvasReferencePalette;
  onOpenSourceNote?: (id: string) => void;
  onOpenEntity?: (id: string) => void;
  onPin: (
    target: {sourceType: CanvasReferenceSourceType; id: string},
    lensKind: WorldCanvasLensKind
  ) => Promise<unknown>;
  onUnpin: (target: {sourceType: CanvasReferenceSourceType; id: string}) => Promise<unknown>;
  onFeedback?: (feedback: {tone: 'success' | 'error'; message: string}) => void;
}

const LENS_LABELS = new Map(LENS_DEFINITIONS.map((lens) => [lens.kind, lens.label]));
const referenceKey = (reference: CanvasReference) => `${reference.sourceType}:${reference.id}`;
const trustLabel = (reference: CanvasReference) => reference.sourceType === 'world-bible'
  ? 'Accepted canon'
  : 'Source material';

export function WorldCanvasReferencePaletteView({
  palette,
  onOpenSourceNote,
  onOpenEntity,
  onPin,
  onUnpin,
  onFeedback
}: WorldCanvasReferencePaletteProps) {
  const [lensSelections, setLensSelections] = useState<Record<string, WorldCanvasLensKind>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    setLensSelections((current) => {
      const next = {...current};
      [...palette.suggested, ...palette.browse].forEach((reference) => {
        const key = referenceKey(reference);
        next[key] ??= reference.lensKinds[0] ?? 'people';
      });
      return next;
    });
  }, [palette.browse, palette.suggested]);

  const openReference = (reference: CanvasReference) => {
    if (reference.existence === 'missing') return;
    if (reference.sourceType === 'world-bible') onOpenEntity?.(reference.id);
    else onOpenSourceNote?.(reference.id);
  };

  const pin = async (reference: CanvasReference) => {
    const key = referenceKey(reference);
    const lensKind = lensSelections[key] ?? reference.lensKinds[0] ?? 'people';
    setBusyKey(`pin:${key}`);
    try {
      await onPin({sourceType: reference.sourceType, id: reference.id}, lensKind);
      onFeedback?.({tone: 'success', message: 'Reference pinned.'});
    } catch (error) {
      console.error(error);
      onFeedback?.({tone: 'error', message: describeError(error, 'Unable to pin this reference.')});
    } finally {
      setBusyKey(null);
    }
  };

  const unpin = async (reference: CanvasReference) => {
    const key = referenceKey(reference);
    setBusyKey(`unpin:${key}`);
    try {
      await onUnpin({sourceType: reference.sourceType, id: reference.id});
      onFeedback?.({tone: 'success', message: 'Reference unpinned.'});
    } catch (error) {
      console.error(error);
      onFeedback?.({tone: 'error', message: describeError(error, 'Unable to unpin this reference.')});
    } finally {
      setBusyKey(null);
    }
  };

  const renderCard = (reference: CanvasReference, mode: 'pinned' | 'available') => {
    const key = referenceKey(reference);
    const selection = lensSelections[key] ?? reference.lensKinds[0] ?? 'people';
    return <div className={styles.referenceCard} data-canvas-reference={key} key={key}>
      <div className={styles.referenceDetails}>
        <div className={styles.referenceBadges}>
          <span className={styles.referenceBadge}>{trustLabel(reference)}</span>
          {reference.existence === 'missing' && <span className={styles.staleBadge}>Missing source</span>}
        </div>
        <strong>{reference.label}</strong>
        <p>{reference.provenanceLabel}</p>
        {reference.rule && <p className={styles.referenceRule}>{reference.rule}</p>}
        {mode === 'pinned' && reference.lensKinds.length > 0 && <p>
          {reference.lensKinds.map((kind) => LENS_LABELS.get(kind) ?? kind).join(', ')}
        </p>}
      </div>
      <div className={styles.referenceActions}>
        {reference.existence === 'available' && <button type='button' onClick={() => openReference(reference)}>Open</button>}
        {mode === 'pinned' ? (
          <button type='button' disabled={busyKey === `unpin:${key}`} onClick={() => void unpin(reference)}>
            {busyKey === `unpin:${key}` ? 'Unpinning...' : 'Unpin'}
          </button>
        ) : (
          <>
            <label>
              Lens
              <select value={selection} onChange={(event) => setLensSelections((current) => ({...current, [key]: event.target.value as WorldCanvasLensKind}))}>
                {LENS_DEFINITIONS.map((lens) => <option key={lens.kind} value={lens.kind}>{lens.label}</option>)}
              </select>
            </label>
            <button type='button' disabled={busyKey === `pin:${key}`} onClick={() => void pin(reference)}>
              {busyKey === `pin:${key}` ? 'Pinning...' : 'Pin'}
            </button>
          </>
        )}
      </div>
    </div>;
  };

  return <section className={styles.section} aria-labelledby='world-canvas-reference-palette-heading'>
    <div className={styles.sectionHeader}>
      <div>
        <h3 id='world-canvas-reference-palette-heading'>Reference Palette</h3>
        <p>Keep chosen project material close while you sketch. References stay in their original World Bible or Source Note.</p>
      </div>
    </div>

    <div className={styles.paletteGroup}>
      <h4>Pinned references</h4>
      <p className={styles.paletteHelp}>Only references you deliberately link or pin appear here.</p>
      <div className={styles.referenceList}>
        {palette.pinned.length
          ? palette.pinned.map((reference) => renderCard(reference, 'pinned'))
          : <p className={styles.emptyCopy}>No pinned references yet.</p>}
      </div>
    </div>

    <details className={styles.paletteGroup}>
      <summary>Suggested references ({palette.suggested.length})</summary>
      <p className={styles.paletteHelp}>Suggestions use the stated category, Source Note type, or record-link rule. Nothing is pinned automatically.</p>
      <div className={styles.referenceList}>
        {palette.suggested.length
          ? palette.suggested.map((reference) => renderCard(reference, 'available'))
          : <p className={styles.emptyCopy}>No deterministic suggestions for this project yet.</p>}
      </div>
    </details>

    {palette.browse.length > 0 && <details className={styles.paletteGroup}>
      <summary>Browse other project references ({palette.browse.length})</summary>
      <p className={styles.paletteHelp}>These references do not have a safe automatic lens match. Choose the lens yourself if you pin one.</p>
      <div className={styles.referenceList}>{palette.browse.map((reference) => renderCard(reference, 'available'))}</div>
    </details>}
  </section>;
}
