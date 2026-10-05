import { config } from '../config';
import { StreamResult } from '../types';
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
      const res = await this.fetchFn(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) return null;

      const html = await res.text();
      const directMatch = html.match(/href=["'](https?:\/\/[^"']+\.(?:mp4|mkv))["']/i);
      const streamUrl = directMatch ? directMatch[1] : url;

      return {
        name: `[DataNodes] ${qualityHint}`,
        title: `DataNodes (${qualityHint})`,
        url: streamUrl,
        quality: qualityHint,
        behaviorHints: {
          proxyHeaders: {
            request: {
              Referer: 'https://datanodes.to/',
            },
          },
        },
      };
    } catch {
      return null;
    }
  }
}
