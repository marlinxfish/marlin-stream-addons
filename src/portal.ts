export interface PortalOptions {
  accessKey?: string;
  oppadramaEnabled?: boolean;
  nontonAnimeIdEnabled?: boolean;
  version?: string;
}

export function renderConfigPage(initialConfig = '', options: PortalOptions = {}): string {
  const isKeyRequired = Boolean(options.accessKey);
  const activeSourcesCount = (options.nontonAnimeIdEnabled ? 1 : 0) + (options.oppadramaEnabled ? 1 : 0);
  const version = options.version || '1.0.0';

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Marlin Stream - Konfigurasi Addon</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <style>
    :root {
      --bg: #060911;
      --card: rgba(13, 19, 34, 0.82);
      --card-inner: rgba(20, 29, 52, 0.55);
      --border: rgba(255, 255, 255, 0.08);
      --border-focus: #0ea5e9;
      --primary: #0ea5e9;
      --primary-hover: #0284c7;
      --primary-glow: rgba(14, 165, 233, 0.25);
      --success: #10b981;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --text-sub: #64748b;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      -webkit-tap-highlight-color: transparent;
    }
    html, body {
      height: 100dvh;
      max-height: 100dvh;
      overflow: hidden;
      background: var(--bg);
      color: var(--text);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    body {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background:
        radial-gradient(900px circle at 50% -10%, rgba(14, 165, 233, 0.15), transparent 70%),
        radial-gradient(700px circle at 85% 100%, rgba(99, 102, 241, 0.08), transparent 70%),
        #060911;
      padding: 0.65rem 0.85rem;
    }
    .app-shell {
      width: 100%;
      max-width: 1020px;
      height: 100%;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 0.55rem;
    }

    /* Top Navigation Bar */
    .top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.45rem 0.8rem;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 0.85rem;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      flex-shrink: 0;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .brand-icon {
      width: 2rem;
      height: 2rem;
      background: linear-gradient(135deg, rgba(14, 165, 233, 0.25), rgba(99, 102, 241, 0.35));
      border: 1px solid rgba(14, 165, 233, 0.4);
      border-radius: 0.55rem;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #38bdf8;
    }
    .brand-title {
      font-size: 0.92rem;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: var(--text);
    }
    .brand-badge {
      font-size: 0.62rem;
      padding: 0.12rem 0.4rem;
      border-radius: 0.35rem;
      background: rgba(14, 165, 233, 0.15);
      border: 1px solid rgba(14, 165, 233, 0.3);
      color: #38bdf8;
      font-weight: 600;
    }
    .header-badges {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.7rem;
      font-weight: 500;
      padding: 0.2rem 0.55rem;
      border-radius: 0.45rem;
      background: var(--card-inner);
      border: 1px solid var(--border);
      color: var(--text-muted);
    }
    .chip.green {
      border-color: rgba(16, 185, 129, 0.3);
      color: #34d399;
      background: rgba(16, 185, 129, 0.1);
    }
    .dot {
      width: 0.38rem;
      height: 0.38rem;
      border-radius: 50%;
      background: currentColor;
    }

    /* Main Cockpit Grid */
    .cockpit {
      flex: 1;
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 0.55rem;
      min-height: 0;
    }
    .panel {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 0.95rem;
      padding: 0.85rem 1rem;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 0;
      gap: 0.55rem;
    }

    /* Section Components */
    .panel-section {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .sec-label {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-sub);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    /* Input Element */
    .input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }
    .input-icon {
      position: absolute;
      left: 0.7rem;
      color: var(--text-sub);
      pointer-events: none;
      display: flex;
      align-items: center;
    }
    .text-input {
      width: 100%;
      background: var(--card-inner);
      border: 1px solid var(--border);
      border-radius: 0.6rem;
      padding: 0.55rem 2rem 0.55rem 2.1rem;
      font-size: 0.82rem;
      color: var(--text);
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .text-input:focus {
      border-color: var(--border-focus);
      box-shadow: 0 0 0 3px var(--primary-glow);
    }
    .toggle-visibility-btn {
      position: absolute;
      right: 0.6rem;
      background: none;
      border: none;
      color: var(--text-sub);
      cursor: pointer;
      display: flex;
      align-items: center;
      padding: 0.2rem;
    }
    .toggle-visibility-btn:hover { color: var(--text); }
    .key-state-text {
      font-size: 0.68rem;
      color: var(--text-sub);
      margin-top: 0.1rem;
    }
    .key-state-text.req { color: #fb7185; }
    .key-state-text.ok { color: #34d399; }

    /* Segmented Control (Resolution) */
    .segmented-control {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      background: var(--card-inner);
      border: 1px solid var(--border);
      border-radius: 0.6rem;
      padding: 0.18rem;
      gap: 0.2rem;
    }
    .seg-btn {
      background: none;
      border: none;
      border-radius: 0.45rem;
      padding: 0.4rem 0.2rem;
      color: var(--text-muted);
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.18s ease;
      text-align: center;
    }
    .seg-btn:hover { color: var(--text); }
    .seg-btn.active {
      background: var(--primary);
      color: #fff;
      box-shadow: 0 2px 8px var(--primary-glow);
    }

    /* Toggle Switches (Speed, Size) */
    .toggles-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.45rem;
    }
    .toggle-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--card-inner);
      border: 1px solid var(--border);
      border-radius: 0.6rem;
      padding: 0.45rem 0.6rem;
      cursor: pointer;
      user-select: none;
    }
    .toggle-card:hover { border-color: rgba(255, 255, 255, 0.15); }
    .toggle-info {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.75rem;
      color: var(--text);
      font-weight: 500;
    }
    .switch {
      position: relative;
      width: 2rem;
      height: 1.1rem;
      flex-shrink: 0;
    }
    .switch input { opacity: 0; width: 0; height: 0; }
    .slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background-color: rgba(255, 255, 255, 0.12);
      transition: .2s;
      border-radius: 1rem;
    }
    .slider:before {
      position: absolute;
      content: "";
      height: 0.8rem;
      width: 0.8rem;
      left: 0.15rem;
      bottom: 0.15rem;
      background-color: white;
      transition: .2s;
      border-radius: 50%;
    }
    input:checked + .slider { background-color: var(--primary); }
    input:checked + .slider:before { transform: translateX(0.9rem); }

    /* Sources Mini Grid */
    .sources-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.4rem;
    }
    .source-pill {
      background: var(--card-inner);
      border: 1px solid var(--border);
      border-radius: 0.55rem;
      padding: 0.4rem 0.55rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .source-pill-name {
      font-size: 0.72rem;
      font-weight: 600;
      color: var(--text);
    }
    .source-pill-sub {
      font-size: 0.61rem;
      color: var(--text-sub);
    }
    .source-badge {
      font-size: 0.6rem;
      font-weight: 600;
      padding: 0.1rem 0.35rem;
      border-radius: 0.35rem;
      background: rgba(16, 185, 129, 0.12);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.25);
    }
    .source-badge.off {
      background: rgba(148, 163, 184, 0.1);
      color: var(--text-sub);
      border-color: rgba(148, 163, 184, 0.2);
    }

    /* Right Action Panel */
    .action-panel {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 0.55rem;
    }
    .cta-card {
      background: linear-gradient(145deg, rgba(14, 165, 233, 0.12), rgba(99, 102, 241, 0.08));
      border: 1px solid rgba(14, 165, 233, 0.3);
      border-radius: 0.85rem;
      padding: 0.85rem;
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
    }
    .btn-install {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
      background: linear-gradient(135deg, #0284c7, #0ea5e9);
      color: #fff;
      border: none;
      border-radius: 0.65rem;
      padding: 0.75rem 0.9rem;
      font-size: 0.84rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      text-decoration: none;
      cursor: pointer;
      box-shadow: 0 4px 14px var(--primary-glow);
      transition: all 0.2s ease;
    }
    .btn-install:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 18px rgba(14, 165, 233, 0.4);
    }
    .btn-install:active { transform: translateY(0); }
    .btn-install.disabled {
      opacity: 0.35 !important;
      pointer-events: none !important;
      filter: grayscale(0.6);
    }
    .btn-copy {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
      background: var(--card-inner);
      color: var(--text-muted);
      border: 1px solid var(--border);
      border-radius: 0.6rem;
      padding: 0.5rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-copy:hover {
      color: var(--text);
      border-color: rgba(255, 255, 255, 0.2);
      background: rgba(255, 255, 255, 0.05);
    }
    .btn-copy.copied {
      border-color: var(--success);
      color: #34d399;
    }
    .manifest-box {
      background: rgba(3, 7, 18, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 0.5rem;
      padding: 0.4rem 0.6rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.66rem;
      color: #93c5fd;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      user-select: all;
    }

    /* Quick Guide Box */
    .guide-box {
      background: var(--card-inner);
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      padding: 0.7rem 0.8rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .guide-title {
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .guide-steps {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }
    .guide-step {
      display: flex;
      align-items: flex-start;
      gap: 0.4rem;
      font-size: 0.7rem;
      line-height: 1.35;
      color: var(--text-muted);
    }
    .step-num {
      width: 1rem;
      height: 1rem;
      border-radius: 50%;
      background: rgba(14, 165, 233, 0.15);
      border: 1px solid rgba(14, 165, 233, 0.3);
      color: #38bdf8;
      font-size: 0.58rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 0.05rem;
    }

    /* Bottom Mini Footer */
    .bottom-bar {
      text-align: center;
      font-size: 0.64rem;
      color: var(--text-sub);
      padding: 0.1rem 0;
      flex-shrink: 0;
    }

    /* Toast */
    .toast {
      position: fixed;
      bottom: 1.25rem;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: #0f172a;
      border: 1px solid var(--primary);
      color: #f8fafc;
      font-size: 0.76rem;
      font-weight: 500;
      padding: 0.45rem 0.9rem;
      border-radius: 0.55rem;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.8), 0 0 15px var(--primary-glow);
      opacity: 0;
      pointer-events: none;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 999;
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    /* Mobile Responsive Adaptation */
    @media (max-width: 780px) {
      body { padding: 0.45rem 0.55rem; }
      .app-shell { gap: 0.4rem; }
      .top-bar { padding: 0.35rem 0.55rem; }
      .brand-title { font-size: 0.82rem; }
      .cockpit {
        grid-template-columns: 1fr;
        gap: 0.4rem;
      }
      .panel { padding: 0.65rem 0.75rem; gap: 0.45rem; }
      .sources-grid { display: none; }
      .guide-box { display: none; }
      .btn-install { padding: 0.65rem 0.8rem; font-size: 0.8rem; }
      .bottom-bar { display: none; }
    }
  </style>
</head>
<body>
  <div class="app-shell">
    <!-- Top Bar -->
    <header class="top-bar">
      <div class="brand">
        <div class="brand-icon">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11"/>
            <rect x="2" y="6" width="14" height="12" rx="3"/>
          </svg>
        </div>
        <span class="brand-title">Marlin Stream Addons</span>
        <span class="brand-badge">v${version}</span>
      </div>
      <div class="header-badges">
        <span class="chip green">
          <span class="dot"></span>
          <span>${activeSourcesCount} Provider Aktif</span>
        </span>
        <span class="chip">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span>Direct Stream</span>
        </span>
      </div>
    </header>

    <!-- Cockpit Body -->
    <main class="cockpit">
      <!-- Left Panel: Parameters -->
      <section class="panel">
        <!-- Access Key -->
        <div class="panel-section">
          <label class="sec-label" for="access-key-input">
            <span>Kunci Akses Keluarga</span>
            <span id="key-badge" class="source-badge ${isKeyRequired ? '' : 'off'}">${isKeyRequired ? 'Wajib' : 'Publik'}</span>
          </label>
          <div class="input-wrapper">
            <div class="input-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <input
              type="password"
              id="access-key-input"
              class="text-input"
              placeholder="${isKeyRequired ? 'Ketik Access Key keluarga...' : 'Opsional: Server terbuka untuk umum'}"
              oninput="setAccessKey(this.value)"
              autocomplete="off"
              spellcheck="false"
            />
            <button type="button" class="toggle-visibility-btn" onclick="toggleKeyVisibility()" title="Lihat sandi">
              <svg id="eye-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          </div>
          <div id="key-feedback" class="key-state-text ${isKeyRequired ? 'req' : ''}">
            ${isKeyRequired ? '⚠️ Masukkan sandi untuk mengaktifkan tombol install.' : '✓ Server dapat diakses tanpa kata sandi.'}
          </div>
        </div>

        <!-- Resolution -->
        <div class="panel-section">
          <div class="sec-label">
            <span>Batas Resolusi Maksimal</span>
            <span id="res-indicator" style="color: #38bdf8; font-size: 0.66rem; text-transform: none;">1080p FHD</span>
          </div>
          <div class="segmented-control">
            <button type="button" class="seg-btn active" id="res-1080p" onclick="setResolution('1080p')">1080p</button>
            <button type="button" class="seg-btn" id="res-720p" onclick="setResolution('720p')">720p</button>
            <button type="button" class="seg-btn" id="res-480p" onclick="setResolution('480p')">480p</button>
          </div>
        </div>

        <!-- Toggles -->
        <div class="panel-section">
          <div class="sec-label">Informasi Tampilan Stream</div>
          <div class="toggles-row">
            <label class="toggle-card">
              <div class="toggle-info">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                <span>Latency ms</span>
              </div>
              <div class="switch">
                <input type="checkbox" id="toggle-speed" checked onchange="updateManifest()">
                <span class="slider"></span>
              </div>
            </label>
            <label class="toggle-card">
              <div class="toggle-info">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                </svg>
                <span>Ukuran MB</span>
              </div>
              <div class="switch">
                <input type="checkbox" id="toggle-size" checked onchange="updateManifest()">
                <span class="slider"></span>
              </div>
            </label>
          </div>
        </div>

        <!-- Sources -->
        <div class="panel-section">
          <div class="sec-label">Provider Indexer</div>
          <div class="sources-grid">
            <div class="source-pill">
              <div>
                <div class="source-pill-name">NontonAnimeID</div>
                <div class="source-pill-sub">Anime & Kitsu Sub Indo</div>
              </div>
              <span class="source-badge ${options.nontonAnimeIdEnabled ? '' : 'off'}">${options.nontonAnimeIdEnabled ? 'Aktif' : 'Off'}</span>
            </div>
            <div class="source-pill">
              <div>
                <div class="source-pill-name">Oppadrama</div>
                <div class="source-pill-sub">Drama & Movie Asia</div>
              </div>
              <span class="source-badge ${options.oppadramaEnabled ? '' : 'off'}">${options.oppadramaEnabled ? 'Aktif' : 'Off'}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Right Panel: Activation Dock -->
      <section class="panel action-panel">
        <div class="cta-card">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 0.76rem; font-weight: 700; color: var(--text);">Pasang ke Stremio</span>
            <span style="font-size: 0.64rem; color: #38bdf8; background: rgba(14, 165, 233, 0.15); padding: 0.12rem 0.4rem; border-radius: 0.35rem; font-weight: 600;">1-Klik Sync</span>
          </div>

          <a id="btn-install" href="#" class="btn-install">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" x2="12" y1="15" y2="3"/>
            </svg>
            <span>INSTALL ADDON KE STREMIO</span>
          </a>

          <button type="button" id="btn-copy" class="btn-copy" onclick="copyManifestUrl()">
            <svg id="copy-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
            </svg>
            <span id="copy-text">Salin Link Manifest</span>
          </button>

          <div id="url-preview" class="manifest-box">Menyiapkan link manifest...</div>
        </div>

        <!-- Quick Guide -->
        <div class="guide-box">
          <div class="guide-title">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" x2="12" y1="16" y2="12"/>
              <line x1="12" x2="12.01" y1="8" y2="8"/>
            </svg>
            <span>Panduan Pasang Cepat</span>
          </div>
          <ul class="guide-steps">
            <li class="guide-step">
              <span class="step-num">1</span>
              <span><strong>Otomatis:</strong> Klik tombol biru di atas untuk membuka aplikasi Stremio langsung.</span>
            </li>
            <li class="guide-step">
              <span class="step-num">2</span>
              <span><strong>Manual di TV/HP:</strong> Salin link manifest di atas, paste ke kolom Addons di Stremio.</span>
            </li>
            <li class="guide-step">
              <span class="step-num">3</span>
              <span><strong>Katalog Kitsu:</strong> Putar judul anime dari Kitsu Catalog, stream otomatis muncul.</span>
            </li>
          </ul>
        </div>
      </section>
    </main>

    <!-- Bottom Bar -->
    <footer class="bottom-bar">
      Educational & research indexer • Tidak menyimpan atau menghosting file media apapun
    </footer>
  </div>

  <div id="toast" class="toast">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
    <span id="toast-text">Link manifest tersalin ke clipboard!</span>
  </div>

  <script>
    const requiresKey = ${isKeyRequired};
    const state = {
      key: '',
      maxResolution: '1080p',
      showSpeed: true,
      showSize: true,
    };

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
        }
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
      const ind = document.getElementById('res-indicator');
      if (ind) {
        const labelMap = { '1080p': '1080p FHD', '720p': '720p HD', '480p': '480p SD' };
        ind.innerText = labelMap[state.maxResolution] || state.maxResolution;
      }

      const speedToggle = document.getElementById('toggle-speed');
      if (speedToggle) speedToggle.checked = state.showSpeed;

      const sizeToggle = document.getElementById('toggle-size');
      if (sizeToggle) sizeToggle.checked = state.showSize;

      const keyInput = document.getElementById('access-key-input');
      if (keyInput && state.key) keyInput.value = state.key;
    }

    function setResolution(res) {
      state.maxResolution = res;
      syncDom();
      updateManifest();
    }

    function setAccessKey(val) {
      state.key = val.trim();
      const feedback = document.getElementById('key-feedback');
      if (requiresKey) {
        if (state.key.length > 0) {
          feedback.className = 'key-state-text ok';
          feedback.innerText = '✓ Kunci terisi. Tombol install diaktifkan.';
        } else {
          feedback.className = 'key-state-text req';
          feedback.innerText = '⚠️ Masukkan sandi untuk mengaktifkan tombol install.';
        }
      }
      updateManifest();
    }

    function toggleKeyVisibility() {
      const input = document.getElementById('access-key-input');
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
    }

    function updateManifest() {
      const btnInstall = document.getElementById('btn-install');
      const urlPreview = document.getElementById('url-preview');

      const speedToggle = document.getElementById('toggle-speed');
      const sizeToggle = document.getElementById('toggle-size');
      if (speedToggle) state.showSpeed = speedToggle.checked;
      if (sizeToggle) state.showSize = sizeToggle.checked;

      if (requiresKey && !state.key) {
        btnInstall.classList.add('disabled');
        urlPreview.innerText = 'Ketik Access Key di atas untuk membuka link addon.';
        window.currentManifestUrl = '';
        return;
      }

      btnInstall.classList.remove('disabled');

      const payload = { ...state };
      if (!payload.key) delete payload.key;
      const str = JSON.stringify(payload);
      const encoded = btoa(str).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
      const host = window.location.host;
      const proto = window.location.protocol;

      const httpUrl = proto + '//' + host + '/' + encoded + '/manifest.json';
      const stremioUrl = 'stremio://' + host + '/' + encoded + '/manifest.json';

      btnInstall.href = stremioUrl;
      urlPreview.innerText = httpUrl;
      window.currentManifestUrl = httpUrl;
    }

    function copyManifestUrl() {
      if (!window.currentManifestUrl) {
        showToast('Isi Access Key terlebih dahulu!');
        return;
      }
      navigator.clipboard.writeText(window.currentManifestUrl).then(() => {
        const btn = document.getElementById('btn-copy');
        const txt = document.getElementById('copy-text');
        if (btn) btn.classList.add('copied');
        if (txt) txt.innerText = 'Tersalin!';
        showToast('Link manifest tersalin ke clipboard!');
        setTimeout(() => {
          if (btn) btn.classList.remove('copied');
          if (txt) txt.innerText = 'Salin Link Manifest';
        }, 2000);
      }).catch(() => {
        showToast('Gagal menyalin otomatis, salin dari kotak teks.');
      });
    }

    function showToast(msg) {
      const toast = document.getElementById('toast');
      const text = document.getElementById('toast-text');
      if (text) text.innerText = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2500);
    }
  </script>
</body>
</html>`;
}
