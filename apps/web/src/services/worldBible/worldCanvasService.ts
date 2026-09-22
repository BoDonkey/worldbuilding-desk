import type {
  EntityCategory, LoreDocument, LoreDocumentKind, WorldCanvasDocument, WorldCanvasLens,
  WorldCanvasLensKind, WorldCanvasOpenThread, WorldCanvasSketch, WorldEntity
} from '../../entityTypes';
import {deriveSourceNoteTitle, summarizeContent} from '../lore/sourceNoteCapture';

export interface WorldCanvasLensDefinition { kind: WorldCanvasLensKind; label: string; prompt: string; uncovers: string; starters: readonly string[] }
export const LENS_DEFINITIONS: readonly WorldCanvasLensDefinition[] = [
  {kind: 'people', label: 'Inhabitants and societies', prompt: 'Who shapes daily life here, and whose perspective has not been heard yet?', uncovers: 'The groups, relationships, hierarchies, and points of view that make the world feel inhabited.', starters: ['Who belongs here—and who is treated as an outsider?', 'Which species, communities, or social groups hold power over others?']},
  {kind: 'places', label: 'Places', prompt: 'Which places define this world, and what makes each one feel distinct?', uncovers: 'The environments, boundaries, and lived details that give the setting its shape.', starters: ['Where does daily life feel safest or most precarious?', 'Which boundary changes how people behave when they cross it?']},
  {kind: 'factions', label: 'Factions and institutions', prompt: 'Which groups hold influence, and what do they want from one another?', uncovers: 'Organized interests, competing agendas, and the structures that distribute influence.', starters: ['What does this group protect, control, or fear losing?', 'Where do public duties and private goals conflict?']},
  {kind: 'history', label: 'History and change', prompt: 'What past events still shape the choices people make now?', uncovers: 'The remembered, disputed, and forgotten past that still creates pressure in the present.', starters: ['Which event is remembered differently by different groups?', 'What old wound has never truly closed?']},
  {kind: 'power', label: 'Power and possibility', prompt: 'What can people do in this world, and who controls access to that power?', uncovers: 'Extraordinary possibilities and the social systems that grant, restrict, or exploit them.', starters: ['Who is allowed to use this power openly?', 'What changes when access to power is denied or stolen?']},
  {kind: 'customs', label: 'Customs and beliefs', prompt: 'What practices, stories, or beliefs make this culture recognizable?', uncovers: 'Shared rituals, assumptions, taboos, and disagreements that shape ordinary choices.', starters: ['What is considered sacred, shameful, or unclean—and by whom?', 'Which belief divides generations, regions, or species?']},
  {kind: 'constraints', label: 'Constraints and costs', prompt: 'What does this world make expensive, forbidden, or impossible?', uncovers: 'The limits and tradeoffs that keep the setting consequential instead of frictionless.', starters: ['What must someone give up to get what they want?', 'Which rule is hardest to live with or easiest to exploit?']}
] as const;

export const WORLD_CANVAS_LENS_NOTE_KINDS: Readonly<Record<WorldCanvasLensKind, LoreDocumentKind>> = {
  people: 'character_dossier', places: 'place_history', factions: 'faction_notes', history: 'timeline',
  power: 'general_lore', customs: 'myth', constraints: 'general_lore'
};
const definitionFor = (kind: WorldCanvasLensKind) => LENS_DEFINITIONS.find((item) => item.kind === kind) ?? {kind, label: kind, prompt: '', uncovers: '', starters: []};
const uuid = () => crypto.randomUUID();
const emptySketch = (now = Date.now()): WorldCanvasSketch => ({id: uuid(), text: '', linkedSourceNoteIds: [], linkedEntityIds: [], linkedOpenThreadIds: [], createdAt: now, updatedAt: now});

