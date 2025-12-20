import {Extension} from '@tiptap/core';
import {Plugin, PluginKey} from 'prosemirror-state';
import type {EditorView} from 'prosemirror-view';

export const AIExpandMenu = Extension.create({
  name: 'aiExpandMenu',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('aiExpandMenu'),
        props: {
          handleDOMEvents: {
            contextmenu: (view: EditorView, event: MouseEvent) => {
              const {from, to} = view.state.selection;
              if (from === to) return false;

              const selectedText = view.state.doc.textBetween(from, to);
              if (!selectedText.trim()) return false;

              // Emit event for parent component to handle
              const customEvent = new CustomEvent('ai-expand-request', {
                detail: {selectedText, from, to}
              });
              window.dispatchEvent(customEvent);

              event.preventDefault();
              return true;
            }
          }
        }
      })
    ];
  }
});
