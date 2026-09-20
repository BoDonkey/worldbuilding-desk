import type {
  EntityCategory,
  LoreDocument,
  LoreDocumentKind,
  WorldCanvasDocument,
  WorldCanvasLens,
  WorldCanvasLensKind,
  WorldCanvasQuestion,
  WorldEntity
} from '../../entityTypes';
import {
  deriveSourceNoteTitle,
  summarizeContent
} from '../lore/sourceNoteCapture';

export interface WorldCanvasLensDefinition {
  kind: WorldCanvasLensKind;
  label: string;
  prompt: string;
  uncovers: string;
  starters: readonly string[];
}

export const LENS_DEFINITIONS: readonly WorldCanvasLensDefinition[] = [
  {
    kind: 'people',
    label: 'Inhabitants and societies',
    prompt: 'Who shapes daily life here, and whose perspective has not been heard yet?',
    uncovers: 'The groups, relationships, hierarchies, and points of view that make the world feel inhabited.',
    starters: ['Who belongs here—and who is treated as an outsider?', 'Which species, communities, or social groups hold power over others?']
  },
  {
    kind: 'places',
    label: 'Places',
    prompt: 'Which places define this world, and what makes each one feel distinct?',
    uncovers: 'The environments, boundaries, and lived details that give the setting its shape.',
    starters: ['Where does daily life feel safest or most precarious?', 'Which boundary changes how people behave when they cross it?']
  },
  {
    kind: 'factions',
    label: 'Factions and institutions',
    prompt: 'Which groups hold influence, and what do they want from one another?',
    uncovers: 'Organized interests, competing agendas, and the structures that distribute influence.',
    starters: ['What does this group protect, control, or fear losing?', 'Where do public duties and private goals conflict?']
  },
  {
    kind: 'history',
    label: 'History and change',
    prompt: 'What past events still shape the choices people make now?',
    uncovers: 'The remembered, disputed, and forgotten past that still creates pressure in the present.',
    starters: ['Which event is remembered differently by different groups?', 'What old wound has never truly closed?']
  },
  {
    kind: 'power',
    label: 'Power and possibility',
    prompt: 'What can people do in this world, and who controls access to that power?',
    uncovers: 'Extraordinary possibilities and the social systems that grant, restrict, or exploit them.',
    starters: ['Who is allowed to use this power openly?', 'What changes when access to power is denied or stolen?']
  },
  {
    kind: 'customs',
    label: 'Customs and beliefs',
    prompt: 'What practices, stories, or beliefs make this culture recognizable?',
    uncovers: 'Shared rituals, assumptions, taboos, and disagreements that shape ordinary choices.',
    starters: ['What is considered sacred, shameful, or unclean—and by whom?', 'Which belief divides generations, regions, or species?']
  },
  {
    kind: 'constraints',
    label: 'Constraints and costs',
    prompt: 'What does this world make expensive, forbidden, or impossible?',
    uncovers: 'The limits and tradeoffs that keep the setting consequential instead of frictionless.',
    starters: ['What must someone give up to get what they want?', 'Which rule is hardest to live with or easiest to exploit?']
  }
] as const;

export const WORLD_CANVAS_LENS_NOTE_KINDS: Readonly<Record<WorldCanvasLensKind, LoreDocumentKind>> = {
  people: 'character_dossier',
  places: 'place_history',
  factions: 'faction_notes',
  history: 'timeline',
  power: 'general_lore',
  customs: 'myth',
  constraints: 'general_lore'
};

const getLensDefinition = (kind: WorldCanvasLensKind): WorldCanvasLensDefinition =>
  LENS_DEFINITIONS.find((definition) => definition.kind === kind) ?? {
    kind,
    label: kind,
    prompt: '',
    uncovers: '',
    starters: []
  };

const buildManualSourceNote = (params: {
  projectId: string;
  titleSource: string;
  content: string;
  kind: LoreDocumentKind;
}): LoreDocument => {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    projectId: params.projectId,
    title: deriveSourceNoteTitle(params.titleSource),
    kind: params.kind,
    format: 'plain_text',
    content: params.content,
    summary: summarizeContent(params.content),
    source: {type: 'manual'},
    status: 'active',
    createdAt: now,
    updatedAt: now
  };
};

export function buildSourceNoteFromLens(
  lens: WorldCanvasLens,
  canvas: WorldCanvasDocument
): LoreDocument {
  const note = lens.note.trim();
  if (!note) throw new Error('Write something in this lens before keeping it as a Source Note.');
  const definition = getLensDefinition(lens.kind);
  const content = `From World Canvas — ${definition.label}\n\n${note}`;
  return buildManualSourceNote({
    projectId: canvas.projectId,
    titleSource: note,
    content,
    kind: WORLD_CANVAS_LENS_NOTE_KINDS[lens.kind]
  });
}

