import type {HelpBlock, HelpTopic} from './helpTopics';

/** One piece of help text: plain, an on-screen name in bold, or a file name in code. */
export interface HelpTextPart {
  text: string;
  label: boolean;
  code?: boolean;
}

const MARKERS = ['**', '`'] as const;

/**
 * Splits `**Label**` and `` `code` `` markers into parts. An unclosed marker
 * stays as plain text.
 */
export function parseHelpText(text: string): HelpTextPart[] {
  const parts: HelpTextPart[] = [];
  let rest = text;
  while (rest.length > 0) {
    let marker: (typeof MARKERS)[number] | null = null;
    let open = -1;
    let close = -1;
    for (const candidate of MARKERS) {
      const start = rest.indexOf(candidate);
      if (start === -1 || (open !== -1 && start >= open)) continue;
      const end = rest.indexOf(candidate, start + candidate.length);
      if (end === -1) continue;
      marker = candidate;
      open = start;
      close = end;
    }
    if (!marker) {
      parts.push({text: rest, label: false});
      break;
    }
    if (open > 0) parts.push({text: rest.slice(0, open), label: false});
    const inner = rest.slice(open + marker.length, close);
    if (inner) parts.push(marker === '`' ? {text: inner, label: false, code: true} : {text: inner, label: true});
    rest = rest.slice(close + marker.length);
  }
  return parts;
}

function blockText(block: HelpBlock): string {
  return block.kind === 'paragraph' ? block.text : block.items.join(' ');
}

function normalize(value: string): string {
  return value.replace(/\*\*|`/g, '').toLocaleLowerCase();
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
