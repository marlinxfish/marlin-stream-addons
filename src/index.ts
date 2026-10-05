import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { manifest, resolveStreams } from './addon';
import { config } from './config';
import { cacheService } from './services/cache';
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

  if (config.cacheStreamTtl <= 0) {
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  } else {
    c.header('Cache-Control', `max-age=${config.cacheStreamTtl}, public`);
  }

  const streams = await resolveStreams({ type, id });
  return c.json({ streams });
});

app.get('/:config/stream/:type/:id', async (c) => {
  const configParam = c.req.param('config');
  const type = c.req.param('type') as MediaType;
  const rawId = c.req.param('id');
  const id = rawId.endsWith('.json') ? rawId.slice(0, -5) : rawId;

  if (config.cacheStreamTtl <= 0) {
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  } else {
    c.header('Cache-Control', `max-age=${config.cacheStreamTtl}, public`);
  }

  const streams = await resolveStreams({ type, id, config: configParam });
  return c.json({ streams });
});

// Route: Cache Clear
app.get('/cache/clear', (c) => {
  cacheService.clear();
  return c.json({ status: 'ok', message: 'In-memory cache purged successfully' });
});

function renderConfigPage() {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Marlin Stream Addons - Konfigurasi</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root { --bg: #0b0d14; --card: #131722; --border: #1f293d; --primary: #06b6d4; --text: #f1f5f9; --sub: #94a3b8; }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
    body { background: var(--bg); color: var(--text); display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 1.5rem; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 1.25rem; max-width: 480px; width: 100%; padding: 2rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
    .header { text-align: center; margin-bottom: 1.5rem; }
    .logo { font-size: 2.75rem; margin-bottom: 0.25rem; }
    h1 { font-size: 1.4rem; font-weight: 800; color: #fff; }
    p.desc { font-size: 0.8rem; color: var(--sub); margin-top: 0.25rem; line-height: 1.4; }
    .section-title { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--primary); font-weight: 700; margin: 1.25rem 0 0.5rem; }
    .servers-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
    .server-item { background: #0c101a; border: 1px solid var(--border); border-radius: 0.75rem; padding: 0.65rem 0.75rem; display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none; font-size: 0.8rem; }
    .server-item input { cursor: pointer; accent-color: var(--primary); width: 1rem; height: 1rem; }
    select { width: 100%; background: #0c101a; border: 1px solid var(--border); border-radius: 0.75rem; color: #fff; padding: 0.65rem; font-size: 0.85rem; outline: none; }
    .toggle-row { display: flex; align-items: center; justify-content: space-between; margin-top: 0.65rem; font-size: 0.8rem; color: #cbd5e1; }
    .toggle-row input { accent-color: var(--primary); width: 1.1rem; height: 1.1rem; cursor: pointer; }
    .btn-install { display: block; width: 100%; background: linear-gradient(135deg, #06b6d4, #3b82f6); color: #fff; text-align: center; text-decoration: none; font-weight: 700; font-size: 0.9rem; padding: 0.85rem; border-radius: 0.75rem; margin-top: 1.5rem; border: none; cursor: pointer; transition: opacity 0.2s; box-shadow: 0 10px 15px -3px rgba(6,182,212,0.3); }
    .btn-install:hover { opacity: 0.9; }
    .btn-copy { display: block; width: 100%; background: #1e293b; color: #cbd5e1; border: 1px solid var(--border); border-radius: 0.75rem; padding: 0.65rem; font-size: 0.8rem; margin-top: 0.5rem; cursor: pointer; text-align: center; }
    .url-box { margin-top: 1rem; background: #07090e; border: 1px solid var(--border); border-radius: 0.5rem; padding: 0.5rem; font-family: monospace; font-size: 0.7rem; color: var(--sub); word-break: break-all; }
    .footer { margin-top: 1.25rem; text-align: center; font-size: 0.65rem; color: #475569; line-height: 1.4; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo">🐟</div>
      <h1>Marlin Stream Addons</h1>
      <p class="desc">Multi-Source Video Stream Resolver untuk Stremio</p>
    </div>

    <div class="section-title">Pilihan Server Video</div>
    <div class="servers-grid">
      <label class="server-item"><span>⚡ Buzzheavier (MP4)</span><input type="checkbox" id="srv-buzzheavier" checked onchange="updateLinks()"></label>
      <label class="server-item"><span>⚡ FileLions (HLS)</span><input type="checkbox" id="srv-filelions" checked onchange="updateLinks()"></label>
      <label class="server-item"><span>⚡ Vidhide (EarnVids)</span><input type="checkbox" id="srv-vidhide" checked onchange="updateLinks()"></label>
      <label class="server-item"><span>⚡ DataNodes</span><input type="checkbox" id="srv-datanodes" onchange="updateLinks()"></label>
    </div>

    <div class="section-title">Batas Resolusi</div>
    <select id="max-res" onchange="updateLinks()">
      <option value="1080p">1080p (FHD - Rekomendasi)</option>
      <option value="720p">720p (HD)</option>
      <option value="480p">480p (SD)</option>
    </select>

    <div class="section-title">Opsi Tambahan</div>
    <label class="toggle-row"><span>Tampilkan Kecepatan (🚀 Ping ms)</span><input type="checkbox" id="show-speed" checked onchange="updateLinks()"></label>
    <label class="toggle-row"><span>Tampilkan Ukuran File (💾 Size)</span><input type="checkbox" id="show-size" checked onchange="updateLinks()"></label>

    <a id="btn-install" class="btn-install" href="#">INSTALL KE STREMIO</a>
    <button type="button" class="btn-copy" onclick="copyManifest()">📋 Salin Link Manifest</button>
    <div id="manifest-url" class="url-box"></div>

    <div class="footer">
      ⚠️ <strong>Educational & Research Use Only:</strong> Addon ini tidak meng-host atau menyimpan file video. Seluruh stream diperoleh langsung dari web pihak ketiga publik.
    </div>
  </div>

  <script>
    const host = window.location.host;
    const proto = window.location.protocol;

    function base64url(str) {
      return btoa(str).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
    }

    function updateLinks() {
      const config = {
        servers: {
          buzzheavier: document.getElementById('srv-buzzheavier').checked,
          filelions: document.getElementById('srv-filelions').checked,
          vidhide: document.getElementById('srv-vidhide').checked,
          datanodes: document.getElementById('srv-datanodes').checked,
        },
        maxResolution: document.getElementById('max-res').value,
        showSpeed: document.getElementById('show-speed').checked,
        showSize: document.getElementById('show-size').checked,
      };

      const encoded = base64url(JSON.stringify(config));
      const httpUrl = proto + '//' + host + '/' + encoded + '/manifest.json';
      const stremioUrl = 'stremio://' + host + '/' + encoded + '/manifest.json';

      document.getElementById('btn-install').href = stremioUrl;
      document.getElementById('manifest-url').innerText = httpUrl;
      window.currentHttpUrl = httpUrl;
    }

    function copyManifest() {
      if (window.currentHttpUrl) {
        navigator.clipboard.writeText(window.currentHttpUrl).then(() => alert('Link manifest tersalin! Paste di pencarian Addon Stremio.'));
      }
    }

    updateLinks();
  </script>
</body>
</html>`;
}

// Landing & Configure Page: self-contained portal, or redirect to WEB_URL if configured
app.get('/', (c) => c.html(renderConfigPage()));
app.get('/configure', (c) => c.html(renderConfigPage()));
app.get('/:config/configure', (c) => c.html(renderConfigPage()));

// Dual export: works for Bun server (port + fetch) and Cloudflare Workers (fetch)
export default {
  port: config.port,
  fetch: app.fetch,
};
