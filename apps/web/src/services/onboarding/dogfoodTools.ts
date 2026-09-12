/**
 * Dev/test-only affordances for the trust-dogfood run (roadmap slice 1.1).
 * Never shown in a packaged build unless the author opts in from the
 * browser console with `localStorage.setItem('wbd:dogfood-tools', '1')`.
 */
export const DOGFOOD_TOOLS_STORAGE_KEY = 'wbd:dogfood-tools';

export function isDogfoodToolsEnabled(): boolean {
  try {
    if (localStorage.getItem(DOGFOOD_TOOLS_STORAGE_KEY) === '1') return true;
  } catch {
    // Storage unavailable: fall through to the build-time flag.
  }
  return Boolean(import.meta.env.DEV);
}
