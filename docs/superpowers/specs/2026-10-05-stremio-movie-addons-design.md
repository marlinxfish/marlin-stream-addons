# Design Specification: Stremio Stream Resolver Addon (Oppadrama & Multi-Provider)

- **Date:** 2026-10-05
- **Status:** Approved
- **Scope:** Architectural (New Project)
- **Target Repository:** `movie-addons`

---

## 1. Overview & Objective

Membangun Stremio Addon berbasis Node.js / Bun (TypeScript) yang berfungsi sebagai **Stream Resolver**. Addon ini menerima permintaan stream berdasarkan ID media standar Stremio (IMDb ID), menerjemahkan ID menjadi metadata judul dan tahun, mencari konten di situs penyedia film/drama (dimulai dari `http://212.86.121.175/` - OPPADRAMA), mengekstrak sumber video/unduhan, dan mengembalikan direct stream links yang dapat diputar langsung di Stremio.

Arsitektur didesain modular dengan antarmuka penyedia (`BaseProvider`) dan resolver (`BaseResolver`) agar penambahan situs target baru di masa mendatang tidak mengubah logika inti addon.

---

## 2. Scope & Boundaries

### In Scope
1. **Stremio Protocol Integration**: Manifest (`/manifest.json`) dan stream resolver (`/stream/:type/:id.json`) untuk film (`movie`) dan serial (`series`).
2. **Metadata Resolution**: Integrasi dengan Cinemeta API (`https://v3-cinemeta.strem.io/meta/:type/:id.json`) untuk lookup judul, tahun, dan nomor season/episode dari IMDb ID tanpa memerlukan API key eksternal.
3. **Provider Pertama (OPPADRAMA)**:
   - Pencarian konten melalui query search WordPress (`http://212.86.121.175/?s={query}`).
   - Parsing hasil pencarian dan pencocokan judul + tahun.
   - Ekstraksi halaman episode/film untuk mengambil tautan server embed dan unduhan.
4. **Host Resolvers**:
   - Buzzheavier: Direct download/stream extractor.
   - Vidhide (EarnVids): HLS/m3u8 stream extractor.
   - DataNodes: Direct file resolver.
5. **Caching & Resiliensi**:
   - In-memory LRU cache untuk metadata dan hasil stream.
   - Timeout 6 detik per permintaan provider/resolver untuk mencegah timeout Stremio (10 detik).
   - Penggunaan `Promise.allSettled()` agar kegagalan satu server/provider tidak membatalkan yang lain.

### Out of Scope
1. Katalog kustom internal di menu Discover Stremio (user memilih mode Stream Resolver Saja).
2. Headless browser (Puppeteer/Playwright) karena situs target menyediakan tautan statis yang dapat diparsing via Cheerio.
3. Database persisten eksternal (PostgreSQL/Redis) pada fase awal (YAGNI).

---

## 3. Tech Stack & Dependencies

- **Runtime:** Node.js v24+ / Bun v1.4+
- **Bahasa:** TypeScript 5.x
- **Core Addon SDK:** `stremio-addon-sdk`
- **HTTP Client:** Native `fetch` (didukung Node 18+ dan Bun)
- **HTML Parsing:** `cheerio`
- **Caching:** `lru-cache`
- **Testing:** `vitest` atau Node built-in test runner (`node:test`)

---

## 4. System Architecture & Directory Structure

```
movie-addons/
├── package.json
├── tsconfig.json
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-10-05-stremio-movie-addons-design.md
├── src/
│   ├── index.ts                     # HTTP Server entry point (addon.serve)
│   ├── addon.ts                     # Inisialisasi addonBuilder & manifest
│   ├── types.ts                     # Definisi TypeScript interfaces & types
│   ├── services/
│   │   ├── cinemeta.ts              # Service konversi IMDb ID ke title/year
│   │   └── cache.ts                 # Service in-memory LRU cache
│   ├── providers/
│   │   ├── base.ts                  # Abstract BaseProvider interface
│   │   ├── registry.ts              # Manager multi-provider
│   │   └── oppadrama/
│   │       ├── index.ts             # Implementasi OppadramaProvider
│   │       └── parser.ts            # Parser HTML Cheerio khusus Oppadrama
│   └── resolvers/
│       ├── base.ts                  # Abstract BaseResolver interface
│       ├── registry.ts              # Resolver manager
│       ├── buzzheavier.ts           # Resolver Buzzheavier
│       ├── vidhide.ts               # Resolver Vidhide/EarnVids
│       └── datanodes.ts             # Resolver DataNodes
└── test/
    ├── fixtures/                    # Mock HTML respons Oppadrama
    │   ├── search_result.html
    │   └── movie_detail.html
    ├── oppadrama.test.ts            # Unit test parser dengan fixtures
    └── live.smoke.ts                # Smoke test jaringan langsung
```

