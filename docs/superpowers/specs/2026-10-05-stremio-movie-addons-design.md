# Design Specification: Stremio Stream Resolver Addon (Oppadrama & Multi-Provider)

- **Date:** 2026-10-05
- **Status:** Approved (Revised v2)
- **Scope:** Architectural (New Project)
- **Target Repository:** `movie-addons`
- **Primary Runtime:** Bun (v1.4+) & TypeScript (v5+)

---

## 1. Overview & Objective

Membangun Stremio Addon berbasis **Bun** dan **TypeScript** versi terbaru yang berfungsi sebagai **Stream Resolver**. Addon ini menerima permintaan stream berdasarkan ID media standar Stremio (IMDb ID), menerjemahkan ID menjadi metadata judul dan tahun, mencari konten di situs penyedia film/drama (dimulai dari OPPADRAMA), mengekstrak sumber video/unduhan, dan mengembalikan direct stream links yang dapat diputar langsung di Stremio.

### Prinsip 1: Zero-Bandwidth Direct Streaming
Addon hanya bertindak sebagai resolver metadata dan URL. **Server addon sama sekali tidak melakukan proxy / piping byte video.** Semua link stream yang dikembalikan langsung mengarah ke CDN / server video asal (direct `.mp4` atau `.m3u8`). Jika host memerlukan header khusus (misal `Referer` atau `User-Agent`), digunakan fitur native Stremio `behaviorHints.proxyHeaders` sehingga aplikasi player Stremio di perangkat user yang mengirimkan header tersebut langsung ke server video tanpa membebani bandwidth server addon kita.

### Prinsip 2: Dynamic Domain & Environment Configuration
Situs streaming sering berganti domain atau mirror (misal dari IP ke domain baru). **Seluruh base URL provider wajib dikonfigurasi melalui environment variable (`.env` dan `.env.example`).** Perubahan domain atau alamat mirror di masa mendatang cukup dilakukan dengan mengedit file `.env` tanpa perlu mengubah kode sumber. Bun membaca file `.env` secara native tanpa memerlukan dependensi tambahan.

---

## 2. Scope & Boundaries

### In Scope
1. **Runtime & Tooling:**
   - Bun runtime native untuk eksekusi TypeScript, package manager (`bun install`), test runner (`bun test`), dan pemuatan `.env` native.
   - Pustaka open-source terverifikasi: `stremio-addon-sdk`, `cheerio`, `lru-cache`.
2. **Environment & Configuration:**
   - File `.env.example` sebagai template konfigurasi.
   - Modul `src/config.ts` untuk validasi tipe konfigurasi runtime.
   - Konfigurasi URL provider dinamis (`OPPADRAMA_BASE_URL`, dll.).
3. **Stremio Protocol Integration:**
   - Manifest (`/manifest.json`) dan stream resolver (`/stream/:type/:id.json`) untuk film (`movie`) dan serial (`series`).
4. **Metadata Resolution:**
   - Integrasi dengan Cinemeta API (`https://v3-cinemeta.strem.io/meta/:type/:id.json`) untuk lookup judul, tahun, dan nomor season/episode dari IMDb ID tanpa memerlukan API key eksternal.
5. **Provider Pertama (OPPADRAMA):**
   - Pencarian konten melalui query search WordPress (`${config.oppadramaBaseUrl}/?s={query}`).
   - Parsing hasil pencarian dan pencocokan judul + tahun.
   - Ekstraksi halaman episode/film untuk mengambil tautan server embed dan unduhan.
6. **Host Resolvers (Direct Links Only):**
   - Buzzheavier: Direct download/stream link extractor.
   - Vidhide (EarnVids): HLS/m3u8 direct playlist extractor.
   - DataNodes: Direct file resolver.
7. **Caching & Resiliensi:**
   - In-memory LRU cache untuk metadata dan hasil stream.
   - Timeout 6 detik per permintaan provider/resolver untuk mencegah timeout Stremio (10 detik).
   - Penggunaan `Promise.allSettled()` agar kegagalan satu server/provider tidak membatalkan yang lain.

### Out of Scope
1. Video streaming proxy / video byte forwarding melalui server addon kita (semua bandwidth video langsung antara client Stremio dan server hoster).
2. Katalog kustom internal di menu Discover Stremio (fokus murni pada Stream Resolver).
3. Headless browser (Puppeteer/Playwright) karena situs target menyediakan tautan statis yang dapat diparsing via Cheerio.
4. Database persisten eksternal (PostgreSQL/Redis) pada fase awal (YAGNI).

---

## 3. Tech Stack & Dependencies

- **Runtime & Package Manager:** Bun v1.4+
- **Bahasa:** TypeScript v5+ (Native execution via Bun)
- **Core Addon Framework:** `stremio-addon-sdk`
- **HTTP Client:** Bun Native `fetch`
- **HTML Parsing:** `cheerio`
- **In-Memory Cache:** `lru-cache`
- **Config Management:** Bun native `.env` loader + `src/config.ts`
- **Test Runner:** Native `bun test`

