import { useState } from 'react';

interface CharacterStyle {
  id: string;
  name: string;
  fontFamily?: string;
  fontSize?: string;
  color?: string;
  backgroundColor?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
}

interface StyleManagerProps {
  onSaveStyle: (style: CharacterStyle) => void;
  existingStyles: CharacterStyle[];
}

/**
 * UI Component for creating and managing custom character styles
 * This would eventually be added to the Settings page
 */
function StyleManager({ onSaveStyle, existingStyles }: StyleManagerProps) {
  const [editingStyle, setEditingStyle] = useState<CharacterStyle>({
    id: crypto.randomUUID(),
    name: '',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    color: '#ffffff',
    backgroundColor: 'transparent',
    fontWeight: 'normal',
    fontStyle: 'normal'
  });

  const [previewText] = useState('The quick brown fox jumps over the lazy dog.');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStyle.name.trim()) {
      alert('Please enter a style name');
      return;
    }
    onSaveStyle(editingStyle);
    // Reset form
    setEditingStyle({
      id: crypto.randomUUID(),
      name: '',
      fontFamily: 'inherit',
      fontSize: 'inherit',
      color: '#ffffff',
      backgroundColor: 'transparent',
      fontWeight: 'normal',
      fontStyle: 'normal'
    });
  };

  const getPreviewStyle = (): React.CSSProperties => {
    return {
      fontFamily: editingStyle.fontFamily !== 'inherit' ? editingStyle.fontFamily : undefined,
      fontSize: editingStyle.fontSize !== 'inherit' ? editingStyle.fontSize : undefined,
      color: editingStyle.color,
      backgroundColor: editingStyle.backgroundColor !== 'transparent' ? editingStyle.backgroundColor : undefined,
      fontWeight: editingStyle.fontWeight,
      fontStyle: editingStyle.fontStyle,
      padding: '0.5rem',
      borderRadius: '4px',
      marginTop: '1rem'
    };
  };

  return (
    <div style={{ maxWidth: '600px' }}>
      <h2>Character Style Manager</h2>
      <p style={{ fontSize: '0.9rem', color: '#aaa' }}>
        Create custom styles for character dialogue, system messages, or special text formatting
      </p>

      <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            Style Name *
            <br />
            <input
              type="text"
              value={editingStyle.name}
              onChange={(e) => setEditingStyle({ ...editingStyle, name: e.target.value })}
              placeholder="e.g., System Message, Protagonist Thoughts"
              style={{ width: '100%', marginTop: '0.25rem' }}
            />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label>
              Font Family
              <br />
              <select
                value={editingStyle.fontFamily}
                onChange={(e) => setEditingStyle({ ...editingStyle, fontFamily: e.target.value })}
                style={{ width: '100%', marginTop: '0.25rem' }}
              >
                <option value="inherit">Default</option>
                <option value="'Courier New', monospace">Monospace</option>
                <option value="Georgia, serif">Serif</option>
                <option value="Arial, sans-serif">Sans-serif</option>
                <option value="'Comic Sans MS', cursive">Comic Sans</option>
              </select>
            </label>
          </div>

          <div>
            <label>
              Font Size
              <br />
              <select
                value={editingStyle.fontSize}
                onChange={(e) => setEditingStyle({ ...editingStyle, fontSize: e.target.value })}
                style={{ width: '100%', marginTop: '0.25rem' }}
              >
                <option value="inherit">Default</option>
                <option value="0.8em">Small</option>
                <option value="1em">Normal</option>
                <option value="1.2em">Large</option>
                <option value="1.5em">Extra Large</option>
              </select>
            </label>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <div>
            <label>
              Text Color
              <br />
              <input
                type="color"
                value={editingStyle.color}
                onChange={(e) => setEditingStyle({ ...editingStyle, color: e.target.value })}
                style={{ width: '100%', marginTop: '0.25rem', height: '2.5rem' }}
              />
            </label>
          </div>

          <div>
            <label>
              Background Color
              <br />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <input
                  type="color"
                  value={editingStyle.backgroundColor === 'transparent' ? '#000000' : editingStyle.backgroundColor}
                  onChange={(e) => setEditingStyle({ ...editingStyle, backgroundColor: e.target.value })}
                  style={{ flex: 1, height: '2.5rem' }}
                  disabled={editingStyle.backgroundColor === 'transparent'}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.9rem' }}>
                  <input
                    type="checkbox"
                    checked={editingStyle.backgroundColor === 'transparent'}
                    onChange={(e) => setEditingStyle({
                      ...editingStyle,
                      backgroundColor: e.target.checked ? 'transparent' : '#000000'
                    })}
                  />
                  None
                </label>
              </div>
            </label>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <div>
            <label>
              Font Weight
              <br />
              <select
                value={editingStyle.fontWeight}
                onChange={(e) => setEditingStyle({ ...editingStyle, fontWeight: e.target.value as 'normal' | 'bold' })}
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
                value={editingStyle.fontStyle}
                onChange={(e) => setEditingStyle({ ...editingStyle, fontStyle: e.target.value as 'normal' | 'italic' })}
                style={{ width: '100%', marginTop: '0.25rem' }}
              >
                <option value="normal">Normal</option>
                <option value="italic">Italic</option>
              </select>
            </label>
          </div>
        </div>

        <div style={{ marginTop: '1.5rem' }}>
          <label style={{ fontWeight: 'bold' }}>Preview:</label>
          <div style={getPreviewStyle()}>
            {previewText}
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
          <button type="submit">
            Save Style
          </button>
          <button
            type="button"
            onClick={() => setEditingStyle({
              id: crypto.randomUUID(),
              name: '',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              color: '#ffffff',
              backgroundColor: 'transparent',
              fontWeight: 'normal',
              fontStyle: 'normal'
            })}
          >
            Reset
          </button>
        </div>
      </form>

      <div style={{ marginTop: '2rem' }}>
        <h3>Existing Styles</h3>
        {existingStyles.length === 0 ? (
          <p style={{ fontStyle: 'italic', color: '#aaa' }}>
            No custom styles yet. Create one above!
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {existingStyles.map((style) => (
              <li
                key={style.id}
                style={{
                  padding: '0.75rem',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  marginBottom: '0.5rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>{style.name}</strong>
                    <div
                      style={{
                        ...{
                          fontFamily: style.fontFamily !== 'inherit' ? style.fontFamily : undefined,
                          fontSize: style.fontSize !== 'inherit' ? style.fontSize : undefined,
                          color: style.color,
                          backgroundColor: style.backgroundColor !== 'transparent' ? style.backgroundColor : undefined,
                          fontWeight: style.fontWeight,
                          fontStyle: style.fontStyle,
                          padding: '0.25rem',
                          borderRadius: '2px',
                          marginTop: '0.5rem',
                          display: 'inline-block'
                        }
                      }}
                    >
                      Sample text in this style
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setEditingStyle(style)}
                      style={{ fontSize: '0.85rem' }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete style "${style.name}"?`)) {
                          // Handle delete - would need to be passed as prop
                        }
                      }}
                      style={{ fontSize: '0.85rem' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#1a1a1a', borderRadius: '4px' }}>
        <h4>Quick Tips:</h4>
        <ul style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
          <li>Create styles for character dialogue, internal thoughts, or system messages</li>
          <li>Use monospace fonts for technical or system text</li>
          <li>Keep colors readable - high contrast is important</li>
          <li>Test your styles with different text lengths</li>
          <li>Styles are saved per-project</li>
        </ul>
      </div>
    </div>
  );
}

export default StyleManager;