type LegacyQuestion = Omit<WorldCanvasOpenThread, 'status'> & {status: 'open' | 'answered' | 'dropped'};
type LegacyLens = {kind: WorldCanvasLensKind; note?: string; linkedSourceNoteIds?: string[]; linkedEntityIds?: string[]; sketches?: WorldCanvasSketch[]; activeSketchId?: string; isCollapsed?: boolean; updatedAt: number};
type LegacyCanvas = Omit<WorldCanvasDocument, 'schemaVersion' | 'lenses' | 'openThreads'> & {schemaVersion?: number; lenses?: LegacyLens[]; questions?: LegacyQuestion[]; openThreads?: WorldCanvasOpenThread[]};

/** Lossless, deterministic Canvas v1 -> v2 migration used for live records and backups. */
export function migrateWorldCanvasDocument(value: unknown): WorldCanvasDocument {
  const legacy = value as LegacyCanvas;
  const createdAt = typeof legacy.createdAt === 'number' ? legacy.createdAt : Date.now();
  const updatedAt = typeof legacy.updatedAt === 'number' ? legacy.updatedAt : createdAt;
  const lenses: WorldCanvasLens[] = (legacy.lenses ?? []).map((raw) => {
    if (Array.isArray(raw.sketches)) {
      const sketches = raw.sketches.map((sketch) => ({...sketch, linkedSourceNoteIds: [...(sketch.linkedSourceNoteIds ?? [])], linkedEntityIds: [...(sketch.linkedEntityIds ?? [])], linkedOpenThreadIds: [...(sketch.linkedOpenThreadIds ?? [])]}));
      const first = sketches[0] ?? emptySketch(raw.updatedAt ?? updatedAt);
      return {kind: raw.kind, sketches: sketches.length ? sketches : [first], activeSketchId: sketches.some((item) => item.id === raw.activeSketchId) ? raw.activeSketchId! : first.id, isCollapsed: raw.isCollapsed, updatedAt: raw.updatedAt ?? updatedAt};
    }
    const at = raw.updatedAt ?? updatedAt;
    const sketch: WorldCanvasSketch = {id: `legacy-${legacy.id}-${raw.kind}`, text: raw.note ?? '', linkedSourceNoteIds: [...(raw.linkedSourceNoteIds ?? [])], linkedEntityIds: [...(raw.linkedEntityIds ?? [])], linkedOpenThreadIds: [], createdAt: at, updatedAt: at};
    return {kind: raw.kind, sketches: [sketch], activeSketchId: sketch.id, isCollapsed: raw.isCollapsed, updatedAt: at};
  });
  const openThreads = legacy.openThreads ?? (legacy.questions ?? []).map((item) => ({...item, status: item.status === 'answered' ? 'settled' as const : item.status === 'dropped' ? 'set_aside' as const : 'open' as const}));
  return {schemaVersion: 2, id: legacy.id, projectId: legacy.projectId, premise: legacy.premise ?? '', ...(legacy.coreIdeaSourceNoteId ? {coreIdeaSourceNoteId: legacy.coreIdeaSourceNoteId} : {}), ...(legacy.coreIdeaEntityId ? {coreIdeaEntityId: legacy.coreIdeaEntityId} : {}), lenses, openThreads, createdAt, updatedAt};
}

