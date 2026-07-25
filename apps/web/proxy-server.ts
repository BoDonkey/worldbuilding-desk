// apps/web/proxy-server.ts
// Dev-only proxy for Anthropic streaming requests from the Vite dev server.
import express from 'express';
import cors from 'cors';

const HOST = '127.0.0.1';
const PORT = 3001;
const ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

const app = express();
app.use(cors({origin: ALLOWED_ORIGINS}));
app.use(express.json({limit: '2mb'}));

app.post('/api/anthropic/stream', async (req, res) => {
  const {apiKey, request} = req.body ?? {};
  if (typeof apiKey !== 'string' || !apiKey || typeof request !== 'object' || request === null) {
    res.status(400).json({error: 'Expected {apiKey, request} in body'});
    return;
  }

  const model = request.model ?? 'claude-sonnet-4-20250514';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature || 0.7,
        system: request.systemPrompt,
        messages: request.messages,
        stream: true
      })
    });

    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => '');
      res.status(response.status || 502).json({error: 'Upstream request failed', detail});
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    req.on('close', () => {
      void reader.cancel().catch(() => {});
    });

    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      res.write(decoder.decode(value));
    }

    res.end();
  } catch (error) {
    console.error('Proxy error:', error);
    if (!res.headersSent) {
      res.status(502).json({error: 'Proxy request failed'});
    } else {
      res.end();
    }
  }
});

app.listen(PORT, HOST, () => console.log(`Proxy running on http://${HOST}:${PORT}`));
