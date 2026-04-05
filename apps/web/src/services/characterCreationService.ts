import type {ProjectAISettings, Character} from '../entityTypes';
import {LLMService} from './llm/LLMService';
import {parseAiJson} from '../utils/parseAiJson';
import type {
  CharacterImportDraft,
  CharacterImportSectionAction,
  CharacterImportSectionDraft
} from './characterImportService';

interface GenerateCharacterDraftParams {
  aiSettings: ProjectAISettings;
  prompt: string;
  projectName: string;
  projectDescription?: string;
  existingCharacters?: Character[];
  maxTokens?: number;
}

interface CharacterDraftResponse {
  name?: unknown;
  age?: unknown;
  role?: unknown;
  description?: unknown;
  sections?: Array<{
    title?: unknown;
    content?: unknown;
    action?: unknown;
  }>;
  notes?: unknown;
  note?: unknown;
}

const normalizeSectionAction = (value: string | undefined): CharacterImportSectionAction => {
  switch (value) {
    case 'description':
    case 'ignore':
    case 'later':
      return value;
    case 'notes':
    default:
      return 'notes';
  }
};

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || crypto.randomUUID();

const coerceOptionalText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  return '';
};

const sanitizeSections = (
  sections: CharacterDraftResponse['sections']
): CharacterImportSectionDraft[] => {
  if (!Array.isArray(sections)) return [];

  return sections
    .map((section, index) => {
      const title = coerceOptionalText(section?.title) || `Section ${index + 1}`;
      const content = coerceOptionalText(section?.content);
      return {
        id: `${slugify(title)}-${index}`,
        title,
        content,
        action: normalizeSectionAction(coerceOptionalText(section?.action) || undefined)
      };
    })
    .filter((section) => section.content);
};

export async function generateCharacterCreationDraft({
  aiSettings,
  prompt,
  projectName,
  projectDescription,
  existingCharacters = [],
  maxTokens
}: GenerateCharacterDraftParams): Promise<{draft: CharacterImportDraft; note?: string}> {
  const llmService = new LLMService(aiSettings);
  const existingCast = existingCharacters
    .slice(0, 8)
    .map((character) => `${character.name}${character.fields.role ? ` (${character.fields.role})` : ''}`)
    .join(', ');

  const response = await llmService.complete({
    messages: [
      {
        role: 'user',
        content: [
          'Create a structured fiction character draft from this request.',
          'Return strict JSON with keys: name, age, role, description, sections, notes, note.',
          'sections must be an array of objects with keys: title, content, action.',
          'Allowed action values: notes, description, later.',
          'The description should stay concise and usable as a profile summary.',
          'Sections should capture richer details like personality, background, motivations, relationships, contradictions, secrets, or voice.',
          'notes can hold loose setup residue, open questions, or cautionary assumptions.',
          'Do not write a full story scene. Do not use markdown in field values.',
          '',
          `Project: ${projectName}`,
          `Project description: ${projectDescription?.trim() || '(none)'}`,
          `Existing characters: ${existingCast || '(none yet)'}`,
          '',
          `Character request: ${prompt.trim()}`
        ].join('\n')
      }
    ],
    systemPrompt:
      'You are helping an author create a new character draft inside a worldbuilding app. Be specific, useful, and structurally organized. Prefer a coherent seed with a few strong tensions over generic filler. If you make assumptions, keep them modest and surface them in note or notes rather than pretending they are settled canon.',
    maxTokens
  });

  const parsed = parseAiJson<CharacterDraftResponse>(response.content);
  const draft: CharacterImportDraft = {
    sourceKind: 'ai',
    sourceText: prompt.trim(),
    detectedName: coerceOptionalText(parsed.name),
    detectedAge: coerceOptionalText(parsed.age),
    detectedRole: coerceOptionalText(parsed.role),
    detectedDescription: coerceOptionalText(parsed.description),
    sections: sanitizeSections(parsed.sections),
    unmatchedText: coerceOptionalText(parsed.notes),
    warnings: []
  };

  if (!draft.detectedName) {
    draft.warnings.push('AI did not return a reliable character name. Review before saving.');
  }
  if (!draft.detectedRole) {
    draft.warnings.push('AI left the role vague. Tighten it during review if needed.');
  }
  if (draft.sections.length === 0) {
    draft.warnings.push('AI returned a thin draft. Add or expand detail blocks before saving.');
  }

  return {
    draft,
    note: coerceOptionalText(parsed.note) || undefined
  };
}