---

## 4. Environment Variables Specification

File `.env.example`:
```env
# Server Configuration
PORT=7000

# Providers Base URLs (Ubah di sini jika situs ganti domain/mirror)
OPPADRAMA_BASE_URL=http://212.86.121.175

# Cache Settings (in seconds)
CACHE_STREAM_TTL=3600
CACHE_META_TTL=86400

# Request Timeout (in milliseconds)
REQUEST_TIMEOUT_MS=6000
```

Modul `src/config.ts`:
```typescript
export interface AppConfig {
  port: number;
  oppadramaBaseUrl: string;
  cacheStreamTtl: number;
  cacheMetaTtl: number;
  requestTimeoutMs: number;
}

export const config: AppConfig = {
  port: Number(process.env.PORT) || 7000,
  oppadramaBaseUrl: (process.env.OPPADRAMA_BASE_URL || 'http://212.86.121.175').replace(/\/+$/, ''),
  cacheStreamTtl: Number(process.env.CACHE_STREAM_TTL) || 3600,
  cacheMetaTtl: Number(process.env.CACHE_META_TTL) || 86400,
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS) || 6000,
};
```

---

## 5. System Architecture & Directory Structure

```
movie-addons/
├── package.json
├── tsconfig.json
├── bun.lockb (atau bun.lock)
├── .env.example                     # Template konfigurasi environment
├── .env                             # File konfigurasi lokal (git-ignored)
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-10-05-stremio-movie-addons-design.md
├── src/
│   ├── index.ts                     # HTTP Server entry point (stremio-addon-sdk / Bun)
│   ├── addon.ts                     # Inisialisasi addonBuilder & manifest
│   ├── config.ts                    # Konfigurasi aplikasi dari environment variable
│   ├── types.ts                     # Definisi TypeScript interfaces & types
│   ├── services/
│   │   ├── cinemeta.ts              # Service konversi IMDb ID ke title/year
│   │   └── cache.ts                 # Service in-memory LRU cache
│   ├── providers/
│   │   ├── base.ts                  # Abstract BaseProvider interface
│   │   ├── registry.ts              # Manager multi-provider
│   │   └── oppadrama/
│   │       ├── index.ts             # Implementasi OppadramaProvider (menggunakan config.oppadramaBaseUrl)
│   │       └── parser.ts            # Parser HTML Cheerio khusus Oppadrama
│   └── resolvers/
│       ├── base.ts                  # Abstract BaseResolver interface
│       ├── registry.ts              # Resolver manager
│       ├── buzzheavier.ts           # Resolver Buzzheavier (Direct download URL)
│       ├── vidhide.ts               # Resolver Vidhide/EarnVids (Direct m3u8)
│       └── datanodes.ts             # Resolver DataNodes (Direct URL)
└── test/
    ├── fixtures/                    # Mock HTML respons Oppadrama
    │   ├── search_result.html
    │   └── movie_detail.html
    ├── oppadrama.test.ts            # Unit test parser dengan fixtures (bun test)
    └── live.smoke.ts                # Smoke test jaringan langsung (bun run test/live.smoke.ts)
```

---

## 6. Component Contracts & Interfaces

### 6.1 Media Query & Stream Data Types (`src/types.ts`)
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
  name: string;        // Contoh: "[Oppadrama] 1080p"
  title: string;       // Contoh: "One Night Only (2026) - Buzzheavier"
  url: string;         // DIRECT streamable URL ke CDN host (.mp4 / .m3u8), BUKAN proxy server kita
  quality?: string;    // "1080p" | "720p" | "480p"
  behaviorHints?: {
    notWebReady?: boolean;
    proxyHeaders?: {
      request?: Record<string, string>; // Header client Stremio (misal: "Referer", "User-Agent")
    };
  };
}
```

### 6.2 Base Provider Interface (`src/providers/base.ts`)
```typescript
import { MediaItemQuery, StreamResult } from '../types';

export interface BaseProvider {
  readonly name: string;
  readonly baseUrl: string;
  
  /**
   * Mencari konten dan mengekstrak semua direct stream yang valid
   */
  getStreams(query: MediaItemQuery): Promise<StreamResult[]>;
}
```

### 6.3 Base Resolver Interface (`src/resolvers/base.ts`)
```typescript
import { StreamResult } from '../types';

export interface BaseResolver {
  readonly name: string;
  /**
   * Mengecek apakah resolver ini dapat menangani URL tertentu
   */
  canResolve(url: string): boolean;
  
