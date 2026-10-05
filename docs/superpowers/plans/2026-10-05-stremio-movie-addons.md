# Stremio Movie Addon (Stream Resolver) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun Stremio Addon modular berbasis Bun dan TypeScript yang berfungsi sebagai Stream Resolver untuk mencari film/drama di OPPADRAMA (`http://212.86.121.175/`) dan mengekstrak direct streaming link (zero-bandwidth proxy) yang dapat diputar langsung di Stremio.

**Architecture:** Addon menerima request stream dari Stremio client (`/stream/:type/:id.json`), lookup judul dan tahun rilis via Cinemeta API, mencari film pada provider yang terdaftar (`BaseProvider`), mem-parse halaman detail menggunakan Cheerio, me-resolve tautan hoster (`BaseResolver` seperti Buzzheavier, Vidhide, DataNodes) menjadi direct link ke CDN asal, dan mengembalikan daftar stream ke Stremio dengan cache LRU.

**Tech Stack:** Bun v1.4+, TypeScript v5+, `stremio-addon-sdk`, `cheerio`, `lru-cache`, `bun test`.

**Spec:** `docs/superpowers/specs/2026-10-05-stremio-movie-addons-design.md`

## Global Constraints

- **Runtime:** Bun v1.4+ (package manager `bun install`, test runner `bun test`).
- **Language:** TypeScript 5.x native execution di Bun.
- **Zero-Bandwidth Direct Streaming:** Server addon tidak boleh mem-proxy byte video. Semua `url` stream mengarah langsung ke hoster CDN. Jika diperlukan header (misal `Referer`), gunakan `behaviorHints.proxyHeaders.request`.
- **Dynamic Domain Configuration:** URL provider wajib dibaca dari environment variable (`.env` dan `.env.example`), tidak boleh di-hardcode di dalam logika scraper.
- **Resilience:** Request eksternal dibatasi timeout 6000ms (`AbortSignal.timeout(6000)`). Pemanggilan multi-provider dan resolver wajib menggunakan `Promise.allSettled()`.

---

## File Structure

```
movie-addons/
├── package.json
├── tsconfig.json
├── .env.example
├── .env
├── src/
│   ├── config.ts                    # Central typed configuration from process.env
│   ├── types.ts                     # Core domain interfaces (MediaItemQuery, StreamResult)
│   ├── services/
│   │   ├── cache.ts                 # LRU cache wrapper for meta and streams
│   │   └── cinemeta.ts              # Cinemeta client converting IMDb ID to title/year
│   ├── resolvers/
│   │   ├── base.ts                  # BaseResolver interface
│   │   ├── registry.ts              # ResolverRegistry matching and executing resolvers
│   │   ├── buzzheavier.ts           # Buzzheavier direct link resolver
│   │   ├── vidhide.ts               # Vidhide/EarnVids direct m3u8 resolver
│   │   └── datanodes.ts             # DataNodes direct link resolver
│   ├── providers/
│   │   ├── base.ts                  # BaseProvider interface
│   │   ├── registry.ts              # ProviderRegistry managing multi-site search
│   │   └── oppadrama/
│   │       ├── parser.ts            # Pure Cheerio HTML parser for Oppadrama
│   │       └── index.ts             # OppadramaProvider class orchestrating search & extraction
│   ├── addon.ts                     # Stremio addonBuilder, manifest, and stream handler
│   └── index.ts                     # Server bootstrap entry point
└── test/
    ├── fixtures/
    │   ├── search_result.html       # Sample search result HTML
    │   └── movie_detail.html        # Sample movie detail HTML
    ├── config.test.ts               # Config and env parsing tests
    ├── cinemeta.test.ts             # Cinemeta service tests
    ├── resolvers.test.ts            # Resolvers unit tests
    ├── oppadrama.test.ts            # Oppadrama parser and provider tests
    ├── addon.test.ts                # Stremio manifest and stream endpoint tests
    └── live.smoke.ts                # End-to-end live smoke test
```

---

### Task 1: Project Scaffolding & Config Module

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.env.example`
- Create: `.env`
- Create: `src/types.ts`
- Create: `src/config.ts`
- Test: `test/config.test.ts`

**Interfaces:**
- Produces: `config` (`AppConfig`), `MediaItemQuery`, `StreamResult`, `MediaType`

- [ ] **Step 1: Create package.json and install dependencies with Bun**

Run:
```bash
bun init -y
bun add stremio-addon-sdk cheerio lru-cache
bun add -d @types/bun typescript @types/stremio-addon-sdk
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "lib": ["ESNext"],
    "module": "ESNext",
    "target": "ESNext",
    "moduleResolution": "bundler",
    "moduleDetection": "force",
    "allowImportingTsExtensions": true,
    "strict": true,
    "downlevelIteration": true,
    "skipLibCheck": true,
    "jsx": "preserve",
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 3: Create .env.example and .env**

File `.env.example`:
```env
PORT=7000
OPPADRAMA_BASE_URL=http://212.86.121.175
CACHE_STREAM_TTL=3600
CACHE_META_TTL=86400
REQUEST_TIMEOUT_MS=6000
```