---

## 5. Component Contracts & Interfaces

### 5.1 Media Query & Stream Data Types (`src/types.ts`)
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
  url: string;         // URL direct .mp4 atau .m3u8
  quality?: string;    // "1080p" | "720p" | "480p"
  behaviorHints?: {
    notWebReady?: boolean;
    proxyHeaders?: Record<string, string>;
  };
}
```

### 5.2 Base Provider Interface (`src/providers/base.ts`)
```typescript
import { MediaItemQuery, StreamResult } from '../types';

export interface BaseProvider {
  readonly name: string;
  readonly baseUrl: string;
  
  /**
   * Mencari konten dan mengekstrak semua stream yang valid
   */
  getStreams(query: MediaItemQuery): Promise<StreamResult[]>;
}
```

### 5.3 Base Resolver Interface (`src/resolvers/base.ts`)
```typescript
import { StreamResult } from '../types';

export interface BaseResolver {
  readonly name: string;
  /**
   * Mengecek apakah resolver ini dapat menangani URL tertentu
   */
  canResolve(url: string): boolean;
  
  /**
   * Mengekstrak direct link video dari halaman hosting
   */
  resolve(url: string, qualityHint?: string): Promise<StreamResult | null>;
}
```

---

## 6. Detailed Data Flow

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
   - Setiap provider memiliki batas waktu timeout 6 detik (`AbortSignal.timeout(6000)`).

5. **Oppadrama Provider Workflow:**
   - **Search:** Request `GET http://212.86.121.175/?s={encodeURIComponent(title)}`.
   - **Matching:** Cheerio mem-parse daftar elemen post. Mencari judul yang paling cocok dan memiliki kecocokan tahun rilis.
   - **Detail Retrieval:** Mengambil HTML halaman konten film atau episode yang spesifik.
   - **Host Extraction:** Mem-parse tabel link unduhan (`.links_table` / server list) dan embed iframe (`abyssplayer`, `filelions`).
   - **Resolving:** Meneruskan setiap link ke `resolverRegistry.resolve(link)`.

6. **Consolidation & Response:**
   - Mengumpulkan seluruh `StreamResult` yang berhasil di-resolve.
   - Menyimpan hasil ke dalam cache LRU dengan TTL 1 jam.
   - Mengembalikan `{ streams: StreamResult[] }` ke Stremio.

---

## 7. Error Handling & Edge Cases

1. **Timeout Handling:** Jika provider atau resolver melebihi batas 6 detik, request dibatalkan menggunakan `AbortController` agar respons tetap dikirim ke Stremio sebelum batas 10 detik.
2. **Media Not Found:** Jika judul tidak ditemukan pada situs target, kembalikan `{ streams: [] }` secara bersih (kode HTTP 200).
3. **Dead / Expired Host Links:** Jika link hosting mengembalikan 404 atau captcha, resolver mengembalikan `null` dan provider mengabaikan link tersebut tanpa memutus stream lainnya.
4. **Cinemeta Downtime:** Jika Cinemeta tidak dapat dihubungi, request stream gagal secara aman dengan mengembalikan `{ streams: [] }` dan mencatat log warning.

---

## 8. Testing & Verification Plan

1. **Unit Tests (`test/oppadrama.test.ts`):**
   - Menggunakan fixture HTML statis (`test/fixtures/search_result.html`, `test/fixtures/movie_detail.html`).
   - Memastikan selector Cheerio mengekstrak link unduhan (Buzzheavier, Vidhide, dll) dan iframe dengan benar.
   - Memastikan logic matching judul dan tahun bekerja tepat sasaran (tidak salah memilih film dengan judul serupa).
2. **Live Smoke Test (`test/live.smoke.ts`):**
   - Melakukan query live ke `http://212.86.121.175/` mencari film "One Night Only (2026)".
   - Memastikan endpoint mengembalikan minimal 1 stream yang memiliki URL valid.
3. **Stremio Addon Contract Verification:**
   - Memastikan respons `/manifest.json` valid sesuai schema Stremio Addon.
   - Memastikan respons `/stream/movie/tt...json` mengembalikan struktur `{ streams: [] }` yang valid.
