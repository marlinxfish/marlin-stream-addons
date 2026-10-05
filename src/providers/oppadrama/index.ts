import { config } from '../../config';
import { ResolverRegistry } from '../../resolvers/registry';
import { MediaItemQuery, StreamResult } from '../../types';
import { getBrowserHeaders } from '../../utils/http';
import { BaseProvider } from '../base';
import {
  ExtractedLink,
  parseDownloadLinks,
  parseEpisodeUrl,
  parseMovieWatchUrl,
  parseSearchResults,
} from './parser';

export class OppadramaProvider implements BaseProvider {
  readonly name = 'Oppadrama';
  readonly baseUrl: string;
  private resolverRegistry: ResolverRegistry;
  private fetchFn: typeof fetch;
  private timeoutMs: number;

  constructor(
    baseUrl: string,
    resolverRegistry: ResolverRegistry,
    fetchFn: typeof fetch = fetch,
    timeoutMs: number = config.requestTimeoutMs
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.resolverRegistry = resolverRegistry;
    this.fetchFn = fetchFn;
    this.timeoutMs = timeoutMs;
  }

  async getStreams(query: MediaItemQuery): Promise<StreamResult[]> {
    try {
      let searchQuery = query.title;
      if (query.type === 'series' && query.season && query.season > 1) {
        searchQuery = `${query.title} Season ${query.season}`;
      }

      const searchUrl = `${this.baseUrl}/?s=${encodeURIComponent(searchQuery)}`;
      const searchRes = await this.fetchFn(searchUrl, {
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: getBrowserHeaders(this.baseUrl),
      });
      if (!searchRes.ok) return [];

      const searchHtml = await searchRes.text();
      const entries = parseSearchResults(searchHtml);
      if (entries.length === 0) return [];

      // Filter by type matching (Movie vs Series)
      const normalizedTitle = query.title.toLowerCase();
      const candidateEntries = entries.filter((e) => {
        if (query.type && e.type && e.type !== query.type) {
          return false;
        }
        return true;
      });

      const pool = candidateEntries.length > 0 ? candidateEntries : entries;

      const matchedEntry =
        pool.find((e) => {
          const titleLower = e.title.toLowerCase();
          const matchesTitle = titleLower.includes(normalizedTitle);
          const matchesYear = query.year ? titleLower.includes(String(query.year)) : true;

          if (query.type === 'series' && query.season) {
            if (query.season > 1) {
              const matchesSeason =
                titleLower.includes(`season ${query.season}`) ||
                titleLower.includes(`s${query.season}`);
              return matchesTitle && matchesSeason;
            } else {
              // For season 1, reject later seasons
              const hasLaterSeason = titleLower.match(/season\s*([2-9]|\d{2})/i);
              if (hasLaterSeason) return false;
            }
          }

          return matchesTitle && matchesYear;
        }) || pool[0];

      // Fetch detail page
      const detailRes = await this.fetchFn(matchedEntry.url, {
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: getBrowserHeaders(this.baseUrl),
      });
      if (!detailRes.ok) return [];

      let detailHtml = await detailRes.text();
      let extractedLinks: ExtractedLink[] = [];

      if (query.type === 'series' && query.episode !== undefined) {
        const episodeUrl = parseEpisodeUrl(detailHtml, query.episode);
        if (!episodeUrl) {
          // Strict guard: requested episode not found -> return empty to avoid playing wrong episode
          return [];
        }

        const epRes = await this.fetchFn(episodeUrl, {
          signal: AbortSignal.timeout(this.timeoutMs),
          headers: getBrowserHeaders(this.baseUrl),
        });
        if (!epRes.ok) return [];
        detailHtml = await epRes.text();
        extractedLinks = parseDownloadLinks(detailHtml);
      } else if (query.type === 'movie') {
        // If movie container page, navigate to release watch page
        const movieWatchUrl = parseMovieWatchUrl(detailHtml);
        if (movieWatchUrl && movieWatchUrl !== matchedEntry.url) {
          const movieRes = await this.fetchFn(movieWatchUrl, {
            signal: AbortSignal.timeout(this.timeoutMs),
            headers: getBrowserHeaders(this.baseUrl),
          });
          if (movieRes.ok) {
            const movieHtml = await movieRes.text();
            extractedLinks = parseDownloadLinks(movieHtml);
          }
        }
      }

      if (extractedLinks.length === 0) {
        extractedLinks = parseDownloadLinks(detailHtml);
      }
      // Resolve links concurrently with Promise.allSettled
      const resolvePromises = extractedLinks.map(async (link) => {
        const resolved = await this.resolverRegistry.resolve(link.url, link.quality);
        if (resolved) {
          const quality = resolved.quality || link.quality || 'HD';
          const server = resolved.server || link.server || 'Server';
          const speedText = resolved.latencyMs !== undefined ? ` • 🚀 ${resolved.latencyMs}ms` : '';
          const sizeText = resolved.sizeText ? ` • 💾 ${resolved.sizeText}` : '';

          const isSeries = query.type === 'series' && query.season !== undefined && query.episode !== undefined;
          const headerLine = isSeries
            ? `📡 ${query.title}${query.year ? ` (${query.year})` : ''} • S${String(query.season).padStart(2, '0')}E${String(query.episode).padStart(2, '0')}`
            : `🎬 ${query.title}${query.year ? ` (${query.year})` : ''}`;

          const displayTitle = `${headerLine}\n⚡ ${server} • 💾 ${quality}${sizeText}${speedText} • 🇮🇩 Sub Indo`;
          const displayName = `${config.addonIcon}\n${config.addonName}\n${quality}`;

          return {
            ...resolved,
            name: displayName,
            title: displayTitle,
          };
        }
        return null;
      });

      const settled = await Promise.allSettled(resolvePromises);
      const results: StreamResult[] = [];
      for (const item of settled) {
        if (item.status === 'fulfilled' && item.value) {
          results.push(item.value);
        }
      }

      return results;
    } catch {
      return [];
    }
  }
}
