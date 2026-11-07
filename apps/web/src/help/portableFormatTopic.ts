import {PORTABLE_SCHEMA_README} from '../services/portability/portableData';
import type {HelpBlock, HelpTopic} from './helpTopics';

/**
 * Turns the small Markdown README shipped in portable exports into help
 * blocks: paragraphs and `- ` bullet lists. The top `#` heading is dropped
 * because the topic already has a title.
 */
export function markdownToHelpBlocks(markdown: string): HelpBlock[] {
  const blocks: HelpBlock[] = [];
  for (const chunk of markdown.split(/\n\s*\n/)) {
    const lines = chunk.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0 || lines[0].startsWith('#')) continue;
    if (lines.every((line) => line.startsWith('- '))) {
      blocks.push({kind: 'list', items: lines.map((line) => line.slice(2))});
    } else {
      blocks.push({kind: 'paragraph', text: lines.join(' ')});
    }
  }
  return blocks;
}

export const PORTABLE_FORMAT_TOPIC: HelpTopic = {
  id: 'portable-format',
  title: 'Portable export format',
  summary: 'What is inside a Markdown + CSV export, for other tools and people.',
  keywords: ['portable', 'markdown', 'csv', 'zip', 'readme', 'schema', 'interchange'],
  blocks: [
    {
      kind: 'paragraph',
      text: 'Every **Export Markdown + CSV** ZIP includes this description of its files as `README.md`, so other tools and people can read it without SagaSpine.'
    },
    ...markdownToHelpBlocks(PORTABLE_SCHEMA_README)
  ],
  links: [{label: 'Portable data', to: '/portable-data'}]
};
