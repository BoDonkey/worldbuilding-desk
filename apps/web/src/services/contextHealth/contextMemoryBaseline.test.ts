import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import {buildAssistantHistory} from '../assistant/conversationHistory';
import {getMemoryQueryTerms} from '../../components/AIAssistant/AIAssistant.helpers';
import {RAGService} from '../rag/RAGService';
import {ShodhMemoryService, type MemoryEntry} from '../shodh/ShodhMemoryService';

type IndexedSource = {documentId: string; content: string};

const filler = (label: string) => `${label} `.repeat(90);

const matchingMemories = (memories: MemoryEntry[], query: string, limit = 3) => {
  const terms = getMemoryQueryTerms(query);
  return memories
    .map((memory) => {
      const haystack = `${memory.title} ${memory.summary} ${memory.tags?.join(' ') ?? ''}`.toLowerCase();
      const matched = terms.filter((term) => haystack.includes(term));
      return {memory, relevance: terms.length > 0 ? matched.length / terms.length : 0};
    })
    .filter(({relevance}) => relevance > 0)
    .sort((left, right) => right.relevance - left.relevance)
    .slice(0, limit);
};

async function baselineProject(projectId: string) {
  const rag = new RAGService();
  const memory = new ShodhMemoryService();
  await Promise.all([rag.init(projectId), memory.init(projectId)]);
  return {
    rag,
    memory,
    async save(documentId: string, title: string, content: string) {
      await rag.indexDocument(documentId, title, content, 'scene');
      await memory.captureAutoMemory({projectId, documentId, title, content, tags: ['scene']});
    },
    async retrieve(query: string) {
      const [ragResults, memories] = await Promise.all([rag.search(query, 3), memory.listMemories()]);
      return {
        indexed: ragResults.map(({chunk}): IndexedSource => ({documentId: chunk.documentId, content: chunk.content})),
        memories: matchingMemories(memories, query).map(({memory: entry}) => entry)
      };
    },
    close() {
      rag.close();
      memory.close();
    }
  };
}

describe('context and memory baseline benchmark (slice 1.6)', () => {
  it('retrieves a distant end-of-scene detail from indexed context that the 500-character memory omits', async () => {
    const project = await baselineProject(`memory-baseline-distant-${crypto.randomUUID()}`);
    try {
      await project.save(
        'scene-2',
        'The Chapel',
        `${filler('Rain crossed the empty courtyard.')}
        Mara hid the silver key beneath the chapel bell.`
      );

      const result = await project.retrieve('Where did Mara hide the silver key?');

      expect(result.indexed.some((source) => source.content.includes('beneath the chapel bell'))).toBe(true);
      expect(result.memories.some((entry) => entry.summary.includes('beneath the chapel bell'))).toBe(false);
    } finally {
      project.close();
    }
  });

  it('can add an obsolete relationship extract beside the indexed current relationship', async () => {
    const project = await baselineProject(`memory-baseline-relationship-${crypto.randomUUID()}`);
    try {
      await project.save('scene-1', 'First Meeting', `Aria and Brannic were enemies. ${filler('They traded threats.')}`);
      await project.save(
        'scene-20',
        'The Accord',
        `${filler('The siege lasted through the night.')}
        Aria and Brannic became allies after signing the river accord.`
      );

      const result = await project.retrieve('How did Aria and Brannic become allies?');

      expect(result.indexed.some((source) => source.content.includes('became allies'))).toBe(true);
      expect(result.memories.some((entry) => entry.summary.includes('were enemies'))).toBe(true);
      expect(result.memories.some((entry) => entry.summary.includes('became allies'))).toBe(false);
    } finally {
      project.close();
    }
  });

  it('replaces both derived stores after a scene revision', async () => {
    const project = await baselineProject(`memory-baseline-revision-${crypto.randomUUID()}`);
    try {
      await project.save('scene-4', 'The Cache', 'Tarin left the obsidian seal inside the mill.');
      await project.save('scene-4', 'The Cache', 'Tarin left the copper seal inside the north tower.');

      const current = await project.retrieve('Where did Tarin leave the copper seal?');
      const allMemories = await project.memory.listMemories();
      const diagnostics = await project.rag.getDiagnostics();

      expect(current.indexed.some((source) => source.content.includes('north tower'))).toBe(true);
      expect(allMemories).toHaveLength(1);
      expect(allMemories[0]?.summary).toContain('copper seal');
      expect(allMemories[0]?.summary).not.toContain('obsidian seal');
      expect(diagnostics).toMatchObject({documentCount: 1});
    } finally {
      project.close();
    }
  });

  it('keeps same-named characters isolated by project database', async () => {
    const north = await baselineProject(`memory-baseline-north-${crypto.randomUUID()}`);
    const south = await baselineProject(`memory-baseline-south-${crypto.randomUUID()}`);
    try {
      await north.save('scene-1', 'North', 'Mara carries the glass compass.');
      await south.save('scene-1', 'South', 'Mara carries the bone flute.');

      const northResult = await north.retrieve('What does Mara carry?');
      const southResult = await south.retrieve('What does Mara carry?');

      expect(northResult.indexed.map((source) => source.content).join('\n')).toContain('glass compass');
      expect(northResult.indexed.map((source) => source.content).join('\n')).not.toContain('bone flute');
      expect(southResult.indexed.map((source) => source.content).join('\n')).toContain('bone flute');
      expect(southResult.indexed.map((source) => source.content).join('\n')).not.toContain('glass compass');
    } finally {
      north.close();
      south.close();
    }
  });

  it('drops older ordinary-assistant turns under pressure instead of summarizing them', () => {
    const messages = Array.from({length: 8}, (_, index) => [
      {role: 'user' as const, content: `Question ${index}: ${'detail '.repeat(45)}`},
      {role: 'assistant' as const, content: `Answer ${index}: ${'response '.repeat(45)}`}
    ]).flat();

    const result = buildAssistantHistory(messages, 650);

    expect(result.omittedTurns).toBeGreaterThan(0);
    expect(result.messages.at(-2)?.content).toContain('Question 7');
    expect(result.messages.every((message) => !message.content.includes('Summary of'))).toBe(true);
  });
});
