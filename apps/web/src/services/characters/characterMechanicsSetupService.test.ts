import {describe, expect, it, vi} from 'vitest';
import type {Project, WorldEntity} from '../../entityTypes';
import {
  createFirstCharacterMechanics,
  planFirstCharacterMechanics
} from './characterMechanicsSetupService';

const project: Project = {
  id: 'project-1', name: 'Glass Harbor', createdAt: 1, updatedAt: 1
};
const character: WorldEntity = {
  id: 'entity-1', projectId: project.id, categoryId: 'characters', name: 'Mira',
  fields: {}, links: [], createdAt: 1, updatedAt: 1
};

describe('first character mechanics setup', () => {
  it('plans one stat and a canon-linked sheet without requiring a resource', () => {
    const ids = ['ruleset-1', 'stat-1', 'sheet-1'];
    const plan = planFirstCharacterMechanics(
      {project, character, kind: 'stat', name: 'Resolve', defaultValue: 7},
      {now: 10, createId: () => ids.shift()!}
    );
    expect(plan.ruleset.statDefinitions).toEqual([
      {id: 'stat-1', name: 'Resolve', type: 'number', defaultValue: 7}
    ]);
    expect(plan.ruleset.resourceDefinitions).toEqual([]);
    expect(plan.sheet.characterEntityId).toBe(character.id);
    expect(plan.sheet.name).toBe(character.name);
    expect(plan.project.rulesetId).toBe(plan.ruleset.id);
  });

  it('rolls back ruleset and sheet when the project link cannot be saved', async () => {
    const saveRuleset = vi.fn().mockResolvedValue(undefined);
    const saveSheet = vi.fn().mockResolvedValue(undefined);
    const deleteRuleset = vi.fn().mockResolvedValue(undefined);
    const deleteSheet = vi.fn().mockResolvedValue(undefined);
    await expect(createFirstCharacterMechanics(
      {project, character, kind: 'resource', name: 'Health', defaultValue: 100},
      {
        getSheets: vi.fn().mockResolvedValue([]), saveRuleset, saveSheet,
        deleteRuleset, deleteSheet,
        saveProject: vi.fn().mockRejectedValue(new Error('project write failed'))
      }
    )).rejects.toThrow('project write failed');
    expect(deleteSheet).toHaveBeenCalledOnce();
    expect(deleteRuleset).toHaveBeenCalledOnce();
  });
});