const buildManualSourceNote = (params: {projectId: string; titleSource: string; content: string; kind: LoreDocumentKind}): LoreDocument => {
  const now = Date.now();
  return {id: uuid(), projectId: params.projectId, title: deriveSourceNoteTitle(params.titleSource), kind: params.kind, format: 'plain_text', content: params.content, summary: summarizeContent(params.content), source: {type: 'manual'}, status: 'active', createdAt: now, updatedAt: now};
};
export function buildSourceNoteFromSketch(sketch: WorldCanvasSketch, kind: WorldCanvasLensKind, canvas: WorldCanvasDocument): LoreDocument {
  const text = sketch.text.trim();
  if (!text) throw new Error('Write something in this sketch before developing it as a Source Note.');
  return buildManualSourceNote({projectId: canvas.projectId, titleSource: text, content: `From World Canvas — ${definitionFor(kind).label}\n\n${text}`, kind: WORLD_CANVAS_LENS_NOTE_KINDS[kind]});
}
export function buildSourceNoteFromCoreIdea(canvas: WorldCanvasDocument): LoreDocument {
  const text = canvas.premise.trim();
  if (!text) throw new Error('Write a Core Idea before keeping it as a Source Note.');
  return buildManualSourceNote({projectId: canvas.projectId, titleSource: text, content: `From World Canvas — Core Idea\n\n${text}`, kind: 'general_lore'});
}
export function buildSourceNoteFromOpenThread(thread: WorldCanvasOpenThread, projectId: string): LoreDocument {
  const text = thread.text.trim();
  if (!text) throw new Error('Write the open thread before keeping it as a Source Note.');
  const lens = thread.lensKind ? definitionFor(thread.lensKind) : null;
  return buildManualSourceNote({projectId, titleSource: text, content: `${lens ? `From World Canvas — Open Thread (${lens.label})` : 'From World Canvas — Open Thread'}\n\n${text}`, kind: thread.lensKind ? WORLD_CANVAS_LENS_NOTE_KINDS[thread.lensKind] : 'general_lore'});
}
export function buildSourceNoteFromBrainstormItem(params: {projectId: string; lensKind?: WorldCanvasLensKind; kindLabel: string; text: string}): LoreDocument {
  const text = params.text.trim();
  if (!text) throw new Error('This brainstorm item is empty, so there is nothing to keep.');
  const focus = params.lensKind ? definitionFor(params.lensKind).label : 'Core Idea';
  return buildManualSourceNote({projectId: params.projectId, titleSource: text, content: `From World Canvas brainstorm — ${focus} (${params.kindLabel})\n\n${text}`, kind: params.lensKind ? WORLD_CANVAS_LENS_NOTE_KINDS[params.lensKind] : 'general_lore'});
}

export interface ResolvedCanvasLink {id: string; label: string; missing: boolean}
export function resolveCanvasLinks<T extends {id: string}>(ids: string[], records: T[], getLabel: (record: T) => string): ResolvedCanvasLink[] {
  const byId = new Map(records.map((record) => [record.id, record]));
  return ids.map((id) => byId.has(id) ? {id, label: getLabel(byId.get(id)!), missing: false} : {id, label: 'no longer exists', missing: true});
}
const LENS_CATEGORY_HINTS: Readonly<Record<WorldCanvasLensKind, readonly string[]>> = {people: ['character', 'person', 'people', 'npc'], places: ['location', 'place', 'region', 'zone'], factions: ['faction', 'guild', 'house', 'order', 'institution'], history: ['history', 'event', 'timeline'], power: ['power', 'magic', 'ability', 'system'], customs: ['custom', 'belief', 'religion', 'culture', 'myth'], constraints: ['constraint', 'law', 'rule', 'limit']};
const CORE_CATEGORY_HINTS = ['concept', 'setting', 'world', 'location', 'place'];
export function findSuggestedCanvasCategory(kind: WorldCanvasLensKind | undefined, categories: EntityCategory[]): EntityCategory | null {
  if (!categories.length) return null;
  const hints = kind ? LENS_CATEGORY_HINTS[kind] : CORE_CATEGORY_HINTS;
  return categories.find((category) => hints.some((hint) => `${category.kind} ${category.slug} ${category.name}`.toLowerCase().includes(hint))) ?? categories[0];
}
export const deriveCanvasCanonName = (text: string) => deriveSourceNoteTitle(text).replace(/[?.!]+$/, '');
export function getCanvasEntityLabel(entity: WorldEntity, categories: EntityCategory[]): string {const category = categories.find((item) => item.id === entity.categoryId); return category ? `${entity.name} · ${category.name}` : entity.name;}

