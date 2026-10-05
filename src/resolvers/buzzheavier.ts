import { config } from '../config';
import { StreamResult } from '../types';
import { getRandomUserAgent } from '../utils/http';
import { BaseResolver } from './base';

export class BuzzheavierResolver implements BaseResolver {
  readonly name = 'Buzzheavier';
  private fetchFn: typeof fetch;
  private timeoutMs: number;

  constructor(fetchFn: typeof fetch = fetch, timeoutMs: number = config.requestTimeoutMs) {
    this.fetchFn = fetchFn;
    this.timeoutMs = timeoutMs;
  }
  canResolve(url: string): boolean {
    return url.includes('buzzheavier.com');
  }

  async resolve(url: string, qualityHint = '1080p'): Promise<StreamResult | null> {
    try {
      const fileIdMatch = url.match(/buzzheavier\.com\/([a-zA-Z0-9]+)/);
      if (!fileIdMatch) return null;
      const fileId = fileIdMatch[1];
      const downloadUrl = `https://buzzheavier.com/${fileId}/download`;

      // Check redirect location and measure latency
      const ua = getRandomUserAgent();
      const start = performance.now();
      const res = await this.fetchFn(downloadUrl, {
        method: 'HEAD',
        redirect: 'manual',
        headers: {
          'User-Agent': ua,
          'Accept': '*/*',
          'Referer': 'https://buzzheavier.com/',
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const latencyMs = Math.round(performance.now() - start);

      const location = res.headers.get('location');
      const directUrl = location || downloadUrl;
      const contentLength = res.headers.get('content-length');
      let sizeText: string | undefined;
      if (contentLength) {
        const bytes = parseInt(contentLength, 10);
        if (!isNaN(bytes) && bytes > 0) {
          const mb = bytes / (1024 * 1024);
          sizeText = mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${Math.round(mb)} MB`;
        }
      }

      return {
        name: `[Buzzheavier] ${qualityHint}`,
        title: `Buzzheavier (${qualityHint})`,
        url: directUrl,
        quality: qualityHint,
        server: 'Buzzheavier',
        latencyMs,
        sizeText,
        behaviorHints: {
          proxyHeaders: {
            request: {
              Referer: 'https://buzzheavier.com/',
              'User-Agent': ua,
            },
          },
        },
      };
    } catch {
      return null;
    }
  }
}
