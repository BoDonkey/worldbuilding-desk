import {describe, expect, it} from 'vitest';
import type {CharacterSheet, StatBlockGroup, WorldEntity} from '../../entityTypes';
import type {CharacterRuntimeModifiers} from '../compendium';
import {createStatBlockToken, parseStatBlockToken} from '../../utils/statBlockTemplates';
import {
  buildStatBlockPreferences,
  buildStatBlockPreviewData,
  describeCharacterBlockInsert,
  describeStatBlockToken,
  findStatBlockSource,
  formatRefreshFeedback,
  inferScopePresetFromSelection,
  planStatBlockInsert,
  planStatGroupSave,
  renderCharacterStatBlock,
  renderItemStatBlock,
  resolveCharacterSelection,
  resolveStatBlockTokenMatch,
  statBlockPreferencesMatch,
  type StatBlockPreferenceInput
} from './statBlockResolution';

const sheet = (id: string, name: string, overrides: Partial<CharacterSheet> = {}): CharacterSheet => ({
  id, projectId: 'p', name, level: 3, experience: 120,
  stats: [
    {definitionId: 'str', value: 12, modifiers: [{source: 'Ring', type: 'flat', value: 2}, {source: 'Curse', type: 'multiplier', value: 0.5}]},
    {definitionId: 'dex', value: 9}
  ],
  resources: [{definitionId: 'hp', current: 20, max: 30}, {definitionId: 'mp', current: 4, max: 10}, {definitionId: 'gold', current: 7, max: 99}],
  inventory: [], createdAt: 1, updatedAt: 1,
  ...overrides
}) as CharacterSheet;

const entity = (id: string, name: string, fields: Record<string, unknown> = {}): WorldEntity =>
  ({id, projectId: 'p', categoryId: 'items', name, fields, links: [], createdAt: 1, updatedAt: 1}) as unknown as WorldEntity;

const runtime: CharacterRuntimeModifiers = {statModifiers: {}, resourceModifiers: {}, levelBonus: 1, notes: ['Forge aura']};
const blockContext = {
  runtimeModifiers: runtime,
  statDefinitionNameById: new Map([['str', 'Strength']]),
  resourceDefinitionNameById: new Map([['hp', 'Health']]),
  getEffectiveStatValue: ({baseValue}: {baseValue: number}) => baseValue + 100,
  getEffectiveResourceValues: ({current, max}: {current: number; max: number}) => ({current, max: max + 1})
};

describe('resolveCharacterSelection', () => {
  const base = {
    availableStatIds: ['str', 'dex'],
    availableResourceIds: ['hp', 'mp'],
    selectedGroup: null as StatBlockGroup | null,
    selectedStatIds: ['str', 'gone'],
    selectedResourceIds: ['mp', 'gone']
  };

  it('maps each scope preset to its selection', () => {
    expect(resolveCharacterSelection({...base, scopePreset: 'all'})).toEqual({selectedStatIds: undefined, selectedResourceIds: undefined});
    expect(resolveCharacterSelection({...base, scopePreset: 'stats'})).toEqual({selectedStatIds: ['str', 'dex'], selectedResourceIds: []});
    expect(resolveCharacterSelection({...base, scopePreset: 'resources'})).toEqual({selectedStatIds: [], selectedResourceIds: ['hp', 'mp']});
  });

  it('uses a selected group, else the manual picks, dropping ids the sheet does not have', () => {
    const group: StatBlockGroup = {id: 'g', name: 'Combat', statIds: ['dex', 'luck'], resourceIds: ['hp']};
    expect(resolveCharacterSelection({...base, scopePreset: 'custom', selectedGroup: group}))
      .toEqual({selectedStatIds: ['dex'], selectedResourceIds: ['hp']});
    expect(resolveCharacterSelection({...base, scopePreset: 'custom'})).toEqual({selectedStatIds: ['str'], selectedResourceIds: ['mp']});
  });
});

