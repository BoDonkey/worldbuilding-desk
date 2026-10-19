import type {Dispatch, SetStateAction} from 'react';
import type {Project} from '../../entityTypes';

export type SetFormValue<T> = Dispatch<SetStateAction<T>>;
export type CompendiumFeedback = {tone: 'success' | 'error'; message: string} | null;

export interface CompendiumFormContext {
  activeProject: Project | null;
  setFeedback: SetFormValue<CompendiumFeedback>;
}
