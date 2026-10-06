import { config } from '../../config';
import { ResolverRegistry } from '../../resolvers/registry';
import { KotakanimeResolver } from '../../resolvers/kotakanime';
import { FetchFunction, MediaItemQuery, StreamResult } from '../../types';
import { getBrowserHeaders, safeFetch } from '../../utils/http';
import { BaseProvider } from '../base';
import {
  NontonEpisode,
  NontonSearchResult,
  parseAjaxNonce,
  parseEpisodeList,
  parseIframeSrc,
  parsePlayerOptions,
  parseSearchResults,
} from './parser';

export class NontonAnimeIDProvider implements BaseProvider {
  readonly name = 'NontonAnimeID';
  readonly baseUrl: string;
  private resolverRegistry: ResolverRegistry;
  private kotakResolver: KotakanimeResolver;
  private fetchFn: FetchFunction;
  private timeoutMs: number;
  constructor(
    baseUrl: string,
    resolverRegistry: ResolverRegistry,
    fetchFn: FetchFunction = safeFetch,
    timeoutMs: number = config.requestTimeoutMs
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.resolverRegistry = resolverRegistry;
    this.kotakResolver = new KotakanimeResolver(fetchFn, timeoutMs);
    this.fetchFn = fetchFn;
    this.timeoutMs = timeoutMs;
  }

