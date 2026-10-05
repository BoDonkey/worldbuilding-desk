import type {
  ChapterCard,
  StateMutationCommand,
  StateMutationEvent,
  StoredRuleset,
  WritingDocument
} from '../../entityTypes';
import {sortWritingDocuments} from '../../writingStorage';

export type StateChangeCategory =
  | 'Attributes'
  | 'Resources'
  | 'Inventory'
  | 'Equipment'
  | 'Statuses'
  | 'Locations';

export interface SceneDashboardMetric {
  sceneId: string;
  title: string;
  order: number;
  wordCount: number;
  quotedWordCount: number;
  dialogueRatio: number;
  acceptedChangeCount: number;
}

export interface ChapterDashboardMetric {
  cardId: string;
  title: string;
  status: ChapterCard['status'];
  sourceSceneIds: string[];
  missingSceneIds: string[];
  wordCount: number;
  quotedWordCount: number;
  dialogueRatio: number;
  acceptedChangeCount: number;
}

export interface StateDistributionMetric {
  category: StateChangeCategory;
  commandCount: number;
  eventCount: number;
  sourceSceneIds: string[];
}

export interface MechanicsAxisMetric {
  axisId: string;
  label: string;
  kind: 'attribute' | 'resource';
  commandCount: number;
  sourceSceneIds: string[];
}

export interface MechanicsCoMovementMetric {
  sceneId: string;
  sceneTitle: string;
  axisLabels: string[];
}

export interface AdvancementIntervalMetric {
  axisId: string;
  axisLabel: string;
  fromSceneId: string;
  fromSceneTitle: string;
  toSceneId: string;
  toSceneTitle: string;
  sceneInterval: number;
  wordsBetween: number;
}

export interface StoryDashboard {
  sourceSceneIds: string[];
  scenes: SceneDashboardMetric[];
  chapters: ChapterDashboardMetric[];
  unlinkedCardCount: number;
  totalWords: number;
  totalQuotedWords: number;
  dialogueRatio: number;
  acceptedEventCount: number;
  acceptedCommandCount: number;
  missingEventSceneIds: string[];
  stateDistribution: StateDistributionMetric[];
  mechanics: null | {
    axes: MechanicsAxisMetric[];
    coMovements: MechanicsCoMovementMetric[];
    advancementIntervals: AdvancementIntervalMetric[];
    advancementChangeCount: number;
    advancementChangesPerTenThousandWords: number | null;
    advancementSourceSceneIds: string[];
  };
}

const STATE_CATEGORIES: StateChangeCategory[] = [
  'Attributes', 'Resources', 'Inventory', 'Equipment', 'Statuses', 'Locations'
];

/** Also reused by progressionContinuityCandidates.ts to identify advancement-axis commands. */
export const ADVANCEMENT_NAME = /\b(level|tier|rank|experience|xp|advancement|progress)\b/i;

