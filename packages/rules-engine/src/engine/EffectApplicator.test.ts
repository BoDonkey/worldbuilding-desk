import {describe, expect, it} from 'vitest';
import {createEmptyCharacterState} from '../types/CharacterState';
import type {Effect} from '../types/Effect';
import {EffectApplicator} from './EffectApplicator';

const base = () => ({
  ...createEmptyCharacterState(
    'Tester',
    'ruleset-1',
    {STR: 10, title: 'Squire'},
    {current: {health: 30}, max: {health: 40}}
  ),
  custom: {tags: ['a', 'b'], items: [{id: 'x'}, {id: 'y'}], flags: {seen: true, hidden: false}}
});

describe('EffectApplicator', () => {
  const applicator = new EffectApplicator();
  const apply = (effect: Effect, state = base()) => applicator.applyEffect(effect, state);

  it('applies numeric operations to nested targets', () => {
    expect(apply({target: 'stats.STR', operation: 'set', value: 12}).stats.STR).toBe(12);
    expect(apply({target: 'stats.STR', operation: 'add', value: 3}).stats.STR).toBe(13);
    expect(apply({target: 'stats.STR', operation: 'subtract', value: 4}).stats.STR).toBe(6);
    expect(apply({target: 'stats.STR', operation: 'multiply', value: 2}).stats.STR).toBe(20);
    expect(apply({target: 'stats.STR', operation: 'divide', value: 4}).stats.STR).toBe(2.5);
  });

  it('leaves the value unchanged when dividing by zero', () => {
    expect(apply({target: 'stats.STR', operation: 'divide', value: 0}).stats.STR).toBe(10);
  });

  it('clamps numeric results to min and max', () => {
    expect(
      apply({target: 'resources.current.health', operation: 'add', value: 25, max: 40})
        .resources.current.health
    ).toBe(40);
    expect(
      apply({target: 'resources.current.health', operation: 'subtract', value: 50, min: 0})
        .resources.current.health
    ).toBe(0);
  });

  it('resolves formula values against the current state', () => {
    expect(apply({target: 'resources.current.health', operation: 'set', value: 'STR * 3'}).resources.current.health).toBe(30);
  });

  it('treats plain strings as values, not formulas', () => {
    expect(apply({target: 'stats.title', operation: 'set', value: 'Knight'}).stats.title).toBe('Knight');
  });

  it('appends to and removes from arrays and objects', () => {
    expect(apply({target: 'custom.tags', operation: 'append', value: 'c'}).custom?.tags).toEqual(['a', 'b', 'c']);
    expect(apply({target: 'custom.tags', operation: 'remove', value: 'a'}).custom?.tags).toEqual(['b']);
    expect(apply({target: 'custom.items', operation: 'remove', value: 'x'}).custom?.items).toEqual([{id: 'y'}]);
    expect(apply({target: 'custom.flags', operation: 'remove', value: 'hidden'}).custom?.flags).toEqual({seen: true});
  });

  it('never mutates the input state', () => {
    const state = base();
    const snapshot = structuredClone(state);
    applicator.applyEffects(
      [
        {target: 'stats.STR', operation: 'add', value: 1},
        {target: 'custom.tags', operation: 'append', value: 'z'}
      ],
      state
    );
    expect(state).toEqual(snapshot);
  });

  it('applies effects in order', () => {
    const next = applicator.applyEffects(
      [
        {target: 'stats.STR', operation: 'add', value: 2},
        {target: 'stats.STR', operation: 'multiply', value: 10}
      ],
      base()
    );
    expect(next.stats.STR).toBe(120);
  });
});
