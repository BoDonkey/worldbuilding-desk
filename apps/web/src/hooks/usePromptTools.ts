import {useEffect, useState} from 'react';
import type {ProjectAISettings, ProjectMode, PromptTool} from '../entityTypes';
import type {InlineAlertVariant} from '../components/common';
import {modeDefaultsOf, withDefaultModes} from '../services/llm/toolPack';

const DEFAULT_PRESET_TOOLS: PromptTool[] = [
  {
    id: 'preset-literary-critic',
    name: 'Literary Critic',
    content:
      'Respond as a rigorous literary critic. Focus on structure, pacing, thematic coherence, and prose clarity.',
    enabled: true
  },
  {
    id: 'preset-beta-reader',
    name: 'Beta Reader',
    content:
      'Respond as an engaged beta reader. Call out confusion points, emotional impact, and readability issues.',
    enabled: true
  },
  {
    id: 'preset-line-editor',
    name: 'Line Editor',
    content:
      'Prefer concise, concrete prose. Remove filler, tighten sentence rhythm, and avoid repetition.',
    enabled: true
  }
];

/**
 * Prompt tools in Settings: adding, editing, enabling, and deleting tools,
 * the presets, and which tools are active by default in each project mode.
 * `defaultsMode` is the mode being configured; it follows the project's mode.
 */
