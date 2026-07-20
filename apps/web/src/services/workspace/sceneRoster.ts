export type SceneRosterCandidateType = 'character' | 'entity';

export interface SceneRosterCandidate {
  key: string;
  type: SceneRosterCandidateType;
  id: string;
  name: string;
  aliases: string[];
}

export interface SceneRosterOverrides {
  pinnedKeys: string[];
  hiddenKeys: string[];
}

export interface SceneRosterMatch extends SceneRosterCandidate {
  source: 'scene' | 'pinned';
  matchedSurface?: string;
}

export interface SceneRosterSelection {
  entries: SceneRosterMatch[];
  ambiguousSurfaces: string[];
}

export interface SceneRosterPreferences {
  version: 1;
  bySceneId: Record<string, SceneRosterOverrides>;
}

export const EMPTY_SCENE_ROSTER_OVERRIDES: SceneRosterOverrides = {
  pinnedKeys: [],
  hiddenKeys: []
};

const EMPTY_SCENE_ROSTER_PREFERENCES: SceneRosterPreferences = {
  version: 1,
  bySceneId: {}
};

const normalizeSurface = (value: string): string =>
  value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}'-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const decodeHtmlText = (html: string): string => {
  if (typeof DOMParser !== 'undefined') {
    return new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
  }
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'");
};

const containsSurface = (normalizedText: string, surface: string): boolean => {
  const normalizedSurface = normalizeSurface(surface);
  if (!normalizedSurface) return false;
  const escaped = normalizedSurface.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, 'u').test(
    normalizedText
  );
};

export function selectSceneRoster(params: {
  content: string;
  candidates: SceneRosterCandidate[];
  overrides?: SceneRosterOverrides;
}): SceneRosterSelection {
  const overrides = params.overrides ?? EMPTY_SCENE_ROSTER_OVERRIDES;
  const candidateByKey = new Map(params.candidates.map((candidate) => [candidate.key, candidate]));
  const surfaces = new Map<string, {label: string; candidates: SceneRosterCandidate[]}>();

  params.candidates.forEach((candidate) => {
    [candidate.name, ...candidate.aliases].forEach((surface) => {
      const normalized = normalizeSurface(surface);
      if (!normalized) return;
      const current = surfaces.get(normalized) ?? {label: surface.trim(), candidates: []};
      if (!current.candidates.some((entry) => entry.key === candidate.key)) {
        current.candidates.push(candidate);
      }
      surfaces.set(normalized, current);
    });
  });

  const normalizedText = normalizeSurface(decodeHtmlText(params.content));
  const matchedByKey = new Map<string, string>();
  const ambiguousSurfaces = new Set<string>();

  Array.from(surfaces.entries())
    .sort(([left], [right]) => right.length - left.length)
    .forEach(([, surface]) => {
      if (!containsSurface(normalizedText, surface.label)) return;
      if (surface.candidates.length !== 1) {
        ambiguousSurfaces.add(surface.label);
        return;
      }
      const [candidate] = surface.candidates;
      if (!matchedByKey.has(candidate.key)) {
        matchedByKey.set(candidate.key, surface.label);
      }
    });

  const hidden = new Set(overrides.hiddenKeys);
  const pinned = new Set(overrides.pinnedKeys);
  const entries: SceneRosterMatch[] = [];

  params.candidates.forEach((candidate) => {
    if (hidden.has(candidate.key)) return;
    const matchedSurface = matchedByKey.get(candidate.key);
    if (matchedSurface) {
      entries.push({...candidate, source: 'scene', matchedSurface});
      return;
    }
    if (pinned.has(candidate.key)) {
      entries.push({...candidate, source: 'pinned'});
    }
  });

  pinned.forEach((key) => {
    if (candidateByKey.has(key) || hidden.has(key)) return;
    // Stale pins are intentionally ignored when their source record no longer exists.
  });

  return {
    entries: entries.sort((left, right) => left.name.localeCompare(right.name)),
    ambiguousSurfaces: Array.from(ambiguousSurfaces).sort((left, right) =>
      left.localeCompare(right)
    )
  };
}

const stringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? Array.from(new Set(value.filter((entry): entry is string => typeof entry === 'string')))
    : [];

export function parseSceneRosterPreferences(raw: string | null): SceneRosterPreferences {
  if (!raw) return EMPTY_SCENE_ROSTER_PREFERENCES;
  try {
    const parsed = JSON.parse(raw) as {version?: unknown; bySceneId?: unknown};
    if (!parsed.bySceneId || typeof parsed.bySceneId !== 'object') {
      return EMPTY_SCENE_ROSTER_PREFERENCES;
    }
    const bySceneId: Record<string, SceneRosterOverrides> = {};
    Object.entries(parsed.bySceneId as Record<string, unknown>).forEach(([sceneId, value]) => {
      if (!value || typeof value !== 'object') return;
      const entry = value as {pinnedKeys?: unknown; hiddenKeys?: unknown};
      bySceneId[sceneId] = {
        pinnedKeys: stringArray(entry.pinnedKeys),
        hiddenKeys: stringArray(entry.hiddenKeys)
      };
    });
    return {version: 1, bySceneId};
  } catch {
    return EMPTY_SCENE_ROSTER_PREFERENCES;
  }
}

export function updateSceneRosterOverride(params: {
  preferences: SceneRosterPreferences;
  sceneId: string;
  candidateKey: string;
  action: 'pin' | 'hide' | 'reset';
}): SceneRosterPreferences {
  const current =
    params.preferences.bySceneId[params.sceneId] ?? EMPTY_SCENE_ROSTER_OVERRIDES;
  const pinned = new Set(current.pinnedKeys);
  const hidden = new Set(current.hiddenKeys);

  if (params.action === 'pin') {
    pinned.add(params.candidateKey);
    hidden.delete(params.candidateKey);
  } else if (params.action === 'hide') {
    hidden.add(params.candidateKey);
    pinned.delete(params.candidateKey);
  } else {
    pinned.delete(params.candidateKey);
    hidden.delete(params.candidateKey);
  }

  return {
    version: 1,
    bySceneId: {
      ...params.preferences.bySceneId,
      [params.sceneId]: {
        pinnedKeys: Array.from(pinned),
        hiddenKeys: Array.from(hidden)
      }
    }
  };
}
