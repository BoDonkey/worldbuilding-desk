import {Extension} from '@tiptap/core';
import {Plugin, PluginKey} from 'prosemirror-state';
import {Decoration, DecorationSet} from 'prosemirror-view';
import type {EditorState} from 'prosemirror-state';
import type {ConsistencyHighlightIssue} from './ConsistencyHighlightsExtension';

export interface LoreHighlightEntry {
  id: string;
  surface: string;
  type: 'character' | 'entity';
}

const loreHighlightsKey = new PluginKey('lore-highlights');

const normalize = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/['’]s\b/g, '')
    .replace(/s['’]\b/g, 's')
    .replace(/\s+/g, ' ')
    .trim();

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const createLoreHighlightsExtension = (
  entries: LoreHighlightEntry[],
  consistencyIssues: ConsistencyHighlightIssue[] = []
) =>
  Extension.create({
    name: 'loreHighlights',

    addProseMirrorPlugins() {
      const normalizedConsistencyIssues = consistencyIssues
        .map((issue) => ({
          ...issue,
          normalizedSurface: normalize(issue.surface),
          matcher: new RegExp(
            `(^|[^\\p{L}\\p{N}_])(${escapeRegex(normalize(issue.surface))})(?:['’]s|s['’])?(?=$|[^\\p{L}\\p{N}_])`,
            'giu'
          )
        }))
        .filter((issue) => issue.normalizedSurface.length > 0);
      const normalizedEntries = entries
        .map((entry) => ({
          ...entry,
          normalizedSurface: normalize(entry.surface),
          matcher: new RegExp(
            `(^|[^\\p{L}\\p{N}_])(${escapeRegex(normalize(entry.surface))})(?:['’]s|s['’])?(?=$|[^\\p{L}\\p{N}_])`,
            'giu'
          )
        }))
        .filter((entry) => entry.normalizedSurface.length > 0);

      return [
        new Plugin({
          key: loreHighlightsKey,
          props: {
            decorations(state: EditorState) {
              if (normalizedEntries.length === 0) {
                return DecorationSet.empty;
              }

              const decorations: Decoration[] = [];

              state.doc.descendants((
                node: {isText: boolean; text?: string | null},
                pos: number
              ) => {
                if (!node.isText || !node.text) {
                  return;
                }

                const text = node.text;
                const normalizedText = text
                  .toLowerCase()
                  .replace(/\s+/g, ' ');
                const blockedRanges: Array<{from: number; to: number}> = [];

                normalizedConsistencyIssues.forEach((issue) => {
                  issue.matcher.lastIndex = 0;
                  let match: RegExpExecArray | null = null;
                  while ((match = issue.matcher.exec(normalizedText))) {
                    const prefix = match[1] ?? '';
                    const matchedText = match[0] ?? '';
                    const matchIndex = match.index + prefix.length;
                    blockedRanges.push({
                      from: pos + matchIndex,
                      to: pos + matchIndex + (matchedText.length - prefix.length)
                    });
                  }
                });

                normalizedEntries.forEach((entry) => {
                  entry.matcher.lastIndex = 0;
                  let match: RegExpExecArray | null = null;
                  while ((match = entry.matcher.exec(normalizedText))) {
                    const prefix = match[1] ?? '';
                    const matchedText = match[0] ?? '';
                    const matchIndex = match.index + prefix.length;
                    const from = pos + matchIndex;
                    const to = from + (matchedText.length - prefix.length);
                    const overlapsConsistency = blockedRanges.some(
                      (range) => from < range.to && to > range.from
                    );
                    if (overlapsConsistency) {
                      continue;
                    }
                    decorations.push(
                      Decoration.inline(from, to, {
                        class: 'lore-highlight',
                        'data-lore-id': entry.id,
                        'data-lore-type': entry.type,
                        title: `Open lore for ${entry.surface}`
                      })
                    );
                  }
                });
              });

              return DecorationSet.create(state.doc, decorations);
            }
          }
        })
      ];
    }
  });
