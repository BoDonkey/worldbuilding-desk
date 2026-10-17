import {Extension} from '@tiptap/core';
import {Plugin, PluginKey, type Transaction} from 'prosemirror-state';
import {Decoration, DecorationSet} from 'prosemirror-view';
import type {EditorState} from 'prosemirror-state';

export interface AIContextPassageRange {
  from: number;
  to: number;
}

export const aiContextPassageKey = new PluginKey<AIContextPassageRange | null>(
  'ai-context-passage'
);

export const setAIContextPassage = (
  transaction: Transaction,
  range: AIContextPassageRange | null
): Transaction => transaction.setMeta(aiContextPassageKey, range).setMeta('addToHistory', false);

/**
 * Marks the passage the assistant is using as its context (Slice 4.66), so it
 * stays visible after the editor loses focus. Display only: a decoration that
 * follows edits and is never part of the scene content.
 */
export const createAIContextPassageExtension = () =>
  Extension.create({
    name: 'aiContextPassage',

    addProseMirrorPlugins() {
      return [
        new Plugin<AIContextPassageRange | null>({
          key: aiContextPassageKey,
          state: {
            init: () => null,
            apply(transaction, value) {
              const next = transaction.getMeta(aiContextPassageKey);
              if (next !== undefined) {
                return next;
              }
              if (!value) {
                return null;
              }
              const from = transaction.mapping.map(value.from, 1);
              const to = transaction.mapping.map(value.to, -1);
              return from < to ? {from, to} : null;
            }
          },
          props: {
            decorations(state: EditorState) {
              const active = aiContextPassageKey.getState(state);
              if (!active) {
                return DecorationSet.empty;
              }
              const to = Math.min(active.to, state.doc.content.size);
              if (active.from >= to) {
                return DecorationSet.empty;
              }
              return DecorationSet.create(state.doc, [
                Decoration.inline(active.from, to, {
                  class: 'ai-context-passage',
                  'data-testid': 'ai-context-passage'
                })
              ]);
            }
          }
        })
      ];
    }
  });
