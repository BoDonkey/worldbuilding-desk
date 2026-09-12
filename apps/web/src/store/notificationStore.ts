import {create} from 'zustand';

/**
 * App-shell notifications (roadmap slice 5.12).
 *
 * Two channels:
 * - Toasts: transient confirmations rendered in one fixed viewport by the app
 *   shell, so every route posts them to the same place. Errors that belong
 *   next to the control that caused them stay in `InlineAlert`; only
 *   Workspace, whose feedback was already a toast, routes errors here too.
 * - Status announcements: text for a single shared screen-reader live region
 *   (polite by default, assertive on request) so autosave, review, extraction,
 *   migration, and AI streaming are announced without any visible chrome.
 */

export type ToastTone = 'success' | 'info' | 'error';

export interface ToastAction {
  label: string;
  onSelect: () => void;
}

export interface AppToast {
  id: string;
  tone: ToastTone;
  message: string;
  /** Milliseconds before auto-dismiss; `null` keeps the toast until dismissed. */
  durationMs: number | null;
  action?: ToastAction;
  onDismiss?: () => void;
}

export interface PushToastInput {
  tone?: ToastTone;
  message: string;
  durationMs?: number | null;
  action?: ToastAction;
  onDismiss?: () => void;
}

export interface StatusAnnouncement {
  id: number;
  message: string;
  assertive: boolean;
}

interface NotificationState {
  toasts: AppToast[];
  announcement: StatusAnnouncement | null;
  pushToast: (input: PushToastInput) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
  announce: (message: string, options?: {assertive?: boolean}) => void;
}

export const DEFAULT_TOAST_DURATION_MS = 4000;
const MAX_VISIBLE_TOASTS = 4;

let nextToastId = 0;
let nextAnnouncementId = 0;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  toasts: [],
  announcement: null,
  pushToast: (input) => {
    const tone = input.tone ?? 'success';
    const durationMs =
      input.durationMs === undefined ? (tone === 'error' ? null : DEFAULT_TOAST_DURATION_MS) : input.durationMs;
    nextToastId += 1;
    const id = `toast-${nextToastId}`;
    const toast: AppToast = {
      id,
      tone,
      message: input.message,
      durationMs,
      action: input.action,
      onDismiss: input.onDismiss
    };
    set((state) => {
      // A repeated identical message replaces the earlier copy so rapid
      // autosave or review confirmations do not stack.
      const remaining = state.toasts.filter(
        (existing) => !(existing.message === toast.message && existing.tone === toast.tone && !existing.action)
      );
      return {toasts: [...remaining, toast].slice(-MAX_VISIBLE_TOASTS)};
    });
    return id;
  },
  dismissToast: (id) => {
    const toast = get().toasts.find((entry) => entry.id === id);
    if (!toast) return;
    set((state) => ({toasts: state.toasts.filter((entry) => entry.id !== id)}));
    toast.onDismiss?.();
  },
  clearToasts: () => set({toasts: []}),
  announce: (message, options) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    nextAnnouncementId += 1;
    set({announcement: {id: nextAnnouncementId, message: trimmed, assertive: Boolean(options?.assertive)}});
  }
}));

/** Non-hook entry points for services and other code outside React. */
export function pushAppToast(input: PushToastInput): string {
  return useNotificationStore.getState().pushToast(input);
}

export function announceStatus(message: string, options?: {assertive?: boolean}): void {
  useNotificationStore.getState().announce(message, options);
}

/** Test hook: drops all toasts and the current announcement. */
export function resetNotificationsForTests(): void {
  useNotificationStore.setState({toasts: [], announcement: null});
}