describe('rendering', () => {
  it('renders a character block with the runtime level bonus, names, modifier notes, and selection filter', () => {
    const html = renderCharacterStatBlock(sheet('s1', 'Sera'), 'full', blockContext, {selectedStatIds: ['str'], selectedResourceIds: ['hp']});
    expect(html).toContain('Sera');
    expect(html).toContain('Level 4 (base 3)');
    expect(html).toContain('Strength');
    expect(html).toContain('Ring +2, Curse x0.5');
    expect(html).toContain('Health');
    expect(html).not.toContain('dex');
    expect(html).not.toContain('mp');
    expect(html).toContain('Forge aura');
  });

  it('falls back to the definition id when a name is unknown and keeps level at least 1', () => {
    const html = renderCharacterStatBlock(sheet('s1', 'Sera', {level: 0}), 'full', {...blockContext, runtimeModifiers: {...runtime, levelBonus: -4}});
    expect(html).toContain('Level 1 (base 0)');
    expect(html).toContain('dex');
  });

  it('renders an item block from non-empty fields only', () => {
    const html = renderItemStatBlock(entity('e1', 'Ember Blade', {damage: '2d6', notes: ''}), 'full');
    expect(html).toContain('Ember Blade');
    expect(html).toContain('2d6');
  });
});

describe('source resolution', () => {
  const sheets = [sheet('s1', 'Sera'), sheet('s2', 'Brannic'), sheet('s3', 'brannic ')];
  const items = [entity('e1', 'Ember Blade')];

  it('finds a source by exact id, else by trimmed case-insensitive name', () => {
    expect(findStatBlockSource(sheets, 's2')?.name).toBe('Brannic');
    expect(findStatBlockSource(sheets, '  SERA ')?.id).toBe('s1');
    expect(findStatBlockSource(sheets, 'Dess')).toBeUndefined();
  });

  it('resolves tokens by id, then label, then source name, reporting ambiguity and missing sources', () => {
    const token = (sourceRef: string, label?: string, sourceType: 'character' | 'item' = 'character') =>
      ({sourceType, sourceRef, style: 'compact', label}) as const;
    expect(resolveStatBlockTokenMatch(token('s1', 'Old name'), sheets, items))
      .toEqual({status: 'resolved', label: 'Old name', matchName: 'Sera', candidates: ['Sera']});
    expect(resolveStatBlockTokenMatch(token('gone', 'sera'), sheets, items)).toMatchObject({status: 'resolved', matchName: 'Sera', label: 'sera'});
    expect(resolveStatBlockTokenMatch(token('gone', 'Brannic'), sheets, items))
      .toEqual({status: 'ambiguous', label: 'Brannic', candidates: ['Brannic', 'brannic ']});
    expect(resolveStatBlockTokenMatch(token('brannic'), sheets, items)).toMatchObject({status: 'ambiguous', label: 'Brannic'});
    expect(resolveStatBlockTokenMatch(token('Ember Blade', undefined, 'item'), sheets, items)).toMatchObject({status: 'resolved', matchName: 'Ember Blade'});
    expect(resolveStatBlockTokenMatch(token('gone', 'Nobody'), sheets, items)).toEqual({status: 'missing', label: 'Nobody', candidates: []});
    expect(resolveStatBlockTokenMatch(token('gone'), sheets, items)).toEqual({status: 'missing', label: 'gone', candidates: []});
  });
});

describe('token status text', () => {
  const raw = createStatBlockToken({sourceType: 'character', sourceRef: 's1', style: 'full', label: 'Sera'});

  it('describes resolved, ambiguous, missing, and unparseable tokens', () => {
    expect(describeStatBlockToken(raw, () => ({status: 'resolved', label: 'Sera', matchName: 'Sera', candidates: ['Sera']})))
      .toEqual({rawToken: raw, label: 'Stat Block: Sera · All Stats', status: 'resolved', title: 'Bound to Sera. Click to inspect token status.'});
    expect(describeStatBlockToken(raw, () => ({status: 'ambiguous', label: 'Sera', candidates: ['Sera', 'sera']})))
      .toMatchObject({label: 'Stat Block: Sera · All Stats · Needs rebind', title: 'This token matches multiple records. Candidates: Sera, sera.'});
    expect(describeStatBlockToken(raw, () => ({status: 'missing', label: 'Sera', candidates: []})))
      .toMatchObject({status: 'missing', title: 'No matching character sheet found for this token.'});
    expect(describeStatBlockToken('not a token', () => {
      throw new Error('not called');
    }).rawToken).toBe('not a token');
  });

  it('builds preview data and renders html only for a resolved token', () => {
    let rendered = 0;
    const render = () => {
      rendered += 1;
      return '<p>block</p>';
    };
    expect(buildStatBlockPreviewData(raw, () => ({status: 'resolved', label: 'Sera', matchName: 'Sera', candidates: ['Sera']}), render))
      .toEqual({rawToken: raw, title: 'Sera · All Stats', sourceType: 'character', style: 'full', status: 'resolved',
        message: 'Linked to character sheet "Sera".', html: '<p>block</p>', requiresRebind: false});
    expect(buildStatBlockPreviewData(raw, () => ({status: 'missing', label: 'Sera', candidates: []}), render))
      .toMatchObject({status: 'missing', html: null, requiresRebind: true, message: 'No matching character sheet is currently available for this token.'});
    expect(buildStatBlockPreviewData('bad', () => ({status: 'missing', label: '', candidates: []}), render))
      .toMatchObject({status: 'invalid', title: 'Stat Block', sourceType: 'character', style: 'compact', requiresRebind: true});
    expect(rendered).toBe(1);
  });
});

