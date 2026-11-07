import {describe, expect, it} from 'vitest';
import type {CanonicalFact, ProjectAISettings, SelectionAction, WorldEntity} from '../../entityTypes';
import {
  SELECTION_ACTION_PRESETS,
  actionsAllowedBySwitches,
  buildSelectionActionPrompt,
  cleanReplaceResult,
  installMissingPresets,
  menuSelectionActions,
  readSelectionActions,
  selectActionRecords,
  selectionActionFeature
} from './selectionActions';
import {FEATURE_SWITCH} from '../llm/aiSwitches';

const action = (overrides: Partial<SelectionAction>): SelectionAction => ({
  id: 'a1',
  name: 'Tighten',
  instructions: 'Cut filler.',
  includeScene: false,
  includeWorldBible: false,
  output: 'replace',
  enabled: true,
  ...overrides
});

const settings = (overrides: Partial<ProjectAISettings>): ProjectAISettings =>
  ({provider: 'anthropic', configs: {}, promptTools: [], defaultToolIds: [], ...overrides}) as ProjectAISettings;

const entity = (id: string, name: string, links: string[] = []): WorldEntity =>
  ({id, projectId: 'p1', categoryId: 'c', name, fields: {}, links, createdAt: 0, updatedAt: 0}) as WorldEntity;

const fact = (targetId: string, value: string, targetType: 'entity' | 'character' = 'entity'): CanonicalFact =>
  ({id: `f-${value}`, projectId: 'p1', targetType, targetId, factType: 'appearance', value, acceptedAt: 0, updatedAt: 0}) as CanonicalFact;

describe('selection action presets (5.19)', () => {
  it('ship switched off, with the five examples and both kinds', () => {
    expect(SELECTION_ACTION_PRESETS.map((preset) => preset.name)).toEqual([
      'Tighten',
      'Expand this beat',
      'Add sensory detail',
      'Vary sentence rhythm',
      'Check against canon'
    ]);
    expect(SELECTION_ACTION_PRESETS.every((preset) => !preset.enabled)).toBe(true);
    expect(SELECTION_ACTION_PRESETS.find((preset) => preset.name === 'Check against canon')?.output).toBe('note');
  });

  it('gives a project that never saved a list the presets, all off, so the menu is empty', () => {
    const fresh = settings({aiCoaching: true, aiProse: true});
    expect(readSelectionActions(fresh)).toHaveLength(SELECTION_ACTION_PRESETS.length);
    expect(menuSelectionActions(fresh)).toEqual([]);
  });

  it('re-adds missing presets without touching edited ones', () => {
    const edited = {...SELECTION_ACTION_PRESETS[0], name: 'Tighter', instructions: 'My own words.'};
    const result = installMissingPresets([edited]);
    expect(result.added).toBe(SELECTION_ACTION_PRESETS.length - 1);
    expect(result.actions[0]).toEqual(edited);
    expect(result.actions.filter((entry) => entry.presetId === 'tighten')).toHaveLength(1);
    expect(installMissingPresets(result.actions).added).toBe(0);
  });
});

describe('which actions show', () => {
  const list = [
    action({id: 'r', output: 'replace'}),
    action({id: 'n', output: 'note', name: 'Check'}),
    action({id: 'off', enabled: false})
  ];

  it('lists only switched-on actions whose AI switch is on', () => {
    expect(menuSelectionActions(settings({selectionActions: list, aiCoaching: true, aiProse: true})).map((a) => a.id))
      .toEqual(['r', 'n']);
    expect(menuSelectionActions(settings({selectionActions: list, aiCoaching: true})).map((a) => a.id)).toEqual(['n']);
    expect(menuSelectionActions(settings({selectionActions: list, aiProse: true})).map((a) => a.id)).toEqual(['r']);
    expect(menuSelectionActions(settings({selectionActions: list}))).toEqual([]);
  });

  it('hides an action from Settings when its switch is off, including switched-off ones', () => {
    expect(actionsAllowedBySwitches(settings({selectionActions: list, aiProse: true})).map((a) => a.id)).toEqual(['r', 'off']);
  });

  it('spends rewrites under prose and notes under coaching', () => {
    expect(FEATURE_SWITCH[selectionActionFeature('replace')]).toBe('prose');
    expect(FEATURE_SWITCH[selectionActionFeature('note')]).toBe('coaching');
  });
});

describe('buildSelectionActionPrompt', () => {
  it('sends only the selection and instructions by default', () => {
    const prompt = buildSelectionActionPrompt({action: action({}), selectedText: '  The very old door.  '});
    const content = prompt.messages[0].content as string;
    expect(prompt.systemPrompt).toContain('rewritten passage only');
    expect(content).toContain('Instructions (Tighten):\nCut filler.');
    expect(content).toContain('<<<\nThe very old door.\n>>>');
    expect(content).not.toContain('scene the passage is from');
    expect(content).not.toContain('World Bible');
  });

  it('adds the scene and the named records when the action includes them', () => {
    const prompt = buildSelectionActionPrompt({
      action: action({output: 'note', name: 'Check against canon'}),
      selectedText: 'Sera blinked.',
      scene: {title: 'Opening', text: 'Sera blinked. The rain fell.'},
      records: [{name: 'Sera', content: 'Sera\nrole: scout', facts: ['appearance: gray eyes'], linkedTo: undefined}]
    });
    const content = prompt.messages[0].content as string;
    expect(prompt.systemPrompt).toContain('Nothing you write is put into the story');
    expect(content).toContain('"Opening" (for reference)');
    expect(content).toContain('### Sera\nSera\nrole: scout\nAccepted facts:\n- appearance: gray eyes');
  });

  it('says so when the selection names no records', () => {
    const content = buildSelectionActionPrompt({action: action({}), selectedText: 'x', records: []})
      .messages[0].content as string;
    expect(content).toContain('World Bible records the passage names: none.');
  });
});

describe('selectActionRecords', () => {
  const sera = entity('e-sera', 'Sera', ['e-keep']);
  const keep = entity('e-keep', 'Thornkeep');
  const other = entity('e-other', 'Marrow');

  it('includes records named by name or alias, with their facts, and linked records only when asked', () => {
    const base = {
      entities: [sera, keep, other],
      characters: [{id: 'c-sera', entityId: 'e-sera'}],
      aliases: [{id: 'al', projectId: 'p1', alias: 'the scout', targetId: 'e-sera', targetType: 'entity'}] as never,
      facts: [fact('c-sera', 'gray eyes', 'character'), fact('e-other', 'tall')]
    };
    const named = selectActionRecords({...base, selectedText: 'The scout waited.', includeLinkedRecords: false});
    expect(named.map((record) => record.name)).toEqual(['Sera']);
    expect(named[0].facts).toEqual(['appearance: gray eyes']);
    const linked = selectActionRecords({...base, selectedText: 'Sera waited.', includeLinkedRecords: true});
    expect(linked.map((record) => [record.name, record.linkedTo])).toEqual([['Sera', undefined], ['Thornkeep', 'Sera']]);
  });
});

describe('cleanReplaceResult', () => {
  it('strips fences, passage markers and wrapping quotes', () => {
    expect(cleanReplaceResult('```\nThe door.\n```')).toBe('The door.');
    expect(cleanReplaceResult('<<<\nThe door.\n>>>')).toBe('The door.');
    expect(cleanReplaceResult('"The door."')).toBe('The door.');
    expect(cleanReplaceResult('"Go," she said. "Now."')).toBe('"Go," she said. "Now."');
  });
});
