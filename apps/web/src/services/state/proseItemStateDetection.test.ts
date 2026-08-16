import {describe, expect, it} from 'vitest';
import {detectProseItemAction} from './proseItemStateDetection';

const characters = [{name: 'Bill', sheetId: 'sheet-bill'}];

describe('prose item state detection', () => {
  it('prefills acquisition from selected prose', () => {
    expect(detectProseItemAction({
      text: 'Bill found a health potion.', characters
    })).toEqual({
      action: 'acquire', itemName: 'health potion',
      characterName: 'Bill', sheetId: 'sheet-bill'
    });
  });

  it('recognizes consumption without inventing an effect', () => {
    expect(detectProseItemAction({
      text: 'Bill drank the Moonwell Draught.', characters
    })).toEqual({
      action: 'consume', itemName: 'Moonwell Draught',
      characterName: 'Bill', sheetId: 'sheet-bill'
    });
  });

  it('leaves an item-only selection for manual capture', () => {
    expect(detectProseItemAction({text: 'health potion', characters})).toBeNull();
  });
});
