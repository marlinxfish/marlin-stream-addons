import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { manifest, resolveStreams } from './addon';
import { config } from './config';
import type { MediaType } from './types';

export const app = new Hono();

// Private Network Access (PNA) and universal CORS headers
app.use('*', async (c, next) => {
  await next();
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Headers', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  c.header('Access-Control-Allow-Private-Network', 'true');
});

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['*'],
  })
);

// Route: Manifest
app.get('/manifest.json', (c) => {
  return c.json(manifest);
});

app.get('/:config/manifest.json', (c) => {
  return c.json(manifest);
});

// Route: Streams
app.get('/stream/:type/:id', async (c) => {
  const type = c.req.param('type') as MediaType;
  const rawId = c.req.param('id');
  const id = rawId.endsWith('.json') ? rawId.slice(0, -5) : rawId;
  const streams = await resolveStreams({ type, id });
  return c.json({ streams });
});

app.get('/:config/stream/:type/:id', async (c) => {
  const configParam = c.req.param('config');
  const type = c.req.param('type') as MediaType;
  const rawId = c.req.param('id');
  const id = rawId.endsWith('.json') ? rawId.slice(0, -5) : rawId;
  const streams = await resolveStreams({ type, id, config: configParam });
  return c.json({ streams });
});

// Route: Configure
app.get('/configure', (c) => {
  return c.redirect('http://localhost:3000/');
});

app.get('/:config/configure', (c) => {
  const configParam = c.req.param('config');
  return c.redirect(`http://localhost:3000/?config=${encodeURIComponent(configParam)}`);
});

// Landing Page
app.get('/', (c) => {
  const host = c.req.header('host') || '127.0.0.1:7000';
  const proto = c.req.header('x-forwarded-proto') || 'http';
  const manifestUrl = `${proto}://${host}/manifest.json`;
  const stremioUrl = `stremio://${host}/manifest.json`;

  return c.html(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Marlin Stream Addons</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { background: #0b0d14; color: #e2e8f0; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #121624; border: 1px solid #1e293b; padding: 2.5rem; border-radius: 1.5rem; text-align: center; max-width: 440px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
          .btn { background: #0284c7; color: #fff; padding: 0.85rem 2rem; border-radius: 0.75rem; text-decoration: none; font-weight: bold; display: inline-block; margin-top: 1.5rem; transition: background 0.2s; }
          .btn:hover { background: #0369a1; }
          .code { background: #07090e; padding: 0.75rem; border-radius: 0.5rem; font-family: monospace; font-size: 0.8rem; color: #94a3b8; word-break: break-all; margin-top: 1.25rem; border: 1px solid #1e293b; }
        </style>
      </head>
      <body>
        <div class="card">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">🐟</div>
          <h1 style="margin: 0; font-size: 1.5rem; color: #f8fafc;">Marlin Stream Addons</h1>
          <p style="color: #94a3b8; font-size: 0.9rem; margin-top: 0.5rem; line-height: 1.5;">Multi-source video stream resolver for Stremio with zero-bandwidth direct streaming.</p>
          <a class="btn" href="${stremioUrl}">INSTALL ADDON</a>
          <div class="code">${manifestUrl}</div>
          <p style="font-size: 0.7rem; color: #64748b; margin-top: 1.5rem; line-height: 1.4;">
            ⚠️ <strong>Educational Purpose Only:</strong> This service does not host, store, or stream any media files. All streams are indexed from public third-party sources.
          </p>
        </div>
      </body>
    </html>
  `);
});

// Dual export: works for Bun server (port + fetch) and Cloudflare Workers (fetch)
export default {
  port: config.port,
  fetch: app.fetch,
};