export function createEmptyWorldCanvas(projectId: string): WorldCanvasDocument {const now = Date.now(); return {schemaVersion: 2, id: projectId, projectId, premise: '', lenses: [], openThreads: [], createdAt: now, updatedAt: now};}
export function getActiveSketch(lens: WorldCanvasLens): WorldCanvasSketch {return lens.sketches.find((item) => item.id === lens.activeSketchId) ?? lens.sketches[0];}
export function openLens(canvas: WorldCanvasDocument, kind: WorldCanvasLensKind): WorldCanvasDocument {
  const existing = canvas.lenses.find((item) => item.kind === kind); if (existing && !existing.isCollapsed) return canvas; const now = Date.now();
  if (existing) return {...canvas, lenses: canvas.lenses.map((item) => item.kind === kind ? {...item, isCollapsed: false, updatedAt: now} : item), updatedAt: now};
  const sketch = emptySketch(now); return {...canvas, lenses: [...canvas.lenses, {kind, sketches: [sketch], activeSketchId: sketch.id, isCollapsed: false, updatedAt: now}], updatedAt: now};
}
export function collapseLens(canvas: WorldCanvasDocument, kind: WorldCanvasLensKind): WorldCanvasDocument {const now = Date.now(); if (!canvas.lenses.some((item) => item.kind === kind && !item.isCollapsed)) return canvas; return {...canvas, lenses: canvas.lenses.map((item) => item.kind === kind ? {...item, isCollapsed: true, updatedAt: now} : item), updatedAt: now};}
export function updateSketchText(canvas: WorldCanvasDocument, kind: WorldCanvasLensKind, sketchId: string, text: string): WorldCanvasDocument {const now = Date.now(); return {...canvas, lenses: canvas.lenses.map((lens) => lens.kind !== kind ? lens : {...lens, sketches: lens.sketches.map((sketch) => sketch.id === sketchId ? {...sketch, text, updatedAt: now} : sketch), updatedAt: now}), updatedAt: now};}
export function selectSketch(canvas: WorldCanvasDocument, kind: WorldCanvasLensKind, sketchId: string): WorldCanvasDocument {const lens = canvas.lenses.find((item) => item.kind === kind); if (!lens?.sketches.some((item) => item.id === sketchId) || lens.activeSketchId === sketchId) return canvas; const now = Date.now(); return {...canvas, lenses: canvas.lenses.map((item) => item.kind === kind ? {...item, activeSketchId: sketchId, updatedAt: now} : item), updatedAt: now};}
export function addAnotherSketch(canvas: WorldCanvasDocument, kind: WorldCanvasLensKind): WorldCanvasDocument {const lens = canvas.lenses.find((item) => item.kind === kind); if (!lens) return canvas; const active = getActiveSketch(lens); if (!(active.linkedSourceNoteIds.length || active.linkedEntityIds.length || active.linkedOpenThreadIds.length)) throw new Error('Route this sketch before starting another.'); const now = Date.now(); const sketch = emptySketch(now); return {...canvas, lenses: canvas.lenses.map((item) => item.kind === kind ? {...item, sketches: [...item.sketches, sketch], activeSketchId: sketch.id, updatedAt: now} : item), updatedAt: now};}