export function buildStoryDashboard(params: {
  documents: WritingDocument[];
  events: StateMutationEvent[];
  cards: ChapterCard[];
  ruleset: StoredRuleset | null;
  mechanicsEnabled: boolean;
}): StoryDashboard {
  const documents = sortWritingDocuments(params.documents);
  const documentsById = new Map(documents.map((document) => [document.id, document]));
  const acceptedEvents = params.events.filter((event) => event.status === 'accepted');
  const knownEvents = acceptedEvents.filter((event) => documentsById.has(event.sceneId));
  const missingEventSceneIds = unique(
    acceptedEvents.filter((event) => !documentsById.has(event.sceneId)).map((event) => event.sceneId)
  );
  const eventsByScene = groupEventsByScene(knownEvents);
  const scenes = documents.map((document, order) => {
    const wordCount = countWords(document.content);
    const quotedWordCount = countQuotedWords(document.content);
    return {
      sceneId: document.id,
      title: document.title.trim() || 'Untitled scene',
      order,
      wordCount,
      quotedWordCount,
      dialogueRatio: ratio(quotedWordCount, wordCount),
      acceptedChangeCount: countCommands(eventsByScene.get(document.id) ?? [])
    };
  });
  const scenesById = new Map(scenes.map((scene) => [scene.sceneId, scene]));
  const totalWords = sum(scenes.map((scene) => scene.wordCount));
  const totalQuotedWords = sum(scenes.map((scene) => scene.quotedWordCount));
  const chapters = params.cards.flatMap((card) => {
    const linkedIds = unique(card.sceneIds ?? []);
    if (linkedIds.length === 0) return [];
    const linkedIdSet = new Set(linkedIds);
    const linkedScenes = scenes.filter((scene) => linkedIdSet.has(scene.sceneId));
    if (linkedScenes.length === 0) return [];
    const wordCount = sum(linkedScenes.map((scene) => scene.wordCount));
    const quotedWordCount = sum(linkedScenes.map((scene) => scene.quotedWordCount));
    return [{
      cardId: card.id,
      title: card.title.trim() || 'Untitled chapter',
      status: card.status,
      sourceSceneIds: linkedScenes.map((scene) => scene.sceneId),
      missingSceneIds: linkedIds.filter((sceneId) => !scenesById.has(sceneId)),
      wordCount,
      quotedWordCount,
      dialogueRatio: ratio(quotedWordCount, wordCount),
      acceptedChangeCount: sum(linkedScenes.map((scene) => scene.acceptedChangeCount))
    }];
  });
  const knownCommands = knownEvents.flatMap((event) =>
    event.commands.map((command) => ({event, command}))
  );
  const stateDistribution = STATE_CATEGORIES.flatMap((category) => {
    const matching = knownCommands.filter(({command}) => commandCategory(command) === category);
    if (matching.length === 0) return [];
    return [{
      category,
      commandCount: matching.length,
      eventCount: new Set(matching.map(({event}) => event.id)).size,
      sourceSceneIds: orderSceneIds(
        matching.map(({event}) => event.sceneId),
        scenes
      )
    }];
  });

  return {
    sourceSceneIds: scenes.map((scene) => scene.sceneId),
    scenes,
    chapters,
    unlinkedCardCount: params.cards.length - chapters.length,
    totalWords,
    totalQuotedWords,
    dialogueRatio: ratio(totalQuotedWords, totalWords),
    acceptedEventCount: knownEvents.length,
    acceptedCommandCount: countCommands(knownEvents),
    missingEventSceneIds,
    stateDistribution,
    mechanics: params.mechanicsEnabled && params.ruleset
      ? buildMechanicsMetrics({scenes, commands: knownCommands, ruleset: params.ruleset, totalWords})
      : null
  };
}

function buildMechanicsMetrics(params: {
  scenes: SceneDashboardMetric[];
  commands: Array<{event: StateMutationEvent; command: StateMutationCommand}>;
  ruleset: StoredRuleset;
  totalWords: number;
}): NonNullable<StoryDashboard['mechanics']> {
  const axisLabels = new Map<string, {label: string; kind: 'attribute' | 'resource'}>([
    ...params.ruleset.statDefinitions.filter((definition) => definition.type === 'number').map((definition) => [
      `stat:${definition.id}`,
      {label: definition.name, kind: 'attribute' as const}
    ] as const),
    ...params.ruleset.resourceDefinitions.map((definition) => [
      `resource:${definition.id}`,
      {label: definition.name, kind: 'resource' as const}
    ] as const)
  ]);
  const numericCommands = params.commands.flatMap(({event, command}) => {
    const axisId = numericAxisId(command);
    if (!axisId || !axisLabels.has(axisId)) return [];
    return [{event, command, axisId, axis: axisLabels.get(axisId)!}];
  });
  const byAxis = new Map<string, typeof numericCommands>();
  numericCommands.forEach((entry) => {
    const values = byAxis.get(entry.axisId) ?? [];
    values.push(entry);
    byAxis.set(entry.axisId, values);
  });
  const axes = Array.from(byAxis.entries())
    .map(([axisId, entries]) => ({
      axisId,
      label: entries[0]!.axis.label,
      kind: entries[0]!.axis.kind,
      commandCount: entries.length,
      sourceSceneIds: orderSceneIds(entries.map(({event}) => event.sceneId), params.scenes)
    }))
    .sort((left, right) => right.commandCount - left.commandCount || left.label.localeCompare(right.label));
  const coMovements = params.scenes.flatMap((scene) => {
    const labels = unique(
      numericCommands
        .filter(({event}) => event.sceneId === scene.sceneId)
        .map(({axis}) => axis.label)
    ).sort();
    return labels.length >= 2
      ? [{sceneId: scene.sceneId, sceneTitle: scene.title, axisLabels: labels}]
      : [];
  });
  const advancementCommands = numericCommands.filter(({command, axis}) =>
    ADVANCEMENT_NAME.test(axis.label) && isPositiveChange(command)
  );
  const advancementIntervals: AdvancementIntervalMetric[] = [];
  const sceneIndex = new Map(params.scenes.map((scene, index) => [scene.sceneId, index]));
  const advancementsByAxis = new Map<string, typeof advancementCommands>();
  advancementCommands.forEach((entry) => {
    const values = advancementsByAxis.get(entry.axisId) ?? [];
    values.push(entry);
    advancementsByAxis.set(entry.axisId, values);
  });
  advancementsByAxis.forEach((entries, axisId) => {
    const sceneIds = orderSceneIds(entries.map(({event}) => event.sceneId), params.scenes);
    for (let index = 1; index < sceneIds.length; index += 1) {
      const fromIndex = sceneIndex.get(sceneIds[index - 1]!)!;
      const toIndex = sceneIndex.get(sceneIds[index]!)!;
      advancementIntervals.push({
        axisId,
        axisLabel: entries[0]!.axis.label,
        fromSceneId: sceneIds[index - 1]!,
        fromSceneTitle: params.scenes[fromIndex]!.title,
        toSceneId: sceneIds[index]!,
        toSceneTitle: params.scenes[toIndex]!.title,
        sceneInterval: toIndex - fromIndex,
        wordsBetween: sum(params.scenes.slice(fromIndex + 1, toIndex).map((scene) => scene.wordCount))
      });
    }
  });
  const advancementSourceSceneIds = orderSceneIds(
    advancementCommands.map(({event}) => event.sceneId),
    params.scenes
  );

  return {
    axes,
    coMovements,
    advancementIntervals,
    advancementChangeCount: advancementCommands.length,
    advancementChangesPerTenThousandWords: params.totalWords > 0
      ? advancementCommands.length / params.totalWords * 10_000
      : null,
    advancementSourceSceneIds
  };
}

