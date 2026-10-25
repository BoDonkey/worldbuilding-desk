// @vitest-environment node
import {describe, expect, it} from 'vitest';
import {
  CharacterCardError,
  MAX_CARD_FIELD_CHARS,
  MAX_CARD_FILE_BYTES,
  MAX_LOREBOOK_ENTRIES,
  parseCharacterCard,
  readCharacterCardFile
} from './characterCardParse';

const encoder = new TextEncoder();
const latin1Bytes = (value: string) => Uint8Array.from(value, (char) => char.charCodeAt(0));
const base64Json = (value: unknown) => btoa(String.fromCharCode(...encoder.encode(JSON.stringify(value))));

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  new DataView(out.buffer).setUint32(0, data.length);
  out.set(latin1Bytes(type), 4);
  out.set(data, 8);
  // CRC left as zero: the reader does not check it, as image viewers tolerate.
  return out;
}

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

const SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const IHDR = chunk('IHDR', new Uint8Array(13));
const IEND = chunk('IEND', new Uint8Array(0));
const tEXt = (keyword: string, value: string) => chunk('tEXt', concat(latin1Bytes(keyword), Uint8Array.of(0), latin1Bytes(value)));
const png = (...chunks: Uint8Array[]) => concat(SIGNATURE, IHDR, ...chunks, IEND);

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const v2 = (data: Record<string, unknown>) => ({spec: 'chara_card_v2', spec_version: '2.0', data: {name: 'Mira', ...data}});
const v3 = (data: Record<string, unknown>) => ({spec: 'chara_card_v3', spec_version: '3.0', data: {name: 'Mira', ...data}});
const json = (value: unknown) => encoder.encode(JSON.stringify(value));

const reason = async (bytes: Uint8Array) => {
  try {
    await readCharacterCardFile(bytes);
  } catch (error) {
    expect(error).toBeInstanceOf(CharacterCardError);
    return (error as Error).message;
  }
  throw new Error('expected the card to be refused');
};

describe('parseCharacterCard', () => {
  it('normalizes a V2 card, trimming fields and reading null as empty', () => {
    const card = parseCharacterCard(
      v2({
        name: ' Mira Voss ',
        description: ' A smith. ',
        personality: 'Blunt.',
        scenario: null,
        first_mes: 'Hello.',
        mes_example: '<START>\n{{char}}: Hm.',
        alternate_greetings: [' Hi. ', ''],
        creator_notes: null,
        system_prompt: 'Stay in character.',
        tags: ['smith', ' '],
        creator: 'someone',
        character_version: '2'
      })
    );
    expect(card).toMatchObject({
      spec: 'v2',
      name: 'Mira Voss',
      description: 'A smith.',
      personality: 'Blunt.',
      scenario: '',
      firstMessage: 'Hello.',
      exampleDialogue: '<START>\n{{char}}: Hm.',
      alternateGreetings: ['Hi.'],
      creatorNotes: '',
      systemPrompt: 'Stay in character.',
      tags: ['smith'],
      creator: 'someone',
      characterVersion: '2',
      lorebook: null
    });
  });

  it('reads V3 and the flat V1 shape', () => {
    expect(parseCharacterCard(v3({nickname: 'Mi'}))).toMatchObject({spec: 'v3', name: 'Mira', nickname: 'Mi'});
    expect(parseCharacterCard({name: 'Old', description: 'From 2023.', first_mes: 'Hey'})).toMatchObject({
      spec: 'v1',
      name: 'Old',
      description: 'From 2023.',
      firstMessage: 'Hey'
    });
  });

  it('keeps lorebook entries with content, naming each from its name or comment', () => {
    const card = parseCharacterCard(
      v2({
        character_book: {
          name: 'Glass Harbor',
          entries: [
            {keys: ['harbor', ' docks '], content: 'The harbor freezes.', comment: 'harbor', enabled: true},
            {keys: ['empty'], content: '   '},
            {keys: [], content: 'Off by default.', name: 'Secret', enabled: false}
          ]
        }
      })
    );
    expect(card.lorebook).toEqual({
      name: 'Glass Harbor',
      entries: [
        {name: 'harbor', keys: ['harbor', 'docks'], content: 'The harbor freezes.', enabled: true},
        {name: 'Secret', keys: [], content: 'Off by default.', enabled: false}
      ]
    });
  });

  it('refuses what is not a card, with a reason', () => {
    expect(() => parseCharacterCard([])).toThrow('This file does not contain a character card.');
    expect(() => parseCharacterCard({foo: 1})).toThrow('This file does not contain a character card.');
    expect(() => parseCharacterCard({spec: 'chara_card_v9', data: {}})).toThrow(/format SagaSpine cannot read \("chara_card_v9"\)/);
    expect(() => parseCharacterCard({spec: 'chara_card_v2'})).toThrow('This character card has no character data.');
    expect(() => parseCharacterCard(v2({name: '  '}))).toThrow('This character card has no name.');
    expect(() => parseCharacterCard({spec: 'chara_card_v2', data: {description: 'x'}})).toThrow('This character card has no name.');
    expect(() => parseCharacterCard(v2({name: 7}))).toThrow('Its name is not in the character card format.');
    expect(() => parseCharacterCard(v2({description: 42}))).toThrow('Its description is not in the character card format.');
    expect(() => parseCharacterCard(v2({first_mes: 'x'.repeat(MAX_CARD_FIELD_CHARS + 1)}))).toThrow(
      /Its first message is too long to import \(at most 50,000 characters\)/
    );
    const entries = Array.from({length: MAX_LOREBOOK_ENTRIES + 1}, () => ({keys: ['k'], content: 'c'}));
    expect(() => parseCharacterCard(v2({character_book: {entries}}))).toThrow(/Its lorebook is too large to import/);
  });
});

