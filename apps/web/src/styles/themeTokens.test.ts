import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';

const sourceRoot = join(__dirname, '..');
const stylesheets = readdirSync(sourceRoot, {recursive: true, encoding: 'utf8'})
  .filter((file) => file.endsWith('.css'))
  .map((file) => ({
    file,
    css: readFileSync(join(sourceRoot, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  }));

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
    expect(stylesheets.length).toBeGreaterThan(40);
    expect(unresolved).toEqual([]);
  });
});
