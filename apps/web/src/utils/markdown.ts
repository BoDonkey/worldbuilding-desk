const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const applyInlineMarkdown = (value: string) => {
  let result = escapeHtml(value);
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  result = result.replace(/(^|[^\w])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
  result = result.replace(/(^|[^\w])_([^_]+)_(?!_)/g, '$1<em>$2</em>');
  return result;
};

const flushParagraph = (buffer: string[], blocks: string[]) => {
  if (buffer.length === 0) {
    return;
  }
  blocks.push(`<p>${applyInlineMarkdown(buffer.join(' '))}</p>`);
  buffer.length = 0;
};

const flushList = (
  listType: 'ul' | 'ol' | null,
  items: string[],
  blocks: string[]
): 'ul' | 'ol' | null => {
  if (!listType || items.length === 0) {
    return null;
  }
  blocks.push(
    `<${listType}>${items.map((item) => `<li>${applyInlineMarkdown(item)}</li>`).join('')}</${listType}>`
  );
  items.length = 0;
  return null;
};

export const looksLikeMarkdown = (value: string) =>
  /(^|\n)(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```)/m.test(value) ||
  /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`)/.test(value);

export const markdownToHtml = (value: string): string => {
  const normalized = value.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return '<p></p>';
  }

  const lines = normalized.split('\n');
  const blocks: string[] = [];
  const paragraphBuffer: string[] = [];
  const listItems: string[] = [];
  let currentListType: 'ul' | 'ol' | null = null;
  let inCodeBlock = false;
  const codeBlockLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      flushParagraph(paragraphBuffer, blocks);
      currentListType = flushList(currentListType, listItems, blocks);
      if (inCodeBlock) {
        blocks.push(`<pre><code>${escapeHtml(codeBlockLines.join('\n'))}</code></pre>`);
        codeBlockLines.length = 0;
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }

    if (!trimmed) {
      flushParagraph(paragraphBuffer, blocks);
      currentListType = flushList(currentListType, listItems, blocks);
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph(paragraphBuffer, blocks);
      currentListType = flushList(currentListType, listItems, blocks);
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${applyInlineMarkdown(headingMatch[2])}</h${level}>`);
      continue;
    }

    const blockquoteMatch = trimmed.match(/^>\s?(.*)$/);
    if (blockquoteMatch) {
      flushParagraph(paragraphBuffer, blocks);
      currentListType = flushList(currentListType, listItems, blocks);
      blocks.push(`<blockquote><p>${applyInlineMarkdown(blockquoteMatch[1])}</p></blockquote>`);
      continue;
    }

    const unorderedMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    if (unorderedMatch) {
      flushParagraph(paragraphBuffer, blocks);
      if (currentListType !== 'ul') {
        currentListType = flushList(currentListType, listItems, blocks);
        currentListType = 'ul';
      }
      listItems.push(unorderedMatch[1]);
      continue;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph(paragraphBuffer, blocks);
      if (currentListType !== 'ol') {
        currentListType = flushList(currentListType, listItems, blocks);
        currentListType = 'ol';
      }
      listItems.push(orderedMatch[1]);
      continue;
    }

    if (currentListType) {
      currentListType = flushList(currentListType, listItems, blocks);
    }
    paragraphBuffer.push(trimmed);
  }

  if (inCodeBlock) {
    blocks.push(`<pre><code>${escapeHtml(codeBlockLines.join('\n'))}</code></pre>`);
  }
  flushParagraph(paragraphBuffer, blocks);
  flushList(currentListType, listItems, blocks);

  return blocks.join('');
};
