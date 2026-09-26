import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import {useLocation, useNavigate} from 'react-router';
import {CommandPalette} from '../components/CommandPalette';
import {CharacterStatPeekDialog} from '../components/CharacterStatPeekDialog';
import {requestCharacterStatPeek} from '../commands/characterStatPeek';
import {getProjectCapabilities} from '../projectMode';
import {
  deriveCharacterSheetNames,
  getCharacterSheetsByProject
} from '../services/characters';
import {
  buildCharacterPeekTargets,
  resolveCharacterStatCardTemplate,
  type CharacterPeekTarget
} from '../services/state/characterPeek';
import {
  createAppCommands,
  type AppCommand
} from '../commands/commandRegistry';
import {getDocumentsByProject} from '../writingStorage';
import {getEntitiesByProject} from '../entityStorage';
import {getAliasesByProject} from '../services/consistency';
import {useAppStore} from '../store/appStore';
import {
  CommandPaletteContext,
  type CommandPaletteContextValue
} from './commandPaletteApi';

interface CommandPaletteProviderProps {
  children: ReactNode;
}

export const CommandPaletteProvider = ({children}: CommandPaletteProviderProps) => {
  const activeProject = useAppStore((s) => s.activeProject);
  const projectSettings = useAppStore((s) => s.projectSettings);
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchCommands, setSearchCommands] = useState<AppCommand[]>([]);
  const [statPeekTargets, setStatPeekTargets] = useState<CharacterPeekTarget[]>([]);
  const [statPeek, setStatPeek] = useState<{query: string; sheetId: string | null} | null>(
    null
  );
  const canUseGameSystems = getProjectCapabilities(
    activeProject ? projectSettings : null
  ).canUseGameSystems;

  useEffect(() => {
    if (!activeProject) {
      setSearchCommands([]);
      setStatPeekTargets([]);
      return;
    }

    let cancelled = false;

    const loadSearchCommands = async () => {
      const [documents, entities, aliases, sheets] = await Promise.all([
        getDocumentsByProject(activeProject.id),
        getEntitiesByProject(activeProject.id),
        getAliasesByProject(activeProject.id),
        getCharacterSheetsByProject(activeProject.id)
      ]);

      if (cancelled) return;

      setStatPeekTargets(
        buildCharacterPeekTargets({
          sheets: deriveCharacterSheetNames(sheets, entities),
          entities,
          aliases
        })
      );

      const aliasesByEntityId = aliases.reduce<Record<string, string[]>>((acc, alias) => {
        if (alias.targetType !== 'entity') {
          return acc;
        }
        acc[alias.targetId] = [...(acc[alias.targetId] ?? []), alias.alias];
        return acc;
      }, {});

      const summarizeScene = (html: string) =>
        html
          .replace(/<br\s*\/?>/gi, ' ')
          .replace(/<\/p>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 180);

      const nextSearchCommands: AppCommand[] = [
        ...documents
          .slice()
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((doc) => {
            const excerpt = summarizeScene(doc.content);
            const fullText = doc.content
              .replace(/<br\s*\/?>/gi, ' ')
              .replace(/<\/p>/gi, ' ')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            return {
              id: `search-scene-${doc.id}`,
              label: doc.title || 'Untitled scene',
              description: excerpt
                ? `Scene · ${excerpt}`
                : 'Scene · Writing Workspace',
              section: 'Search' as const,
              keywords: ['scene', 'workspace', doc.title || '', fullText],
              run: (query?: string) =>
                navigate('/workspace', {
                  state: {
                    focusDocumentId: doc.id,
                    focusQuery: query?.trim() || undefined
                  }
                })
            };
          }),
        ...entities
          .slice()
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((entity) => {
            const aliasesForEntity = aliasesByEntityId[entity.id] ?? [];
            const fieldSummary = Object.values(entity.fields)
              .filter((value): value is string => typeof value === 'string')
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 140);
            return {
              id: `search-world-${entity.id}`,
              label: entity.name,
              description: aliasesForEntity.length > 0
                ? `World Bible · Aliases: ${aliasesForEntity.slice(0, 3).join(', ')}${fieldSummary ? ` · ${fieldSummary}` : ''}`
                : fieldSummary
                  ? `World Bible · ${fieldSummary}`
                  : 'World Bible',
              section: 'Search' as const,
              keywords: [
                'world',
                'bible',
                'entity',
                entity.name,
                ...aliasesForEntity,
                fieldSummary
              ],
              run: () =>
                navigate('/world-bible', {
                  state: {focusEntityId: entity.id}
                })
            };
          })
      ];

      setSearchCommands(nextSearchCommands);
    };

    void loadSearchCommands();

    const reload = () => {
      void loadSearchCommands();
    };

    window.addEventListener('wbd:entity-records-changed', reload);
    window.addEventListener('wbd:alias-records-changed', reload);
    window.addEventListener('wbd:writing-records-changed', reload);
    window.addEventListener('wbd:character-sheet-records-changed', reload);

    return () => {
      cancelled = true;
      window.removeEventListener('wbd:entity-records-changed', reload);
      window.removeEventListener('wbd:alias-records-changed', reload);
      window.removeEventListener('wbd:writing-records-changed', reload);
      window.removeEventListener('wbd:character-sheet-records-changed', reload);
    };
  }, [activeProject, isOpen, navigate]);

  const statPeekCommands = useMemo<AppCommand[]>(() => {
    if (!canUseGameSystems) return [];
    const showStatsFor = (sheetId: string) => {
      if (!requestCharacterStatPeek(sheetId)) setStatPeek({query: '', sheetId});
    };
    return [
      {
        id: 'character-show-stats',
        label: 'Show stats for…',
        section: 'Characters',
        keywords: ['stats', 'status', 'sheet', 'character', 'peek', 'level'],
        description: location.pathname.startsWith('/workspace')
          ? 'At the cursor in the current scene'
          : 'Latest state',
        run: (query?: string) =>
          setStatPeek({
            query: (query ?? '')
              .replace(/^\s*(show\s+)?(stats?|status)(\s+for)?\s*/i, '')
              .replace(/…/g, '')
              .trim(),
            sheetId: null
          })
      },
      ...statPeekTargets.map((target) => ({
        id: `search-stats-${target.sheetId}`,
        label: `Show stats for ${target.name}`,
        section: 'Search' as const,
        keywords: ['stats', 'status', 'sheet', ...target.surfaces],
        run: () => showStatsFor(target.sheetId)
      }))
    ];
  }, [canUseGameSystems, location.pathname, statPeekTargets]);

  const commands = useMemo(
    () => [
      ...searchCommands,
      ...statPeekCommands,
      ...createAppCommands({
        pathname: location.pathname,
        navigate,
        activeProject,
        projectSettings
      })
    ],
    [
      location.pathname,
      navigate,
      activeProject,
      projectSettings,
      searchCommands,
      statPeekCommands
    ]
  );

  const closeStatPeek = useCallback(() => setStatPeek(null), []);

  const closePalette = useCallback(() => {
    setIsOpen(false);
  }, []);

  const openPalette = useCallback(() => {
    setIsOpen(true);
  }, []);

  const togglePalette = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleExecuteCommand = useCallback((command: AppCommand) => {
    setIsOpen(false);
    command.run();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isPaletteShortcut = (event.metaKey || event.ctrlKey) && event.key === 'k';
      if (!isPaletteShortcut) return;
      event.preventDefault();
      setIsOpen((prev) => !prev);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const value = useMemo<CommandPaletteContextValue>(
    () => ({
      isOpen,
      openPalette,
      closePalette,
      togglePalette
    }),
    [isOpen, openPalette, closePalette, togglePalette]
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPalette
        isOpen={isOpen}
        commands={commands}
        onClose={closePalette}
        onExecute={handleExecuteCommand}
      />
      <CharacterStatPeekDialog
        isOpen={Boolean(statPeek) && canUseGameSystems}
        projectId={activeProject?.id ?? null}
        initialQuery={statPeek?.query ?? ''}
        initialSheetId={statPeek?.sheetId ?? null}
        template={resolveCharacterStatCardTemplate(projectSettings?.statBlockPreferences)}
        onClose={closeStatPeek}
      />
    </CommandPaletteContext.Provider>
  );
};
