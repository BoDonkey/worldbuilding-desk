import type { CharacterStyle } from '../entityTypes';

interface CharacterStyleEditorProps {
  style: CharacterStyle;
  onUpdate: (styleId: string, updates: Partial<CharacterStyle['styles']>) => void;
  onDelete: (styleId: string) => void;
  expanded?: boolean;
  onToggleExpand?: (styleId: string | null) => void;
}

export function CharacterStyleEditor({
  style, 
  onUpdate, 
  onDelete,
  expanded = false,
  onToggleExpand
}: CharacterStyleEditorProps) {
  const handleToggle = () => {
    if (onToggleExpand) {
      onToggleExpand(expanded ? null : style.id);
    }
  };

  const handleStyleChange = (key: keyof CharacterStyle['styles'], value: string) => {
    onUpdate(style.id, { [key]: value });
  };

  return (
    <li
      style={{
        padding: '1rem',
        border: '1px solid #444',
        borderRadius: '4px',
        marginBottom: '0.5rem'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <strong>{style.name}</strong>
          <br />
          <code style={{ fontSize: '0.85rem', color: '#888' }}>
            {style.markName}
          </code>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={handleToggle}
            style={{ fontSize: '0.85rem' }}
          >
            {expanded ? 'Collapse' : 'Edit'}
          </button>
          <button 
            onClick={() => onDelete(style.id)}
            style={{ fontSize: '0.85rem' }}
          >
            Delete
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #444' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label>
                Font Family
                <br />
                <select
                  value={style.styles.fontFamily || 'inherit'}
                  onChange={(e) => handleStyleChange('fontFamily', e.target.value)}
                  style={{ width: '100%', marginTop: '0.25rem' }}
                >
                  <option value="inherit">Default</option>
                  <option value="'Courier New', monospace">Monospace</option>
                  <option value="Georgia, serif">Serif</option>
                  <option value="Arial, sans-serif">Sans-serif</option>
                </select>
              </label>
            </div>

            <div>
              <label>
                Font Size
                <br />
                <select
                  value={style.styles.fontSize || 'inherit'}
                  onChange={(e) => handleStyleChange('fontSize', e.target.value)}
                  style={{ width: '100%', marginTop: '0.25rem' }}
                >
                  <option value="inherit">Default</option>
                  <option value="0.9em">Small</option>
                  <option value="1.1em">Large</option>
                  <option value="1.3em">Extra Large</option>
                </select>
              </label>
            </div>

            <div>
              <label>
                Text Color
                <br />
                <input
                  type="color"
                  value={style.styles.color || '#ffffff'}
                  onChange={(e) => handleStyleChange('color', e.target.value)}
                  style={{ width: '100%', marginTop: '0.25rem' }}
                />
              </label>
            </div>

            <div>
              <label>
                Background Color
                <br />
                <input
                  type="color"
                  value={style.styles.backgroundColor || '#000000'}
                  onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                  style={{ width: '100%', marginTop: '0.25rem' }}
                />
              </label>
            </div>

            <div>
              <label>
                Font Weight
                <br />
                <select
                  value={style.styles.fontWeight || 'normal'}
                  onChange={(e) => handleStyleChange('fontWeight', e.target.value as 'normal' | 'bold')}
                  style={{ width: '100%', marginTop: '0.25rem' }}
                >
                  <option value="normal">Normal</option>
                  <option value="bold">Bold</option>
                </select>
              </label>
            </div>

            <div>
              <label>
                Font Style
                <br />
                <select
                  value={style.styles.fontStyle || 'normal'}
                  onChange={(e) => handleStyleChange('fontStyle', e.target.value as 'normal' | 'italic')}
                  style={{ width: '100%', marginTop: '0.25rem' }}
                >
                  <option value="normal">Normal</option>
                  <option value="italic">Italic</option>
                </select>
              </label>
            </div>
          </div>

          {/* Preview */}
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #555' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Preview:</strong>
            <div
              style={{
                ...style.styles,
                padding: '0.5rem',
                borderRadius: '4px',
                backgroundColor: style.styles.backgroundColor || 'transparent'
              }}
            >
              Sample text in this style
            </div>
          </div>
        </div>
      )}
    </li>
  );
}