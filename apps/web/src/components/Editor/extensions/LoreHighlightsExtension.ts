import {Extension} from '@tiptap/core';
import {Plugin, PluginKey} from 'prosemirror-state';
import {Decoration, DecorationSet} from 'prosemirror-view';
import type {EditorState} from 'prosemirror-state';
import type {ConsistencyHighlightIssue} from './ConsistencyHighlightsExtension';
import {findTextMatches} from '../../../services/consistency/textMatcher';

export interface LoreHighlightEntry {
  id: string;
  surface: string;
  type: 'character' | 'entity';
}

const loreHighlightsKey = new PluginKey('lore-highlights');
type HighlightSource<T> = T[] | (() => T[]);

const resolveHighlightSource = <T,>(source: HighlightSource<T>): T[] =>
  typeof source === 'function' ? source() : source;

export const createLoreHighlightsExtension = (
  entries: HighlightSource<LoreHighlightEntry>,
  consistencyIssues: HighlightSource<ConsistencyHighlightIssue> = []
) =>
  Extension.create({
    name: 'loreHighlights',

    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: loreHighlightsKey,
          props: {
            decorations(state: EditorState) {
              const currentEntries = resolveHighlightSource(entries);
              if (currentEntries.length === 0) {
                return DecorationSet.empty;
              }
              const currentConsistencyIssues = resolveHighlightSource(consistencyIssues);

              const decorations: Decoration[] = [];

              state.doc.descendants((
                node: {isText: boolean; text?: string | null},
                pos: number
              ) => {
                if (!node.isText || !node.text) {
                  return;
                }

                const blockedRanges: Array<{from: number; to: number}> = [];

                findTextMatches(
                  node.text,
                  currentConsistencyIssues.map((issue) => ({
                    id: issue.id,
                    surface: issue.surface,
                    kind: 'review' as const
                  }))
                ).forEach((match) => {
                  blockedRanges.push({
                    from: pos + match.from,
                    to: pos + match.to
                  });
                });

                findTextMatches(
                  node.text,
                  currentEntries.map((entry) => ({
                    id: entry.id,
                    surface: entry.surface,
                    kind: 'known' as const,
                    metadata: {entry}
                  }))
                ).forEach((match) => {
                  const entry = match.pattern.metadata?.entry as
                    | LoreHighlightEntry
                    | undefined;
                  if (!entry) return;
                  const from = pos + match.from;
                  const to = pos + match.to;
                  const overlapsConsistency = blockedRanges.some(
                    (range) => from < range.to && to > range.from
                  );
                  if (overlapsConsistency) {
                    return;
                  }
                  decorations.push(
                    Decoration.inline(from, to, {
                      class: 'lore-highlight',
                      'data-lore-id': entry.id,
                      'data-lore-type': entry.type,
                      title: `Open lore for ${entry.surface}`
                    })
                  );
                });
              });

              return DecorationSet.create(state.doc, decorations);
            }
          }
        })
      ];
    }
  });
