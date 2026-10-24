import {useCallback, useEffect, useState} from 'react';
import {readBooleanPreference, writeBooleanPreference} from '../utils/browserPreferences';

/**
 * A remembered collapsed/expanded state. `key` null (no project open) means
 * expanded and not remembered. `toggle` stores the choice; `setCollapsed`
 * changes only the current view, as when a deep link opens a collapsed rail.
 */
export function useCollapsedPreference(key: string | null) {
  const [collapsed, setCollapsed] = useState(() => (key ? readBooleanPreference(key) : false));

  useEffect(() => {
    setCollapsed(key ? readBooleanPreference(key) : false);
  }, [key]);

  const toggle = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      if (key) writeBooleanPreference(key, next);
      return next;
    });
  }, [key]);

  return {collapsed, setCollapsed, toggle};
}
