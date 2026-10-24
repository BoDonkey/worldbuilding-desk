// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import {beforeEach, describe, expect, it} from 'vitest';
import {
  deleteMechanicsDraft,
  getMechanicsDraft,
  mechanicsDraftId,
  migrateLegacyMechanicsDrafts,
  saveMechanicsDraft
} from './mechanicsDraftStorage';
import {deleteProject, saveProject} from './projectStorage';
import {readProjectRecords} from '../projectIndex';
import {MECHANICS_DRAFT_STORE_NAME} from '../db';
import {buildProjectSnapshot, serializeProjectSnapshot, validateSnapshotCounts} from '../projectSnapshotService';
import {importProjectBackup, normalizeProjectSnapshot} from '../projectBackupImport';
import type {MechanicsDraft} from '../../../entityTypes';

const newProject = async (name: string) => {
  const id = `drafts-${crypto.randomUUID()}`;
  await saveProject({id, name, createdAt: 1, updatedAt: 1});
  return id;
};

describe('mechanicsDraftStorage (3.23c)', () => {
  beforeEach(() => localStorage.clear());

  it('saves, replaces, reads, and deletes one draft per character', async () => {
    const projectId = await newProject('Drafts');
    await saveMechanicsDraft({projectId, entityId: 'mira', kind: 'stat', name: 'Resolve', defaultValue: '5'});
    await saveMechanicsDraft({projectId, entityId: 'mira', kind: 'stat', name: 'Resolve', defaultValue: '7', updatedAt: 9});
    await saveMechanicsDraft({projectId, entityId: 'sera', kind: 'resource', name: 'Mana', defaultValue: '40'});

    expect(await getMechanicsDraft(projectId, 'mira')).toEqual({
      id: mechanicsDraftId(projectId, 'mira'), projectId, entityId: 'mira',
      kind: 'stat', name: 'Resolve', defaultValue: '7', updatedAt: 9
    });
    expect(await readProjectRecords(MECHANICS_DRAFT_STORE_NAME, projectId)).toHaveLength(2);

    await deleteMechanicsDraft(projectId, 'mira');
    expect(await getMechanicsDraft(projectId, 'mira')).toBeNull();
    expect(await getMechanicsDraft(projectId, 'sera')).not.toBeNull();
  });

  it('round-trips through a backup into a new project under rewritten ids', async () => {
    const projectId = await newProject('Backed up');
    await saveMechanicsDraft({projectId, entityId: 'mira', kind: 'stat', name: 'Grit', defaultValue: '3', updatedAt: 4});

    const snapshot = await buildProjectSnapshot(projectId);
    expect(snapshot.data.mechanicsDrafts).toHaveLength(1);
    expect(snapshot.counts.mechanicsDrafts).toBe(1);
    expect(validateSnapshotCounts(snapshot).ok).toBe(true);

    const restored = normalizeProjectSnapshot(JSON.parse(serializeProjectSnapshot(snapshot)));
    const result = await importProjectBackup({snapshot: restored, mode: 'new'});
    expect(result.projectId).not.toBe(projectId);

    const imported = await readProjectRecords<MechanicsDraft>(MECHANICS_DRAFT_STORE_NAME, result.projectId);
    expect(imported).toEqual([{
      id: mechanicsDraftId(result.projectId, 'mira'), projectId: result.projectId, entityId: 'mira',
      kind: 'stat', name: 'Grit', defaultValue: '3', updatedAt: 4
    }]);
    // The source project's draft is untouched.
    expect(await getMechanicsDraft(projectId, 'mira')).toMatchObject({name: 'Grit'});
  });

  it('is removed with its project, including a draft an older build left in localStorage', async () => {
    const projectId = await newProject('Doomed');
    await saveMechanicsDraft({projectId, entityId: 'mira', kind: 'stat', name: 'Resolve', defaultValue: '5'});
    localStorage.setItem(`wbd:first-mechanics:${projectId}:sera`, JSON.stringify({isAdding: true, name: 'Old'}));

    await deleteProject(projectId);

    expect(await readProjectRecords(MECHANICS_DRAFT_STORE_NAME, projectId)).toEqual([]);
    expect(localStorage.getItem(`wbd:first-mechanics:${projectId}:sera`)).toBeNull();
  });

  it('migrates only open legacy drafts and clears every legacy key for the project', async () => {
    const projectId = await newProject('Legacy');
    localStorage.setItem(`wbd:first-mechanics:${projectId}:mira`, JSON.stringify({
      isAdding: true, kind: 'stat', name: 'Grit', defaultValue: '3'
    }));
    localStorage.setItem(`wbd:first-mechanics:${projectId}:closed`, JSON.stringify({isAdding: false}));
    localStorage.setItem(`wbd:first-mechanics:${projectId}:broken`, '{not json');

    expect(await migrateLegacyMechanicsDrafts(projectId)).toBe(1);
    expect(await getMechanicsDraft(projectId, 'mira')).toMatchObject({kind: 'stat', name: 'Grit', defaultValue: '3'});
    expect(await getMechanicsDraft(projectId, 'closed')).toBeNull();
    expect(await getMechanicsDraft(projectId, 'broken')).toBeNull();
    expect(Object.keys(localStorage).filter((key) => key.includes(projectId))).toEqual([]);
    expect(await migrateLegacyMechanicsDrafts(projectId)).toBe(0);
  });
});
