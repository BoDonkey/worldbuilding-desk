import {Extension} from '@tiptap/core';
import {Plugin, PluginKey} from 'prosemirror-state';
import {Decoration, DecorationSet} from 'prosemirror-view';
import type {EditorState} from 'prosemirror-state';

export interface LoreHighlightEntry {
  id: string;
  surface: string;
  type: 'character' | 'entity';
}

const loreHighlightsKey = new PluginKey('lore-highlights');

const normalize = (value: string): string => value.trim().toLowerCase();

export const createLoreHighlightsExtension = (entries: LoreHighlightEntry[]) =>
  Extension.create({
    name: 'loreHighlights',

    addProseMirrorPlugins() {
      const normalizedEntries = entries
        .map((entry) => ({
          ...entry,
          normalizedSurface: normalize(entry.surface)
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
                const normalizedText = text.toLowerCase();

                normalizedEntries.forEach((entry) => {
                  let searchFrom = 0;
                  while (searchFrom < normalizedText.length) {
                    const matchIndex = normalizedText.indexOf(
                      entry.normalizedSurface,
                      searchFrom
                    );
                    if (matchIndex === -1) {
                      break;
                    }

                    const from = pos + matchIndex;
                    const to = from + entry.surface.length;
                    decorations.push(
                      Decoration.inline(from, to, {
                        class: 'lore-highlight',
                        'data-lore-id': entry.id,
                        'data-lore-type': entry.type,
                        title: `Open lore for ${entry.surface}`
                      })
                    );
                    searchFrom = matchIndex + entry.surface.length;
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
