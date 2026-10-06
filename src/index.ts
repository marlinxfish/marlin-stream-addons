import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { manifest, resolveStreams } from './addon';
import { config } from './config';
import { cacheService } from './services/cache';
import { catalogService } from './services/catalog';
import type { MediaType } from './types';
import { isAccessKeyValid } from './services/config-filter';


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

// Helper to extract search parameter from Stremio extra segment
function parseSearchParam(extraParam?: string): string | undefined {
  if (!extraParam) return undefined;
  const cleanExtra = extraParam.endsWith('.json') ? extraParam.slice(0, -5) : extraParam;
  const searchMatch = cleanExtra.match(/search=([^&]+)/);
  return searchMatch ? decodeURIComponent(searchMatch[1]) : undefined;
}

// Route: Manifest
app.get('/manifest.json', (c) => {
  if (config.accessKey) {
    return c.json({ error: 'Unauthorized: Access key required' }, 401);
  }
  return c.json(manifest);
});

app.get('/:config/manifest.json', (c) => {
  const configParam = c.req.param('config');
  if (config.accessKey && !isAccessKeyValid(configParam, config.accessKey)) {
    return c.json({ error: 'Unauthorized: Invalid access key' }, 401);
  }
  return c.json(manifest);
});
// Route: Catalog (Browse & Search)
app.get('/catalog/:type/:id/:extra?', async (c) => {
  if (config.accessKey) {
    return c.json({ error: 'Unauthorized: Access key required' }, 401);
  }
  const type = c.req.param('type') as MediaType;
  const search = parseSearchParam(c.req.param('extra'));
  const metas = await catalogService.getCatalog(type, search);
  return c.json({ metas });
});

app.get('/:config/catalog/:type/:id/:extra?', async (c) => {
  const configParam = c.req.param('config');
  if (config.accessKey && !isAccessKeyValid(configParam, config.accessKey)) {
    return c.json({ error: 'Unauthorized: Invalid access key' }, 401);
  }
  const type = c.req.param('type') as MediaType;
  const search = parseSearchParam(c.req.param('extra'));
  const metas = await catalogService.getCatalog(type, search);
  return c.json({ metas });
});

// Route: Meta (Title & Episodes details)
app.get('/meta/:type/:id', async (c) => {
  if (config.accessKey) {
    return c.json({ error: 'Unauthorized: Access key required' }, 401);
  }
  const type = c.req.param('type') as MediaType;
  const rawId = c.req.param('id');
  const id = rawId.endsWith('.json') ? rawId.slice(0, -5) : rawId;
  const meta = await catalogService.getMeta(type, id);
  return c.json({ meta: meta || {} });
});

app.get('/:config/meta/:type/:id', async (c) => {
  const configParam = c.req.param('config');
  if (config.accessKey && !isAccessKeyValid(configParam, config.accessKey)) {
    return c.json({ error: 'Unauthorized: Invalid access key' }, 401);
  }
  const type = c.req.param('type') as MediaType;
  const rawId = c.req.param('id');
  const id = rawId.endsWith('.json') ? rawId.slice(0, -5) : rawId;
  const meta = await catalogService.getMeta(type, id);
  return c.json({ meta: meta || {} });
});

