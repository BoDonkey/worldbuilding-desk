import { CharacterStyleEditor } from './CharacterStyleEditor';
import type { CharacterStyle } from '../entityTypes';

interface CharacterStyleListProps {
  styles: CharacterStyle[];
  onUpdate: (styleId: string, updates: Partial<CharacterStyle['styles']>) => void;
  onDelete: (styleId: string) => void;
  expandedStyleId?: string | null;
  onToggleExpand?: (styleId: string | null) => void;
}

export function CharacterStyleList({ 
  styles, 
  onUpdate, 
  onDelete,
  expandedStyleId,
  onToggleExpand
}: CharacterStyleListProps) {
  return (
    <div>
      <h2>Character Styles</h2>

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
              expanded={expandedStyleId === style.id}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </ul>
      )}
    </div>
  );
}