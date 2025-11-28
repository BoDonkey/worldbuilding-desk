import { Editor } from '@tiptap/react';

export interface ToolbarButton {
  id: string;
  label: string;
  action: (editor: Editor) => void;
  isActive?: (editor: Editor) => boolean;
  isDisabled?: (editor: Editor) => boolean;
  group?: string;
  icon?: string; // For future icon support
}

export interface ToolbarConfig {
  buttons: ToolbarButton[];
}

// Base formatting buttons
export const formattingButtons: ToolbarButton[] = [
  {
    id: 'bold',
    label: 'B',
    action: (editor) => editor.chain().focus().toggleBold().run(),
    isActive: (editor) => editor.isActive('bold'),
    isDisabled: (editor) => !editor.can().chain().focus().toggleBold().run(),
    group: 'formatting'
  },
  {
    id: 'italic',
    label: 'I',
    action: (editor) => editor.chain().focus().toggleItalic().run(),
    isActive: (editor) => editor.isActive('italic'),
    isDisabled: (editor) => !editor.can().chain().focus().toggleItalic().run(),
    group: 'formatting'
  },
  {
    id: 'underline',
    label: 'U',
    action: (editor) => editor.chain().focus().toggleUnderline().run(),
    isActive: (editor) => editor.isActive('underline'),
    isDisabled: (editor) => !editor.can().chain().focus().toggleUnderline().run(),
    group: 'formatting'
  }
];

// Heading buttons
export const headingButtons: ToolbarButton[] = [
  {
    id: 'heading1',
    label: 'H1',
    action: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    isActive: (editor) => editor.isActive('heading', { level: 1 }),
    group: 'headings'
  },
  {
    id: 'heading2',
    label: 'H2',
    action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    isActive: (editor) => editor.isActive('heading', { level: 2 }),
    group: 'headings'
  },
  {
    id: 'heading3',
    label: 'H3',
    action: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    isActive: (editor) => editor.isActive('heading', { level: 3 }),
    group: 'headings'
  }
];

// List buttons
export const listButtons: ToolbarButton[] = [
  {
    id: 'bulletList',
    label: '• List',
    action: (editor) => editor.chain().focus().toggleBulletList().run(),
    isActive: (editor) => editor.isActive('bulletList'),
    isDisabled: (editor) => !editor.can().chain().focus().toggleBulletList().run(),
    group: 'lists'
  },
  {
    id: 'orderedList',
    label: '1. List',
    action: (editor) => editor.chain().focus().toggleOrderedList().run(),
    isActive: (editor) => editor.isActive('orderedList'),
    isDisabled: (editor) => !editor.can().chain().focus().toggleOrderedList().run(),
    group: 'lists'
  }
];

// History buttons
export const historyButtons: ToolbarButton[] = [
  {
    id: 'undo',
    label: 'Undo',
    action: (editor) => editor.chain().focus().undo().run(),
    isDisabled: (editor) => !editor.can().chain().focus().undo().run(),
    group: 'history'
  },
  {
    id: 'redo',
    label: 'Redo',
    action: (editor) => editor.chain().focus().redo().run(),
    isDisabled: (editor) => !editor.can().chain().focus().redo().run(),
    group: 'history'
  }
];

// Example: Custom character style buttons (for LitRPG system messages, etc.)
export const createCharacterStyleButton = (
  id: string,
  label: string,
  markName: string
): ToolbarButton => ({
  id,
  label,
  action: (editor) => editor.chain().focus().toggleMark(markName).run(),
  isActive: (editor) => editor.isActive(markName),
  group: 'character-styles'
});

// Default configuration
export const defaultToolbarConfig: ToolbarConfig = {
  buttons: [
    ...formattingButtons,
    ...headingButtons.slice(0, 1), // Just H2 for now
    ...listButtons,
    ...historyButtons
  ]
};

// Example: LitRPG preset with system message styling
export const litrpgToolbarConfig: ToolbarConfig = {
  buttons: [
    ...formattingButtons,
    ...headingButtons,
    ...listButtons,
    createCharacterStyleButton('system', 'System', 'systemMessage'),
    createCharacterStyleButton('status', 'Status', 'statusWindow'),
    ...historyButtons
  ]
};