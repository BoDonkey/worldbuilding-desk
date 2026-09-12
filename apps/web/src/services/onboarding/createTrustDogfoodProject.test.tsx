import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createTrustDogfoodProject, TRUST_DOGFOOD_PROJECT_NAME} from './createTrustDogfoodProject';
import {getDocumentsByProject} from '../../writingStorage';
import {getLoreDocumentsByProject} from '../../loreStorage';
import {getRulesetByProjectId} from '../rules/rulesetService';
import {getProjectById} from '../../projectStorage';
import {getEntitiesByProject} from '../../entityStorage';
import {getCanonicalFactsByProject} from '../lore/loreFactStorage';

// .test.tsx so it runs in the jsdom project with fake-indexeddb.
describe('createTrustDogfoodProject', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('seeds the five chapters, four Source Notes, and linked ruleset with no canon', async () => {
    const saveProjectSettings = vi.fn(async () => undefined);
    const project = await createTrustDogfoodProject({saveProjectSettings});

    expect(project.name).toBe(TRUST_DOGFOOD_PROJECT_NAME);
    expect(project.rulesetId).toBe('ember-ledger-fixture-v1');
    expect((await getProjectById(project.id))?.rulesetId).toBe('ember-ledger-fixture-v1');
    expect(saveProjectSettings).toHaveBeenCalledWith(expect.objectContaining({projectMode: 'litrpg'}));

    const scenes = (await getDocumentsByProject(project.id)).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    expect(scenes.map((scene) => scene.title)).toEqual([
      'Chapter One — The Salt Door',
      'Chapter Two — The Ledgerbound',
      'Chapter Three — The Weighing House',
      'Chapter Four — Sorrowsteel',
      'Chapter Five — The Hollow Court'
    ]);
    expect(scenes[0]?.content.startsWith('<p>The tide went out at four bells')).toBe(true);
    expect(scenes[0]?.content).toContain('[Stamina restored.]');

    const lore = await getLoreDocumentsByProject(project.id);
    expect(lore.map((doc) => doc.kind).sort()).toEqual([
      'character_dossier',
      'faction_notes',
      'general_lore',
      'place_history'
    ]);
    expect(lore.every((doc) => doc.format === 'markdown' && doc.source.type === 'import')).toBe(true);
    expect(lore.find((doc) => doc.kind === 'general_lore')?.content).toContain('DO NOT seed this until decided');

    const ruleset = await getRulesetByProjectId(project.id);
    expect(ruleset?.name).toBe('The Ember Ledger');
    expect(ruleset?.statDefinitions.map((stat) => stat.name)).toContain('Ledger-Marked');

    expect(await getEntitiesByProject(project.id)).toEqual([]);
    expect(await getCanonicalFactsByProject(project.id)).toEqual([]);
  });

  it('can omit the ruleset and lore for the identity passes', async () => {
    const project = await createTrustDogfoodProject({
      saveProjectSettings: async () => undefined,
      name: 'Ember Identity — Migration',
      includeRuleset: false,
      includeLore: false
    });
    expect(project.rulesetId).toBeUndefined();
    expect(await getLoreDocumentsByProject(project.id)).toEqual([]);
    expect((await getDocumentsByProject(project.id)).length).toBe(5);
  });
});
