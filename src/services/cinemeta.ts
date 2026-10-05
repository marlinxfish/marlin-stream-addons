import { MediaItemQuery, MediaType } from '../types';

export class CinemetaService {
  private fetchFn: typeof fetch;

  constructor(fetchFn: typeof fetch = fetch) {
    this.fetchFn = fetchFn;
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
      const res = await this.fetchFn(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) return null;

      const data = (await res.json()) as { meta?: { name?: string; year?: string | number } };
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
