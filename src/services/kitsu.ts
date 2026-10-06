import { config } from '../config';
import { FetchFunction, MediaItemQuery, MediaType } from '../types';
import { cacheService } from './cache';
import { safeFetch } from '../utils/http';

export class KitsuService {
  private fetchFn: FetchFunction;
  private timeoutMs: number;

  constructor(fetchFn: FetchFunction = fetch, timeoutMs: number = config.requestTimeoutMs) {
    this.fetchFn = fetchFn;
    this.timeoutMs = timeoutMs;
  }

  async lookup(type: MediaType, id: string): Promise<MediaItemQuery | null> {
    try {
      const stripped = id.startsWith('kitsu:') ? id.slice(6) : id;
      const parts = stripped.split(':');
      const kitsuId = parts[0];
      const episodeNum = parts[1] ? Number(parts[1]) : undefined;
      const episode = episodeNum !== undefined && !Number.isNaN(episodeNum) ? episodeNum : undefined;

      const cacheKey = `kitsu:${kitsuId}:${episode ?? 'full'}`;
      const cached = cacheService.getMeta(cacheKey);
      if (cached) return cached;

      const url = `https://kitsu.io/api/edge/anime/${kitsuId}`;
      const res = await this.fetchFn(url, {
        headers: {
          'Accept': 'application/vnd.api+json',
          'User-Agent': 'MarlinStreamAddon/1.0',
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) return null;

      const body = (await res.json()) as {
        data?: {
          attributes?: {
            canonicalTitle?: string;
            titles?: Record<string, string | undefined>;
            subtype?: string;
            startDate?: string;
          };
        };
      };

      const attrs = body.data?.attributes;
      if (!attrs?.canonicalTitle) return null;

      const rawTitles = [
        attrs.canonicalTitle,
        attrs.titles?.en,
        attrs.titles?.en_jp,
        attrs.titles?.ja_jp,
      ].filter((t): t is string => Boolean(t && t.trim().length > 0));

      const titles = Array.from(new Set(rawTitles));
      const year = attrs.startDate ? parseInt(attrs.startDate.slice(0, 4), 10) : undefined;
      const mediaType: MediaType = attrs.subtype === 'movie' ? 'movie' : type;

      const result: MediaItemQuery = {
        kitsuId,
        type: mediaType,
        title: attrs.canonicalTitle,
        titles,
        year: year && !isNaN(year) ? year : undefined,
        episode,
      };

      cacheService.setMeta(cacheKey, result);
      return result;
    } catch (err) {
      console.error('[KitsuService] Error fetching meta for', id, err);
      return null;
    }
  }
}

export const kitsuService = new KitsuService();
