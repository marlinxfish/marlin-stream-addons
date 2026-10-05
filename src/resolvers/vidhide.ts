import { StreamResult } from '../types';
import { BaseResolver } from './base';

export class VidhideResolver implements BaseResolver {
  readonly name = 'Vidhide';
  private fetchFn: typeof fetch;

  constructor(fetchFn: typeof fetch = fetch) {
    this.fetchFn = fetchFn;
  }

  canResolve(url: string): boolean {
    return url.includes('vidhide') || url.includes('earnvids');
  }

  async resolve(url: string, qualityHint = '720p'): Promise<StreamResult | null> {
    try {
      const res = await this.fetchFn(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return null;

      const html = await res.text();
      // Extract m3u8 link from javascript or source tag
      const m3u8Match = html.match(/(https?:\/\/[^"']+\.m3u8[^"']*)/);
      if (!m3u8Match) return null;

      const streamUrl = m3u8Match[1];
      const origin = new URL(url).origin;

      return {
        name: `[Vidhide] ${qualityHint}`,
        title: `Vidhide (${qualityHint})`,
        url: streamUrl,
        quality: qualityHint,
        behaviorHints: {
          proxyHeaders: {
            request: {
              Referer: `${origin}/`,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            },
          },
        },
      };
    } catch {
      return null;
    }
  }
}
