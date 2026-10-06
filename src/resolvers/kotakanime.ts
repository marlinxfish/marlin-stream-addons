import { config } from '../config';
import { FetchFunction, StreamResult } from '../types';
import { getRandomUserAgent } from '../utils/http';
import { BaseResolver } from './base';

export interface KotakSource {
  file: string;
  type: string;
  label?: string;
}

export class KotakanimeResolver implements BaseResolver {
  readonly name = 'KotakVideo';
  private fetchFn: FetchFunction;
  private timeoutMs: number;

  constructor(fetchFn: FetchFunction = fetch, timeoutMs: number = config.requestTimeoutMs) {
    this.fetchFn = fetchFn;
    this.timeoutMs = timeoutMs;
  }

  canResolve(url: string): boolean {
    return url.includes('kotakanimeid.link/video-embed') || url.includes('kotakanimeid');
  }

  async resolveAll(url: string): Promise<StreamResult[]> {
    try {
      const start = performance.now();
      const res = await this.fetchFn(url, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Referer': config.nontonAnimeIdBaseUrl + '/',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const latencyMs = Math.round(performance.now() - start);
      if (!res.ok) return [];

      const html = await res.text();
      const sources = this.unpackSources(html);
      if (!sources || sources.length === 0) return [];

      return sources.map((s) => {
        const quality = s.label || '720p';
        return {
          name: `[KotakVideo] ${quality}`,
          title: `KotakVideo (${quality})`,
          url: s.file,
          quality,
          server: 'KotakVideo',
          latencyMs,
          behaviorHints: {
            notWebReady: false,
          },
        };
      });
    } catch {
      return [];
    }
  }

  async resolve(url: string, qualityHint = '720p'): Promise<StreamResult | null> {
    const streams = await this.resolveAll(url);
    if (streams.length === 0) return null;
    const match = streams.find((s) => s.quality === qualityHint);
    return match || streams[0];
  }

  private unpackSources(html: string): KotakSource[] {
    try {
      const sMatch = html.match(/var\s+s\s*=\s*['"]([^'"]+)['"]\.split\(','\)/);
      const multMatch = html.match(/-(\d+)\*\([a-zA-Z0-9_$]+\+3\)/);
      const atobPrefix = "_w['at'+'ob'](";
      const atobIdx = html.indexOf(atobPrefix);

      if (!sMatch || !multMatch || atobIdx === -1) return [];

      const b64Start = atobIdx + atobPrefix.length;
      const b64End = html.indexOf(");", b64Start);
      if (b64End === -1) return [];

      const rawExpr = html.substring(b64Start, b64End);
      const b64Str = rawExpr.replace(/['"\s]/g, '');

      const sArr = sMatch[1].split(',');
      const mult = parseInt(multMatch[1], 10);
      const key = sArr.map((val, j) => (parseInt(val, 10) - mult * (j + 3)) & 255);

      const rawCipher = Uint8Array.from(atob(b64Str), (c) => c.charCodeAt(0));
      const plainBytes = new Uint8Array(rawCipher.length);
      for (let i = 0; i < rawCipher.length; i++) {
        plainBytes[i] = rawCipher[i] ^ key[i % key.length];
      }

      const decodedText = new TextDecoder().decode(plainBytes);
      const sourcesMatch = decodedText.match(/__activeSources\s*=\s*__isBot\s*\?\s*\[.*?\]\s*:\s*(\[.*?\]);/s);
      if (!sourcesMatch) return [];

      const parsed = JSON.parse(sourcesMatch[1]) as KotakSource[];
      return parsed.filter((s) => s.file && !s.file.includes('blank.mp4'));
    } catch {
      return [];
    }
  }
}