export function usePromptTools(params: {
  aiSettings: ProjectAISettings;
  projectMode: ProjectMode;
  onSettingsChange: (aiSettings: ProjectAISettings) => void;
  onStatus: (status: {variant: InlineAlertVariant; message: string}) => void;
}) {
  const {aiSettings, projectMode, onSettingsChange, onStatus} = params;
  const [toolName, setToolName] = useState('');
  const [toolContent, setToolContent] = useState('');
  const [editingToolId, setEditingToolId] = useState<string | null>(null);
  const [editingToolName, setEditingToolName] = useState('');
  const [editingToolContent, setEditingToolContent] = useState('');
  const [defaultsMode, setDefaultsMode] = useState<ProjectMode>(projectMode);

  useEffect(() => {
    setDefaultsMode(projectMode);
  }, [projectMode]);

  const promptTools = aiSettings.promptTools ?? [];
  const defaultToolIds = aiSettings.defaultToolIds ?? [];
  const defaultToolIdsByMode = modeDefaultsOf(aiSettings);
  const defaultsForSelectedMode =
    defaultToolIdsByMode[defaultsMode] ?? defaultToolIds;

  const handleAddPromptTool = () => {
    if (!toolName.trim() || !toolContent.trim()) return;
    const id = crypto.randomUUID();
    onSettingsChange(
      withDefaultModes(aiSettings, {
        promptTools: [
          ...promptTools,
          {
            id,
            name: toolName.trim(),
            content: toolContent.trim(),
            enabled: true
          }
        ],
        defaultToolIds: [...new Set([...defaultToolIds, id])],
        defaultToolIdsByMode: {
          ...defaultToolIdsByMode,
          [defaultsMode]: [...new Set([...defaultsForSelectedMode, id])]
        }
      })
    );
    setToolName('');
    setToolContent('');
  };

  const handleDeletePromptTool = (toolId: string) => {
    onSettingsChange(
      withDefaultModes(aiSettings, {
        promptTools: promptTools.filter((tool) => tool.id !== toolId),
        defaultToolIds: defaultToolIds.filter((id) => id !== toolId),
        defaultToolIdsByMode: {
          litrpg: (defaultToolIdsByMode.litrpg ?? []).filter((id) => id !== toolId),
          game: (defaultToolIdsByMode.game ?? []).filter((id) => id !== toolId),
          general: (defaultToolIdsByMode.general ?? []).filter((id) => id !== toolId)
        }
      })
    );
  };

  const handleStartEditTool = (tool: PromptTool) => {
    setEditingToolId(tool.id);
    setEditingToolName(tool.name);
    setEditingToolContent(tool.content);
  };

  const handleCancelEditTool = () => {
    setEditingToolId(null);
    setEditingToolName('');
    setEditingToolContent('');
  };

  const handleSaveEditTool = (toolId: string) => {
    if (!editingToolName.trim() || !editingToolContent.trim()) return;
    onSettingsChange({
      ...aiSettings,
      promptTools: promptTools.map((tool) =>
        tool.id === toolId
          ? {
              id: tool.id,
              name: editingToolName.trim(),
              content: editingToolContent.trim(),
              enabled: tool.enabled
            }
          : tool
      )
    });
    handleCancelEditTool();
  };

  const handleTogglePromptToolEnabled = (toolId: string, enabled: boolean) => {
    onSettingsChange(
      withDefaultModes(aiSettings, {
        promptTools: promptTools.map((tool) =>
          tool.id === toolId ? {...tool, enabled} : tool
        ),
        defaultToolIds: enabled
          ? defaultToolIds
          : defaultToolIds.filter((id) => id !== toolId),
        defaultToolIdsByMode: enabled
          ? defaultToolIdsByMode
          : {
              litrpg: (defaultToolIdsByMode.litrpg ?? []).filter((id) => id !== toolId),
              game: (defaultToolIdsByMode.game ?? []).filter((id) => id !== toolId),
              general: (defaultToolIdsByMode.general ?? []).filter((id) => id !== toolId)
            }
      })
    );
  };

  const handleToggleDefaultTool = (toolId: string, checked: boolean) => {
    const nextModeDefaults = checked
      ? [...new Set([...(defaultToolIdsByMode[defaultsMode] ?? []), toolId])]
      : (defaultToolIdsByMode[defaultsMode] ?? []).filter((id) => id !== toolId);

    if (checked) {
      onSettingsChange(
        withDefaultModes(aiSettings, {
          defaultToolIds: defaultsMode === projectMode
            ? [...new Set([...defaultToolIds, toolId])]
            : defaultToolIds,
          defaultToolIdsByMode: {
            ...defaultToolIdsByMode,
            [defaultsMode]: nextModeDefaults
          }
        })
      );
      return;
    }
    onSettingsChange(
      withDefaultModes(aiSettings, {
        defaultToolIds:
          defaultsMode === projectMode
            ? defaultToolIds.filter((id) => id !== toolId)
            : defaultToolIds,
        defaultToolIdsByMode: {
          ...defaultToolIdsByMode,
          [defaultsMode]: nextModeDefaults
        }
      })
    );
  };

  const handleInstallPresetTools = () => {
    const existingNames = new Set(
      promptTools.map((tool) => tool.name.trim().toLowerCase())
    );
    const additions = DEFAULT_PRESET_TOOLS.filter(
      (tool) => !existingNames.has(tool.name.trim().toLowerCase())
    ).map((tool) => ({
      ...tool,
      id: crypto.randomUUID()
    }));

    if (additions.length === 0) {
      onStatus({variant: 'info', message: 'Preset tools are already installed.'});
      return;
    }

    const additionIds = additions.map((tool) => tool.id);
    onSettingsChange(
      withDefaultModes(aiSettings, {
        promptTools: [...promptTools, ...additions],
        defaultToolIds: [...new Set([...defaultToolIds, ...additionIds])],
        defaultToolIdsByMode: {
          ...defaultToolIdsByMode,
          [defaultsMode]: [
            ...new Set([...(defaultToolIdsByMode[defaultsMode] ?? []), ...additionIds])
          ]
        }
      })
    );
  };

  return {
    promptTools,
    defaultsMode,
    setDefaultsMode,
    defaultsForSelectedMode,
    toolName,
    setToolName,
    toolContent,
    setToolContent,
    editingToolId,
    editingToolName,
    setEditingToolName,
    editingToolContent,
    setEditingToolContent,
    handleAddPromptTool,
    handleDeletePromptTool,
    handleStartEditTool,
    handleCancelEditTool,
    handleSaveEditTool,
    handleTogglePromptToolEnabled,
    handleToggleDefaultTool,
    handleInstallPresetTools
  };
}

export type PromptToolsControls = ReturnType<typeof usePromptTools>;
