import {Extension} from '@tiptap/core';
import {Plugin, PluginKey} from 'prosemirror-state';
import {Decoration, DecorationSet} from 'prosemirror-view';
import type {EditorState} from 'prosemirror-state';

export interface ConsistencyHighlightIssue {
  id: string;
  surface: string;
  message: string;
  severity: 'blocking' | 'warning';
}

const consistencyHighlightsKey = new PluginKey('consistency-highlights');

const normalize = (value: string): string => value.trim().toLowerCase();

export const createConsistencyHighlightsExtension = (
  issues: ConsistencyHighlightIssue[]
) =>
  Extension.create({
    name: 'consistencyHighlights',

    addProseMirrorPlugins() {
      const normalizedIssues = issues
        .map((issue) => ({
          ...issue,
          normalizedSurface: normalize(issue.surface)
        }))
        .filter((issue) => issue.normalizedSurface.length > 0);

      return [
        new Plugin({
          key: consistencyHighlightsKey,
          props: {
            decorations(state: EditorState) {
              if (normalizedIssues.length === 0) {
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
                const normalizedText = text.toLowerCase();

                normalizedIssues.forEach((issue) => {
                  let searchFrom = 0;
                  while (searchFrom < normalizedText.length) {
                    const matchIndex = normalizedText.indexOf(
                      issue.normalizedSurface,
                      searchFrom
                    );
                    if (matchIndex === -1) {
                      break;
                    }

                    const from = pos + matchIndex;
                    const to = from + issue.surface.length;
                    decorations.push(
                      Decoration.inline(from, to, {
                        class:
                          issue.severity === 'blocking'
                            ? 'consistency-highlight consistency-highlight-blocking'
                            : 'consistency-highlight consistency-highlight-warning',
                        'data-consistency-id': issue.id,
                        title: issue.message
                      })
                    );
                    searchFrom = matchIndex + issue.surface.length;
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
