import {afterEach, describe, expect, it} from 'vitest';
import {hasCheckedFirstRun} from './firstRun';

// .test.tsx so this runs under vitest's jsdom project (see vitest.config.ts), which has
// real browser localStorage — unlike the plain-node project used by most service tests.
afterEach(() => {
  localStorage.clear();
  delete (window as {Cypress?: unknown}).Cypress;
});

describe('hasCheckedFirstRun', () => {
  it('is false before the check has ever run', () => {
    expect(hasCheckedFirstRun()).toBe(false);
  });

  it('is true once the localStorage flag is set', () => {
    localStorage.setItem('wbd:first-run-checked', 'true');
    expect(hasCheckedFirstRun()).toBe(true);
  });

  it('is always true under Cypress, regardless of the stored flag, so e2e specs never race an unrequested first-run project', () => {
    (window as {Cypress?: unknown}).Cypress = {};
    expect(hasCheckedFirstRun()).toBe(true);
  });
});
