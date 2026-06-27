import {Extension} from '@tiptap/core';
import {Plugin, PluginKey, type Transaction} from 'prosemirror-state';
import {Decoration, DecorationSet} from 'prosemirror-view';
import type {EditorState} from 'prosemirror-state';

interface ReviewFocusFlashState {
  from: number;
  to: number;
  token: number;
}

export const reviewFocusFlashKey = new PluginKey<ReviewFocusFlashState | null>(
  'review-focus-flash'
);

export const setReviewFocusFlash = (
  transaction: Transaction,
  state: ReviewFocusFlashState | null
): Transaction => transaction.setMeta(reviewFocusFlashKey, state);

export const createReviewFocusFlashExtension = () =>
  Extension.create({
    name: 'reviewFocusFlash',

    addProseMirrorPlugins() {
      return [
        new Plugin<ReviewFocusFlashState | null>({
          key: reviewFocusFlashKey,
          state: {
            init: () => null,
            apply(transaction, value) {
              const next = transaction.getMeta(reviewFocusFlashKey);
              if (next !== undefined) {
                return next;
              }
              if (!value) {
                return null;
              }
              const from = transaction.mapping.map(value.from);
              const to = transaction.mapping.map(value.to);
              return from < to ? {...value, from, to} : null;
            }
          },
          props: {
            decorations(state: EditorState) {
              const active = reviewFocusFlashKey.getState(state);
              if (!active) {
                return DecorationSet.empty;
              }
              return DecorationSet.create(state.doc, [
                Decoration.inline(active.from, active.to, {
                  class: 'review-focus-flash',
                  'data-review-focus-token': String(active.token)
                })
              ]);
            }
          }
        })
      ];
    }
  });
