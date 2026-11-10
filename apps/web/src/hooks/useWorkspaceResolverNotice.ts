import {useCallback, useEffect, useRef} from 'react';
import type {Dispatch, SetStateAction} from 'react';
import type {NavigateFunction} from 'react-router';
import {useNotificationStore} from '../store/notificationStore';
import type {ResolverNotice} from './useUnknownEntityResolution';

interface UseWorkspaceResolverNoticeParams {
  resolverNotice: ResolverNotice | null;
  setResolverNotice: Dispatch<SetStateAction<ResolverNotice | null>>;
  navigate: NavigateFunction;
}

/**
 * The toast shown after a review item is resolved: its button opens the
 * World Bible record or Character Sheet the item went to, and it closes
 * itself after a few seconds (longer for a character match to review).
 */
export function useWorkspaceResolverNotice({
  resolverNotice,
  setResolverNotice,
  navigate
}: UseWorkspaceResolverNoticeParams) {
  const pushToast = useNotificationStore((state) => state.pushToast);

  const openResolverNoticeDestination = useCallback(() => {
    if (!resolverNotice) {
      return;
    }
    if (resolverNotice.destination === 'character-sheet-create') {
      navigate('/sheets', {
        state: {
          prefillCharacterId: resolverNotice.targetId,
          autoCreateSheetForCharacterId: resolverNotice.targetId
        }
      });
      return;
    }
    if (resolverNotice.destination === 'character-sheets') {
      navigate('/sheets', {
        state: {
          prefillCharacterId: resolverNotice.targetId
        }
      });
      return;
    }
    if (resolverNotice.destination === 'characters') {
      navigate('/world-bible', {
        state: {focusCategorySlug: 'characters'}
      });
      return;
    }
    navigate('/world-bible', {
      state: resolverNotice.targetId
        ? {
            focusEntityId: resolverNotice.targetId,
            focus:
              resolverNotice.primaryLabel === 'Review Character Match'
                ? 'aliases'
                : 'general',
            handoffKind:
              resolverNotice.primaryLabel === 'Review Character Match'
                ? 'character-canonicalization'
                : undefined,
            handoffSourceName:
              resolverNotice.primaryLabel === 'Review Character Match'
                ? resolverNotice.sourceName
                : undefined,
            handoffMatchEntityId: resolverNotice.matchEntityId
          }
        : undefined
    });
  }, [navigate, resolverNotice]);
  const resolverNoticePrimaryLabel =
    resolverNotice?.primaryLabel ??
    (resolverNotice?.destination === 'character-sheet-create'
      ? 'Create Character Sheet'
      : resolverNotice?.destination === 'character-sheets'
      ? 'Open Character Sheet'
      : resolverNotice?.destination === 'characters'
        ? 'Open World Bible Characters'
        : 'View in World Bible');

  const openResolverNoticeDestinationRef = useRef(openResolverNoticeDestination);
  useEffect(() => {
    openResolverNoticeDestinationRef.current = openResolverNoticeDestination;
  }, [openResolverNoticeDestination]);
  useEffect(() => {
    if (!resolverNotice) {
      return;
    }
    let dismissedByUser = false;
    const toastId = pushToast({
      tone: 'info',
      message: resolverNotice.message,
      durationMs: null,
      action: {
        label: resolverNoticePrimaryLabel,
        onSelect: () => openResolverNoticeDestinationRef.current()
      },
      onDismiss: () => {
        dismissedByUser = true;
        setResolverNotice(null);
      }
    });
    return () => {
      if (!dismissedByUser) {
        useNotificationStore.setState((state) => ({
          toasts: state.toasts.filter((toast) => toast.id !== toastId)
        }));
      }
    };
  }, [resolverNotice, resolverNoticePrimaryLabel, pushToast, setResolverNotice]);
  useEffect(() => {
    if (!resolverNotice) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setResolverNotice((current) => (current === resolverNotice ? null : current));
    }, resolverNotice.primaryLabel === 'Review Character Match' ? 7200 : 4200);
    return () => window.clearTimeout(timeoutId);
  }, [resolverNotice, setResolverNotice]);
}
