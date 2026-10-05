import { config } from '../config';
import { StreamResult } from '../types';
import { getRandomUserAgent } from '../utils/http';
import { BaseResolver } from './base';

export class DataNodesResolver implements BaseResolver {
  readonly name = 'DataNodes';
  private fetchFn: typeof fetch;
  private timeoutMs: number;

  constructor(fetchFn: typeof fetch = fetch, timeoutMs: number = config.requestTimeoutMs) {
    this.fetchFn = fetchFn;
    this.timeoutMs = timeoutMs;
  }
  canResolve(url: string): boolean {
    return url.includes('datanodes.to');
  }

  async resolve(url: string, qualityHint = '1080p'): Promise<StreamResult | null> {
    try {
      const ua = getRandomUserAgent();
      const start = performance.now();
      const res = await this.fetchFn(url, {
        headers: {
          'User-Agent': ua,
          'Referer': config.oppadramaBaseUrl + '/',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const latencyMs = Math.round(performance.now() - start);
      if (!res.ok) return null;
      const html = await res.text();
      const directMatch = html.match(/href=["'](https?:\/\/[^"']+\.(?:mp4|mkv))["']/i);
      const streamUrl = directMatch ? directMatch[1] : url;

      return {
        name: `[DataNodes] ${qualityHint}`,
        title: `DataNodes (${qualityHint})`,
        url: streamUrl,
        quality: qualityHint,
        server: 'DataNodes',
        latencyMs,
        behaviorHints: {
          notWebReady: false,
        },
      };
    } catch {
      return null;
    }
  }
}
