// @vitest-environment jsdom
import {describe, expect, it} from 'vitest';
import type {CanonicalFact} from '../../entityTypes';
import {
  CANON_CHECK_SCENE_CHAR_LIMIT,
  buildCanonCheckPrompt,
  buildModelCanonCheckItems,
  canonCheckSceneText,
  isModelCheckItem,
  isModelCheckItemCurrent,
  parseCanonCheckReply,
  sceneCheckText,
  selectCanonCheckFacts,
  validateCanonCheckCandidates
} from './modelCanonCheck';

const fact = (id: string, targetId: string, value: string, factType: CanonicalFact['factType'] = 'appearance'): CanonicalFact => ({
  id, projectId: 'p', targetType: 'entity', targetId, targetName: targetId, factType, value,
  sourceLoreDocumentTitle: 'Dossier', acceptedAt: 1, updatedAt: 1
});
const entities = [
  {id: 'sera', name: 'Sera Kestrel', aliases: ['the Ledgerbound']},
  {id: 'tam', name: 'Tam', aliases: []}
];
const scene = 'The Ledgerbound looked up with eyes the color of new moss.\n\nNobody else was there.';

describe('model-assisted canon check', () => {
  it('sends only facts about entities the scene names, by name or alias, with short refs', () => {
    const selected = selectCanonCheckFacts({
      sceneText: scene,
      entities,
      facts: [fact('f-sera', 'sera', 'gray eyes'), fact('f-tam', 'tam', 'brown hair')]
    });
    expect(selected.map((entry) => [entry.ref, entry.fact.id, entry.entityName])).toEqual([['F1', 'f-sera', 'Sera Kestrel']]);
    // "Tam" inside another word is not a mention.
    expect(selectCanonCheckFacts({sceneText: 'Tamsin waved.', entities, facts: [fact('f-tam', 'tam', 'brown hair')]})).toEqual([]);
  });

  it('builds a prompt with the facts and scene, and refuses when there is nothing to check', () => {
    const selected = selectCanonCheckFacts({sceneText: scene, entities, facts: [fact('f-sera', 'sera', 'gray eyes')]});
    const prompt = buildCanonCheckPrompt({sceneTitle: 'Moss', sceneText: scene, facts: selected});
    expect(prompt.messages[0].content).toContain('F1 — Sera Kestrel — appearance: gray eyes');
    expect(prompt.messages[0].content).toContain('eyes the color of new moss');
    expect(prompt.systemPrompt).toContain('Reply with JSON only');
    expect(() => buildCanonCheckPrompt({sceneTitle: 'x', sceneText: scene, facts: []})).toThrow(/No accepted facts/);
  });

  it('parses a reply wrapped in prose, drops malformed entries, and rejects non-JSON', () => {
    const reply = 'Here you go:\n{"contradictions": [{"factId": "F1", "evidence": {"start": 4, "end": 9, "text": "eyes"}, ' +
      '"summary": "Green, not gray."}, {"factId": 3}, "junk"]}';
    expect(parseCanonCheckReply(reply)).toEqual([
      {factId: 'F1', evidence: {start: 4, end: 9, text: 'eyes'}, summary: 'Green, not gray.'}
    ]);
    expect(parseCanonCheckReply('{"contradictions": []}')).toEqual([]);
    expect(() => parseCanonCheckReply('No problems found.')).toThrow();
  });

  it('keeps only candidates that quote the scene verbatim and cite a fact that was sent', () => {
    const selected = selectCanonCheckFacts({sceneText: scene, entities, facts: [fact('f-sera', 'sera', 'gray eyes')]});
    const evidenceStart = scene.indexOf('eyes the color');
    const {accepted, rejected} = validateCanonCheckCandidates({
      sceneText: scene,
      facts: selected,
      candidates: [
        // Right text, wrong offsets: the verbatim occurrence is used instead.
        {factId: 'F1', evidence: {start: 0, end: 5, text: 'eyes the color of new moss'}, summary: 'Green eyes.'},
        {factId: 'F1', evidence: {text: 'eyes the color of new moss'}, summary: 'Again.'},
        {factId: 'F9', evidence: {text: 'Nobody else'}, summary: 'Unknown fact.'},
        {factId: 'F1', evidence: {text: 'eyes the colour of fresh moss'}, summary: 'Paraphrased quote.'},
        {factId: 'F1', evidence: {text: 'up'}, summary: 'Too short.'},
        {factId: 'F1', evidence: {text: 'Nobody else was there.'}, summary: ''}
      ]
    });
    expect(accepted).toHaveLength(1);
    expect(accepted[0].evidence).toEqual({start: evidenceStart, end: evidenceStart + 26, text: 'eyes the color of new moss'});
    expect(rejected.map((entry) => entry.reason)).toEqual([
      'duplicate', 'unknown-fact', 'evidence-not-in-scene', 'evidence-not-in-scene', 'missing-summary'
    ]);
  });

  it('turns validated conflicts into dismissible, model-labeled review items that expire when the text changes', () => {
    const selected = selectCanonCheckFacts({sceneText: scene, entities, facts: [fact('f-sera', 'sera', 'gray eyes')]});
    const {accepted} = validateCanonCheckCandidates({
      sceneText: scene,
      facts: selected,
      candidates: [{factId: 'F1', evidence: {text: 'eyes the color of new moss'}, summary: 'Moss is green.'}]
    });
    const [item] = buildModelCanonCheckItems({sceneId: 's1', sceneTitle: 'Moss', conflicts: accepted, provider: 'anthropic'});
    expect(item.issue).toMatchObject({code: 'STATE_CONFLICT', severity: 'warning', focusText: 'eyes the color of new moss'});
    expect(item.issue.message).toContain("accepted canon says appearance is 'gray eyes' (from \"Dossier\")");
    expect(item.reviewAnnotation).toMatchObject({source: 'model-check', engineLabel: 'Model-assisted check · Anthropic (Claude)', summary: 'Moss is green.'});
    expect(isModelCheckItem(item)).toBe(true);
    expect(isModelCheckItemCurrent(item, scene)).toBe(true);
    expect(isModelCheckItemCurrent(item, 'She looked up with gray eyes.')).toBe(false);
  });

  it('reads scene HTML as paragraphs and caps very long scenes', () => {
    expect(sceneCheckText('<p>One <em>two</em>.</p><p>Three.</p>')).toBe('One two.\n\nThree.');
    const long = Array.from({length: 3000}, () => 'word').join(' ');
    const checked = canonCheckSceneText(long);
    expect(checked.truncated).toBe(true);
    expect(checked.text.length).toBeLessThanOrEqual(CANON_CHECK_SCENE_CHAR_LIMIT);
    expect(canonCheckSceneText('Short.')).toEqual({text: 'Short.', truncated: false});
  });
});
