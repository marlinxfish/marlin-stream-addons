import { describe, expect, it } from 'bun:test';
import { resolveStreams } from '../src/addon';
import { cacheService } from '../src/services/cache';
import { decodeConfigParam, filterStreamsByConfig } from '../src/services/config-filter';
import type { StreamResult } from '../src/types';
describe('Config Filter Service in Backend', () => {
  const sampleStreams: StreamResult[] = [
    { name: 'OppaDrama\n1080p', title: 'Stream 1', url: 'http://cdn1', server: 'Buzzheavier', quality: '1080p' },
    { name: 'OppaDrama\n720p', title: 'Stream 2', url: 'http://cdn2', server: 'FileLions', quality: '720p' },
    { name: 'OppaDrama\n1080p', title: 'Stream 3', url: 'http://cdn3', server: 'Vidhide', quality: '1080p' },
    { name: 'OppaDrama\n480p', title: 'Stream 4', url: 'http://cdn4', server: 'Buzzheavier', quality: '480p' },
  ];

  it('always keeps all servers active regardless of server preferences', () => {
    const config = {
      maxResolution: '1080p' as const,
      showSpeed: true,
      showSize: true,
    };

    const filtered = filterStreamsByConfig(sampleStreams, config);
    expect(filtered.length).toBe(4);
  });

  it('filters out resolutions higher than maxResolution', () => {
    const config = {
      servers: { buzzheavier: true, filelions: true, vidhide: true, datanodes: true },
      maxResolution: '720p' as const,
      showSpeed: true,
      showSize: true,
    };

    const filtered = filterStreamsByConfig(sampleStreams, config);
    expect(filtered.every(s => s.quality !== '1080p')).toBe(true);
    expect(filtered.length).toBe(2); // 720p and 480p
  });

  it('returns all streams if config is null or undefined', () => {
    const filtered = filterStreamsByConfig(sampleStreams, null);
    expect(filtered.length).toBe(4);
    const filteredUndef = filterStreamsByConfig(sampleStreams, undefined);
    expect(filteredUndef.length).toBe(4);
  });

  it('decodes base64url encoded config string', () => {
    const payload = {
      servers: { buzzheavier: false, filelions: true, vidhide: true, datanodes: true },
      maxResolution: '720p' as const,
      showSpeed: false,
      showSize: true,
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const decoded = decodeConfigParam(encoded);
    expect(decoded).toEqual(payload);
  });

  it('returns null for invalid or missing encoded config string', () => {
    expect(decodeConfigParam(undefined)).toBeNull();
    expect(decodeConfigParam('')).toBeNull();
    expect(decodeConfigParam('not-valid-json-base64!!!')).toBeNull();
  });

  it('applies config filter via addon stream handler', async () => {
    cacheService.setStream('stream:movie:tt_filter_test', sampleStreams);
    const configPayload = {
      maxResolution: '720p' as const,
      showSpeed: true,
      showSize: true,
    };
    const encoded = Buffer.from(JSON.stringify(configPayload)).toString('base64url');

    const streams = await resolveStreams({ type: 'movie', id: 'tt_filter_test', config: encoded });
    expect(streams).toHaveLength(2);
    expect(streams.every(s => s.quality !== '1080p')).toBe(true);
  });
  it('strips speed and size from title when showSpeed or showSize is false', () => {
    const rawStreams: StreamResult[] = [
      {
        name: 'OppaDrama\n1080p',
        title: '🎬 Movie (2026)\n⚡ Buzzheavier • 1080p • 💾 1.2 GB • 🚀 45ms • 🇮🇩 Sub Indo',
        url: 'http://cdn1',
        server: 'Buzzheavier',
        quality: '1080p',
      },
    ];

    const withoutSpeed = filterStreamsByConfig(rawStreams, { showSpeed: false, showSize: true });
    expect(withoutSpeed[0].title).toBe('🎬 Movie (2026)\n⚡ Buzzheavier • 1080p • 💾 1.2 GB • 🇮🇩 Sub Indo');

    const withoutSize = filterStreamsByConfig(rawStreams, { showSpeed: true, showSize: false });
    expect(withoutSize[0].title).toBe('🎬 Movie (2026)\n⚡ Buzzheavier • 1080p • 🚀 45ms • 🇮🇩 Sub Indo');

    const withoutBoth = filterStreamsByConfig(rawStreams, { showSpeed: false, showSize: false });
    expect(withoutBoth[0].title).toBe('🎬 Movie (2026)\n⚡ Buzzheavier • 1080p • 🇮🇩 Sub Indo');
  });
});
