import {useState} from 'react';
import styles from '../../assets/components/AISettings.module.css';

/** What the Workspace hands the selection menu for custom AI actions (Slice 5.19). */
export interface EditorSelectionActions {
  actions: Array<{id: string; name: string}>;
  /** The hosted-provider data disclosure, or null for a local route. */
  disclosure: string | null;
  /** True while an action runs; the entries are disabled until it ends. */
  busy: boolean;
  onRun: (actionId: string, selection: {selectedText: string; passage: string; from: number; to: number}) => void;
}

/** More than this many actions are grouped under one **AI actions** entry. */
export const SELECTION_ACTIONS_INLINE_LIMIT = 3;

/**
 * The AI entries of the editor selection menu: Ask AI about this, then the author's switched-on AI
 * actions (5.19). A few actions are listed directly; more are grouped under one entry so the menu
 * stays short.
 */
export function SelectionMenuAIEntries({
  onAskAI,
  controls,
  selection,
  getPassage,
  onDone
}: {
  /** Unset while both AI switches are off (5.18). */
  onAskAI?: () => void;
  /** Unset when no action is on. */
  controls?: EditorSelectionActions;
  selection: {selectedText: string; from: number; to: number};
  /** The selection with paragraph breaks kept, as the model should read it. */
  getPassage: () => string;
  /** Closes the selection menu once an action starts. */
  onDone: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const {actions = [], disclosure = null, busy = false, onRun} = controls ?? {};
  const askAI = onAskAI && <button type='button' onClick={onAskAI}>Ask AI about this</button>;
  if (!onRun || actions.length === 0) return askAI ?? null;
  const grouped = actions.length > SELECTION_ACTIONS_INLINE_LIMIT;
  const buttons = actions.map((action) => (
    <button
      key={action.id}
      type='button'
      disabled={busy}
      onClick={() => {
        const {selectedText, from, to} = selection;
        onRun(action.id, {selectedText, from, to, passage: getPassage() || selectedText});
        onDone();
      }}
    >
      {action.name}
    </button>
  ));
  return (
    <>
      {askAI}
      {grouped ? (
        <button type='button' aria-expanded={expanded} onClick={() => setExpanded((open) => !open)}>
          AI actions {expanded ? '▴' : '▾'}
        </button>
      ) : (
        buttons
      )}
      {grouped && expanded && (
        <div role='group' aria-label='AI actions' className={styles.systemActions}>
          {buttons}
        </div>
      )}
      {disclosure && <span className={styles.selectionHint}>{disclosure}</span>}
    </>
  );
}