export function buildSourceNoteFromQuestion(
  question: WorldCanvasQuestion,
  projectId: string
): LoreDocument {
  const text = question.text.trim();
  if (!text) throw new Error('Write the question before keeping it as a Source Note.');
  const lens = question.lensKind ? getLensDefinition(question.lensKind) : null;
  const provenance = lens
    ? `From World Canvas — Question (${lens.label})`
    : 'From World Canvas — Question';
  const content = `${provenance}\n\n${text}`;
  return buildManualSourceNote({
    projectId,
    titleSource: text,
    content,
    kind: question.lensKind
      ? WORLD_CANVAS_LENS_NOTE_KINDS[question.lensKind]
      : 'general_lore'
  });
}

/**
 * A brainstorm item the author chose to keep. The first line marks it as model-suggested so it is
 * never later mistaken for the author's own research.
 */
export function buildSourceNoteFromBrainstormItem(params: {
  projectId: string;
  lensKind?: WorldCanvasLensKind;
  kindLabel: string;
  text: string;
}): LoreDocument {
  const text = params.text.trim();
  if (!text) throw new Error('This brainstorm item is empty, so there is nothing to keep.');
  const focusLabel = params.lensKind ? getLensDefinition(params.lensKind).label : 'Core Idea';
  const content = `From World Canvas brainstorm — ${focusLabel} (${params.kindLabel})\n\n${text}`;
  return buildManualSourceNote({
    projectId: params.projectId,
    titleSource: text,
    content,
    kind: params.lensKind ? WORLD_CANVAS_LENS_NOTE_KINDS[params.lensKind] : 'general_lore'
  });
}

export interface ResolvedCanvasLink {
  id: string;
  label: string;
  missing: boolean;
}

export function resolveCanvasLinks<T extends {id: string}>(
  ids: string[],
  records: T[],
  getLabel: (record: T) => string
): ResolvedCanvasLink[] {
  const recordsById = new Map(records.map((record) => [record.id, record]));
  return ids.map((id) => {
    const record = recordsById.get(id);
    return record
      ? {id, label: getLabel(record), missing: false}
      : {id, label: 'no longer exists', missing: true};
  });
}

const LENS_CATEGORY_HINTS: Readonly<Record<WorldCanvasLensKind, readonly string[]>> = {
  people: ['character', 'person', 'people', 'npc'],
  places: ['location', 'place', 'region', 'zone'],
  factions: ['faction', 'guild', 'house', 'order', 'institution'],
  history: ['history', 'event', 'timeline'],
  power: ['power', 'magic', 'ability', 'system'],
  customs: ['custom', 'belief', 'religion', 'culture', 'myth'],
  constraints: ['constraint', 'law', 'rule', 'limit']
};

export function findSuggestedCanvasCategory(
  kind: WorldCanvasLensKind | undefined,
  categories: EntityCategory[]
): EntityCategory | null {
  if (categories.length === 0) return null;
  if (!kind) return categories[0];
  const hints = LENS_CATEGORY_HINTS[kind];
  return categories.find((category) => {
    const haystack = `${category.kind} ${category.slug} ${category.name}`.toLowerCase();
    return hints.some((hint) => haystack.includes(hint));
  }) ?? categories[0];
}

export function deriveCanvasCanonName(text: string): string {
  return deriveSourceNoteTitle(text).replace(/[?.!]+$/, '');
}

export function getCanvasEntityLabel(
  entity: WorldEntity,
  categories: EntityCategory[]
): string {
  const category = categories.find((candidate) => candidate.id === entity.categoryId);
  return category ? `${entity.name} · ${category.name}` : entity.name;
}

export function createEmptyWorldCanvas(projectId: string): WorldCanvasDocument {
  const now = Date.now();
  return {
    id: projectId,
    projectId,
    premise: '',
    lenses: [],
    questions: [],
    createdAt: now,
    updatedAt: now
  };
}

export function openLens(
  canvas: WorldCanvasDocument,
  kind: WorldCanvasLensKind
): WorldCanvasDocument {
  const existing = canvas.lenses.find((lens) => lens.kind === kind);
  if (existing && !existing.isCollapsed) return canvas;
  const now = Date.now();
  if (existing) {
    return {
      ...canvas,
      lenses: canvas.lenses.map((lens) =>
        lens.kind === kind ? {...lens, isCollapsed: false, updatedAt: now} : lens
      ),
      updatedAt: now
    };
  }
  return {
    ...canvas,
    lenses: [
      ...canvas.lenses,
      {kind, note: '', linkedSourceNoteIds: [], linkedEntityIds: [], isCollapsed: false, updatedAt: now}
    ],
    updatedAt: now
  };
}