  async getStreams(query: MediaItemQuery): Promise<StreamResult[]> {
    try {
      const searchTerms: string[] = [];
      if ((query.type === 'series' || query.type === 'anime') && query.season && query.season > 1) {
        searchTerms.push(`${query.title} Season ${query.season}`);
      }
      searchTerms.push(query.title);
      if (query.titles && query.titles.length > 0) {
        for (const t of query.titles) {
          if (!searchTerms.includes(t)) {
            searchTerms.push(t);
          }
        }
      }

      let entries: NontonSearchResult[] = [];
      for (const term of searchTerms) {
        const searchUrl = `${this.baseUrl}/?s=${encodeURIComponent(term)}`;
        const res = await this.fetchFn(searchUrl, {
          headers: getBrowserHeaders(this.baseUrl + '/'),
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (res.ok) {
          const html = await res.text();
          const parsed = parseSearchResults(html);
          if (parsed.length > 0) {
            entries = parsed;
            break;
          }
        }
      }

      if (entries.length === 0) return [];

      const matchedEntry = this.findBestMatch(entries, query);
      if (!matchedEntry) return [];

      const detailRes = await this.fetchFn(matchedEntry.url, {
        headers: getBrowserHeaders(this.baseUrl + '/'),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!detailRes.ok) return [];

      const detailHtml = await detailRes.text();
      let watchUrl: string | null = null;

      if ((query.type === 'series' || query.type === 'anime') && query.episode !== undefined) {
        const episodes = parseEpisodeList(detailHtml);
        const targetEp = episodes.find((e) => e.number === query.episode);
        if (targetEp) {
          watchUrl = targetEp.url;
        } else if (episodes.length > 0 && query.episode <= episodes.length) {
          watchUrl = episodes[query.episode - 1].url;
        }
      } else {
        // Movie or default first episode
        const episodes = parseEpisodeList(detailHtml);
        if (episodes.length > 0) {
          watchUrl = episodes[0].url;
        } else {
          watchUrl = matchedEntry.url;
        }
      }

      if (!watchUrl) return [];

      const watchRes = await this.fetchFn(watchUrl, {
        headers: getBrowserHeaders(matchedEntry.url),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!watchRes.ok) return [];

      const watchHtml = await watchRes.text();
      const playerOptions = parsePlayerOptions(watchHtml);
      const nonce = parseAjaxNonce(watchHtml);

      // Collect raw iframe candidates
      const iframeCandidates: { serverName: string; iframeUrl: string }[] = [];
      // Filter only servers we can actually resolve (vidhide, kotak, lokal)
      const supportedOptions = playerOptions.filter((opt) => {
        const t = opt.type.toLowerCase();
        return (
          t.includes('vidhide') ||
          t.includes('kotak') ||
          t.includes('lokal')
        );
      }).slice(0, 3);

      // 2. Fetch tabs via player_ajax
      const ajaxPromises = supportedOptions.map(async (opt) => {
        try {
          const did = 'k_' + Math.random().toString(36).substring(2, 10);
          const params = new URLSearchParams({
            action: 'player_ajax',
            post: opt.post,
            nume: opt.nume,
            serverName: opt.type,
            nonce,
            did,
          });

          const ajaxRes = await this.fetchFn(`${this.baseUrl}/wp-admin/admin-ajax.php`, {
            method: 'POST',
            headers: {
              ...getBrowserHeaders(watchUrl!),
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'Cookie': `_kotak_did=${did}; path=/`,
            },
            body: params.toString(),
            signal: AbortSignal.timeout(this.timeoutMs),
          });

          if (!ajaxRes.ok) return null;
          const ajaxHtml = await ajaxRes.text();
          const iframeSrc = parseIframeSrc(ajaxHtml);
          if (!iframeSrc) return null;

          return { serverName: opt.name || opt.type, iframeUrl: iframeSrc };
        } catch {
          return null;
        }
      });

      const settledAjax = await Promise.allSettled(ajaxPromises);
      for (const item of settledAjax) {
        if (item.status === 'fulfilled' && item.value) {
          if (!iframeCandidates.some((c) => c.iframeUrl === item.value!.iframeUrl)) {
            iframeCandidates.push(item.value);
          }
        }
      }

      // 3. Resolve stream URLs concurrently
      const resolvePromises = iframeCandidates.map(async (candidate) => {
        try {
          if (this.kotakResolver.canResolve(candidate.iframeUrl)) {
            const allKotak = await this.kotakResolver.resolveAll(candidate.iframeUrl);
            return allKotak.map((s) => this.formatStream(s, query, candidate.serverName));
          }

          const resolved = await this.resolverRegistry.resolve(candidate.iframeUrl);
          if (resolved) {
            return [this.formatStream(resolved, query, candidate.serverName)];
          }

          return [];
        } catch {
          return [];
        }
      });

      const settledResolves = await Promise.allSettled(resolvePromises);
      const results: StreamResult[] = [];
      for (const item of settledResolves) {
        if (item.status === 'fulfilled' && item.value) {
          results.push(...item.value);
        }
      }
      return results;
    } catch (err) {
      console.error('[NontonAnimeIDProvider] Error fetching streams:', err);
      return [];
    }
  }

  private findBestMatch(entries: NontonSearchResult[], query: MediaItemQuery): NontonSearchResult | null {
    const isMovie = query.type === 'movie';
    const normTitle = query.title.toLowerCase();

    if (isMovie) {
      const movieMatch = entries.find(
        (e) => (e.type && e.type.toLowerCase() === 'movie') || e.title.toLowerCase().includes('movie')
      );
      if (movieMatch) return movieMatch;
    }

    const exact = entries.find((e) => {
      const d = e.title.toLowerCase();
      const en = e.titleEn?.toLowerCase();
      const jp = e.titleJp?.toLowerCase();
      return d === normTitle || en === normTitle || jp === normTitle;
    });
    if (exact) return exact;

    const partial = entries.find((e) => {
      const d = e.title.toLowerCase();
      const en = e.titleEn?.toLowerCase();
      return d.includes(normTitle) || (en && en.includes(normTitle));
    });
    if (partial) return partial;

    return entries[0] || null;
  }

  private formatStream(resolved: StreamResult, query: MediaItemQuery, serverLabel: string): StreamResult {
    const quality = resolved.quality || 'HD';
    const server = resolved.server || serverLabel || 'Server';
    const isSeries = query.type === 'series' || query.type === 'anime';
    const displayName = `${config.addonIcon} ${config.addonName}\n${quality} • ${server}`;
    const videoFormat = resolved.url.includes('.m3u8') ? 'HLS' : 'MP4';
    const videoEncoder = 'H.264/AVC';
    const videoSize = resolved.sizeText || (videoFormat === 'HLS' ? 'Adaptive HLS' : 'Direct');
    const speedText = resolved.latencyMs !== undefined ? ` • 🚀 ${resolved.latencyMs}ms` : '';

    const cleanTitle = query.title.replace(/\b\w/g, (c) => c.toUpperCase());
    const line1 = isSeries && query.episode !== undefined
      ? `📡 ${cleanTitle} Episode ${query.episode}`
      : `🎬 ${cleanTitle}`;
    const line2 = `💾 ${quality} • 🎞️ ${videoFormat} • ⚙️ ${videoEncoder} • 📦 ${videoSize}`;
    const line3 = `⚡ ${server}${speedText} • 🇮🇩 Subtitle Indonesia`;

    return {
      ...resolved,
      name: displayName,
      title: `${line1}\n${line2}\n${line3}`,
    };
  }
}
