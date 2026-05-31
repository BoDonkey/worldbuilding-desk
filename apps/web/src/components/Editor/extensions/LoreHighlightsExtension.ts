import {Extension} from '@tiptap/core';
import {Plugin, PluginKey} from 'prosemirror-state';
import {Decoration, DecorationSet} from 'prosemirror-view';
import type {EditorState} from 'prosemirror-state';
import type {ConsistencyHighlightIssue} from './ConsistencyHighlightsExtension';
import {getVisibleWorkspaceAnnotations} from '../../../services/consistency/workspaceAnnotations';

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

                getVisibleWorkspaceAnnotations({
                  text: node.text,
                  knownSurfaces: currentEntries.map((entry) => ({
                    id: entry.id,
                    surface: entry.surface,
                    metadata: entry
                  })),
                  reviewSurfaces: currentConsistencyIssues.map((issue) => ({
                    id: issue.id,
                    surface: issue.surface,
                    message: issue.message,
                    severity: issue.severity,
                    issueCode: issue.issueCode,
                    source: issue.source,
                    confidence: issue.confidence,
                    inlineMode: issue.inlineMode,
                    metadata: issue
                  }))
                })
                  .filter((annotation) => annotation.kind === 'known-canon')
                  .forEach((annotation) => {
                    const entry = annotation.data as LoreHighlightEntry | undefined;
                    if (!entry) return;
                    decorations.push(
                      Decoration.inline(pos + annotation.from, pos + annotation.to, {
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
