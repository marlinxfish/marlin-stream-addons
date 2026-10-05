import { config } from '../config';
import { MediaItemQuery, MediaType } from '../types';

export class CinemetaService {
  private fetchFn: typeof fetch;
  private timeoutMs: number;

  constructor(fetchFn: typeof fetch = fetch, timeoutMs: number = config.requestTimeoutMs) {
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

      const url = `https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`;
      const res = await this.fetchFn(url, { signal: AbortSignal.timeout(this.timeoutMs) });
      let data: { meta?: { name?: string; year?: string | number } } | null = null;
      if (res.ok) {
        data = (await res.json()) as { meta?: { name?: string; year?: string | number } };
      }

      const ID_ALIASES: Record<string, string> = {
        tt33555239: 'tt37853455', // One Night Only (2026) IMDb renumbering
      };

      if (!data?.meta?.name && ID_ALIASES[imdbId]) {
        const aliasUrl = `https://v3-cinemeta.strem.io/meta/${type}/${ID_ALIASES[imdbId]}.json`;
        const aliasRes = await this.fetchFn(aliasUrl, { signal: AbortSignal.timeout(this.timeoutMs) });
        if (aliasRes.ok) {
          data = (await aliasRes.json()) as { meta?: { name?: string; year?: string | number } };
        }
      }

      if (!data?.meta?.name) return null;
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
    } catch {
      return null;
    }
  }
}

export const cinemetaService = new CinemetaService();
