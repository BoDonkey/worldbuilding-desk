// apps/web/src/config/editorConfig.ts
import type { AnyExtension, Editor } from '@tiptap/core';
import { Extension } from '@tiptap/core';
import { TextStyleKit } from '@tiptap/extension-text-style';
import StarterKit from '@tiptap/starter-kit';
import type { CharacterStyle } from '../entityTypes';
import { createCharacterStyleExtensions } from '../extensions/registry';

// Word count extension
const WordCountExtension = Extension.create({
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
    this.storage.words = text.split(/\s+/).filter(Boolean).length;
  }
});

export interface EditorConfig {
  extensions: AnyExtension[];
}

export const defaultEditorConfig: EditorConfig = {
  extensions: [TextStyleKit, StarterKit, WordCountExtension]
};

// Helper to get word count from editor storage
export function getWordCount(editor: Editor): number {
  const storage = (editor.storage as unknown) as { wordCount?: { words?: number } };
  return storage.wordCount?.words ?? 0;
}

/**
 * Create editor config with character styles
 */
export function createEditorConfigWithStyles(
  characterStyles: CharacterStyle[]
): EditorConfig {
  const characterExtensions = createCharacterStyleExtensions(characterStyles);
  const characterMarks = characterExtensions.map((ext) => ext.mark);

  return {
    extensions: [
      TextStyleKit,
      StarterKit,
      WordCountExtension,
      ...characterMarks,
    ],
  };
}