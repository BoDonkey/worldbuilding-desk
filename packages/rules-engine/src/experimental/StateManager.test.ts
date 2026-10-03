import {describe, expect, it} from 'vitest';
import {createEmptyRuleset} from '../types/WorldRuleset';
import {StateManager} from './StateManager';

describe('experimental StateManager', () => {
  it('still creates wall-clock character state after the move', () => {
    const ruleset = {
      ...createEmptyRuleset('Clock'),
      statDefinitions: [{id: 'STR', name: 'Strength', type: 'number' as const, defaultValue: 10}]
    };
    const character = new StateManager(ruleset).createCharacter('Tester');

    expect(character.stats.STR).toBe(10);
    expect(character.timers.activeEffects).toEqual({});
    expect(character.environment.exposures).toEqual({});
  });
});