describe('readCharacterCardFile', () => {
  it('reads a JSON card, with or without a byte-order mark', async () => {
    expect((await readCharacterCardFile(json(v2({})))).name).toBe('Mira');
    expect((await readCharacterCardFile(encoder.encode(`\uFEFF${JSON.stringify(v3({}))}`))).spec).toBe('v3');
  });

  it('prefers the PNG ccv3 chunk over chara, and decodes UTF-8 inside the base64', async () => {
    const bytes = png(tEXt('chara', base64Json(v2({name: 'Old name'}))), tEXt('ccv3', base64Json(v3({name: 'Ségolène 剣'}))));
    expect(await readCharacterCardFile(bytes)).toMatchObject({spec: 'v3', name: 'Ségolène 剣'});
    expect((await readCharacterCardFile(png(tEXt('chara', base64Json(v2({})))))).spec).toBe('v2');
  });

  it('reads iTXt and compressed zTXt card chunks', async () => {
    const card = encoder.encode(base64Json(v2({name: 'Itxt'})));
    const itxt = chunk('iTXt', concat(latin1Bytes('chara'), Uint8Array.of(0, 0, 0, 0, 0), card));
    expect((await readCharacterCardFile(png(itxt))).name).toBe('Itxt');
    const compressed = chunk('iTXt', concat(latin1Bytes('chara'), Uint8Array.of(0, 1, 0, 0, 0), await deflate(card)));
    expect((await readCharacterCardFile(png(compressed))).name).toBe('Itxt');
    const ztxt = chunk('zTXt', concat(latin1Bytes('ccv3'), Uint8Array.of(0, 0), await deflate(encoder.encode(base64Json(v3({name: 'Ztxt'}))))));
    expect((await readCharacterCardFile(png(ztxt))).name).toBe('Ztxt');
  });

  it('refuses empty, oversized, unknown, damaged, and card-less files with a reason', async () => {
    expect(await reason(new Uint8Array())).toBe('This file is empty.');
    expect(await reason(new Uint8Array(MAX_CARD_FILE_BYTES + 1))).toBe('This file is larger than 20 MB, so it was not read.');
    expect(await reason(encoder.encode('name: Mira'))).toBe('Choose a character card saved as PNG or JSON.');
    expect(await reason(Uint8Array.of(0xff, 0xfe, 0x00))).toBe('Choose a character card saved as PNG or JSON.');
    expect(await reason(encoder.encode('{"name": '))).toBe('This file is not valid JSON, so no character card could be read.');
    expect(await reason(png(tEXt('Comment', 'just a picture')))).toBe('This PNG image has no character card inside it.');
    expect(await reason(png(tEXt('chara', '%%%not base64%%%')))).toBe(
      'The character data in this PNG is damaged and cannot be read.'
    );
    const truncated = png(tEXt('chara', base64Json(v2({})))).subarray(0, 40);
    expect(await reason(truncated)).toBe('This PNG image is damaged or incomplete.');
  });
});
