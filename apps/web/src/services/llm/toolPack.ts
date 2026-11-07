import type {
  ProjectAISettings,
  ProjectMode,
  PromptTool,
  SelectionAction
} from '../../entityTypes';
import {readSelectionActions} from '../assistant/selectionActions';

/**
 * Tool pack files: an author's prompt tools and AI actions as one JSON file. Version 2 added
 * `actions` (Slice 5.19); version 1 packs, which carry prompt tools only, still import.
 */
export const TOOL_PACK_SCHEMA_VERSION = 2;

export interface ToolPack {
  schemaVersion: 1 | 2;
  tools: PromptTool[];
  defaultToolIdsByMode?: Record<ProjectMode, string[]>;
  actions?: SelectionAction[];
}

export interface ParsedToolPack {
  tools: PromptTool[];
  /** Old tool id → the new id the import gave it, for the mode defaults. */
  idMap: Map<string, string>;
  defaultToolIdsByMode?: Record<ProjectMode, string[]>;
  /** Null for a version 1 pack, which has no actions: importing it leaves actions alone. */
  actions: SelectionAction[] | null;
}

export type ToolPackSettings = Pick<
  ProjectAISettings,
  'promptTools' | 'defaultToolIds' | 'defaultToolIdsByMode' | 'selectionActions'
>;

const modeDefaultsOf = (settings: ToolPackSettings): Record<ProjectMode, string[]> =>
  settings.defaultToolIdsByMode ?? {
    litrpg: [...(settings.defaultToolIds ?? [])],
    game: [...(settings.defaultToolIds ?? [])],
    general: [...(settings.defaultToolIds ?? [])]
  };

export function buildToolPack(settings: ToolPackSettings): ToolPack {
  return {
    schemaVersion: TOOL_PACK_SCHEMA_VERSION,
    tools: settings.promptTools ?? [],
    defaultToolIdsByMode: modeDefaultsOf(settings),
    actions: readSelectionActions(settings)
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function parseAction(value: unknown): SelectionAction | null {
  if (!isRecord(value)) return null;
  const {name, instructions, output} = value;
  if (typeof name !== 'string' || !name.trim() || typeof instructions !== 'string' || !instructions.trim()) {
    return null;
  }
  if (output !== 'replace' && output !== 'note') return null;
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    instructions: instructions.trim(),
    includeScene: value.includeScene === true,
    includeWorldBible: value.includeWorldBible === true,
    output,
    enabled: value.enabled === true,
    ...(typeof value.presetId === 'string' ? {presetId: value.presetId} : {})
  };
}

/** Reads a pack file's text. Throws with an author-facing message when it is not a usable pack. */
export function parseToolPack(raw: string): ParsedToolPack {
  const parsed = JSON.parse(raw) as Partial<ToolPack>;
  const version = parsed?.schemaVersion;
  if ((version !== 1 && version !== 2) || !Array.isArray(parsed.tools)) {
    throw new Error('Invalid tool pack format.');
  }
  const idMap = new Map<string, string>();
  const tools = parsed.tools
    .filter((tool) => tool && typeof tool.name === 'string' && typeof tool.content === 'string')
    .map((tool) => {
      const nextId = crypto.randomUUID();
      if (typeof tool.id === 'string') idMap.set(tool.id, nextId);
      return {id: nextId, name: tool.name, content: tool.content, enabled: tool.enabled !== false};
    });
  const actions =
    version === 2 && Array.isArray(parsed.actions)
      ? parsed.actions.map(parseAction).filter((action): action is SelectionAction => action !== null)
      : null;
  if (tools.length === 0 && (actions?.length ?? 0) === 0) {
    throw new Error(version === 1 ? 'No valid tools found in pack.' : 'No valid tools or actions found in pack.');
  }
  return {tools, idMap, defaultToolIdsByMode: parsed.defaultToolIdsByMode, actions};
}

export interface ToolPackMergeContext {
  /** The mode whose defaults Settings is showing. */
  defaultsMode: ProjectMode;
  projectMode: ProjectMode;
}

/** Settings updates that replace the project's tools (and, for a version 2 pack, its actions). */
export function replaceWithToolPack(
  settings: ToolPackSettings,
  pack: ParsedToolPack,
  context: ToolPackMergeContext
): Partial<ProjectAISettings> {
  const enabledImportedIds = pack.tools.filter((tool) => tool.enabled).map((tool) => tool.id);
  const importedDefaultsByMode = pack.defaultToolIdsByMode ?? {
    litrpg: enabledImportedIds,
    game: enabledImportedIds,
    general: enabledImportedIds
  };
  const validImportedIds = new Set(enabledImportedIds);
  const remap = (ids: string[] | undefined): string[] => {
    const remapped = (ids ?? [])
      .map((id) => pack.idMap.get(id) ?? id)
      .filter((id) => validImportedIds.has(id));
    return remapped.length > 0 ? remapped : enabledImportedIds;
  };
  return {
    promptTools: pack.tools,
    defaultToolIds:
      context.defaultsMode === context.projectMode ? enabledImportedIds : settings.defaultToolIds ?? [],
    defaultToolIdsByMode: {
      litrpg: remap(importedDefaultsByMode.litrpg),
      game: remap(importedDefaultsByMode.game),
      general: remap(importedDefaultsByMode.general)
    },
    ...(pack.actions ? {selectionActions: pack.actions} : {})
  };
}

/** Settings updates that add the pack's tools and actions alongside the project's own. */
export function appendToolPack(
  settings: ToolPackSettings,
  pack: ParsedToolPack,
  context: ToolPackMergeContext
): Partial<ProjectAISettings> {
  const modeDefaults = modeDefaultsOf(settings);
  const enabledImportedIds = pack.tools.filter((tool) => tool.enabled).map((tool) => tool.id);
  return {
    promptTools: [...(settings.promptTools ?? []), ...pack.tools],
    defaultToolIds: [...new Set([...(settings.defaultToolIds ?? []), ...enabledImportedIds])],
    defaultToolIdsByMode: {
      ...modeDefaults,
      [context.defaultsMode]: [
        ...new Set([...(modeDefaults[context.defaultsMode] ?? []), ...enabledImportedIds])
      ]
    },
    ...(pack.actions && pack.actions.length > 0
      ? {selectionActions: [...readSelectionActions(settings), ...pack.actions]}
      : {})
  };
}
