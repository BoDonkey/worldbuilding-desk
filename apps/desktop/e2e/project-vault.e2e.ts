import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import type {Page} from '@playwright/test';
import {expect, openSampleProject, packagedExecutable, test} from './fixtures';

const SAMPLE_PROJECT = 'The Emberglass Key (Sample)';
const PASSPHRASE = 'tide-and-salt-door';

function filesContaining(root: string, value: string): string[] {
  const utf8 = Buffer.from(value, 'utf8');
  const utf16 = Buffer.from(value, 'utf16le');
  const matches: string[] = [];
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(target);
        continue;
      }
      if (!entry.isFile()) continue;
      const bytes = fs.readFileSync(target);
      if (bytes.includes(utf8) || bytes.includes(utf16)) matches.push(path.relative(root, target));
    }
  };
  visit(root);
  return matches.sort();
}

async function appOwnedStoredText(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const parts: string[] = [];
    for (const {name} of await indexedDB.databases()) {
      if (!name) continue;
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      for (const storeName of Array.from(db.objectStoreNames)) {
        const records = await new Promise<unknown[]>((resolve, reject) => {
          const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        parts.push(name, storeName, JSON.stringify(records));
      }
      db.close();
    }
    for (const storage of [localStorage, sessionStorage]) {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index)!;
        parts.push(key, storage.getItem(key) ?? '');
      }
    }
    return parts.join('\n');
  });
}

test('a packaged project vault removes planted text from live stores and measures old on-disk pages', async ({
  desktop
}, testInfo) => {
  test.skip(!packagedExecutable(), 'The at-rest scan runs against the packaged desktop profile.');
  const marker = `VAULT_PLAINTEXT_${randomUUID()}`;
  const {page} = desktop;
  await openSampleProject(page);

  // Seed both a zone record and the two browser-storage content paths before protection.
  // Tests may reach raw IndexedDB; application code must use the storage seam.
  const projectId = await page.evaluate(async (planted) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('worldbuilding-db', 30);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const project = await new Promise<{id: string} | undefined>((resolve, reject) => {
      const request = db.transaction('projects', 'readonly').objectStore('projects').getAll();
      request.onsuccess = () => resolve(request.result.find((item) => item.name === 'The Emberglass Key (Sample)'));
      request.onerror = () => reject(request.error);
    });
    if (!project) throw new Error('Packaged vault fixture project was not found.');
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('zone_affinity_profiles', 'readwrite');
      tx.objectStore('zone_affinity_profiles').put({
        id: `zone-profile:${project.id}:${crypto.randomUUID()}`,
        projectId: project.id,
        biomeKey: planted,
        name: planted,
        progressScope: 'character',
        maxAffinityPoints: 100,
        milestones: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
    const seedDerived = async (name: string, version: number, storeName: string) => {
      const derived = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name, version);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(storeName)) {
            request.result.createObjectStore(storeName, {keyPath: 'id'});
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = derived.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put({id: crypto.randomUUID(), documentId: 'planted', content: planted});
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      derived.close();
    };
    await seedDerived(`rag-${project.id}`, 2, 'chunks');
    await seedDerived(`shodh-memory-${project.id}`, 1, 'memories');
    localStorage.setItem(`systemHistory:${project.id}`, JSON.stringify([{category: 'system', message: planted}]));
    localStorage.setItem(`workspaceReviewPrefs:${project.id}`, JSON.stringify({dismissed: [planted]}));
    localStorage.setItem(`loreSynopsis:${project.id}:planted:1`, planted);
    localStorage.setItem(
      `wbd:first-mechanics:${project.id}:planted`,
      JSON.stringify({isAdding: true, kind: 'resource', name: planted, defaultValue: '10'})
    );
    sessionStorage.setItem(
      `wbd:assistant-conversation:${project.id}`,
      JSON.stringify([{role: 'user', content: planted}])
    );
    sessionStorage.setItem(
      `wbd:assistant-conversation:ask:${project.id}`,
      JSON.stringify([{role: 'user', content: planted}])
    );
    return project.id;
  }, marker);
  const beforeProtection = await appOwnedStoredText(page);
  expect(beforeProtection).toContain(marker);
  expect(beforeProtection).toContain(`rag-${projectId}`);
  expect(beforeProtection).toContain(`shodh-memory-${projectId}`);

  await page.getByRole('link', {name: 'Projects'}).first().click();
  const card = page.locator('li').filter({has: page.locator('strong', {hasText: SAMPLE_PROJECT})});
  await card.getByRole('button', {name: 'Protect with Passphrase'}).click();
  const dialog = page.getByRole('dialog', {name: `Protect “${SAMPLE_PROJECT}” with a passphrase`});
  await dialog.getByLabel('Passphrase', {exact: true}).fill(PASSPHRASE);
  await dialog.getByLabel('Confirm passphrase').fill(PASSPHRASE);
  await dialog.getByLabel(/I understand/).check();
  await dialog.getByRole('button', {name: 'Protect Project'}).click();
  await expect(page.getByTestId('app-toast').filter({hasText: 'is now protected.'})).toContainText(SAMPLE_PROJECT);

  const storedText = await appOwnedStoredText(page);
  expect(storedText).not.toContain(marker);
  expect(storedText).not.toContain(SAMPLE_PROJECT);
  const databaseNames = await page.evaluate(async () => (await indexedDB.databases()).map(({name}) => name));
  expect(databaseNames).not.toContain(`rag-${projectId}`);
  expect(databaseNames).not.toContain(`shodh-memory-${projectId}`);

  await desktop.app.close();
  const diskMatches = filesContaining(desktop.userDataDir, marker);
  const unexpected = diskMatches.filter((file) => {
    const normalized = file.replaceAll('\\', '/');
    return !normalized.startsWith('IndexedDB/') &&
      !normalized.startsWith('Local Storage/leveldb/') &&
      !normalized.startsWith('Session Storage/');
  });
  expect(unexpected, `planted text escaped browser storage: ${unexpected.join(', ')}`).toEqual([]);
  const scanDescription = diskMatches.length === 0
    ? 'No planted plaintext remained in the closed profile.'
    : `Found ${diskMatches.length} reclaimable browser-storage file(s) containing pre-protection plaintext: ${diskMatches.join(', ')}`;
  console.info(`[vault-disk-scan] ${scanDescription}`);
  testInfo.annotations.push({
    type: 'vault-disk-scan',
    description: scanDescription
  });
});
