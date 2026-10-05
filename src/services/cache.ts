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
