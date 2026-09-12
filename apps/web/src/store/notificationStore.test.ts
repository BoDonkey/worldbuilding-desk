import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
  announceStatus,
  DEFAULT_TOAST_DURATION_MS,
  pushAppToast,
  resetNotificationsForTests,
  useNotificationStore
} from './notificationStore';

describe('notificationStore', () => {
  beforeEach(() => {
    resetNotificationsForTests();
  });

  it('pushes success toasts with the default duration and error toasts as sticky', () => {
    const successId = pushAppToast({message: 'Scene saved.'});
    const errorId = pushAppToast({tone: 'error', message: 'Unable to save scene.'});
    const {toasts} = useNotificationStore.getState();
    expect(toasts.map((toast) => toast.id)).toEqual([successId, errorId]);
    expect(toasts[0]).toMatchObject({tone: 'success', durationMs: DEFAULT_TOAST_DURATION_MS});
    expect(toasts[1]).toMatchObject({tone: 'error', durationMs: null});
  });

  it('replaces a repeated identical message instead of stacking it', () => {
    pushAppToast({message: 'Scene saved.'});
    pushAppToast({message: 'Scene saved.'});
    pushAppToast({message: 'Created a new scene.'});
    expect(useNotificationStore.getState().toasts.map((toast) => toast.message)).toEqual([
      'Scene saved.',
      'Created a new scene.'
    ]);
  });

  it('keeps at most four toasts visible', () => {
    for (let index = 0; index < 6; index += 1) pushAppToast({message: `Message ${index}`});
    expect(useNotificationStore.getState().toasts.map((toast) => toast.message)).toEqual([
      'Message 2',
      'Message 3',
      'Message 4',
      'Message 5'
    ]);
  });

  it('runs the dismiss callback when a toast is dismissed', () => {
    const onDismiss = vi.fn();
    const id = pushAppToast({tone: 'info', message: 'Review this match.', durationMs: null, onDismiss});
    useNotificationStore.getState().dismissToast(id);
    useNotificationStore.getState().dismissToast(id);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(useNotificationStore.getState().toasts).toEqual([]);
  });

  it('records status announcements with increasing ids and ignores blank text', () => {
    announceStatus('Scene autosaved.');
    const first = useNotificationStore.getState().announcement;
    announceStatus('   ');
    expect(useNotificationStore.getState().announcement).toBe(first);
    announceStatus('Scene autosaved.', {assertive: true});
    const second = useNotificationStore.getState().announcement;
    expect(second?.id).toBeGreaterThan(first?.id ?? 0);
    expect(second).toMatchObject({message: 'Scene autosaved.', assertive: true});
  });
});
