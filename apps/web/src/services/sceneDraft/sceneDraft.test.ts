// @vitest-environment jsdom
import {describe, expect, it} from 'vitest';
import type {ChapterCard, ProjectAISettings, WritingDocument} from '../../entityTypes';
import type {CharacterVoiceContext} from '../characterLab';
import {
  SCENE_DRAFT_WORD_CAP,
  buildSceneDraftPrompt,
  canDraftScenes,
  capDraftWords,
  clampTargetWords,
  formatSceneDraftInsertHtml,
  formatSceneDraftScratchpadHtml,
  isSceneDraftable,
  previousSceneEnding,
  sceneGoalFromCards,
  type SceneDraftInputs
} from './sceneDraft';

const scene = (id: string, content: string, order: number): WritingDocument => ({
  id, projectId: 'p', title: id, content, order, createdAt: order, updatedAt: order
});
const words = (count: number, word = 'word') => Array.from({length: count}, () => word).join(' ');
const inputs = (changes: Partial<SceneDraftInputs> = {}): SceneDraftInputs => ({
  goal: 'Mara steals the ledger.',
  povEntityId: null,
  presentEntityIds: [],
  setting: '',
  beats: '',
  targetWords: 1000,
  previousEnding: '',
  notes: '',
  ...changes
});
const mara: CharacterVoiceContext = {
  entityId: 'mara',
  name: 'Mara',
  positionLabel: 'the start of Heist',
  sections: [{kind: 'record', source: 'World Bible: Mara', content: 'A courier with debts.'}]
} as unknown as CharacterVoiceContext;

describe('scene draft rules', () => {
  it('offers drafting only when the project allows it and consultation is on', () => {
    const settings = (allowSceneDrafts?: boolean, enableAIConsultation = true) =>
      ({allowSceneDrafts, inspectorSettings: {enableAIConsultation}}) as unknown as ProjectAISettings;
    expect(canDraftScenes(undefined)).toBe(false);
    expect(canDraftScenes(settings(undefined))).toBe(false);
    expect(canDraftScenes(settings(true))).toBe(true);
    expect(canDraftScenes(settings(true, false))).toBe(false);
  });

  it('treats a scene of 50 words or fewer as draftable', () => {
    expect(isSceneDraftable('<p></p>')).toBe(true);
    expect(isSceneDraftable(`<p>${words(50)}</p>`)).toBe(true);
    expect(isSceneDraftable(`<p>${words(51)}</p>`)).toBe(false);
  });

  it('clamps the target length to the cap', () => {
    expect(clampTargetWords(5000)).toBe(SCENE_DRAFT_WORD_CAP);
    expect(clampTargetWords(10)).toBe(100);
    expect(clampTargetWords(Number.NaN)).toBe(1000);
  });

  it('reads the end of the previous scene only', () => {
    const scenes = [scene('one', `<p>${words(200, 'early')} last words.</p>`, 0), scene('two', '<p></p>', 1)];
    expect(previousSceneEnding(scenes, 'one')).toBe('');
    const ending = previousSceneEnding(scenes, 'two');
    expect(ending.startsWith('…')).toBe(true);
    expect(ending.endsWith('last words.')).toBe(true);
    expect(ending.split(' ').length).toBe(150);
  });

  it('builds a starting goal from linked chapter cards', () => {
    const card = {
      id: 'c', order: 0, summary: 'The heist goes wrong.', sceneIds: ['two'],
      plotPoints: [{id: 'b', title: 'Alarm', order: 1}, {id: 'a', title: 'Entry', order: 0}]
    } as unknown as ChapterCard;
    expect(sceneGoalFromCards([card])).toBe('The heist goes wrong. Plot points: Entry; Alarm.');
  });

  it('cuts a draft at the cap on a sentence break', () => {
    const text = `${words(1000)}. ${words(600)}.`;
    const capped = capDraftWords(text);
    expect(capped.trimmed).toBe(true);
    expect(capped.text.endsWith('word.')).toBe(true);
    expect(capped.text.split(' ').length).toBe(1000);
    expect(capDraftWords('Short scene.')).toEqual({text: 'Short scene.', trimmed: false});
  });
});

describe('scene draft prompt', () => {
  it('sends the visible inputs and chosen characters, and needs a goal', () => {
    const prompt = buildSceneDraftPrompt({
      inputs: inputs({
        povEntityId: 'mara', presentEntityIds: ['mara'], setting: 'The archive at night',
        beats: 'Entry\nAlarm', previousEnding: 'The door clicks shut.', notes: 'Present tense.', targetWords: 9000
      }),
      characters: [mara]
    });
    expect(prompt.systemPrompt).toContain('Point of view: Mara.');
    expect(prompt.systemPrompt).toContain(`never more than ${SCENE_DRAFT_WORD_CAP}`);
    expect(prompt.systemPrompt).toContain('about 1500 words');
    expect(prompt.systemPrompt).toContain('A courier with debts.');
    const request = prompt.messages[0].content;
    for (const sent of ['Mara steals the ledger.', 'The archive at night', 'Entry\nAlarm', 'The door clicks shut.', 'Present tense.']) {
      expect(request).toContain(sent);
    }
    expect(() => buildSceneDraftPrompt({inputs: inputs({goal: '  '}), characters: []})).toThrow(/Describe what happens/);
  });

  it('leaves out empty fields and character rules when no characters are chosen', () => {
    const prompt = buildSceneDraftPrompt({inputs: inputs(), characters: []});
    expect(prompt.systemPrompt).not.toContain('Character rules');
    expect(prompt.messages[0].content).not.toContain('Setting');
  });

  it('formats an insert of prose only, and a labeled Scratchpad copy', () => {
    const draft = {
      id: 'd', sceneTitle: 'Heist', inputs: inputs(), text: 'One.\n\nTwo <b>.', stopped: false, trimmed: true
    };
    expect(formatSceneDraftInsertHtml(draft)).toBe('<p>One.</p><p>Two &lt;b&gt;.</p>');
    const scratch = formatSceneDraftScratchpadHtml(draft);
    expect(scratch).toContain('Scene draft: Heist');
    expect(scratch).toContain('Not canon.');
    expect(scratch).toContain(`Cut at ${SCENE_DRAFT_WORD_CAP} words.`);
  });
});
