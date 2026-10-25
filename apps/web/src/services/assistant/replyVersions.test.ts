import {describe, expect, it} from 'vitest';
import type {AITextProvenance} from '../editor/aiTextProvenance';
import {
  dropShownReply,
  keepShownReply,
  replyVersionCount,
  showReplyVersion,
  startReplyVersion,
  updateShownReply
} from './replyVersions';

const provenance = (at: number) => ({origin: 'scene-revision', at}) as unknown as AITextProvenance;
const reply = {role: 'assistant' as const, content: 'First.', provenance: provenance(1), contextSources: ['Accepted canon - Aria']};

describe('assistant reply versions (4.73)', () => {
  it('adds a version with its own provenance and keeps the rest of the message', () => {
    const next = updateShownReply(startReplyVersion(reply, provenance(2)), 'Second.');
    expect(next).toMatchObject({content: 'Second.', provenance: provenance(2), versionIndex: 1, contextSources: reply.contextSources});
    expect(replyVersionCount(next)).toBe(2);
    expect(showReplyVersion(next, 0)).toMatchObject({content: 'First.', provenance: provenance(1)});
    expect(showReplyVersion(next, 5)).toBe(next);
  });

  it('keeps only the version shown, and drops a failed version', () => {
    const chosen = showReplyVersion(updateShownReply(startReplyVersion(reply, provenance(2)), 'UNKEPT'), 0);
    expect(keepShownReply(chosen)).toEqual(reply);
    expect(dropShownReply(startReplyVersion(reply, provenance(2)))).toEqual(reply);
    expect(updateShownReply(reply, 'x').content).toBe('x');
  });
});
