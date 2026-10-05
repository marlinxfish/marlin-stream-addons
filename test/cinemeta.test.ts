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

  it('handles non-numeric season and episode gracefully without NaN', async () => {
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
    const result = await service.lookup('series', 'tt12345:abc:xyz');

    expect(result).not.toBeNull();
    expect(result?.season).toBeUndefined();
    expect(result?.episode).toBeUndefined();
  });
});
