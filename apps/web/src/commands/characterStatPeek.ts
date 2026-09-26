export const CHARACTER_STAT_PEEK_EVENT = 'wbd:show-character-stats';

export interface CharacterStatPeekRequestDetail {
  sheetId: string;
  /** Set by a surface that shows the peek itself (Workspace, at the cursor). */
  handled: boolean;
}

/**
 * Asks the current surface to show a character's stats in place. Returns false
 * when no surface took it, so the caller shows the latest state instead.
 */
export const requestCharacterStatPeek = (sheetId: string): boolean => {
  const detail: CharacterStatPeekRequestDetail = {sheetId, handled: false};
  window.dispatchEvent(
    new CustomEvent<CharacterStatPeekRequestDetail>(CHARACTER_STAT_PEEK_EVENT, {detail})
  );
  return detail.handled;
};
