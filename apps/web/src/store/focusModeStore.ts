import {create} from 'zustand';

/**
 * Whether Workspace focus mode is on (slice 4.91). Session state: the
 * Workspace sets it from the "Focus mode when the Workspace opens" setting
 * each time it mounts, and turns it off when it unmounts.
 */
interface FocusModeState {
  isOn: boolean;
  setOn: (on: boolean) => void;
}

export const useFocusModeStore = create<FocusModeState>((set) => ({
  isOn: false,
  setOn: (isOn) => set({isOn})
}));
