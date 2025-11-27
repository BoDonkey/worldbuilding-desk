// src/extensions/WordCountExtension.ts
import { Extension } from '@tiptap/core';

export const WordCountExtension = Extension.create({
  name: 'wordCount',

  addStorage() {
    return {
      characters: 0,
      words: 0
    };
  },

  onUpdate() {
    const text = this.editor.getText();

    this.storage.characters = text.length;
    this.storage.words = text
      .split(/\s+/)
      .filter(Boolean).length;
  }
});
