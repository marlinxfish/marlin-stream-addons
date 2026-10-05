import { describe, expect, it } from 'bun:test';
import { addonBuilder } from '../src/addon';
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

  it('filters out disabled servers', () => {
    const config = {
      servers: { buzzheavier: false, filelions: true, vidhide: true, datanodes: false },
      maxResolution: '1080p' as const,
      showSpeed: true,
      showSize: true,
    };

    const filtered = filterStreamsByConfig(sampleStreams, config);
    expect(filtered.length).toBe(2);
    expect(filtered.every(s => s.server !== 'Buzzheavier')).toBe(true);
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
      servers: { buzzheavier: false, filelions: true, vidhide: true, datanodes: true },
      maxResolution: '720p' as const,
      showSpeed: true,
      showSize: true,
    };
    const encoded = Buffer.from(JSON.stringify(configPayload)).toString('base64url');

    const addonInterface = addonBuilder.getInterface();
    const res = await addonInterface.get('stream', 'movie', 'tt_filter_test', {}, encoded);
    expect(res.streams).toHaveLength(1);
    expect(res.streams[0].server).toBe('FileLions');
    expect(res.streams[0].quality).toBe('720p');
  });
});
