import type {HelpBlock, HelpTopic} from './helpTopics';

/** One piece of help text: plain, or an on-screen name to show in bold. */
export interface HelpTextPart {
  text: string;
  label: boolean;
}

/** Splits `**Label**` markers into parts. An unclosed marker stays as plain text. */
export function parseHelpText(text: string): HelpTextPart[] {
  const parts: HelpTextPart[] = [];
  let rest = text;
  while (rest.length > 0) {
    const open = rest.indexOf('**');
    const close = open === -1 ? -1 : rest.indexOf('**', open + 2);
    if (open === -1 || close === -1) {
      parts.push({text: rest, label: false});
      break;
    }
    if (open > 0) parts.push({text: rest.slice(0, open), label: false});
    if (close > open + 2) parts.push({text: rest.slice(open + 2, close), label: true});
    rest = rest.slice(close + 2);
  }
  return parts;
}

function blockText(block: HelpBlock): string {
  return block.kind === 'paragraph' ? block.text : block.items.join(' ');
}

function normalize(value: string): string {
  return value.replace(/\*\*/g, '').toLocaleLowerCase();
}

/**
 * Topics whose title, summary, keywords, or text contain every word of the
 * query, in their original order. An empty query returns every topic.
 */
export function filterHelpTopics(topics: HelpTopic[], query: string): HelpTopic[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return topics;
  return topics.filter((topic) => {
    const haystack = normalize(
      [topic.title, topic.summary, ...topic.keywords, ...topic.blocks.map(blockText)].join(' ')
    );
    return words.every((word) => haystack.includes(word));
  });
}
