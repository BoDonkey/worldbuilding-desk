// Example custom marks for character-specific styling (like LitRPG system messages)
import { Mark, mergeAttributes } from '@tiptap/core';

// System message mark (for LitRPG-style system notifications)
export const SystemMessage = Mark.create({
  name: 'systemMessage',

  // Add any attributes you want to store
  addAttributes() {
    return {
      class: {
        default: 'system-message',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="system-message"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(
        { 'data-type': 'system-message' },
        HTMLAttributes,
        {
          style: 'font-family: "Courier New", monospace; color: #00ff00; background: #001100; padding: 2px 4px; border-radius: 3px;'
        }
      ),
      0,
    ];
  },

  addCommands() {
    return {
      toggleSystemMessage:
        () =>
        ({ commands }) => {
          return commands.toggleMark(this.name);
        },
    };
  },
});

// Status window mark (for character stat displays)
export const StatusWindow = Mark.create({
  name: 'statusWindow',

  addAttributes() {
    return {
      class: {
        default: 'status-window',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="status-window"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(
        { 'data-type': 'status-window' },
        HTMLAttributes,
        {
          style: 'font-family: "Courier New", monospace; color: #4a9eff; background: #001a33; padding: 2px 4px; border: 1px solid #4a9eff; border-radius: 3px;'
        }
      ),
      0,
    ];
  },

  addCommands() {
    return {
      toggleStatusWindow:
        () =>
        ({ commands }) => {
          return commands.toggleMark(this.name);
        },
    };
  },
});

// Dialogue mark (for character-specific dialogue styling)
export const CharacterDialogue = Mark.create({
  name: 'characterDialogue',

  addAttributes() {
    return {
      character: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-character'),
        renderHTML: (attributes) => {
          if (!attributes.character) {
            return {};
          }
          return {
            'data-character': attributes.character,
          };
        },
      },
      class: {
        default: 'character-dialogue',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="character-dialogue"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const character = HTMLAttributes['data-character'] || 'default';
    
    // You could look up character-specific styles from a config
    // For now, just a simple example
    return [
      'span',
      mergeAttributes(
        { 'data-type': 'character-dialogue' },
        HTMLAttributes,
        {
          style: 'font-style: italic; color: #e0e0e0;'
        }
      ),
      0,
    ];
  },

  addCommands() {
    return {
      setCharacterDialogue:
        (character: string) =>
        ({ commands }) => {
          return commands.setMark(this.name, { character });
        },
      toggleCharacterDialogue:
        () =>
        ({ commands }) => {
          return commands.toggleMark(this.name);
        },
    };
  },
});

// Helper function to create custom styled marks
export const createCustomStyleMark = (
  name: string,
  defaultStyle: string
): Mark => {
  return Mark.create({
    name,

    addAttributes() {
      return {
        class: {
          default: name,
        },
        style: {
          default: defaultStyle,
          parseHTML: (element) => element.getAttribute('style'),
          renderHTML: (attributes) => {
            if (!attributes.style) {
              return {};
            }
            return {
              style: attributes.style,
            };
          },
        },
      };
    },

    parseHTML() {
      return [
        {
          tag: `span[data-type="${name}"]`,
        },
      ];
    },

    renderHTML({ HTMLAttributes }) {
      return [
        'span',
        mergeAttributes(
          { 'data-type': name },
          HTMLAttributes
        ),
        0,
      ];
    },

    addCommands() {
      return {
        [`toggle${name.charAt(0).toUpperCase() + name.slice(1)}`]:
          () =>
          ({ commands }) => {
            return commands.toggleMark(this.name);
          },
      };
    },
  });
};