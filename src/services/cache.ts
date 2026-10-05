import { LRUCache } from 'lru-cache';
import { config } from '../config';
import { MediaItemQuery, StreamResult } from '../types';

export interface CacheOptions {
  streamTtl?: number; // seconds
  metaTtl?: number;   // seconds
}

export class CacheService {
  private streamCache: LRUCache<string, StreamResult[]>;
  private metaCache: LRUCache<string, MediaItemQuery>;
  private streamTtl: number;
  private metaTtl: number;

  constructor(options: CacheOptions = {}) {
    this.streamTtl = options.streamTtl !== undefined ? options.streamTtl : config.cacheStreamTtl;
    this.metaTtl = options.metaTtl !== undefined ? options.metaTtl : config.cacheMetaTtl;

    this.streamCache = new LRUCache<string, StreamResult[]>({
      max: 1000,
      ttl: Math.max(1, this.streamTtl) * 1000,
    });
    this.metaCache = new LRUCache<string, MediaItemQuery>({
      max: 1000,
      ttl: Math.max(1, this.metaTtl) * 1000,
    });
  }

  getStream(key: string): StreamResult[] | null {
    if (this.streamTtl <= 0) return null;
    return this.streamCache.get(key) ?? null;
  }

  setStream(key: string, streams: StreamResult[]): void {
    if (this.streamTtl <= 0) return;
    this.streamCache.set(key, streams);
  }

  getMeta(key: string): MediaItemQuery | null {
    if (this.metaTtl <= 0) return null;
    return this.metaCache.get(key) ?? null;
  }

  setMeta(key: string, meta: MediaItemQuery): void {
    if (this.metaTtl <= 0) return;
    this.metaCache.set(key, meta);
  }

  clear(): void {
    this.streamCache.clear();
    this.metaCache.clear();
  }
}

export const cacheService = new CacheService();
