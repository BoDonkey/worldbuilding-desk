import {describe, expect, it} from 'vitest';
import type {SelectionAction} from '../../entityTypes';
import {appendToolPack, buildToolPack, parseToolPack, replaceWithToolPack, TOOL_PACK_SCHEMA_VERSION} from './toolPack';
import {SELECTION_ACTION_PRESETS} from '../assistant/selectionActions';

const tool = {id: 't1', name: 'Critic', content: 'Be rigorous.', enabled: true};
const myAction: SelectionAction = {
  id: 'a1', name: 'Tighten', instructions: 'Cut filler.', includeScene: false,
  includeWorldBible: false, output: 'replace', enabled: true
};
const context = {defaultsMode: 'general' as const, projectMode: 'general' as const};
const modes = {litrpg: ['t1'], game: ['t1'], general: ['t1']};

describe('tool packs (5.19)', () => {
  it('exports prompt tools and AI actions as version 2', () => {
    const pack = buildToolPack({promptTools: [tool], defaultToolIds: ['t1'], selectionActions: [myAction]});
    expect(pack.schemaVersion).toBe(TOOL_PACK_SCHEMA_VERSION);
    expect(pack.tools).toEqual([tool]);
    expect(pack.actions).toEqual([myAction]);
  });

  it('round-trips actions with new ids', () => {
    const parsed = parseToolPack(JSON.stringify(buildToolPack({promptTools: [tool], defaultToolIds: [], selectionActions: [myAction]})));
    expect(parsed.actions).toHaveLength(1);
    expect(parsed.actions?.[0]).toMatchObject({name: 'Tighten', output: 'replace', enabled: true});
    expect(parsed.actions?.[0].id).not.toBe('a1');
  });

  it('still reads version 1 packs, which leave actions alone', () => {
    const parsed = parseToolPack(JSON.stringify({schemaVersion: 1, tools: [tool], defaultToolIdsByMode: modes}));
    expect(parsed.tools).toHaveLength(1);
    expect(parsed.actions).toBeNull();
    const updates = replaceWithToolPack({promptTools: [], defaultToolIds: [], selectionActions: [myAction]}, parsed, context);
    expect(updates.promptTools).toEqual(parsed.tools);
    expect(updates.defaultToolIdsByMode?.general).toEqual([parsed.tools[0].id]);
    expect('selectionActions' in updates).toBe(false);
  });

  it('drops malformed actions and refuses a pack with nothing usable', () => {
    const parsed = parseToolPack(JSON.stringify({
      schemaVersion: 2, tools: [],
      actions: [myAction, {name: 'No kind', instructions: 'x'}, {name: '', instructions: 'x', output: 'note'}]
    }));
    expect(parsed.actions?.map((entry) => entry.name)).toEqual(['Tighten']);
    expect(() => parseToolPack(JSON.stringify({schemaVersion: 2, tools: [], actions: []}))).toThrow('No valid tools or actions');
    expect(() => parseToolPack(JSON.stringify({schemaVersion: 3, tools: []}))).toThrow('Invalid tool pack format');
  });

  it('replaces or appends actions', () => {
    const parsed = parseToolPack(JSON.stringify({schemaVersion: 2, tools: [], actions: [{...myAction, name: 'Imported'}]}));
    const current = {promptTools: [tool], defaultToolIds: ['t1'], defaultToolIdsByMode: modes, selectionActions: [myAction]};
    expect(replaceWithToolPack(current, parsed, context).selectionActions?.map((a) => a.name)).toEqual(['Imported']);
    expect(appendToolPack(current, parsed, context).selectionActions?.map((a) => a.name)).toEqual(['Tighten', 'Imported']);
    // A project that never saved its own list appends to the presets.
    const fresh = appendToolPack({promptTools: [], defaultToolIds: []}, parsed, context);
    expect(fresh.selectionActions).toHaveLength(SELECTION_ACTION_PRESETS.length + 1);
  });
});