describe('preferences, scope inference, refresh feedback, groups, history', () => {
  const prefs: StatBlockPreferenceInput = {
    sourceType: 'character', style: 'full', insertMode: 'block', scopePreset: 'custom', selectedGroupId: '',
    selectedStatIds: ['str'], selectedResourceIds: [], groups: []
  } as StatBlockPreferenceInput;

  it('treats stored preferences as matching only when every field is equal', () => {
    const stored = buildStatBlockPreferences(prefs);
    expect(stored.selectedStatIds).not.toBe(prefs.selectedStatIds);
    expect(statBlockPreferencesMatch(stored, prefs)).toBe(true);
    expect(statBlockPreferencesMatch({...stored, selectedGroupId: undefined}, prefs)).toBe(true);
    expect(statBlockPreferencesMatch(stored, {...prefs, selectedStatIds: ['dex']})).toBe(false);
    expect(statBlockPreferencesMatch(undefined, prefs)).toBe(false);
  });

  it('infers the scope preset a rebind restores', () => {
    expect(inferScopePresetFromSelection({})).toBe('all');
    expect(inferScopePresetFromSelection({selectedStatIds: ['str']})).toBe('stats');
    expect(inferScopePresetFromSelection({selectedResourceIds: ['hp'], selectedStatIds: []})).toBe('resources');
    expect(inferScopePresetFromSelection({selectedStatIds: ['str'], selectedResourceIds: ['hp']})).toBe('custom');
    expect(inferScopePresetFromSelection({selectedStatIds: []})).toBe('custom');
  });

  it('words refresh feedback for every outcome', () => {
    expect(formatRefreshFeedback({replacedCount: 0, ambiguousCount: 0, missingCount: 0}))
      .toEqual({tone: 'error', message: 'No matching STAT_BLOCK templates found to refresh.'});
    expect(formatRefreshFeedback({replacedCount: 0, ambiguousCount: 1, missingCount: 2}).message)
      .toBe('No stat block templates were refreshed. 1 ambiguous and 2 missing token(s) need attention.');
    expect(formatRefreshFeedback({replacedCount: 3, ambiguousCount: 0, missingCount: 0}))
      .toEqual({tone: 'success', message: 'Refreshed 3 stat block template(s).'});
    expect(formatRefreshFeedback({replacedCount: 3, ambiguousCount: 0, missingCount: 1}).message)
      .toBe('Refreshed 3 stat block template(s). 0 ambiguous and 1 missing token(s) were skipped.');
  });

  it('validates a group save and updates a same-named group in place', () => {
    const groups: StatBlockGroup[] = [{id: 'g1', name: 'Combat', statIds: ['str'], resourceIds: []}];
    expect(planStatGroupSave({name: '  ', selection: {selectedStatIds: ['str']}, groups, createId: () => 'new'}))
      .toEqual({ok: false, message: 'Enter a group name first.'});
    expect(planStatGroupSave({name: 'Empty', selection: {}, groups, createId: () => 'new'}))
      .toEqual({ok: false, message: 'Choose at least one stat/resource before saving a group.'});
    expect(planStatGroupSave({name: ' combat ', selection: {selectedResourceIds: ['hp']}, groups, createId: () => 'new'}))
      .toMatchObject({ok: true, updated: true, group: {id: 'g1', name: 'combat', statIds: [], resourceIds: ['hp']}});
    expect(planStatGroupSave({name: 'Social', selection: {selectedStatIds: ['cha']}, groups, createId: () => 'new'}))
      .toMatchObject({ok: true, updated: false, group: {id: 'new'}, groups: [groups[0], {id: 'new', name: 'Social'}]});
  });

  it('summarizes an inserted character block with up to two resources', () => {
    expect(describeCharacterBlockInsert(sheet('s1', 'Sera'))).toBe('Status block inserted for Sera (Lv 3, 120 XP) · hp: 20/30, mp: 4/10');
    expect(describeCharacterBlockInsert(sheet('s1', 'Sera', {resources: []}))).toBe('Status block inserted for Sera (Lv 3, 120 XP).');
  });
});

