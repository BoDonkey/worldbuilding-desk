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

export const createConsistencyHighlightsExtension = (
  issues: ConsistencyHighlightIssue[]
) =>
  Extension.create({
    name: 'consistencyHighlights',

    addProseMirrorPlugins() {
      const normalizedIssues = issues
        .map((issue) => ({
          ...issue,
          normalizedSurface: normalize(issue.surface),
          matcher: new RegExp(
            `(^|[^\\p{L}\\p{N}_])(${escapeRegex(normalize(issue.surface))})(?:['’]s|s['’])?(?=$|[^\\p{L}\\p{N}_])`,
            'giu'
          )
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
                const normalizedText = text
                  .toLowerCase()
                  .replace(/\s+/g, ' ');

                normalizedIssues.forEach((issue) => {
                  issue.matcher.lastIndex = 0;
                  let match: RegExpExecArray | null = null;
                  while ((match = issue.matcher.exec(normalizedText))) {
                    const prefix = match[1] ?? '';
                    const matchedText = match[0] ?? '';
                    const matchIndex = match.index + prefix.length;
                    const from = pos + matchIndex;
                    const to = from + (matchedText.length - prefix.length);
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
