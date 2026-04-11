import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import {CommandPalette} from '../components/CommandPalette';
import {
  createAppCommands,
  type AppCommand
} from '../commands/commandRegistry';
import type {Project, ProjectSettings} from '../entityTypes';
import {getDocumentsByProject} from '../writingStorage';
import {getEntitiesByProject} from '../entityStorage';
import {getAliasesByProject} from '../services/consistency';
import {
  CommandPaletteContext,
  type CommandPaletteContextValue
} from './commandPaletteApi';

interface CommandPaletteProviderProps {
  activeProject: Project | null;
  projectSettings: ProjectSettings | null;
  children: ReactNode;
}

export const CommandPaletteProvider = ({
  activeProject,
  projectSettings,
  children
}: CommandPaletteProviderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchCommands, setSearchCommands] = useState<AppCommand[]>([]);

  useEffect(() => {
    if (!activeProject) {
      setSearchCommands([]);
      return;
    }

    let cancelled = false;

    const loadSearchCommands = async () => {
      const [documents, entities, aliases] = await Promise.all([
        getDocumentsByProject(activeProject.id),
        getEntitiesByProject(activeProject.id),
        getAliasesByProject(activeProject.id)
      ]);

      if (cancelled) return;

      const aliasesByEntityId = aliases.reduce<Record<string, string[]>>((acc, alias) => {
        acc[alias.entityId] = [...(acc[alias.entityId] ?? []), alias.alias];
        return acc;
      }, {});

      const nextSearchCommands: AppCommand[] = [
        ...documents
          .slice()
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((doc) => ({
            id: `search-scene-${doc.id}`,
            label: `Open Scene: ${doc.title || 'Untitled scene'}`,
            description: 'Writing Workspace',
            section: 'Search' as const,
            keywords: [
              'scene',
              'workspace',
              doc.title || '',
              doc.content
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 240)
            ],
            run: () =>
              navigate('/workspace', {
                state: {focusDocumentId: doc.id}
              })
          })),
        ...entities
          .slice()
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((entity) => {
            const aliasesForEntity = aliasesByEntityId[entity.id] ?? [];
            return {
              id: `search-world-${entity.id}`,
              label: `Open World Record: ${entity.name}`,
              description:
                aliasesForEntity.length > 0
                  ? `World Bible · Aliases: ${aliasesForEntity.slice(0, 3).join(', ')}`
                  : 'World Bible',
              section: 'Search' as const,
              keywords: [
                'world',
                'bible',
                'entity',
                entity.name,
                ...aliasesForEntity,
                ...Object.values(entity.fields)
                  .filter((value): value is string => typeof value === 'string')
                  .slice(0, 6)
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

    return () => {
      cancelled = true;
      window.removeEventListener('wbd:entity-records-changed', reload);
      window.removeEventListener('wbd:alias-records-changed', reload);
    };
  }, [activeProject, isOpen, navigate]);

  const commands = useMemo(
    () => [
      ...searchCommands,
      ...createAppCommands({
        pathname: location.pathname,
        navigate,
        activeProject,
        projectSettings
      })
    ],
    [location.pathname, navigate, activeProject, projectSettings, searchCommands]
  );

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
    </CommandPaletteContext.Provider>
  );
};
