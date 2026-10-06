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
  <title>Marlin Stream - Stremio Addon</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <style>
    :root {
      --bg: #05070e;
      --card-bg: rgba(13, 18, 32, 0.85);
      --card-border: rgba(255, 255, 255, 0.08);
      --inner-bg: rgba(20, 27, 48, 0.6);
      --inner-border: rgba(255, 255, 255, 0.07);
      --accent: #0ea5e9;
      --accent-hover: #38bdf8;
      --accent-glow: rgba(14, 165, 233, 0.3);
      --purple: #8b5cf6;
      --purple-glow: rgba(139, 92, 246, 0.25);
      --emerald: #10b981;
      --emerald-glow: rgba(16, 185, 129, 0.2);
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
      align-items: center;
      justify-content: center;
      padding: 1rem;
      position: relative;
      background:
        radial-gradient(900px circle at 50% 0%, rgba(14, 165, 233, 0.12), transparent 70%),
        radial-gradient(700px circle at 85% 90%, rgba(139, 92, 246, 0.08), transparent 70%),
        #05070e;
    }

    /* Main Console Chassis */
    .console {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 980px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      box-shadow:
        0 24px 64px -12px rgba(0, 0, 0, 0.8),
        0 0 0 1px rgba(255, 255, 255, 0.05),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* Console Top Header */
    .header {
      padding: 0.95rem 1.5rem;
      border-bottom: 1px solid var(--card-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(255, 255, 255, 0.02);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .brand-logo {
      width: 34px;
      height: 34px;
      background: linear-gradient(135deg, #0284c7, #8b5cf6);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px var(--accent-glow);
      color: #fff;
    }

    .brand-name {
      font-size: 1.05rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--text);
    }

    .brand-tag {
      font-size: 0.68rem;
      font-weight: 600;
      color: var(--accent);
      background: rgba(14, 165, 233, 0.12);
      border: 1px solid rgba(14, 165, 233, 0.25);
      padding: 0.15rem 0.5rem;
      border-radius: 6px;
      margin-left: 0.4rem;
    }

    .header-pills {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .pill {
      font-size: 0.72rem;
      font-weight: 500;
      padding: 0.25rem 0.65rem;
      border-radius: 999px;
      background: var(--inner-bg);
      border: 1px solid var(--inner-border);
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .pill.active {
      background: rgba(16, 185, 129, 0.1);
      border-color: rgba(16, 185, 129, 0.25);
      color: #34d399;
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
      box-shadow: 0 0 8px currentColor;
    }

    /* Cockpit Body (2 Columns with optimal 1.15fr : 0.85fr ratio) */
    .cockpit {
      padding: 1.35rem 1.5rem;
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 1.5rem;
      align-items: stretch;
    }

    .col {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 0.95rem;
    }

    /* Section Component */
    .section-title {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-sub);
      margin-bottom: 0.4rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    /* Key Input */
    .input-box {
      position: relative;
      display: flex;
      align-items: center;
    }

    .input-box svg.icon-left {
      position: absolute;
      left: 0.85rem;
      color: var(--text-sub);
      pointer-events: none;
    }

    .access-input {
      width: 100%;
      background: var(--inner-bg);
      border: 1px solid var(--inner-border);
      border-radius: 10px;
      padding: 0.65rem 2.2rem 0.65rem 2.4rem;
      font-size: 0.84rem;
      color: var(--text);
      outline: none;
      transition: all 0.2s ease;
    }

    .access-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-glow);
      background: rgba(20, 28, 50, 0.8);
    }

    .btn-eye {
      position: absolute;
      right: 0.75rem;
      background: none;
      border: none;
      color: var(--text-sub);
      cursor: pointer;
      display: flex;
      align-items: center;
      padding: 0.2rem;
    }

    .btn-eye:hover { color: var(--text); }

    .input-caption {
      font-size: 0.7rem;
      margin-top: 0.35rem;
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    .input-caption.warn { color: #fb7185; }
    .input-caption.ok { color: #34d399; }

    /* Segmented Control */
    .segmented {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      background: var(--inner-bg);
      border: 1px solid var(--inner-border);
      border-radius: 10px;
      padding: 0.25rem;
      gap: 0.25rem;
    }

    .seg-btn {
      background: none;
      border: none;
      border-radius: 7px;
      padding: 0.45rem 0.2rem;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.15s ease;
      text-align: center;
    }

    .seg-btn:hover { color: var(--text); }

    .seg-btn.active {
      background: var(--accent);
      color: #fff;
      box-shadow: 0 2px 8px var(--accent-glow);
    }

    /* Toggle Switches - Clean, spacious row */
    .toggles-group {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.65rem;
    }

    .toggle-item {
      background: var(--inner-bg);
      border: 1px solid var(--inner-border);
      border-radius: 10px;
      padding: 0.6rem 0.85rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      cursor: pointer;
      user-select: none;
      transition: border-color 0.2s;
    }

    .toggle-item:hover {
      border-color: rgba(255, 255, 255, 0.15);
    }

    .toggle-label {
      font-size: 0.78rem;
      font-weight: 500;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 0.45rem;
      white-space: nowrap;
    }

    .toggle-switch {
      position: relative;
      width: 32px;
      height: 18px;
      flex-shrink: 0;
    }

    .toggle-switch input { opacity: 0; width: 0; height: 0; }

    .toggle-slider {
      position: absolute;
      inset: 0;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 999px;
      cursor: pointer;
      transition: 0.2s;
    }

    .toggle-slider::before {
      content: "";
      position: absolute;
      height: 14px;
      width: 14px;
      left: 2px;
      bottom: 2px;
      background: #fff;
      border-radius: 50%;
      transition: 0.2s;
    }

    input:checked + .toggle-slider { background: var(--accent); }
    input:checked + .toggle-slider::before { transform: translateX(14px); }

    /* Sources list - Clean single-line items */
    .sources-list {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
    }

    .source-row {
      background: var(--inner-bg);
      border: 1px solid var(--inner-border);
      border-radius: 10px;
      padding: 0.55rem 0.85rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .source-left {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      min-width: 0;
    }

    .source-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .source-dot.on {
      background: #34d399;
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
    }

    .source-dot.off {
      background: #64748b;
    }

    .source-name {
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--text);
      white-space: nowrap;
    }

    .source-desc {
      font-size: 0.68rem;
      color: var(--text-sub);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .source-pill-badge {
      font-size: 0.65rem;
      font-weight: 600;
      padding: 0.15rem 0.5rem;
      border-radius: 5px;
      flex-shrink: 0;
    }

    .source-pill-badge.on {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34d399;
    }

    .source-pill-badge.off {
      background: rgba(100, 116, 139, 0.15);
      border: 1px solid rgba(100, 116, 139, 0.25);
      color: var(--text-sub);
    }

    /* RIGHT COLUMN: ACTION DOCK */
    .action-panel {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 0.85rem;
    }

    .action-box {
      background: linear-gradient(145deg, rgba(14, 165, 233, 0.1), rgba(139, 92, 246, 0.08));
      border: 1px solid rgba(14, 165, 233, 0.25);
      border-radius: 14px;
      padding: 1.15rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .action-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .action-title {
      font-size: 0.86rem;
      font-weight: 700;
      color: var(--text);
    }

    .action-badge {
      font-size: 0.68rem;
      font-weight: 600;
      color: #38bdf8;
      background: rgba(14, 165, 233, 0.15);
      border: 1px solid rgba(14, 165, 233, 0.3);
      padding: 0.15rem 0.5rem;
      border-radius: 6px;
    }

    /* Big CTA Button */
    .btn-cta {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      background: linear-gradient(135deg, #0284c7 0%, #0ea5e9 50%, #8b5cf6 100%);
      color: #fff;
      border: none;
      border-radius: 10px;
      padding: 0.85rem 1.2rem;
      font-size: 0.88rem;
      font-weight: 700;
      letter-spacing: 0.01em;
      text-decoration: none;
      cursor: pointer;
      box-shadow:
        0 6px 20px var(--accent-glow),
        inset 0 1px 0 rgba(255, 255, 255, 0.25);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .btn-cta:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 26px rgba(14, 165, 233, 0.45);
      filter: brightness(1.08);
    }

    .btn-cta:active {
      transform: translateY(1px);
    }

    .btn-cta.disabled {
      opacity: 0.35 !important;
      pointer-events: none !important;
      filter: grayscale(0.8);
      box-shadow: none;
    }

    .btn-secondary {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
      background: var(--inner-bg);
      border: 1px solid var(--inner-border);
      border-radius: 9px;
      padding: 0.6rem 0.9rem;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.06);
      border-color: rgba(255, 255, 255, 0.15);
      color: var(--text);
    }

    .btn-secondary.copied {
      border-color: var(--emerald);
      color: #34d399;
      background: rgba(16, 185, 129, 0.08);
    }

    .url-chip {
      background: rgba(3, 7, 18, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 8px;
      padding: 0.5rem 0.75rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.7rem;
      color: #7dd3fc;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      user-select: all;
    }

    /* Stremio Instruction Card */
    .steps-card {
      background: var(--inner-bg);
      border: 1px solid var(--inner-border);
      border-radius: 12px;
      padding: 1rem 1.1rem;
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      flex: 1;
      justify-content: center;
    }

    .steps-title {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .step-item {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      font-size: 0.72rem;
      color: var(--text-muted);
      line-height: 1.4;
    }

    .step-num {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: rgba(14, 165, 233, 0.15);
      border: 1px solid rgba(14, 165, 233, 0.3);
      color: #38bdf8;
      font-size: 0.62rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 1px;
    }

    /* Footer */
    .footer {
      padding: 0.65rem 1.5rem;
      border-top: 1px solid var(--card-border);
      background: rgba(255, 255, 255, 0.01);
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.68rem;
      color: var(--text-sub);
    }

    /* Toast */
    .toast {
      position: fixed;
      bottom: 1.5rem;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: #0f172a;
      border: 1px solid var(--accent);
      color: #f8fafc;
      font-size: 0.78rem;
      font-weight: 600;
      padding: 0.5rem 1.1rem;
      border-radius: 8px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8), 0 0 15px var(--accent-glow);
      opacity: 0;
      pointer-events: none;
      transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 999;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    /* Responsive Mobile Breakpoint */
    @media (max-width: 820px) {
      body { padding: 0.5rem; }
      .console { border-radius: 14px; max-height: 98dvh; }
      .header { padding: 0.65rem 0.9rem; }
      .brand-logo { width: 28px; height: 28px; }
      .brand-name { font-size: 0.9rem; }
      .header-pills { display: none; }
      .cockpit {
        grid-template-columns: 1fr;
        padding: 0.85rem;
        gap: 0.75rem;
        overflow-y: auto;
      }
      .col { gap: 0.65rem; }
      .sources-list { display: none; }
      .steps-card { display: none; }
      .action-box { padding: 0.85rem; gap: 0.6rem; }
      .btn-cta { padding: 0.75rem; font-size: 0.82rem; }
      .footer { display: none; }
    }
  </style>
</head>
<body>
  <div class="console">
    <!-- Top Header -->
    <header class="header">
      <div class="brand">
        <div class="brand-logo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11"/>
            <rect x="2" y="6" width="14" height="12" rx="3"/>
          </svg>
        </div>
        <div>
          <span class="brand-name">Marlin Stream</span>
          <span class="brand-tag">v${version}</span>
        </div>
      </div>
      <div class="header-pills">
        <span class="pill active">
          <span class="status-dot"></span>
          <span>${activeSourcesCount} Provider Aktif</span>
        </span>
        <span class="pill">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span>Direct Stream</span>
        </span>
      </div>
    </header>

    <!-- Cockpit Body -->
    <main class="cockpit">
      <!-- Left Column: Controls -->
      <div class="col">
        <!-- Access Key Card -->
        <div>
          <div class="section-title">
            <span>Sandi Akses Keluarga</span>
            <span id="key-badge" style="font-size: 0.65rem; color: ${isKeyRequired ? '#fb7185' : '#34d399'}; font-weight: 600;">
              ${isKeyRequired ? '🔒 Wajib Diisi' : '🔓 Publik'}
            </span>
          </div>
          <div class="input-box">
            <svg class="icon-left" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input
              type="password"
              id="access-key-input"
              class="access-input"
              placeholder="${isKeyRequired ? 'Ketik sandi akses...' : 'Opsional (tanpa sandi)'}"
              oninput="setAccessKey(this.value)"
              autocomplete="off"
              spellcheck="false"
            />
            <button type="button" class="btn-eye" onclick="toggleKeyVisibility()" title="Lihat kata sandi">
              <svg id="eye-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          </div>
          <div id="key-caption" class="input-caption ${isKeyRequired ? 'warn' : 'ok'}">
            ${isKeyRequired ? '⚠️ Masukkan sandi untuk membuka link install.' : '✓ Siap dipasang tanpa kata sandi.'}
          </div>
        </div>

        <!-- Resolution Selector -->
        <div>
          <div class="section-title">
            <span>Maksimal Resolusi</span>
            <span id="res-badge" style="font-size: 0.68rem; color: #38bdf8; font-weight: 600; text-transform: none;">1080p FHD</span>
          </div>
          <div class="segmented">
            <button type="button" class="seg-btn active" id="res-1080p" onclick="setResolution('1080p')">1080p</button>
            <button type="button" class="seg-btn" id="res-720p" onclick="setResolution('720p')">720p</button>
            <button type="button" class="seg-btn" id="res-480p" onclick="setResolution('480p')">480p</button>
          </div>
        </div>

        <!-- Stream Information Toggles -->
        <div>
          <div class="section-title">Informasi Tampilan Stream</div>
          <div class="toggles-group">
            <label class="toggle-item">
              <span class="toggle-label">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                <span>Latency ms</span>
              </span>
              <span class="toggle-switch">
                <input type="checkbox" id="toggle-speed" checked onchange="updateManifest()">
                <span class="toggle-slider"></span>
              </span>
            </label>
            <label class="toggle-item">
              <span class="toggle-label">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                </svg>
                <span>Ukuran MB</span>
              </span>
              <span class="toggle-switch">
                <input type="checkbox" id="toggle-size" checked onchange="updateManifest()">
                <span class="toggle-slider"></span>
              </span>
            </label>
          </div>
        </div>

        <!-- Active Sources (Clean Horizontal Rows) -->
        <div>
          <div class="section-title">Sumber Indexer Aktif</div>
          <div class="sources-list">
            <div class="source-row">
              <div class="source-left">
                <span class="source-dot ${options.nontonAnimeIdEnabled ? 'on' : 'off'}"></span>
                <span class="source-name">NontonAnimeID</span>
                <span class="source-desc">• Anime & Kitsu</span>
              </div>
              <span class="source-pill-badge ${options.nontonAnimeIdEnabled ? 'on' : 'off'}">
                ${options.nontonAnimeIdEnabled ? 'Aktif' : 'Off'}
              </span>
            </div>
            <div class="source-row">
              <div class="source-left">
                <span class="source-dot ${options.oppadramaEnabled ? 'on' : 'off'}"></span>
                <span class="source-name">Oppadrama</span>
                <span class="source-desc">• Drama & Film Asia</span>
              </div>
              <span class="source-pill-badge ${options.oppadramaEnabled ? 'on' : 'off'}">
                ${options.oppadramaEnabled ? 'Aktif' : 'Off'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Stremio Action Card -->
      <div class="col action-panel">
        <div class="action-box">
          <div class="action-header">
            <span class="action-title">Aktivasi ke Stremio</span>
            <span class="action-badge">1-Klik Sync</span>
          </div>

          <a id="btn-install" href="#" class="btn-cta">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" x2="12" y1="15" y2="3"/>
            </svg>
            <span>INSTALL ADDON KE STREMIO</span>
          </a>

          <button type="button" id="btn-copy" class="btn-secondary" onclick="copyManifestUrl()">
            <svg id="copy-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
            </svg>
            <span id="copy-text">Salin Link Manifest</span>
          </button>

          <div id="url-preview" class="url-chip">Menyiapkan link manifest...</div>
        </div>

        <!-- Quick Steps (Tightly balanced) -->
        <div class="steps-card">
          <div class="steps-title">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" x2="12" y1="16" y2="12"/>
              <line x1="12" x2="12.01" y1="8" y2="8"/>
            </svg>
            <span>Panduan Pasang Stremio</span>
          </div>
          <div class="step-item">
            <span class="step-num">1</span>
            <span><strong>Otomatis:</strong> Klik tombol di atas untuk sinkronisasi ke aplikasi Stremio langsung.</span>
          </div>
          <div class="step-item">
            <span class="step-num">2</span>
            <span><strong>Manual di TV/HP:</strong> Salin link manifest di atas, paste ke menu Addons di Stremio.</span>
          </div>
          <div class="step-item">
            <span class="step-num">3</span>
            <span><strong>Katalog:</strong> Putar judul dari Kitsu (Anime) atau Oppadrama, stream otomatis muncul.</span>
          </div>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="footer">
      <span>Zero-bandwidth direct streaming indexer</span>
      <span>Tidak menyimpan file media di server</span>
    </footer>
  </div>

  <!-- Toast Feedback -->
  <div id="toast" class="toast">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
    <span id="toast-msg">Link manifest tersalin ke clipboard!</span>
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
      const badge = document.getElementById('res-badge');
      if (badge) {
        const labelMap = { '1080p': '1080p FHD', '720p': '720p HD', '480p': '480p SD' };
        badge.innerText = labelMap[state.maxResolution] || state.maxResolution;
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
      const caption = document.getElementById('key-caption');
      if (requiresKey) {
        if (state.key.length > 0) {
          caption.className = 'input-caption ok';
          caption.innerText = '✓ Sandi terisi. Tombol install siap.';
        } else {
          caption.className = 'input-caption warn';
          caption.innerText = '⚠️ Masukkan sandi untuk membuka link install.';
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
        urlPreview.innerText = 'Ketik sandi akses untuk membuat link...';
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
        showToast('Isi Sandi Akses terlebih dahulu!');
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
        showToast('Gagal menyalin otomatis, salin dari kotak.');
      });
    }

    function showToast(msg) {
      const toast = document.getElementById('toast');
      const text = document.getElementById('toast-msg');
      if (text) text.innerText = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2500);
    }
  </script>
</body>
</html>`;
}
