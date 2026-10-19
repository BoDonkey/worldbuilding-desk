import type {CompendiumEntry, EntityCategory, Project, StateMutationEvent, WritingDocument} from '../../entityTypes';
import {CONTINUITY_CORPUS} from '../../fixtures/continuityCorpus';
import {captureStateMutationAnchor, textSnapshotFromPlainText} from '../state/stateMutationAnchor';
import {hashSceneContent, type PendingInventoryCapture} from './sceneRosterMutationTypes';
import type {SceneRosterCharacterCard} from './sceneRosterTypes';

// Exercise the same Sera/Pale Draught baseline as the trust-dogfood continuity corpus.
export const corpus = CONTINUITY_CORPUS.find((entry) => entry.id === 'state-pale-draught-baseline-consumption')!;
export const sheet = structuredClone(corpus.state!.characterSheets[0]);
export const scene: WritingDocument = {
  ...corpus.scenes[0], projectId: 'corpus', content: corpus.scenes[0].text,
  order: 0, createdAt: 1, updatedAt: 2
};
export const snapshot = textSnapshotFromPlainText(scene.content);
export const position = 20;
export const anchor = captureStateMutationAnchor(snapshot, position);
export const character: SceneRosterCharacterCard = {
  key: 'character:sera', id: 'sera', sheetId: sheet.id, name: sheet.name, role: '',
  source: 'scene', stats: [], resources: [], inventory: [], statuses: [], hasSheet: true
};
export const definition: CompendiumEntry = {
  id: 'draught-definition', projectId: 'corpus', name: 'Pale Draught', domain: 'artifact',
  actions: [], tags: ['healing'], createdAt: 1, updatedAt: 1,
  consumable: {durationLabel: 'one scene', statusName: 'Fortified', effects: [{type: 'stat_change', definitionId: 'strength', delta: 3}]}
};
export const category: EntityCategory = {
  id: 'items', projectId: 'corpus', name: 'Items', kind: 'general', slug: 'items', fieldSchema: [], createdAt: 1
};
export const event: StateMutationEvent = {
  id: 'consume', projectId: 'corpus', sceneId: scene.id, sceneTitle: scene.title,
  sceneOrder: 1, sceneSequence: 4, scenePosition: position, sceneAnchor: anchor,
  sourceType: 'manual', sourceRevision: 2, sourceHash: hashSceneContent(scene.content),
  status: 'accepted', commands: [{type: 'inventory_consume', actorId: sheet.id, itemName: 'Pale Draught', quantity: 1}],
  consumableEffect: {definitionId: definition.id, itemName: definition.name, phase: 'consume'}, createdAt: 3
};
export const capture: PendingInventoryCapture = {
  sceneId: scene.id, sourceHash: hashSceneContent(scene.content), itemName: definition.name,
  evidenceText: scene.content, action: 'acquire', position, anchor
};
export const captureContext = {
  activeProject: {id: 'corpus'} as Project, selectedDocument: scene,
  pendingInventoryCapture: capture, content: scene.content, characterSheets: [sheet],
  documents: [scene], categories: [category], entities: [], compendiumEntries: [],
  stateMutationEvents: [event], now: 100,
  ids: {entity: 'new-world-item', definition: 'new-definition', event: 'new-event'}
};
export const pickupInput = {sheetId: sheet.id, itemName: definition.name, quantity: 2, saveReusable: false, canonicalName: ''};
export const timelineContext = {
  characterSheets: [sheet], compendiumEntries: [definition], content: scene.content,
  sceneCursorAnchor: anchor, characters: [character], selectedDocument: scene, stateMutationEvents: [event]
};
