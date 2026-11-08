import {describe, expect, it} from 'vitest';
import type {Effect} from '../../types/Effect';
import {translateEffectToStateMutationCommand} from './index';

const translate = (effect: Effect) => translateEffectToStateMutationCommand('hero', effect);

describe('translateEffectToStateMutationCommand', () => {
  it('maps resource current-value effects to resource commands', () => {
    expect(translate({target: 'resources.current.health', operation: 'add', value: 10})).toEqual({
      ok: true,
      command: {type: 'resource_change', actorId: 'hero', resourceDefinitionId: 'health', delta: 10}
    });
    expect(translate({target: 'resources.current.health', operation: 'subtract', value: 4})).toEqual({
      ok: true,
      command: {type: 'resource_change', actorId: 'hero', resourceDefinitionId: 'health', delta: -4}
    });
    expect(translate({target: 'resources.current.health', operation: 'set', value: 0})).toEqual({
      ok: true,
      command: {type: 'resource_set', actorId: 'hero', resourceDefinitionId: 'health', value: 0}
    });
  });

  it('maps stat effects to stat commands', () => {
    expect(translate({target: 'stats.STR', operation: 'add', value: 2})).toEqual({
      ok: true,
      command: {type: 'stat_change', actorId: 'hero', statDefinitionId: 'STR', delta: 2}
    });
    expect(translate({target: 'stats.STR', operation: 'subtract', value: 3})).toEqual({
      ok: true,
      command: {type: 'stat_change', actorId: 'hero', statDefinitionId: 'STR', delta: -3}
    });
    expect(translate({target: 'stats.blessed', operation: 'set', value: true})).toEqual({
      ok: true,
      command: {type: 'stat_set', actorId: 'hero', statDefinitionId: 'blessed', value: true}
    });
  });

  it('reports targets with no state-change kind as not translatable', () => {
    for (const target of ['resources.max.health', 'custom.tags', 'stats.', 'resources.current.']) {
      expect(translate({target, operation: 'add', value: 1})).toMatchObject({ok: false});
    }
  });

  it('does not guess at formulas, text, or non-numeric values', () => {
    expect(translate({target: 'resources.current.health', operation: 'set', value: 'STR * 3'})).toMatchObject({ok: false});
    expect(translate({target: 'stats.title', operation: 'set', value: 'Knight'})).toMatchObject({ok: false});
    expect(translate({target: 'stats.STR', operation: 'add', value: true})).toMatchObject({ok: false});
    expect(translate({target: 'resources.current.health', operation: 'add', value: Number.NaN})).toMatchObject({ok: false});
  });

  it('does not translate operations or limits the ledger cannot express', () => {
    for (const operation of ['multiply', 'divide', 'append', 'remove'] as const) {
      expect(translate({target: 'stats.STR', operation, value: 2})).toMatchObject({ok: false});
      expect(translate({target: 'resources.current.health', operation, value: 2})).toMatchObject({ok: false});
    }
    expect(translate({target: 'resources.current.health', operation: 'add', value: 25, max: 40})).toMatchObject({ok: false});
    expect(translate({target: 'stats.STR', operation: 'add', value: 1, min: 0})).toMatchObject({ok: false});
  });
});
