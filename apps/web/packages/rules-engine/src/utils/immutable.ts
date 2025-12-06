import { produce } from 'immer';

/**
 * Utility for immutable state updates
 * Uses immer for clean mutations that return new objects
 */

export function updateState<T>(state: T, updater: (draft: T) => void): T {
  return produce(state, updater);
}

// Helper to safely get nested property value
export function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Helper to safely set nested property value (returns new object)
export function setNestedValue(obj: any, path: string, value: any): any {
  return produce(obj, (draft: any) => {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (current[key] === undefined) {
        current[key] = {};
      }
      return current[key];
    }, draft);
    target[lastKey] = value;
  });
}