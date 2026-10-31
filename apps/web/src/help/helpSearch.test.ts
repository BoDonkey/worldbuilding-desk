import fs from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {filterHelpTopics, parseHelpText} from './helpSearch';
import {HELP_TOPICS} from './helpTopics';

describe('parseHelpText', () => {
  it('marks on-screen names', () => {
    expect(parseHelpText('Open **Projects** and choose **Export Backup**.')).toEqual([
      {text: 'Open ', label: false},
      {text: 'Projects', label: true},
      {text: ' and choose ', label: false},
      {text: 'Export Backup', label: true},
      {text: '.', label: false}
    ]);
  });

  it('keeps an unclosed marker as plain text', () => {
    expect(parseHelpText('Press **Cmd')).toEqual([{text: 'Press **Cmd', label: false}]);
  });
});

describe('filterHelpTopics', () => {
  it('returns every topic for an empty query', () => {
    expect(filterHelpTopics(HELP_TOPICS, '  ')).toHaveLength(HELP_TOPICS.length);
  });

  it('matches keywords and body text, ignoring case and markers', () => {
    expect(filterHelpTopics(HELP_TOPICS, 'SAGABACKUP').map((topic) => topic.id)).toContain('backup-export');
    expect(filterHelpTopics(HELP_TOPICS, 'always ignore').map((topic) => topic.id)).toEqual(['review']);
    expect(filterHelpTopics(HELP_TOPICS, 'ollama cloud').map((topic) => topic.id)).toContain('privacy');
  });

  it('needs every word to match', () => {
    expect(filterHelpTopics(HELP_TOPICS, 'backup zebra')).toEqual([]);
  });
});

describe('help topics', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'App.tsx'), 'utf8');

  it('have unique ids and balanced label markers', () => {
    expect(new Set(HELP_TOPICS.map((topic) => topic.id)).size).toBe(HELP_TOPICS.length);
    for (const topic of HELP_TOPICS) {
      for (const block of topic.blocks) {
        const texts = block.kind === 'paragraph' ? [block.text] : block.items;
        for (const text of texts) expect((text.match(/\*\*/g) ?? []).length % 2, text).toBe(0);
      }
    }
  });

  it('link only to screens the app has', () => {
    for (const topic of HELP_TOPICS) {
      for (const link of topic.links) expect(appSource, link.to).toContain(`path='${link.to}'`);
    }
  });

  it('cover the 5.8 baseline subjects', () => {
    expect(HELP_TOPICS.map((topic) => topic.id)).toEqual(
      expect.arrayContaining(['backup-export', 'importing', 'review', 'canon-model', 'ai-setup', 'privacy'])
    );
  });
});