export function collapseLens(
  canvas: WorldCanvasDocument,
  kind: WorldCanvasLensKind
): WorldCanvasDocument {
  const existing = canvas.lenses.find((lens) => lens.kind === kind);
  if (!existing || existing.isCollapsed) return canvas;
  const now = Date.now();
  return {
    ...canvas,
    lenses: canvas.lenses.map((lens) =>
      lens.kind === kind ? {...lens, isCollapsed: true, updatedAt: now} : lens
    ),
    updatedAt: now
  };
}

export function updateLensNote(
  canvas: WorldCanvasDocument,
  kind: WorldCanvasLensKind,
  note: string
): WorldCanvasDocument {
  const opened = openLens(canvas, kind);
  const now = Date.now();
  return {
    ...opened,
    lenses: opened.lenses.map((lens) =>
      lens.kind === kind ? {...lens, note, updatedAt: now} : lens
    ),
    updatedAt: now
  };
}

export function addQuestion(
  canvas: WorldCanvasDocument,
  text: string,
  lensKind?: WorldCanvasLensKind,
  origin?: WorldCanvasQuestion['origin']
): WorldCanvasDocument {
  const normalized = text.trim();
  if (!normalized) throw new Error('Enter a question before adding it.');
  const now = Date.now();
  const question: WorldCanvasQuestion = {
    id: crypto.randomUUID(),
    text: normalized,
    status: 'open',
    lensKind,
    ...(origin ? {origin} : {}),
    createdAt: now,
    updatedAt: now
  };
  return {
    ...canvas,
    questions: [...canvas.questions, question],
    updatedAt: now
  };
}

export function updateQuestion(
  canvas: WorldCanvasDocument,
  questionId: string,
  updates: Partial<Pick<WorldCanvasQuestion, 'text' | 'status' | 'lensKind'>>
): WorldCanvasDocument {
  if (!canvas.questions.some((question) => question.id === questionId)) return canvas;
  const now = Date.now();
  return {
    ...canvas,
    questions: canvas.questions.map((question) =>
      question.id === questionId
        ? {
            ...question,
            ...updates,
            text: updates.text === undefined ? question.text : updates.text.trim(),
            updatedAt: now
          }
        : question
    ),
    updatedAt: now
  };
}

export function linkLensSourceNote(
  canvas: WorldCanvasDocument,
  kind: WorldCanvasLensKind,
  sourceNoteId: string
): WorldCanvasDocument {
  const opened = openLens(canvas, kind);
  const now = Date.now();
  return {
    ...opened,
    lenses: opened.lenses.map((lens) => lens.kind === kind
      ? {...lens, linkedSourceNoteIds: [...new Set([...lens.linkedSourceNoteIds, sourceNoteId])], updatedAt: now}
      : lens),
    updatedAt: now
  };
}

export function linkLensEntity(
  canvas: WorldCanvasDocument,
  kind: WorldCanvasLensKind,
  entityId: string
): WorldCanvasDocument {
  const opened = openLens(canvas, kind);
  const now = Date.now();
  return {
    ...opened,
    lenses: opened.lenses.map((lens) => lens.kind === kind
      ? {...lens, linkedEntityIds: [...new Set([...lens.linkedEntityIds, entityId])], updatedAt: now}
      : lens),
    updatedAt: now
  };
}

export function unlinkLensTarget(
  canvas: WorldCanvasDocument,
  kind: WorldCanvasLensKind,
  target: 'source-note' | 'entity',
  targetId: string
): WorldCanvasDocument {
  const now = Date.now();
  return {
    ...canvas,
    lenses: canvas.lenses.map((lens) => lens.kind !== kind ? lens : {
      ...lens,
      linkedSourceNoteIds: target === 'source-note'
        ? lens.linkedSourceNoteIds.filter((id) => id !== targetId)
        : lens.linkedSourceNoteIds,
      linkedEntityIds: target === 'entity'
        ? lens.linkedEntityIds.filter((id) => id !== targetId)
        : lens.linkedEntityIds,
      updatedAt: now
    }),
    updatedAt: now
  };
}

export function linkQuestionSourceNote(
  canvas: WorldCanvasDocument,
  questionId: string,
  sourceNoteId?: string
): WorldCanvasDocument {
  const now = Date.now();
  return {
    ...canvas,
    questions: canvas.questions.map((question) => question.id === questionId
      ? {...question, linkedSourceNoteId: sourceNoteId, updatedAt: now}
      : question),
    updatedAt: now
  };
}

export function linkQuestionEntity(
  canvas: WorldCanvasDocument,
  questionId: string,
  entityId?: string
): WorldCanvasDocument {
  const now = Date.now();
  return {
    ...canvas,
    questions: canvas.questions.map((question) => question.id === questionId
      ? {...question, linkedEntityId: entityId, updatedAt: now}
      : question),
    updatedAt: now
  };
}
