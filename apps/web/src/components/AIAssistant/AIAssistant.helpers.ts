export type AIAssistantContextType =
  | 'document'
  | 'rule'
  | 'rules'
  | 'character'
  | 'world-bible';

export const stripAssistantThinking = (content: string): string =>
  content
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .replace(/^[\s\S]*?<\/think>/i, '')
    .trimStart();

export const getContextLabel = (contextType?: AIAssistantContextType): string =>
  contextType === 'world-bible' ? 'Current World Bible record context' : 'Selected text';

export const getContextInstruction = (
  contextType: AIAssistantContextType | undefined,
  contextLabel: string
): string =>
  contextType === 'world-bible'
    ? `${contextLabel} is available below. It may include only the field most relevant to the author's request. Use the supplied field content as source material, but do not repeat field labels, keys, or unrelated record context in the answer. If rewriting or expanding a section, return the revised section text only unless the author asks for analysis.`
    : `The author has highlighted text in the editor. The ${contextLabel.toLowerCase()} is available as reference context below. Use it when the author asks about the selection or uses phrases like "this", "these", "it", "them", "the characters", or "the locations". Do not assume the author wants expansion; answer the task they ask for.`;

const FACT_QUESTION_PATTERN =
  /^(?:what|who|where|when|why|how\s+(?:long|many|much|old)|is|are|was|were|did|does|do|has|have|had|can)\b/i;

export const requiresProjectGrounding = (
  promptText: string,
  hasSelectedContext: boolean
): boolean => {
  if (hasSelectedContext) return false;
  const prompt = promptText.trim();
  if (!FACT_QUESTION_PATTERN.test(prompt)) return false;
  if (/^(?:what\s+(?:should|could|might)|can you\s+(?:brainstorm|draft|generate|help|suggest|write))\b/i.test(prompt)) {
    return false;
  }
  return true;
};

const MEMORY_QUERY_STOP_WORDS = new Set([
  'are', 'can', 'did', 'does', 'for', 'from', 'had', 'has', 'have', 'how',
  'before', 'he', 'her', 'hers', 'him', 'his', 'into', 'is', 'it', 'its',
  'long', 'many', 'much', 'old', 'she', 'the', 'their', 'them', 'they', 'this',
  'was', 'were',
  'what', 'when', 'where', 'which', 'who', 'why', 'with', 'would'
]);

export const getMemoryQueryTerms = (query: string): string[] =>
  Array.from(
    new Set(
      query
        .toLowerCase()
        .replace(/[^a-z0-9'-]+/g, ' ')
        .split(/\s+/)
        .map((term) => term.replace(/^['-]+|['-]+$/g, ''))
        .filter((term) => term.length >= 3 && !MEMORY_QUERY_STOP_WORDS.has(term))
    )
  );

export const getShodhTrustLabel = (tags: string[] | undefined): string => {
  const normalizedTags = new Set((tags ?? []).map((tag) => tag.toLowerCase()));
  if (normalizedTags.has('canon_fact')) return 'Accepted canon fact';
  if (normalizedTags.has('worldbible')) return 'Accepted canon';
  if (normalizedTags.has('rule')) return 'Rules reference';
  if (normalizedTags.has('scene')) return 'Scene draft';
  return 'Project memory';
};

const normalizeContextToken = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

type WorldBibleContextField = {
  label: string;
  key: string;
  content: string;
  block: string;
};

export const selectWorldBibleContextForPrompt = (
  contextText: string,
  promptText: string
): string => {
  const editableFieldsMarker = 'Editable fields:';
  if (!contextText.includes(editableFieldsMarker)) return contextText;

  const [recordHeader, fieldsText = ''] = contextText.split(editableFieldsMarker);
  const fields: WorldBibleContextField[] = fieldsText
    .split(/\n\n---\n\n/g)
    .map((block) => {
      const label = block.match(/Field:\s*(.+)/)?.[1]?.trim() ?? '';
      const key = block.match(/Key:\s*(.+)/)?.[1]?.trim() ?? '';
      const content = block.match(/Current content:\n([\s\S]*)/)?.[1]?.trim() ?? '';
      return {label, key, content, block: block.trim()};
    })
    .filter((field) => field.label && field.key);

  if (fields.length === 0) return contextText;

  const normalizedPrompt = normalizeContextToken(promptText);
  const matchingFields = fields.filter((field) => {
    const normalizedLabel = normalizeContextToken(field.label);
    const normalizedKey = normalizeContextToken(field.key);
    return (
      normalizedLabel.length > 0 && normalizedPrompt.includes(normalizedLabel)
    ) || (
      normalizedKey.length > 0 && normalizedPrompt.includes(normalizedKey)
    );
  });
  const selectedFields = matchingFields.length > 0 ? matchingFields : [];
  const fieldIndex = fields
    .map((field) => `- ${field.label} (${field.key})`)
    .join('\n');

  return [
    recordHeader.trim(),
    `Available fields:\n${fieldIndex}`,
    selectedFields.length > 0
      ? `Relevant field content:\n\n${selectedFields.map((field) => field.block).join('\n\n---\n\n')}`
      : 'No exact field heading was matched. Ask a clarifying question or answer using the field list only.'
  ]
    .filter(Boolean)
    .join('\n\n');
};
