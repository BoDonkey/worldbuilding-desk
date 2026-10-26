import {describe, expect, it} from 'vitest';
import {getVisibleProjectModeOptions} from './projectMode';

describe('first-release project modes', () => {
  it('offers only General Fiction and LitRPG for new and ordinary projects', () => {
    expect(getVisibleProjectModeOptions().map((option) => option.value)).toEqual([
      'litrpg',
      'general'
    ]);
    expect(getVisibleProjectModeOptions('general').map((option) => option.value)).toEqual([
      'litrpg',
      'general'
    ]);
  });

  it('keeps an existing Game Simulation project visible until it changes mode', () => {
    expect(getVisibleProjectModeOptions('game').map((option) => option.value)).toEqual([
      'litrpg',
      'game',
      'general'
    ]);
  });
});
