import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildState, runCollection } from './server/pipeline.ts';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';

const app = express();
app.use(express.json());

app.get('/api/state', (_req, res) => {
  res.json(buildState());
});

app.post('/api/collect', async (req, res) => {
  try {
    const report = await runCollection({ refreshPaths: req.body?.refreshPaths !== false });
    res.json({ ok: true, report, state: buildState() });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

async function start() {
  if (isProd) {
    app.use(express.static(join(ROOT, 'dist/client')));
    app.get('*', (_req, res) => res.sendFile(join(ROOT, 'dist/client/index.html')));
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa', root: ROOT });
    app.use(vite.middlewares);
  }
  app.listen(PORT, () => {
    console.log(`\n  cresco  →  http://localhost:${PORT}\n`);
  });
}

start();