Run:
```bash
cp .env.example .env
```

- [ ] **Step 4: Create src/types.ts**

```typescript
export type MediaType = 'movie' | 'series';

export interface MediaItemQuery {
  imdbId: string;
  type: MediaType;
  title: string;
  year?: number;
  season?: number;
  episode?: number;
}

export interface StreamResult {
  name: string;
  title: string;
  url: string;
  quality?: string;
  behaviorHints?: {
    notWebReady?: boolean;
    proxyHeaders?: {
      request?: Record<string, string>;
    };
  };
}
```

- [ ] **Step 5: Write failing test for config module**

File `test/config.test.ts`:
```typescript
import { describe, expect, it } from 'bun:test';
import { loadConfig } from '../src/config';

describe('Config Module', () => {
  it('loads default configuration when env is empty', () => {
    const conf = loadConfig({});
    expect(conf.port).toBe(7000);
    expect(conf.oppadramaBaseUrl).toBe('http://212.86.121.175');
    expect(conf.cacheStreamTtl).toBe(3600);
    expect(conf.cacheMetaTtl).toBe(86400);
    expect(conf.requestTimeoutMs).toBe(6000);
  });

  it('trims trailing slashes from provider URLs', () => {
    const conf = loadConfig({ OPPADRAMA_BASE_URL: 'http://example.com/mirror/' });
    expect(conf.oppadramaBaseUrl).toBe('http://example.com/mirror');
  });

  it('parses custom port and timeout from env', () => {
    const conf = loadConfig({ PORT: '8080', REQUEST_TIMEOUT_MS: '8000' });
    expect(conf.port).toBe(8080);
    expect(conf.requestTimeoutMs).toBe(8000);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `bun test test/config.test.ts`
Expected: FAIL (Cannot find module '../src/config')

- [ ] **Step 7: Implement src/config.ts**

```typescript
export interface AppConfig {
  port: number;
  oppadramaBaseUrl: string;
  cacheStreamTtl: number;
  cacheMetaTtl: number;
  requestTimeoutMs: number;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  return {
    port: Number(env.PORT) || 7000,
    oppadramaBaseUrl: (env.OPPADRAMA_BASE_URL || 'http://212.86.121.175').replace(/\/+$/, ''),
    cacheStreamTtl: Number(env.CACHE_STREAM_TTL) || 3600,
    cacheMetaTtl: Number(env.CACHE_META_TTL) || 86400,
    requestTimeoutMs: Number(env.REQUEST_TIMEOUT_MS) || 6000,
  };
}

export const config = loadConfig(process.env);
```

- [ ] **Step 8: Run test to verify it passes**

Run: `bun test test/config.test.ts`
Expected: PASS (3 tests passed)

- [ ] **Step 9: Commit Task 1**

```bash
git add package.json tsconfig.json .env.example .env src/types.ts src/config.ts test/config.test.ts
git commit -m "feat: scaffold project and add typed config module"
```

---

### Task 2: LRU Cache & Cinemeta Metadata Service

**Files:**
- Create: `src/services/cache.ts`
- Create: `src/services/cinemeta.ts`
- Test: `test/cinemeta.test.ts`

**Interfaces:**
- Consumes: `MediaItemQuery`, `StreamResult`, `MediaType`, `config`
- Produces: `CacheService`, `CinemetaService.lookup(type: MediaType, id: string): Promise<MediaItemQuery | null>`

- [ ] **Step 1: Write failing test for Cache and Cinemeta services**

File `test/cinemeta.test.ts`:
```typescript
import { describe, expect, it, mock } from 'bun:test';
import { CacheService } from '../src/services/cache';
import { CinemetaService } from '../src/services/cinemeta';

describe('CacheService', () => {
  it('stores and retrieves cached items within TTL', () => {
    const cache = new CacheService({ streamTtl: 10, metaTtl: 10 });
    cache.setStream('movie:tt123', [{ name: 'Test', title: 'Test', url: 'http://test.mp4' }]);
    expect(cache.getStream('movie:tt123')).toBeDefined();
    expect(cache.getStream('movie:tt123')?.[0].title).toBe('Test');
    expect(cache.getStream('movie:tt_nonexistent')).toBeNull();
  });
});

