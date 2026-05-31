import type {LoreEntityProposal} from '../../entityTypes';
import {LORE_ENTITY_PROPOSAL_STORE_NAME, openDb} from '../../db';

function emitLoreFactRecordsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('wbd:lore-fact-records-changed'));
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllLoreEntityProposals(): Promise<LoreEntityProposal[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LORE_ENTITY_PROPOSAL_STORE_NAME, 'readonly');
    const request = tx.objectStore(LORE_ENTITY_PROPOSAL_STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as LoreEntityProposal[]);
    request.onerror = () => reject(request.error);
  });
}

export async function getLoreEntityProposalsByProject(
  projectId: string
): Promise<LoreEntityProposal[]> {
  const all = await getAllLoreEntityProposals();
  return all
    .filter((proposal) => proposal.projectId === projectId)
    .sort((left, right) => right.createdAt - left.createdAt);
}

export async function replaceLoreEntityProposals(params: {
  projectId: string;
  loreDocumentId: string;
  proposals: LoreEntityProposal[];
}): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(LORE_ENTITY_PROPOSAL_STORE_NAME, 'readwrite');
  const store = tx.objectStore(LORE_ENTITY_PROPOSAL_STORE_NAME);
  const all = (await requestToPromise(store.getAll())) as LoreEntityProposal[];
  for (const proposal of all) {
    if (
      proposal.projectId === params.projectId &&
      proposal.loreDocumentId === params.loreDocumentId
    ) {
      await requestToPromise(store.delete(proposal.id));
    }
  }
  for (const proposal of params.proposals) {
    await requestToPromise(store.put(proposal));
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  emitLoreFactRecordsChanged();
}

export async function saveLoreEntityProposal(proposal: LoreEntityProposal): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LORE_ENTITY_PROPOSAL_STORE_NAME, 'readwrite');
    const request = tx.objectStore(LORE_ENTITY_PROPOSAL_STORE_NAME).put(proposal);
    request.onsuccess = () => {
      emitLoreFactRecordsChanged();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}