describe('planStatBlockInsert', () => {
  const base = {
    sourceType: 'character' as const,
    scopePreset: 'all' as const,
    selection: {},
    selectedSheet: sheet('s1', 'Sera'),
    selectedEntity: null,
    style: 'compact' as const,
    insertMode: 'block' as 'block' | 'template',
    projectMode: 'general',
    pendingRebindToken: null,
    content: '<p>scene</p>',
    renderCharacter: () => '<p>CHARACTER</p>',
    renderItem: () => '<p>ITEM</p>',
    renderTokenChip: (token: string) => `[chip ${token}]`
  };

  it('requires a stat or resource selection, and a source record', () => {
    expect(planStatBlockInsert({...base, scopePreset: 'custom', selection: {selectedStatIds: [], selectedResourceIds: []}}))
      .toEqual({kind: 'error', message: 'Select at least one stat or resource for this status block.'});
    expect(planStatBlockInsert({...base, selectedSheet: null})).toEqual({kind: 'error', message: 'Select a character sheet to insert.'});
    expect(planStatBlockInsert({...base, sourceType: 'item'})).toEqual({kind: 'error', message: 'Select an item/entity to insert.'});
  });

  it('inserts a live block with a resource history entry', () => {
    expect(planStatBlockInsert(base)).toEqual({
      kind: 'insert',
      insertContent: '<p>CHARACTER</p>',
      message: 'Inserted status block into scene.',
      history: {
        category: 'resource',
        message: 'Status block inserted for Sera (Lv 3, 120 XP) · hp: 20/30, mp: 4/10',
        insertText: 'System Status: Status block inserted for Sera (Lv 3, 120 XP) · hp: 20/30, mp: 4/10'
      }
    });
  });

  it('inserts a template token outside LitRPG, and a live block that auto-resolves inside it', () => {
    const template = planStatBlockInsert({...base, insertMode: 'template'});
    expect(template).toMatchObject({kind: 'insert', message: 'Inserted STAT_BLOCK template token.'});
    expect(template.kind === 'insert' && template.insertContent).toBe(`<p>[chip ${createStatBlockToken({sourceType: 'character', sourceRef: 's1', label: 'Sera', style: 'compact'})}]</p>`);
    expect(planStatBlockInsert({...base, insertMode: 'template', projectMode: 'litrpg'}))
      .toMatchObject({insertContent: '<p>CHARACTER</p>', message: 'Inserted live status block (LitRPG mode auto-resolves placeholders).'});
  });

  it('records an item insert as a system history entry', () => {
    expect(planStatBlockInsert({...base, sourceType: 'item', selectedSheet: null, selectedEntity: entity('e1', 'Ember Blade')}))
      .toMatchObject({kind: 'insert', insertContent: '<p>ITEM</p>', history: {
        category: 'system',
        message: 'Status block inserted for entity "Ember Blade".',
        insertText: 'System Status: Entity "Ember Blade" record inserted into scene.'
      }});
  });

  it('rebinds the first matching token in the scene, or reports that it is gone', () => {
    const oldToken = createStatBlockToken({sourceType: 'character', sourceRef: 'old', style: 'compact'});
    const plan = planStatBlockInsert({...base, pendingRebindToken: oldToken, content: `<p>${oldToken}</p><p>${oldToken}</p>`});
    expect(plan.kind).toBe('rebind');
    expect(plan.kind === 'rebind' && plan.html.split(oldToken).length - 1).toBe(1);
    expect(planStatBlockInsert({...base, pendingRebindToken: oldToken}))
      .toEqual({kind: 'error', message: 'Could not find the stat block token to rebind.'});
  });

  it('round-trips the selection through the token it creates', () => {
    const plan = planStatBlockInsert({...base, scopePreset: 'custom', selection: {selectedStatIds: ['str'], selectedResourceIds: []}, insertMode: 'template'});
    const raw = plan.kind === 'insert' ? plan.insertContent.match(/\{\{STAT_BLOCK[^}]+\}\}/)?.[0] ?? '' : '';
    expect(parseStatBlockToken(raw)).toMatchObject({sourceRef: 's1', selectedStatIds: ['str']});
  });
});
