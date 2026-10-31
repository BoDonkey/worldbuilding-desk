import {useCallback, useEffect, useState} from 'react';

export type AppUpdateSnapshot = ElectronUpdateSnapshot;

const getUpdatesApi = (): ElectronUpdatesAPI | undefined =>
  typeof window === 'undefined' ? undefined : window.electronAPI?.updates;

/**
 * Desktop app update state from the main process (Slice 5.1). Null in the
 * browser build and in desktop builds without the update bridge. Every action
 * is the author's: this hook never checks or downloads on its own.
 */
export function useAppUpdates() {
  const [snapshot, setSnapshot] = useState<AppUpdateSnapshot | null>(null);

  useEffect(() => {
    const api = getUpdatesApi();
    if (!api) return;
    let active = true;
    const unsubscribe = api.onChange((next) => {
      if (active) setSnapshot(next);
    });
    api
      .get()
      .then((next) => {
        if (active) setSnapshot(next);
      })
      .catch((error) => console.warn('Unable to read app update state.', error));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const run = useCallback(async (action: (api: ElectronUpdatesAPI) => Promise<unknown>) => {
    const api = getUpdatesApi();
    if (!api) return;
    try {
      const result = await action(api);
      if (result && typeof result === 'object' && 'status' in result) {
        setSnapshot(result as AppUpdateSnapshot);
      }
    } catch (error) {
      console.warn('App update action failed.', error);
    }
  }, []);

  return {
    snapshot,
    check: useCallback(() => run((api) => api.check()), [run]),
    download: useCallback(() => run((api) => api.download()), [run]),
    install: useCallback(() => run((api) => api.install()), [run]),
    openReleasePage: useCallback(() => run((api) => api.openReleasePage()), [run]),
    setCheckAutomatically: useCallback(
      (value: boolean) => run((api) => api.setCheckAutomatically(value)),
      [run]
    )
  };
}
