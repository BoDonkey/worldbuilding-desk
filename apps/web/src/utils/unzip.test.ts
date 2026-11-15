import {describe, expect, it} from 'vitest';
import {buildSingleFileZip, buildZip} from './zip';
import {extractSingleFileZip, findZipEntry, readZipEntry, readZipEntryText} from './unzip';

const encode = (text: string) => new TextEncoder().encode(text);

const deflateRaw = async (data: Uint8Array): Promise<Uint8Array> => {
  const stream = new Blob([data.slice().buffer as ArrayBuffer]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

/** A one-entry archive whose entry uses `method` (8 = deflate), as Word writes DOCX. */
const zipWithMethod = (fileName: string, stored: Uint8Array, uncompressedSize: number, method: number): Uint8Array => {
  const name = encode(fileName);
  const local = new Uint8Array(30 + name.length + stored.length);
  const lv = new DataView(local.buffer);
  lv.setUint32(0, 0x04034b50, true);
  lv.setUint16(8, method, true);
  lv.setUint32(18, stored.length, true);
  lv.setUint32(22, uncompressedSize, true);
  lv.setUint16(26, name.length, true);
  local.set(name, 30);
  local.set(stored, 30 + name.length);
  const central = new Uint8Array(46 + name.length);
  const cv = new DataView(central.buffer);
  cv.setUint32(0, 0x02014b50, true);
  cv.setUint16(10, method, true);
  cv.setUint32(20, stored.length, true);
  cv.setUint32(24, uncompressedSize, true);
  cv.setUint16(28, name.length, true);
  cv.setUint32(42, 0, true);
  central.set(name, 46);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, 1, true);
  ev.setUint16(10, 1, true);
  ev.setUint32(12, central.length, true);
  ev.setUint32(16, local.length, true);
  const out = new Uint8Array(local.length + central.length + end.length);
  out.set(local, 0);
  out.set(central, local.length);
  out.set(end, local.length + central.length);
  return out;
};

describe('the shared ZIP reader', () => {
  it('finds a named entry anywhere in the archive', async () => {
    const zip = buildZip([
      {fileName: 'README.md', fileData: encode('readme')},
      {fileName: 'word/document.xml', fileData: encode('<w:document/>')}
    ]);
    expect(await readZipEntryText(zip, 'word/document.xml')).toBe('<w:document/>');
    expect(await readZipEntryText(zip, 'word/styles.xml')).toBeNull();
    expect(findZipEntry(zip, (name) => name.endsWith('.md'))?.fileName).toBe('README.md');
  });

  it('inflates a deflated entry', async () => {
    const text = 'Sera picked up the brass key. '.repeat(20);
    const zip = zipWithMethod('word/document.xml', await deflateRaw(encode(text)), text.length, 8);
    expect(await readZipEntryText(zip, 'word/document.xml', 'DOCX')).toBe(text);
  });

  it('names the format when the compression method is not supported', async () => {
    const zip = zipWithMethod('index.xml', encode('x'), 1, 12);
    await expect(readZipEntry(zip, () => true, '.pages entry')).rejects.toThrow('Unsupported .pages entry compression method (12).');
  });

  it('reads the one stored file of a project backup and refuses anything else', async () => {
    const backup = buildSingleFileZip({fileName: 'project.json', fileData: encode('{"a":1}')});
    const {fileName, fileData} = extractSingleFileZip({zipBytes: backup});
    expect(fileName).toBe('project.json');
    expect(new TextDecoder().decode(fileData)).toBe('{"a":1}');
    expect(() => extractSingleFileZip({zipBytes: new Uint8Array(10)})).toThrow('ZIP file is too small.');
    expect(() => extractSingleFileZip({zipBytes: new Uint8Array(64)})).toThrow('Invalid ZIP header.');
    const deflated = zipWithMethod('project.json', await deflateRaw(encode('{}')), 2, 8);
    expect(() => extractSingleFileZip({zipBytes: deflated})).toThrow(/Expected stored/);
  });
});
