import {useState} from 'react';
import {useCharacterLabData} from '../../hooks/useCharacterLabData';
import {characterCardFileName} from '../../services/characterCards/characterCardExport';
import {describeError} from '../../services/errors';
import {triggerJsonDownload} from '../../utils/downloadJson';
import styles from '../../assets/components/WorldBibleRoute.module.css';

/**
 * Downloads the character as a Tavern Character Card V2 JSON file (Slice 4.70),
 * for SillyTavern and card libraries. There are no character portraits, so no
 * PNG card is written.
 */
export function CharacterCardExportButton({projectId, entityId}: {projectId: string; entityId: string}) {
  const lab = useCharacterLabData(projectId, true);
  const [message, setMessage] = useState<{tone: 'status' | 'alert'; text: string} | null>(null);

  const exportCard = () => {
    try {
      const card = lab.buildCardExport(entityId);
      triggerJsonDownload(characterCardFileName(card.data.name), card);
      setMessage({tone: 'status', text: `Saved ${characterCardFileName(card.data.name)}.`});
    } catch (error) {
      setMessage({tone: 'alert', text: describeError(error, 'This character could not be exported as a card.')});
    }
  };

  return (
    <div>
      <button type='button' onClick={exportCard} disabled={!lab.isLoaded}>
        Export character card
      </button>
      <p className={styles.reviewHint}>
        A SillyTavern character card (JSON) with this character&apos;s fields, aliases, and accepted facts; its
        Notes go in the card&apos;s creator notes. Pending proposals, Source Notes, and story state are left out.
      </p>
      {message && <p role={message.tone}>{message.text}</p>}
    </div>
  );
}