// Route: Streams
app.get('/stream/:type/:id', async (c) => {
  if (config.accessKey) {
    return c.json({ streams: [], error: 'Unauthorized: Access key required' }, 401);
  }
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
  if (config.accessKey && !isAccessKeyValid(configParam, config.accessKey)) {
    return c.json({ streams: [], error: 'Unauthorized: Invalid access key' }, 401);
  }
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

// Route: Health & VPS Diagnostics
const serverStartTime = Date.now();
app.get('/health', (c) => {
  const uptimeSec = Math.floor((Date.now() - serverStartTime) / 1000);
  const mem = typeof process !== 'undefined' && process.memoryUsage ? process.memoryUsage() : null;
  const memoryMb = mem
    ? {
        rss: Math.round(mem.rss / (1024 * 1024)),
        heapUsed: Math.round(mem.heapUsed / (1024 * 1024)),
        heapTotal: Math.round(mem.heapTotal / (1024 * 1024)),
      }
    : undefined;

  return c.json({
    status: 'ok',
    service: 'marlin-stream-addons',
    version: manifest.version,
    uptimeSec,
    memoryMb,
    providers: {
      oppadrama: config.oppadramaEnabled,
      nontonAnimeId: config.nontonAnimeIdEnabled,
    },
  });
});

function renderConfigPage(initialConfig = '') {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Marlin Stream Addons - Konfigurasi Resmi</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root {
      --bg: #07090e;
      --card-bg: rgba(15, 20, 34, 0.85);
      --card-border: rgba(255, 255, 255, 0.08);
      --card-hover: rgba(30, 41, 65, 0.6);
      --primary: #06b6d4;
      --primary-hover: #0891b2;
      --primary-glow: rgba(6, 182, 212, 0.25);
      --accent: #6366f1;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --text-sub: #64748b;
      --success: #10b981;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body {
      background: radial-gradient(ellipse at top, #13192e 0%, var(--bg) 75%);
      color: var(--text-main);
      min-height: 100vh;
      padding: 2rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      width: 100%;
      max-width: 1100px;
      margin: 0 auto;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 1.5rem;
      padding: 2.5rem 2rem;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
    }
    .header { margin-bottom: 2rem; border-bottom: 1px solid var(--card-border); pb: 1.5rem; padding-bottom: 1.5rem; }
    .header-top { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
    .header-left { display: flex; align-items: center; gap: 1rem; }
    .badge-icon {
      width: 3.5rem;
      height: 3.5rem;
      background: linear-gradient(135deg, rgba(6, 182, 212, 0.25), rgba(99, 102, 241, 0.35));
      border: 1px solid rgba(6, 182, 212, 0.4);
      border-radius: 1rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 1.85rem;
      box-shadow: 0 8px 20px var(--primary-glow);
    }
    h1 { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em; color: #fff; }
    p.subtitle { font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem; }
    .badges-row { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .pill {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.25rem 0.65rem;
      border-radius: 2rem;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      color: var(--text-muted);
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
    }
    .pill.active { background: rgba(16, 185, 129, 0.12); border-color: rgba(16, 185, 129, 0.3); color: #34d399; }
    
    /* 2-Column Dashboard Grid */
    .dashboard-grid {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 2.25rem;
      align-items: start;
    }
    @media (max-width: 880px) {
      .dashboard-grid {
        grid-template-columns: 1fr;
        gap: 1.75rem;
      }
    }

    .section-title {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--primary);
      margin: 1.25rem 0 0.6rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .section-title:first-child { margin-top: 0; }
    .section-title span.count { font-size: 0.65rem; color: var(--text-sub); text-transform: none; font-weight: normal; }

    /* Provider card */
    .provider-box {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.6rem;
    }
    .provider-card {
      background: #0b0f1a;
      border: 1px solid var(--card-border);
      border-radius: 0.9rem;
      padding: 0.75rem 0.85rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .provider-card.active { border-color: rgba(6, 182, 212, 0.35); background: rgba(6, 182, 212, 0.05); }
    .provider-info { display: flex; align-items: center; gap: 0.5rem; }
    .provider-info .icon { font-size: 1.25rem; }
    .provider-info .name { font-size: 0.8rem; font-weight: 700; color: #fff; }
    .provider-info .sub { font-size: 0.65rem; color: var(--text-muted); }
    .status-tag { font-size: 0.65rem; font-weight: 700; padding: 0.15rem 0.45rem; border-radius: 0.4rem; }
    .status-tag.green { background: rgba(16, 185, 129, 0.2); color: #10b981; }
    .status-tag.gray { background: rgba(255, 255, 255, 0.06); color: var(--text-sub); }

    /* Resolution tabs */
    .res-tabs { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; background: #0b0f1a; padding: 0.3rem; border-radius: 0.85rem; border: 1px solid var(--card-border); }
    .res-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.55rem;
      border-radius: 0.65rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .res-btn.active {
      background: linear-gradient(135deg, var(--primary), var(--accent));
      color: #fff;
      box-shadow: 0 4px 12px var(--primary-glow);
    }

    /* Switch toggle row */
    .switch-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #0b0f1a;
      border: 1px solid var(--card-border);
      border-radius: 0.85rem;
      padding: 0.75rem 0.9rem;
      margin-top: 0.5rem;
    }
    .switch-label { font-size: 0.78rem; font-weight: 600; color: #fff; }
    .switch-desc { font-size: 0.68rem; color: var(--text-muted); margin-top: 0.15rem; }
    .switch {
      position: relative;
      display: inline-block;
      width: 2.4rem;
      height: 1.35rem;
      flex-shrink: 0;
    }
    .switch input { opacity: 0; width: 0; height: 0; }
    .slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background: #1e293b;
      transition: .2s;
      border-radius: 2rem;
    }
    .slider:before {
      position: absolute;
      content: "";
      height: 1rem;
      width: 1rem;
      left: 0.18rem;
      bottom: 0.18rem;
      background: white;
      transition: .2s;
      border-radius: 50%;
    }
    input:checked + .slider { background: var(--primary); }
    input:checked + .slider:before { transform: translateX(1.05rem); }

    /* Right column install box */
    .install-panel {
      background: #0b0f1a;
      border: 1px solid rgba(6, 182, 212, 0.25);
      border-radius: 1.25rem;
      padding: 1.75rem;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    }
    .install-header h3 { font-size: 1.15rem; font-weight: 800; color: #fff; }
    .install-header p { font-size: 0.78rem; color: var(--text-muted); margin-top: 0.35rem; line-height: 1.4; }

    .btn-main {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      width: 100%;
      background: linear-gradient(135deg, #06b6d4, #4f46e5);
      color: #fff;
      font-size: 0.95rem;
      font-weight: 800;
      letter-spacing: 0.02em;
      text-decoration: none;
      padding: 1rem;
      border-radius: 0.95rem;
      box-shadow: 0 10px 25px -5px var(--primary-glow);
      transition: transform 0.15s, opacity 0.15s;
      border: none;
      cursor: pointer;
      margin-top: 1.25rem;
    }
    .btn-main:hover { opacity: 0.95; transform: translateY(-1px); }
    .btn-copy {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      width: 100%;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      color: var(--text-main);
      font-size: 0.8rem;
      font-weight: 600;
      padding: 0.75rem;
      border-radius: 0.85rem;
      margin-top: 0.6rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-copy:hover { background: rgba(255, 255, 255, 0.09); }
    .url-display {
      margin-top: 0.75rem;
      background: #05070a;
      border: 1px solid var(--card-border);
      border-radius: 0.65rem;
      padding: 0.6rem 0.75rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.68rem;
      color: var(--text-muted);
      word-break: break-all;
      user-select: all;
    }

    /* Guide accordion */
    details.guide {
      margin-top: 1.25rem;
      background: rgba(255,255,255,0.02);
      border: 1px solid var(--card-border);
      border-radius: 0.85rem;
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    details.guide summary {
      padding: 0.75rem 0.85rem;
      cursor: pointer;
      font-weight: 600;
      color: #cbd5e1;
      user-select: none;
    }
    details.guide .guide-content { padding: 0.5rem 0.85rem 0.85rem; line-height: 1.5; border-top: 1px solid var(--card-border); }
    details.guide ol { padding-left: 1.2rem; }
    details.guide li { margin-bottom: 0.35rem; }

    /* Footer */
    .footer {
      text-align: center;
      margin-top: 2rem;
      padding-top: 1.25rem;
      border-top: 1px solid var(--card-border);
      font-size: 0.68rem;
      color: var(--text-sub);
      line-height: 1.45;
    }
    .toast {
      position: fixed;
      bottom: 2rem;
      background: #10b981;
      color: #fff;
      padding: 0.6rem 1.25rem;
      border-radius: 2rem;
      font-size: 0.8rem;
      font-weight: 700;
      box-shadow: 0 10px 20px rgba(0,0,0,0.5);
      opacity: 0;
      transform: translateY(20px);
      transition: all 0.25s ease;
      pointer-events: none;
      z-index: 100;
    }
    .toast.show { opacity: 1; transform: translateY(0); }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-top">
        <div class="header-left">
          <div class="badge-icon">🐟</div>
          <div>
            <h1>Marlin Stream Addons</h1>
            <p class="subtitle">Multi-Source Stremio Video Stream & Catalog Resolver</p>
          </div>
        </div>
        <div class="badges-row">
          <span class="pill active">🟢 Edge Ready</span>
          <span class="pill">🦊 Kitsu Anime</span>
          <span class="pill">🎌 NontonAnimeID</span>
          <span class="pill">⚡ Zero-Bandwidth</span>
          <span class="pill">🇮🇩 Sub Indo</span>
        </div>
    </div>

    <div class="dashboard-grid">
      <!-- Left Column: Settings -->
      <div class="grid-left">
        <!-- Section 1: Data Sources -->
        <div class="section-title">
          <span>Sumber Providers</span>
          <span class="count">${(config.nontonAnimeIdEnabled ? 1 : 0) + (config.oppadramaEnabled ? 1 : 0)} Aktif</span>
        </div>
        <div class="provider-box">
          <div class="provider-card ${config.nontonAnimeIdEnabled ? 'active' : ''}">
            <div class="provider-info">
              <span class="icon">🎌</span>
              <div>
                <div class="name">NontonAnimeID</div>
                <div class="sub">Anime Series & Movie Sub Indo</div>
              </div>
            </div>
            <span class="status-tag ${config.nontonAnimeIdEnabled ? 'green' : 'gray'}">${config.nontonAnimeIdEnabled ? 'Aktif' : 'Nonaktif'}</span>
          </div>
          <div class="provider-card active">
            <div class="provider-info">
              <span class="icon">🦊</span>
              <div>
                <div class="name">Anime Kitsu</div>
                <div class="sub">Metadata & Catalog Stremio</div>
              </div>
            </div>
            <span class="status-tag green">Terhubung</span>
          </div>
          <div class="provider-card ${config.oppadramaEnabled ? 'active' : ''}">
            <div class="provider-info">
              <span class="icon">🍿</span>
              <div>
                <div class="name">Oppadrama</div>
                <div class="sub">Drama & Movie Asia</div>
              </div>
            </div>
            <span class="status-tag ${config.oppadramaEnabled ? 'green' : 'gray'}">${config.oppadramaEnabled ? 'Aktif' : 'Offline'}</span>
          </div>
        </div>
        <div style="margin-top: 0.85rem; padding: 0.75rem 1rem; border-radius: 0.85rem; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); font-size: 0.75rem; color: #34d399; display: flex; align-items: center; gap: 0.5rem;">
          <span>⚡</span>
          <span><strong>Server Otomatis:</strong> Semua server video (KotakVideo, Vidhide, dll) aktif otomatis dan siap diputar.</span>
        <!-- Section 2: Access Key -->
        <div class="section-title">🔑 Access Key / Sandi Akses</div>
        <div style="margin-bottom: 1.25rem;">
          <input
            type="password"
            id="access-key-input"
            placeholder="${config.accessKey ? 'Masukkan Access Key...' : 'Opsional: Tidak ada kunci aktif'}"
            oninput="setAccessKey(this.value)"
            style="width: 100%; box-sizing: border-box; background: rgba(15, 20, 34, 0.9); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 0.75rem; padding: 0.75rem 1rem; color: #fff; font-size: 0.9rem; outline: none;"
          />
          <div id="key-hint" style="font-size: 0.75rem; color: ${config.accessKey ? '#f87171' : '#9ca3af'}; margin-top: 0.4rem;">
            ${config.accessKey ? '🔒 Access Key wajib diisi agar link addon dapat dipasang.' : '🔓 Server terbuka untuk umum (tidak memerlukan kunci).'}
          </div>
        </div>

        <!-- Section 3: Resolution -->
        <div class="section-title">Batas Maksimal Resolusi</div>
        <div class="res-tabs">
          <button type="button" class="res-btn active" id="res-1080p" onclick="setResolution('1080p')">1080p (FHD)</button>
          <button type="button" class="res-btn" id="res-720p" onclick="setResolution('720p')">720p (HD)</button>
          <button type="button" class="res-btn" id="res-480p" onclick="setResolution('480p')">480p (SD)</button>
        </div>

        <!-- Section 4: Display Options -->
        <div class="section-title">Opsi Informasi Stream</div>
        <div class="switch-row">
          <div>
            <div class="switch-label">Kecepatan Server (Ping Latency)</div>
            <div class="switch-desc">Tampilkan indikator respon server 🚀 ms di judul video</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="toggle-speed" checked onchange="updateManifest()">
            <span class="slider"></span>
          </label>
        </div>

        <div class="switch-row">
          <div>
            <div class="switch-label">Ukuran File (File Size / Bitrate)</div>
            <div class="switch-desc">Tampilkan estimasi 💾 MB/GB atau Adaptive HLS</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="toggle-size" checked onchange="updateManifest()">
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <!-- Right Column: Installation Panel -->
      <div class="grid-right">
        <div class="install-panel">
          <div class="install-header">
            <h3>Pasang ke Stremio</h3>
            <p>Konfigurasi di samping otomatis ter-encode ke link manifest di bawah ini.</p>
          </div>

          <a id="btn-install" class="btn-main" href="#">
            <span>📥</span>
            <span>INSTALL ADDON KE STREMIO</span>
          </a>
          <button type="button" class="btn-copy" onclick="copyManifestUrl()">
            <span>📋</span>
            <span>Salin Link Manifest</span>
          </button>
          <div id="url-preview" class="url-display"></div>

          <!-- Guide -->
          <details class="guide" open>
            <summary>💡 Cara Pasang & Cari Anime di Stremio</summary>
            <div class="guide-content">
              <ol>
                <li><strong>Otomatis (PC & HP):</strong> Klik tombol <strong>INSTALL ADDON KE STREMIO</strong> di atas untuk membuka aplikasi Stremio langsung.</li>
                <li><strong>Integrasi Kitsu Addon:</strong> Kamu bisa gunakan katalog plugin resmi <strong>Anime Kitsu</strong> di Stremio. Saat memutar episode/movie anime dari Kitsu, stream dari <strong>NontonAnimeID</strong> akan otomatis tersedia!</li>
                <li><strong>Pencarian Judul Anime:</strong> Kamu juga bisa langsung mencari judul anime di search bar Stremio (misal: <em>Solo Leveling</em> atau <em>Jujutsu Kaisen 0</em>).</li>
              </ol>
            </div>
          </details>
        </div>
      </div>
    </div>

    <div class="footer">
      ⚠️ <strong>Educational & Research Use Only:</strong> Software ini beroperasi murni sebagai URL resolver dan indexer publik, tidak menyimpan atau men-stream media video apapun di server.
    </div>
  </div>

  <div id="toast" class="toast">Link manifest tersalin ke clipboard!</div>

  <script>
    const requiresKey = ${Boolean(config.accessKey)};
    const state = {
      key: '',
      maxResolution: '1080p',
      showSpeed: true,
      showSize: true,
    };
    // Parse initial config from query param or injected string
    (function init() {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const cfgParam = urlParams.get('config') || '${initialConfig}';
        if (cfgParam) {
          const json = atob(cfgParam.replace(/-/g, '+').replace(/_/g, '/'));
          const parsed = JSON.parse(json);
          if (parsed.key) state.key = parsed.key;
          if (parsed.maxResolution) state.maxResolution = parsed.maxResolution;
          if (parsed.showSpeed !== undefined) state.showSpeed = parsed.showSpeed;
          if (parsed.showSize !== undefined) state.showSize = parsed.showSize;
      } catch (e) {}

      syncDom();
      updateManifest();
    })();

    function syncDom() {
      ['1080p', '720p', '480p'].forEach(res => {
        const btn = document.getElementById('res-' + res);
        if (btn) {
          if (state.maxResolution === res) btn.classList.add('active');
          else btn.classList.remove('active');
        }
      });

      const speedToggle = document.getElementById('toggle-speed');
      if (speedToggle) speedToggle.checked = state.showSpeed;

      const sizeToggle = document.getElementById('toggle-size');
      if (sizeToggle) sizeToggle.checked = state.showSize;
      const keyInput = document.getElementById('access-key-input');
      if (keyInput && state.key) keyInput.value = state.key;
    }

    function setAccessKey(val) {
      state.key = val.trim();
      updateManifest();
    }
    function setResolution(res) {
      state.maxResolution = res;
      syncDom();
      updateManifest();
    }

    function toBase64Url(str) {
      return btoa(str).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
    }

    function updateManifest() {
      const btnInstall = document.getElementById('btn-install');
      const urlPreview = document.getElementById('url-preview');
      if (requiresKey && !state.key) {
        btnInstall.style.opacity = '0.4';
        btnInstall.style.pointerEvents = 'none';
        urlPreview.innerText = '⚠️ Ketik Access Key di atas untuk mengaktifkan link addon.';
        window.currentManifestUrl = '';
        return;
      }
      btnInstall.style.opacity = '1';
      btnInstall.style.pointerEvents = 'auto';

      const speedToggle = document.getElementById('toggle-speed');
      const sizeToggle = document.getElementById('toggle-size');
      if (speedToggle) state.showSpeed = speedToggle.checked;
      if (sizeToggle) state.showSize = sizeToggle.checked;

      const encoded = toBase64Url(JSON.stringify(state));
      const host = window.location.host;
      const proto = window.location.protocol;

      const httpUrl = proto + '//' + host + '/' + encoded + '/manifest.json';
      const stremioUrl = 'stremio://' + host + '/' + encoded + '/manifest.json';

      document.getElementById('btn-install').href = stremioUrl;
      document.getElementById('url-preview').innerText = httpUrl;
      window.currentManifestUrl = httpUrl;
    }

    function copyManifestUrl() {
      if (window.currentManifestUrl) {
        navigator.clipboard.writeText(window.currentManifestUrl).then(() => {
          showToast('Link manifest tersalin ke clipboard!');
        }).catch(() => {
          showToast('Silakan salin link manual di kotak bawah.');
        });
      }
    }

    function showToast(msg) {
      const toast = document.getElementById('toast');
      toast.innerText = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2500);
    }
  </script>
</body>
</html>`;
}

// Landing & Configure Routes: self-contained portal
app.get('/', (c) => c.html(renderConfigPage()));
app.get('/configure', (c) => c.html(renderConfigPage()));
app.get('/:config/configure', (c) => c.html(renderConfigPage(c.req.param('config'))));

// Dual export: works for Bun/Node server (hostname + port + fetch) and Cloudflare Workers (fetch)
export default {
  hostname: config.host,
  port: config.port,
  fetch: app.fetch,
};
