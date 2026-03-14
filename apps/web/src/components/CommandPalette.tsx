import {useEffect, useMemo, useRef, useState} from 'react';
import type {AppCommand} from '../commands/commandRegistry';
import styles from '../assets/components/CommandPalette.module.css';

interface CommandPaletteProps {
  isOpen: boolean;
  commands: AppCommand[];
  onClose: () => void;
  onExecute: (command: AppCommand) => void;
}

export const CommandPalette = ({
  isOpen,
  commands,
  onClose,
  onExecute
}: CommandPaletteProps) => {
  const RECENT_COMMANDS_KEY = 'recentCommands';
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentCommandIds, setRecentCommandIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(RECENT_COMMANDS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((entry): entry is string => typeof entry === 'string');
    } catch {
      return [];
    }
  });
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filteredCommands = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return commands;
    return commands.filter((command) => {
      const haystack = [
        command.label,
        command.section,
        command.shortcut ?? '',
        ...command.keywords
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [commands, query]);

  const recentCommands = useMemo(
    () =>
      recentCommandIds
        .map((id) => commands.find((command) => command.id === id))
        .filter((command): command is AppCommand => Boolean(command)),
    [commands, recentCommandIds]
  );

  const groupedCommands = useMemo(() => {
    if (query.trim()) {
      return [
        {
          label: 'Results',
          commands: filteredCommands
        }
      ];
    }

    const groups: Array<{label: string; commands: AppCommand[]}> = [];
    if (recentCommands.length > 0) {
      groups.push({label: 'Recent', commands: recentCommands});
    }

    const seen = new Set(recentCommands.map((command) => command.id));
    const navigation = filteredCommands.filter(
      (command) => command.section === 'Navigation' && !seen.has(command.id)
    );
    const workspace = filteredCommands.filter(
      (command) => command.section === 'Workspace' && !seen.has(command.id)
    );

    if (navigation.length > 0) {
      groups.push({label: 'Navigation', commands: navigation});
    }
    if (workspace.length > 0) {
      groups.push({label: 'Workspace', commands: workspace});
    }
    return groups;
  }, [filteredCommands, query, recentCommands]);

  const commandList = useMemo(
    () => groupedCommands.flatMap((group) => group.commands),
    [groupedCommands]
  );

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setActiveIndex(0);
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (activeIndex >= commandList.length) {
      setActiveIndex(commandList.length === 0 ? 0 : commandList.length - 1);
    }
  }, [activeIndex, commandList.length]);

  if (!isOpen) return null;

  const handleExecute = (command: AppCommand) => {
    const nextRecent = [command.id, ...recentCommandIds.filter((id) => id !== command.id)].slice(
      0,
      8
    );
    setRecentCommandIds(nextRecent);
    localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(nextRecent));
    onExecute(command);
  };

  const executeActive = () => {
    const command = commandList[activeIndex];
    if (!command) return;
    handleExecute(command);
  };

  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={styles.palette}
        role='dialog'
        aria-modal='true'
        aria-label='Command palette'
      >
        <input
          ref={inputRef}
          className={styles.input}
          placeholder='Type a command...'
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              onClose();
              return;
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              if (commandList.length > 0) {
                setActiveIndex((prev) => (prev + 1) % commandList.length);
              }
              return;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              if (commandList.length > 0) {
                setActiveIndex(
                  (prev) => (prev - 1 + commandList.length) % commandList.length
                );
              }
              return;
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              executeActive();
            }
          }}
        />
        <ul className={styles.list} role='listbox' aria-label='Command results'>
          {commandList.length === 0 && (
            <li className={styles.empty}>No commands found.</li>
          )}
          {groupedCommands.map((group) => (
            <li key={group.label} className={styles.group}>
              <div className={styles.groupHeader}>{group.label}</div>
              <ul className={styles.groupList}>
                {group.commands.map((command) => {
                  const index = commandList.findIndex((entry) => entry.id === command.id);
                  return (
                    <li key={command.id}>
                      <button
                        type='button'
                        className={index === activeIndex ? styles.itemActive : styles.item}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => handleExecute(command)}
                        role='option'
                        aria-selected={index === activeIndex}
                      >
                        <span>{command.label}</span>
                        <span className={styles.meta}>
                          {command.section}
                          {command.shortcut ? ` · ${command.shortcut}` : ''}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
