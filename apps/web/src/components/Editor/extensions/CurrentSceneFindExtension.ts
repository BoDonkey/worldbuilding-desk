import {Extension} from '@tiptap/core';
import {Plugin, PluginKey, type EditorState, type Transaction} from 'prosemirror-state';
import {Decoration, DecorationSet} from 'prosemirror-view';
import type {CurrentSceneFindMatch} from '../../../services/workspace/currentSceneFind';

interface CurrentSceneFindState {
  matches: CurrentSceneFindMatch[];
  activeIndex: number;
}

export const currentSceneFindKey = new PluginKey<CurrentSceneFindState | null>(
  'current-scene-find'
);

export const setCurrentSceneFind = (
  transaction: Transaction,
  state: CurrentSceneFindState | null
): Transaction => transaction.setMeta(currentSceneFindKey, state);

export const createCurrentSceneFindExtension = () =>
  Extension.create({
    name: 'currentSceneFind',

    addProseMirrorPlugins() {
      return [
        new Plugin<CurrentSceneFindState | null>({
          key: currentSceneFindKey,
          state: {
            init: () => null,
            apply(transaction, value) {
              const next = transaction.getMeta(currentSceneFindKey);
              if (next !== undefined) return next;
              if (!value) return null;
              const matches = value.matches
                .map((match) => ({
                  from: transaction.mapping.map(match.from),
                  to: transaction.mapping.map(match.to)
                }))
                .filter((match) => match.from < match.to);
              return matches.length ? {...value, matches} : null;
            }
          },
          props: {
            decorations(state: EditorState) {
              const findState = currentSceneFindKey.getState(state);
              if (!findState) return DecorationSet.empty;
              return DecorationSet.create(
                state.doc,
                findState.matches.map((match, index) =>
                  Decoration.inline(match.from, match.to, {
                    class:
                      index === findState.activeIndex
                        ? 'current-scene-find-match current-scene-find-match-active'
                        : 'current-scene-find-match',
                    'data-current-scene-find-match': String(index + 1),
                    'data-current-scene-find-active':
                      index === findState.activeIndex ? 'true' : 'false'
                  })
                )
              );
            }
          }
        })
      ];
    }
  });
