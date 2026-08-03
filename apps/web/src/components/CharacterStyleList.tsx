import {CharacterStyleEditor} from './CharacterStyleEditor';
import type {CharacterStyle} from '../entityTypes';
import styles from '../assets/components/CharacterStyleList.module.css';

interface CharacterStyleListProps {
  styles: CharacterStyle[];
  onUpdate: (
    styleId: string,
    updates: Partial<CharacterStyle['styles']>
  ) => void;
  onDelete: (styleId: string) => void;
  expandedStyleId?: string | null;
  onToggleExpand?: (styleId: string | null) => void;
}

export function CharacterStyleList({
  styles: characterStyles,
  onUpdate,
  onDelete,
  expandedStyleId,
  onToggleExpand
}: CharacterStyleListProps) {
  return (
    <div>
      <h2 className={styles.heading}>Character Styles</h2>

      {characterStyles.length === 0 ? (
        <p className={styles.emptyState}>No character styles defined yet.</p>
      ) : (
        <ul className={styles.list}>
          {characterStyles.map((style) => (
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
