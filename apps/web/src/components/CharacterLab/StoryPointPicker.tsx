import type {WritingDocument} from '../../entityTypes';
import type {CharacterVoicePosition} from '../../services/characterLab';
import type {CharacterSnapshotMoment} from '../../services/state/characterSnapshot';
import styles from '../../styles/CharacterLab.module.css';

const MOMENT_LABELS: Record<CharacterSnapshotMoment, string> = {
  opening: 'Opening',
  cursor: 'At the cursor',
  ending: 'End of scene'
};

/**
 * Chooses where in the manuscript the character lab grounds characters. The
 * cursor moment exists only for the scene the lab was opened at the cursor of.
 */
export function StoryPointPicker({
  documents,
  position,
  defaultPosition,
  onChange
}: {
  documents: WritingDocument[];
  position: CharacterVoicePosition;
  defaultPosition: CharacterVoicePosition;
  onChange: (position: CharacterVoicePosition) => void;
}) {
  const cursorScene =
    defaultPosition.kind === 'scene' && defaultPosition.moment === 'cursor' ? defaultPosition : null;
  const momentOptions: CharacterSnapshotMoment[] =
    cursorScene && position.kind === 'scene' && position.sceneId === cursorScene.sceneId
      ? ['opening', 'cursor', 'ending']
      : ['opening', 'ending'];

  const changeScene = (value: string) => {
    if (value === 'latest') {
      onChange({kind: 'latest'});
    } else if (cursorScene && value === cursorScene.sceneId) {
      onChange(cursorScene);
    } else {
      onChange({kind: 'scene', sceneId: value, moment: 'ending'});
    }
  };

  const changeMoment = (moment: CharacterSnapshotMoment) => {
    if (position.kind !== 'scene') return;
    onChange(
      moment === 'cursor' && cursorScene
        ? cursorScene
        : {kind: 'scene', sceneId: position.sceneId, moment}
    );
  };

  return (
    <>
      <label className={styles.field}>
        <span>Story point</span>
        <select
          value={position.kind === 'scene' ? position.sceneId : 'latest'}
          onChange={(event) => changeScene(event.target.value)}
        >
          <option value='latest'>Latest, after every accepted change</option>
          {documents.map((document) => (
            <option key={document.id} value={document.id}>
              {document.title || 'Untitled scene'}
            </option>
          ))}
        </select>
      </label>
      {position.kind === 'scene' && (
        <label className={styles.field}>
          <span>Moment</span>
          <select
            value={position.moment}
            onChange={(event) => changeMoment(event.target.value as CharacterSnapshotMoment)}
          >
            {momentOptions.map((moment) => (
              <option key={moment} value={moment}>{MOMENT_LABELS[moment]}</option>
            ))}
          </select>
        </label>
      )}
    </>
  );
}
