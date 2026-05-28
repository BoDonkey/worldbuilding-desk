import {Extension} from '@tiptap/core';
import {Plugin, PluginKey} from 'prosemirror-state';
import {Decoration, DecorationSet} from 'prosemirror-view';
import type {EditorState} from 'prosemirror-state';
import {findTextMatches} from '../../../services/consistency/textMatcher';

export interface ConsistencyHighlightIssue {
  id: string;
  surface: string;
  message: string;
  severity: 'blocking' | 'warning';
}

export interface KnownHighlightSurface {
  id: string;
  surface: string;
}

const consistencyHighlightsKey = new PluginKey('consistency-highlights');
type HighlightSource<T> = T[] | (() => T[]);

const resolveHighlightSource = <T,>(source: HighlightSource<T>): T[] =>
  typeof source === 'function' ? source() : source;

export const createConsistencyHighlightsExtension = (
  issues: HighlightSource<ConsistencyHighlightIssue>,
  knownSurfaces: HighlightSource<KnownHighlightSurface> = []
) =>
  Extension.create({
    name: 'consistencyHighlights',

    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: consistencyHighlightsKey,
          props: {
            decorations(state: EditorState) {
              const currentIssues = resolveHighlightSource(issues);
              if (currentIssues.length === 0) {
                return DecorationSet.empty;
              }
              const currentKnownSurfaces = resolveHighlightSource(knownSurfaces);

              const decorations: Decoration[] = [];

              state.doc.descendants((
                node: {isText: boolean; text?: string | null},
                pos: number
              ) => {
                if (!node.isText || !node.text) {
                  return;
                }

                const knownMatches = findTextMatches(
                  node.text,
                  currentKnownSurfaces.map((entry) => ({
                    id: entry.id,
                    surface: entry.surface,
                    kind: 'known' as const
                  }))
                );

                findTextMatches(
                  node.text,
                  currentIssues.map((issue) => ({
                    id: issue.id,
                    surface: issue.surface,
                    kind: 'review' as const,
                    metadata: {issue}
                  }))
                ).forEach((match) => {
                  const issue = match.pattern.metadata?.issue as
                    | ConsistencyHighlightIssue
                    | undefined;
                  if (!issue) return;
                  const overlapsLongerKnownSurface = knownMatches.some(
                    (knownMatch) =>
                      match.from >= knownMatch.from &&
                      match.to <= knownMatch.to &&
                      knownMatch.to - knownMatch.from > match.to - match.from
                  );
                  if (overlapsLongerKnownSurface) {
                    return;
                  }
                  decorations.push(
                    Decoration.inline(pos + match.from, pos + match.to, {
                      class:
                        issue.severity === 'blocking'
                          ? 'consistency-highlight consistency-highlight-blocking'
                          : 'consistency-highlight consistency-highlight-warning',
                      'data-consistency-id': issue.id,
                      title: issue.message
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
