import { describe, expect, it } from 'bun:test';
import { loadConfig } from '../src/config';

describe('Config Module', () => {
  it('loads default configuration when env is empty', () => {
    const conf = loadConfig({});
    expect(conf.port).toBe(7000);
    expect(conf.oppadramaBaseUrl).toBe('http://212.86.121.175');
    expect(conf.cacheStreamTtl).toBe(3600);
    expect(conf.cacheMetaTtl).toBe(86400);
    expect(conf.requestTimeoutMs).toBe(6000);
  });

  it('trims trailing slashes from provider URLs', () => {
    const conf = loadConfig({ OPPADRAMA_BASE_URL: 'http://example.com/mirror/' });
    expect(conf.oppadramaBaseUrl).toBe('http://example.com/mirror');
  });

  it('parses custom port and timeout from env', () => {
    const conf = loadConfig({ PORT: '8080', REQUEST_TIMEOUT_MS: '8000' });
    expect(conf.port).toBe(8080);
    expect(conf.requestTimeoutMs).toBe(8000);
  });
});
