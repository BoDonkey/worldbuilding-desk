import {describe, expect, it} from 'vitest';
import type {WorldEntity} from '../../entityTypes';
import type {ConsistencyAlias} from '../storage';
import {
  buildSubjectClarification,
  buildSubjectRecords,
  findNamedRecords,
  getPreviousTurn,
  resolveFollowUpSubject,
  rewriteWithSubject,
  type SubjectRecord
} from './followUpSubject';

const entity = (id: string, name: string): WorldEntity =>
  ({id, projectId: 'p', categoryId: 'characters', name, fields: {}, links: [], createdAt: 1, updatedAt: 1}) as WorldEntity;

const alias = (id: string, targetId: string, value: string, targetType: 'entity' | 'character' = 'entity', entityId?: string): ConsistencyAlias => ({
  id, projectId: 'p', targetId, targetType, entityId, alias: value, createdAt: 1, updatedAt: 1
});

const RECORDS: SubjectRecord[] = buildSubjectRecords(
  [entity('sera', 'Sera'), entity('brannic', 'Brannic'), entity('odessa', 'Odessa'), entity('key', 'Emberglass Key')],
  [alias('a1', 'odessa', 'Dess'), alias('a2', 'char-brannic', 'Bran', 'character', 'brannic'), alias('a3', 'char-orphan', 'Nobody', 'character')]
);

const turn = (question: string, answer: string) => ({question, answer});

describe('follow-up subject records', () => {
  it('attaches entity aliases and entity-linked character aliases, and drops unlinked ones', () => {
    expect(RECORDS.find((record) => record.id === 'odessa')?.aliases).toEqual(['Dess']);
    expect(RECORDS.find((record) => record.id === 'brannic')?.aliases).toEqual(['Bran']);
    expect(RECORDS.flatMap((record) => record.aliases)).not.toContain('Nobody');
  });

  it('finds named records by name, alias, and possessive, in order of mention', () => {
    expect(findNamedRecords("Was Dess at Bran's door before Sera?", RECORDS).map((record) => record.id))
      .toEqual(['odessa', 'brannic', 'sera']);
    expect(findNamedRecords('Where is the emberglass key?', RECORDS).map((record) => record.id)).toEqual(['key']);
    expect(findNamedRecords('Where did she go?', RECORDS)).toEqual([]);
  });
});

describe('resolveFollowUpSubject', () => {
  it('carries exactly one candidate forward and rewrites the question onto it', () => {
    const result = resolveFollowUpSubject({
      prompt: 'What is her occupation?',
      previousTurn: turn('Who is Sera?', "I couldn't find saved project context that explicitly answers that."),
      records: RECORDS
    });
    expect(result).toEqual({kind: 'resolved', record: RECORDS[0], prompt: "What is Sera's occupation?"});
  });

  it('uses the previous answer as well as the previous question', () => {
    const result = resolveFollowUpSubject({
      prompt: 'How long has he served?',
      previousTurn: turn('Who carries the ledger now?', 'Brannic carries it after chapter four.'),
      records: RECORDS
    });
    expect(result).toMatchObject({kind: 'resolved', prompt: 'How long has Brannic served?'});
  });

  it('carries an alias-named subject as its canonical record', () => {
    const result = resolveFollowUpSubject({
      prompt: 'And her rank?',
      previousTurn: turn('Where does Dess live?', "I couldn't verify an explicit answer."),
      records: RECORDS
    });
    expect(result).toMatchObject({kind: 'resolved', record: {id: 'odessa', name: 'Odessa'}, prompt: "And Odessa's rank?"});
  });

  it('asks which record is meant when the previous turn named none', () => {
    const result = resolveFollowUpSubject({
      prompt: 'And his rank?',
      previousTurn: turn('Remind me where the ledger is kept', "I couldn't verify an explicit answer."),
      records: RECORDS
    });
    expect(result).toEqual({kind: 'clarify', candidates: []});
  });

  it('asks which record is meant when the previous turn named several', () => {
    const result = resolveFollowUpSubject({
      prompt: 'What about her brother?',
      previousTurn: turn('Did Sera meet Odessa at the gate?', "I couldn't verify an explicit answer."),
      records: RECORDS
    });
    expect(result).toMatchObject({kind: 'clarify', candidates: [{id: 'sera'}, {id: 'odessa'}]});
  });

  it('leaves a message that names its own subject, or does not refer back, unchanged', () => {
    const previousTurn = turn("What is Sera's occupation?", "Sera's accepted occupation is cartographer.");
    expect(resolveFollowUpSubject({prompt: 'How about Dess?', previousTurn, records: RECORDS})).toEqual({kind: 'unchanged'});
    expect(resolveFollowUpSubject({prompt: 'What did Brannic do before he joined?', previousTurn, records: RECORDS}))
      .toEqual({kind: 'unchanged'});
    expect(resolveFollowUpSubject({prompt: 'Who rules the harbor?', previousTurn, records: RECORDS})).toEqual({kind: 'unchanged'});
  });

  it('never carries over without a preceding question in the same conversation', () => {
    expect(resolveFollowUpSubject({prompt: 'What is her occupation?', previousTurn: null, records: RECORDS}))
      .toEqual({kind: 'unchanged'});
  });
});

describe('rewriteWithSubject', () => {
  it.each([
    ['What about her brother?', 'Sera', "What about Sera's brother?"],
    ['Did you ask her about the key?', 'Sera', 'Did you ask Sera about the key?'],
    ['Where did she go after?', 'Sera', 'Where did Sera go after?'],
    ['And his rank?', 'Brannic', "And Brannic's rank?"],
    ['Where is it kept?', 'Emberglass Key', 'Where is Emberglass Key kept?'],
    ['And the ledger?', 'Brannic', 'And the ledger (about Brannic)?']
  ])('rewrites "%s" onto %s', (prompt, name, expected) => {
    expect(rewriteWithSubject(prompt, name)).toBe(expected);
  });
});

describe('getPreviousTurn', () => {
  it('returns only the immediately preceding author question and its reply', () => {
    expect(getPreviousTurn([
      {role: 'user', content: 'Who is Brannic?'},
      {role: 'assistant', content: 'Brannic is a guard.'},
      {role: 'user', content: 'Who is Sera?'},
      {role: 'assistant', content: 'Sera is a delver.'}
    ])).toEqual({question: 'Who is Sera?', answer: 'Sera is a delver.'});
    expect(getPreviousTurn([])).toBeNull();
  });
});

describe('buildSubjectClarification', () => {
  it('names the candidates, or says none was found', () => {
    expect(buildSubjectClarification([])).toContain("couldn't tell which World Bible record");
    expect(buildSubjectClarification(RECORDS.slice(0, 2))).toContain('about Sera or Brannic');
    expect(buildSubjectClarification(RECORDS.slice(0, 3))).toContain('about Sera, Brannic, or Odessa');
  });
});
