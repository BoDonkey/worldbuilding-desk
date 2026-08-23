import type {LoreDocumentLink} from '../../entityTypes';

/**
 * Document context links are retrieval/proposal-targeting metadata. The first
 * primary subject wins; any additional primary subjects become additional
 * subjects so every saved note has at most one extraction fallback target.
 */
export function normalizeLoreDocumentLinks(
  links: LoreDocumentLink[]
): LoreDocumentLink[] {
  let hasPrimarySubject = false;
  const seenTargets = new Set<string>();

  return links.flatMap((link) => {
    if (!link.targetId) return [];
    const targetKey = `${link.targetType}:${link.targetId}`;
    if (seenTargets.has(targetKey)) return [];
    seenTargets.add(targetKey);

    if (link.relationship !== 'primary_subject') {
      return [link];
    }
    if (!hasPrimarySubject) {
      hasPrimarySubject = true;
      return [link];
    }
    return [{...link, relationship: 'secondary_subject' as const}];
  });
}
