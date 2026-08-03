import type {CharacterStyle} from '../entityTypes';
import {useConfirmDialog} from '../hooks/useConfirmDialog';
import styles from '../assets/components/CharacterStyleEditor.module.css';

interface CharacterStyleEditorProps {
  style: CharacterStyle;
  onUpdate: (
    styleId: string,
    updates: Partial<CharacterStyle['styles']>
  ) => void;
  onDelete: (styleId: string) => void;
  expanded?: boolean;
  onToggleExpand?: (styleId: string | null) => void;
}

const COLOR_VALUE_PATTERN = /^#[0-9a-f]{6}$/i;

const getColorInputValue = (value: string | undefined): string =>
  COLOR_VALUE_PATTERN.test(value ?? '') ? value ?? '' : '';

export function CharacterStyleEditor({
  style,
  onUpdate,
  onDelete,
  expanded = false,
  onToggleExpand
}: CharacterStyleEditorProps) {
  const {requestConfirm, confirmDialog} = useConfirmDialog();

  const handleToggle = () => {
    if (onToggleExpand) {
      onToggleExpand(expanded ? null : style.id);
    }
  };

  const handleStyleChange = (
    key: keyof CharacterStyle['styles'],
    value: string
  ) => {
    onUpdate(style.id, {[key]: value});
  };

  const handleDeleteClick = () => {
    requestConfirm({
      title: `Delete "${style.name}"?`,
      message: 'This character style will be permanently removed.',
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: () => onDelete(style.id)
    });
  };

  return (
    <li className={styles.listItem}>
      <div className={styles.summaryRow}>
        <div className={styles.identity}>
          <strong>{style.name}</strong>
          <code className={styles.markName}>{style.markName}</code>
        </div>
        <div className={styles.actions}>
          <button
            type='button'
            onClick={handleToggle}
            className={styles.actionButton}
          >
            {expanded ? 'Collapse' : 'Edit'}
          </button>
          <button
            type='button'
            onClick={handleDeleteClick}
            className={`${styles.actionButton} ${styles.deleteButton}`}
          >
            Delete
          </button>
        </div>
      </div>

      {expanded && (
        <div className={styles.editor}>
          <div className={styles.controlsGrid}>
            <label className={styles.control}>
              Font Family
              <select
                value={style.styles.fontFamily || 'inherit'}
                onChange={(event) =>
                  handleStyleChange('fontFamily', event.target.value)
                }
                className={styles.controlInput}
              >
                <option value='inherit'>Default</option>
                <option value="'Courier New', monospace">Monospace</option>
                <option value='Georgia, serif'>Serif</option>
                <option value='Arial, sans-serif'>Sans-serif</option>
              </select>
            </label>

            <label className={styles.control}>
              Font Size
              <select
                value={style.styles.fontSize || 'inherit'}
                onChange={(event) =>
                  handleStyleChange('fontSize', event.target.value)
                }
                className={styles.controlInput}
              >
                <option value='inherit'>Default</option>
                <option value='0.9em'>Small</option>
                <option value='1.1em'>Large</option>
                <option value='1.3em'>Extra Large</option>
              </select>
            </label>

            <label className={styles.control}>
              Text Color
              <input
                type='color'
                value={getColorInputValue(style.styles.color)}
                onChange={(event) =>
                  handleStyleChange('color', event.target.value)
                }
                className={styles.colorInput}
              />
            </label>

            <label className={styles.control}>
              Background Color
              <input
                type='color'
                value={getColorInputValue(style.styles.backgroundColor)}
                onChange={(event) =>
                  handleStyleChange('backgroundColor', event.target.value)
                }
                className={styles.colorInput}
              />
            </label>

            <label className={styles.control}>
              Font Weight
              <select
                value={style.styles.fontWeight || 'normal'}
                onChange={(event) =>
                  handleStyleChange(
                    'fontWeight',
                    event.target.value as 'normal' | 'bold'
                  )
                }
                className={styles.controlInput}
              >
                <option value='normal'>Normal</option>
                <option value='bold'>Bold</option>
              </select>
            </label>

            <label className={styles.control}>
              Font Style
              <select
                value={style.styles.fontStyle || 'normal'}
                onChange={(event) =>
                  handleStyleChange(
                    'fontStyle',
                    event.target.value as 'normal' | 'italic'
                  )
                }
                className={styles.controlInput}
              >
                <option value='normal'>Normal</option>
                <option value='italic'>Italic</option>
              </select>
            </label>
          </div>

          <div className={styles.previewSection}>
            <strong className={styles.previewLabel}>Preview:</strong>
            <div className={styles.preview} style={{...style.styles}}>
              Sample text in this style
            </div>
          </div>
        </div>
      )}

      {confirmDialog}
    </li>
  );
}
