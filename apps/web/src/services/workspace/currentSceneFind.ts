export interface EditorTextSegment {
  text: string;
  position: number;
}

export interface CurrentSceneFindMatch {
  from: number;
  to: number;
}

export const findCurrentSceneMatches = (
  segments: EditorTextSegment[],
  query: string
): CurrentSceneFindMatch[] => {
  if (!query.trim()) return [];

  const groups: EditorTextSegment[][] = [];
  segments.forEach((segment) => {
    if (!segment.text) return;
    const currentGroup = groups.at(-1);
    const previous = currentGroup?.at(-1);
    if (
      currentGroup &&
      previous &&
      segment.position === previous.position + previous.text.length
    ) {
      currentGroup.push(segment);
      return;
    }
    groups.push([segment]);
  });

  const loweredQuery = query.toLocaleLowerCase();
  const matches: CurrentSceneFindMatch[] = [];
  groups.forEach((group) => {
    const text = group.map((segment) => segment.text).join('');
    const loweredText = text.toLocaleLowerCase();
    let offset = 0;
    while (offset <= loweredText.length - loweredQuery.length) {
      const index = loweredText.indexOf(loweredQuery, offset);
      if (index < 0) break;
      matches.push({
        from: group[0].position + index,
        to: group[0].position + index + query.length
      });
      offset = index + Math.max(1, query.length);
    }
  });
  return matches;
};

export const resolveCurrentSceneFindIndex = (
  currentIndex: number,
  matchCount: number,
  direction: 'next' | 'previous'
): number => {
  if (matchCount <= 0) return -1;
  if (currentIndex < 0 || currentIndex >= matchCount) {
    return direction === 'next' ? 0 : matchCount - 1;
  }
  return direction === 'next'
    ? (currentIndex + 1) % matchCount
    : (currentIndex - 1 + matchCount) % matchCount;
};
