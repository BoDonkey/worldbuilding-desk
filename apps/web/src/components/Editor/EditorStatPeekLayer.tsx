import {ContextPopover} from './ContextPopover';
import {CharacterStatCard} from '../CharacterSheets/CharacterStatCard';
import {PinStatsButton} from '../CharacterSheets/PinStatsButton';
import {
  STAT_PEEK_SHORTCUT_LABEL,
  type EditorCharacterStatPeek,
  type EditorStatPeekControls
} from '../../hooks/useEditorStatPeek';
import styles from '../../assets/components/AISettings.module.css';

interface EditorStatPeekLayerProps {
  peek: EditorStatPeekControls;
  characterStatPeek?: EditorCharacterStatPeek;
  onExpandSelection: (selection: {selectedText: string; from: number; to: number}) => void;
}

/** The right-click character menu and the stat peek popover in the editor. */
export function EditorStatPeekLayer({peek, characterStatPeek, onExpandSelection}: EditorStatPeekLayerProps) {
  const {
    statPeek,
    setStatPeek,
    statPeekMenu,
    setStatPeekMenu,
    statPeekMenuRef,
    statPeekSnapshot,
    openStatPeek,
    closeStatPeek
  } = peek;

  return (
    <>
      {statPeekMenu && (
        <div
          ref={statPeekMenuRef}
          className={styles.selectionBubble}
          style={{left: `${statPeekMenu.x}px`, top: `${statPeekMenu.y}px`}}
          role='menu'
          aria-label='Character actions'
          onMouseDown={(event) => event.preventDefault()}
        >
          <button
            type='button'
            role='menuitem'
            onClick={() =>
              openStatPeek({
                candidates: statPeekMenu.candidates,
                editorPosition: statPeekMenu.editorPosition,
                left: statPeekMenu.x,
                anchorTop: statPeekMenu.anchorTop,
                anchorBottom: statPeekMenu.anchorBottom
              })
            }
          >
            Show stats
          </button>
          {statPeekMenu.selection && (
            <button
              type='button'
              role='menuitem'
              onClick={() => {
                const selection = statPeekMenu.selection;
                setStatPeekMenu(null);
                if (!selection) return;
                onExpandSelection(selection);
              }}
            >
              AI Expand
            </button>
          )}
          <span className={styles.selectionHint}>{STAT_PEEK_SHORTCUT_LABEL}</span>
        </div>
      )}
      {statPeek && (
        <ContextPopover
          title={
            statPeek.sheetId
              ? 'Character stats'
              : statPeek.candidates.length > 1
                ? 'Which character?'
                : 'Character stats'
          }
          left={statPeek.left}
          top={statPeek.top}
          anchorTop={statPeek.anchorTop}
          anchorBottom={statPeek.anchorBottom}
          tone='neutral'
          focusOnOpen={statPeek.source === 'keyboard'}
          onClose={closeStatPeek}
        >
          {statPeek.sheetId && statPeekSnapshot ? (
            <CharacterStatCard
              snapshot={statPeekSnapshot}
              asOfLabel={
                statPeek.source === 'hover'
                  ? 'At this mention'
                  : `At the cursor in ${characterStatPeek?.sceneTitle ?? 'this scene'}`
              }
              template={characterStatPeek?.template}
              actions={
                statPeek.source === 'keyboard' && (
                  <div className={styles.systemActions}>
                    <PinStatsButton
                      sheetId={statPeekSnapshot.sheetId}
                      name={statPeekSnapshot.name}
                    />
                  </div>
                )
              }
            />
          ) : statPeek.candidates.length > 1 ? (
            <div className={styles.systemActions} role='group' aria-label='Matching characters'>
              {statPeek.candidates.map((candidate) => (
                <button
                  key={candidate.sheetId}
                  type='button'
                  onClick={() =>
                    setStatPeek((current) =>
                      current ? {...current, sheetId: candidate.sheetId} : current
                    )
                  }
                >
                  {candidate.name}
                </button>
              ))}
            </div>
          ) : (
            <div className={styles.lorePeekList}>
              {statPeek.sheetId
                ? 'Stats are not available for this scene.'
                : 'No character name at the cursor. Use Show stats for… in the command palette to pick one.'}
            </div>
          )}
        </ContextPopover>
      )}
    </>
  );
}
