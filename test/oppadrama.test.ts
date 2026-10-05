import { describe, expect, it, mock } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { BaseProvider } from '../src/providers/base';
import { OppadramaProvider } from '../src/providers/oppadrama';
import { parseDownloadLinks, parseEpisodeUrl, parseSearchResults } from '../src/providers/oppadrama/parser';
import { ProviderRegistry } from '../src/providers/registry';
import { ResolverRegistry } from '../src/resolvers/registry';
import { MediaItemQuery, StreamResult } from '../src/types';

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

  it('extracts episode or movie link from eplister/epcheck', () => {
    const html = `
      <div class="eplister">
        <ul>
          <li><a href="http://example.com/ep2"><span class="epl-num">2</span><span class="epl-title">Episode 2</span></a></li>
          <li><a href="http://example.com/ep1"><span class="epl-num">1</span><span class="epl-title">Episode 1</span></a></li>
        </ul>
      </div>
    `;
    expect(parseEpisodeUrl(html)).toBe('http://example.com/ep2');
    expect(parseEpisodeUrl(html, 1)).toBe('http://example.com/ep1');
    expect(parseEpisodeUrl(html, 99)).toBeNull();
    expect(parseEpisodeUrl('<div>none</div>')).toBeNull();
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

  it('returns empty array on search fetch error or empty entries', async () => {
    const mockFetch = mock(async () => new Response('Internal Server Error', { status: 500 }));
    const registry = new ResolverRegistry();
    const provider = new OppadramaProvider('http://212.86.121.175', registry, mockFetch as unknown as typeof fetch);

    const streams = await provider.getStreams({
      imdbId: 'tt1234567',
      type: 'movie',
      title: 'Nonexistent Movie',
    });

    expect(streams).toEqual([]);
  });

  it('prioritizes series episode resolution before general links', async () => {
    const searchHtml = `<div class="result-item"><a href="http://212.86.121.175/series/test-show"><h2 class="title">Test Show (2025)</h2></a></div>`;
    const seriesDetailHtml = `
      <div class="eplister">
        <ul>
          <li><a href="http://212.86.121.175/test-show-episode-1"><span class="epl-num">1</span><span class="epl-title">Episode 1</span></a></li>
          <li><a href="http://212.86.121.175/test-show-episode-2"><span class="epl-num">2</span><span class="epl-title">Episode 2</span></a></li>
        </ul>
      </div>
      <ul>
        <li><strong>Buzzheavier</strong> - 720p <a href="https://buzzheavier.com/show_overall">Download</a></li>
      </ul>
    `;
    const episodeDetailHtml = `
      <ul>
        <li><strong>Buzzheavier</strong> - 1080p <a href="https://buzzheavier.com/ep2_link">Download</a></li>
      </ul>
    `;

    const mockFetch = mock(async (url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.includes('/?s=')) return new Response(searchHtml, { status: 200 });
      if (urlStr.includes('test-show-episode-2')) return new Response(episodeDetailHtml, { status: 200 });
      if (urlStr.includes('test-show')) return new Response(seriesDetailHtml, { status: 200 });
      return new Response('Not found', { status: 404 });
    });

    const registry = new ResolverRegistry();
    registry.resolve = mock(async (url: string, quality?: string) => ({
      name: `[Mock] ${quality}`,
      title: `Resolved ${url}`,
      url,
    }));

    const provider = new OppadramaProvider('http://212.86.121.175', registry, mockFetch as unknown as typeof fetch, 2500);
    const streams = await provider.getStreams({
      imdbId: 'tt9999999',
      type: 'series',
      title: 'Test Show',
      season: 1,
      episode: 2,
    });

    expect(streams.length).toBe(1);
    expect(streams[0].url).toBe('https://buzzheavier.com/ep2_link');
  });

  it('returns empty array when requested episode is not found (anti-mismatch guard)', async () => {
    const searchHtml = `<div class="result-item"><article><a href="http://212.86.121.175/show/"><span class="title">Test Show</span></a></article></div>`;
    const containerHtml = `
      <div class="eplister">
        <ul>
          <li><a href="http://example.com/ep1"><span class="epl-num">1</span></a></li>
        </ul>
      </div>
      <ul><li><strong>Buzzheavier</strong><span>1080p</span><a href="https://buzzheavier.com/fallback">Download</a></li></ul>
    `;

    const mockFetch = mock(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/?s=')) return new Response(searchHtml, { status: 200 });
      return new Response(containerHtml, { status: 200 });
    });

    const registry = new ResolverRegistry();
    const provider = new OppadramaProvider('http://212.86.121.175', registry, mockFetch as unknown as typeof fetch);
    const streams = await provider.getStreams({
      imdbId: 'tt9999999',
      type: 'series',
      title: 'Test Show',
      season: 1,
      episode: 50, // Does not exist
    });

    // Must be empty array, NOT fallback link!
    expect(streams.length).toBe(0);
  });

  it('filters candidate search entries by matching type (movie vs series)', async () => {
    const searchHtml = `
      <div class="listupd">
        <article class="bs"><div class="bsx"><a href="http://example.com/drama-show/"><div class="typez Drama">Drama</div><div class="tt">Drakor Title</div></a></div></article>
        <article class="bs"><div class="bsx"><a href="http://example.com/movie-film/"><div class="typez Movie">Movie</div><div class="tt">Movie Title</div></a></div></article>
      </div>
    `;
    const entries = parseSearchResults(searchHtml);
    expect(entries.length).toBe(2);
    expect(entries[0].type).toBe('series');
    expect(entries[1].type).toBe('movie');
  });
});

describe('ProviderRegistry', () => {
  it('aggregates streams from all registered providers and handles failures', async () => {
    const registry = new ProviderRegistry();

    const mockStream: StreamResult = {
      name: '[Test] 1080p',
      title: 'Test Movie',
      url: 'https://cdn.example.com/stream.mp4',
    };

    const goodProvider: BaseProvider = {
      name: 'GoodProvider',
      baseUrl: 'http://good.example.com',
      getStreams: async (_query: MediaItemQuery) => [mockStream],
    };

    const failingProvider: BaseProvider = {
      name: 'FailingProvider',
      baseUrl: 'http://fail.example.com',
      getStreams: async (_query: MediaItemQuery) => {
        throw new Error('Provider network timeout');
      },
    };

    registry.register(goodProvider);
    registry.register(failingProvider);

    const query: MediaItemQuery = {
      imdbId: 'tt1234567',
      type: 'movie',
      title: 'Test Movie',
    };

    const streams = await registry.getAllStreams(query);
    expect(streams).toEqual([mockStream]);
  });
});
