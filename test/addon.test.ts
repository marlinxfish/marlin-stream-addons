import { describe, expect, it } from 'bun:test';
import { manifest, resolveStreams } from '../src/addon';
import { app } from '../src/index';
import { cacheService } from '../src/services/cache';

describe('Stremio Addon Definition', () => {
  it('provides a valid manifest with stream, catalog, and meta resources', () => {
    expect(manifest.id).toBe('community.movieaddons.stream');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.resources).toContain('stream');
    expect(manifest.resources).toContain('catalog');
    expect(manifest.resources).toContain('meta');
    expect(manifest.types).toContain('movie');
    expect(manifest.types).toContain('series');
    expect(manifest.types).toContain('anime');
    expect(manifest.catalogs.length).toBeGreaterThan(0);
    expect(manifest.idPrefixes).toContain('oppa:');
    expect(manifest.idPrefixes).toContain('kitsu:');
  });

  it('handles stream requests returning clean streams array', async () => {
    const streams = await resolveStreams({ type: 'movie', id: 'tt_dummy_not_found' });
    expect(Array.isArray(streams)).toBe(true);
  });
  it('returns cached streams when available', async () => {
    cacheService.setStream('stream:movie:tt_cached_123', [
      { name: 'FastCDN', title: 'Cached Movie 1080p', url: 'https://cdn.example.com/movie.mp4' },
    ]);

    const streams = await resolveStreams({ type: 'movie', id: 'tt_cached_123' });
    expect(streams).toHaveLength(1);
    expect(streams[0].name).toBe('FastCDN');
    expect(streams[0].url).toBe('https://cdn.example.com/movie.mp4');
  });
  it('serves manifest and stream through configured Hono routes', async () => {
    const manifestRes = await app.request('/someconfig/manifest.json');
    expect(manifestRes.status).toBe(200);
    const manifestData = (await manifestRes.json()) as { id?: string };
    expect(manifestData.id).toBe('community.movieaddons.stream');

    // Test stream endpoint
    cacheService.setStream('stream:movie:tt_route_test', [
      { name: 'TestServer', title: 'Route Test Stream', url: 'https://test.com/stream.mp4' },
    ]);

    const streamRes = await app.request('/someconfig/stream/movie/tt_route_test.json');
    expect(streamRes.status).toBe(200);
    const streamData = (await streamRes.json()) as { streams?: { name?: string }[] };
    expect(streamData.streams).toHaveLength(1);
    expect(streamData.streams?.[0]?.name).toBe('TestServer');

    // Test kitsu stream route
    cacheService.setStream('stream:series:kitsu:12:1', [
      { name: 'KitsuAnimeStream', title: 'Ep 1', url: 'https://cdn.example.com/anime.mp4' },
    ]);
    const kitsuRes = await app.request('/stream/series/kitsu:12:1.json');
    expect(kitsuRes.status).toBe(200);
    const kitsuData = (await kitsuRes.json()) as { streams?: { name?: string }[] };
    expect(kitsuData.streams).toHaveLength(1);
    expect(kitsuData.streams?.[0]?.name).toBe('KitsuAnimeStream');
    // Test catalog endpoint
    const catRes = await app.request('/catalog/series/marlin_series/search=dummy.json');
    expect(catRes.status).toBe(200);
    const catData = (await catRes.json()) as { metas?: unknown[] };
    expect(Array.isArray(catData.metas)).toBe(true);

    // Test meta endpoint
    const metaRes = await app.request('/meta/series/oppa:unknown.json');
    expect(metaRes.status).toBe(200);
    const metaData = (await metaRes.json()) as { meta?: unknown };
    expect(metaData.meta).toBeDefined();
  });

  it('provides /health endpoint with diagnostic status', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      status: string;
      service: string;
      uptimeSec: number;
      providers: { oppadrama: boolean; nontonAnimeId: boolean };
    };
    expect(data.status).toBe('ok');
    expect(data.service).toBe('marlin-stream-addons');
    expect(typeof data.uptimeSec).toBe('number');
    expect(data.providers).toBeDefined();
  });
});
