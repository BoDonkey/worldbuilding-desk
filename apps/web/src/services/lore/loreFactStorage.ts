import type {CanonicalFact, LoreFactProposal} from '../../entityTypes';
import {
  CANONICAL_FACT_STORE_NAME,
  LORE_FACT_PROPOSAL_STORE_NAME,
  openDb
} from '../../db';

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

async function getAllLoreFactProposals(): Promise<LoreFactProposal[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LORE_FACT_PROPOSAL_STORE_NAME, 'readonly');
    const request = tx.objectStore(LORE_FACT_PROPOSAL_STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as LoreFactProposal[]);
    request.onerror = () => reject(request.error);
  });
}

async function getAllCanonicalFacts(): Promise<CanonicalFact[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CANONICAL_FACT_STORE_NAME, 'readonly');
    const request = tx.objectStore(CANONICAL_FACT_STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as CanonicalFact[]);
    request.onerror = () => reject(request.error);
  });
}

export async function getLoreFactProposalsByProject(
  projectId: string
): Promise<LoreFactProposal[]> {
  const all = await getAllLoreFactProposals();
  return all
    .filter((proposal) => proposal.projectId === projectId)
    .sort((left, right) => right.createdAt - left.createdAt);
}

export async function getCanonicalFactsByProject(projectId: string): Promise<CanonicalFact[]> {
  const all = await getAllCanonicalFacts();
  return all
    .filter((fact) => fact.projectId === projectId)
    .sort((left, right) => right.acceptedAt - left.acceptedAt);
}

export async function replaceLoreFactProposals(params: {
  projectId: string;
  loreDocumentId: string;
  proposals: LoreFactProposal[];
}): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(LORE_FACT_PROPOSAL_STORE_NAME, 'readwrite');
  const store = tx.objectStore(LORE_FACT_PROPOSAL_STORE_NAME);
  const all = (await requestToPromise(store.getAll())) as LoreFactProposal[];
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

export async function saveLoreFactProposal(proposal: LoreFactProposal): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LORE_FACT_PROPOSAL_STORE_NAME, 'readwrite');
    const request = tx.objectStore(LORE_FACT_PROPOSAL_STORE_NAME).put(proposal);
    request.onsuccess = () => {
      emitLoreFactRecordsChanged();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveCanonicalFact(fact: CanonicalFact): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CANONICAL_FACT_STORE_NAME, 'readwrite');
    const request = tx.objectStore(CANONICAL_FACT_STORE_NAME).put(fact);
    request.onsuccess = () => {
      emitLoreFactRecordsChanged();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteCanonicalFact(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CANONICAL_FACT_STORE_NAME, 'readwrite');
    const request = tx.objectStore(CANONICAL_FACT_STORE_NAME).delete(id);
    request.onsuccess = () => {
      emitLoreFactRecordsChanged();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}
