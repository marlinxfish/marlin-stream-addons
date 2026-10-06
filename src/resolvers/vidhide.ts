import { config } from '../config';
import { FetchFunction, StreamResult } from '../types';
import { getRandomUserAgent } from '../utils/http';
import { BaseResolver } from './base';

export class VidhideResolver implements BaseResolver {
  readonly name = 'Vidhide';
  private fetchFn: FetchFunction;
  private timeoutMs: number;

  constructor(fetchFn: FetchFunction = fetch, timeoutMs: number = config.requestTimeoutMs) {
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
          'Referer': config.oppadramaBaseUrl.replace(/\.nip\.io/g, '') + '/',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const latencyMs = Math.round(performance.now() - start);
      if (!res.ok) return null;
      const html = await res.text();
      let streamUrl: string | null = null;

      // Check Dean Edwards packer safely without eval/new Function
      const marker = 'eval(function(p,a,c,k,e,d)';
      const markerStart = html.indexOf(marker);
      if (markerStart !== -1) {
        const end = html.indexOf(".split('|')))", markerStart);
        if (end !== -1) {
          const block = html.slice(markerStart, end + 13);
          const unpacked = unpackDeanEdwards(block);
          const m3u8Match = unpacked.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/);
          if (m3u8Match) {
            streamUrl = m3u8Match[1];
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

export function unpackDeanEdwards(packed: string): string {
  try {
    const match = packed.match(/}\s*\(\s*(['"][\s\S]*?['"])\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(['"][\s\S]*?['"])\.split\(['"]\|['"]\)/);
    if (!match) return '';
    let p = match[1].slice(1, -1);
    p = p.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
    const a = parseInt(match[2], 10);
    const k = match[4].slice(1, -1).split('|');

    const unbase = (val: string, base: number): number => {
      const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
      if (base <= 36) return parseInt(val, base);
      let res = 0;
      for (let i = 0; i < val.length; i++) {
        const idx = chars.indexOf(val[i]);
        if (idx === -1) return -1;
        res = res * base + idx;
      }
      return res;
    };

    return p.replace(/\b\w+\b/g, (w) => {
      const idx = unbase(w, a);
      return idx >= 0 && idx < k.length && k[idx] ? k[idx] : w;
    });
  } catch {
    return '';
  }
}