/** What counts as one manuscript word: letters/digits, joined by apostrophes or hyphens. */
export const MANUSCRIPT_WORD_PATTERN = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

export function countWords(content: string): number {
  const text = normalizeManuscriptText(content);
  return text.match(MANUSCRIPT_WORD_PATTERN)?.length ?? 0;
}

export function countQuotedWords(content: string): number {
  const text = normalizeManuscriptText(content);
  const quoted = Array.from(text.matchAll(/["“]([^"”]+)["”]/gu))
    .map((match) => match[1] ?? '')
    .join(' ');
  return countWords(quoted);
}

function normalizeManuscriptText(content: string): string {
  return content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&(?:quot|ldquo|rdquo);/g, '"');
}

function commandCategory(command: StateMutationCommand): StateChangeCategory {
  if (command.type.startsWith('stat_')) return 'Attributes';
  if (command.type.startsWith('resource_')) return 'Resources';
  if (command.type === 'inventory_equip' || command.type === 'inventory_unequip') return 'Equipment';
  if (command.type.startsWith('inventory_')) return 'Inventory';
  if (command.type.startsWith('status_')) return 'Statuses';
  return 'Locations';
}

function numericAxisId(command: StateMutationCommand): string | null {
  if (command.type === 'stat_change' || command.type === 'stat_set') {
    return `stat:${command.statDefinitionId}`;
  }
  if (command.type === 'resource_change' || command.type === 'resource_set') {
    return `resource:${command.resourceDefinitionId}`;
  }
  return null;
}

function isPositiveChange(command: StateMutationCommand): boolean {
  return (command.type === 'stat_change' || command.type === 'resource_change') &&
    typeof command.delta === 'number' && command.delta > 0;
}

function groupEventsByScene(events: StateMutationEvent[]): Map<string, StateMutationEvent[]> {
  const grouped = new Map<string, StateMutationEvent[]>();
  events.forEach((event) => grouped.set(event.sceneId, [...(grouped.get(event.sceneId) ?? []), event]));
  return grouped;
}

function countCommands(events: StateMutationEvent[]): number {
  return sum(events.map((event) => event.commands.length));
}

function orderSceneIds(ids: string[], scenes: SceneDashboardMetric[]): string[] {
  const included = new Set(ids);
  return scenes.filter((scene) => included.has(scene.sceneId)).map((scene) => scene.sceneId);
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function ratio(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}
