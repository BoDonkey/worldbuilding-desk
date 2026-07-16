import {describe, expect, it} from 'vitest';
import {
  parseSceneRosterPreferences,
  selectSceneRoster,
  updateSceneRosterOverride,
  type SceneRosterCandidate
} from './sceneRoster';

const candidates: SceneRosterCandidate[] = [
  {
    key: 'character:aria',
    type: 'character',
    id: 'aria',
    name: 'Aria Vale',
    aliases: ['Aria']
  },
  {
    key: 'entity:blade',
    type: 'entity',
    id: 'blade',
    name: 'Ember Blade',
    aliases: ['the blade']
  }
];

describe('selectSceneRoster', () => {
  it('matches canonical names and aliases without partial-word false positives', () => {
    const result = selectSceneRoster({
      content: '<p>Aria lifted the blade. Ariadne watched.</p>',
      candidates
    });

    expect(result.entries.map((entry) => entry.key)).toEqual([
      'character:aria',
      'entity:blade'
    ]);
    expect(result.entries[0]?.matchedSurface).toBe('Aria');
  });

  it('does not auto-select an alias shared by multiple records', () => {
    const result = selectSceneRoster({
      content: '<p>The Warden entered.</p>',
      candidates: [
        {...candidates[0], aliases: ['The Warden']},
        {...candidates[1], aliases: ['The Warden']}
      ]
    });

    expect(result.entries).toEqual([]);
    expect(result.ambiguousSurfaces).toEqual(['The Warden']);
  });

  it('applies scene-specific pins and hides after automatic matching', () => {
    const result = selectSceneRoster({
      content: '<p>Aria waits.</p>',
      candidates,
      overrides: {
        pinnedKeys: ['entity:blade'],
        hiddenKeys: ['character:aria']
      }
    });

    expect(result.entries).toEqual([
      expect.objectContaining({key: 'entity:blade', source: 'pinned'})
    ]);
  });
});

describe('scene roster preferences', () => {
  it('recovers safely from invalid storage and deduplicates stored keys', () => {
    expect(parseSceneRosterPreferences('not json').bySceneId).toEqual({});
    expect(
      parseSceneRosterPreferences(
        JSON.stringify({
          bySceneId: {scene: {pinnedKeys: ['one', 'one'], hiddenKeys: ['two']}}
        })
      ).bySceneId.scene
    ).toEqual({pinnedKeys: ['one'], hiddenKeys: ['two']});
  });

  it('moves a candidate cleanly between pinned, hidden, and automatic states', () => {
    const empty = parseSceneRosterPreferences(null);
    const pinned = updateSceneRosterOverride({
      preferences: empty,
      sceneId: 'scene',
      candidateKey: 'character:aria',
      action: 'pin'
    });
    const hidden = updateSceneRosterOverride({
      preferences: pinned,
      sceneId: 'scene',
      candidateKey: 'character:aria',
      action: 'hide'
    });
    const reset = updateSceneRosterOverride({
      preferences: hidden,
      sceneId: 'scene',
      candidateKey: 'character:aria',
      action: 'reset'
    });

    expect(pinned.bySceneId.scene).toEqual({
      pinnedKeys: ['character:aria'],
      hiddenKeys: []
    });
    expect(hidden.bySceneId.scene).toEqual({
      pinnedKeys: [],
      hiddenKeys: ['character:aria']
    });
    expect(reset.bySceneId.scene).toEqual({pinnedKeys: [], hiddenKeys: []});
  });
});
