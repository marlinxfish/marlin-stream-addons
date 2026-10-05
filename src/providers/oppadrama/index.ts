import { ResolverRegistry } from '../../resolvers/registry';
import { MediaItemQuery, StreamResult } from '../../types';
import { BaseProvider } from '../base';
import { parseDownloadLinks, parseEpisodeUrl, parseSearchResults } from './parser';

export class OppadramaProvider implements BaseProvider {
  readonly name = 'Oppadrama';
  readonly baseUrl: string;
  private resolverRegistry: ResolverRegistry;
  private fetchFn: typeof fetch;

  constructor(
    baseUrl: string,
    resolverRegistry: ResolverRegistry,
    fetchFn: typeof fetch = fetch
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.resolverRegistry = resolverRegistry;
    this.fetchFn = fetchFn;
  }

  async getStreams(query: MediaItemQuery): Promise<StreamResult[]> {
    try {
      const searchUrl = `${this.baseUrl}/?s=${encodeURIComponent(query.title)}`;
      const searchRes = await this.fetchFn(searchUrl, {
        signal: AbortSignal.timeout(6000),
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      });
      if (!searchRes.ok) return [];

      const searchHtml = await searchRes.text();
      const entries = parseSearchResults(searchHtml);
      if (entries.length === 0) return [];

      // Find best match: check title and year
      const normalizedTitle = query.title.toLowerCase();
      let matchedEntry = entries.find((e) => {
        const titleLower = e.title.toLowerCase();
        const matchesTitle = titleLower.includes(normalizedTitle);
        const matchesYear = query.year ? titleLower.includes(String(query.year)) : true;
        return matchesTitle && matchesYear;
      }) || entries[0];

      // Fetch detail page
      const detailRes = await this.fetchFn(matchedEntry.url, {
        signal: AbortSignal.timeout(6000),
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      });
      if (!detailRes.ok) return [];

      let detailHtml = await detailRes.text();
      let extractedLinks = parseDownloadLinks(detailHtml);

      if (extractedLinks.length === 0) {
        const episodeUrl = parseEpisodeUrl(detailHtml, query.episode);
        if (episodeUrl) {
          const epRes = await this.fetchFn(episodeUrl, {
            signal: AbortSignal.timeout(6000),
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          });
          if (epRes.ok) {
            detailHtml = await epRes.text();
            extractedLinks = parseDownloadLinks(detailHtml);
          }
        }
      }
      // Resolve links concurrently with Promise.allSettled
      const resolvePromises = extractedLinks.map(async (link) => {
        const resolved = await this.resolverRegistry.resolve(link.url, link.quality);
        if (resolved) {
          return {
            ...resolved,
            name: `[Oppadrama] ${resolved.name}`,
            title: `${query.title}${query.year ? ` (${query.year})` : ''} - ${resolved.title}`,
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