  /**
   * Mengekstrak direct link video dari halaman hosting tanpa proxy
   */
  resolve(url: string, qualityHint?: string): Promise<StreamResult | null>;
}
```

---

## 7. Detailed Data Flow & Direct Streaming

1. **Incoming Request:**
   Stremio client mengirim: `GET /stream/{type}/{id}.json`.
   Contoh: `/stream/movie/tt1234567.json` atau `/stream/series/tt1234567:1:2.json`.

2. **Cache Check:**
   Cek apakah key `stream:{type}:{id}` ada di `cacheService`. Jika ada, langsung kembalikan `{ streams: [...] }`.

3. **Metadata Resolution:**
   Jika belum ada di cache:
   - Panggil `cinemetaService.getMeta(type, imdbId)`.
   - Mengambil `title` (misal "One Night Only") dan `year` (2026).
   - Ekstrak nomor season dan episode jika type adalah `series`.

4. **Provider Execution:**
   - Addon memanggil `providerRegistry.getStreams(query)`.
   - Seluruh provider dijalankan serentak menggunakan `Promise.allSettled()`.
   - Setiap provider memiliki batas waktu timeout sesuai `config.requestTimeoutMs` (`AbortSignal.timeout(config.requestTimeoutMs)`).

5. **Oppadrama Provider Workflow:**
   - **Search:** Request `GET ${config.oppadramaBaseUrl}/?s={encodeURIComponent(title)}`.
   - **Matching:** Cheerio mem-parse daftar elemen post. Mencari judul yang paling cocok dan memiliki kecocokan tahun rilis.
   - **Detail Retrieval:** Mengambil HTML halaman konten film atau episode yang spesifik.
   - **Host Extraction:** Mem-parse tabel link unduhan (`.links_table` / server list) dan embed iframe (`abyssplayer`, `filelions`).
   - **Resolving:** Meneruskan setiap link ke `resolverRegistry.resolve(link)`.

6. **Direct Link Resolution (Zero Bandwidth):**
   - Resolver mengekstrak tautan CDN langsung dari hoster (misal: redirect URL dari Buzzheavier atau `.m3u8` master playlist dari Vidhide).
   - URL yang dihasilkan dimasukkan ke field `url` pada object `StreamResult`.
   - Jika hoster mewajibkan referer, tambahkan ke `behaviorHints.proxyHeaders.request`:
     ```json
     {
       "url": "https://direct-cdn.buzzheavier.com/video.mp4",
       "behaviorHints": {
         "proxyHeaders": {
           "request": {
             "Referer": "https://buzzheavier.com/"
           }
         }
       }
     }
     ```
   - Server addon **tidak mengalirkan** byte video apapun.

7. **Consolidation & Response:**
   - Mengumpulkan seluruh `StreamResult` yang berhasil di-resolve.
   - Menyimpan hasil ke dalam cache LRU dengan TTL `config.cacheStreamTtl`.
   - Mengembalikan `{ streams: StreamResult[] }` ke Stremio.

---

## 8. Error Handling & Edge Cases

1. **Timeout Handling:** Jika provider atau resolver melebihi batas timeout, request dibatalkan menggunakan `AbortController` agar respons tetap dikirim ke Stremio sebelum batas 10 detik.
2. **Media Not Found:** Jika judul tidak ditemukan pada situs target, kembalikan `{ streams: [] }` secara bersih (kode HTTP 200).
3. **Dead / Expired Host Links:** Jika link hosting mengembalikan 404 atau captcha, resolver mengembalikan `null` dan provider mengabaikan link tersebut tanpa memutus stream lainnya.
4. **Cinemeta Downtime:** Jika Cinemeta tidak dapat dihubungi, request stream gagal secara aman dengan mengembalikan `{ streams: [] }` dan mencatat log warning.

---

## 9. Testing & Verification Plan

1. **Unit Tests via `bun test` (`test/oppadrama.test.ts`):**
   - Menggunakan fixture HTML statis (`test/fixtures/search_result.html`, `test/fixtures/movie_detail.html`).
   - Memastikan selector Cheerio mengekstrak link unduhan (Buzzheavier, Vidhide, dll) dan iframe dengan benar.
   - Memastikan logic matching judul dan tahun bekerja tepat sasaran (tidak salah memilih film dengan judul serupa).
2. **Live Smoke Test (`test/live.smoke.ts`):**
   - Dijalankan via `bun run test/live.smoke.ts`.
   - Melakukan query live ke URL yang didefinisikan di `.env` (`OPPADRAMA_BASE_URL`) mencari film "One Night Only (2026)".
   - Memastikan endpoint mengembalikan minimal 1 stream yang memiliki direct URL valid.
3. **Stremio Addon Contract Verification:**
   - Memastikan respons `/manifest.json` valid sesuai schema Stremio Addon.
   - Memastikan respons `/stream/movie/tt...json` mengembalikan struktur `{ streams: [] }` yang valid tanpa server video proxying.
