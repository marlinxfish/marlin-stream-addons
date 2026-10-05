import { StreamResult } from '../types';
import { BaseResolver } from './base';

export class DataNodesResolver implements BaseResolver {
  readonly name = 'DataNodes';
  private fetchFn: typeof fetch;

  constructor(fetchFn: typeof fetch = fetch) {
    this.fetchFn = fetchFn;
  }

  canResolve(url: string): boolean {
    return url.includes('datanodes.to');
  }

  async resolve(url: string, qualityHint = '1080p'): Promise<StreamResult | null> {
    try {
      const res = await this.fetchFn(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(6000),
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
