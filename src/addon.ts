import { config } from './config';
import { OppadramaProvider } from './providers/oppadrama';
import { NontonAnimeIDProvider } from './providers/nontonanimeid';
import { ProviderRegistry } from './providers/registry';
import { defaultResolverRegistry } from './resolvers/registry';
import { cacheService } from './services/cache';
import { cinemetaService } from './services/cinemeta';
import { kitsuService } from './services/kitsu';
import type { MediaType, StreamResult } from './types';
import { decodeConfigParam, filterStreamsByConfig } from './services/config-filter';
import { parseDownloadLinks } from './providers/oppadrama/parser';
import { safeFetch } from './utils/http';
export const manifest = {
  id: 'community.movieaddons.stream',
  version: '1.0.0',
  name: 'Marlin Stream Addons',
  description: 'Educational stream resolver indexer for Stremio. Zero-bandwidth direct streaming from public sources. Does not host or store any media.',
  resources: ['catalog', 'meta', 'stream'],
  types: ['movie', 'series', 'anime'],
  catalogs: [
    {
      type: 'series',
      id: 'marlin_series',
      name: 'Marlin - Oppadrama Series',
      extra: [
        { name: 'search', isRequired: false },
        { name: 'skip', isRequired: false },
      ],
    },
    {
      type: 'movie',
      id: 'marlin_movies',
      name: 'Marlin - Oppadrama Movies',
      extra: [
        { name: 'search', isRequired: false },
        { name: 'skip', isRequired: false },
      ],
    },
  ],
  idPrefixes: ['tt', 'oppa:', 'kitsu:'],
  behaviorHints: {
    configurable: true,
  },
};


// Setup Provider Registry
export const providerRegistry = new ProviderRegistry();
if (config.oppadramaEnabled) {
  providerRegistry.register(new OppadramaProvider(config.oppadramaBaseUrl, defaultResolverRegistry));
}
if (config.nontonAnimeIdEnabled) {
  providerRegistry.register(new NontonAnimeIDProvider(config.nontonAnimeIdBaseUrl, defaultResolverRegistry));
}

export async function resolveStreams({
  type,
  id,
  config: rawConfig,
}: {
  type: MediaType;
  id: string;
  config?: string;
}): Promise<StreamResult[]> {
  try {
    const userConfig = decodeConfigParam(rawConfig);
    const cacheKey = `stream:${type}:${id}`;
    let streams: StreamResult[] = cacheService.getStream(cacheKey) || [];

    if (!streams || streams.length === 0) {
      if (id.startsWith('oppa:')) {
        if (!config.oppadramaEnabled) return [];
        const slug = id.slice(5);
        const targetUrl = `${config.oppadramaBaseUrl}/${slug}/`;
        const res = await safeFetch(targetUrl);

        if (!res.ok) return [];

        const html = await res.text();
        const extractedLinks = parseDownloadLinks(html);

        const resolvePromises = extractedLinks.map(async (link) => {
          const resolved = await defaultResolverRegistry.resolve(link.url, link.quality);
          if (resolved) {
            const quality = resolved.quality || link.quality || 'HD';
            const server = resolved.server || link.server || 'Server';
            const isSeries = type === 'series';

            const displayName = `${config.addonIcon} ${config.addonName}\n${quality} • ${server}`;
            const videoFormat = resolved.url.includes('.m3u8') ? 'HLS' : 'MP4';
            const videoEncoder = 'H.264/AVC';
            const videoSize = resolved.sizeText || (videoFormat === 'HLS' ? 'Adaptive HLS' : 'Direct');
            const speedText = resolved.latencyMs !== undefined ? ` • 🚀 ${resolved.latencyMs}ms` : '';

            const isHC = html.toLowerCase().includes('hc') || true;
            const subType = isHC ? 'Hardcoded (HC)' : 'Softsub';

            const cleanName = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
            const line1 = `${isSeries ? '📡' : '🎬'} ${cleanName}`;
            const line2 = `💾 ${quality} • 🎞️ ${videoFormat} • ⚙️ ${videoEncoder} • 📦 ${videoSize}`;
            const line3 = `⚡ ${server}${speedText} • 🇮🇩 Subtitle Indonesia • 📝 ${subType}`;

            return {
              ...resolved,
              name: displayName,
              title: `${line1}\n${line2}\n${line3}`,
            };
          }
          return null;
        });

        const settled = await Promise.allSettled(resolvePromises);
        streams = [];
        for (const item of settled) {
          if (item.status === 'fulfilled' && item.value) {
            streams.push(item.value);
          }
        }
      } else if (id.startsWith('kitsu:')) {
        const meta = await kitsuService.lookup(type, id);

        if (!meta) return [];
        streams = await providerRegistry.getAllStreams(meta);

      } else {
        const meta = await cinemetaService.lookup(type, id);
        if (!meta) return [];
        streams = await providerRegistry.getAllStreams(meta);
      }

      if (streams && streams.length > 0) {
        cacheService.setStream(cacheKey, streams);
      }
    }


    return filterStreamsByConfig(streams || [], userConfig);
  } catch (err) {
    console.error(`[StreamHandler] Error processing ${type}/${id}:`, err);
    return [];
  }
}
