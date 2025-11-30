import { Mark, mergeAttributes } from '@tiptap/core';
import type { CharacterStyle } from '../entityTypes';

export interface ExtensionDefinition {
  id: string;
  name: string;
  mark: Mark;
}

/**
 * Create a TipTap Mark extension from a CharacterStyle definition
 */
export function createCharacterStyleMark(style: CharacterStyle): Mark {
  return Mark.create({
    name: style.markName,
    excludes: '',
    inclusive: false,

    addAttributes() {
      return {
        class: {
          default: style.markName,
        },
      };
    },

    parseHTML() {
      return [
        {
          tag: `span[data-character-style="${style.markName}"]`,
        },
      ];
    },

    renderHTML({ HTMLAttributes }) {
      // Build inline styles from CharacterStyle
      const styleString = Object.entries(style.styles)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => {
          // Convert camelCase to kebab-case
          const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          return `${cssKey}: ${value}`;
        })
        .join('; ');

      return [
        'span',
        mergeAttributes(
          { 'data-character-style': style.markName },
          HTMLAttributes,
          { style: styleString }
        ),
        0,
      ];
    },

    addCommands() {
      return {
        [`toggle${style.markName.charAt(0).toUpperCase() + style.markName.slice(1)}`]:
          () =>
          ({ commands }) => {
            return commands.toggleMark(this.name);
          },
      };
    },
  });
}

/**
 * Generate extension definitions from project settings
 */
export function createCharacterStyleExtensions(
  styles: CharacterStyle[]
): ExtensionDefinition[] {
  return styles.map((style) => ({
    id: style.id,
    name: style.name,
    mark: createCharacterStyleMark(style),
  }));
}