export function addOpenThread(canvas: WorldCanvasDocument, text: string, lensKind?: WorldCanvasLensKind, origin?: WorldCanvasOpenThread['origin']): WorldCanvasDocument {const normalized = text.trim(); if (!normalized) throw new Error('Enter an open thread before adding it.'); const now = Date.now(); const thread: WorldCanvasOpenThread = {id: uuid(), text: normalized, status: 'open', lensKind, ...(origin ? {origin} : {}), createdAt: now, updatedAt: now}; return {...canvas, openThreads: [...canvas.openThreads, thread], updatedAt: now};}
export function updateOpenThread(canvas: WorldCanvasDocument, id: string, updates: Partial<Pick<WorldCanvasOpenThread, 'text' | 'status' | 'lensKind'>>): WorldCanvasDocument {if (!canvas.openThreads.some((item) => item.id === id)) return canvas; const now = Date.now(); return {...canvas, openThreads: canvas.openThreads.map((item) => item.id === id ? {...item, ...updates, text: updates.text === undefined ? item.text : updates.text.trim(), updatedAt: now} : item), updatedAt: now};}
function updateSketchLinks(canvas: WorldCanvasDocument, kind: WorldCanvasLensKind, sketchId: string, update: (sketch: WorldCanvasSketch) => WorldCanvasSketch): WorldCanvasDocument {const now = Date.now(); return {...canvas, lenses: canvas.lenses.map((lens) => lens.kind !== kind ? lens : {...lens, sketches: lens.sketches.map((sketch) => sketch.id === sketchId ? {...update(sketch), updatedAt: now} : sketch), updatedAt: now}), updatedAt: now};}
export const linkSketchSourceNote = (canvas: WorldCanvasDocument, kind: WorldCanvasLensKind, sketchId: string, id: string) => updateSketchLinks(canvas, kind, sketchId, (sketch) => ({...sketch, linkedSourceNoteIds: [...new Set([...sketch.linkedSourceNoteIds, id])]}));
export const linkSketchEntity = (canvas: WorldCanvasDocument, kind: WorldCanvasLensKind, sketchId: string, id: string) => updateSketchLinks(canvas, kind, sketchId, (sketch) => ({...sketch, linkedEntityIds: [...new Set([...sketch.linkedEntityIds, id])]}));
export const linkSketchOpenThread = (canvas: WorldCanvasDocument, kind: WorldCanvasLensKind, sketchId: string, id: string) => updateSketchLinks(canvas, kind, sketchId, (sketch) => ({...sketch, linkedOpenThreadIds: [...new Set([...sketch.linkedOpenThreadIds, id])]}));
export function unlinkSketchTarget(canvas: WorldCanvasDocument, kind: WorldCanvasLensKind, sketchId: string, target: 'source-note' | 'entity', id: string): WorldCanvasDocument {return updateSketchLinks(canvas, kind, sketchId, (sketch) => ({...sketch, linkedSourceNoteIds: target === 'source-note' ? sketch.linkedSourceNoteIds.filter((value) => value !== id) : sketch.linkedSourceNoteIds, linkedEntityIds: target === 'entity' ? sketch.linkedEntityIds.filter((value) => value !== id) : sketch.linkedEntityIds}));}
export function linkOpenThreadSourceNote(canvas: WorldCanvasDocument, id: string, sourceNoteId?: string): WorldCanvasDocument {const now = Date.now(); return {...canvas, openThreads: canvas.openThreads.map((item) => item.id === id ? {...item, linkedSourceNoteId: sourceNoteId, updatedAt: now} : item), updatedAt: now};}
export function linkOpenThreadEntity(canvas: WorldCanvasDocument, id: string, entityId?: string): WorldCanvasDocument {const now = Date.now(); return {...canvas, openThreads: canvas.openThreads.map((item) => item.id === id ? {...item, linkedEntityId: entityId, updatedAt: now} : item), updatedAt: now};}
export function linkCoreIdeaSourceNote(canvas: WorldCanvasDocument, id?: string): WorldCanvasDocument {const now = Date.now(); return {...canvas, coreIdeaSourceNoteId: id, updatedAt: now};}
export function linkCoreIdeaEntity(canvas: WorldCanvasDocument, id?: string): WorldCanvasDocument {const now = Date.now(); return {...canvas, coreIdeaEntityId: id, updatedAt: now};}
export function routeSketchToOpenThread(canvas: WorldCanvasDocument, kind: WorldCanvasLensKind, sketchId: string): WorldCanvasDocument {const lens = canvas.lenses.find((item) => item.kind === kind); const sketch = lens?.sketches.find((item) => item.id === sketchId); if (!sketch?.text.trim()) throw new Error('Write something in this sketch before keeping it as an Open Thread.'); const next = addOpenThread(canvas, sketch.text, kind); return linkSketchOpenThread(next, kind, sketchId, next.openThreads.at(-1)!.id);}

export const addQuestion = addOpenThread;
export const updateQuestion = updateOpenThread;
