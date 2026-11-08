import type {LoreDocument, WorldEntity} from '../../entityTypes';
import shared from './worldBibleShared.module.css';

interface WorldBibleLinkedSourceNoteProps {
  entity: WorldEntity;
  linkedDocument: LoreDocument | null;
  isOpening: boolean;
  compactCopy?: boolean;
  onOpen: (entity: WorldEntity) => void;
}

export const WorldBibleLinkedSourceNote = ({
  entity,
  linkedDocument,
  isOpening,
  compactCopy = false,
  onOpen
}: WorldBibleLinkedSourceNoteProps) => (
  <section className={shared.canonSection} aria-label='Linked Source Note'>
    <div className={shared.canonSectionHeader}>
      <div>
        <strong>Linked Source Note</strong>
        <span>
          {compactCopy
            ? 'Keep longform background and exploratory material beside structured canon.'
            : 'Keep longform source notes, history, timelines, and exploratory background in Source Notes while this record stays structured canon.'}
        </span>
      </div>
      <button type='button' onClick={() => onOpen(entity)} disabled={isOpening}>
        {isOpening
          ? 'Creating...'
          : linkedDocument
            ? 'Open linked document'
            : 'Create linked document'}
      </button>
    </div>
    <div className={shared.reviewHint}>
      {linkedDocument ? `Linked to "${linkedDocument.title}".` : 'No linked Source Note yet.'}
    </div>
  </section>
);
