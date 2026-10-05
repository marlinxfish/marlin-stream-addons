import { config } from '../config';
import { StreamResult } from '../types';
import { getRandomUserAgent } from '../utils/http';
import { BaseResolver } from './base';

export class VidhideResolver implements BaseResolver {
  readonly name = 'Vidhide';
  private fetchFn: typeof fetch;
  private timeoutMs: number;

  constructor(fetchFn: typeof fetch = fetch, timeoutMs: number = config.requestTimeoutMs) {
    this.fetchFn = fetchFn;
    this.timeoutMs = timeoutMs;
  }
  canResolve(url: string): boolean {
    return (
      url.includes('vidhide') ||
      url.includes('earnvids') ||
      url.includes('minochinos') ||
      url.includes('filelions')
    );
  }

  async resolve(url: string, qualityHint = '720p'): Promise<StreamResult | null> {
    try {
      let targetUrl = url;
      if (targetUrl.includes('/d/')) {
        targetUrl = targetUrl.replace('/d/', '/v/');
      }

      const ua = getRandomUserAgent();
      const start = performance.now();
      const res = await this.fetchFn(targetUrl, {
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
      let streamUrl: string | null = null;

      // Check Dean Edwards packer
      const marker = 'eval(function(p,a,c,k,e,d)';
      const markerStart = html.indexOf(marker);
      if (markerStart !== -1) {
        const end = html.indexOf(".split('|')))", markerStart);
        if (end !== -1) {
          const block = html.slice(markerStart, end + 13);
          try {
            const fn = new Function(block.replace(/^eval/, 'return'));
            const unpacked = fn();
            const m3u8Match = unpacked.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/);
            if (m3u8Match) {
              streamUrl = m3u8Match[1];
            }
          } catch {
            // fallback to regex on raw html
          }
        }
      }

      if (!streamUrl) {
        const rawMatch = html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/);
        if (rawMatch) {
          streamUrl = rawMatch[1];
        }
      }

      if (!streamUrl) return null;

      const origin = new URL(targetUrl).origin;
      const isFileLions = targetUrl.includes('minochinos') || targetUrl.includes('filelions');
      const serverLabel = isFileLions ? 'FileLions' : 'Vidhide';

      return {
        name: `[${serverLabel}] ${qualityHint}`,
        title: `${serverLabel} (${qualityHint})`,
        url: streamUrl,
        quality: qualityHint,
        server: serverLabel,
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
