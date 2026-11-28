import {useId, useRef, useState} from 'react';
import type {EntityImage, WorldEntity} from '../../../entityTypes';
import {useConfirmDialog} from '../../../hooks/useConfirmDialog';
import {useEscapeToClose} from '../../../hooks/useEscapeToClose';
import {useFocusTrap} from '../../../hooks/useFocusTrap';
import {useRecordImages} from '../../../hooks/useRecordImages';
import {ENTITY_IMAGE_TYPES, totalImageBytes} from '../../../services/worldBible/entityImages';
import {formatImageBytes} from '../../../utils/imageFiles';
import shared from '../worldBibleShared.module.css';
import styles from './RecordImagesPanel.module.css';

/**
 * Images on an open World Bible record (slice 4.100): add one or more, choose
 * the portrait, view one full size, remove one. Display only; AI surfaces do
 * not see images.
 */
export function RecordImagesPanel({
  entity,
  onEntityChange
}: {
  entity: WorldEntity;
  onEntityChange: (entity: WorldEntity) => void;
}) {
  const record = useRecordImages({entity, onEntityChange});
  const {requestConfirm, confirmDialog} = useConfirmDialog();
  const [viewing, setViewing] = useState<EntityImage | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const headingId = useId();
  const total = totalImageBytes(record.images);

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <div className={styles.header}>
        <h3 id={headingId}>Images</h3>
        <button type='button' onClick={() => inputRef.current?.click()} disabled={record.isWorking}>
          Add images
        </button>
        <input
          ref={inputRef}
          type='file'
          multiple
          accept={ENTITY_IMAGE_TYPES.join(',')}
          className={styles.fileInput}
          aria-label={`Add images to ${entity.name}`}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = '';
            void record.addFiles(files);
          }}
        />
      </div>
      <p className={shared.reviewHint}>
        {record.images.length === 0
          ? 'Portraits, sketches, or reference pictures. The first image becomes the portrait. Images stay on this computer and in backups; AI features never see them.'
          : `${record.images.length} image${record.images.length === 1 ? '' : 's'}, ${formatImageBytes(total)} in all. Backups carry them at full size.`}
      </p>
      {record.message && <p role={record.message.tone}>{record.message.text}</p>}
      {record.images.length > 0 && (
        <ul className={styles.grid} aria-label={`Images of ${entity.name}`}>
          {record.images.map((image) => {
            const isPortrait = entity.portrait?.imageId === image.id;
            const label = image.fileName ?? 'Image';
            return (
              <li key={image.id} className={styles.item}>
                <button
                  type='button'
                  className={styles.thumbButton}
                  onClick={() => setViewing(image)}
                  aria-label={`View ${label} full size`}
                >
                  <img src={image.dataUrl} alt='' className={styles.thumb} />
                </button>
                <span className={styles.name}>{label}</span>
                <span className={styles.meta}>
                  {image.width} × {image.height} · {formatImageBytes(image.byteLength)}
                </span>
                <div className={styles.actions}>
                  {isPortrait ? (
                    <span className={styles.portraitBadge}>Portrait</span>
                  ) : (
                    <button
                      type='button'
                      onClick={() => void record.choosePortrait(image)}
                      disabled={record.isWorking}
                    >
                      Use as portrait
                    </button>
                  )}
                  <button
                    type='button'
                    disabled={record.isWorking}
                    onClick={() =>
                      requestConfirm({
                        title: `Remove ${label}?`,
                        message: `The image is deleted from ${entity.name}. Backups made before now still have it.`,
                        confirmLabel: 'Remove image',
                        variant: 'danger',
                        onConfirm: () => record.removeImage(image)
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {viewing && <ImageViewer image={viewing} recordName={entity.name} onClose={() => setViewing(null)} />}
      {confirmDialog}
    </section>
  );
}

function ImageViewer({image, recordName, onClose}: {image: EntityImage; recordName: string; onClose: () => void}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  useEscapeToClose(onClose, true);
  useFocusTrap(dialogRef, true);
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        className={styles.viewer}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.viewerBar}>
          <h3 id={titleId}>{image.fileName ?? `Image of ${recordName}`}</h3>
          <button type='button' onClick={onClose}>Close</button>
        </div>
        <img src={image.dataUrl} alt={`${recordName}: ${image.fileName ?? 'image'}`} className={styles.full} />
      </div>
    </div>
  );
}
