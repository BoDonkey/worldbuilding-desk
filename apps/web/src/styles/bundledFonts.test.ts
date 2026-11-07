import fs from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';

const webRoot = path.join(__dirname, '..', '..');

describe('bundled OpenDyslexic font', () => {
  it('ships the license of the installed package version', () => {
    const shipped = fs.readFileSync(path.join(webRoot, 'public/fonts/OpenDyslexic-LICENSE.txt'), 'utf8');
    const packaged = fs.readFileSync(
      path.join(webRoot, 'node_modules/@fontsource/opendyslexic/LICENSE'),
      'utf8'
    );
    expect(shipped).toContain(packaged.trim());
  });

  it('is the first choice for the Dyslexic text style', () => {
    const theme = fs.readFileSync(path.join(webRoot, 'src/styles/theme.css'), 'utf8');
    expect(theme).toMatch(/data-editor-font="dyslexic"\]\s*{\s*--editor-font-family: "OpenDyslexic"/);
  });
});
