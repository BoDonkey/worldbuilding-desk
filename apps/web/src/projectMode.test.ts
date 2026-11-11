import {describe, expect, it} from 'vitest';
import type {ProjectMode, ProjectSettings} from './entityTypes';
import {getProjectCapabilities, getVisibleProjectModeOptions} from './projectMode';

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

describe('mode capabilities', () => {
  const settingsFor = (projectMode?: ProjectMode) =>
    ({projectMode} as unknown as ProjectSettings);
  const modeDecisions = (settings: ProjectSettings | null) => {
    const {
      insertsLiveStatBlocks,
      tracksStoryMechanics,
      usesPlainReviewLanguage,
      hidesSystemCategories
    } = getProjectCapabilities(settings);
    return {
      insertsLiveStatBlocks,
      tracksStoryMechanics,
      usesPlainReviewLanguage,
      hidesSystemCategories
    };
  };

  it('gives LitRPG live stat blocks, mechanics, and record wording', () => {
    expect(modeDecisions(settingsFor('litrpg'))).toEqual({
      insertsLiveStatBlocks: true,
      tracksStoryMechanics: true,
      usesPlainReviewLanguage: false,
      hidesSystemCategories: false
    });
  });

  it('gives Game Simulation mechanics with reusable stat-block placeholders', () => {
    expect(modeDecisions(settingsFor('game'))).toEqual({
      insertsLiveStatBlocks: false,
      tracksStoryMechanics: true,
      usesPlainReviewLanguage: false,
      hidesSystemCategories: false
    });
  });

  it('gives General Fiction story wording and no mechanics', () => {
    expect(modeDecisions(settingsFor('general'))).toEqual({
      insertsLiveStatBlocks: false,
      tracksStoryMechanics: false,
      usesPlainReviewLanguage: true,
      hidesSystemCategories: true
    });
  });

  it('treats settings without a mode as LitRPG', () => {
    expect(modeDecisions(settingsFor())).toEqual(modeDecisions(settingsFor('litrpg')));
  });

  it('keeps the dashboard off mechanics until settings load', () => {
    expect(modeDecisions(null)).toEqual({
      ...modeDecisions(settingsFor('litrpg')),
      tracksStoryMechanics: false
    });
  });
});
