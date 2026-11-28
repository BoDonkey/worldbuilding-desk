import {useCallback, useEffect, useState} from 'react';
import type {EntityImage, WorldEntity} from '../entityTypes';
import {
  deleteEntityImage,
  getEntityImages,
  saveEntity,
  saveEntityImages
} from '../services/storage';
import {RECORDS_CHANGED} from '../services/recordEvents';
import {describeError} from '../services/errors';
import {portraitFor, readEntityImageFile} from '../services/worldBible/entityImages';

export type RecordImagesMessage = {tone: 'status' | 'alert'; text: string} | null;

/**
 * A World Bible record's images (slice 4.100): add, remove, and choose the
 * portrait. The first image added becomes the portrait when there is none.
 * The portrait is saved on the record directly; the record form keeps it.
 */
export function useRecordImages({
  entity,
  onEntityChange
}: {
  entity: WorldEntity;
  onEntityChange: (entity: WorldEntity) => void;
}) {
  const {projectId, id: entityId} = entity;
  const [images, setImages] = useState<EntityImage[]>([]);
  const [isLoaded, setLoaded] = useState(false);
  const [isWorking, setWorking] = useState(false);
  const [message, setMessage] = useState<RecordImagesMessage>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getEntityImages(projectId, entityId)
        .then((next) => {
          if (cancelled) return;
          setImages(next);
          setLoaded(true);
        })
        .catch((error) => {
          if (!cancelled) setMessage({tone: 'alert', text: describeError(error, 'Unable to load images.')});
        });
    };
    load();
    window.addEventListener(RECORDS_CHANGED.entityImages, load);
    return () => {
      cancelled = true;
      window.removeEventListener(RECORDS_CHANGED.entityImages, load);
    };
  }, [projectId, entityId]);

  const savePortrait = useCallback(
    async (image: EntityImage | null) => {
      const next: WorldEntity = {...entity, updatedAt: Date.now()};
      if (image) next.portrait = await portraitFor(image);
      else delete next.portrait;
      await saveEntity(next);
      onEntityChange(next);
    },
    [entity, onEntityChange]
  );

  const addFiles = useCallback(
    async (files: readonly File[]) => {
      if (files.length === 0) return;
      setWorking(true);
      setMessage(null);
      try {
        const now = Date.now();
        const results = await Promise.all(
          files.map((file, index) => readEntityImageFile(file, {projectId, entityId}, now + index))
        );
        const added = results.flatMap((result) => ('image' in result ? [result.image] : []));
        const problems = results.flatMap((result) => ('error' in result ? [result.error] : []));
        await saveEntityImages(added);
        if (added.length > 0 && !entity.portrait) await savePortrait(added[0]);
        const addedText = added.length > 0 ? `Added ${added.length} image${added.length === 1 ? '' : 's'}.` : '';
        setMessage(
          problems.length > 0
            ? {tone: 'alert', text: [addedText, ...problems].filter(Boolean).join(' ')}
            : {tone: 'status', text: addedText}
        );
      } catch (error) {
        setMessage({tone: 'alert', text: describeError(error, 'The images could not be saved.')});
      } finally {
        setWorking(false);
      }
    },
    [entity.portrait, entityId, projectId, savePortrait]
  );

  const removeImage = useCallback(
    async (image: EntityImage) => {
      setWorking(true);
      setMessage(null);
      try {
        await deleteEntityImage(image.id);
        if (entity.portrait?.imageId === image.id) {
          const next = images.find((candidate) => candidate.id !== image.id) ?? null;
          await savePortrait(next);
        }
        setMessage({tone: 'status', text: `Removed ${image.fileName ?? 'the image'}.`});
      } catch (error) {
        setMessage({tone: 'alert', text: describeError(error, 'The image could not be removed.')});
      } finally {
        setWorking(false);
      }
    },
    [entity.portrait, images, savePortrait]
  );

  const choosePortrait = useCallback(
    async (image: EntityImage) => {
      setWorking(true);
      setMessage(null);
      try {
        await savePortrait(image);
        setMessage({tone: 'status', text: `${image.fileName ?? 'This image'} is now the portrait.`});
      } catch (error) {
        setMessage({tone: 'alert', text: describeError(error, 'The portrait could not be saved.')});
      } finally {
        setWorking(false);
      }
    },
    [savePortrait]
  );

  return {images, isLoaded, isWorking, message, addFiles, removeImage, choosePortrait};
}
