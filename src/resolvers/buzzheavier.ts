import { StreamResult } from '../types';
import { BaseResolver } from './base';

export class BuzzheavierResolver implements BaseResolver {
  readonly name = 'Buzzheavier';
  private fetchFn: typeof fetch;

  constructor(fetchFn: typeof fetch = fetch) {
    this.fetchFn = fetchFn;
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

      // Check redirect location without proxying body
      const res = await this.fetchFn(downloadUrl, {
        method: 'HEAD',
        redirect: 'manual',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(6000),
      });

      const location = res.headers.get('location');
      const directUrl = location || downloadUrl;

      return {
        name: `[Buzzheavier] ${qualityHint}`,
        title: `Buzzheavier (${qualityHint})`,
        url: directUrl,
        quality: qualityHint,
        behaviorHints: {
          proxyHeaders: {
            request: {
              Referer: 'https://buzzheavier.com/',
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
