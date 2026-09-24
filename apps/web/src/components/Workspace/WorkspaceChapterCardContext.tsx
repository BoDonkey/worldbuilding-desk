import {useState} from 'react';
import type {ChapterCard} from '../../entityTypes';
import styles from '../../styles/WorkspaceRoute.module.css';

interface WorkspaceChapterCardContextProps {
  cards: ChapterCard[];
  onOpenCard: (cardId: string) => void;
  onOpenCorkboard: (cardId: string) => void;
}

const cardName = (card: ChapterCard) => card.title.trim() || 'Untitled chapter';

export function WorkspaceChapterCardContext({
  cards,
  onOpenCard,
  onOpenCorkboard
}: WorkspaceChapterCardContextProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (cards.length === 0) return null;

  if (cards.length === 1) {
    const card = cards[0];
    const name = cardName(card);
    return (
      <span className={styles.chapterCardContext} aria-label='Chapter card context'>
        <span>Chapter card: <em>{name}</em></span>
        <button type='button' onClick={() => onOpenCard(card.id)}>Open card</button>
        <button type='button' onClick={() => onOpenCorkboard(card.id)}>Corkboard</button>
      </span>
    );
  }

  return (
    <span className={styles.chapterCardContext} aria-label='Chapter card context'>
      <span>{cards.length} chapter cards</span>
      <button
        type='button'
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((current) => !current)}
      >
        {isExpanded ? 'Hide cards' : 'Show cards'}
      </button>
      <button type='button' onClick={() => onOpenCorkboard(cards[0].id)}>Corkboard</button>
      {isExpanded && (
        <span className={styles.chapterCardContextChips} aria-label='Linked chapter cards'>
          {cards.map((card) => (
            <button
              key={card.id}
              type='button'
              className={styles.chapterCardContextChip}
              aria-label={`Open card ${cardName(card)}`}
              onClick={() => onOpenCard(card.id)}
            >
              {cardName(card)}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
