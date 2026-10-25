import http from 'node:http';
import type {AddressInfo} from 'node:net';

/**
 * A stand-in for a local OpenAI-compatible model server (KoboldCPP, LM Studio,
 * llama.cpp) on 127.0.0.1. The desktop app talks to it through the real main
 * process, so a test sees exactly what the app would send to a real server.
 */
export interface RecordedRequest {
  method: string;
  path: string;
  headers: http.IncomingHttpHeaders;
  body: unknown;
}

export interface StreamPlan {
  /** Sent first, right away. */
  first: string[];
  /** Sent once `release()` is called; until then the stream stays open. */
  rest?: string[];
}

export interface FakeModelServer {
  /** The address to type into Settings, e.g. http://127.0.0.1:53411/v1. */
  baseUrl: string;
  requests: RecordedRequest[];
  /** What the next chat requests reply with. */
  setStream(plan: StreamPlan): void;
  /** Reply to chat requests with this HTTP status instead. */
  failChatWith(status: number | null): void;
  /** Sends the held part of the open stream. */
  release(): void;
  /** Resolves on the next streaming client that hangs up before its reply ends. */
  clientClosedEarly(): Promise<void>;
  close(): Promise<void>;
}

const MODEL_ID = 'e2e-local-model';

function sse(content: string, finish = false): string {
  const choice = {delta: {content}, ...(finish ? {finish_reason: 'stop'} : {})};
  return `data: ${JSON.stringify({choices: [choice]})}\n\n`;
}

export async function startFakeModelServer(): Promise<FakeModelServer> {
  const requests: RecordedRequest[] = [];
  let plan: StreamPlan = {first: ['OK']};
  let chatFailure: number | null = null;
  let releaseHeld: (() => void) | null = null;
  let earlyCloses = 0;
  const earlyCloseWaiters: Array<() => void> = [];
  const closedEarly = () => {
    earlyCloses += 1;
    earlyCloseWaiters.splice(0).forEach((resolve) => resolve());
  };

  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      let body: unknown = raw;
      try {
        body = raw ? JSON.parse(raw) : undefined;
      } catch {
        // Keep the raw text.
      }
      const path = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
      requests.push({method: req.method ?? 'GET', path, headers: req.headers, body});

      if (req.method === 'GET' && path === '/v1/models') {
        res.writeHead(200, {'content-type': 'application/json'});
        res.end(JSON.stringify({data: [{id: MODEL_ID}]}));
        return;
      }
      if (req.method === 'GET' && path === '/props') {
        res.writeHead(200, {'content-type': 'application/json'});
        res.end(JSON.stringify({default_generation_settings: {n_ctx: 8192}}));
        return;
      }
      if (req.method === 'POST' && path === '/v1/chat/completions') {
        if (chatFailure !== null) {
          res.writeHead(chatFailure, {'content-type': 'application/json'});
          res.end(JSON.stringify({error: {message: 'The model failed to load.'}}));
          return;
        }
        const wantsStream = (body as {stream?: unknown} | undefined)?.stream === true;
        const words = [...plan.first, ...(plan.rest ?? [])];
        if (!wantsStream) {
          res.writeHead(200, {'content-type': 'application/json'});
          res.end(JSON.stringify({choices: [{message: {content: words.join('')}, finish_reason: 'stop'}]}));
          return;
        }
        res.writeHead(200, {'content-type': 'text/event-stream', 'cache-control': 'no-cache'});
        let finished = false;
        res.on('close', () => {
          if (!finished) closedEarly();
        });
        const finish = (rest: string[]) => {
          rest.forEach((word, index) => res.write(sse(word, index === rest.length - 1)));
          res.write('data: [DONE]\n\n');
          finished = true;
          res.end();
        };
        if (plan.rest) {
          plan.first.forEach((word) => res.write(sse(word)));
          const rest = plan.rest;
          releaseHeld = () => finish(rest);
        } else {
          finish(plan.first);
        }
        return;
      }
      res.writeHead(404).end();
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const {port} = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${port}/v1`,
    requests,
    setStream(next) {
      plan = next;
    },
    failChatWith(status) {
      chatFailure = status;
    },
    release() {
      releaseHeld?.();
      releaseHeld = null;
    },
    clientClosedEarly() {
      const seen = earlyCloses;
      return new Promise<void>((resolve) => {
        if (earlyCloses > seen) resolve();
        else earlyCloseWaiters.push(resolve);
      });
    },
    close() {
      server.closeAllConnections();
      return new Promise((resolve) => server.close(() => resolve()));
    }
  };
}
