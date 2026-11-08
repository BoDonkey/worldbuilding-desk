import type {useWorldBibleAuthoringAssistant} from '../../../hooks/useWorldBibleAuthoringAssistant';
import type {useWorldBibleEntityActions} from '../../../hooks/useWorldBibleEntityActions';
import type {useWorldBibleRecordResolution} from '../../../hooks/useWorldBibleRecordResolution';
import type {useWorldBibleSelectedEntity} from '../../../hooks/useWorldBibleSelectedEntity';
import type {WorldEntity} from '../../../entityTypes';
import type {RecordReviewFocus} from './useWorldBibleRecordDraft';

/** Character records get character wording and actions; every other category shares one form. */
export type RecordVariant = 'character' | 'record';

export type RecordAuthoring = ReturnType<typeof useWorldBibleAuthoringAssistant>;
export type RecordEntityActions = ReturnType<typeof useWorldBibleEntityActions>;
export type RecordResolution = ReturnType<typeof useWorldBibleRecordResolution>;
export type RecordSelection = ReturnType<typeof useWorldBibleSelectedEntity>;

export type OpenRecord = (entity: WorldEntity, focus?: RecordReviewFocus) => void;

/** The route's inline feedback; record sections report save results through it. */
export interface RecordFeedback {
  tone: 'success' | 'error';
  message: string;
}
export type SetRecordFeedback = (feedback: RecordFeedback | null) => void;
