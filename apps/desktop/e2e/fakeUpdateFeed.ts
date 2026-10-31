import {createHash, randomBytes} from 'node:crypto';
import http from 'node:http';
import type {AddressInfo} from 'node:net';

/**
 * A local stand-in for GitHub Releases (Slice 5.1): serves the update
 * manifest electron-updater reads for this platform and a payload whose
 * sha512 matches it. Records every request so tests can prove when the app
 * did and did not contact it.
 */
export interface FakeUpdateFeed {
  url: string;
  requests: string[];
  close(): Promise<void>;
}

const manifestName = () =>
  process.platform === 'darwin' ? 'latest-mac.yml' : process.platform === 'win32' ? 'latest.yml' : 'latest-linux.yml';

export async function startFakeUpdateFeed(version: string): Promise<FakeUpdateFeed> {
  const payload = randomBytes(64 * 1024);
  const sha512 = createHash('sha512').update(payload).digest('base64');
  const fileName = process.platform === 'darwin' ? `SagaSpine-${version}-mac.zip` : `SagaSpine-Setup-${version}.exe`;
  const manifest = [
    `version: ${version}`,
    'files:',
    `  - url: ${fileName}`,
    `    sha512: ${sha512}`,
    `    size: ${payload.length}`,
    `path: ${fileName}`,
    `sha512: ${sha512}`,
    "releaseDate: '2026-10-31T00:00:00.000Z'",
    ''
  ].join('\n');
  const requests: string[] = [];
  const server = http.createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname.slice(1);
    requests.push(path);
    if (path === manifestName()) {
      response.writeHead(200, {'content-type': 'text/yaml'});
      response.end(manifest);
    } else if (path === fileName) {
      response.writeHead(200, {'content-type': 'application/octet-stream', 'content-length': payload.length});
      response.end(payload);
    } else {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const {port} = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/`,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve()))
  };
}

/** Serves a real electron-builder output folder (installer, latest.yml, blockmap) over loopback. */
export async function serveReleaseFolder(directory: string): Promise<FakeUpdateFeed> {
  const fs = await import('node:fs');
  const {createReadStream, existsSync, statSync} = fs;
  const nodePath = await import('node:path');
  const requests: string[] = [];
  const server = http.createServer((request, response) => {
    const name = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname.slice(1));
    requests.push(name);
    // GitHub stores "SagaSpine Setup 1.0.exe" as "SagaSpine-Setup-1.0.exe", and
    // latest.yml names the dashed form; match local files the same way.
    const {readdirSync} = fs;
    const local = readdirSync(directory).find((entry) => entry === name || entry.replace(/ /g, '-') === name);
    const file = local ? nodePath.join(directory, local) : '';
    if (!name || name.includes('/') || !file || !existsSync(file) || !statSync(file).isFile()) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, {'content-length': statSync(file).size});
    createReadStream(file).pipe(response);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const {port} = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/`,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve()))
  };
}
