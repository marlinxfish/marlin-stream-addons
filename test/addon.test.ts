import { describe, expect, it } from 'bun:test';
import type { Request, Response } from 'express';
import { addonBuilder } from '../src/addon';
import { app } from '../src/index';
import { cacheService } from '../src/services/cache';

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

  it('returns cached streams when available', async () => {
    const addonInterface = addonBuilder.getInterface();
    cacheService.setStream('stream:movie:tt_cached_123', [
      { name: 'FastCDN', title: 'Cached Movie 1080p', url: 'https://cdn.example.com/movie.mp4' },
    ]);

    const res = await addonInterface.get('stream', 'movie', 'tt_cached_123');
    expect(res).toBeDefined();
    expect(res.streams).toHaveLength(1);
    expect(res.streams[0].name).toBe('FastCDN');
    expect(res.streams[0].url).toBe('https://cdn.example.com/movie.mp4');
  });
  it('serves manifest and stream through configured express routes', async () => {
    interface FakeResponse {
      status: number;
      body: unknown;
    }

    const manifestRes = await new Promise<FakeResponse>((resolve) => {
      let statusCode = 200;
      const fakeRes = {
        setHeader: () => {},
        status: (code: number) => {
          statusCode = code;
          return fakeRes;
        },
        json: (data: unknown) => resolve({ status: statusCode, body: data }),
        end: (data: unknown) => resolve({ status: statusCode, body: data }),
      } as unknown as Response;
      const fakeReq = {
        method: 'GET',
        url: '/someconfig/manifest.json',
        headers: {},
      } as unknown as Request;
      app.handle(fakeReq, fakeRes);
    });

    const manifestData = manifestRes.body as { id?: string };
    expect(manifestData.id).toBe('community.movieaddons.stream');

    // Test stream endpoint
    cacheService.setStream('stream:movie:tt_route_test', [
      { name: 'TestServer', title: 'Route Test Stream', url: 'https://test.com/stream.mp4' },
    ]);
    const streamRes = await new Promise<FakeResponse>((resolve) => {
      let statusCode = 200;
      const fakeRes = {
        setHeader: () => {},
        status: (code: number) => {
          statusCode = code;
          return fakeRes;
        },
        json: (data: unknown) => resolve({ status: statusCode, body: data }),
      } as unknown as Response;
      const fakeReq = {
        method: 'GET',
        url: '/someconfig/stream/movie/tt_route_test.json',
        headers: {},
      } as unknown as Request;
      app.handle(fakeReq, fakeRes);
    });

    const streamData = streamRes.body as { streams?: Array<{ name?: string }> };
    expect(streamData.streams).toHaveLength(1);
    expect(streamData.streams?.[0]?.name).toBe('TestServer');
  });
});
