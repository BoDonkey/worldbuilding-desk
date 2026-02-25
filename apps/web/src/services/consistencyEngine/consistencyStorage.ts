import { openDb, CONSISTENCY_EVENT_STORE_NAME, CONSISTENCY_PROPOSAL_STORE_NAME } from '../../db';
import type { ExtractedProposal, GuardrailIssue, ValidationResult } from './types';

export interface GuardrailEvent {
  id: string;
  projectId: string;
  proposalId: string;
  kind: 'validation_blocked' | 'validation_passed' | 'apply';
  payload: {
    issues?: GuardrailIssue[];
    validation?: ValidationResult;
  };
  createdAt: number;
}

export async function saveProposal(proposal: ExtractedProposal): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CONSISTENCY_PROPOSAL_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CONSISTENCY_PROPOSAL_STORE_NAME);
    const request = store.put(proposal);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function saveGuardrailEvent(event: GuardrailEvent): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CONSISTENCY_EVENT_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CONSISTENCY_EVENT_STORE_NAME);
    const request = store.put(event);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}
