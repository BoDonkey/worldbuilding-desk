const extractJsonCandidate = (value: string) => {
  const trimmed = value.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const unfenced = (fencedMatch?.[1] ?? trimmed).trim();
  const objectMatch = unfenced.match(/\{[\s\S]*\}/);
  return (objectMatch?.[0] ?? unfenced).trim();
};

const normalizeCandidate = (candidate: string) =>
  candidate
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/}\s*(?={)/g, '},{')
    .replace(/]\s*(?=")/g, '],')
    .replace(/"\s*(?=")/g, '",');

const decodeScalar = (token: string | undefined): unknown => {
  if (!token) return undefined;
  const trimmed = token.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  const numeric = Number(trimmed);
  return Number.isNaN(numeric) ? trimmed : numeric;
};

const extractScalarField = (candidate: string, key: string) => {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = candidate.match(
    new RegExp(`"${escapedKey}"\\s*:\\s*("(?:\\\\.|[^"\\\\])*"|true|false|null|-?\\d+(?:\\.\\d+)?)`, 's')
  );
  return decodeScalar(match?.[1]);
};

const extractArraySlice = (candidate: string, key: string) => {
  const keyIndex = candidate.indexOf(`"${key}"`);
  if (keyIndex === -1) return '';
  const start = candidate.indexOf('[', keyIndex);
  if (start === -1) return '';

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < candidate.length; index += 1) {
    const char = candidate[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '[') depth += 1;
    if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        return candidate.slice(start, index + 1);
      }
    }
  }

  return '';
};

const fallbackParse = <T>(candidate: string): T => {
  const sectionsSlice = extractArraySlice(candidate, 'sections');
  let sections: unknown = undefined;
  if (sectionsSlice) {
    try {
      sections = JSON.parse(normalizeCandidate(sectionsSlice));
    } catch {
      sections = [];
    }
  }

  return {
    name: extractScalarField(candidate, 'name'),
    age: extractScalarField(candidate, 'age'),
    role: extractScalarField(candidate, 'role'),
    description: extractScalarField(candidate, 'description'),
    sections,
    notes: extractScalarField(candidate, 'notes'),
    note: extractScalarField(candidate, 'note'),
    ignoredSections: extractScalarField(candidate, 'ignoredSections'),
    content: extractScalarField(candidate, 'content')
  } as T;
};

export const parseAiJson = <T>(value: string): T => {
  const candidate = extractJsonCandidate(value);
  const normalized = normalizeCandidate(candidate);

  try {
    return JSON.parse(normalized) as T;
  } catch {
    return fallbackParse<T>(normalized);
  }
};
