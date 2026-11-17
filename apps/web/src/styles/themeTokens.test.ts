import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';

const readStylesheets = (root: string, label: string) =>
  readdirSync(root, {recursive: true, encoding: 'utf8'})
    .filter((file) => file.endsWith('.css'))
    .map((file) => ({
      file: `${label}/${file}`,
      css: readFileSync(join(root, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    }));

const appStylesheets = readStylesheets(join(__dirname, '..'), 'apps/web/src');
// The rules wizard's stylesheet ships in its own package but renders inside the app, on the app's
// theme tokens (Slice 3.54).
const rulesUiStylesheets = readStylesheets(
  join(__dirname, '../../../../packages/rules-ui/src'),
  'packages/rules-ui/src'
);
const stylesheets = [...appStylesheets, ...rulesUiStylesheets];

describe('stylesheet custom properties', () => {
  it('defines every referenced variable, including references with fallbacks', () => {
    // Scan all CSS homes, including colocated modules and unused stylesheets.
    // Fallbacks must not hide misspelled theme tokens.
    const definitions = new Set(stylesheets.flatMap(({css}) =>
      [...css.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1])
    ));
    const unresolved = stylesheets.flatMap(({file, css}) =>
      [...css.matchAll(/var\(\s*(--[\w-]+)/g)]
        .filter((match) => !definitions.has(match[1]))
        .map((match) => `${file}: ${match[1]}`)
    );
    expect(appStylesheets.length).toBeGreaterThan(40);
    expect(rulesUiStylesheets.length).toBeGreaterThan(0);
    expect(unresolved).toEqual([]);
  });

  it('keeps the rules wizard on theme tokens, with no hardcoded colours', () => {
    const hardcoded = rulesUiStylesheets.flatMap(({file, css}) =>
      [...css.matchAll(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(|\b(?:white|black)\b/g)]
        .map((match) => `${file}: ${match[0]}`)
    );
    expect(hardcoded).toEqual([]);
  });
});