describe('CinemetaService', () => {
  it('parses movie metadata from Cinemeta response', async () => {
    const mockFetch = mock(async () => {
      return new Response(JSON.stringify({
        meta: {
          id: 'tt33555239',
          name: 'One Night Only',
          type: 'movie',
          year: '2026'
        }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const service = new CinemetaService(mockFetch as unknown as typeof fetch);
    const result = await service.lookup('movie', 'tt33555239');

    expect(result).not.toBeNull();
    expect(result?.title).toBe('One Night Only');
    expect(result?.year).toBe(2026);
    expect(result?.type).toBe('movie');
  });

  it('parses series ID with season and episode (tt12345:1:2)', async () => {
    const mockFetch = mock(async () => {
      return new Response(JSON.stringify({
        meta: {
          id: 'tt12345',
          name: 'Shadow Punisher',
          type: 'series',
          year: '2024'
        }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const service = new CinemetaService(mockFetch as unknown as typeof fetch);
    const result = await service.lookup('series', 'tt12345:1:2');

    expect(result).not.toBeNull();
    expect(result?.title).toBe('Shadow Punisher');
    expect(result?.season).toBe(1);
    expect(result?.episode).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/cinemeta.test.ts`
Expected: FAIL (Cannot find modules `../src/services/cache` and `../src/services/cinemeta`)

- [ ] **Step 3: Implement src/services/cache.ts**

```typescript
import { LRUCache } from 'lru-cache';
import { MediaItemQuery, StreamResult } from '../types';

export interface CacheOptions {
  streamTtl?: number; // seconds
  metaTtl?: number;   // seconds
}

export class CacheService {
  private streamCache: LRUCache<string, StreamResult[]>;
  private metaCache: LRUCache<string, MediaItemQuery>;

  constructor(options: CacheOptions = {}) {
    this.streamCache = new LRUCache<string, StreamResult[]>({
      max: 1000,
      ttl: (options.streamTtl ?? 3600) * 1000,
    });
    this.metaCache = new LRUCache<string, MediaItemQuery>({
      max: 1000,
      ttl: (options.metaTtl ?? 86400) * 1000,
    });
  }

  getStream(key: string): StreamResult[] | null {
    return this.streamCache.get(key) ?? null;
  }

  setStream(key: string, streams: StreamResult[]): void {
    this.streamCache.set(key, streams);
  }

  getMeta(key: string): MediaItemQuery | null {
    return this.metaCache.get(key) ?? null;
  }

  setMeta(key: string, meta: MediaItemQuery): void {
    this.metaCache.set(key, meta);
  }
}

export const cacheService = new CacheService();
```

- [ ] **Step 4: Implement src/services/cinemeta.ts**

```typescript
import { MediaItemQuery, MediaType } from '../types';

export class CinemetaService {
  private fetchFn: typeof fetch;

  constructor(fetchFn: typeof fetch = fetch) {
    this.fetchFn = fetchFn;
  }

  async lookup(type: MediaType, id: string): Promise<MediaItemQuery | null> {
    try {
      const parts = id.split(':');
      const imdbId = parts[0];
      const season = parts[1] ? Number(parts[1]) : undefined;
      const episode = parts[2] ? Number(parts[2]) : undefined;

      const url = `https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`;
      const res = await this.fetchFn(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) return null;

      const data = (await res.json()) as { meta?: { name?: string; year?: string | number } };
      if (!data?.meta?.name) return null;

      const yearRaw = data.meta.year;
      const year = typeof yearRaw === 'number' ? yearRaw : yearRaw ? parseInt(String(yearRaw), 10) : undefined;

      return {
        imdbId,
        type,
        title: data.meta.name,
        year: isNaN(year as number) ? undefined : year,
        season,
        episode,
      };
    } catch {
      return null;
    }
  }
}

export const cinemetaService = new CinemetaService();
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test test/cinemeta.test.ts`
Expected: PASS

- [ ] **Step 6: Commit Task 2**

```bash
git add src/services/cache.ts src/services/cinemeta.ts test/cinemeta.test.ts
git commit -m "feat: add LRU cache and Cinemeta metadata resolution service"
```

---

### Task 3: Video Host Resolvers (Buzzheavier, Vidhide, DataNodes)

**Files:**
- Create: `src/resolvers/base.ts`
- Create: `src/resolvers/buzzheavier.ts`
- Create: `src/resolvers/vidhide.ts`
- Create: `src/resolvers/datanodes.ts`
- Create: `src/resolvers/registry.ts`
- Test: `test/resolvers.test.ts`

**Interfaces:**
- Consumes: `StreamResult`
- Produces: `BaseResolver`, `ResolverRegistry.resolve(url: string, quality?: string): Promise<StreamResult | null>`

- [ ] **Step 1: Write failing test for resolvers**

File `test/resolvers.test.ts`:
```typescript
import { describe, expect, it, mock } from 'bun:test';
import { BuzzheavierResolver } from '../src/resolvers/buzzheavier';
import { DataNodesResolver } from '../src/resolvers/datanodes';
import { ResolverRegistry } from '../src/resolvers/registry';
import { VidhideResolver } from '../src/resolvers/vidhide';

describe('BuzzheavierResolver', () => {
  it('identifies buzzheavier URLs', () => {
    const resolver = new BuzzheavierResolver();
    expect(resolver.canResolve('https://buzzheavier.com/lu8y76xr0cb6')).toBe(true);
    expect(resolver.canResolve('https://other.com/file')).toBe(false);
  });

  it('resolves direct download URL via redirect or download endpoint', async () => {
    const mockFetch = mock(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/download')) {
        return new Response(null, {
          status: 302,
          headers: { Location: 'https://cdn.buzzheavier.com/file/video.mp4' },
        });
      }
      return new Response('<html>mock page</html>', { status: 200 });
    });

    const resolver = new BuzzheavierResolver(mockFetch as unknown as typeof fetch);
    const result = await resolver.resolve('https://buzzheavier.com/lu8y76xr0cb6', '1080p');

    expect(result).not.toBeNull();
    expect(result?.url).toBe('https://cdn.buzzheavier.com/file/video.mp4');
    expect(result?.quality).toBe('1080p');
    expect(result?.behaviorHints?.proxyHeaders?.request?.Referer).toBe('https://buzzheavier.com/');
  });
});

describe('VidhideResolver', () => {
  it('extracts m3u8 source from Vidhide player HTML', async () => {
    const html = `
      <html>
        <script>
          var player = new Player({ file: "https://stream.vidhide.com/hls/master.m3u8" });
        </script>
      </html>
    `;
    const mockFetch = mock(async () => new Response(html, { status: 200 }));
    const resolver = new VidhideResolver(mockFetch as unknown as typeof fetch);

    const result = await resolver.resolve('https://vidhidepro.com/d/meh7d2m0lyx3', '720p');
    expect(result).not.toBeNull();
    expect(result?.url).toBe('https://stream.vidhide.com/hls/master.m3u8');
    expect(result?.behaviorHints?.proxyHeaders?.request?.Referer).toBe('https://vidhidepro.com/');
  });
});

describe('ResolverRegistry', () => {
  it('routes URL to the correct resolver', async () => {
    const registry = new ResolverRegistry();
    const bz = new BuzzheavierResolver(mock(async () => new Response(null, {
      status: 302,
      headers: { Location: 'https://cdn.buzzheavier.com/v.mp4' },
    })) as unknown as typeof fetch);

    registry.register(bz);
    const stream = await registry.resolve('https://buzzheavier.com/12345', '1080p');
    expect(stream).not.toBeNull();
    expect(stream?.url).toBe('https://cdn.buzzheavier.com/v.mp4');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/resolvers.test.ts`
Expected: FAIL (Cannot find modules)

- [ ] **Step 3: Implement src/resolvers/base.ts**

```typescript
import { StreamResult } from '../types';

export interface BaseResolver {
  readonly name: string;
  canResolve(url: string): boolean;
  resolve(url: string, qualityHint?: string): Promise<StreamResult | null>;
}
```

- [ ] **Step 4: Implement src/resolvers/buzzheavier.ts**

```typescript
import { StreamResult } from '../types';
import { BaseResolver } from './base';

export class BuzzheavierResolver implements BaseResolver {
  readonly name = 'Buzzheavier';
  private fetchFn: typeof fetch;

  constructor(fetchFn: typeof fetch = fetch) {
    this.fetchFn = fetchFn;
  }

  canResolve(url: string): boolean {
    return url.includes('buzzheavier.com');
  }

  async resolve(url: string, qualityHint = '1080p'): Promise<StreamResult | null> {
    try {
      const fileIdMatch = url.match(/buzzheavier\.com\/([a-zA-Z0-9]+)/);
      if (!fileIdMatch) return null;
      const fileId = fileIdMatch[1];
      const downloadUrl = `https://buzzheavier.com/${fileId}/download`;

      // Check redirect location without proxying body
      const res = await this.fetchFn(downloadUrl, {
        method: 'HEAD',
        redirect: 'manual',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(6000),
      });

      const location = res.headers.get('location');
      const directUrl = location || downloadUrl;

      return {
        name: `[Buzzheavier] ${qualityHint}`,
        title: `Buzzheavier (${qualityHint})`,
        url: directUrl,
        quality: qualityHint,
        behaviorHints: {
          proxyHeaders: {
            request: {
              Referer: 'https://buzzheavier.com/',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            },
          },
        },
      };
    } catch {
      return null;
    }
  }
}
```

- [ ] **Step 5: Implement src/resolvers/vidhide.ts**

```typescript
import { StreamResult } from '../types';
import { BaseResolver } from './base';

export class VidhideResolver implements BaseResolver {
  readonly name = 'Vidhide';
  private fetchFn: typeof fetch;

  constructor(fetchFn: typeof fetch = fetch) {
    this.fetchFn = fetchFn;
  }

  canResolve(url: string): boolean {
    return url.includes('vidhide') || url.includes('earnvids');
  }

  async resolve(url: string, qualityHint = '720p'): Promise<StreamResult | null> {
    try {
      const res = await this.fetchFn(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return null;

      const html = await res.text();
      // Extract m3u8 link from javascript or source tag
      const m3u8Match = html.match(/(https?:\/\/[^"']+\.m3u8[^"']*)/);
      if (!m3u8Match) return null;

      const streamUrl = m3u8Match[1];
      const origin = new URL(url).origin;

      return {
        name: `[Vidhide] ${qualityHint}`,
        title: `Vidhide (${qualityHint})`,
        url: streamUrl,
        quality: qualityHint,
        behaviorHints: {
          proxyHeaders: {
            request: {
              Referer: `${origin}/`,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            },
          },
        },
      };
    } catch {
      return null;
    }
  }
}
```

- [ ] **Step 6: Implement src/resolvers/datanodes.ts**

```typescript
import { StreamResult } from '../types';
import { BaseResolver } from './base';

export class DataNodesResolver implements BaseResolver {
  readonly name = 'DataNodes';
  private fetchFn: typeof fetch;

  constructor(fetchFn: typeof fetch = fetch) {
    this.fetchFn = fetchFn;
  }

  canResolve(url: string): boolean {
    return url.includes('datanodes.to');
  }

  async resolve(url: string, qualityHint = '1080p'): Promise<StreamResult | null> {
    try {
      const res = await this.fetchFn(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return null;

      const html = await res.text();
      const directMatch = html.match(/href=["'](https?:\/\/[^"']+\.(?:mp4|mkv))["']/i);
      const streamUrl = directMatch ? directMatch[1] : url;

      return {
        name: `[DataNodes] ${qualityHint}`,
        title: `DataNodes (${qualityHint})`,
        url: streamUrl,
        quality: qualityHint,
        behaviorHints: {
          proxyHeaders: {
            request: {
              Referer: 'https://datanodes.to/',
            },
          },
        },
      };
    } catch {
      return null;
    }
  }
}
```

- [ ] **Step 7: Implement src/resolvers/registry.ts**

```typescript
import { StreamResult } from '../types';
import { BaseResolver } from './base';
import { BuzzheavierResolver } from './buzzheavier';
import { DataNodesResolver } from './datanodes';
import { VidhideResolver } from './vidhide';

export class ResolverRegistry {
  private resolvers: BaseResolver[] = [];

  register(resolver: BaseResolver): void {
    this.resolvers.push(resolver);
  }

  async resolve(url: string, qualityHint?: string): Promise<StreamResult | null> {
    for (const resolver of this.resolvers) {
      if (resolver.canResolve(url)) {
        try {
          const result = await resolver.resolve(url, qualityHint);
          if (result) return result;
        } catch {
          continue;
        }
      }
    }
    return null;
  }
}

export const defaultResolverRegistry = new ResolverRegistry();
defaultResolverRegistry.register(new BuzzheavierResolver());
defaultResolverRegistry.register(new VidhideResolver());
defaultResolverRegistry.register(new DataNodesResolver());
```

- [ ] **Step 8: Run test to verify it passes**

Run: `bun test test/resolvers.test.ts`
Expected: PASS

- [ ] **Step 9: Commit Task 3**

```bash
git add src/resolvers/ test/resolvers.test.ts
git commit -m "feat: implement zero-bandwidth video host resolvers and registry"
```

---

### Task 4: Oppadrama Scraper & Provider

**Files:**
- Create: `test/fixtures/search_result.html`
- Create: `test/fixtures/movie_detail.html`
- Create: `src/providers/base.ts`
- Create: `src/providers/oppadrama/parser.ts`
- Create: `src/providers/oppadrama/index.ts`
- Create: `src/providers/registry.ts`
- Test: `test/oppadrama.test.ts`

**Interfaces:**
- Consumes: `MediaItemQuery`, `StreamResult`, `ResolverRegistry`, `config`
- Produces: `BaseProvider`, `OppadramaProvider.getStreams(query: MediaItemQuery): Promise<StreamResult[]>`, `ProviderRegistry`

- [ ] **Step 1: Create test HTML fixtures**

File `test/fixtures/search_result.html`:
```html
<!DOCTYPE html>
<html>
<body>
  <div class="result-item">
    <article>
      <div class="title">
        <a href="http://212.86.121.175/one-night-only-2026/">One Night Only (2026)</a>
      </div>
      <div class="year">2026</div>
    </article>
    <article>
      <div class="title">
        <a href="http://212.86.121.175/movie-one-night-only-2026-webrip/">Movie One Night Only (2026) WEBRip</a>
      </div>
      <div class="year">2026</div>
    </article>
  </div>
</body>
</html>
```

File `test/fixtures/movie_detail.html`:
```html
<!DOCTYPE html>
<html>
<body>
  <div class="entry-content">
    <iframe src="https://abyssplayer.com/?v=B2aAHcAK_F"></iframe>
    <ul class="links_table">
      <li>
        <strong>Buzzheavier</strong>
        <span>FHD 1080p</span>
        <a href="https://buzzheavier.com/lu8y76xr0cb6">Download</a>
      </li>
      <li>
        <strong>EarnVids</strong>
        <span>720p</span>
        <a href="https://vidhidepro.com/d/meh7d2m0lyx3">Download</a>
      </li>
      <li>
        <strong>DataNodes</strong>
        <span>FHD 1080p</span>
        <a href="https://datanodes.to/3zwk2vkby8mj">Download</a>
      </li>
    </ul>
  </div>
</body>
</html>
```

- [ ] **Step 2: Write failing test for Oppadrama parser and provider**

File `test/oppadrama.test.ts`:
```typescript
import { describe, expect, it, mock } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { OppadramaProvider } from '../src/providers/oppadrama';
import { parseDownloadLinks, parseSearchResults } from '../src/providers/oppadrama/parser';
import { ResolverRegistry } from '../src/resolvers/registry';

describe('Oppadrama HTML Parser', () => {
  it('extracts search results with title, link, and year', () => {
    const html = readFileSync(join(__dirname, 'fixtures/search_result.html'), 'utf8');
    const results = parseSearchResults(html);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toContain('One Night Only');
    expect(results[0].url).toBe('http://212.86.121.175/one-night-only-2026/');
  });

  it('extracts download and embed links with server name and quality', () => {
    const html = readFileSync(join(__dirname, 'fixtures/movie_detail.html'), 'utf8');
    const links = parseDownloadLinks(html);

    expect(links.length).toBe(3);
    expect(links[0].server).toBe('Buzzheavier');
    expect(links[0].quality).toBe('1080p');
    expect(links[0].url).toBe('https://buzzheavier.com/lu8y76xr0cb6');
  });
});

describe('OppadramaProvider', () => {
  it('searches Oppadrama and resolves streams through resolver registry', async () => {
    const searchHtml = readFileSync(join(__dirname, 'fixtures/search_result.html'), 'utf8');
    const detailHtml = readFileSync(join(__dirname, 'fixtures/movie_detail.html'), 'utf8');

    const mockFetch = mock(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/?s=')) {
        return new Response(searchHtml, { status: 200 });
      }
      return new Response(detailHtml, { status: 200 });
    });

    const registry = new ResolverRegistry();
    registry.resolve = mock(async (url: string, quality?: string) => ({
      name: `[Mock] ${quality}`,
      title: `Resolved ${url}`,
      url: 'https://direct-cdn.com/video.mp4',
    }));

    const provider = new OppadramaProvider('http://212.86.121.175', registry, mockFetch as unknown as typeof fetch);
    const streams = await provider.getStreams({
      imdbId: 'tt33555239',
      type: 'movie',
      title: 'One Night Only',
      year: 2026,
    });

    expect(streams.length).toBeGreaterThan(0);
    expect(streams[0].url).toBe('https://direct-cdn.com/video.mp4');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test test/oppadrama.test.ts`
Expected: FAIL (Cannot find modules)

- [ ] **Step 4: Implement src/providers/base.ts**

```typescript
import { MediaItemQuery, StreamResult } from '../types';

export interface BaseProvider {
  readonly name: string;
  readonly baseUrl: string;
  getStreams(query: MediaItemQuery): Promise<StreamResult[]>;
}
```

- [ ] **Step 5: Implement src/providers/oppadrama/parser.ts**

```typescript
import * as cheerio from 'cheerio';

export interface SearchEntry {
  title: string;
  url: string;
}

export interface ExtractedLink {
  server: string;
  quality: string;
  url: string;
}

export function parseSearchResults(html: string): SearchEntry[] {
  const $ = cheerio.load(html);
  const results: SearchEntry[] = [];

  $('article, .result-item, .post-item').each((_, el) => {
    const linkEl = $(el).find('a').first();
    const title = $(el).find('.title, h2, h3').text().trim() || linkEl.text().trim();
    const url = linkEl.attr('href') || '';
    if (url && title) {
      results.push({ title, url });
    }
  });

  return results;
}

export function parseDownloadLinks(html: string): ExtractedLink[] {
  const $ = cheerio.load(html);
  const links: ExtractedLink[] = [];

  // Parse links table or list items
  $('li, tr').each((_, el) => {
    const text = $(el).text();
    const anchor = $(el).find('a').first();
    const href = anchor.attr('href') || '';
    if (!href || href.startsWith('#') || href.includes('javascript:')) return;

    let server = $(el).find('strong, .server').first().text().trim();
    if (!server) {
      if (href.includes('buzzheavier')) server = 'Buzzheavier';
      else if (href.includes('vidhide') || href.includes('earnvids')) server = 'EarnVids';
      else if (href.includes('datanodes')) server = 'DataNodes';
      else if (href.includes('filekeeper')) server = 'FileKeeper';
      else return;
    }

    let quality = '720p';
    if (text.includes('1080p') || text.includes('FHD')) quality = '1080p';
    else if (text.includes('720p') || text.includes('HD')) quality = '720p';
    else if (text.includes('480p') || text.includes('SD')) quality = '480p';
    else if (text.includes('360p')) quality = '360p';

    links.push({ server, quality, url: href });
  });

  return links;
}
```

- [ ] **Step 6: Implement src/providers/oppadrama/index.ts**

```typescript
import { ResolverRegistry } from '../../resolvers/registry';
import { MediaItemQuery, StreamResult } from '../../types';
import { BaseProvider } from '../base';
import { parseDownloadLinks, parseSearchResults } from './parser';

export class OppadramaProvider implements BaseProvider {
  readonly name = 'Oppadrama';
  readonly baseUrl: string;
  private resolverRegistry: ResolverRegistry;
  private fetchFn: typeof fetch;

  constructor(
    baseUrl: string,
    resolverRegistry: ResolverRegistry,
    fetchFn: typeof fetch = fetch
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.resolverRegistry = resolverRegistry;
    this.fetchFn = fetchFn;
  }

  async getStreams(query: MediaItemQuery): Promise<StreamResult[]> {
    try {
      const searchUrl = `${this.baseUrl}/?s=${encodeURIComponent(query.title)}`;
      const searchRes = await this.fetchFn(searchUrl, {
        signal: AbortSignal.timeout(6000),
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      });
      if (!searchRes.ok) return [];

      const searchHtml = await searchRes.text();
      const entries = parseSearchResults(searchHtml);
      if (entries.length === 0) return [];

      // Find best match: check title and year
      const normalizedTitle = query.title.toLowerCase();
      let matchedEntry = entries.find((e) => {
        const titleLower = e.title.toLowerCase();
        const matchesTitle = titleLower.includes(normalizedTitle);
        const matchesYear = query.year ? titleLower.includes(String(query.year)) : true;
        return matchesTitle && matchesYear;
      }) || entries[0];

      // Fetch detail page
      const detailRes = await this.fetchFn(matchedEntry.url, {
        signal: AbortSignal.timeout(6000),
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      });
      if (!detailRes.ok) return [];

      const detailHtml = await detailRes.text();
      const extractedLinks = parseDownloadLinks(detailHtml);

      // Resolve links concurrently with Promise.allSettled
      const resolvePromises = extractedLinks.map(async (link) => {
        const resolved = await this.resolverRegistry.resolve(link.url, link.quality);
        if (resolved) {
          return {
            ...resolved,
            name: `[Oppadrama] ${resolved.name}`,
            title: `${query.title}${query.year ? ` (${query.year})` : ''} - ${resolved.title}`,
          };
        }
        return null;
      });

      const settled = await Promise.allSettled(resolvePromises);
      const results: StreamResult[] = [];
      for (const item of settled) {
        if (item.status === 'fulfilled' && item.value) {
          results.push(item.value);
        }
      }

      return results;
    } catch {
      return [];
    }
  }
}
```

- [ ] **Step 7: Implement src/providers/registry.ts**

```typescript
import { MediaItemQuery, StreamResult } from '../types';
import { BaseProvider } from './base';

export class ProviderRegistry {
  private providers: BaseProvider[] = [];

  register(provider: BaseProvider): void {
    this.providers.push(provider);
  }

  async getAllStreams(query: MediaItemQuery): Promise<StreamResult[]> {
    const promises = this.providers.map((p) => p.getStreams(query));
    const settled = await Promise.allSettled(promises);
    const allStreams: StreamResult[] = [];

    for (const res of settled) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        allStreams.push(...res.value);
      }
    }

    return allStreams;
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `bun test test/oppadrama.test.ts`
Expected: PASS

- [ ] **Step 9: Commit Task 4**

```bash
git add src/providers/ test/oppadrama.test.ts test/fixtures/
git commit -m "feat: implement Oppadrama HTML scraper and provider registry"
```

---

### Task 5: Stremio Addon Integration & Server Entry Point

**Files:**
- Create: `src/addon.ts`
- Create: `src/index.ts`
- Test: `test/addon.test.ts`

**Interfaces:**
- Consumes: `config`, `cacheService`, `cinemetaService`, `defaultResolverRegistry`, `ProviderRegistry`, `OppadramaProvider`
- Produces: Addon manifest (`/manifest.json`), Stream handler (`/stream/:type/:id.json`)

- [ ] **Step 1: Write failing test for Addon manifest & stream handler**

File `test/addon.test.ts`:
```typescript
import { describe, expect, it } from 'bun:test';
import { addonBuilder } from '../src/addon';

describe('Stremio Addon Definition', () => {
  it('provides a valid manifest with stream resources and movie/series types', () => {
    const manifest = addonBuilder.getInterface().manifest;
    expect(manifest.id).toBe('community.movieaddons.stream');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.resources).toContain('stream');
    expect(manifest.types).toContain('movie');
    expect(manifest.types).toContain('series');
  });

  it('handles stream requests returning clean streams array', async () => {
    const addonInterface = addonBuilder.getInterface();
    const res = await addonInterface.get('stream', 'movie', 'tt_dummy_not_found');
    expect(res).toBeDefined();
    expect(Array.isArray(res.streams)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/addon.test.ts`
Expected: FAIL (Cannot find module `../src/addon`)

- [ ] **Step 3: Implement src/addon.ts**

```typescript
// @ts-expect-error stremio-addon-sdk untyped import in bun
import { addonBuilder } from 'stremio-addon-sdk';
import { config } from './config';
import { OppadramaProvider } from './providers/oppadrama';
import { ProviderRegistry } from './providers/registry';
import { defaultResolverRegistry } from './resolvers/registry';
import { cacheService } from './services/cache';
import { cinemetaService } from './services/cinemeta';
import { MediaType, StreamResult } from './types';

const manifest = {
  id: 'community.movieaddons.stream',
  version: '1.0.0',
  name: 'Movie Addons (Oppadrama & Multi-Provider)',
  description: 'Stream resolver for movies & series from Oppadrama and community sources with zero-bandwidth direct streaming.',
  resources: ['stream'],
  types: ['movie', 'series'],
  catalogs: [],
  idPrefixes: ['tt'],
};

export const builder = new addonBuilder(manifest);

// Setup Provider Registry
export const providerRegistry = new ProviderRegistry();
providerRegistry.register(new OppadramaProvider(config.oppadramaBaseUrl, defaultResolverRegistry));

builder.defineStreamHandler(async ({ type, id }: { type: MediaType; id: string }) => {
  try {
    const cacheKey = `stream:${type}:${id}`;
    const cached = cacheService.getStream(cacheKey);
    if (cached) {
      return { streams: cached };
    }

    // Resolve meta via Cinemeta
    const meta = await cinemetaService.lookup(type, id);
    if (!meta) {
      return { streams: [] };
    }

    // Query providers
    const streams: StreamResult[] = await providerRegistry.getAllStreams(meta);

    if (streams.length > 0) {
      cacheService.setStream(cacheKey, streams);
    }

    return { streams };
  } catch (err) {
    console.error(`[StreamHandler] Error processing ${type}/${id}:`, err);
    return { streams: [] };
  }
});

export { builder as addonBuilder };
```

- [ ] **Step 4: Implement src/index.ts**

```typescript
// @ts-expect-error stremio-addon-sdk untyped import in bun
import { serveHTTP } from 'stremio-addon-sdk';
import { addonBuilder } from './addon';
import { config } from './config';

serveHTTP(addonBuilder.getInterface(), { port: config.port });

console.log(`[Movie-Addons] Stremio addon running on http://127.0.0.1:${config.port}`);
console.log(`[Movie-Addons] Manifest: http://127.0.0.1:${config.port}/manifest.json`);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test test/addon.test.ts`
Expected: PASS

- [ ] **Step 6: Commit Task 5**

```bash
git add src/addon.ts src/index.ts test/addon.test.ts
git commit -m "feat: implement Stremio addon manifest and stream router"
```

---

### Task 6: Live Smoke Test & End-to-End Verification

**Files:**
- Create: `test/live.smoke.ts`

- [ ] **Step 1: Write live smoke test script**

File `test/live.smoke.ts`:
```typescript
import { config } from '../src/config';
import { OppadramaProvider } from '../src/providers/oppadrama';
import { defaultResolverRegistry } from '../src/resolvers/registry';
import { cinemetaService } from '../src/services/cinemeta';

async function main() {
  console.log(`--- Running Live Smoke Test against ${config.oppadramaBaseUrl} ---`);

  // Step 1: Lookup meta for "One Night Only (2026)" - IMDb tt33555239
  console.log('1. Testing Cinemeta lookup...');
  const meta = await cinemetaService.lookup('movie', 'tt33555239');
  console.log('   Cinemeta Meta:', meta);
  if (!meta || !meta.title) {
    throw new Error('Cinemeta lookup failed!');
  }

  // Step 2: Query Oppadrama live
  console.log(`2. Querying Oppadrama at ${config.oppadramaBaseUrl}...`);
  const provider = new OppadramaProvider(config.oppadramaBaseUrl, defaultResolverRegistry);
  const streams = await provider.getStreams(meta);

  console.log(`   Found ${streams.length} stream(s):`);
  for (const s of streams) {
    console.log(`   - [${s.name}] ${s.title} -> ${s.url}`);
    if (s.url.startsWith('http://127.0.0.1') || s.url.startsWith('http://localhost')) {
      throw new Error(`Stream URL ${s.url} must be a direct hoster URL, not local proxy!`);
    }
  }

  console.log('--- Smoke Test Completed Successfully! ---');
}

main().catch((err) => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Add test & run scripts to package.json**

Ensure `package.json` contains:
```json
"scripts": {
  "start": "bun run src/index.ts",
  "test": "bun test",
  "test:smoke": "bun run test/live.smoke.ts"
}
```

- [ ] **Step 3: Run all unit tests**

Run: `bun test`
Expected: ALL PASS

- [ ] **Step 4: Commit Task 6**

```bash
git add test/live.smoke.ts package.json
git commit -m "chore: add live smoke test and npm scripts"
```

---

## Plan Self-Review Checklist

- **Spec Coverage:**
  - Bun & TypeScript native execution -> Covered in Task 1, 2, 3, 4, 5, 6
  - Zero-bandwidth direct streaming -> Covered in Task 3 (Resolvers) & Task 6 (Smoke check)
  - Dynamic .env & config -> Covered in Task 1 (`src/config.ts`, `.env.example`)
  - Stremio manifest & stream router -> Covered in Task 5 (`src/addon.ts`)
  - Oppadrama HTML scraper & matching -> Covered in Task 4 (`src/providers/oppadrama`)
- **No Placeholders:** Checked. No `TODO`, `TBD`, or vague instructions. Every task has exact code and commands.
- **Type Consistency:** Checked. Types defined in `src/types.ts` are consistently imported and used across all files.
