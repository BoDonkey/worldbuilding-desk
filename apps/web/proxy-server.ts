// apps/web/proxy-server.ts
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/anthropic/stream', async (req, res) => {
  const {apiKey, request} = req.body;
  const model = request?.model ?? 'claude-sonnet-4-20250514';

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

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const {done, value} = await reader.read();
    if (done) break;

    res.write(decoder.decode(value));
  }

  res.end();
});

app.listen(3001, () => console.log('Proxy running on :3001'));
