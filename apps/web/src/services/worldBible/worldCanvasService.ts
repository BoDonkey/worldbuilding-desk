import type {
  WorldCanvasDocument,
  WorldCanvasLensKind,
  WorldCanvasQuestion
} from '../../entityTypes';

export interface WorldCanvasLensDefinition {
  kind: WorldCanvasLensKind;
  label: string;
  prompt: string;
}

export const LENS_DEFINITIONS: readonly WorldCanvasLensDefinition[] = [
  {
    kind: 'people',
    label: 'People',
    prompt: 'Who shapes daily life here, and whose perspective has not been heard yet?'
  },
  {
    kind: 'places',
    label: 'Places',
    prompt: 'Which places define this world, and what makes each one feel distinct?'
  },
  {
    kind: 'factions',
    label: 'Factions and institutions',
    prompt: 'Which groups hold influence, and what do they want from one another?'
  },
  {
    kind: 'history',
    label: 'History and change',
    prompt: 'What past events still shape the choices people make now?'
  },
  {
    kind: 'power',
    label: 'Power and possibility',
    prompt: 'What can people do in this world, and who controls access to that power?'
  },
  {
    kind: 'customs',
    label: 'Customs and beliefs',
    prompt: 'What practices, stories, or beliefs make this culture recognizable?'
  },
  {
    kind: 'constraints',
    label: 'Constraints and costs',
    prompt: 'What does this world make expensive, forbidden, or impossible?'
  }
] as const;

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
  if (canvas.lenses.some((lens) => lens.kind === kind)) return canvas;
  const now = Date.now();
  return {
    ...canvas,
    lenses: [
      ...canvas.lenses,
      {kind, note: '', linkedSourceNoteIds: [], linkedEntityIds: [], updatedAt: now}
    ],
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
  lensKind?: WorldCanvasLensKind
): WorldCanvasDocument {
  const normalized = text.trim();
  if (!normalized) throw new Error('Enter a question before adding it.');
  const now = Date.now();
  const question: WorldCanvasQuestion = {
    id: crypto.randomUUID(),
    text: normalized,
    status: 'open',
    lensKind,
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
