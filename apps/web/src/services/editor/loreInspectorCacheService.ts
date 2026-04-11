interface CachedSynopsis {
  goal: string;
  recentEvent: string;
  motivation: string;
}

const cacheKey = (projectId: string, subjectId: string, revision: number | string) =>
  `loreSynopsis:${projectId}:${subjectId}:${revision}`;

export const getCachedSynopsis = (
  projectId: string,
  subjectId: string,
  revision: number | string
): CachedSynopsis | null => {
  try {
    const raw = localStorage.getItem(cacheKey(projectId, subjectId, revision));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedSynopsis>;
    if (
      typeof parsed.goal !== 'string' ||
      typeof parsed.recentEvent !== 'string' ||
      typeof parsed.motivation !== 'string'
    ) {
      return null;
    }
    return {
      goal: parsed.goal,
      recentEvent: parsed.recentEvent,
      motivation: parsed.motivation
    };
  } catch {
    return null;
  }
};

export const setCachedSynopsis = (
  projectId: string,
  subjectId: string,
  revision: number | string,
  synopsis: CachedSynopsis
): void => {
  localStorage.setItem(cacheKey(projectId, subjectId, revision), JSON.stringify(synopsis));
};
