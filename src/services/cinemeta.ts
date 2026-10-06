import { config } from '../config';
import { FetchFunction, MediaItemQuery, MediaType } from '../types';

export class CinemetaService {
  private fetchFn: FetchFunction;
  private timeoutMs: number;

  constructor(fetchFn: FetchFunction = fetch, timeoutMs: number = config.requestTimeoutMs) {
    this.fetchFn = fetchFn;
    this.timeoutMs = timeoutMs;
  }

  async lookup(type: MediaType, id: string): Promise<MediaItemQuery | null> {
    try {
      const parts = id.split(':');
      const imdbId = parts[0];
      const seasonNum = parts[1] ? Number(parts[1]) : undefined;
      const episodeNum = parts[2] ? Number(parts[2]) : undefined;
      const season = seasonNum !== undefined && !Number.isNaN(seasonNum) ? seasonNum : undefined;
      const episode = episodeNum !== undefined && !Number.isNaN(episodeNum) ? episodeNum : undefined;

      const cinemetaType = type === 'anime' ? (season !== undefined ? 'series' : 'movie') : type;
      const url = `https://v3-cinemeta.strem.io/meta/${cinemetaType}/${imdbId}.json`;
      const res = await this.fetchFn(url, {
        headers: { 'User-Agent': 'MarlinStreamAddon/1.0', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      let data: { meta?: { name?: string; year?: string | number } } | null = null;
      if (res.ok) {
        data = (await res.json()) as { meta?: { name?: string; year?: string | number } };
      }

      const ID_ALIASES: Record<string, string> = {
        tt33555239: 'tt37853455', // One Night Only (2026) IMDb renumbering
      };

      if (!data?.meta?.name && ID_ALIASES[imdbId]) {
        const aliasUrl = `https://v3-cinemeta.strem.io/meta/${type}/${ID_ALIASES[imdbId]}.json`;
        const aliasRes = await this.fetchFn(aliasUrl, {
          headers: { 'User-Agent': 'MarlinStreamAddon/1.0', 'Accept': 'application/json' },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (aliasRes.ok) {
          data = (await aliasRes.json()) as { meta?: { name?: string; year?: string | number } };
        }
      }

      if (!data?.meta?.name) {
        try {
          const imdbRes = await this.fetchFn(`https://sg.media-imdb.com/suggests/t/${imdbId}.json`, {
            signal: AbortSignal.timeout(this.timeoutMs),
          });
          if (imdbRes.ok) {
            const text = await imdbRes.text();
            const match = text.match(/imdb\$[a-zA-Z0-9]+\((.*)\)/);
            if (match) {
              const parsed = JSON.parse(match[1]);
              if (parsed.d && parsed.d.length > 0) {
                const item = parsed.d[0];
                return {
                  imdbId,
                  type,
                  title: item.l,
                  year: typeof item.y === 'number' ? item.y : undefined,
                  season,
                  episode,
                };
              }
            }
          }
        } catch {}
        return null;
      }
      const yearRaw = data.meta.year;
      const year = typeof yearRaw === 'number' ? yearRaw : yearRaw ? parseInt(String(yearRaw), 10) : undefined;

      return {
        imdbId,
        type,
        title: data.meta.name,
        year: isNaN(year as number) ? undefined : year,
        season,
        episode,
      };
    } catch (err) {
      console.error('[cinemeta] caught error:', err);
      return null;
    }
  }
}

export const cinemetaService = new CinemetaService();
