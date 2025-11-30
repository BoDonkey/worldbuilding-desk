import { CharacterStyleEditor } from './CharacterStyleEditor';
import type { CharacterStyle } from '../entityTypes';

interface CharacterStyleListProps {
  styles: CharacterStyle[];
  onUpdate: (styleId: string, updates: Partial<CharacterStyle['styles']>) => void;
  onDelete: (styleId: string) => void;
  onAdd?: () => void;
  showAddButton?: boolean;
}

export function CharacterStyleList({ 
  styles, 
  onUpdate, 
  onDelete,
  onAdd,
  showAddButton = false
}: CharacterStyleListProps) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Character Styles</h2>
        {showAddButton && onAdd && (
          <button onClick={onAdd}>+ Add Style</button>
        )}
      </div>

      {styles.length === 0 ? (
        <p style={{ fontStyle: 'italic', color: '#888' }}>
          No character styles defined yet.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {styles.map((style) => (
            <CharacterStyleEditor
              key={style.id}
              style={style}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </div>
  );
}