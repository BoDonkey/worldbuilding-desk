# TipTap Editor Customization Guide

## Extensible Toolbar System

The toolbar is now configuration-driven, making it easy to add custom formatting options.

### Basic Usage

```typescript
import TipTapEditor from './components/TipTapEditor';

<TipTapEditor
  content={content}
  onChange={setContent}
  onWordCountChange={setWordCount}
/>
```

### Adding Custom Character Styles

#### Step 1: Create a Custom Mark Extension

```typescript
// In CustomMarks.ts
import { Mark, mergeAttributes } from '@tiptap/core';

export const MyCustomStyle = Mark.create({
  name: 'myCustomStyle',

  parseHTML() {
    return [{ tag: 'span[data-type="my-custom-style"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(
        { 'data-type': 'my-custom-style' },
        HTMLAttributes,
        {
          style: 'font-family: "Special Font"; color: #ff00ff;'
        }
      ),
      0,
    ];
  },

  addCommands() {
    return {
      toggleMyCustomStyle: () => ({ commands }) => {
        return commands.toggleMark(this.name);
      },
    };
  },
});
```

#### Step 2: Add to Toolbar Config

```typescript
// In toolbarConfig.ts
import { ToolbarButton } from './toolbarConfig';

export const myCustomButton: ToolbarButton = {
  id: 'myCustomStyle',
  label: 'Custom',
  action: (editor) => editor.chain().focus().toggleMyCustomStyle().run(),
  isActive: (editor) => editor.isActive('myCustomStyle'),
  group: 'character-styles'
};
```

#### Step 3: Update Editor Extensions

```typescript
// In TipTapEditor.tsx
import { MyCustomStyle } from '../extensions/CustomMarks';

const editor = useEditor({
  extensions: [
    StarterKit,
    WordCountExtension,
    MyCustomStyle  // Add your custom mark
  ],
  // ...
});
```

#### Step 4: Add Button to Toolbar

```typescript
// Option 1: Modify defaultToolbarButtons directly
const defaultToolbarButtons: ToolbarButton[] = [
  ...formattingButtons,
  myCustomButton,  // Add here
  ...listButtons,
  ...historyButtons
];

// Option 2: Pass custom config as prop (future enhancement)
<TipTapEditor 
  toolbarConfig={myCustomToolbarConfig}
  // ...
/>
```

## LitRPG Example

For a LitRPG-style system with special formatting:

```typescript
// 1. Use the provided SystemMessage and StatusWindow marks
import { SystemMessage, StatusWindow } from '../extensions/CustomMarks';

// 2. Add them to editor
const editor = useEditor({
  extensions: [
    StarterKit,
    WordCountExtension,
    SystemMessage,
    StatusWindow
  ],
});

// 3. Add buttons
const litrpgButtons: ToolbarButton[] = [
  {
    id: 'system',
    label: 'System',
    action: (editor) => editor.chain().focus().toggleSystemMessage().run(),
    isActive: (editor) => editor.isActive('systemMessage'),
    group: 'character-styles'
  },
  {
    id: 'status',
    label: 'Status',
    action: (editor) => editor.chain().focus().toggleStatusWindow().run(),
    isActive: (editor) => editor.isActive('statusWindow'),
    group: 'character-styles'
  }
];
```

### Result

When you select text and click "System", it will be rendered as:
```
[System Message] You have gained 50 XP!
```
With green monospace text on dark green background.

## Future Enhancements

### 1. User-Configurable Styles
Store custom styles in project settings:

```typescript
interface CharacterStyle {
  id: string;
  name: string;
  fontFamily?: string;
  fontSize?: string;
  color?: string;
  backgroundColor?: string;
  fontWeight?: string;
  fontStyle?: string;
}

// Store in project settings
const projectStyles: CharacterStyle[] = [
  {
    id: 'protagonist-thoughts',
    name: 'Protagonist Thoughts',
    fontStyle: 'italic',
    color: '#cccccc'
  }
];
```

### 2. Style Presets
Create preset configurations for different genres:

```typescript
const genrePresets = {
  litrpg: litrpgToolbarConfig,
  screenplay: screenplayToolbarConfig,
  novel: novelToolbarConfig
};
```

### 3. Visual Style Editor
Add a UI for users to create custom styles without code:
- Color picker
- Font selector
- Preview pane
- Save/load styles per project

## Toolbar Groups

Buttons are organized into logical groups:
- `formatting`: Bold, italic, underline
- `headings`: H1, H2, H3
- `lists`: Bullet and numbered lists
- `character-styles`: Custom character-specific styles
- `history`: Undo/redo

Groups are automatically separated by dividers in the UI.

## Custom Button Properties

```typescript
interface ToolbarButton {
  id: string;                              // Unique identifier
  label: string;                           // Button text
  action: (editor: Editor) => void;        // What happens on click
  isActive?: (editor: Editor) => boolean;  // Visual active state
  isDisabled?: (editor: Editor) => boolean;// When to disable
  group?: string;                          // Logical grouping
  icon?: string;                           // Future: icon support
}
```

## Tips

1. **Keep marks simple**: Each mark should do one thing well
2. **Use CSS classes**: Makes it easier to restyle later
3. **Test thoroughly**: Ensure marks work with undo/redo
4. **Document your styles**: Help future you remember what each does
5. **Consider export**: Think about how your custom styles will export to other formats