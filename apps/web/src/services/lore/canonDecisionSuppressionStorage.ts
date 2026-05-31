import type {CanonDecisionSuppression} from '../../entityTypes';
import {CANON_DECISION_SUPPRESSION_STORE_NAME, openDb} from '../../db';

function emitCanonDecisionRecordsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('wbd:canon-decision-records-changed'));
}

export function buildEntityDecisionSuppressionKey(params: {
  proposalName: string;
  targetName: string;
}): string {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
  const pair = [normalize(params.proposalName), normalize(params.targetName)].sort();
  return `entity:${pair.join('|')}`;
}

export function buildFactDecisionSuppressionKey(params: {
  targetType: 'character' | 'entity';
  targetId: string;
  factType: string;
  canonicalValue: string;
  proposalValue: string;
}): string {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
  return [
    'fact',
    params.targetType,
    params.targetId,
    params.factType,
    normalize(params.canonicalValue),
    normalize(params.proposalValue)
  ].join('|');
}

async function getAllSuppressionRecords(): Promise<CanonDecisionSuppression[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CANON_DECISION_SUPPRESSION_STORE_NAME, 'readonly');
    const request = tx.objectStore(CANON_DECISION_SUPPRESSION_STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as CanonDecisionSuppression[]);
    request.onerror = () => reject(request.error);
  });
}

export async function getCanonDecisionSuppressionsByProject(
  projectId: string
): Promise<CanonDecisionSuppression[]> {
  const all = await getAllSuppressionRecords();
  return all.filter((record) => record.projectId === projectId);
}

export async function saveCanonDecisionSuppression(
  record: CanonDecisionSuppression
): Promise<void> {
  const existing = (await getCanonDecisionSuppressionsByProject(record.projectId)).find(
    (candidate) => candidate.kind === record.kind && candidate.key === record.key
  );
  const nextRecord = existing
    ? {
        ...existing,
        resolution: record.resolution,
        updatedAt: record.updatedAt
      }
    : record;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CANON_DECISION_SUPPRESSION_STORE_NAME, 'readwrite');
    const request = tx.objectStore(CANON_DECISION_SUPPRESSION_STORE_NAME).put(nextRecord);
    request.onsuccess = () => {
      emitCanonDecisionRecordsChanged();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}
