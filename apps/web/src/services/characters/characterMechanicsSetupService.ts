import {createEmptyRuleset, type WorldRuleset} from '@worldbuilding-desk/rules-engine';
import type {CharacterSheet, Project, WorldEntity} from '../../entityTypes';
import {saveProject} from '../../projectStorage';
import {deleteRuleset, saveRuleset} from '../rules';
import {
  deleteCharacterSheet,
  getCharacterSheetsByProject,
  saveCharacterSheet
} from './characterSheetService';

export type FirstTrackedValueKind = 'stat' | 'resource';

export interface FirstCharacterMechanicsInput {
  project: Project;
  character: WorldEntity;
  kind: FirstTrackedValueKind;
  name: string;
  defaultValue: number;
}

export interface FirstCharacterMechanicsPlan {
  project: Project;
  ruleset: WorldRuleset;
  sheet: CharacterSheet;
}

export function planFirstCharacterMechanics(
  input: FirstCharacterMechanicsInput,
  options: {now?: number; createId?: () => string} = {}
): FirstCharacterMechanicsPlan {
  if (input.project.id !== input.character.projectId) {
    throw new Error('The character does not belong to the active project.');
  }
  if (input.project.rulesetId) {
    throw new Error('This project already has mechanics tracking.');
  }
  const name = input.name.trim();
  if (!name) throw new Error('Name the value you want to track.');
  if (!Number.isFinite(input.defaultValue)) {
    throw new Error('Enter a valid starting value.');
  }

  const now = options.now ?? Date.now();
  const createId = options.createId ?? (() => crypto.randomUUID());
  const ruleset = createEmptyRuleset(`${input.project.name} mechanics`);
  ruleset.id = createId();
  ruleset.createdAt = now;
  ruleset.updatedAt = now;
  const definition = {
    id: createId(),
    name,
    type: 'number' as const,
    defaultValue: input.defaultValue
  };
  if (input.kind === 'stat') ruleset.statDefinitions = [definition];
  else ruleset.resourceDefinitions = [definition];

  const sheet: CharacterSheet = {
    id: createId(),
    projectId: input.project.id,
    characterEntityId: input.character.id,
    name: input.character.name,
    level: 1,
    experience: 0,
    stats: input.kind === 'stat'
      ? [{definitionId: definition.id, value: input.defaultValue}]
      : [],
    resources: input.kind === 'resource'
      ? [{definitionId: definition.id, current: input.defaultValue, max: input.defaultValue}]
      : [],
    inventory: [],
    equipment: [],
    statuses: [],
    inventoryEntries: [],
    equipmentEntries: [],
    statusEntries: [],
    createdAt: now,
    updatedAt: now
  };
  return {
    ruleset,
    sheet,
    project: {...input.project, rulesetId: ruleset.id, updatedAt: now}
  };
}

interface FirstCharacterMechanicsDependencies {
  getSheets: typeof getCharacterSheetsByProject;
  saveRuleset: typeof saveRuleset;
  deleteRuleset: typeof deleteRuleset;
  saveSheet: typeof saveCharacterSheet;
  deleteSheet: typeof deleteCharacterSheet;
  saveProject: typeof saveProject;
}

const defaultDependencies: FirstCharacterMechanicsDependencies = {
  getSheets: getCharacterSheetsByProject,
  saveRuleset,
  deleteRuleset,
  saveSheet: saveCharacterSheet,
  deleteSheet: deleteCharacterSheet,
  saveProject
};

export async function createFirstCharacterMechanics(
  input: FirstCharacterMechanicsInput,
  dependencies: FirstCharacterMechanicsDependencies = defaultDependencies
): Promise<FirstCharacterMechanicsPlan> {
  const existingSheets = await dependencies.getSheets(input.project.id);
  if (existingSheets.some((sheet) => sheet.characterEntityId === input.character.id)) {
    throw new Error('This character already has a mechanics sheet.');
  }
  const plan = planFirstCharacterMechanics(input);
  let rulesetSaved = false;
  let sheetSaved = false;
  try {
    await dependencies.saveRuleset(plan.ruleset, input.project.id);
    rulesetSaved = true;
    await dependencies.saveSheet(plan.sheet);
    sheetSaved = true;
    await dependencies.saveProject(plan.project);
    return plan;
  } catch (error) {
    if (sheetSaved) await dependencies.deleteSheet(plan.sheet.id).catch(() => undefined);
    if (rulesetSaved) {
      await dependencies.deleteRuleset(plan.ruleset.id, input.project.id).catch(() => undefined);
    }
    throw error;
  }
}
